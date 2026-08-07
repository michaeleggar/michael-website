"use strict";

const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const sharp = require("sharp");

const projectRoot = path.resolve(__dirname, "..");
const imagesRoot = path.join(projectRoot, "assets/images");
const generatedImagesRoot = path.join(
  projectRoot,
  "dist/assets/images/generated",
);
const generatedImagesUrl = "/assets/images/generated";

const sourceInfoCache = new Map();
const variantJobs = new Map();
const imageProfiles = {
  content: {
    avif: { quality: 50, effort: 2 },
    webp: { quality: 76 },
    jpg: { quality: 82, progressive: true, mozjpeg: true },
    png: { compressionLevel: 9 },
  },
  thumb: {
    avif: { quality: 45, effort: 2 },
    webp: { quality: 72 },
    jpg: { quality: 78, progressive: true, mozjpeg: true },
  },
  modal: {
    avif: { quality: 48, effort: 2 },
    webp: { quality: 75 },
    jpg: { quality: 80, progressive: true, mozjpeg: true },
  },
  social: {
    jpg: { quality: 82, progressive: true, mozjpeg: true },
  },
};
const profileSignatures = Object.fromEntries(
  Object.entries(imageProfiles).map(([profile, options]) => [
    profile,
    crypto
      .createHash("sha256")
      .update(JSON.stringify(options))
      .digest("hex")
      .slice(0, 6),
  ]),
);

