"use strict";

const sharp = require("sharp");
const fs = require("fs");
const path = require("path");

const ARTWORK_DIR = path.join(__dirname, "..", "images", "artwork");
const THUMBS_DIR = path.join(ARTWORK_DIR, "thumbs");
const JSON_PATH = path.join(__dirname, "..", "data", "art.json");

const THUMB_WIDTH = 600;
const JPEG_QUALITY = 80;
const SKIP = new Set(["Home-Art.jpg"]);

async function run() {
  if (!fs.existsSync(THUMBS_DIR)) {
    fs.mkdirSync(THUMBS_DIR, { recursive: true });
  }

  const files = fs
    .readdirSync(ARTWORK_DIR)
    .filter(
      (f) =>
        /\.jpe?g$/i.test(f) && !SKIP.has(f) && !fs.statSync(path.join(ARTWORK_DIR, f)).isDirectory()
    );

  console.log(`Found ${files.length} images to process.`);

  for (const file of files) {
    const src = path.join(ARTWORK_DIR, file);
    const dest = path.join(THUMBS_DIR, file);

    await sharp(src)
      .resize({ width: THUMB_WIDTH, withoutEnlargement: true })
      .jpeg({ quality: JPEG_QUALITY })
      .toFile(dest);

    const srcSize = fs.statSync(src).size;
    const destSize = fs.statSync(dest).size;
    const pct = ((1 - destSize / srcSize) * 100).toFixed(0);
    console.log(`  ${file}  ${(srcSize / 1024).toFixed(0)}K -> ${(destSize / 1024).toFixed(0)}K  (-${pct}%)`);
  }

  // Update artwork.json thumb paths
  const manifest = JSON.parse(fs.readFileSync(JSON_PATH, "utf8"));

  for (const item of manifest.artwork) {
    // Derive the filename from the existing src_large path
    const largePath = decodeURIComponent(item.src_large);
    const filename = path.basename(largePath);

    // Only update if a thumb was actually generated
    const thumbFile = path.join(THUMBS_DIR, filename);
    if (fs.existsSync(thumbFile)) {
      item.src_thumb =
        "/assets/images/artwork/thumbs/" + encodeURIComponent(filename).replace(/%20/g, "%20");
    }
  }

  fs.writeFileSync(JSON_PATH, JSON.stringify(manifest, null, 2) + "\n");
  console.log("\nUpdated art.json with thumbnail paths.");
  console.log("Done!");
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
