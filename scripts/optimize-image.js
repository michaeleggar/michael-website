"use strict";

const fs = require("node:fs/promises");
const path = require("node:path");
const sharp = require("sharp");

async function main() {
  const [source, name, ...flags] = process.argv.slice(2);
  if (
    !source || !name || !/^[a-z0-9][a-z0-9/_-]*$/.test(name) ||
    flags.some((flag) => flag !== "--social")
  ) {
    throw new Error(
      'Usage: npm run images -- "path/to/original.jpg" folder/image-name [--social]',
    );
  }

  const output = path.join(__dirname, "../assets/images/optimized", name);
  await fs.mkdir(path.dirname(output), { recursive: true });

  const thumbnail = await sharp(source)
    .rotate()
    .resize({ width: 600, withoutEnlargement: true })
    .webp({ quality: 80 })
    .toFile(`${output}-thumb.webp`);

  const large = await sharp(source)
    .rotate()
    .resize({ width: 1600, withoutEnlargement: true })
    .webp({ quality: 80 })
    .toFile(`${output}-large.webp`);

  const image = `/assets/images/optimized/${name}`;
  const metadata = {
    image,
    thumbnailWidth: thumbnail.width,
    width: large.width,
    height: large.height,
  };

  if (flags.includes("--social")) {
    await sharp(source)
      .rotate()
      .resize({ width: 1200, withoutEnlargement: true })
      .flatten({ background: "#ffffff" })
      .jpeg({ quality: 82, progressive: true })
      .toFile(`${output}-social.jpg`);
    metadata.socialImage = `${image}-social.jpg`;
  }

  // Copy these values into the artwork data or project frontmatter.
  console.log(JSON.stringify(metadata, null, 2));
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
