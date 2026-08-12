const fs = require("node:fs");
const {
  artworkCard,
  responsiveImage,
  socialImageUrl,
} = require("./scripts/image-pipeline");

module.exports = function (eleventyConfig) {
  [
    "assets/css",
    "assets/favicon",
    "assets/fonts/Lato-OFL.txt",
    "assets/fonts/LatoLatin-Italic.woff2",
    "assets/fonts/LatoLatin-Medium.woff2",
    "assets/fonts/LatoLatin-Regular.woff2",
    "assets/fonts/LatoLatin-Semibold.woff2",
    "assets/fonts/Oddball.woff2",
    "assets/scripts/art.js",
    "assets/scripts/portfolio-filter.js",
    "assets/scripts/utilities.js",
  ].forEach((assetPath) => eleventyConfig.addPassthroughCopy(assetPath));

  eleventyConfig.addWatchTarget("assets/data");
  eleventyConfig.addWatchTarget("assets/images");

  if (fs.existsSync("CNAME")) {
    eleventyConfig.addPassthroughCopy("CNAME");
  }

  eleventyConfig.addGlobalData("art", () =>
    JSON.parse(fs.readFileSync("assets/data/art.json", "utf8")),
  );

  eleventyConfig.addCollection("workProjects", (collectionApi) =>
    collectionApi
      .getFilteredByGlob("src/work/*/index.html")
      .sort((first, second) => first.data.cardOrder - second.data.cardOrder),
  );

  eleventyConfig.addNunjucksAsyncShortcode(
    "responsiveImage",
    responsiveImage,
  );
  eleventyConfig.addNunjucksAsyncShortcode("artworkCard", artworkCard);
  eleventyConfig.addNunjucksAsyncShortcode("socialImageUrl", socialImageUrl);

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
