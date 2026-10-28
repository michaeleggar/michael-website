// Detail shots for one site's shot file, recorded in real time with Chrome's
// screencast, so scripted carousels, tabs, and accordions keep their real
// timing with the CSS. Each shot is designed to end where it starts, so it
// loops. Frames are resampled to 30fps with the pointer logged per frame.
// Usage: node live.js shots/<site>.js [shot]
const fs = require('fs');
const path = require('path');
const { puppeteer, CHROME, DESKTOP, open, locate, pointerAt } = require('./lib');

const FPS = 30;
const cfg = require(path.resolve(process.argv[2]));
const only = process.argv[3];

(async () => {
  const browser = await puppeteer.launch({ executablePath: CHROME, headless: 'new', args: ['--hide-scrollbars', '--force-device-scale-factor=2'] });
  for (const shot of cfg.details) {
    if (only && shot.name !== only) continue;
    const dir = path.join(__dirname, 'frames', `${cfg.site}-${shot.name}`);
    fs.rmSync(dir, { recursive: true, force: true }); fs.mkdirSync(dir, { recursive: true });
    const page = await open(browser, shot.url || cfg.url, shot.height ? { ...DESKTOP, height: shot.height } : DESKTOP, { css: cfg.css });
    // A detail doesn't need the site's sticky header unless it's the subject.
    if (!shot.keepHeader) await page.evaluate(() => {
      for (const el of document.querySelectorAll('body *')) {
        const cs = getComputedStyle(el);
        if ((cs.position === 'fixed' || cs.position === 'sticky') && el.getBoundingClientRect().top <= 1 && el.getBoundingClientRect().height < 260) el.style.setProperty('visibility', 'hidden', 'important');
      }
    });
    // Bring the detail into view: the block holding `pin.text` at `pin.top`.
    const target = await page.evaluate(({ text, top }) => {
      const leaf = [...document.querySelectorAll('body *')].filter(n => n.textContent.toLowerCase().includes(text.toLowerCase()) && n.getBoundingClientRect().height > 0).sort((a, b) => a.textContent.length - b.textContent.length)[0];
      const y = Math.round(leaf.getBoundingClientRect().top + scrollY - top);
      window.scrollTo(0, y);
      return y;
    }, shot.pin);
    await new Promise(r => setTimeout(r, 1200));
    // Some sites run a smooth-scroll script that undoes scrollTo but follows the wheel.
    for (let tries = 0; tries < 6; tries++) {
      const off = target - await page.evaluate(() => scrollY);
      if (Math.abs(off) < 2) break;
      await page.mouse.wheel({ deltaY: off });
      await new Promise(r => setTimeout(r, 1500));
    }
    // Open anything whose contents the pointer will need, before measuring.
    for (const css of shot.reveal || []) { await page.click(css); await new Promise(r => setTimeout(r, 900)); }
    const points = {};
    for (const [, , from, to] of shot.pointer) for (const t of [from, to]) points[t] ??= await locate(page, t);
    // Visit each target once first, so hover images are loaded and warm.
    for (const target of Object.keys(points)) { await page.mouse.move(points[target].x, points[target].y); await new Promise(r => setTimeout(r, 500)); }
    for (const action of shot.reset || []) { await page.mouse.click(points[action].x, points[action].y); await new Promise(r => setTimeout(r, 2500)); }
    for (const css of shot.resetSel || []) { await page.click(css); await new Promise(r => setTimeout(r, 900)); }
    const first = pointerAt(shot.pointer, points, 0);
    await page.mouse.move(first.x, first.y);
    await new Promise(r => setTimeout(r, 1500));

    const client = await page.createCDPSession();
    const frames = [];
    client.on('Page.screencastFrame', ({ data, metadata, sessionId }) => {
      frames.push({ data, time: metadata.timestamp });
      client.send('Page.screencastFrameAck', { sessionId }).catch(() => {});
    });
    await client.send('Page.startScreencast', { format: 'jpeg', quality: 92, everyNthFrame: 1 });
    await new Promise(r => setTimeout(r, 400));
    const clicks = [...(shot.clicks || [])];
    const start = Date.now() / 1000;
    while (true) {
      const t = Date.now() / 1000 - start;
      if (t > shot.seconds + 0.1) break;
      const p = pointerAt(shot.pointer, points, t);
      await page.mouse.move(p.x, p.y);
      if (clicks.length && clicks[0] <= t) { clicks.shift(); await page.mouse.down(); await page.mouse.up(); }
      await new Promise(r => setTimeout(r, 6));
    }
    await new Promise(r => setTimeout(r, 300));
    await client.send('Page.stopScreencast');

    const total = Math.round(shot.seconds * FPS), log = [];
    for (let i = 0; i < total; i++) {
      const t = start + i / FPS;
      let pick = frames[0];
      for (const f of frames) { if (f.time <= t) pick = f; else break; }
      fs.writeFileSync(path.join(dir, `${String(i + 1).padStart(4, '0')}-0.jpg`), Buffer.from(pick.data, 'base64'));
      log.push(pointerAt(shot.pointer, points, i / FPS));
    }
    fs.writeFileSync(path.join(dir, 'pointer.json'), JSON.stringify(log));
    const span = frames.at(-1).time - frames[0].time;
    console.log(`${cfg.site}-${shot.name}: ${frames.length} frames over ${span.toFixed(1)}s -> ${total}`);
    await page.close();
  }
  await browser.close();
})();
