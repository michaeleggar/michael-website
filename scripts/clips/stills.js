// 2x captures of single sections, for detail stills: the widest block holding
// the text that is still a section: full width, under 1300px tall.
// node stills.js <url> "text" ...
const fs = require('fs');
const path = require('path');
const { puppeteer, CHROME, DESKTOP, open } = require('./lib');
const OUT = path.join(__dirname, 'stills');
(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const args = process.argv.slice(2);
  const browser = await puppeteer.launch({ executablePath: CHROME, headless: 'new', args: ['--hide-scrollbars'] });
  const page = await open(browser, args[0], DESKTOP);
  for (const text of args.slice(1)) {
    const box = await page.evaluate(text => {
      const leaf = [...document.querySelectorAll('body *')].filter(n => n.textContent.toLowerCase().includes(text.toLowerCase()) && n.getBoundingClientRect().height > 0 && !n.closest('header, nav, [class*=menu]')).sort((a, b) => a.textContent.length - b.textContent.length)[0];
      if (!leaf) return null;
      let best = null;
      for (let n = leaf; n && n !== document.body; n = n.parentElement) {
        const r = n.getBoundingClientRect();
        if (r.width >= innerWidth - 2 && r.height < 1300) best = { x: r.x, y: r.y + scrollY, width: r.width, height: r.height };
      }
      return best;
    }, text);
    if (!box) { console.log('missing', text); continue; }
    const name = new URL(args[0]).hostname.split('.').slice(-2, -1)[0] + '-' + text.toLowerCase().replace(/[^a-z]+/g, '-').replace(/^-|-$/g, '');
    await page.evaluate(y => scrollTo(0, y), Math.max(0, box.y - 200)); await new Promise(r => setTimeout(r, 900));
    await page.screenshot({ path: path.join(OUT, `${name}.png`), clip: box, captureBeyondViewport: true });
    console.log(name, Math.round(box.width) + 'x' + Math.round(box.height));
  }
  await browser.close();
})();
