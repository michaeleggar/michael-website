# Michael's website

An Eleventy static site with Nunjucks templates, plain CSS, and small browser scripts, deployed on Vercel.

## Development

- `npm run dev` bundles the browser scripts and serves the site locally with live reload.
- `npm run build` bundles the scripts and builds the site into `dist/`.
- `npm run verify` builds, then runs `scripts/check-build.js`, which checks every page for a title, description, canonical URL, social image, placeholder copy, and broken local links.

Vercel runs `npm run build` and publishes `dist/` on every push to `main` ([vercel.json](vercel.json)); pushes to `dev` don't deploy. Fonts are cached for a year, images for a week.

## Stylesheets

| File | Owns |
| --- | --- |
| [styles.css](assets/css/styles.css) | Shared fonts, colors, design tokens, typography, accessibility, page width, and introductions |
| [header.css](assets/css/header.css) | Site navigation and contact links |
| [ambient-player.css](assets/css/ambient-player.css) | Transparent CD player and its lowered state |
| [portfolio.css](assets/css/portfolio.css) | Homepage name treatment and the Work project gallery and cards |
| [showcase.css](assets/css/showcase.css) | Homepage work/art fan, photographic frames, and responsive presentation |
| [case-study.css](assets/css/case-study.css) | Project titles, lead pictures, details, copy, live site showcases, and the previous/next footer |
| [chat-demo.css](assets/css/chat-demo.css) | The chat app case study's live demo |
| [art.css](assets/css/art.css) | Artwork gallery and image dialog |

Keep each feature's responsive and reduced-motion rules in its own stylesheet. Shared tokens belong in `styles.css`; feature-specific tokens belong beside the component that uses them. The `.page-content` class sets the common content width and gutters.

The [base layout](src/_includes/layouts/base.njk) loads shared styles, then the files listed in the page or layout's `stylesheets` frontmatter. Add browser scripts through the `scripts` frontmatter.

## Design tokens

Shared colors, typography, spacing, widths, and corner radii live in `assets/css/styles.css`. Page gutters adapt on smaller screens; navigation keeps its typography and tightens its spacing on phones so every label fits on one row. The Elsewhere and Other Stuff menus are built by `scripts/ui/contact-menu.js`; their bloom is a CSS transition in `header.css`, using an easing sampled from a framer-motion spring.

## Browser scripts

Sources in `scripts/ui/` are bundled by `scripts/bundle-scripts.js` into `assets/scripts/`: `site.js` (the homepage fan and the Work and Art card hover), `contact-menu.js` (the header menus), `art-lightbox.js`, `case-study.js` (live site showcases), and `chat-demo.js` (the chat app demo). Each is self-contained. Run `npm run bundle` after changing a source; dev and production builds also bundle automatically. The generated files are ignored by Git. `ambient-player.js` and `page-navigation.js` are hand-written and served as-is.

## Content and behavior

