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
| [case-study.css](assets/css/case-study.css) | Case studies: the hero with its title and details, the lede, recorded clips of the site, pictures, the framed chat demo, footnotes, and the project links again at the end |
| [chat-demo.css](assets/css/chat-demo.css) | The chat app case study's live demo |
| [art.css](assets/css/art.css) | Artwork gallery and image dialog |

Keep each feature's responsive and reduced-motion rules in its own stylesheet. Shared tokens belong in `styles.css`; feature-specific tokens belong beside the component that uses them. The `.page-content` class sets the common content width and gutters.

The [base layout](src/_includes/layouts/base.njk) loads shared styles, then the files listed in the page or layout's `stylesheets` frontmatter. Add browser scripts through the `scripts` frontmatter.

## Design tokens

Shared colors, typography, spacing, widths, and corner radii live in `assets/css/styles.css`. `--font-display` is Rowan, from Indian Type Foundry's Fontshare, used for case-study titles and ledes and for project card titles; section headings and copy stay in Lato. Rowan loads from Fontshare's servers through the stylesheet link in `head.html`, not from `assets/fonts`: its free license allows self-hosting but not redistribution, and this repository is public. `--hairline` and `--panel` frame the case-study figures. Page gutters adapt on smaller screens; navigation keeps its typography and tightens its spacing on phones so every label fits on one row. The Elsewhere and Other Stuff menus are built by `scripts/ui/contact-menu.js`; their bloom is a CSS transition in `header.css`, using an easing sampled from a framer-motion spring.

## Browser scripts

Sources in `scripts/ui/` are bundled by `scripts/bundle-scripts.js` into `assets/scripts/`: `site.js` (the homepage fan and the project and art card hover), `contact-menu.js` (the header menus), `art-lightbox.js`, `case-study.js` (hero picture dots and clips that play while on screen), and `chat-demo.js` (the chat app demo). Each is self-contained. Run `npm run bundle` after changing a source; dev and production builds also bundle automatically. The generated files are ignored by Git. `ambient-player.js` and `page-navigation.js` are hand-written and served as-is.

## Content and behavior

- `src/index.html`, `src/projects/index.html`, and `src/art/index.html` serve Hey, Projects, and Art as separate pages with ordinary navigation links, which work without JavaScript. The section was called Work until October 2026; `vercel.json` permanently redirects `/work/…` to `/projects/…`, and `page-navigation.js` still forwards old `/#work` and `/#art` bookmarks from the homepage. Internal names (`work-case-study.njk`, `work-*.njk`, the `workProjects` collection, `.work-page`) keep the old word.
- `src/projects/*/index.html` contains project content and card metadata. Project cards link directly to these pages.
- `src/_includes/project-card.njk` renders the Projects gallery: each project's `cardImage` at the wide content width, two to a row, with its title in the display serif, its index and year, and `cardSummary` (one line on what the project is) beneath. The year, agency, and roles live in the case study's details. On hover, `scripts/ui/work-cards.js` leans the picture gently toward the pointer; it does the same, more quietly, for the Art gallery's paintings. Projects with a `cardOrder` are pinned first in that order; any without one follow, newest `year` first. The grid has two columns, and three on wide screens once there are six or more projects.
- Each case study is built from its frontmatter and a few components, in the manner of a long-form announcement page. The [layout](src/_includes/layouts/work-case-study.njk) renders, in order: the hero ([case-hero.njk](src/_includes/case-hero.njk)), which runs under the sticky header to the top of the page with the lead picture edge to edge, the "All Projects" and live site links, the project's name (`cardTitle`, the business's own name, which is also the card title and page title) in the serif, and the project details under it (agency and year, `projectDetails`, `contributors`), the name and details set in the copy column so they line up with the text below; the `deck` as a serif lede; the page's own content; `footnotes`, if any, as a numbered list; and the "All Projects" and live site links again. `heroFrames`, a list of pictures, replaces `heroImage` with several and adds dots beside the date to switch between them; `heroFocus` sets the picture's focal point and `heroCaption` a small line beside the dots, both above the title. With neither, the hero is type alone. Hero and card pictures are photography from the client's own site (originals kept in `assets/images/<project>/`), never the client's licensed stock, and never the browser-and-phone mockup composites (the photographed devices for DuctWorx, Koch Comm, and RIA are fine for cards); on phones the picture takes the top of the hero and fades out above the title. Type: the serif for the hero title and the lede; Lato for section headings and copy; Oddball only for the name.
- The page's content wraps each section in `<section class="case-section" id="…">` with `<h2 class="case-heading">Title</h2>`, and puts copy in `.case-copy`, where a paragraph's leading `<strong>` reads as a run-in label. In a `.case-aside` (copy beside a picture) the heading goes inside the `.case-copy`, above its text. Pictures carry no captions. Copy sits in a 40rem reading column; figures and pictures break out to the wider media width.
- [case-figures.njk](src/_includes/case-figures.njk) holds the figure macros, imported with `{% from "case-figures.njk" import gallery, picture, clip, clipRow %}` and fed plain objects from the page's frontmatter: `gallery` (a row of pictures), `picture` (one wide picture), `clip` (a muted, looping recording of the site that plays only while on screen and shows its first frame for reduced motion), and `clipRow` (clips side by side at one height; `narrow` keeps a pair of phone clips to the reading column). Clips are plain screen recordings, no device mockups: a full-site scroll plus short detail loops of real interactions (hovers, tabs, the phone menu). They're made with the scripts in [scripts/clips/](scripts/clips/README.md) and live in `assets/video/<project>/`, with first-frame posters in `assets/images/optimized/<project>/clips/`. Every site project uses clips: a full-site desktop scroll beside a phone scroll, then two detail loops, then a still or two. The pages carry no stats or data charts. Frontmatter keys must not share a macro's name. `.case-aside` sets copy beside a picture; `.case-media` and `.portfolio-wide-media` are wide pictures. Motion is kept to the hero's crossfade, the reel, and the spread's drift, all still under reduced motion; nothing animates on entry. Footnote references are `<sup class="case-ref"><a href="#note-1">[1]</a></sup>`.
- `scripts/project-images.js` prepares a site project's pictures from its full-page captures: a `-mockup` composite of the desktop capture in a browser window and the phone capture in a phone (used only for social images now), and `--crops=` offsets of the desktop capture as `-section-n` pictures. It prints the frontmatter values.
- `demos/chatapp/` holds static builds of both chat app versions, copied to `/projects/chatapp/demo/`. The case study's `chat-demo.njk` is a framed figure with the version tabs in its title row: the actor's screen as a live iframe, laid out at 960 × 600 and scaled to fit (phones get the app's small-screen layout, at least 420px wide), beside the crew's cue sheet in the page's own surface. The cue window speaks to the app through `bridge.js`, which the chat-app build publishes beside the demos: each cue shows its character typing and then sends the line; Back to one clears the chat and replays `demoScene.opening`. The app and its painting load once the page is idle (or as soon as the demo nears the window), so booting it never interrupts scrolling, and the page stays where the visitor put it when the app focuses its composer. The first cue plays by itself once the demo is in view, unless reduced motion is on. The version buttons swap between the original and the rebuild, and the control panel link opens that version's real control panel, which stays in sync. Rebuild the demos from the chat-app repo with `npm run build:demo`; `check-build.js` skips them because they're standalone pages without site metadata.
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
