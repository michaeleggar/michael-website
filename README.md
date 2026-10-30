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
| [portfolio.css](assets/css/portfolio.css) | Homepage name treatment and the Projects gallery and cards |
| [showcase.css](assets/css/showcase.css) | Homepage work/art fan, photographic frames, and responsive presentation |
| [case-study.css](assets/css/case-study.css) | Case studies: the recording of the site with the title and details under it, the lede, recorded clips of the site, pictures, the framed chat demo, footnotes, and the project links at the end |
| [art.css](assets/css/art.css) | Artwork gallery and image dialog |

Keep each feature's responsive and reduced-motion rules in its own stylesheet. Shared tokens belong in `styles.css`; feature-specific tokens belong beside the component that uses them. The `.page-content` class sets the common content width and gutters.

The [base layout](src/_includes/layouts/base.njk) loads shared styles, then the files listed in the page or layout's `stylesheets` frontmatter. Add browser scripts through the `scripts` frontmatter.

## Design tokens

Shared colors, typography, spacing, widths, and corner radii live in `assets/css/styles.css`. Every face is Rethink Sans (OFL, self-hosted in `assets/fonts` as one variable file per style, weights 400–800), except Oddball for the name. Rethink's capital W is swapped for Archivo's, from two small W-only files declared under the same family with `unicode-range: U+0057`, because Rethink's W has crossed strokes and no alternate. `--font-display`, used for case-study ledes and copy and for project card titles, points at it too; it was Rowan, a serif from Fontshare, until October 2026. `--hairline` and `--panel` frame the case-study figures. Page gutters adapt on smaller screens; navigation keeps its typography and tightens its spacing on phones so every label fits on one row. The Elsewhere and Other Stuff menus are built by `scripts/ui/contact-menu.js`; their bloom is a CSS transition in `header.css`, using an easing sampled from a framer-motion spring.

## Browser scripts

