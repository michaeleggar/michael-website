// QA for scroll recordings. For each hold (the scroll standing still) it
// measures how much of the frame changes, frame to frame, and how often: a
// real pill switch or video cut is a short burst every few seconds; a timer
// running against the slowed page shows as change in nearly every frame.
// Also writes a contact sheet, a frame every half second.
// node qa.js <shots file> <shot name> <max scroll> [timing override json]
const fs = require('fs');
const path = require('path');
const sharp = require('/Users/chadeggar/Projects/michael-website/node_modules/sharp');
const { stopsTrack } = require('./lib');
(async () => {
  const [file, name, max, override] = process.argv.slice(2);
  const cfg = require(path.resolve(file)), shot = cfg.scroll.find(s => s.name === name);
  const track = stopsTrack(shot.stops, Number(max), override ? JSON.parse(override) : shot.timing);
  const id = `${cfg.site}-${name}`, dir = path.join(__dirname, 'frames', id);
  const files = fs.readdirSync(dir).filter(f => f.endsWith('-0.jpg')).sort();
  const small = await Promise.all(files.map(f => sharp(path.join(dir, f)).resize(120, 120, { fit: 'fill' }).greyscale().raw().toBuffer()));
  // Share of pixels that changed noticeably since the last frame.
  const changed = small.map((b, i) => { if (!i) return 0; let n = 0; for (let k = 0; k < b.length; k++) if (Math.abs(b[k] - small[i - 1][k]) > 12) n++; return n / b.length; });
  const holds = []; let cur = null;
  for (let i = 1; i < files.length; i++) {
    const still = track.at(i / 30) === track.at((i - 1) / 30) && track.at((i + 1) / 30) === track.at(i / 30);
    if (still) { if (!cur) holds.push(cur = { from: i, to: i, active: 0 }); cur.to = i; if (changed[i] > 0.004) cur.active++; } else cur = null;
  }
  const report = holds.filter(h => h.to - h.from > 10).map(h => `${(h.from / 30).toFixed(1)}-${(h.to / 30).toFixed(1)}s ${Math.round(100 * h.active / (h.to - h.from + 1))}%`);
  const tiles = [];
  for (let i = 0; i < files.length; i += 15) tiles.push(await sharp(path.join(dir, files[i])).resize({ width: id.includes('phone') ? 120 : 260 }).toBuffer());
  const m = await sharp(tiles[0]).metadata(), cols = id.includes('phone') ? 14 : 8;
  await sharp({ create: { width: cols * (m.width + 4), height: Math.ceil(tiles.length / cols) * (m.height + 4), channels: 3, background: '#f0f' } })
    .composite(tiles.map((t, i) => ({ input: t, left: (i % cols) * (m.width + 4), top: Math.floor(i / cols) * (m.height + 4) }))).jpeg({ quality: 70 }).toFile(path.join(__dirname, '..', 'qa', `${id}.jpg`));
  console.log(`${id} ${(files.length / 30).toFixed(1)}s  holds (share of frames with change): ${report.join(' | ')}`);
})();