function escapeAttribute(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll('"', "&quot;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

function normalizeFormat(format) {
  return format === "jpeg" ? "jpg" : format;
}

function getSafeName(name) {
  return (
    name
      .toLowerCase()
      .replace(/[^a-z0-9_-]+/g, "-")
      .replace(/^-|-$/g, "") || "image"
  );
}

function hashFile(filePath) {
  return new Promise((resolve, reject) => {
    const hash = crypto.createHash("sha256");
    const input = fs.createReadStream(filePath);

    input.on("error", reject);
    input.on("data", (chunk) => hash.update(chunk));
    input.on("end", () => resolve(hash.digest("hex").slice(0, 10)));
  });
}

async function getSourceInfo(src) {
  const relativePath = decodeURIComponent(src).replace(/^\/+/, "");
  const sourcePath = path.resolve(projectRoot, relativePath);
  const relativeToImages = path.relative(imagesRoot, sourcePath);

  if (
    relativeToImages.startsWith("..") ||
    path.isAbsolute(relativeToImages)
  ) {
    throw new Error(`Image must be inside assets/images: ${src}`);
  }

  const stat = await fs.promises.stat(sourcePath);
  const cached = sourceInfoCache.get(sourcePath);

  if (
    cached &&
    cached.size === stat.size &&
    cached.mtimeMs === stat.mtimeMs
  ) {
    return cached.promise;
  }

  const promise = Promise.all([sharp(sourcePath).metadata(), hashFile(sourcePath)])
    .then(([metadata, fingerprint]) => {
      if (!metadata.width || !metadata.height || !metadata.format) {
        throw new Error(`Could not determine image metadata for ${src}`);
      }

      const parsed = path.parse(relativeToImages);

      return {
        src,
        sourcePath,
        sourceWidth: metadata.width,
        sourceHeight: metadata.height,
        sourceFormat: normalizeFormat(metadata.format),
        fingerprint,
        directory: parsed.dir,
        safeName: getSafeName(parsed.name),
      };
    })
    .catch((error) => {
      sourceInfoCache.delete(sourcePath);
      throw error;
    });

  sourceInfoCache.set(sourcePath, {
    size: stat.size,
    mtimeMs: stat.mtimeMs,
    promise,
  });

  return promise;
}

function encodeImage(image, format, profile) {
  const options = imageProfiles[profile]?.[format];

  if (!options) {
    throw new Error(`Unsupported ${profile} image format: ${format}`);
  }

  if (format === "avif") return image.avif(options);
  if (format === "webp") return image.webp(options);
  if (format === "jpg") return image.jpeg(options);
  if (format === "png") return image.png(options);

  throw new Error(`Unsupported output format: ${format}`);
}

async function createVariant(source, profile, width, format) {
  const fileName = [
    source.safeName,
    source.fingerprint,
    profile,
    profileSignatures[profile],
    width,
  ].join("-") + `.${format}`;
  const outputDirectory = path.join(generatedImagesRoot, source.directory);
  const outputPath = path.join(outputDirectory, fileName);
  const publicDirectory = path.posix.join(
    generatedImagesUrl,
    source.directory.split(path.sep).join("/"),
  );

  if (!variantJobs.has(outputPath)) {
    const job = (async () => {
      await fs.promises.mkdir(outputDirectory, { recursive: true });

      const image = sharp(source.sourcePath).rotate().resize({
        width,
        withoutEnlargement: true,
      });

      await encodeImage(image, format, profile).toFile(outputPath);

      return {
        width,
        url: path.posix.join(publicDirectory, fileName),
      };
    })().catch((error) => {
      variantJobs.delete(outputPath);
      throw error;
    });

    variantJobs.set(outputPath, job);
  }

  return variantJobs.get(outputPath);
}

async function generateImageSet(src, { profile, widths, formats }) {
  const source = await getSourceInfo(src);
  const outputWidths = [
    ...new Set(widths.map((width) => Math.min(width, source.sourceWidth))),
  ];
  const outputFormats = [...new Set(formats.map(normalizeFormat))];
  const variants = Object.fromEntries(
    outputFormats.map((format) => [format, []]),
  );

  await Promise.all(
    outputFormats.flatMap((format) =>
      outputWidths.map(async (width) => {
        variants[format].push(
          await createVariant(source, profile, width, format),
        );
      }),
    ),
  );

  for (const format of outputFormats) {
    variants[format].sort((a, b) => a.width - b.width);
  }

  return { ...source, variants };
}

function srcset(imageSet, format) {
  return imageSet.variants[format]
    .map((variant) => `${variant.url} ${variant.width}w`)
    .join(", ");
}

function largestVariant(imageSet, format) {
  return imageSet.variants[format].at(-1).url;
}

async function responsiveImage(
  src,
  alt,
  sizes,
  className = "",
  loading = "lazy",
  fetchPriority = "auto",
) {
  const source = await getSourceInfo(src);
  const imageSet = await generateImageSet(src, {
    profile: "content",
    widths: [480, 800, 1200, 1600],
    formats: ["avif", "webp", source.sourceFormat],
  });
  const fallbackFormat = source.sourceFormat;
  const classAttribute = className
    ? ` class="${escapeAttribute(className)}"`
    : "";

  return `<picture>
    <source type="image/avif" srcset="${srcset(imageSet, "avif")}" sizes="${escapeAttribute(sizes)}">
    <source type="image/webp" srcset="${srcset(imageSet, "webp")}" sizes="${escapeAttribute(sizes)}">
    <img src="${largestVariant(imageSet, fallbackFormat)}" srcset="${srcset(imageSet, fallbackFormat)}" sizes="${escapeAttribute(sizes)}" width="${source.sourceWidth}" height="${source.sourceHeight}" alt="${escapeAttribute(alt)}" loading="${escapeAttribute(loading)}" fetchpriority="${escapeAttribute(fetchPriority)}" decoding="async"${classAttribute}>
  </picture>`;
}

async function socialImageUrl(src) {
  const imageSet = await generateImageSet(src, {
    profile: "social",
    widths: [1200],
    formats: ["jpg"],
  });

  return largestVariant(imageSet, "jpg");
}

async function artworkCard(artwork) {
  const title = artwork.title || "artwork";
  const alt = artwork.alt || title;
  const [thumb, modal] = await Promise.all([
    generateImageSet(artwork.src_large, {
      profile: "thumb",
      widths: [320, 600],
      formats: ["avif", "webp", "jpg"],
    }),
    generateImageSet(artwork.src_large, {
      profile: "modal",
      widths: [1600],
      formats: ["avif", "webp", "jpg"],
    }),
  ]);
  const thumbSizes =
    "(max-width: 780px) calc((100vw - 3rem) / 2), 290px";

  return `<figure class="art-item">
    <button
      type="button"
      aria-label="View ${escapeAttribute(title)}"
      data-modal-src="${largestVariant(modal, "jpg")}"
      data-modal-srcset="${escapeAttribute(srcset(modal, "jpg"))}"
      data-modal-avif-srcset="${escapeAttribute(srcset(modal, "avif"))}"
      data-modal-webp-srcset="${escapeAttribute(srcset(modal, "webp"))}"
      data-alt="${escapeAttribute(alt)}"
      data-title="${escapeAttribute(title)}"
      data-year="${escapeAttribute(artwork.year)}"
      data-medium="${escapeAttribute(artwork.medium)}"
      data-dimensions="${escapeAttribute(artwork.dimensions_text)}"
    >
      <picture>
        <source type="image/avif" srcset="${srcset(thumb, "avif")}" sizes="${thumbSizes}">
        <source type="image/webp" srcset="${srcset(thumb, "webp")}" sizes="${thumbSizes}">
        <img src="${largestVariant(thumb, "jpg")}" srcset="${srcset(thumb, "jpg")}" sizes="${thumbSizes}" width="${thumb.sourceWidth}" height="${thumb.sourceHeight}" loading="lazy" decoding="async" alt="${escapeAttribute(alt)}">
      </picture>
    </button>
  </figure>`;
}

module.exports = {
  artworkCard,
  responsiveImage,
  socialImageUrl,
};
