// Renders iPhone screens of live pages: status bar, the page at a scroll
// position, Safari's bottom toolbar. node screens.js okcid
const fs = require('fs');
const path = require('path');
const { puppeteer, CHROME, open } = require('../clips/lib');

const sets = {
  okcid: [
    { name: 'okcid-1', url: 'https://okcinnovation.com/', y: 0, time: '9:41' },
    { name: 'okcid-2', url: 'https://okcinnovation.com/map-directory/', y: 395, time: '9:44', wait: 6000 },
    { name: 'okcid-3', url: 'https://okcinnovation.com/innovation-hall/', y: 0, time: '9:43' },
  ],
};

const icon = {
  back: '<path d="M15 5l-7 7 7 7" />',
  fwd: '<path d="M9 5l7 7-7 7" />',
  share: '<path d="M12 3v12M8 7l4-4 4 4" /><path d="M6 11v9h12v-9" />',
  book: '<path d="M3 5c3-1 6-1 9 1 3-2 6-2 9-1v14c-3-1-6-1-9 1-3-2-6-2-9-1z" /><path d="M12 6v14" />',
  tabs: '<rect x="7" y="7" width="13" height="13" rx="2.5" /><path d="M4 16V6.5A2.5 2.5 0 0 1 6.5 4H16" />',
  reload: '<path d="M19 12a7 7 0 1 1-2.05-4.95" /><path d="M19 4v4h-4" />',
  page: '<path d="M5 6h9M5 10h14M5 14h14M5 18h9" />',
};
const svg = (d, w = 24, extra = '') => `<svg width="${w}" height="${w}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" ${extra}>${icon[d]}</svg>`;

function screenHtml(shot, img, host, top) {
  return `<!doctype html><html><head><style>
  * { box-sizing: border-box; margin: 0; }
  body { width: 393px; height: 852px; overflow: hidden; font-family: system-ui, "Helvetica Neue", sans-serif; background: ${top}; position: relative; }
  .page { position: absolute; top: 54px; left: 0; width: 393px; }
  .status { position: absolute; inset: 0 0 auto 0; height: 54px; background: ${top}; color: #000; }
  .time { position: absolute; left: 51px; top: 18px; font-weight: 600; font-size: 17px; line-height: 22px; letter-spacing: -0.2px; }
  .island { position: absolute; left: 50%; top: 11px; width: 126px; height: 37px; margin-left: -63px; background: #000; border-radius: 20px; }
  .right { position: absolute; right: 30px; top: 21px; display: flex; gap: 6px; align-items: center; }
  .bar { position: absolute; left: 0; right: 0; bottom: 0; height: 128px; padding: 10px 14px 0;
    background: rgba(250,250,252,0.78); backdrop-filter: blur(22px) saturate(1.6); -webkit-backdrop-filter: blur(22px) saturate(1.6); border-top: 0.5px solid rgba(0,0,0,0.12); }
  .field { height: 44px; border-radius: 12px; background: rgba(118,118,128,0.12); display: flex; align-items: center; justify-content: space-between; padding: 0 13px; color: #000; }
  .field span { font-weight: 500; font-size: 17px; letter-spacing: -0.3px; }
  .tools { display: flex; justify-content: space-between; padding: 12px 10px 0; color: #0a84ff; }
  .tools .off { color: rgba(60,60,67,0.3); }
  .home { position: absolute; left: 50%; bottom: 8px; width: 139px; height: 5px; margin-left: -69.5px; border-radius: 3px; background: #000; }
  </style></head><body>
  <img class="page" src="${img}" />
  <div class="status"><div class="time">${shot.time}</div><div class="island"></div>
    <div class="right">
      <svg width="18" height="12" viewBox="0 0 18 12"><rect x="0" y="8" width="3" height="4" rx="1"/><rect x="5" y="5.5" width="3" height="6.5" rx="1"/><rect x="10" y="3" width="3" height="9" rx="1"/><rect x="15" y="0" width="3" height="12" rx="1"/></svg>
      <svg width="16" height="12" viewBox="0 0 16 12"><path d="M8 11.5l2.4-2.6a3.4 3.4 0 0 0-4.8 0z"/><path d="M3.6 6.9a6.2 6.2 0 0 1 8.8 0l1.5-1.6a8.4 8.4 0 0 0-11.8 0z"/><path d="M.6 3.7a10.5 10.5 0 0 1 14.8 0L16 3.1l-.1-.1A12.4 12.4 0 0 0 0 3.1z"/></svg>
      <svg width="27" height="13" viewBox="0 0 27 13"><rect x="0.5" y="0.5" width="23" height="12" rx="3.8" fill="none" stroke="#000" stroke-opacity="0.4"/><rect x="2" y="2" width="20" height="9" rx="2.5"/><path d="M25 4.5v4c.8-.3 1.4-1.1 1.4-2s-.6-1.7-1.4-2z" fill-opacity="0.45"/></svg>
    </div>
  </div>
  <div class="bar">
    <div class="field">${svg('page', 20)}<span>${host}</span>${svg('reload', 19)}</div>
    <div class="tools">${svg('back', 26)}<span class="off">${svg('fwd', 26)}</span>${svg('share', 25)}${svg('book', 25)}${svg('tabs', 25)}</div>
    <div class="home"></div>
  </div>
  </body></html>`;
}

(async () => {
  const set = sets[process.argv[2]];
  const browser = await puppeteer.launch({ executablePath: CHROME, headless: 'new', args: ['--hide-scrollbars'] });
  for (const shot of set) {
    const page = await open(browser, shot.url, { width: 393, height: 798, deviceScaleFactor: 3, isMobile: true, hasTouch: true });
    await page.evaluate(y => scrollTo(0, y), shot.y);
    await new Promise(r => setTimeout(r, shot.wait || 2000));
    const top = await page.evaluate(() => {
      // The status bar takes the colour at the very top of the page.
      const el = document.elementFromPoint(5, 2);
      for (let n = el; n; n = n.parentElement) { const c = getComputedStyle(n).backgroundColor; if (c && c !== 'rgba(0, 0, 0, 0)') return c; }
      return '#fff';
    });
    const img = path.join(__dirname, `${shot.name}-page.png`);
    await page.screenshot({ path: img, type: 'png' });
    await page.close();
    const comp = await browser.newPage();
    await comp.setViewport({ width: 393, height: 852, deviceScaleFactor: 3 });
    const html = path.join(__dirname, `${shot.name}.html`);
    fs.writeFileSync(html, screenHtml(shot, `${shot.name}-page.png`, new URL(shot.url).hostname.replace(/^www\./, ''), top));
    await comp.goto('file://' + html, { waitUntil: 'load' });
    await comp.screenshot({ path: path.join(__dirname, `${shot.name}.png`) });
    await comp.close();
    console.log(shot.name, top);
  }
  await browser.close();
})();
