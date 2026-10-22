const esbuild = require('esbuild');

// Each source becomes its own script, so the homepage fan (site.js) starts
// without waiting for React, which only the menus (contact-menu.js) need.
esbuild.buildSync({
  entryPoints: ['scripts/ui/site.js', 'scripts/ui/contact-menu.jsx', 'scripts/ui/art-lightbox.js', 'scripts/ui/chat-demo.js', 'scripts/ui/case-study.js'],
  bundle: true,
  minify: true,
  format: 'iife',
  target: ['es2020'],
  outdir: 'assets/scripts',
  define: { 'process.env.NODE_ENV': '"production"' },
  legalComments: 'eof',
});
