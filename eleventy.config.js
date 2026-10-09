module.exports = function (eleventyConfig) {
  const navigationTuningEnabled = process.env.ELEVENTY_RUN_MODE === "serve";
  eleventyConfig.addGlobalData("navigationTuningEnabled", navigationTuningEnabled);

  if (navigationTuningEnabled) {
    eleventyConfig.addPassthroughCopy({
      "node_modules/dialkit/dist/vanilla/index.js": "assets/scripts/vendor/dialkit.js",
      "node_modules/dialkit/dist/vanilla/styles.css": "assets/css/vendor/dialkit.css",
      "node_modules/dialkit/LICENSE": "assets/scripts/vendor/dialkit-LICENSE.txt",
    });
  }

  [
    "assets/css",
    "assets/images/optimized",
    "assets/favicon",
    "assets/fonts/Lato-OFL.txt",
    "assets/fonts/LatoLatin-Italic.woff2",
    "assets/fonts/LatoLatin-Medium.woff2",
    "assets/fonts/LatoLatin-Regular.woff2",
    "assets/fonts/LatoLatin-Semibold.woff2",
    "assets/fonts/Oddball.woff2",
    "assets/scripts",
    "CNAME",
  ].forEach((assetPath) => eleventyConfig.addPassthroughCopy(assetPath));

  eleventyConfig.addCollection("workProjects", (collectionApi) =>
    collectionApi
      .getFilteredByGlob("src/work/*/index.html")
      .sort((first, second) => first.data.cardOrder - second.data.cardOrder),
  );

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
