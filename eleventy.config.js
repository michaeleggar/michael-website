const fs = require("node:fs");
const path = require("node:path");
const sharp = require("sharp");

const responsiveImageWidths = [480, 800, 1200, 1600];
const imageJobs = new Map();
const preparedImages = new Map();
const portfolioProjects = require("./src/_data/portfolioProjects.json");
const responsiveImageSources = [
  ...portfolioProjects.map((project) => project.image),
  "/assets/images/ductworx/duc-mock-1.jpg",
  "/assets/images/chatapp/chat-app-1.png",
  "/assets/images/chatapp/chat-onset-1.jpeg",
  "/assets/images/chatapp/chat-onset-2.jpeg",
  "/assets/images/ria/ria-feature.png",
  "/assets/images/ria/ria-tablet.jpg",
  "/assets/images/kochcomm/kc-website-2.jpg",
];

function escapeAttribute(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll('"', "&quot;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

function createImageVariant(sourcePath, outputPath, width, format) {
  if (!imageJobs.has(outputPath)) {
    const image = sharp(sourcePath).rotate().resize({
      width,
      withoutEnlargement: true,
    });

    if (format === "avif") image.avif({ quality: 50, effort: 2 });
    if (format === "webp") image.webp({ quality: 76 });
    if (format === "jpg") image.jpeg({ quality: 82, progressive: true });
    if (format === "png") image.png({ compressionLevel: 9 });

    imageJobs.set(outputPath, image.toFile(outputPath));
  }

  return imageJobs.get(outputPath);
}

async function prepareResponsiveImage(src) {
  const sourcePath = path.join(process.cwd(), src.replace(/^\//, ""));
  const sourceMetadata = await sharp(sourcePath).metadata();
  const sourceWidth = sourceMetadata.width;
  const sourceHeight = sourceMetadata.height;

  if (!sourceWidth || !sourceHeight) {
    throw new Error(`Could not determine dimensions for ${src}`);
  }

  const widths = [
    ...new Set(
      responsiveImageWidths.map((width) => Math.min(width, sourceWidth)),
    ),
  ];
  const sourceFormat =
    sourceMetadata.format === "jpeg" ? "jpg" : sourceMetadata.format;
  const formats = [...new Set(["avif", "webp", sourceFormat])];
  const imagesRoot = path.join(process.cwd(), "assets/images");
  const relativeSource = path.relative(imagesRoot, sourcePath);
  const parsedSource = path.parse(relativeSource);
  const safeName = parsedSource.name
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, "-")
    .replace(/^-|-$/g, "");
  const outputDirectory = path.join(
    process.cwd(),
    "dist/assets/images/generated",
    parsedSource.dir,
  );
  const publicDirectory = path.posix.join(
    "/assets/images/generated",
    parsedSource.dir.split(path.sep).join("/"),
  );

  fs.mkdirSync(outputDirectory, { recursive: true });

  const variants = Object.fromEntries(formats.map((format) => [format, []]));
  await Promise.all(
    formats.flatMap((format) =>
      widths.map(async (width) => {
        const fileName = `${safeName}-${width}.${format}`;
        const outputPath = path.join(outputDirectory, fileName);
        await createImageVariant(sourcePath, outputPath, width, format);
        variants[format].push({
          width,
          url: path.posix.join(publicDirectory, fileName),
        });
      }),
    ),
  );

  for (const format of formats) {
    variants[format].sort((a, b) => a.width - b.width);
  }

  preparedImages.set(src, {
    sourceWidth,
    sourceHeight,
    sourceFormat,
    variants,
  });
}

function responsiveImage(
  src,
  alt,
  sizes,
  className = "",
  loading = "lazy",
  fetchPriority = "auto",
  draggable = false,
) {
  const preparedImage = preparedImages.get(src);

  if (!preparedImage) {
    throw new Error(`Responsive image was not prepared: ${src}`);
  }

  const { sourceWidth, sourceHeight, sourceFormat, variants } = preparedImage;

  const srcset = (format) =>
    variants[format]
      .map((variant) => `${variant.url} ${variant.width}w`)
      .join(", ");
  const fallback = variants[sourceFormat];
  const fallbackSrc = fallback[fallback.length - 1].url;
  const classAttribute = className
    ? ` class="${escapeAttribute(className)}"`
    : "";
  const draggableAttribute = draggable ? ' draggable="false"' : "";

  return `<picture>
    <source type="image/avif" srcset="${srcset("avif")}" sizes="${escapeAttribute(sizes)}">
    <source type="image/webp" srcset="${srcset("webp")}" sizes="${escapeAttribute(sizes)}">
    <img src="${fallbackSrc}" srcset="${srcset(sourceFormat)}" sizes="${escapeAttribute(sizes)}" width="${sourceWidth}" height="${sourceHeight}" alt="${escapeAttribute(alt)}" loading="${loading}" fetchpriority="${fetchPriority}" decoding="async"${classAttribute}${draggableAttribute}>
  </picture>`;
}

module.exports = function (eleventyConfig) {
  eleventyConfig.addPassthroughCopy("assets");
  eleventyConfig.addWatchTarget("assets");

  if (fs.existsSync("CNAME")) {
    eleventyConfig.addPassthroughCopy("CNAME");
  }

  eleventyConfig.addGlobalData("art", () =>
    JSON.parse(fs.readFileSync("assets/data/art.json", "utf8")),
  );

  eleventyConfig.on("eleventy.before", async () => {
    await Promise.all(
      [...new Set(responsiveImageSources)].map(prepareResponsiveImage),
    );
  });

  eleventyConfig.addShortcode("responsiveImage", responsiveImage);

  return {
    dir: {
      input: "src",
      includes: "_includes",
      output: "dist",
    },
    htmlTemplateEngine: "njk",
    templateFormats: ["html", "njk"],
  };
};
