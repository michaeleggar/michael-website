# Site clips

How the project recordings (`assets/video/<project>/`) and detail stills are
made. They're plain screen recordings of the live sites: a full-site desktop
scroll beside a phone scroll, short detail loops of real interactions, and a
still or two of single sections. No device mockups.

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
   sub-frame is taken on schedule.
2. `node live.js shots/<site>.js` records the details in real time with
   Chrome's screencast at 2x, because carousels, tabs, menus, and maps are
   scripted, and slowing only the CSS would put them out of step.
   `lib.js` opens each page ready to record: real input releases scripts that
   wait for a visitor, cookie banners, popups, chat and accessibility widgets,
   and back-to-top buttons are hidden, sliders paused, everything below the
   fold loaded.
3. Crops are set in `clips.js` in CSS pixels. Crop a detail at its section's
   own edges, full width, so the space around it is the site's own padding;
   on a plain page background, use the content's bounds with equal margins on
   all sides; end a long grid mid-card so it reads as continuing.
   `sections.js` finds a section's edges, `autocrop.js` and `gaps.js` measure
   content bounds and blank rows, and `sheet.js` makes contact sheets.
4. `./make.sh <site>-<name> ...` cuts each clip (blend, pointer, crop, a
   crossfade from the tail into the opening so the loop has no seam), encodes
   H.264 with Blender's built-in FFmpeg (`encode.py`, CRF `LOW`), and writes
   the first frame as the poster. Full-site scrolls are then downsized to
   1600 wide and phones to 524, which is all their on-page size needs.
5. `node stills.js` captures single sections at 2x for detail stills; optimize
   the chosen ones with `npm run images`.

`survey.js` films a page's load and a steady scroll into a contact sheet, to
spot which parts of a site move. `record-ductworx.js` and
`record-live-ductworx.js` are the first, DuctWorx-only versions of steps 1–2.