Sources in `scripts/ui/` are bundled by `scripts/bundle-scripts.js` into `assets/scripts/`: `site.js` (the homepage fan and the project and art card hover), `contact-menu.js` (the header menus), `art-lightbox.js`, and `case-study.js` (clips that get their poster and start buffering a screen before they arrive, and play only while on screen). Each is self-contained. Every Eleventy build bundles them first, and `npm run dev` watches `scripts/ui/` and rebuilds when a source changes; `npm run bundle` still bundles on its own. The generated files are ignored by Git. `ambient-player.js` and `page-navigation.js` are hand-written and served as-is. `page-navigation.js` swaps pages in place, and fetches a page as soon as a visitor hovers, touches, or tabs to its link (warming its stylesheets, scripts, and a case study's hero poster too), so most clicks are already loaded; it does nothing extra under Save-Data.

## Content and behavior

- `src/index.html`, `src/projects/index.html`, and `src/art/index.html` serve Hey, Projects, and Art as separate pages with ordinary navigation links, which work without JavaScript. The section was called Work until October 2026; `vercel.json` permanently redirects `/work/…` to `/projects/…`, and `page-navigation.js` still forwards old `/#work` and `/#art` bookmarks from the homepage. Internal names (`work-case-study.njk`, `work-*.njk`, the `workProjects` collection, `.work-page`) keep the old word.
- `src/projects/*/index.html` contains project content and card metadata. Project cards link directly to these pages.
- `src/_includes/project-card.njk` renders the Projects gallery: each project's `cardImage` at the wide content width, two to a row, with its title in the display serif, its index and year, and `cardSummary` (one line on what the project is) beneath. The year, agency, and roles live in the case study's details. On hover, `scripts/ui/work-cards.js` leans the picture gently toward the pointer; it does the same, more quietly, for the Art gallery's paintings. Projects with a `cardOrder` are pinned first in that order; any without one follow, newest `year` first. The grid has two columns, and three on wide screens once there are six or more projects.
- Each case study is built from its frontmatter and a few components, in the manner of a long-form announcement page. The [layout](src/_includes/layouts/work-case-study.njk) renders, in order: the hero ([case-hero.njk](src/_includes/case-hero.njk)): the recording named by `heroClip` (one of the page's `recordings`, usually the homepage scroll) at the media width, then the project's name (`cardTitle`, the business's own name, which is also the card title and page title) with the project details (agency and year, `projectDetails` with the live site link, `contributors`) stacked under it in the copy column; the `deck` as a large lede; the page's own content; `footnotes`, if any, as a numbered list; and the "All Projects" and live site links. `heroPicture` (`{ image, width, height, alt }`, as for `picture`) leads with a photograph instead, for a project better shown where it was used; the chat app opens on the film's camera monitor. With neither, the hero is the name and details alone. On desktop (a wide window with a mouse or trackpad), the page opens on the hero's recording or picture filling the window, square-cornered with the navigation away, and it settles into its frame as the navigation returns; `case-study.js` plays this once per page, then not again on that page for two days (remembered in `localStorage`), and never for reduced motion or when a page opens mid-scroll. Cards use photographed devices: the DuctWorx phone, the Koch Comm and RIA laptops, and for Golden Mesa (a laptop in a café, from Unsplash) and OKC Innovation District (three phones, an unused studio photograph from the Koch Comm shoot) the site warped onto the screens by the scripts in `scripts/mockups/`. Type: Rethink Sans throughout; Oddball only for the name.
- The page's content wraps each section in `<section class="case-section" id="…">` with `<h2 class="case-heading">Title</h2>`, and puts copy in `.case-copy`, where a paragraph's leading `<strong>` reads as a run-in label. In a `.case-aside` (copy beside a picture) the heading goes inside the `.case-copy`, above its text. Pictures carry no captions. Copy sits in a 40rem reading column; figures and pictures break out to the wider media width.
- [case-figures.njk](src/_includes/case-figures.njk) holds the figure macros, imported with `{% from "case-figures.njk" import gallery, picture, clip, clipRow %}` and fed plain objects from the page's frontmatter: `gallery` (a row of pictures), `picture` (one wide picture), `clip` (a muted, looping recording of the site that plays only while on screen and shows its first frame for reduced motion), and `clipRow` (clips side by side at one height; `narrow` keeps a pair of phone clips to the reading column). Clips are plain screen recordings, no device mockups: a full-site scroll plus short detail loops of real interactions (hovers, tabs, the phone menu). They're made with the scripts in [scripts/clips/](scripts/clips/README.md) and live in `assets/video/<project>/`, with first-frame posters in `assets/images/optimized/<project>/clips/`. Clips carry their poster as `data-poster`, so nothing below the fold loads on arrival; the hero's poster is preloaded at high priority in `head.html`. Every site project uses clips: the homepage scroll leads as the hero, two phone recordings sit side by side in the reading column, then detail loops and a still or two. The pages carry no stats or data charts. Frontmatter keys must not share a macro's name. `.case-aside` sets copy beside a picture; `.case-media` and `.portfolio-wide-media` are wide pictures. Motion is kept to the recordings, the hero's entrance, the reel, and the spread's drift, all still under reduced motion; nothing animates on entry. Footnote references are `<sup class="case-ref"><a href="#note-1">[1]</a></sup>`.
- `scripts/project-images.js` prepares a site project's pictures from its full-page captures: a `-mockup` composite of the desktop capture in a browser window and the phone capture in a phone (no longer used), and `--crops=` offsets of the desktop capture as `-section-n` pictures. It prints the frontmatter values.
- `demos/chatapp/v1/` is the original chat app as used on set. It isn't published; the Film Chat clips are recorded from it with `scripts/clips/chatrec.js` (see that folder's README).
- `assets/images/optimized/` contains the prepared WebP images and JPEG social previews. Eleventy copies this directory as-is.

## CD player

Open **Other Stuff → CD player** to raise one shiny, hand-marked disc already seated beneath a fixed transparent lid. Press play to start Backyard Rain, Michael's own recording of rain outside (`assets/audio/backyard-rain.m4a`, AAC at 40 kbps mono, about 0.9 MB, loaded only on play). The disc is labeled “backyard rain” in marker. Without `data-audio-src`, the player falls back to an original Web Audio wind-and-leaf sound; no third-party samples or streaming embeds are used.

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
