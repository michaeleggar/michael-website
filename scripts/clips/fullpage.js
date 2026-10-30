// node fullpage.js <url> <out.png> — a 2x full-page capture with the sticky header in place at the top, for hand-cropped stills.
const { puppeteer, CHROME, DESKTOP, open } = require('./lib');
(async () => {
  const [url, out] = process.argv.slice(2);
  const b = await puppeteer.launch({ executablePath: CHROME, headless: 'new', args: ['--hide-scrollbars'] });
  const page = await open(b, url, DESKTOP);
  await page.mouse.move(2, 2);
  await page.screenshot({ path: out, fullPage: true, captureBeyondViewport: true });
  console.log(out, await page.evaluate(() => document.documentElement.scrollHeight)); await b.close();
})();
