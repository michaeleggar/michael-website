// Contact sheet: node sheet.js <out.jpg> <dir>:<frame> ...
const sharp = require('/Users/chadeggar/Projects/michael-website/node_modules/sharp');
const path = require('path');
(async () => {
  const [out, ...picks] = process.argv.slice(2);
  const tiles = await Promise.all(picks.map(p => { const [d, f] = p.split(':'); return sharp(path.join(__dirname, 'frames', d, `${String(f).padStart(4, '0')}-0.jpg`)).resize(600).toBuffer(); }));
  const metas = await Promise.all(tiles.map(t => sharp(t).metadata()));
  const h = Math.max(...metas.map(m => m.height));
  const rows = Math.ceil(tiles.length / 2);
  await sharp({ create: { width: 1208, height: rows * (h + 8), channels: 3, background: '#000' } })
    .composite(tiles.map((t, i) => ({ input: t, left: (i % 2) * 608, top: Math.floor(i / 2) * (h + 8) }))).jpeg({ quality: 80 }).toFile(path.join(__dirname, out));
})();
