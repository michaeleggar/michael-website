// A tiny blurred preview of each artwork, keyed by slug, shown while its image loads.
const path = require("node:path");
const sharp = require("sharp");
const art = require("./art.json");

module.exports = async () => {
  const entries = await Promise.all(art.map(async (artwork) => {
    const file = path.join(__dirname, "../..", `${artwork.image}-small.webp`);
    const preview = await sharp(file).resize({ width: 16 }).webp({ quality: 50 }).toBuffer();
    return [artwork.image.split("/").pop(), `data:image/webp;base64,${preview.toString("base64")}`];
  }));
  return Object.fromEntries(entries);
};
