// Records a shot in real time with Chrome's screencast, for interactions where
// scripts and CSS must keep their real timing together (slowing only the CSS
// would put them out of step). Frames are resampled to 30fps afterwards, in
// the same layout record.js writes, with the pointer logged per frame.
const fs = require('fs');
const path = require('path');
const puppeteer = require('./tools/node_modules/puppeteer-core');

const FPS = 30;
const OUT = path.join(__dirname, 'frames');
const sine = t => -(Math.cos(Math.PI * t) - 1) / 2;
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

const shot = {
  name: 'grid-live', url: 'https://ductworxokc.com/', viewport: { width: 1512, height: 926, deviceScaleFactor: 2 }, seconds: 6.4, pin: 300,
  // Neighbours only, so the pointer never crosses a row it isn't hovering.
  pointer: [
    [0, 0.4, 'rest', 'rest'],
    [0.4, 1.0, 'rest', 'text:Round'], [1.0, 1.6, 'text:Round', 'text:Round'],
    [1.6, 1.95, 'text:Round', 'text:Rectangular'], [1.95, 2.55, 'text:Rectangular', 'text:Rectangular'],
    [2.55, 2.9, 'text:Rectangular', 'text:Custom'], [2.9, 3.5, 'text:Custom', 'text:Custom'],
    [3.5, 3.85, 'text:Custom', 'text:Hardware'], [3.85, 4.45, 'text:Hardware', 'text:Hardware'],
    [4.45, 5.05, 'text:Hardware', 'text:Product Details'], [5.05, 5.5, 'text:Product Details', 'text:Product Details'],
    [5.5, 6.2, 'text:Product Details', 'rest'], [6.2, 6.4, 'rest', 'rest'],
  ],
};

(async () => {
  const dir = path.join(OUT, shot.name);
  fs.rmSync(dir, { recursive: true, force: true }); fs.mkdirSync(dir, { recursive: true });
  const browser = await puppeteer.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: 'new', args: ['--hide-scrollbars', '--force-device-scale-factor=2'] });
  const page = await browser.newPage();
  await page.setViewport(shot.viewport);
  await page.goto(shot.url, { waitUntil: 'networkidle2', timeout: 90000 });
  await page.addStyleTag({ content: 'html { scroll-behavior: auto !important; } .grecaptcha-badge { visibility: hidden !important; }' });
  await page.mouse.move(1100, 800); await page.mouse.move(1110, 790);
  await new Promise(r => setTimeout(r, 3000));
  const height = await page.evaluate(() => document.documentElement.scrollHeight);
  for (let y = 0; y < height; y += 500) { await page.evaluate(y => scrollTo(0, y), y); await new Promise(r => setTimeout(r, 120)); }
  await page.evaluate(y => scrollTo(0, y), shot.pin);
  await new Promise(r => setTimeout(r, 1200));
  // Warm every photo the rows can show, so none loads mid-shot.
  for (const text of ['Round', 'Rectangular', 'Custom', 'Hardware']) {
    const p = await page.evaluate(text => { const n = [...document.querySelectorAll('body *')].find(n => !n.children.length && n.textContent.trim().toLowerCase() === text.toLowerCase()); const r = n.getBoundingClientRect(); return { x: r.x + r.width * 0.32, y: r.y + r.height / 2 }; }, text);
    await page.mouse.move(p.x, p.y); await new Promise(r => setTimeout(r, 900));
  }
  const { width, height: vh } = shot.viewport;
  // Left of the grid, under the heading: the way to Round crosses no other row.
  const rest = { x: width * 0.24, y: vh * 0.56 };
  await page.mouse.move(rest.x, rest.y); await new Promise(r => setTimeout(r, 1500));

  const points = { rest };
  for (const move of shot.pointer) for (const target of [move[2], move[3]]) {
    if (points[target]) continue;
    const text = target.split(':')[1];
    points[target] = await page.evaluate(text => { const n = [...document.querySelectorAll('body *')].find(n => !n.children.length && n.textContent.trim().toLowerCase() === text.toLowerCase() && n.getBoundingClientRect().width > 0); const r = n.getBoundingClientRect(); return { x: r.x + r.width * 0.32, y: r.y + r.height / 2 }; }, text);
  }
  const at = t => {
    const [s0, e0, from, to] = shot.pointer.find(([a, b]) => t >= a && t < b) || shot.pointer.at(-1);
    const k = sine(clamp((t - s0) / (e0 - s0), 0, 1)), a = points[from], b = points[to];
    return { x: a.x + (b.x - a.x) * k, y: a.y + (b.y - a.y) * k - Math.sin(Math.PI * k) * (from === to ? 0 : 18) };
  };

  const client = await page.createCDPSession();
  const frames = [];
  client.on('Page.screencastFrame', ({ data, metadata, sessionId }) => {
    frames.push({ data, time: metadata.timestamp });
    client.send('Page.screencastFrameAck', { sessionId }).catch(() => {});
  });
  await client.send('Page.startScreencast', { format: 'jpeg', quality: 92, maxWidth: width * 2, maxHeight: vh * 2, everyNthFrame: 1 });
  await new Promise(r => setTimeout(r, 400));
  const start = Date.now() / 1000;
  while (true) {
    const t = Date.now() / 1000 - start;
    if (t > shot.seconds + 0.1) break;
    const p = at(t);
    await page.mouse.move(p.x, p.y);
    await new Promise(r => setTimeout(r, 6));
  }
  await new Promise(r => setTimeout(r, 300));
  await client.send('Page.stopScreencast');

  // Resample: each output frame takes the latest screencast frame at its time.
  const log = [];
  const total = Math.round(shot.seconds * FPS);
  for (let i = 0; i < total; i++) {
    const t = start + i / FPS;
    let pick = frames[0];
    for (const f of frames) { if (f.time <= t) pick = f; else break; }
    fs.writeFileSync(path.join(dir, `${String(i + 1).padStart(4, '0')}-0.jpg`), Buffer.from(pick.data, 'base64'));
    log.push(at(i / FPS));
  }
  fs.writeFileSync(path.join(dir, 'pointer.json'), JSON.stringify(log));
  const span = frames.at(-1).time - frames[0].time;
  console.log(`${shot.name}: ${frames.length} screencast frames over ${span.toFixed(1)}s (${(frames.length / span).toFixed(1)}fps) -> ${total}`);
  await browser.close();
})();
