// Puts a page capture onto the tablet in the living-room photograph, in its
// perspective. The screen's top and side edges are fitted to the bezel; its
// foreshortening comes from a line across the original screen (the top of a
// navy band, 512px down a 1180px-wide page) whose position on that page is known.
// node tablet.js <capture.png> <out.jpg>
const sharp = require('/Users/chadeggar/Projects/michael-website/node_modules/sharp');
const { solve, apply } = require('./homog');

const PHOTO = '/Users/chadeggar/Projects/michael-website/assets/images/ria/ria-tablet.jpg';
const W = 1180, BAND = 512;
const TL = [705.8, 73.4], TR = [1284, 179.4], BL = [664.2, 387.5], BR = [1236.2, 504];
const RADIUS = 26; // the display's corner radius, in page units
const SS = 4; // samples per pixel, per axis

(async () => {
  const [capture, out] = process.argv.slice(2);
  const photo = await sharp(PHOTO).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const src = await sharp(capture).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const PW = photo.info.width, PH = photo.info.height, SW = src.info.width, SH = src.info.height;
  const k = SW / W; // capture pixels per page unit (the capture is scaled to the fitted width)
  const toPage = solve([TL, TR, BL, BR], [[0, 0], [W, 0], [0, BAND], [W, BAND]]);
  const inside = (u, v) => {
    if (u < 0 || u > W || v < 0) return false;
    // Rounded top corners.
    if (v < RADIUS) {
      const cx = u < RADIUS ? RADIUS : u > W - RADIUS ? W - RADIUS : null;
      if (cx !== null && Math.hypot(u - cx, v - RADIUS) > RADIUS) return false;
    }
    return true;
  };
  const sample = (x, y, c) => {
    x = Math.min(SW - 1.001, Math.max(0, x)); y = Math.min(SH - 1.001, Math.max(0, y));
    const x0 = Math.floor(x), y0 = Math.floor(y), fx = x - x0, fy = y - y0;
    const i = (yy, xx) => src.data[(yy * SW + xx) * 3 + c];
    return (i(y0, x0) * (1 - fx) + i(y0, x0 + 1) * fx) * (1 - fy) + (i(y0 + 1, x0) * (1 - fx) + i(y0 + 1, x0 + 1) * fx) * fy;
  };
  const data = Buffer.from(photo.data);
  for (let py = 50; py < PH; py++) {
    for (let px = 540; px < 1320; px++) {
      let n = 0, r = 0, g = 0, b = 0;
      for (let sy = 0; sy < SS; sy++) for (let sx = 0; sx < SS; sx++) {
        const [u, v] = apply(toPage, [px + (sx + 0.5) / SS, py + (sy + 0.5) / SS]);
        if (!inside(u, v) || v * k > SH - 1) continue;
        n++; r += sample(u * k, v * k, 0); g += sample(u * k, v * k, 1); b += sample(u * k, v * k, 2);
      }
      if (!n) continue;
      const a = n / (SS * SS), o = (py * PW + px) * 3;
      data[o] = data[o] * (1 - a) + (r / n) * a;
      data[o + 1] = data[o + 1] * (1 - a) + (g / n) * a;
      data[o + 2] = data[o + 2] * (1 - a) + (b / n) * a;
    }
  }
  await sharp(data, { raw: { width: PW, height: PH, channels: 3 } }).jpeg({ quality: 94 }).toFile(out);
})();
