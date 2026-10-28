// Turns recorded sub-frames into finished clip frames: blends each frame's
// sub-frames (motion blur), draws the pointer, crops to the clip's detail,
// and crossfades the last frames into the first so the loop has no seam.
// Usage: node clips.js [clip]  ->  clips/<name>/0001.png ...
const fs = require('fs');
const path = require('path');
const sharp = require('/Users/chadeggar/Projects/michael-website/node_modules/sharp');

const FR = path.join(__dirname, 'frames');
const OUT = path.join(__dirname, 'clips');

// Crops are in CSS pixels of the recorded viewport; out is the clip's pixel size.
const clips = {
  'full-home': { shot: 'full-home', crop: null, out: [1920, 1200], fade: 14 },
  nav: { shot: 'nav', crop: [740, 50, 720, 290], out: [1440, 580], fade: 6 },
  grid: { shot: 'grid-live', crop: [0, 110, 1512, 562], out: [2420, 900], fade: 6 },
  tabs: { shot: 'tabs', crop: [56, 120, 1400, 660], out: [2100, 990], fade: 6 },
  'phone-menu': { shot: 'phone-menu-loop', crop: null, out: [786, 1472], fade: 6 },
  'phone-home': { shot: 'phone-home', crop: null, out: [786, 1472], fade: 14 },
  'goldenmesa-full': { shot: 'goldenmesa-full', crop: null, out: [1600, 1000], fade: 14 },
  'goldenmesa-phone': { shot: 'goldenmesa-phone', crop: null, out: [524, 982], fade: 14, css: 393 },
  'okcid-full': { shot: 'okcid-full', crop: null, out: [1600, 1000], fade: 14 },
  'okcid-hall-page': { shot: 'okcid-hall-page', crop: null, out: [1920, 1200], fade: 14 },
  'okcid-phone': { shot: 'okcid-phone', crop: null, out: [524, 982], fade: 14, css: 393 },
  'kochcomm-full': { shot: 'kochcomm-full', crop: null, out: [1600, 1000], fade: 14 },
  'kochcomm-phone': { shot: 'kochcomm-phone', crop: null, out: [524, 982], fade: 14, css: 393 },
  'ria-full': { shot: 'ria-full', crop: null, out: [1600, 1000], fade: 14 },
  'ria-phone': { shot: 'ria-phone', crop: null, out: [524, 982], fade: 14, css: 393 },
  'goldenmesa-promos': { shot: 'goldenmesa-promos', crop: [0, 61, 1512, 806], out: [2268, 1210], fade: 6 },
  'goldenmesa-menu': { shot: 'goldenmesa-menu', crop: [0, 0, 1512, 926], out: [2268, 1388], fade: 6 },
  'okcid-audience': { shot: 'okcid-audience', crop: [50, 72, 1412, 806], out: [2118, 1208], fade: 6 },
  'okcid-hall': { shot: 'okcid-hall', crop: [0, 30, 1512, 840], out: [2268, 1260], fade: 6 },
  'kochcomm-services': { shot: 'kochcomm-services', crop: [0, 177, 1512, 572], out: [2268, 858], fade: 6 },
  'kochcomm-work': { shot: 'kochcomm-work', crop: [0, 221, 1512, 577], out: [2268, 866], fade: 6 },
  'ria-services': { shot: 'ria-services', crop: [0, 67, 1512, 727], out: [2268, 1090], fade: 6 },
  'ria-library': { shot: 'ria-library', crop: [0, 67, 1512, 821], out: [2268, 1232], fade: 6 },
  'okcid-map': { shot: 'okcid-map', crop: [0, 30, 1512, 955], out: [2268, 1432], fade: 6 },
  'okcid-directory': { shot: 'okcid-directory', crop: [50, 41, 1412, 1159], out: [2118, 1738], fade: 6 },
  'okcid-nav': { shot: 'okcid-nav', crop: [0, 0, 1512, 560], out: [2268, 840], fade: 6 },
  'ductworx-full-home': { shot: 'ductworx-full-home', crop: null, out: [1600, 1000], fade: 14 },
  'ductworx-phone-menu': { shot: 'phone-menu-loop', crop: null, out: [524, 982], fade: 6, css: 393 },
  'goldenmesa-phone-promos': { shot: 'goldenmesa-phone-promos', crop: null, out: [524, 982], fade: 14, css: 393 },
  'okcid-phone-hall': { shot: 'okcid-phone-hall', crop: null, out: [524, 982], fade: 14, css: 393 },
  'kochcomm-phone-work': { shot: 'kochcomm-phone-work', crop: null, out: [524, 982], fade: 14, css: 393 },
  'ria-phone-library': { shot: 'ria-phone-library', crop: null, out: [524, 982], fade: 14, css: 393 },
  'goldenmesa-rooms': { shot: 'goldenmesa-rooms', crop: [0, 60, 1512, 820], out: [2268, 1230], fade: 6 },
  'okcid-programs': { shot: 'okcid-programs', crop: [0, 18, 1512, 794], out: [2268, 1190], fade: 6 },
};

