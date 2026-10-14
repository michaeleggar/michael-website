# Michael's website

An Eleventy static site with Nunjucks templates, plain CSS, and a small browser script for the artwork dialog.

## Stylesheets

| File | Owns |
| --- | --- |
| [styles.css](assets/css/styles.css) | Shared fonts, colors, design tokens, typography, accessibility, page width, and introductions |
| [header.css](assets/css/header.css) | Site navigation and contact links |
| [ambient-player.css](assets/css/ambient-player.css) | Transparent CD player and its lowered state |
| [portfolio.css](assets/css/portfolio.css) | Homepage name treatment and the Work project grid and cards |
| [showcase.css](assets/css/showcase.css) | Homepage work/art fan, photographic frames, and responsive presentation |
| [case-study.css](assets/css/case-study.css) | Project introductions, details, copy, and images |
| [art.css](assets/css/art.css) | Artwork gallery and image dialog |

Keep each feature's responsive and reduced-motion rules in its own stylesheet. Shared tokens belong in `styles.css`; feature-specific tokens belong beside the component that uses them. The `.page-content` class sets the common content width and gutters.

The [base layout](src/_includes/layouts/base.njk) loads shared styles, then the files listed in the page or layout's `stylesheets` frontmatter. Add browser scripts through the `scripts` frontmatter. Case studies only load CSS in the published site.

## Design tokens

Shared colors, typography, spacing, widths, and corner radii live in `assets/css/styles.css`. Page gutters adapt on smaller screens; navigation keeps its typography and tightens its spacing on phones so every label fits on one row. The Elsewhere and Other Stuff menus use Bloom, with its React source in `scripts/ui/contact-menu.jsx`. Run `npm run bundle:contacts` after changing that source; dev and production build commands also bundle it automatically. The generated `assets/scripts/contact-menu.js` is ignored by Git; the UI source and bundling script are the source of truth.

## Content and behavior

- `src/index.html`, `src/work/index.html`, and `src/art/index.html` serve Hey, Work, and Art as separate pages with ordinary navigation links. The homepage has a small redirect for old `/#work` and `/#art` bookmarks; current navigation works without JavaScript.
- `src/work/*/index.html` contains project content and card metadata. Project cards link directly to these pages.
- `src/_includes/project-card.njk` renders the Work grid.
- `src/_includes/home-showcase.njk` mixes project photographs and artworks listed by image slug in `src/_data/site.json`. Artwork frames retain their original aspect ratios. `scripts/ui/showcase.js` handles pointer lift, keyboard browsing, and reduced motion, and is included in the shared browser bundle. Artwork links to `/art/#image-slug`, where the selected piece opens automatically.
- The fan scales with available width and height to keep the homepage within the window. Card growth can preserve the bottom edges and limit overlap with the intro. On mobile it centers one card with two neighboring previews; horizontal swipes snap through the selection. Tap a preview to center it, then tap the centered card to open it. Keyboard or reduced-motion browsing updates immediately.
- Interface icons use Heroicons Micro, normally at 16px; the copy-confirmation heart is 12px.
- `scripts/ui/showcase-settings.js` holds the saved fan defaults. The DialKit panel is off by default; start local development with `SHOWCASE_DIALKIT=1` to reopen it. Sizing controls cover growth, text clearance, bottom anchoring, window limits, hover protection, and caption spacing. Its existing Layout, Photos, Hover, and Spotlight controls tune the rest of the fan. Export settings as JSON when ready. The panel and its vendor assets are excluded from production.
- The saved typography and spacing live in the shared CSS tokens. Start local development with `TYPE_DIALKIT=1` to reopen the homepage Type & Spacing DialKit. Both tuners live in `scripts/dev/` and are copied into the preview only when enabled; their scripts and vendor assets are excluded from ordinary production builds. The type tuner preserves the mobile gutter and page spacing rules.
- `src/_data/art.json` supplies the artwork gallery through Eleventy's built-in data loading. `scripts/ui/art-lightbox.js` builds the Art page's artwork viewer with previous/next arrows, an artwork counter, arrow keys, and touch swipes using plain JavaScript. The build bundles it into `assets/scripts/art-lightbox.js`; the dialog lives in `src/_includes/art-dialog.njk`. Opening or browsing artwork updates the URL fragment without adding history entries; closing clears it, so browser Back returns to the previous page.
- Start local development with `ART_DIALKIT=1` to open Art · Layout & Type. It tunes masonry/grid layout, desktop and mobile columns, image proportions, spacing, navigation, and the artwork viewer and its caption. Use the viewer preview to adjust its controls while the image is open; reset and CSS export are included. Art controls stay scoped to the Art page and are excluded from production builds.
- Case-study project details use a definition list styled as label/value rows in `case-study.css`.
- `assets/images/optimized/` contains the prepared WebP images and JPEG social previews. Eleventy copies this directory as-is.

