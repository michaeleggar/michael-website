# Card mockups

How the Golden Mesa and OKC Innovation District cards are made: live pages
put onto the screens of two studio photographs from the Koch Comm and RIA
shoots that the site doesn't otherwise use, so they match the other cards.
Originals land in `assets/images/<project>/`; prepare them with
`npm run images -- <original> <project>/<name> --social`.

Run these from the clips work folder (see [../clips/README.md](../clips/README.md)),
with this folder copied in as `mockups/`; they use its `lib.js` and puppeteer.

## Three phones (OKCID)

`node screens.js okcid` renders each phone's screen at 393 × 852, 3x: a status
bar in the page's own top colour, the live page at a scroll position, and
Safari's bottom toolbar. The pages and scroll positions are listed at the top
of the script. `node phones.js <out.jpg> a.png b.png c.png` drops them into
`kc-website-2.jpg`. The phones there face the camera square on, so each screen
is a resize into the bezel (x 198, 612, 1022; y 176; 279 × 604) with a 44px
corner radius.

## Tablet (Golden Mesa)

`node capture-tablet.js https://goldenmesa.com/ gm.png 0.5` captures the page,
then `node tablet.js gm.png <out.jpg>` warps it onto `ria-tablet.jpg`. The
tablet is at an angle, so the screen is a perspective fit (`homog.js`): its
top corners and sides are fitted to the bezel, and its foreshortening comes
from the top of the navy band across the original screenshot, which sits 512px
down RIA's resources page at 1180px wide. The capture is scaled to that width,
supersampled 4 × 4, with the display's rounded top corners carried through the
perspective.
