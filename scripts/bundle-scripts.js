const esbuild = require('esbuild');

// Each source becomes its own self-contained script.
esbuild.buildSync({
  entryPoints: ['scripts/ui/site.js', 'scripts/ui/contact-menu.js', 'scripts/ui/art-lightbox.js', 'scripts/ui/chat-demo.js', 'scripts/ui/case-study.js'],
  bundle: true,
  minify: true,
  format: 'iife',
  target: ['es2020'],
  outdir: 'assets/scripts',
  define: { 'process.env.NODE_ENV': '"production"' },
  legalComments: 'eof',
});
