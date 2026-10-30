// Records the original chat app as two real windows (the crew panel and the actor's screen),
// each screencast on its own, then composites them onto one stage per 30fps frame, with the
// pointer logged in stage coordinates for clips.js. Framing both apps in one page doesn't work:
// framed, they never draw, so the screencast gets nothing and input stalls.
// Serve demos/chatapp/v1 at 127.0.0.1:4719 first (python3 -m http.server 4719 --bind 127.0.0.1).
// node chatrec.js shots/chatapp.js [name] [--still]
const fs = require('fs'), path = require('path');
const puppeteer = require('./tools/node_modules/puppeteer-core');
const sharp = require('/Users/chadeggar/Projects/michael-website/node_modules/sharp');
const { pointerAt } = require('./lib');
const FPS = 30, ORIGIN = 'http://127.0.0.1:4719', DPR = 2;
const FILM = __dirname;

function layout(shot) {
  const M = shot.margin ?? 44, G = shot.gap ?? 36;
  const wins = shot.windows.map(w => { const r = w.region || [0, 0, w.size[0], w.size[1]]; return { ...w, r, W: Math.round(r[2] * w.scale), H: Math.round(r[3] * w.scale) }; });
  // Side by side by default; `column` stacks the windows instead.
  const along = shot.column ? 'H' : 'W', across = shot.column ? 'W' : 'H';
  const length = wins.reduce((a, w) => a + w[along], 0) + G * (wins.length - 1), depth = Math.max(...wins.map(w => w[across]));
  let width = M * 2 + (shot.column ? depth : length), height = M * 2 + (shot.column ? length : depth);
  width += width % 2; height += height % 2;
  let at = M;
  for (const w of wins) {
    if (shot.column) { w.Y = at; w.X = M + Math.round((width - 2 * M - w.W) / 2); at += w.H + G; }
    else { w.X = at; w.Y = M + Math.round((height - 2 * M - w.H) / 2); at += w.W + G; }
  }
  return { wins, width, height };
}

// The stage without its windows' contents: background, window shapes, shadows.
const stageHtml = (L, bg) => `<!doctype html><html><head><style>html,body{margin:0;height:100%;background:${bg};overflow:hidden}
.win{position:absolute;background:#fff;box-shadow:0 0 0 1px rgba(40,30,10,.07),0 10px 30px rgba(40,30,10,.10)}</style></head><body>
${L.wins.map(w => `<div class="win" style="left:${w.X}px;top:${w.Y}px;width:${w.W}px;height:${w.H}px;border-radius:${w.radius ?? 10}px"></div>`).join('')}</body></html>`;

// Targets: 'rest:x,y' (stage fractions) or '<window id>:css[@text[@nth]]', in stage coordinates.
async function locate(pages, L, target) {
  if (target.startsWith('rest:')) { const [fx, fy] = target.slice(5).split(',').map(Number); return { x: L.width * fx, y: L.height * fy }; }
  const id = target.slice(0, target.indexOf(':')), rest = target.slice(target.indexOf(':') + 1);
  const w = L.wins.find(w => w.id === id);
  const box = await pages[id].evaluate(rest => {
    const [css, text, nth] = rest.split('@');
    const els = [...document.querySelectorAll(css)].filter(n => { const r = n.getBoundingClientRect(); return r.width > 0 && r.height > 0 && (!text || n.textContent.trim().toLowerCase().includes(text.toLowerCase())); });
    const n = els[Number(nth || 0)]; if (!n) return null;
    const r = n.getBoundingClientRect(); return { x: r.x + Math.min(r.width * 0.5, 40), y: r.y + r.height / 2 };
  }, rest);
  if (!box) throw new Error('Target not found: ' + target);
  return { x: w.X + (box.x - w.r[0]) * w.scale, y: w.Y + (box.y - w.r[1]) * w.scale };
}

