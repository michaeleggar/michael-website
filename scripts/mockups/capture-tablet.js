// Captures the top of a page for the tablet mockup: 1280 wide (the desktop
// navigation), a short window so the hero leaves room below it, at 2x, with
// background videos held on one frame.
// node capture-tablet.js <url> <out.png> [video time in seconds]
const { puppeteer, CHROME, open } = require('../clips/lib');

(async () => {
  const [url, out, time = '0.5'] = process.argv.slice(2);
  const browser = await puppeteer.launch({ executablePath: CHROME, headless: 'new', args: ['--hide-scrollbars'] });
  const page = await open(browser, url, { width: 1280, height: 1080, deviceScaleFactor: 2 });
  await page.evaluate(async t => {
    for (const video of document.querySelectorAll('video')) { video.pause(); video.currentTime = t; }
    await new Promise(r => setTimeout(r, 2500));
  }, Number(time));
  await page.screenshot({ path: out, clip: { x: 0, y: 0, width: 1280, height: 1600 }, captureBeyondViewport: true });
  await browser.close();
})();
