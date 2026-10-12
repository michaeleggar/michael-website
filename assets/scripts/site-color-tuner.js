// A separate color-only preview avoids the navigation material tuner's overrides.
const localHost = ["localhost", "127.0.0.1", "[::1]"].includes(location.hostname);
if (localHost && (new URLSearchParams(location.search).has("colors") || location.pathname === "/palette/")) {
  startColorTuner().catch(error => console.error("Could not load the site color controls.", error));
}

async function startColorTuner() {
  const [DialKit, { createSiteColors }] = await Promise.all([
    import("/assets/scripts/vendor/dialkit.js"),
    import("/assets/scripts/site-colors.js"),
    new Promise((resolve, reject) => {
      const link = document.createElement("link");
      link.rel = "stylesheet";
      link.href = "/assets/css/vendor/dialkit.css";
      link.onload = resolve;
      link.onerror = () => reject(new Error("DialKit stylesheet failed to load"));
      document.head.append(link);
    }),
  ]);
  let mount = document.querySelector("[data-palette-controls]");
  const createRoot = () => DialKit.createDialRoot({ position: "bottom-right", theme: "dark", defaultOpen: true,
    ...(mount ? { mode: "inline", target: mount } : {}) });
  let root = createRoot();
  const colors = createSiteColors(DialKit, root);
  const tuneExample = event => {
    const example = event.target.closest("[data-color-tune]");
    if (example) colors.tune(example.dataset.colorTune);
  };
  document.addEventListener("click", tuneExample);

  // Keep the color panel available after ordinary navigation and refreshes.
  const preserveMode = () => {
    document.querySelectorAll('a[href^="/"]').forEach(link => {
      if (link.hasAttribute("download")) return;
      const url = new URL(link.getAttribute("href"), location);
      if (url.origin !== location.origin) return;
      url.searchParams.set("colors", "");
      link.href = url.pathname + url.search + url.hash;
    });
  };
  preserveMode();
  const onPageChange = () => {
    preserveMode();
    const nextMount = document.querySelector("[data-palette-controls]");
    if (nextMount !== mount) {
      root.destroy();
      mount = nextMount;
      root = createRoot();
      colors.setRoot(root);
    }
  };
  document.addEventListener("site:page-change", onPageChange);

  window.addEventListener("pagehide", event => {
    if (event.persisted) return;
    document.removeEventListener("site:page-change", onPageChange);
    document.removeEventListener("click", tuneExample);
    colors.destroy();
    root.destroy();
  }, { once: true });
}