// Actions run on the element itself (a select's value can't be picked from a native popup on film).
const ACTIONS = {
  click: "el.focus?.(); el.click(); return 'ok'",
  right: "const r = el.getBoundingClientRect(); el.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true, clientX: r.x + Math.min(r.width / 2, 120), clientY: r.y + r.height / 2, button: 2 })); return 'ok'",
  set: "el.value = arg; el.dispatchEvent(new Event('input', { bubbles: true })); el.dispatchEvent(new Event('change', { bubbles: true })); return 'ok'",
  type: "el.focus(); const { text, delay, at } = arg; [...text].forEach((ch, i) => setTimeout(() => { if (at != null) { const n = at + i; el.value = el.value.slice(0, n) + ch + el.value.slice(n); el.setSelectionRange(n + 1, n + 1); } else el.value += ch; el.dispatchEvent(new InputEvent('input', { bubbles: true, data: ch, inputType: 'insertText' })); }, i * delay)); return 'ok'",
};
async function act(pages, target, fn, arg) {
  const id = target.slice(0, target.indexOf(':')), rest = target.slice(target.indexOf(':') + 1);
  return pages[id].evaluate((rest, fn, arg) => {
    const [css, text, nth] = rest.split('@');
    const els = [...document.querySelectorAll(css)].filter(n => { const r = n.getBoundingClientRect(); return r.width > 0 && r.height > 0 && (!text || n.textContent.trim().toLowerCase().includes(text.toLowerCase())); });
    const el = els[Number(nth || 0)]; if (!el) return 'missing ' + rest;
    return new Function('el', 'arg', fn)(el, arg);
  }, rest, fn, arg);
}

const roundMask = (w, h, r) => Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}"><rect width="${w}" height="${h}" rx="${r}" ry="${r}" fill="#fff"/></svg>`);

