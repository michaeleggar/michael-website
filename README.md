# Michael's website

An Eleventy static site with Nunjucks templates, plain CSS, and a small browser script for the artwork dialog.

## Stylesheets

| File | Owns |
| --- | --- |
| [styles.css](assets/css/styles.css) | Shared fonts, colors, design tokens, typography, accessibility, page width, and introductions |
| [header.css](assets/css/header.css) | Site navigation and contact links |
| [portfolio.css](assets/css/portfolio.css) | Homepage name treatment and the Work project grid and cards |
| [showcase.css](assets/css/showcase.css) | Homepage work/art fan, photographic frames, and responsive presentation |
| [case-study.css](assets/css/case-study.css) | Project introductions, details, copy, and images |
| [art.css](assets/css/art.css) | Artwork gallery and image dialog |

Keep each feature's responsive and reduced-motion rules in its own stylesheet. Shared tokens belong in `styles.css`; feature-specific tokens belong beside the component that uses them. The `.page-content` class sets the common content width and gutters.

The [base layout](src/_includes/layouts/base.njk) loads shared styles, then the files listed in the page or layout's `stylesheets` frontmatter. Add browser scripts through the `scripts` frontmatter. Case studies only load CSS in the published site.

## Design tokens

Shared colors, typography, spacing, widths, and corner radii live in `assets/css/styles.css`. Page gutters adapt on smaller screens; navigation retains the same typography and row sizing. The Other Stuff menu uses Bloom, with its React source in `scripts/ui/contact-menu.jsx`. Run `npm run bundle:contacts` after changing that source; dev and production build commands also bundle it automatically. The generated `assets/scripts/contact-menu.js` is ignored by Git; the UI source and bundling script are the source of truth.

## Content and behavior

- `src/index.html`, `src/work/index.html`, and `src/art/index.html` serve Hey, Work, and Art as separate pages with ordinary navigation links. The homepage has a small redirect for old `/#work` and `/#art` bookmarks; current navigation works without JavaScript.
- `src/work/*/index.html` contains project content and card metadata. Project cards link directly to these pages.
- `src/_includes/project-card.njk` renders the Work grid.
- `src/_includes/home-showcase.njk` mixes project photographs and artworks listed by image slug in `src/_data/site.json`. Artwork frames retain their original aspect ratios. `scripts/ui/showcase.js` handles pointer lift, keyboard browsing, and reduced motion, and is included in the shared browser bundle. Artwork opens the same native dialog used on the Art page.
- The fan scales with available width. On mobile it centers one card with two neighboring previews; horizontal swipes snap through the selection. Tap a preview to center it, then tap the centered card to open it. Vertical scrolling remains available, and keyboard or reduced-motion browsing updates immediately.
- Interface icons use Heroicons Micro, normally at 16px; the copy-confirmation heart is 12px.
- `scripts/ui/showcase-settings.js` holds the saved fan defaults. The DialKit panel is off by default; start local development with `SHOWCASE_DIALKIT=1` to enable its controls and JSON export again. The panel and its vendor assets are excluded from production.
- The saved typography and spacing live in the shared CSS tokens. Start local development with `TYPE_DIALKIT=1` to reopen the homepage Type & Spacing DialKit. Both tuners live in `scripts/dev/` and are copied into the preview only when enabled; their scripts and vendor assets are excluded from ordinary production builds. The type tuner preserves the mobile gutter and page spacing rules.
- `src/_data/art.json` supplies the artwork gallery through Eleventy's built-in data loading. `assets/scripts/art.js` is loaded on the homepage and Art page and fills and opens their native dialogs.
- Case-study project details use a definition list styled as label/value rows in `case-study.css`.
- `assets/images/optimized/` contains the prepared WebP images and JPEG social previews. Eleventy copies this directory as-is.

## Adding images

Keep originals in `assets/images/` and prepare each new image with:

```sh
npm run images -- "assets/images/artwork/New painting.jpg" artwork/new-painting
```

This writes `artwork/new-painting-thumb.webp` (up to 600px wide) and `artwork/new-painting-large.webp` (up to 1600px wide) under `assets/images/optimized/`. Images keep their proportions and are never enlarged.

For a project cover or social preview, add `--social` to also create a JPEG up to 1200px wide:

```sh
npm run images -- "assets/images/project/cover.png" project/cover --social
```

The command prints an `image` filename prefix and the actual `thumbnailWidth`, `width`, and `height`:

- For artwork, copy `image`, `width`, and `height` into its entry in `src/_data/art.json`, alongside its title, alt text, and other details.
- For project cards, copy those fields plus `thumbnailWidth` into the project's `cardImage` object. Put `socialImage` at the top level of its frontmatter.
- For case-study content, use ordinary `<img>` markup with the generated filenames and dimensions. The existing pages show `srcset` and `sizes` for the shared 700px content width.

Commit the prepared files with the content changes. Sharp is only used by this manual command; building the site does not process images. Original images are kept locally in the repository and are not copied to the published site.
