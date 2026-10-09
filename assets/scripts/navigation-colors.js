// Local DialKit preview; palettes stay independent when switching modes.
export function createNavigationColors(DialKit, root) {
  const stylesheet = document.createElement("style");
  stylesheet.dataset.navigationColorTuner = "";
  document.head.append(stylesheet);
  const systemTheme = matchMedia("(prefers-color-scheme: light)");
  const color = value => ({ type: "color", default: value });
  const group = (text, background) => ({
    _collapsed: true,
    text: color(text),
    hoverText: color(text),
    hoverPill: color(text.replace(/\)$/, " / 0.06)")),
    activeText: color(background),
    activePill: color(text),
    focusRing: color(text),
  });
  const palette = (text, background, surface, divider, rim) => ({
    _collapsed: true,
    surface: color(surface),
    rim: color(rim),
    divider: color(divider),
    primary: group(text, background),
    contact: group(text, background),
  });

  let kit;
  kit = DialKit.createDialKit("Navigation Colors", {
    mode: {
      type: "select",
      options: [
        { value: "system", label: "System" },
        { value: "light", label: "Light" },
        { value: "dark", label: "Dark" },
      ],
      default: "system",
    },
    light: palette("oklch(20% 0.006 34)", "oklch(99.668% 0.0054 95.1)",
      "oklch(94.5% 0.008 96)", "oklch(82.305% 0.0099 93.59)", "#000000"),
    dark: palette("oklch(92% 0.018 95)", "oklch(23% 0.0046 17.46)",
      "oklch(30.36% 0.0056 56.18)", "oklch(44.709% 0.0089 80.7)", "#ffffff"),
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
    const mode = values.mode === "system" ? (systemTheme.matches ? "light" : "dark") : values.mode;
    root.element.dataset.theme = mode;
    const { light, dark, divider } = values;
    const themed = (key, groupName) => {
      const lightColor = groupName ? light[groupName][key] : light[key];
      const darkColor = groupName ? dark[groupName][key] : dark[key];
      // Ignore incomplete color entries rather than inserting invalid CSS.
      const valid = value => CSS.supports("color", value) && !/[;{}]/.test(value);
      return valid(lightColor) && valid(darkColor) ? `light-dark(${lightColor}, ${darkColor})` : "";
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
      :root { color-scheme: ${mode}; }
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
      @media (max-width: 359px) {
        .site-header-contact {
          border-block-start: ${divider.visible ? divider.thickness : 0}px ${divider.style === "fade" ? "solid" : divider.style}
            color-mix(in srgb, var(--nav-divider-color) ${divider.opacity}%, transparent);
        }
        .site-header-contact::before { display: none; }
      }
    `;
  };
  const stop = kit.subscribe(apply);
  const onSystemThemeChange = () => apply(kit.getValues());
  systemTheme.addEventListener("change", onSystemThemeChange);
  return {
    destroy() {
      stop();
      systemTheme.removeEventListener("change", onSystemThemeChange);
      kit.destroy();
      stylesheet.remove();
    },
  };
}
