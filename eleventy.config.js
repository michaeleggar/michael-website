module.exports = function (eleventyConfig) {
  const serving = process.env.ELEVENTY_RUN_MODE === 'serve' || process.argv.includes('--serve');
  const showcaseTuningEnabled = serving && process.env.SHOWCASE_DIALKIT === '1';
  const typeTuningEnabled = serving && process.env.TYPE_DIALKIT === '1';
  const artTuningEnabled = serving && process.env.ART_DIALKIT === '1';
  eleventyConfig.addGlobalData('artTuningEnabled', artTuningEnabled);
  eleventyConfig.addGlobalData('typeTuningEnabled', typeTuningEnabled);
  eleventyConfig.addGlobalData('showcaseTuningEnabled', showcaseTuningEnabled);
  if (showcaseTuningEnabled || typeTuningEnabled || artTuningEnabled) {
    eleventyConfig.addPassthroughCopy({
      'node_modules/dialkit/dist/vanilla/index.js': 'assets/scripts/vendor/dialkit.js',
      'node_modules/dialkit/dist/vanilla/styles.css': 'assets/css/vendor/dialkit.css',
      'node_modules/dialkit/LICENSE': 'assets/scripts/vendor/dialkit-LICENSE.txt',
    });
  }
  if (showcaseTuningEnabled) eleventyConfig.addPassthroughCopy({ 'scripts/dev/showcase-tuner.js': 'assets/scripts/showcase-tuner.js' });
  if (typeTuningEnabled) eleventyConfig.addPassthroughCopy({ 'scripts/dev/type-spacing-tuner.js': 'assets/scripts/type-spacing-tuner.js' });
  if (artTuningEnabled) eleventyConfig.addPassthroughCopy({ 'scripts/dev/art-tuner.js': 'assets/scripts/art-tuner.js' });
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
  eleventyConfig.addPassthroughCopy({ 'node_modules/pasito/dist/index.css': 'assets/css/pasito.css' });

  eleventyConfig.addCollection("workProjects", (collectionApi) =>
    collectionApi
      .getFilteredByGlob("src/work/*/index.html")
      .sort((first, second) => first.data.cardOrder - second.data.cardOrder),
  );

  eleventyConfig.addFilter('featuredArtwork', (artworks, slugs) => slugs.map(slug => {
    const artwork = artworks.find(item => item.image.endsWith(`/${slug}`));
    if (!artwork) throw new Error(`Featured artwork "${slug}" was not found in art.json.`);
    return artwork;
  }));

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
