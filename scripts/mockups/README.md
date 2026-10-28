# Card mockups

How the Golden Mesa and OKC Innovation District cards are made: live pages
put onto the screens of device photographs, so they match the other cards.
OKCID uses an unused studio photograph from the Koch Comm shoot; Golden Mesa
a stock photograph of a laptop in a café.
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

## Laptop (Golden Mesa)

The photograph is a MacBook Air on a café table, from Unsplash
(photo-1781614651982, free to use under the Unsplash License), kept as
`assets/images/goldenmesa/cafe-laptop-unsplash.jpg`.
`node capture.js https://goldenmesa.com/ gm.png 1470 956 0.5` captures the
homepage at the MacBook Air's own size, its hero video held on the sunset
frame, then `node laptop.js cafe-laptop-unsplash.jpg gm.png <out.jpg>` warps it
onto the screen: a perspective fit (`homog.js`) to the four corners of the
bezel, supersampled 4 × 4, with the display's rounded top corners, and the
photo's own notch laid back over the top. Crop the result to the cards'
proportion (3000 × 1888) before `npm run images`.