- `src/index.html`, `src/work/index.html`, and `src/art/index.html` serve Hey, Work, and Art as separate pages with ordinary navigation links. The homepage has a small redirect for old `/#work` and `/#art` bookmarks; current navigation works without JavaScript.
- `src/work/*/index.html` contains project content and card metadata. Project cards link directly to these pages.
- `src/_includes/project-card.njk` renders the Work gallery: each project's `cardImage` at the wide content width, two to a row, with its title, year, and `cardSummary` (one line on what the project is) beneath. The year, agency, and roles live in the case study's details. On hover, `scripts/ui/work-cards.js` leans the picture gently toward the pointer; it does the same, more quietly, for the Art gallery's paintings. Projects with a `cardOrder` are pinned first in that order; any without one follow, newest `year` first. The grid has two columns, and three on wide screens once there are six or more projects.
- Each case study takes the full width: an "All Work" link and the live site link, the title, the lead picture, the project details beneath it as fine print, the copy, and a footer linking the previous and next projects (`work-project-footer.njk`, which wraps around the list through the `workNeighbors` filter).
- `src/_includes/home-showcase.njk` mixes project photographs and artworks listed by image slug in `src/_data/site.json`. Artwork frames retain their original aspect ratios. `scripts/ui/showcase.js` handles pointer lift, keyboard browsing, and reduced motion. Artwork links to `/art/#image-slug`, where the selected piece opens automatically.
- The fan scales with available width and height to keep the homepage within the window. Card growth can preserve the bottom edges and limit overlap with the intro. On mobile it centers one card with two neighboring previews; horizontal swipes snap through the selection. Tap a preview to center it, then tap the centered card to open it. Keyboard or reduced-motion browsing updates immediately.
- Interface icons use Heroicons Micro, normally at 16px; the copy-confirmation heart is 12px.
- `Oddball.woff2`, the homepage name's font, is subset to lowercase a–z, space, and `'’.,-` with all its OpenType features, which cuts it from 194 KB to 33 KB. To set other characters in it, subset the full font (in Git history before this change) again with `pyftsubset Oddball.woff2 --text="…" --layout-features='*' --flavor=woff2`.
- `scripts/ui/showcase-settings.js` holds the saved fan defaults. The DialKit panel is off by default; start local development with `SHOWCASE_DIALKIT=1` to reopen it. Sizing controls cover growth, text clearance, bottom anchoring, window limits, hover protection, and caption spacing. Its existing Layout, Photos, Hover, and Spotlight controls tune the rest of the fan. Export settings as JSON when ready. The panel and its vendor assets are excluded from production.
- The saved typography and spacing live in the shared CSS tokens. Start local development with `TYPE_DIALKIT=1` to reopen the homepage Type & Spacing DialKit. The type tuner preserves the mobile gutter and page spacing rules.
- The DialKit tuners (`SHOWCASE_DIALKIT`, `TYPE_DIALKIT`, and `ART_DIALKIT`) live in `scripts/dev/` and are copied into the local preview only when enabled; they and their vendor assets never reach production builds.
- `src/_data/art.json` supplies the artwork gallery through Eleventy's built-in data loading. `scripts/ui/art-lightbox.js` builds the Art page's artwork viewer with previous/next arrows, an artwork counter, arrow keys, and touch swipes using plain JavaScript. The build bundles it into `assets/scripts/art-lightbox.js`; the dialog lives in `src/_includes/art-dialog.njk`. Opening or browsing artwork updates the URL fragment without adding history entries; closing clears it, so browser Back returns to the previous page.
- Start local development with `ART_DIALKIT=1` to open Art · Layout & Type. It tunes masonry/grid layout, desktop and mobile columns, image proportions, spacing, navigation, and the artwork viewer and its caption. Use the viewer preview to adjust its controls while the image is open; reset and CSS export are included. Art controls stay scoped to the Art page and are excluded from production builds.
- Case-study project details use a definition list styled as label/value rows in `case-study.css`. The live site link comes from the `Link` group in `projectDetails`; `contributors` adds a credits row.
- Case studies lead with `heroImage` right after the title. Photos and site showcases share one media width, a little inside the wide content column (`--case-study-media-width`); the hero has rounded corners and narrows only to land fully within the window's height. Later `.portfolio-wide-media` figures rise in gently as they scroll into view and can take a `figcaption`.
- Set `leadShowcase: true` beside a `siteShowcase` to open the case study with the showcase in the hero's place. Those pages set the hero mockup in the copy instead with `{% include "work-hero-mockup.njk" %}`, a wide figure built from `heroImage`.
- A `siteShowcase` in a project's frontmatter, placed with `leadShowcase` or `{% include "site-showcase.njk" %}`, shows the live site's homepage captures framed in the site's own surface with quiet chrome: a browser window with dots, the address, and keys like the navigation pills on wide screens, and a phone with a speaker slot on narrow ones. Each screen scrolls only when the visitor scrolls it, and both captures stay lazy so each screen downloads only the one it shows. `case-study.js` lets visitors drag either device anywhere on the page by its top bar, scrolling the page when they drag near the window's edge, and resize it from its bottom-right corner; the phone keeps its proportions. Keyboard users can focus the top bar or corner and use the arrow keys (Shift for bigger steps). Once a device has moved, a reset key appears; it, double-clicking the top bar, or pressing Home on it puts the device back. The devices' starting room is reserved, so moving them never shifts the page; they pass under the site header.
- Showcase captures live in `assets/images/optimized/<project>/` as a 1440px-wide desktop WebP and a 600px-wide mobile WebP, made from 1440px (1×) and 780px (390px at 2×) PNGs kept beside the other source images. Recapture them when a site changes. Some WordPress sites wait for real input before running their scripts, so trigger a mouse move before capturing or sticky headers and lazy images go missing; block call-tracking scripts such as CallRail so the real phone number shows, and dismiss any popups.
- `demos/chatapp/` holds static builds of both chat app versions, copied to `/work/chatapp/demo/`. The case study's `chat-demo.njk` shows the actor's screen as a live iframe, laid out at 960 × 600 and scaled to fit (phones get the app's small-screen layout, at least 420px wide), beside a cue window set on the painting named in `demoScene.wallpaper`. The cue window speaks to the app through `bridge.js`, which the chat-app build publishes beside the demos: each cue shows its character typing and then sends the line; Back to one clears the chat and replays `demoScene.opening`. The app and its painting load once the page is idle (or as soon as the demo nears the window), so booting it never interrupts scrolling, and the page stays where the visitor put it when the app focuses its composer. The first cue plays by itself once the demo is in view, unless reduced motion is on. The version buttons swap between the original and the rebuild, and the control panel link opens that version's real control panel, which stays in sync. Rebuild the demos from the chat-app repo with `npm run build:demo`; `check-build.js` skips them because they're standalone pages without site metadata.
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

This writes `artwork/new-painting-thumb.webp` (up to 600px wide) and `artwork/new-painting-large.webp` (up to 1600px wide) under `assets/images/optimized/`. Artwork also gets `artwork/new-painting-small.webp` (up to 320px wide), which the Art page serves to standard-density screens. Images keep their proportions and are never enlarged. The blurred preview each painting and project card shows while it loads is generated at build time by `src/_data/placeholders.js`, from the small image when there is one and the thumbnail otherwise.

For a project cover or social preview, add `--social` to also create a JPEG up to 1200px wide:

```sh
npm run images -- "assets/images/project/cover.png" project/cover --social
```

The command prints an `image` filename prefix and the actual `thumbnailWidth`, `width`, and `height`:

- For artwork, copy `image`, `width`, and `height` into its entry in `src/_data/art.json`, alongside its title, alt text, and other details.
- For project cards, copy those fields plus `thumbnailWidth` into the project's `cardImage` object. Put `socialImage` at the top level of its frontmatter.
- For case-study content, use ordinary `<img>` markup in a `portfolio-wide-media` figure with the generated filenames and dimensions. The existing pages show `srcset` and `sizes` for the case-study media width.

Commit the prepared files with the content changes. Building the site only uses Sharp to make the tiny blurred previews; it does not resize the published images. Original images are kept locally in the repository and are not copied to the published site.
