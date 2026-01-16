const fs = require("fs");
const path = require("path");

const SRC = "src";
const DIST = "dist";
const PARTIALS = "assets/partials";

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

try {
  // Clean dist directory
  if (fs.existsSync(DIST)) fs.rmSync(DIST, { recursive: true });
  fs.mkdirSync(DIST);

  // Load partials
  const partials = loadPartials();
  console.log(`Partials: ${Object.keys(partials).join(", ")}`);

  // Process HTML files
  for (const file of fs.readdirSync(SRC).filter((f) => f.endsWith(".html"))) {
    const html = fs.readFileSync(path.join(SRC, file), "utf-8");
    const processed = html.replace(
      /<!--\s*include:(\S+)\s*-->/g,
      (_, name) => partials[name] || ""
    );
    fs.writeFileSync(path.join(DIST, file), processed);
    console.log(`Built: ${file}`);
  }

  // Copy assets
  copyDir("assets", path.join(DIST, "assets"));
  if (fs.existsSync("CNAME")) fs.copyFileSync("CNAME", path.join(DIST, "CNAME"));

  console.log("Build completed successfully");
} catch (error) {
  console.error("Build failed:", error.message);
  process.exit(1);
}
