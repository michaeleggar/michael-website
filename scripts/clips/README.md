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
(to warm images and map tiles, then close what was opened), and `resetKey`
presses keys. Targets listed in `late` only exist mid-shot (a calendar's days,
a Clear button) and are measured when the pointer first heads for them; a
`#2` suffix measures the same target again later. A `pin` can be a `sel`
(css) instead of `text`. Details hide the
site's sticky header unless `keepHeader` is set, and `height` gives a taller
window where a section needs it.

## Steps

1. `node slow.js shots/<site>.js` records the scroll shots. Each 30fps frame
   is four sub-frames across a half shutter, blended later into a light motion
   blur (a longer shutter on a fast move smeared and was hard to watch). The
   page runs 16–24 times slower while each sub-frame is taken on schedule,
   and everything on it has to slow together: CSS animations through
   DevTools; the page's videos, paused and stepped to each sub-frame's moment
   (Chrome won't play one slower than 1/16, so left alone they come out sped
   up); and the page's own clock, through a shim `lib.js` installs before
   any of the site's code runs, so timers, `Date.now`, `performance.now`, and
   animation frames all slow too. Without it a carousel or tabs that rotate
   every few seconds (OKCID's People, Ideas, Industries) flip many times a
   second in the clip. The recorder parks no pointer on the page (pointer
   events are off), so nothing shows a hover, and anything that pauses on
   hover plays as it would for a visitor who isn't touching it.

   A shot's `timing` sets its `lead` (the opening hold: 4s on a homepage
   whose hero moves by itself, 2.5s on a still one, less the half second the
   loop's crossfade takes), `move`, and `hold`. Moves follow animations.dev's
   ease-in-out-cubic, firm without whipping through the middle; phones use
   `step: 680` instead of stops, so no move is longer than most of a screen.
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
   H.264 at CRF 28 with Blender's built-in FFmpeg (`encode.py`), moves the
   file's index to the front (`faststart.py`, so playback starts on the first
   bytes; Blender writes it last), writes the first frame as a WebP poster
   (quality 72, at most 1824 wide), and deletes its rendered frames. Full-site
   scrolls render at 1600 × 1000, phones at 524 × 982, and details at most
   1824 wide, the most any of them shows at on a 2x screen. Every `out` size
   must be even in both directions, or the encoder won't start.
5. `node qa.js shots/<site>.js <shot> <max scroll>` checks a recording before
   it ships: for every hold it reports the share of frames where something
   changed (a timer running against the slowed page shows near 100%; a real
   rotation, a short burst every few seconds) and writes a contact sheet with
   a frame every half second. `slow.js` prints the max scroll.
6. `node stills.js <url> "text" ...` captures, at 2x, the full-width section
   holding each text, for detail stills. Where that block isn't the right one,
   `fullpage.js <url> <out>` (the whole page) or `top.js <url> <out>` (its
   first screen) take a 2x capture to crop by hand at a section's edges.
   Optimize the chosen ones with `npm run images`.

## The chat app

Film Chat's clips come from the original app in `demos/chatapp/v1`, served
locally (`python3 -m http.server 4719 --bind 127.0.0.1` in that folder).
`node chatrec.js shots/chatapp.js [name] [--still]` opens the crew panel and
the actor's screen in windows of their own, seeds the opening lines over the
app's BroadcastChannel, and screencasts both while the pointer moves; each
frame then puts the part of each window in use (`region`) on a plain stage,
side by side or stacked (`column`), so `make.sh chatapp-<name>` cuts it like
any other clip. Framing the two apps in one page doesn't work: framed, they
never draw, so a screencast gets nothing and input waits on frames that never
come. Clicks, typing, and right-clicks are dispatched to the element under the
drawn pointer (a select's native list can't be filmed), and the windows' real
pointers follow it for hover states.

`survey.js` films a page's load and a steady scroll into a contact sheet, to
spot which parts of a site move. `record-ductworx.js` and
`record-live-ductworx.js` are the first, DuctWorx-only versions of steps 1–2.
