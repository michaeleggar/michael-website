"use strict";

// Prepares a project's pictures from its full-page captures:
//   node scripts/project-images.js <project> <desktop.png> <mobile.png> [--crops=top1,top2,...] [--sections-only] [--name=<section file prefix>]
//
// Writes, under assets/images/optimized/<project>/:
//   <project>-page-desktop.webp (1440px wide) and <project>-page-mobile.webp (600px wide)
//     for the live site showcase;
//   <project>-mockup-{thumb,large}.webp and -social.jpg, a framed desktop window
//     and phone set on the site's surface, for the card and hero;
//   <project>-section-<n>-{thumb,large}.webp, 1440×800 crops of the desktop
//     capture at each --crops offset, for galleries.
// Prints the frontmatter values for each.

const fs = require("node:fs/promises");
const path = require("node:path");
const sharp = require("sharp");

const [project, desktopSource, mobileSource, ...flags] = process.argv.slice(2);
if (!project || !desktopSource || !mobileSource) {
  throw new Error("Usage: node scripts/project-images.js <project> <desktop.png> <mobile.png> [--crops=y,y,...]");
}
const sectionsOnly = flags.includes("--sections-only");
const sectionName = flags.find((flag) => flag.startsWith("--name="))?.slice(7) || `${project}-section`;
const crops = (flags.find((flag) => flag.startsWith("--crops="))?.slice(8) || "").split(",").filter(Boolean).map(Number);
const outDir = path.join(__dirname, "../assets/images/optimized", project);
const publicBase = `/assets/images/optimized/${project}`;

const rounded = (width, height, radius) =>
  Buffer.from(`<svg width="${width}" height="${height}"><rect width="${width}" height="${height}" rx="${radius}" ry="${radius}" fill="#fff"/></svg>`);

async function framed(source, width, height, radius) {
  const meta = await sharp(source).metadata();
  const cropHeight = Math.min(meta.height, Math.round((height * meta.width) / width));
  const screen = await sharp(source).extract({ left: 0, top: 0, width: meta.width, height: cropHeight }).resize(width, height).png().toBuffer();
  return sharp(screen).composite([{ input: rounded(width, height, radius), blend: "dest-in" }]).png().toBuffer();
}

async function shadow(width, height, radius, blur, opacity) {
  const pad = blur * 3;
  const svg = Buffer.from(`<svg width="${width + pad * 2}" height="${height + pad * 2}"><rect x="${pad}" y="${pad}" width="${width}" height="${height}" rx="${radius}" fill="rgba(0,0,0,${opacity})"/></svg>`);
  return { input: await sharp(svg).blur(blur).png().toBuffer(), pad };
}

async function mockup() {
  const W = 1600, H = 1000;
  // The site's own surface, lit a little from the top left.
  const background = Buffer.from(`<svg width="${W}" height="${H}"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#3b3e3a"/><stop offset="1" stop-color="#242623"/></linearGradient></defs><rect width="${W}" height="${H}" fill="url(#g)"/></svg>`);

  const win = { x: 70, y: 96, w: 1180, h: 790, r: 16, bar: 40 };
  const phone = { x: 1240, y: 250, w: 296, h: 640, r: 44, bezel: 10 };

  const winShadow = await shadow(win.w, win.h, win.r, 28, 0.55);
  const phoneShadow = await shadow(phone.w, phone.h, phone.r, 22, 0.6);
  const chrome = Buffer.from(`<svg width="${win.w}" height="${win.h}"><rect width="${win.w}" height="${win.h}" rx="${win.r}" fill="#2c2e2b"/><rect width="${win.w}" height="${win.h}" rx="${win.r}" fill="none" stroke="rgba(255,255,255,0.08)"/><circle cx="24" cy="20" r="5.5" fill="rgba(255,255,255,0.18)"/><circle cx="42" cy="20" r="5.5" fill="rgba(255,255,255,0.18)"/><circle cx="60" cy="20" r="5.5" fill="rgba(255,255,255,0.18)"/></svg>`);
  const desktopScreen = await framed(desktopSource, win.w - 12, win.h - win.bar - 6, 8);
  const phoneShell = Buffer.from(`<svg width="${phone.w}" height="${phone.h}"><rect width="${phone.w}" height="${phone.h}" rx="${phone.r}" fill="#1c1d1b"/><rect width="${phone.w}" height="${phone.h}" rx="${phone.r}" fill="none" stroke="rgba(255,255,255,0.1)"/></svg>`);
  const phoneScreen = await framed(mobileSource, phone.w - phone.bezel * 2, phone.h - phone.bezel * 2, phone.r - phone.bezel);

  return sharp(background).composite([
    { input: winShadow.input, left: win.x - winShadow.pad, top: win.y + 18 - winShadow.pad },
    { input: chrome, left: win.x, top: win.y },
    { input: desktopScreen, left: win.x + 6, top: win.y + win.bar },
    { input: phoneShadow.input, left: phone.x - phoneShadow.pad, top: phone.y + 16 - phoneShadow.pad },
    { input: phoneShell, left: phone.x, top: phone.y },
    { input: phoneScreen, left: phone.x + phone.bezel, top: phone.y + phone.bezel },
  ]).png().toBuffer();
}

async function writeSet(buffer, name, { social = false } = {}) {
  const out = path.join(outDir, name);
  const thumb = await sharp(buffer).resize({ width: 600, withoutEnlargement: true }).webp({ quality: 80 }).toFile(`${out}-thumb.webp`);
  const large = await sharp(buffer).resize({ width: 1600, withoutEnlargement: true }).webp({ quality: 80 }).toFile(`${out}-large.webp`);
  if (social) await sharp(buffer).resize({ width: 1200, withoutEnlargement: true }).flatten({ background: "#ffffff" }).jpeg({ quality: 82, progressive: true }).toFile(`${out}-social.jpg`);
  return { image: `${publicBase}/${name}`, thumbnailWidth: thumb.width, width: large.width, height: large.height };
}

(async () => {
  await fs.mkdir(outDir, { recursive: true });
  const result = { sections: [] };
  if (!sectionsOnly) {
  const desktop = await sharp(desktopSource).resize({ width: 1440, withoutEnlargement: true }).webp({ quality: 78 }).toFile(path.join(outDir, `${project}-page-desktop.webp`));
  const mobile = await sharp(mobileSource).resize({ width: 600, withoutEnlargement: true }).webp({ quality: 78 }).toFile(path.join(outDir, `${project}-page-mobile.webp`));
  result.siteShowcase = {
    desktop: { image: `${publicBase}/${project}-page-desktop.webp`, width: desktop.width, height: desktop.height },
    mobile: { image: `${publicBase}/${project}-page-mobile.webp`, width: mobile.width, height: mobile.height },
  };
  result.mockup = await writeSet(await mockup(), `${project}-mockup`, { social: true });
  }
  const meta = await sharp(desktopSource).metadata();
  for (const [index, top] of crops.entries()) {
    const height = Math.min(800, meta.height - top);
    const crop = await sharp(desktopSource).extract({ left: 0, top, width: meta.width, height }).png().toBuffer();
    result.sections.push(await writeSet(crop, `${sectionName}-${index + 1}`));
  }
  console.log(JSON.stringify(result, null, 2));
})().catch((error) => { console.error(error); process.exitCode = 1; });
