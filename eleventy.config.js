const fs = require("node:fs");

module.exports = function (eleventyConfig) {
  eleventyConfig.addPassthroughCopy("assets");
  eleventyConfig.addWatchTarget("assets");

  if (fs.existsSync("CNAME")) {
    eleventyConfig.addPassthroughCopy("CNAME");
  }

  eleventyConfig.addGlobalData("art", () =>
    JSON.parse(fs.readFileSync("assets/data/art.json", "utf8")),
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
