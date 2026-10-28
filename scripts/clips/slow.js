// Scroll shots (the full site and the phone) for one site's shot file. Each
// 30fps frame is SUB sub-frames across a 3/4 shutter, blended later into
// motion blur; the page's CSS animations and videos run `slow` times slower
// while each sub-frame is taken on schedule.
// Usage: node slow.js shots/<site>.js [shot]
const fs = require('fs');
const path = require('path');
const { puppeteer, CHROME, FULL, PHONE, stopsTrack, open } = require('./lib');

const FPS = 30, SUB = 4, SHUTTER = 0.75;
const cfg = require(path.resolve(process.argv[2]));
const only = process.argv[3];

(async () => {
  const browser = await puppeteer.launch({ executablePath: CHROME, headless: 'new', args: ['--hide-scrollbars'] });
  for (const shot of cfg.scroll) {
    if (only && shot.name !== only) continue;
    const slow = shot.slow || cfg.slow || 24;
    const viewport = shot.viewport === 'PHONE' ? PHONE : FULL;
    const dir = path.join(__dirname, 'frames', `${cfg.site}-${shot.name}`);
    fs.rmSync(dir, { recursive: true, force: true }); fs.mkdirSync(dir, { recursive: true });
    const page = await open(browser, shot.url || cfg.url, viewport, { css: cfg.css, slow });
    // open() moves the mouse onto the page to wake scripts that wait for a
    // visitor; it would sit there and light up whatever scrolls beneath it.
    // Nothing on the page takes the pointer while it scrolls.
    await page.addStyleTag({ content: 'html, html * { pointer-events: none !important; }' });
    await page.mouse.move(1, 1);
    // Stop short of the last pixels, where a fractional page height can show a sliver of the root background.
    const max = await page.evaluate(() => document.documentElement.scrollHeight - innerHeight - 2);
    const track = stopsTrack(shot.stops, max, shot.timing);
    const client = await page.createCDPSession();
    await client.send('Animation.enable');
    await client.send('Animation.setPlaybackRate', { playbackRate: 1 / slow });
    const frames = Math.round(track.seconds * FPS);
    const start = Date.now();
    let late = 0;
    for (let i = 0; i < frames; i++) {
      for (let s = 0; s < SUB; s++) {
        const t = (i + (s / SUB) * SHUTTER) / FPS;
        const wait = start + t * slow * 1000 - Date.now();
        if (wait > 0) await new Promise(r => setTimeout(r, wait)); else late++;
        const y = track.at(t);
        await page.evaluate(y => window.scrollTo(0, y), Math.round(y * viewport.deviceScaleFactor) / viewport.deviceScaleFactor);
        await page.screenshot({ path: path.join(dir, `${String(i + 1).padStart(4, '0')}-${s}.jpg`), type: 'jpeg', quality: 92, optimizeForSpeed: true });
      }
    }
    fs.writeFileSync(path.join(dir, 'pointer.json'), JSON.stringify(Array(frames).fill(null)));
    await page.close();
    console.log(`${cfg.site}-${shot.name}: ${frames} frames x ${SUB}, max scroll ${max}${late ? `, ${late} late` : ''}`);
  }
  await browser.close();
})();
