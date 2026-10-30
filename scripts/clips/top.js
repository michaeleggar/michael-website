// node top.js <url> <out.png>: the first screen of a page at 2x, header in place.
const { puppeteer, CHROME, DESKTOP, open } = require('./lib');
(async () => {
  const [url, out] = process.argv.slice(2);
  const b = await puppeteer.launch({ executablePath: CHROME, headless: 'new', args: ['--hide-scrollbars'] });
  const page = await open(b, url, DESKTOP); await page.mouse.move(2, 900); await new Promise(r => setTimeout(r, 800));
  await page.screenshot({ path: out }); await b.close();
})();
