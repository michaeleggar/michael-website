// Tune only the colors the site uses; shared roles remain CSS aliases.
export function createSiteColors(DialKit, root) {
  const definitions = [
    ["accent", "--active"],
    ["pageBackground", "--bg"],
    ["linksAndFocus", "--primary"],
    ["surface", "--accent-three"],
    ["primaryText", "--text-primary"],
    ["secondaryText", "--text-secondary"],
    ["mutedText", "--text-muted"],
    ["dividersAndUnderlines", "--text-underline"],
    ["artBackdrop", "--modal-backdrop"],
  ];
  const computed = getComputedStyle(document.documentElement);
  const defaults = new Map();
  const config = {};
  for (const [key, token] of definitions) {
    const match = computed.getPropertyValue(token).trim().match(/^oklch\(\s*([\d.]+)(%)?\s+([\d.]+)\s+([\d.]+)(?:deg)?(?:\s*\/\s*([\d.]+)(%)?)?\s*\)$/i);
    if (!match) throw new Error(`Expected an OKLCH default for ${token}`);
    const channels = {
      lightness: Number(match[1]) * (match[2] ? 1 : 100),
      chroma: Number(match[3]),
      hue: Number(match[4]),
      opacity: match[5] === undefined ? 100 : Number(match[5]) * (match[6] ? 1 : 100),
    };
    defaults.set(key, channels);
    config[key] = {
      _collapsed: key !== "accent",
      lightness: [channels.lightness, 0, 100, 0.001],
      chroma: [channels.chroma, 0, 0.4, 0.0001],
      hue: [channels.hue, 0, 360, 0.01],
      ...(key === "artBackdrop" ? { opacity: [channels.opacity, 0, 100, 1] } : {}),
    };
  }
  config.exportCss = { type: "action", label: "Export OKLCH CSS" };
  config.reset = { type: "action", label: "Reset palette to site defaults" };
  const stylesheet = document.createElement("style");
  stylesheet.dataset.siteColorTuner = "";
  document.head.append(stylesheet);
  const markRoot = nextRoot => {
    root = nextRoot;
    root.element.dataset.siteColorControls = "";
    root.element.dataset.theme = "dark";
  };
  markRoot(root);
  const number = (value, fallback, max) => {
    const parsed = Number(value);
    return Number(Math.min(max, Math.max(0, Number.isFinite(parsed) ? parsed : fallback)).toFixed(5));
  };
  const paletteCss = values => {
    const declarations = definitions.map(([key, token]) => {
      const original = defaults.get(key);
      const channels = values[key];
      const lightness = number(channels.lightness, original.lightness, 100);
      const chroma = number(channels.chroma, original.chroma, 0.4);
      const hue = number(channels.hue, original.hue, 360);
      const alpha = key === "artBackdrop" ? ` / ${number(channels.opacity, original.opacity, 100) / 100}` : "";
      return `  ${token}: oklch(${lightness}% ${chroma} ${hue}${alpha});`;
    });
    return `:root {\n${declarations.join("\n")}\n  --primary-hover: var(--active);\n  --modal-close: var(--primary);\n  color-scheme: dark;\n}\n`;
  };
  let kit;
  kit = DialKit.createDialKit("Site Colors · OKLCH", config, {
    id: "michael-site-colors-oklch-v1", persist: true, defaultCollapsed: false,
    onAction(action) {
      if (action === "reset") kit.resetValues();
      if (action === "exportCss") {
        const url = URL.createObjectURL(new Blob([paletteCss(kit.getValues())], { type: "text/css" }));
        const link = document.createElement("a");
        link.href = url;
        link.download = "michael-site-palette.css";
        document.body.append(link);
        link.click();
        link.remove();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
      }
    },
  });
  // Preserve existing tuned colors when moving away from the management view.
  try {
    if (!localStorage.getItem("michael-palette-simple-migrated-v1")) {
      const previous = JSON.parse(localStorage.getItem("michael-site-palette-structure-v1"));
      if (previous?.cache) {
        const updates = {};
        for (const [key] of definitions) {
          let source = key;
          const seen = new Set();
          while (previous.aliases?.[source] && !seen.has(source)) {
            seen.add(source);
            source = previous.aliases[source];
          }
          const channels = previous.cache[source];
          if (!channels) continue;
          const original = defaults.get(key);
          updates[key] = {
            lightness: number(channels.lightness, original.lightness, 100),
            chroma: number(channels.chroma, original.chroma, 0.4),
            hue: number(channels.hue, original.hue, 360),
            ...(key === "artBackdrop" ? { opacity: number(channels.opacity, original.opacity, 100) } : {}),
          };
        }
        kit.setValues(updates);
      }
      localStorage.setItem("michael-palette-simple-migrated-v1", "true");
    }
  } catch { /* Tuning works even if storage is unavailable. */ }
  const stop = kit.subscribe(values => {
    stylesheet.textContent = paletteCss(values) + `
      [data-site-color-controls] .dialkit-panel-inner:not([data-collapsed="true"]) { max-height: calc(100dvh - 112px) !important; }
    `;
  });
  return {
    setRoot: markRoot,
    tune(key) {
      kit.setOpen(true);
      const title = key.replace(/([A-Z])/g, " $1").replace(/^./, letter => letter.toUpperCase());
      const folder = [...root.element.querySelectorAll('[role="button"][aria-label]')].find(element => element.getAttribute("aria-label") === title);
      if (folder?.getAttribute("aria-expanded") === "false") folder.click();
      folder?.focus({ preventScroll: true });
      folder?.scrollIntoView({ block: "nearest" });
    },
    destroy() { stop(); kit.destroy(); stylesheet.remove(); },
  };
}
