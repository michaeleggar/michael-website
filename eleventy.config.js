const bundleScripts = require('./scripts/bundle-scripts.js');

module.exports = function (eleventyConfig) {
  // Bundle the browser scripts before every build, and rebuild while serving
  // when their sources change, so the copies in dist/ stay current.
  eleventyConfig.on('eleventy.before', bundleScripts);
  eleventyConfig.addWatchTarget('scripts/ui/');
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
    "assets/fonts/RethinkSans-Latin.woff2",
    "assets/fonts/RethinkSans-Latin-Italic.woff2",
    "assets/fonts/RethinkSans-OFL.txt",
    "assets/fonts/Archivo-W.woff2",
    "assets/fonts/Archivo-W-Italic.woff2",
    "assets/fonts/Archivo-OFL.txt",
    "assets/fonts/Oddball.woff2",
    "assets/scripts",
    "assets/video",
  ].forEach((assetPath) => eleventyConfig.addPassthroughCopy(assetPath));
  // Static builds of the chat app, embedded live in its case study. Rebuild them
  // from the chat-app repo with `npm run build:demo`, with its base path set to
  // /projects/chatapp/demo/ (it was /work/chatapp/demo/).
  eleventyConfig.addPassthroughCopy({ "demos/chatapp": "projects/chatapp/demo" });

  eleventyConfig.addCollection("workProjects", (collectionApi) =>
    collectionApi
      .getFilteredByGlob("src/projects/*/index.html")
      // Projects with a cardOrder are pinned first in that order; the rest follow, newest first.
      .sort((first, second) => {
        const pinned = (first.data.cardOrder ?? Infinity) - (second.data.cardOrder ?? Infinity);
        if (pinned) return pinned;
        return String(second.data.year).localeCompare(String(first.data.year)) || first.data.cardTitle.localeCompare(second.data.cardTitle);
      }),
  );

  eleventyConfig.addFilter('featuredArtwork', (artworks, slugs) => slugs.map(slug => {
    const artwork = artworks.find(item => item.image.endsWith(`/${slug}`));
    if (!artwork) throw new Error(`Featured artwork "${slug}" was not found in art.json.`);
    return artwork;
  }));
  // Card tags: the agency, then each "My role" detail.
  eleventyConfig.addFilter('projectTags', data => {
    const roles = data.projectDetails?.find(group => group.label === 'My role')?.items || [];
    return [data.agency, ...roles.map(item => item.label || item)].filter(Boolean);
  });
  eleventyConfig.addFilter('artworkSlug', artwork => artwork.image.split('/').pop());

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
