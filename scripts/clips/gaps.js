// Lists runs of plain background rows inside a column (CSS px), on a frame.
// Usage: node gaps.js <shot> <frame> x0 x1 y0 y1
const path = require('path');
const sharp = require('/Users/chadeggar/Projects/michael-website/node_modules/sharp');
(async () => {
  const [shot, frame, x0, x1, y0, y1] = process.argv.slice(2);
  const file = path.join(__dirname, 'frames', shot, `${String(frame).padStart(4, '0')}-0.jpg`);
  const meta = await sharp(file).metadata(); const s = meta.width / 1512;
  const L = Math.round(x0 * s), W = Math.round((x1 - x0) * s), T = Math.round(y0 * s), Hh = Math.round((y1 - y0) * s);
  const { data, info } = await sharp(file).extract({ left: L, top: T, width: W, height: Hh }).raw().toBuffer({ resolveWithObject: true });
  const c = info.channels, bg = [data[0], data[1], data[2]];
  const runs = []; let start = null;
  for (let y = 0; y < Hh; y++) {
    let plain = true;
    for (let x = 0; x < W; x += 3) { const k = (y * W + x) * c; if (Math.abs(data[k] - bg[0]) + Math.abs(data[k + 1] - bg[1]) + Math.abs(data[k + 2] - bg[2]) > 24) { plain = false; break; } }
    if (plain && start === null) start = y; if (!plain && start !== null) { runs.push([start, y]); start = null; }
  }
  if (start !== null) runs.push([start, Hh]);
  console.log(shot, runs.filter(([a, b]) => b - a > 6 * s).map(([a, b]) => `${Math.round(+y0 + a / s)}-${Math.round(+y0 + b / s)}`).join('  '));
})();