## CD player

Open **Other Stuff → CD player** to raise one shiny, hand-marked disc already seated beneath a fixed transparent lid. Press play to start the original Web Audio wind-and-leaf placeholder; no third-party samples, recordings, or streaming embeds are used.

The disc, lid, and shell share one center, so the rims stay even all the way around; the display and the three keys sit on a single row above them. The keys handle restart, stop, and play/pause. The seven-segment display shows elapsed time above a segmented volume strip, and the whole display is the volume control: drag it, scroll over it, or use the arrow keys. The handwritten artwork eases up to speed beneath fixed reflections and coasts to a stop; a paused disc blinks its time. Restart resets the counter while preserving playback, stop resets and pauses, pause preserves the time, and closing stops the audio. Site navigation preserves the player and audio state.

After the first hover or interaction, moving away lowers the player after a short grace period until only its control row and the top of the disc show above the bottom edge. Touch interactions lower it after 2.4 seconds of inactivity; dragging and keyboard focus keep it raised. An intentional scroll also lowers it. Hover over the display or disc, tap anywhere off the keys, or focus a control with the keyboard to raise it again. The keys keep working while it is lowered. Reduced motion removes the spin, blink, and slide.

To replace the shared placeholder with a recording, put the file in `assets/audio/`, add that directory to Eleventy's passthrough-copy list, and set `data-audio-src="/assets/audio/backyard.mp3"` on the section in `src/_includes/ambient-player.html`. Prepare a seamless loop and check the recording level before publishing.

## Adding images

Keep originals in `assets/images/` and prepare each new image with:

```sh
npm run images -- "assets/images/artwork/New painting.jpg" artwork/new-painting
```

This writes `artwork/new-painting-thumb.webp` (up to 600px wide) and `artwork/new-painting-large.webp` (up to 1600px wide) under `assets/images/optimized/`. Artwork also gets `artwork/new-painting-small.webp` (up to 320px wide), which the Art page serves to standard-density screens. Images keep their proportions and are never enlarged. The blurred preview each painting shows while it loads is generated at build time by `src/_data/placeholders.js`, from the small image when there is one and the thumbnail otherwise.

For a project cover or social preview, add `--social` to also create a JPEG up to 1200px wide:

```sh
npm run images -- "assets/images/project/cover.png" project/cover --social
```

The command prints an `image` filename prefix and the actual `thumbnailWidth`, `width`, and `height`:

- For artwork, copy `image`, `width`, and `height` into its entry in `src/_data/art.json`, alongside its title, alt text, and other details.
- For project cards, copy those fields plus `thumbnailWidth` into the project's `cardImage` object. Put `socialImage` at the top level of its frontmatter.
- For case-study content, use ordinary `<img>` markup with the generated filenames and dimensions. The existing pages show `srcset` and `sizes` for the shared 700px content width.

Commit the prepared files with the content changes. Sharp is only used by this manual command; building the site does not process images. Original images are kept locally in the repository and are not copied to the published site.
