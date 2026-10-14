// A tiny blurred preview of every optimized image, keyed by its base path
// (for example /assets/images/optimized/artwork/hey), shown while the image loads.
const fs = require("node:fs");
const path = require("node:path");
const sharp = require("sharp");

const root = path.join(__dirname, "../..");
const optimized = path.join(root, "assets/images/optimized");

module.exports = async () => {
  const bases = fs.readdirSync(optimized, { recursive: true })
    .filter((file) => file.endsWith("-thumb.webp"))
    .map((file) => file.slice(0, -"-thumb.webp".length));
  const entries = await Promise.all(bases.map(async (base) => {
    const small = path.join(optimized, `${base}-small.webp`);
    const source = fs.existsSync(small) ? small : path.join(optimized, `${base}-thumb.webp`);
    const preview = await sharp(source).resize({ width: 16 }).webp({ quality: 50 }).toBuffer();
    return [`/assets/images/optimized/${base.split(path.sep).join("/")}`, `data:image/webp;base64,${preview.toString("base64")}`];
  }));
  return Object.fromEntries(entries);
};
