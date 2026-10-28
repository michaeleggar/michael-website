// Captures a page's first screen for a device mockup, at 2x, with background
// videos held on one frame.
// node capture.js <url> <out.png> <width> <height> [video time in seconds]
const { puppeteer, CHROME, open } = require('../clips/lib');

(async () => {
  const [url, out, width, height, time = '0.5'] = process.argv.slice(2);
  const browser = await puppeteer.launch({ executablePath: CHROME, headless: 'new', args: ['--hide-scrollbars'] });
  const page = await open(browser, url, { width: Number(width), height: Number(height), deviceScaleFactor: 2 });
  await page.evaluate(async t => {
    for (const video of document.querySelectorAll('video')) { video.pause(); video.currentTime = t; }
    await new Promise(r => setTimeout(r, 2500));
  }, Number(time));
  await page.screenshot({ path: out });
  await browser.close();
})();
