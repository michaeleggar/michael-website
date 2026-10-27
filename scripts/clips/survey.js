// A quick real-time look at pages: each page's load and a steady scroll to the
// bottom, screencast and sampled into a contact sheet, to spot animations.
// Usage: node survey.js <name> <url> [<name> <url> ...]
const fs = require('fs');
const path = require('path');
const sharp = require('/Users/chadeggar/Projects/michael-website/node_modules/sharp');
const { puppeteer, CHROME, tidy } = require('./lib');

(async () => {
  const args = process.argv.slice(2);
  const browser = await puppeteer.launch({ executablePath: CHROME, headless: 'new', args: ['--hide-scrollbars'] });
  fs.mkdirSync(path.join(__dirname, 'survey'), { recursive: true });
  for (let i = 0; i < args.length; i += 2) {
    const [name, url] = [args[i], args[i + 1]];
    const page = await browser.newPage();
    await page.setViewport({ width: 1512, height: 926, deviceScaleFactor: 1 });
    const client = await page.createCDPSession();
    const frames = [];
    client.on('Page.screencastFrame', ({ data, metadata, sessionId }) => { frames.push({ data, time: metadata.timestamp }); client.send('Page.screencastFrameAck', { sessionId }).catch(() => {}); });
    await client.send('Page.startScreencast', { format: 'jpeg', quality: 60, maxWidth: 756, maxHeight: 463 });
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 90000 }).catch(() => {});
    await page.mouse.move(900, 600); await page.mouse.move(910, 590);
    await new Promise(r => setTimeout(r, 3500));
    await tidy(page);
    const height = await page.evaluate(() => document.documentElement.scrollHeight - innerHeight);
    const start = Date.now();
    for (let y = 0; y <= height; y = (Date.now() - start) * 0.5) { await page.evaluate(y => scrollTo(0, y), y); await new Promise(r => setTimeout(r, 16)); }
    await new Promise(r => setTimeout(r, 1000));
    await client.send('Page.stopScreencast');
    // Sample every 300ms into a grid.
    const t0 = frames[0].time, picks = [];
    for (let t = t0; t <= frames.at(-1).time; t += 0.3) picks.push(frames.filter(f => f.time <= t).at(-1));
    const tiles = await Promise.all(picks.map(f => sharp(Buffer.from(f.data, 'base64')).resize(300).toBuffer()));
    const h = (await sharp(tiles[0]).metadata()).height;
    const cols = 6, rows = Math.ceil(tiles.length / cols);
    await sharp({ create: { width: cols * 304, height: rows * (h + 4), channels: 3, background: '#000' } })
      .composite(tiles.map((t, k) => ({ input: t, left: (k % cols) * 304, top: Math.floor(k / cols) * (h + 4) })))
      .jpeg({ quality: 70 }).toFile(path.join(__dirname, 'survey', `${name}.jpg`));
    console.log(name, tiles.length, 'samples');
    await page.close();
  }
  await browser.close();
})();
