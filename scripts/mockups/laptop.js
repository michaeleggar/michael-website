// Puts a page capture onto the laptop in the café photograph (Unsplash,
// photo-1781614651982), in its perspective: the screen's four corners are
// fitted to the bezel, its top corners are rounded, and the photo's own notch
// is laid back over the top.
// node laptop.js <photo.jpg> <capture.png> <out.jpg>
const sharp = require('/Users/chadeggar/Projects/michael-website/node_modules/sharp');
const { solve, apply } = require('./homog');

// The screen's corners in the 3000 x 2000 photograph.
const TL = [673.6, 449.1], TR = [1866.9, 490.6], BL = [648.8, 1238.3], BR = [1860.6, 1255];
const NOTCH = { x0: 1180, x1: 1375, y0: 440, y1: 520 };
const SS = 4;

(async () => {
  const [photoPath, capture, out] = process.argv.slice(2);
  const photo = await sharp(photoPath).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const src = await sharp(capture).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const PW = photo.info.width, PH = photo.info.height, SW = src.info.width, SH = src.info.height;
  const RADIUS = SW * 0.009; // the display's rounded top corners
  const toSrc = solve([TL, TR, BL, BR], [[0, 0], [SW, 0], [0, SH], [SW, SH]]);
  const inside = (u, v) => {
    if (u < 0 || u > SW || v < 0 || v > SH) return false;
    if (v < RADIUS) { const cx = u < RADIUS ? RADIUS : u > SW - RADIUS ? SW - RADIUS : null; if (cx !== null && Math.hypot(u - cx, v - RADIUS) > RADIUS) return false; }
    return true;
  };
  const sample = (x, y, c) => {
    x = Math.min(SW - 1.001, Math.max(0, x)); y = Math.min(SH - 1.001, Math.max(0, y));
    const x0 = Math.floor(x), y0 = Math.floor(y), fx = x - x0, fy = y - y0, i = (yy, xx) => src.data[(yy * SW + xx) * 3 + c];
    return (i(y0, x0) * (1 - fx) + i(y0, x0 + 1) * fx) * (1 - fy) + (i(y0 + 1, x0) * (1 - fx) + i(y0 + 1, x0 + 1) * fx) * fy;
  };
  const data = Buffer.from(photo.data);
  const x0 = Math.floor(Math.min(TL[0], BL[0])) - 2, x1 = Math.ceil(Math.max(TR[0], BR[0])) + 2, y0 = Math.floor(Math.min(TL[1], TR[1])) - 2, y1 = Math.ceil(Math.max(BL[1], BR[1])) + 2;
  for (let py = y0; py < y1; py++) for (let px = x0; px < x1; px++) {
    const o = (py * PW + px) * 3;
    // The notch: keep the photo's own neutral black.
    if (px >= NOTCH.x0 && px <= NOTCH.x1 && py >= NOTCH.y0 && py <= NOTCH.y1) {
      const [r, g, b] = [photo.data[o], photo.data[o + 1], photo.data[o + 2]];
      if (Math.max(r, g, b) < 40) continue;
    }
    let n = 0, r = 0, g = 0, b = 0;
    for (let sy = 0; sy < SS; sy++) for (let sx = 0; sx < SS; sx++) {
      const [u, v] = apply(toSrc, [px + (sx + 0.5) / SS, py + (sy + 0.5) / SS]);
      if (!inside(u, v)) continue;
      n++; r += sample(u, v, 0); g += sample(u, v, 1); b += sample(u, v, 2);
    }
    if (!n) continue;
    const a = n / (SS * SS);
    data[o] = data[o] * (1 - a) + (r / n) * a; data[o + 1] = data[o + 1] * (1 - a) + (g / n) * a; data[o + 2] = data[o + 2] * (1 - a) + (b / n) * a;
  }
  await sharp(data, { raw: { width: PW, height: PH, channels: 3 } }).jpeg({ quality: 94 }).toFile(out);
})();
