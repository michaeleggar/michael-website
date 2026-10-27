// Records eased, scripted visits to the live DuctWorx site. Each output frame
// (30fps) is SUB sub-frames taken across the frame's shutter, blended later
// into natural motion blur. The page's own animations run SLOW times slower
// while capturing, and every sub-frame is taken on schedule against that clock.
// Pointer positions are logged so a cursor can be drawn in afterwards.
const fs = require('fs');
const path = require('path');
const puppeteer = require('./tools/node_modules/puppeteer-core');

const FPS = 30, SUB = 4, SHUTTER = 0.75, SLOW = 24;
const OUT = path.join(__dirname, 'frames');
const only = process.argv[2];

const ease = t => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const quint = t => (t < 0.5 ? 16 * t ** 5 : 1 - Math.pow(-2 * t + 2, 5) / 2);
const sine = t => -(Math.cos(Math.PI * t) - 1) / 2;
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

function track(moves, initial) {
  return t => {
    let value = initial;
    for (const [start, end, from, to, curve = quint] of moves) {
      if (t >= end) value = to;
      else if (t > start) return from + (to - from) * curve((t - start) / (end - start));
    }
    return value;
  };
}

// The MacBook Pro 14's 1512x982 display, less the browser bar drawn on later.
const laptop = { width: 1512, height: 926, deviceScaleFactor: 1.5 };
// An iPhone 15 Pro's 393x852, less the status bar and Safari's bottom bar.
const phone = { width: 393, height: 736, deviceScaleFactor: 2, isMobile: true, hasTouch: true };

const shots = [
  {
    name: 'desk-home', url: 'https://ductworxokc.com/', viewport: laptop, seconds: 5,
    scroll: track([[1.5, 3.7, 0, 940]], 0),
    pointer: [
      [0, 0.4, 'rest', 'rest'],
      [0.4, 1.1, 'rest', 'link:Products'],
      [1.1, 1.6, 'link:Products', 'link:Products'],
      [1.6, 2.6, 'link:Products', 'text:Round'],
      [2.6, 3.9, 'text:Round', 'text:Round'],
      [3.9, 4.6, 'text:Round', 'link:Our Team'],
      [4.6, 5.0, 'link:Our Team', 'link:Our Team'],
    ],
  },
  {
    name: 'desk-team', url: 'https://ductworxokc.com/our-team/', viewport: laptop, seconds: 2.5,
    scroll: track([[0.25, 2.5, 0, 760, ease]], 0),
    pointer: [[0, 0.5, 'link:Our Team', 'link:Our Team'], [0.5, 2.5, 'link:Our Team', 'rest']],
  },
  {
    name: 'phone-home', url: 'https://ductworxokc.com/', viewport: phone, seconds: 8,
    scroll: track([[0.8, 2.0, 0, 640], [2.9, 4.1, 640, 1420], [5.0, 6.2, 1420, 2180], [7.0, 8.0, 2180, 2500]], 0),
  },
  {
    name: 'phone-menu', url: 'https://ductworxokc.com/products/', viewport: phone, seconds: 8,
    scroll: track([[0.5, 1.7, 0, 520], [5.4, 6.6, 520, 1160]], 0),
    taps: [[2.4, 'menu'], [4.4, 'menu']],
  },
  {
    name: 'phone-team', url: 'https://ductworxokc.com/our-team/', viewport: phone, seconds: 8,
    scroll: track([[1.3, 2.5, 0, 700], [3.4, 4.6, 700, 1500], [5.6, 6.8, 1500, 2300]], 0),
  },
];

async function resolvePoint(page, target) {
  const { width, height } = page.viewport();
  if (target === 'rest') return { x: width * 0.74, y: height * 0.68 };
  const [kind, text] = target.split(':');
  const box = await page.evaluate((kind, text) => {
    const nodes = kind === 'link' ? [...document.querySelectorAll('a')] : [...document.querySelectorAll('body *')].filter(n => n.children.length === 0);
    const node = nodes.find(n => n.textContent.trim().toLowerCase() === text.toLowerCase() && n.getBoundingClientRect().width > 0);
    if (!node) return null;
    const r = node.getBoundingClientRect();
    return { x: r.x + r.width / 2, y: r.y + r.height / 2 + scrollY };
  }, kind, text);
  if (!box) throw new Error(`No ${target} on page`);
  return { ...box, doc: kind !== 'link' };
}

