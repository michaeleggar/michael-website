const fs = require("fs");
const path = require("path");

const SRC = "src";
const DIST = "dist";
const PARTIALS = "assets/partials";
const ARTWORK_JSON = "assets/data/artwork.json";

function escAttr(str) {
  if (!str) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function buildGalleryHtml() {
  const data = JSON.parse(fs.readFileSync(ARTWORK_JSON, "utf-8"));
  const items = Array.isArray(data.artwork) ? data.artwork.slice() : [];

  items.sort((a, b) => {
    const ao = typeof a.order === "number" ? a.order : 0;
    const bo = typeof b.order === "number" ? b.order : 0;
    return ao - bo;
  });

  return items
    .map((art) => {
      const thumbSrc = art.src_thumb || art.src_large;
      const altText = art.alt || art.title || "";
      const ariaLabel = "View " + (art.title || "artwork");

      return [
        '<figure class="art-item">',
        '  <button type="button"',
        `    aria-label="${escAttr(ariaLabel)}"`,
        `    data-src-large="${escAttr(art.src_large)}"`,
        `    data-title="${escAttr(art.title)}"`,
        `    data-year="${escAttr(art.year)}"`,
        `    data-medium="${escAttr(art.medium)}"`,
        `    data-dimensions="${escAttr(art.dimensions_text)}">`,
        `    <img loading="lazy" src="${escAttr(thumbSrc)}" alt="${escAttr(altText)}" />`,
        "  </button>",
        "</figure>",
      ].join("\n");
    })
    .join("\n");
}

function loadPartials() {
  const partials = {};
  for (const file of fs
    .readdirSync(PARTIALS)
    .filter((f) => f.endsWith(".html"))) {
    partials[file] = fs.readFileSync(path.join(PARTIALS, file), "utf-8").trim();
  }
  return partials;
}

function copyDir(src, dest) {
  fs.mkdirSync(dest, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    entry.isDirectory()
      ? copyDir(srcPath, destPath)
      : fs.copyFileSync(srcPath, destPath);
  }
}

function findHtmlFiles(dir, baseDir = dir) {
  const results = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...findHtmlFiles(fullPath, baseDir));
    } else if (entry.name.endsWith(".html")) {
      results.push(path.relative(baseDir, fullPath));
    }
  }
  return results;
}

try {
  // Clean dist directory
  if (fs.existsSync(DIST)) fs.rmSync(DIST, { recursive: true });
  fs.mkdirSync(DIST);

  // Load partials
  const partials = loadPartials();
  console.log(`Partials: ${Object.keys(partials).join(", ")}`);

  // Process HTML files
  for (const file of findHtmlFiles(SRC)) {
    const srcPath = path.join(SRC, file);
    const destPath = path.join(DIST, file);
    fs.mkdirSync(path.dirname(destPath), { recursive: true });
    const html = fs.readFileSync(srcPath, "utf-8");
    const processed = html.replace(
      /<!--\s*include:(\S+)\s*-->/g,
      (_, name) => {
        if (name === "artwork") return buildGalleryHtml();
        return partials[name] || "";
      },
    );
    fs.writeFileSync(destPath, processed);
    console.log(`Built: ${file}`);
  }

  // Copy assets
  copyDir("assets", path.join(DIST, "assets"));
  if (fs.existsSync("CNAME"))
    fs.copyFileSync("CNAME", path.join(DIST, "CNAME"));

  console.log("Done! All good.");
} catch (error) {
  console.error("Build failed:", error.message);
  process.exit(1);
}
