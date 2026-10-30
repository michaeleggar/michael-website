const esbuild = require('esbuild');

// Each source becomes its own self-contained script.
function bundleScripts() {
  esbuild.buildSync({
    entryPoints: ['scripts/ui/site.js', 'scripts/ui/contact-menu.js', 'scripts/ui/art-lightbox.js', 'scripts/ui/case-study.js'],
    bundle: true,
    minify: true,
    format: 'iife',
    target: ['es2020'],
    outdir: 'assets/scripts',
    define: { 'process.env.NODE_ENV': '"production"' },
    legalComments: 'eof',
  });
}

module.exports = bundleScripts;
if (require.main === module) bundleScripts();