async function record(browser, shot) {
  const dir = path.join(OUT, shot.name);
  fs.rmSync(dir, { recursive: true, force: true });
  fs.mkdirSync(dir, { recursive: true });
  const page = await browser.newPage();
  await page.setViewport(shot.viewport);
  await page.goto(shot.url, { waitUntil: 'networkidle2', timeout: 90000 });
  await page.addStyleTag({ content: 'html { scroll-behavior: auto !important; } *::-webkit-scrollbar { display: none; } .grecaptcha-badge { visibility: hidden !important; }' });
  // Real input releases the site's delayed scripts (sticky header, sliders, menu).
  await page.mouse.move(shot.viewport.width * 0.74, shot.viewport.height * 0.68);
  await page.mouse.move(shot.viewport.width * 0.75, shot.viewport.height * 0.67);
  await new Promise(r => setTimeout(r, 3000));
  // Load everything below the fold, so nothing pops in while recording.
  const height = await page.evaluate(() => document.documentElement.scrollHeight);
  for (let y = 0; y < height; y += 500) { await page.evaluate(y => scrollTo(0, y), y); await new Promise(r => setTimeout(r, 120)); }
  await page.evaluate(() => document.querySelectorAll('.swiper, .swiper-container').forEach(el => el.swiper?.autoplay?.stop()));
  await page.evaluate(() => window.scrollTo(0, 0));
  await new Promise(r => setTimeout(r, 1200));

  const points = {};
  for (const move of shot.pointer || []) for (const target of [move[2], move[3]]) points[target] ??= await resolvePoint(page, target);

  const client = await page.createCDPSession();
  await client.send('Animation.enable');
  await client.send('Animation.setPlaybackRate', { playbackRate: 1 / SLOW });

  const frames = Math.round(shot.seconds * FPS);
  const taps = [...(shot.taps || [])];
  const log = [];
  const start = Date.now();
  let late = 0;
  for (let i = 0; i < frames; i++) {
    const frame = [];
    for (let s = 0; s < SUB; s++) {
      const t = (i + (s / SUB) * SHUTTER) / FPS;
      const due = start + t * SLOW * 1000;
      const wait = due - Date.now();
      if (wait > 0) await new Promise(r => setTimeout(r, wait)); else late++;
      while (taps.length && taps[0][0] <= t) {
        taps.shift();
        const box = await page.evaluate(() => { const r = document.querySelector('.elementor-menu-toggle')?.getBoundingClientRect(); return r && { x: r.x + r.width / 2, y: r.y + r.height / 2 }; });
        if (box) await page.touchscreen.tap(box.x, box.y);
      }
      const y = shot.scroll(t);
      await page.evaluate(y => window.scrollTo(0, y), Math.round(y * shot.viewport.deviceScaleFactor) / shot.viewport.deviceScaleFactor);
      let cursor = null;
      if (shot.pointer) {
        const [s0, e0, from, to] = shot.pointer.find(([a, b]) => t >= a && t < b) || shot.pointer.at(-1);
        const k = sine(clamp((t - s0) / (e0 - s0), 0, 1));
        const on = p => ({ x: p.x, y: p.doc ? p.y - y : p.y });
        const a = on(points[from]), b = on(points[to]);
        cursor = { x: a.x + (b.x - a.x) * k, y: a.y + (b.y - a.y) * k - Math.sin(Math.PI * k) * (from === to ? 0 : 22) };
        await page.mouse.move(cursor.x, cursor.y);
      }
      if (s === 0) log.push(cursor);
      await page.screenshot({ path: path.join(dir, `${String(i + 1).padStart(4, '0')}-${s}.jpg`), type: 'jpeg', quality: 93, optimizeForSpeed: true });
    }
  }
  fs.writeFileSync(path.join(dir, 'pointer.json'), JSON.stringify(log));
  await page.close();
  console.log(`${shot.name}: ${frames} frames x ${SUB}${late ? `, ${late} late` : ''}`);
}

(async () => {
  const browser = await puppeteer.launch({
    executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    headless: 'new',
    args: ['--hide-scrollbars'],
  });
  for (const shot of shots) if (!only || shot.name.startsWith(only)) await record(browser, shot);
  await browser.close();
})();
