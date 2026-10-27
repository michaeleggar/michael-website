// Finds a detail shot's section edges: walking down a strip at the frame's
// left edge (outside the content column), the run of matching background
// around a reference row is the section. Checks every 12th frame, since
// content inside may change but the section's edges don't.
// Usage: node sections.js <shot> <ref y in CSS px>
const fs = require('fs');
const path = require('path');
const sharp = require('/Users/chadeggar/Projects/michael-website/node_modules/sharp');

(async () => {
  const [shot, refArg] = process.argv.slice(2);
  const dir = path.join(__dirname, 'frames', shot);
  const files = fs.readdirSync(dir).filter(f => f.endsWith('-0.jpg')).sort();
  const meta = await sharp(path.join(dir, files[0])).metadata();
  const scale = meta.width / 1512, H = meta.height;
  const strip = async f => {
    const { data, info } = await sharp(path.join(dir, f)).extract({ left: Math.round(14 * scale), top: 0, width: Math.round(16 * scale), height: H }).raw().toBuffer({ resolveWithObject: true });
    const rows = [];
    for (let y = 0; y < H; y++) {
      let r = 0, g = 0, b = 0;
      for (let x = 0; x < info.width; x++) { const k = (y * info.width + x) * info.channels; r += data[k]; g += data[k + 1]; b += data[k + 2]; }
      rows.push([r / info.width, g / info.width, b / info.width]);
    }
    return rows;
  };
  const ref = Math.round(+refArg * scale);
  let top = 0, bottom = H - 1;
  for (let i = 0; i < files.length; i += 12) {
    const rows = await strip(files[i]);
    const c = rows[ref], same = y => Math.abs(rows[y][0] - c[0]) + Math.abs(rows[y][1] - c[1]) + Math.abs(rows[y][2] - c[2]) < 18;
    let t = ref; while (t > 0 && same(t - 1)) t--;
    let b = ref; while (b < H - 1 && same(b + 1)) b++;
    top = Math.max(top, t); bottom = Math.min(bottom, b);
  }
  const css = v => Math.round(v / scale);
  console.log(`${shot}: section ${css(top)}..${css(bottom + 1)} of ${css(H)} (CSS px)`);
})();