(async () => {
  const shots = require(path.resolve(process.argv[2])), only = process.argv[3], still = process.argv.includes('--still');
  const browser = await puppeteer.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: 'new', args: ['--hide-scrollbars'] });
  const bsession = await browser.target().createCDPSession();
  // A page in a window of its own: background tabs don't draw.
  const window = async (w, h) => {
    const { targetId } = await bsession.send('Target.createTarget', { url: 'about:blank', newWindow: true });
    const page = await (await browser.waitForTarget(t => t._targetId === targetId)).page();
    await page.setViewport({ width: w, height: h, deviceScaleFactor: DPR });
    return page;
  };
  for (const shot of shots) {
    if (only && only !== '--still' && shot.name !== only) continue;
    const L = layout(shot);
    const dir = path.join(FILM, 'frames', `chatapp-${shot.name}`);
    fs.rmSync(dir, { recursive: true, force: true }); fs.mkdirSync(dir, { recursive: true });
    const stage = await window(L.width, L.height);
    await stage.goto(ORIGIN + '/index.html');
    await stage.evaluate(store => { localStorage.clear(); for (const [k, v] of Object.entries(store || {})) localStorage.setItem(k, JSON.stringify(v)); }, shot.storage);
    await stage.setContent(stageHtml(L, shot.bg || '#ebe6da'));
    const bg = Buffer.from(await stage.screenshot({ type: 'png' }));
    const pages = {};
    for (const w of L.wins) { pages[w.id] = await window(w.size[0], w.size[1]); await pages[w.id].goto(ORIGIN + w.src, { waitUntil: 'networkidle0' }); }
    await new Promise(r => setTimeout(r, 1200));
    // Seed the scene the way the bridge did: clear, then the opening lines a minute apart.
    await stage.evaluate(lines => {
      const ch = new BroadcastChannel('chat_app_legacy_bus');
      ch.postMessage({ type: 'takeReset' }); ch.postMessage({ type: 'switchView', view: 'main' });
      const start = Date.now() - lines.length * 60000 - 600000;
      lines.forEach(([userId, text], i) => ch.postMessage({ type: 'message', id: 'msg_seed' + i, thread: 'main', userId, text, timestamp: start + i * 60000 }));
    }, shot.opening || []);
    await new Promise(r => setTimeout(r, 1200));
    // The screen's font can land after the opening lines; settle the feed on the newest message.
    if (pages.scr) await pages.scr.evaluate(async () => { await document.fonts.ready; await new Promise(r => setTimeout(r, 300)); const f = document.querySelector('#messageFeed'); f.scrollTop = f.scrollHeight; });
    // Park each window's own pointer somewhere blank.
    for (const w of L.wins) await pages[w.id].mouse.move(w.size[0] - 3, w.size[1] - 3);
    await new Promise(r => setTimeout(r, 600));

    const casts = {};
    for (const w of L.wins) {
      const c = await pages[w.id].createCDPSession(), list = [];
      c.on('Page.screencastFrame', ({ data, metadata, sessionId }) => { list.push({ data, time: metadata.timestamp }); c.send('Page.screencastFrameAck', { sessionId }).catch(() => {}); });
      await c.send('Page.startScreencast', { format: 'jpeg', quality: 95, everyNthFrame: 1, maxWidth: w.size[0] * DPR, maxHeight: w.size[1] * DPR });
      casts[w.id] = { c, list };
    }
    // A screencast only sends frames when something changes; take a still of each window to start from.
    const startShots = {};
    for (const w of L.wins) startShots[w.id] = { data: Buffer.from(await pages[w.id].screenshot({ type: 'jpeg', quality: 95 })).toString('base64'), time: 0 };
    if (still) {
      await compose(0, L, bg, { ...startShots }, path.join(__dirname, `${shot.name}-still.png`));
      console.log(shot.name, L.width, L.height);
    } else {
      const points = {};
      for (const [, , a, b] of shot.pointer) for (const t of [a, b]) if (!shot.late?.includes(t)) points[t] ??= await locate(pages, L, t);
      const events = [...(shot.events || [])].sort((a, b) => a.t - b.t);
      let over = null;
      const start = Date.now() / 1000;
      while (true) {
        const t = Date.now() / 1000 - start;
        if (t > shot.seconds + 0.1) break;
        for (const seg of shot.pointer) if (t >= seg[0] - 0.05) for (const k of [seg[2], seg[3]]) if (!points[k]) points[k] = await locate(pages, L, k);
        const p = pointerAt(shot.pointer, points, t);
        // Move the real pointer of whichever window the drawn one is over, for hover states.
        const w = L.wins.find(w => p.x >= w.X && p.x < w.X + w.W && p.y >= w.Y && p.y < w.Y + w.H);
        if (over && over !== w) await pages[over.id].mouse.move(over.size[0] - 3, over.size[1] - 3);
        if (w) await pages[w.id].mouse.move(w.r[0] + (p.x - w.X) / w.scale, w.r[1] + (p.y - w.Y) / w.scale);
        over = w;
        while (events.length && events[0].t <= t) {
          const e = events.shift();
          for (const kind of Object.keys(ACTIONS)) if (e[kind]) { const r = await act(pages, e[kind], ACTIONS[kind], e.arg); if (r !== 'ok') console.log(t.toFixed(2), kind, e[kind], r); }
          if (e.js) await pages[e.page].evaluate(e.js);
        }
        await new Promise(r => setTimeout(r, 8));
      }
      await new Promise(r => setTimeout(r, 300));
      for (const w of L.wins) await casts[w.id].c.send('Page.stopScreencast');
      const total = Math.round(shot.seconds * FPS), log = [];
      for (let i = 0; i < total; i++) {
        const tt = start + i / FPS, picks = {};
        for (const w of L.wins) { let pick = startShots[w.id]; for (const f of casts[w.id].list) { if (f.time <= tt) pick = f; else break; } picks[w.id] = pick; }
        await compose(i, L, bg, picks, path.join(dir, `${String(i + 1).padStart(4, '0')}-0.jpg`));
        log.push(pointerAt(shot.pointer, points, i / FPS));
      }
      fs.writeFileSync(path.join(dir, 'pointer.json'), JSON.stringify(log));
      console.log(`chatapp-${shot.name}: ${L.wins.map(w => `${w.id} ${casts[w.id].list.length}`).join(', ')} frames -> ${total}; stage ${L.width}x${L.height} (css: ${L.width})`);
    }
    for (const p of [stage, ...Object.values(pages)]) await p.close();
  }
  await browser.close();
})();

const cache = new Map();
async function compose(i, L, bg, picks, out) {
  const layers = [];
  for (const w of L.wins) {
    const key = picks[w.id].time, hit = cache.get(w.id);
    if (!hit || hit.key !== key) {
      // Screencast frames can arrive at a lower density than screenshots; crop by the frame's own scale.
      const src = sharp(Buffer.from(picks[w.id].data, 'base64')), f = (await src.metadata()).width / w.size[0];
      const [x, y, rw, rh] = w.r.map(v => Math.round(v * f));
      const W = w.W * DPR, H = w.H * DPR, R = Math.round((w.radius ?? 10) * DPR);
      const img = await src.extract({ left: x, top: y, width: rw, height: rh }).resize(W, H, { kernel: 'lanczos3' })
        .ensureAlpha().composite([{ input: roundMask(W, H, R), blend: 'dest-in' }]).png().toBuffer();
      cache.set(w.id, { key, img });
    }
    layers.push({ input: cache.get(w.id).img, left: w.X * DPR, top: w.Y * DPR });
  }
  await sharp(bg).composite(layers).jpeg({ quality: 94 }).toFile(out);
}