// A macOS-style arrow, drawn at 1 CSS px = 1 unit.
const ARROW = 'M1 1 L1 18.5 L5.3 14.6 L8.1 21 L11 19.8 L8.3 13.6 L14 13.6 Z';
function pointerSvg(scale) {
  const w = Math.ceil(17 * scale), h = Math.ceil(24 * scale);
  return Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 17 24"><path d="${ARROW}" fill="#000" stroke="#fff" stroke-width="1.4" stroke-linejoin="round"/></svg>`);
}

async function blend(files) {
  const bufs = await Promise.all(files.map(f => sharp(f).raw().toBuffer({ resolveWithObject: true })));
  const { width, height, channels } = bufs[0].info;
  const sum = new Uint16Array(bufs[0].data.length);
  for (const { data } of bufs) for (let i = 0; i < data.length; i++) sum[i] += data[i];
  const out = Buffer.alloc(sum.length);
  for (let i = 0; i < sum.length; i++) out[i] = Math.round(sum[i] / bufs.length);
  return sharp(out, { raw: { width, height, channels } });
}

async function make(name, clip) {
  const dir = path.join(FR, clip.shot);
  const dest = path.join(OUT, name);
  fs.rmSync(dest, { recursive: true, force: true }); fs.mkdirSync(dest, { recursive: true });
  const meta = JSON.parse(fs.readFileSync(path.join(dir, 'pointer.json'), 'utf8'));
  const frames = [...new Set(fs.readdirSync(dir).filter(f => f.endsWith('.jpg')).map(f => f.split('-')[0]))].sort();
  const first = await sharp(path.join(dir, frames[0] + '-0.jpg')).metadata();
  const scale = first.width / (clip.css || (await cssWidth(clip.shot)) || 1512);
  const pointer = await sharp(pointerSvg(scale)).png().toBuffer();
  const rendered = [];
  for (const [i, frame] of frames.entries()) {
    const subs = fs.readdirSync(dir).filter(f => f.startsWith(frame + '-')).sort().map(f => path.join(dir, f));
    let img = await blend(subs);
    const p = meta[i];
    if (p) img = sharp(await img.png().toBuffer()).composite([{ input: pointer, left: Math.round(p.x * scale - scale), top: Math.round(p.y * scale - scale) }]);
    let buf = await img.png().toBuffer();
    if (clip.crop) {
      const [x, y, w, h] = clip.crop.map(v => Math.round(v * scale));
      buf = await sharp(buf).extract({ left: x, top: y, width: w, height: h }).toBuffer();
    }
    buf = await sharp(buf).resize(clip.out[0], clip.out[1], { fit: 'fill', kernel: 'lanczos3' }).png().toBuffer();
    rendered.push(buf);
  }
  // Crossfade the tail into the opening frames, then start the clip after
  // them: the last frame leads straight into the first.
  const n = rendered.length, k = clip.fade;
  for (let j = 0; j < k; j++) {
    const head = await sharp(rendered[j]).ensureAlpha((j + 1) / (k + 1)).png().toBuffer();
    rendered[n - k + j] = await sharp(rendered[n - k + j]).composite([{ input: head }]).png().toBuffer();
  }
  const final = rendered.slice(k);
  for (const [i, buf] of final.entries()) fs.writeFileSync(path.join(dest, String(i + 1).padStart(4, '0') + '.png'), buf);
  console.log(name, final.length, 'frames');
}

async function cssWidth(shot) {
  return { 'full-home': 1512, nav: 1512, grid: 1512, 'grid-live': 1512, tabs: 1512, 'phone-menu-loop': 393, 'phone-home': 393 }[shot];
}

(async () => {
  const only = process.argv[2];
  for (const [name, clip] of Object.entries(clips)) if (!only || name === only) await make(name, clip);
})();
