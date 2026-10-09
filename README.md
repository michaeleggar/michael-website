# Michael's website

An Eleventy static site with Nunjucks templates, plain CSS, and a small browser script for the artwork dialog.

## Stylesheets

| File | Owns |
| --- | --- |
| [styles.css](assets/css/styles.css) | Shared fonts, system light/dark themes, design tokens, typography, accessibility, page width, and introductions |
| [header.css](assets/css/header.css) | Site navigation and contact links |
| [portfolio.css](assets/css/portfolio.css) | Homepage name treatment and the Home/Work project grids and cards |
| [case-study.css](assets/css/case-study.css) | Project introductions, details, copy, and images |
| [art.css](assets/css/art.css) | Artwork gallery and image dialog |

Keep each feature's responsive and reduced-motion rules in its own stylesheet. Shared tokens belong in `styles.css`; feature-specific tokens belong beside the component that uses them. The `.page-content` class sets the common content width and gutters.

The [base layout](src/_includes/layouts/base.njk) loads shared styles, then the files listed in the page or layout's `stylesheets` frontmatter. Add browser scripts through the `scripts` frontmatter. Case studies only load CSS in the published site.

## Navigation tuning

During a local Eleventy serve session, add `?dialkit` to any page URL to open Josh Puckett's DialKit panel. For example: `http://localhost:8080/work/ductworx/?dialkit`.

The current site defaults use the finalized solid navigation surface with a subtle rim and shadow, 27px visible pills, and 6px outer insets. These styles live in `assets/css/header.css` and work without the tuning panel. DialKit starts with the same desktop geometry and surface settings; narrower layouts retain their responsive spacing.

**Navigation Colors** switches the whole preview between System, Light, and Dark. Each mode stores its own surface, rim, and divider colors, plus independent text, hover, active-pill, and focus colors for the primary and contact groups. Divider controls include visibility, solid/dashed/dotted/faded styles, opacity, height, thickness, rounding, and position. Color settings combine with Navigation Surface's opacity and lighting controls and remain local to `?dialkit`.

**Navigation** adjusts spacing, visible pill height, typography, and native squircle curvature. **Navigation Surface** explores opacity, blur, saturation, brightness, refraction, chromatic aberration, rim lighting, sheen, and shadow. **Inner Bevel** shares one curved surface between refraction and directional edge lighting: choose Rounded, Squircle, or Soft, then adjust Depth, Highlight, Shade, Light Angle, and Light Spread. **Optics → Edge Width** sets the shared bevel's width. The center stays transparent, independent of the face sheen. Start with the clear, frosted, liquid, or solid presets, then tune the sliders. **Page Edges** adjusts the shared top/bottom progressive blur's height and strength so you can see the material in context. Surface presets preserve geometry and page-edge settings.

Both panels retain values and versions in this browser. Use their reset buttons to return to the defaults configured in `assets/scripts/navigation-tuner.js`, or **Copy parameters** to copy settings for applying to the site. Preview changes do not write source files. The lens uses a simplified Snell refraction model with a refractive index of 1.5, a grazing-angle transmission fade, and a reflection map generated from the same surface normals. RGB dispersion scales with the lens strength. Maps match the rail's dimensions and corners, are cached between parameter changes, and regenerate at most once per animation frame. Labels remain unfiltered. Live SVG backdrop refraction is enabled in Chromium; other engines keep ordinary blur and the bevel lighting. Set Refraction to zero to preview that material without lens distortion. The old decorative inset/width controls are replaced by the shared profile and depth controls.

The vanilla adapter is pinned as a development dependency. Eleventy exposes its JavaScript, CSS, and MIT license only in serve mode; production pages do not load the tuner. The tuning panel also requires a local hostname and the explicit query parameter.

## Content and behavior

- `src/index.html`, `src/work/index.html`, and `src/art/index.html` serve Hey, Work, and Art as separate pages with ordinary navigation links. The homepage has a small redirect for old `/#work` and `/#art` bookmarks; current navigation works without JavaScript.
- `src/work/*/index.html` contains project content and card metadata. Project cards link directly to these pages.
- `src/_includes/project-card.njk` renders both the homepage preview cards and the full Work grid.
- `src/_data/art.json` supplies the artwork gallery through Eleventy's built-in data loading. `assets/scripts/art.js` is loaded only on the Art page and fills and opens its native dialog.
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
