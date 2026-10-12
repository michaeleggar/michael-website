// Local DialKit preview for the site's dark palette.
export function createNavigationColors(DialKit, root) {
  const stylesheet = document.createElement("style");
  stylesheet.dataset.navigationColorTuner = "";
  document.head.append(stylesheet);
  const color = value => ({ type: "color", default: value });
  const group = (text, background, activePill) => ({
    _collapsed: true,
    text: color(text),
    hoverText: color(text),
    hoverPill: color(text.replace(/\)$/, " / 0.06)")),
    activeText: color(background),
    activePill: color(activePill),
    focusRing: color(text),
  });
  const palette = (text, background, surface, divider, rim, activePill) => ({
    _collapsed: true,
    surface: color(surface),
    rim: color(rim),
    divider: color(divider),
    primary: group(text, background, activePill),
    contact: { ...group(text, background, activePill), text: color(activePill) },
  });

  let kit;
  kit = DialKit.createDialKit("Navigation Colors", {
    dark: palette("oklch(92% 0.018 95)", "oklch(23% 0.0046 17.46)",
      "oklch(30.36% 0.0056 56.18)", "oklch(44.709% 0.0089 80.7)", "oklch(100% 0 0)", "oklch(83.952% 0.055 114.97)"),
    divider: {
      visible: true,
      style: {
        type: "select",
        options: [
          { value: "solid", label: "Solid" },
          { value: "dashed", label: "Dashed" },
          { value: "dotted", label: "Dotted" },
          { value: "fade", label: "Faded ends" },
        ],
        default: "solid",
      },
      opacity: [100, 0, 100, 1],
      height: [16, 4, 32, 1],
      thickness: [1, 0.5, 4, 0.5],
      radius: [0, 0, 8, 0.5],
      horizontalOffset: [0, -8, 8, 0.5],
      verticalOffset: [0, -8, 8, 0.5],
    },
    reset: { type: "action", label: "Reset navigation colors" },
  }, {
    id: "michael-navigation-colors-v1",
    persist: true,
    onAction(action) {
      if (action === "reset") kit.resetValues();
    },
  });

  const apply = values => {
    root.element.dataset.theme = "dark";
    const { dark, divider } = values;
    const themed = (key, groupName) => {
      const darkColor = groupName ? dark[groupName][key] : dark[key];
      // Ignore incomplete color entries rather than inserting invalid CSS.
      const valid = value => CSS.supports("color", value) && !/[;{}]/.test(value);
      return valid(darkColor) ? darkColor : "";
    };
    const declarations = (keys, groupName) => keys.map(key => {
      const value = themed(key, groupName);
      return value ? `--nav-${key.replace(/[A-Z]/g, letter => `-${letter.toLowerCase()}`)}: ${value};` : "";
    }).join("\n");
    const groupRules = (selector, groupName) => `
      ${selector} {
        ${declarations(["text", "hoverText", "hoverPill", "activeText", "activePill", "focusRing"], groupName)}
      }
      ${selector} .site-nav-link { color: var(--nav-text); }
      ${selector} .site-nav-link:hover {
        color: var(--nav-hover-text);
        --nav-pill-bg: var(--nav-hover-pill);
      }
      ${selector} .site-nav-link[aria-current="page"] {
        color: var(--nav-active-text);
        --nav-pill-bg: var(--nav-active-pill);
      }
      ${selector} .site-nav-link:focus-visible { outline-color: var(--nav-focus-ring); }
      ${selector} .site-nav-link[aria-current="page"]:focus-visible { outline-color: var(--nav-active-text); }
    `;
    const surface = themed("surface");
    const rim = themed("rim");
    const separator = themed("divider");
    stylesheet.textContent = `
      :root { color-scheme: dark; }
      .site-header-inner {
        ${surface ? `--nav-surface-color: ${surface};` : ""}
        ${rim ? `--nav-rim-color: ${rim};` : ""}
        ${separator ? `--nav-divider-color: ${separator};` : ""}
      }
      ${groupRules(".site-nav-links", "primary")}
      ${groupRules(".site-header-contact", "contact")}
      .site-header-contact::before {
        display: ${divider.visible ? "block" : "none"};
        inset-inline-start: calc(var(--nav-group-gap) / -2 - ${divider.thickness / 2}px + ${divider.horizontalOffset}px);
        top: calc(50% + ${divider.verticalOffset}px);
        height: ${divider.height}px;
        width: ${divider.thickness}px;
        opacity: ${divider.opacity / 100};
        border: 0;
        border-radius: ${divider.radius}px;
        ${divider.style === "fade"
          ? "background: linear-gradient(to bottom, transparent, var(--nav-divider-color) 30%, var(--nav-divider-color) 70%, transparent);"
          : `border-inline-start: ${divider.thickness}px ${divider.style} var(--nav-divider-color);`}
      }
      @media (max-width: 500px) {
        .site-header-contact {
          border-block-start: ${divider.visible ? divider.thickness : 0}px ${divider.style === "fade" ? "solid" : divider.style}
            color-mix(in oklch, var(--nav-divider-color) ${divider.opacity}%, transparent);
        }
        .site-header-contact::before { display: none; }
      }
    `;
  };
  const stop = kit.subscribe(apply);
  return {
    destroy() {
      stop();
      kit.destroy();
      stylesheet.remove();
    },
  };
}
