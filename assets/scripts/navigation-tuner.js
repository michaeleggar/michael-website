// DialKit is an opt-in local design tool. Normal navigation needs no JavaScript.
const localHost = ["localhost", "127.0.0.1", "[::1]"].includes(location.hostname);
const tuningEnabled = localHost && new URLSearchParams(location.search).has("dialkit");

if (tuningEnabled) {
  startNavigationTuner().catch(error => {
    console.error("Could not load the navigation tuning panel.", error);
  });
}

function loadStylesheet(href) {
  return new Promise((resolve, reject) => {
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = href;
    link.onload = resolve;
    link.onerror = reject;
    document.head.append(link);
  });
}

async function startNavigationTuner() {
  const nav = document.querySelector(".site-header-inner");
  const primary = nav?.querySelector(".site-nav-links .site-nav-link");
  const contact = nav?.querySelector(".header-contact-link");
  if (!nav || !primary || !contact) return;

  await document.fonts.ready;
  const linkHeight = primary.getBoundingClientRect().height;

  const [DialKit] = await Promise.all([
    import("/assets/scripts/vendor/dialkit.js"),
    loadStylesheet("/assets/css/vendor/dialkit.css"),
  ]);
  const { createNavigationGlass } = await import("/assets/scripts/navigation-glass.js");
  const lens = createNavigationGlass(nav);

  const previewStyle = document.createElement("style");
  previewStyle.dataset.navigationTuner = "";
  document.head.append(previewStyle);
  const surfaceStyle = document.createElement("style");
  surfaceStyle.dataset.navigationSurfaceTuner = "";
  document.head.append(surfaceStyle);

  let kit;
  kit = DialKit.createDialKit("Navigation", {
    spacing: {
      outerInset: [6, 6, 16, 1],
      pillHeight: [27, 24, 34, 1],
      itemGap: [5, 2, 16, 1],
      labelPadding: [11, 4, 24, 1],
      groupGap: [14, 8, 32, 1],
    },
    type: {
      _collapsed: true,
      primarySize: [14, 12, 18, 0.5],
      contactSize: [14, 12, 18, 0.5],
      lineHeight: [1, 0.9, 1.4, 0.05],
      verticalOffset: [1, -3, 3, 0.5],
    },
    corners: {
      _collapsed: true,
      curve: [1.6, 1, 3, 0.1],
      outerRadius: [16, 0, 42, 1],
      pillRadius: [11, 0, 17, 1],
    },
    reset: { type: "action", label: "Reset to site defaults" },
  }, {
    id: "michael-navigation-v1",
    persist: true,
    defaultCollapsed: true,
    onAction(action) {
      if (action === "reset") kit.resetValues();
    },
  });

  const surfacePresets = {
    clear: {
      glass: { opacity: 16, blur: 3, saturation: 130, brightness: 108 },
      optics: { refraction: 16, chromaticAberration: 1.25, edgeWidth: 8 },
      lighting: { rim: 20, sheen: 18, shadow: 16, shadowBlur: 24 },
      innerBevel: { profile: "squircle", depth: 5, highlight: 22, shade: 10, lightAngle: 135, lightSpread: 35 },
    },
    frosted: {
      glass: { opacity: 62, blur: 24, saturation: 120, brightness: 102 },
      optics: { refraction: 8, chromaticAberration: 0, edgeWidth: 10 },
      lighting: { rim: 12, sheen: 12, shadow: 18, shadowBlur: 24 },
      innerBevel: { profile: "soft", depth: 4, highlight: 12, shade: 6, lightAngle: 135, lightSpread: 55 },
    },
    liquid: {
      glass: { opacity: 20, blur: 2, saturation: 155, brightness: 110 },
      optics: { refraction: 24, chromaticAberration: 2.25, edgeWidth: 10 },
      lighting: { rim: 28, sheen: 0, shadow: 20, shadowBlur: 28 },
      innerBevel: { profile: "squircle", depth: 6, highlight: 22, shade: 12, lightAngle: 135, lightSpread: 35 },
    },
    solid: {
      glass: { opacity: 100, blur: 0, saturation: 100, brightness: 100 },
      optics: { refraction: 0, chromaticAberration: 0, edgeWidth: 8 },
      lighting: { rim: 10, sheen: 0, shadow: 24, shadowBlur: 24 },
      innerBevel: { profile: "squircle", depth: 6, highlight: 0, shade: 0, lightAngle: 135, lightSpread: 35 },
    },
  };

  let surfaceKit;
  surfaceKit = DialKit.createDialKit("Navigation Surface", {
    presets: {
      _collapsed: true,
      clear: { type: "action", label: "Clear glass" },
      frosted: { type: "action", label: "Frosted glass" },
      liquid: { type: "action", label: "Liquid glass" },
      solid: { type: "action", label: "Solid surface" },
    },
    glass: {
      opacity: [100, 0, 100, 1],
      blur: [0, 0, 40, 0.5],
      saturation: [100, 0, 220, 5],
      brightness: [100, 70, 130, 1],
    },
    optics: {
      refraction: [0, 0, 40, 1],
      chromaticAberration: [0, 0, 12, 0.25],
      edgeWidth: [8, 2, 20, 1],
    },
    lighting: {
      _collapsed: true,
      rim: [10, 0, 60, 1],
      sheen: [0, 0, 60, 1],
      shadow: [24, 0, 50, 1],
      shadowBlur: [24, 0, 48, 1],
    },
    innerBevel: {
      profile: {
        type: "select",
        options: [
          { value: "rounded", label: "Rounded" },
          { value: "squircle", label: "Squircle" },
          { value: "soft", label: "Soft" },
        ],
        default: "squircle",
      },
      depth: [6, 1, 16, 0.5],
      highlight: [0, 0, 60, 1],
      shade: [0, 0, 40, 1],
      lightAngle: [135, 0, 360, 5],
      lightSpread: [35, 10, 80, 1],
    },
    pageEdges: {
      _collapsed: true,
      height: [100, 40, 180, 5],
      blurStrength: [1, 0, 2, 0.05],
    },
    reset: { type: "action", label: "Reset surface" },
  }, {
    id: "michael-navigation-surface-v1",
    persist: true,
    onAction(action) {
      if (action === "reset") surfaceKit.resetValues();
      const preset = surfacePresets[action.replace("presets.", "")];
      if (preset) surfaceKit.setValues(preset);
    },
  });

  const root = DialKit.createDialRoot({ position: "bottom-right", theme: "system" });
  root.element.dataset.navigationControls = "";
  const { createNavigationColors } = await import("/assets/scripts/navigation-colors.js");
  const colors = createNavigationColors(DialKit, root);

  const stop = kit.subscribe(values => {
    const { spacing, type, corners } = values;
    const hitHeight = Math.max(linkHeight, spacing.pillHeight);
    const pillInset = (hitHeight - spacing.pillHeight) / 2;
    // Equal visible insets, with the links' full hit area still intact.
    const blockPadding = spacing.outerInset - pillInset;
    previewStyle.textContent = `
      .site-header-inner {
        --nav-outer-radius: ${corners.outerRadius}px;
        --nav-item-gap: ${spacing.itemGap}px;
        --nav-item-padding: ${spacing.labelPadding}px;
        --nav-group-gap: ${spacing.groupGap}px;
        --nav-pill-inset: ${pillInset}px;
        padding: ${blockPadding}px ${spacing.outerInset}px;
        border-radius: ${corners.outerRadius}px;
        corner-shape: superellipse(${corners.curve});
      }
      .site-nav-link {
        height: ${hitHeight}px;
        min-height: ${hitHeight}px;
        padding: ${8 + type.verticalOffset}px ${spacing.labelPadding}px ${8 - type.verticalOffset}px;
        font-size: ${type.primarySize}px;
        line-height: ${type.lineHeight};
        border-radius: ${corners.pillRadius}px;
        corner-shape: superellipse(${corners.curve});
      }
      .header-contact-link { font-size: ${type.contactSize}px; }
    `;
    lens.setShape(corners);
  });

  const stopSurface = surfaceKit.subscribe(values => {
    const { glass, optics, lighting, innerBevel, pageEdges } = values;
    lens.setOptics(optics, innerBevel);
    const backdrop = `blur(${glass.blur}px) saturate(${glass.saturation}%) brightness(${glass.brightness}%)`;
    const refractedBackdrop = `${backdrop} ${lens.url}`;
    const useLens = lens.supported && optics.refraction !== 0;
    surfaceStyle.textContent = `
      .site-header-inner {
        --nav-glass-rim-color: color-mix(in srgb, var(--nav-rim-color, light-dark(black, white)) ${lighting.rim}%, transparent);
        position: relative;
        background: color-mix(in oklch, var(--nav-surface-color, var(--accent-three)) ${glass.opacity}%, transparent);
        -webkit-backdrop-filter: ${backdrop};
        backdrop-filter: ${backdrop};
        box-shadow:
          inset 0 0 0 1px var(--nav-glass-rim-color),
          inset 0 1px 0 rgb(255 255 255 / ${lighting.sheen / 100}),
          inset 0 -1px 0 rgb(255 255 255 / ${lighting.sheen / 400}),
          0 2px 4px rgb(0 0 0 / ${lighting.shadow / 200}),
          0 8px ${lighting.shadowBlur}px -8px rgb(0 0 0 / ${lighting.shadow / 100});
      }
      ${useLens ? `@supports (backdrop-filter: url("#navigation-glass-lens")) {
        .site-header-inner { backdrop-filter: ${refractedBackdrop}; }
      }` : ""}
      /* This reflection map uses the same curved surface as the lens.
         It has a transparent center and stays beneath the labels. */
      .site-header-inner::before {
        content: "";
        position: absolute;
        inset: 0;
        border-radius: inherit;
        corner-shape: inherit;
        background-image: var(--nav-bevel-light);
        background-size: 100% 100%;
        background-repeat: no-repeat;
        pointer-events: none;
      }
      .site-header-inner::after {
        content: "";
        position: absolute;
        inset: 0;
        border-radius: inherit;
        corner-shape: inherit;
        background: linear-gradient(160deg,
          rgb(255 255 255 / ${lighting.sheen / 200}),
          rgb(255 255 255 / ${lighting.sheen / 1200}) 45%,
          transparent 60%,
          rgb(255 255 255 / ${lighting.sheen / 800}));
        pointer-events: none;
      }
      .site-header-inner > nav,
      .site-header-contact { position: relative; z-index: 1; }
      /* Keep the material visible even with both tuning panels expanded. */
      [data-navigation-controls] .dialkit-panel-inner:not([data-collapsed="true"]) {
        max-height: calc(100dvh - 112px) !important;
      }
      .site-edge-blur { height: ${pageEdges.height}px; }
      .site-edge-blur-layer {
        -webkit-backdrop-filter: blur(calc(var(--blur-radius) * ${pageEdges.blurStrength}));
        backdrop-filter: blur(calc(var(--blur-radius) * ${pageEdges.blurStrength}));
      }
      @supports (backdrop-filter: blur(1px)) {
        .page-content { padding-block-end: max(var(--space-xl), ${pageEdges.height}px); }
      }
      @supports not ((backdrop-filter: blur(1px)) or (-webkit-backdrop-filter: blur(1px))) {
        .site-header-inner { background: var(--nav-surface-color, var(--accent-three)); }
      }
    `;
  });

  // Keep the tuning mode while following the site's ordinary internal links.
  document.querySelectorAll('a[href^="/"]').forEach(link => {
    const url = new URL(link.getAttribute("href"), location);
    url.searchParams.set("dialkit", "");
    link.href = url.pathname + url.search + url.hash;
  });

  window.addEventListener("pagehide", event => {
    if (event.persisted) return;
    stop();
    stopSurface();
    kit.destroy();
    surfaceKit.destroy();
    colors.destroy();
    root.destroy();
    lens.destroy();
    previewStyle.remove();
    surfaceStyle.remove();
  }, { once: true });
}
