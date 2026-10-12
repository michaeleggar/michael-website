const esbuild = require('esbuild');
esbuild.buildSync({
  entryPoints: ['scripts/ui/contact-menu.jsx'],
  bundle: true,
  minify: true,
  format: 'iife',
  target: ['es2020'],
  outfile: 'assets/scripts/contact-menu.js',
  define: { 'process.env.NODE_ENV': '"production"' },
  legalComments: 'eof',
});
