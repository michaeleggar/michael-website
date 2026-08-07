"use strict";

const fs = require("node:fs");
const path = require("node:path");

const projectRoot = path.resolve(__dirname, "..");
const outputRoot = path.join(projectRoot, "dist");
const errors = [];
const seenTitles = new Map();
const seenCanonicals = new Map();

function walk(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const entryPath = path.join(directory, entry.name);
    return entry.isDirectory() ? walk(entryPath) : [entryPath];
  });
}

function getAttribute(html, pattern) {
  return html.match(pattern)?.[1]?.trim();
}

function resolveLocalTarget(value, htmlPath) {
  const htmlDecodedValue = value
    .replace(/&#(\d+);/g, (_, codePoint) => String.fromCodePoint(Number(codePoint)))
    .replace(/&#x([\da-f]+);/gi, (_, codePoint) =>
      String.fromCodePoint(Number.parseInt(codePoint, 16)),
    )
    .replaceAll("&amp;", "&");
  const cleanValue = htmlDecodedValue.split("#")[0].split("?")[0];
  if (!cleanValue || cleanValue.startsWith("#")) return null;
  if (/^(?:[a-z]+:)?\/\//i.test(cleanValue)) return null;
  if (/^(?:mailto|tel|data|javascript):/i.test(cleanValue)) return null;

  const decodedValue = decodeURIComponent(cleanValue);
  const target = decodedValue.startsWith("/")
    ? path.join(outputRoot, decodedValue)
    : path.resolve(path.dirname(htmlPath), decodedValue);

  if (fs.existsSync(target) && fs.statSync(target).isDirectory()) {
    return path.join(target, "index.html");
  }

  if (!path.extname(target) && fs.existsSync(`${target}.html`)) {
    return `${target}.html`;
  }

  if (!path.extname(target)) {
    return path.join(target, "index.html");
  }

  return target;
}

function checkReference(value, htmlPath) {
  const target = resolveLocalTarget(value, htmlPath);
  if (target && !fs.existsSync(target)) {
    errors.push(
      `${path.relative(projectRoot, htmlPath)} references missing ${value}`,
    );
  }
}

if (!fs.existsSync(outputRoot)) {
  throw new Error("dist does not exist; run the build before checking it");
}

const htmlFiles = walk(outputRoot).filter((file) => file.endsWith(".html"));

for (const htmlPath of htmlFiles) {
  const html = fs.readFileSync(htmlPath, "utf8");
  const relativePath = path.relative(projectRoot, htmlPath);

  if (/lorem ipsum/i.test(html)) {
    errors.push(`${relativePath} contains placeholder copy`);
  }

  const title = getAttribute(html, /<title>([^<]+)<\/title>/i);
  const description = getAttribute(
    html,
    /<meta\s+name="description"\s+content="([^"]+)"/i,
  );
  const canonical = getAttribute(
    html,
    /<link\s+rel="canonical"\s+href="([^"]+)"/i,
  );
  const socialImage = getAttribute(
    html,
    /<meta\s+property="og:image"\s+content="([^"]+)"/i,
  );

  if (!title) errors.push(`${relativePath} is missing a title`);
  if (!description) errors.push(`${relativePath} is missing a description`);
  if (!canonical) errors.push(`${relativePath} is missing a canonical URL`);
  if (!socialImage) errors.push(`${relativePath} is missing an Open Graph image`);

  if (title) {
    if (seenTitles.has(title)) {
      errors.push(
        `${relativePath} duplicates the title used by ${seenTitles.get(title)}`,
      );
    }
    seenTitles.set(title, relativePath);
  }

  if (canonical) {
    if (seenCanonicals.has(canonical)) {
      errors.push(
        `${relativePath} duplicates the canonical URL used by ${seenCanonicals.get(canonical)}`,
      );
    }
    seenCanonicals.set(canonical, relativePath);
  }

  for (const match of html.matchAll(/\b(?:href|src)="([^"]+)"/gi)) {
    checkReference(match[1], htmlPath);
  }

  for (const match of html.matchAll(/\bsrcset="([^"]+)"/gi)) {
    for (const candidate of match[1].split(",")) {
      checkReference(candidate.trim().split(/\s+/)[0], htmlPath);
    }
  }
}

if (errors.length > 0) {
  console.error(errors.map((error) => `- ${error}`).join("\n"));
  process.exitCode = 1;
} else {
  console.log(`Verified ${htmlFiles.length} HTML pages with no launch-blocking issues.`);
}
