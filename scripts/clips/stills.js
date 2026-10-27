// 2x captures of single sections of the live site, for detail stills.
const fs = require('fs');
const path = require('path');
const { puppeteer, CHROME, DESKTOP, open } = require('./lib');
const OUT = path.join(__dirname, 'stills');
const wanted = process.argv[2] === 'redo' ? {
  'https://okcinnovation.com/': ['calls the Innovation District home'],
  'https://www.kochcomm.com/': ['built to help you grow', 'Questions you'],
} : {
  'https://goldenmesa.com/': ['between games', 'Explore'],
  'https://okcinnovation.com/': ['Meet the organization behind', 'OKCID Events'],
  'https://www.kochcomm.com/': ['What our clients say', 'adapts to you'],
  'https://theretirementpath.com/': ['Focused on', 'Let us be your'],
};
(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const browser = await puppeteer.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: 'new', args: ['--hide-scrollbars'], defaultViewport: { width: 1512, height: 926, deviceScaleFactor: 2 } });
  for (const [url, texts] of Object.entries(wanted)) {
    const page = await open(browser, url, DESKTOP);
    for (const text of texts) {
      // The outermost content section (below the header) that holds the text.
      const box = await page.evaluate(text => {
        const tops = [...document.querySelectorAll('.e-con.e-parent')].filter(el => !el.closest('header, footer, .elementor-location-header, .elementor-location-footer'));
        const hit = tops.filter(el => el.textContent.toLowerCase().includes(text.toLowerCase())).sort((a, b) => a.textContent.length - b.textContent.length)[0];
        if (!hit) return null;
        const r = hit.getBoundingClientRect();
        return { x: r.x, y: r.y + scrollY, width: r.width, height: r.height };
      }, text);
      if (!box) { console.log('missing', text); continue; }
      const name = new URL(url).hostname.split('.').slice(-2, -1)[0] + '-' + text.toLowerCase().replace(/[^a-z]+/g, '-').replace(/^-|-$/g, '');
      await page.evaluate(y => scrollTo(0, y), Math.max(0, box.y - 200)); await new Promise(r => setTimeout(r, 600));
      await page.screenshot({ path: path.join(OUT, `${name}.png`), clip: box, captureBeyondViewport: true });
      console.log(name, Math.round(box.width) + 'x' + Math.round(box.height));
    }
    await page.close();
  }
  await browser.close();
})();
