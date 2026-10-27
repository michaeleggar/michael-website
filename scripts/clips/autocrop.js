// Measures a detail shot's content: within a search region (CSS px), the
// bounds of everything that differs from the section's background, across
// the whole clip. Prints the bounds and a crop with equal padding all round,
// and says where that padding would leave the region.
// Usage: node autocrop.js <shot> x,y,w,h [pad]
const fs = require('fs');
const path = require('path');
const sharp = require('/Users/chadeggar/Projects/michael-website/node_modules/sharp');

(async () => {
  const [shot, regionArg, padArg = '56'] = process.argv.slice(2);
  const dir = path.join(__dirname, 'frames', shot);
  const files = fs.readdirSync(dir).filter(f => f.endsWith('-0.jpg')).sort();
  const meta = await sharp(path.join(dir, files[0])).metadata();
  const scale = meta.width / 1512;
  const [rx, ry, rw, rh] = regionArg.split(',').map(Number).map(v => Math.round(v * scale));
  const pad = +padArg;
  let minX = Infinity, minY = Infinity, maxX = -1, maxY = -1, bg;
  for (let i = 0; i < files.length; i += 6) {
    const { data, info } = await sharp(path.join(dir, files[i])).extract({ left: rx, top: ry, width: rw, height: rh }).raw().toBuffer({ resolveWithObject: true });
    const c = info.channels, at = (x, y) => (y * rw + x) * c;
    if (!bg) {
      // The background: the commonest colour along the region's edges.
      const counts = new Map();
      const add = (x, y) => { const k = [0, 1, 2].map(j => data[at(x, y) + j] >> 3).join(','); counts.set(k, (counts.get(k) || 0) + 1); };
      for (let x = 0; x < rw; x += 2) { add(x, 0); add(x, rh - 1); }
      for (let y = 0; y < rh; y += 2) { add(0, y); add(rw - 1, y); }
      bg = [...counts.entries()].sort((a, b) => b[1] - a[1])[0][0].split(',').map(v => (+v << 3) + 4);
    }
    for (let y = 0; y < rh; y += 2) for (let x = 0; x < rw; x += 2) {
      const k = at(x, y);
      if (Math.abs(data[k] - bg[0]) + Math.abs(data[k + 1] - bg[1]) + Math.abs(data[k + 2] - bg[2]) > 40) {
        if (x < minX) minX = x; if (x > maxX) maxX = x; if (y < minY) minY = y; if (y > maxY) maxY = y;
      }
    }
  }
  const css = v => Math.round(v / scale);
  const box = [css(rx + minX), css(ry + minY), css(rx + maxX), css(ry + maxY)];
  const crop = [box[0] - pad, box[1] - pad, box[2] - box[0] + 2 * pad, box[3] - box[1] + 2 * pad];
  const region = regionArg.split(',').map(Number);
  const out = [];
  if (crop[0] < region[0]) out.push('left'); if (crop[1] < region[1]) out.push('top');
  if (crop[0] + crop[2] > region[0] + region[2]) out.push('right'); if (crop[1] + crop[3] > region[1] + region[3]) out.push('bottom');
  console.log(`${shot}: bg rgb(${bg}) content ${box.join(',')} (x0,y0,x1,y1) -> crop ${crop.join(',')}${out.length ? '  beyond region: ' + out.join(' ') : ''}`);
})();
