// Puts three rendered phone screens into the three-phone studio photograph.
// node phones.js <out.jpg> a.png b.png c.png
const sharp = require('/Users/chadeggar/Projects/michael-website/node_modules/sharp');
const PHOTO = '/Users/chadeggar/Projects/michael-website/assets/images/kochcomm/kc-website-2.jpg';
// Each phone's screen, inside the bezel, in the photograph's pixels.
const SCREENS = [198, 612, 1022].map(x => ({ x, y: 176, w: 279, h: 604 }));
const R = 44; // the display's corner radius at this size
(async () => {
  const [out, ...files] = process.argv.slice(2);
  const S = 4; // draw the rounded mask large, then shrink, for clean edges
  const layers = [];
  for (const [i, f] of files.entries()) {
    const { x, y, w, h } = SCREENS[i];
    const mask = await sharp(Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${w * S}" height="${h * S}"><rect width="${w * S}" height="${h * S}" rx="${R * S}" fill="#fff"/></svg>`)).resize(w, h).png().toBuffer();
    const flat = await sharp(f).resize(w, h, { fit: 'fill', kernel: 'lanczos3' }).ensureAlpha().png().toBuffer();
    const screen = await sharp(flat).composite([{ input: mask, blend: 'dest-in' }]).png().toBuffer();
    layers.push({ input: screen, left: x, top: y });
  }
  await sharp(PHOTO).composite(layers).jpeg({ quality: 94 }).toFile(out);
})();
