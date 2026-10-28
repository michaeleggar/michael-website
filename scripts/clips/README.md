# Site clips

How the project recordings (`assets/video/<project>/`) and detail stills are
made. They're plain screen recordings of the live sites: the homepage scroll
that leads each case study, two phone scrolls shown as a pair, short detail
loops of real interactions, and a still or two of single sections. No device
mockups.

Work in a folder outside the repo with `puppeteer-core` installed into
`tools/` (`npm i --prefix tools puppeteer-core`), and copy these scripts and
`shots/` into it. Frames are large and never belong in git. Everything drives
the installed Chrome.

## Shot files

`shots/<site>.js` describes a site: its `scroll` shots (stops as fractions of
the page's scroll range) and its `details` (a pinned position, a pointer path
through targets, timed clicks). Every detail ends where it starts, so it loops.
Targets are `rest:x,y` (viewport fractions), `text:Label`, `in:Scope text|Label`,
`sel:Scope text|css`, or `sel:|css@Exact text`. `reveal` opens menus before
targets are measured; `reset`/`resetSel` click things once before recording
(to warm images and map tiles, then close what was opened). Details hide the
site's sticky header unless `keepHeader` is set, and `height` gives a taller
window where a section needs it.

## Steps

1. `node slow.js shots/<site>.js` records the scroll shots. Each 30fps frame
   is four sub-frames across the shutter, blended later into motion blur; the
   page's CSS animations and videos run 16–24 times slower while each
   sub-frame is taken on schedule. A shot's `timing` sets its `lead` (the hold
   on the first stop: 2.8s for the homepage scrolls, since they lead the page
   and the loop's crossfade eats half a second of it), `move`, and `hold`.
   The scroll stops two pixels short of the bottom, where a fractional page
   height can show a sliver of the root background.
2. `node live.js shots/<site>.js` records the details in real time with
   Chrome's screencast at 2x, because carousels, tabs, menus, and maps are
   scripted, and slowing only the CSS would put them out of step.
   `lib.js` opens each page ready to record: real input releases scripts that
   wait for a visitor, cookie banners, popups, chat and accessibility widgets,
   and back-to-top buttons are hidden, sliders paused, everything below the
   fold loaded. (It matches CookieYes by its `cky-` prefix; a bare `cky` also
   matches Elementor's `sticky` and hid Koch Comm's header.) Where a site's
   smooth-scroll script undoes `scrollTo`, the pin falls back to the wheel.
   Pick a `pin` text that appears once: a menu link with the same words wins
   otherwise.
3. Crops are set in `clips.js` in CSS pixels. Crop a detail at its section's
   own edges, full width, so the space around it is the site's own padding;
   on a plain page background, use the content's bounds with equal margins on
   all sides; end a long grid mid-card so it reads as continuing.
   `sections.js` finds a section's edges, `autocrop.js` and `gaps.js` measure
   content bounds and blank rows, and `sheet.js` makes contact sheets.
4. `./make.sh <site>-<name> ...` cuts each clip (blend, pointer, crop, a
   crossfade from the tail into the opening so the loop has no seam), encodes
   H.264 with Blender's built-in FFmpeg (`encode.py`, CRF `LOW`), and writes
   the first frame as the poster. Full-site scrolls render at 1600 × 1000 and
   phones at 524 × 982, which is all their on-page size needs. Every `out` size
   must be even in both directions, or the encoder won't start.
5. `node stills.js <url> "text" ...` captures, at 2x, the full-width section
   holding each text, for detail stills; optimize the chosen ones with
   `npm run images`.

`survey.js` films a page's load and a steady scroll into a contact sheet, to
spot which parts of a site move. `record-ductworx.js` and
`record-live-ductworx.js` are the first, DuctWorx-only versions of steps 1–2.
