// Local controls for case-study image scale. Omitted from production builds.
const selector = '.portfolio-case-study';
if (['localhost', '127.0.0.1', '[::1]'].includes(location.hostname)) {
  let starting = false;
  async function initialize() {
    if (starting || !document.querySelector(selector)) return;
    starting = true;
    try { await startWorkImageTuner(); }
    catch (error) { starting = false; console.error('Could not load image controls.', error); }
  }
  initialize();
  document.addEventListener('site:page-change', initialize);
}

async function startWorkImageTuner() {
  const [DialKit] = await Promise.all([
    import('/assets/scripts/vendor/dialkit.js'),
    new Promise((resolve, reject) => {
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = '/assets/css/vendor/dialkit.css';
      link.onload = resolve;
      link.onerror = reject;
      document.head.append(link);
    }),
  ]);
  const config = {
    extraInsetPerSide: [0, 0, 80, 1],
    holdAtStart: false,
    startingWidth: {
      _collapsed: true,
      desktopPercent: [60, 60, 100, 1],
      mobilePercent: [90, 60, 100, 1],
    },
    exportCss: { type: 'action', label: 'Export image CSS' },
    reset: { type: 'action', label: 'Reset to current design' },
  };
  function cssFor(values, preview = false) {
    const css = `${selector} {
  --work-media-start-scale: ${values.startingWidth.desktopPercent / 100};
  --work-media-start-inset: ${values.extraInsetPerSide}px;
}
@media (max-width: 780px) {
  ${selector} { --work-media-start-scale: ${values.startingWidth.mobilePercent / 100}; }
}
`;
    // Freeze just the first image for tuning; exported CSS retains the scroll animation.
    return css + (preview && values.holdAtStart ? `@media (prefers-reduced-motion: no-preference) {
  ${selector} .portfolio-first-media img {
    animation: none;
    transform: scale(var(--work-media-start-scale));
    transform: scale(calc(var(--work-media-start-scale) - 2 * var(--work-media-start-inset) / 100vw));
    clip-path: inset(0 round calc(var(--border-radius) + 2px));
  }
}
` : '');
  }
  const previewStyle = document.createElement('style');
  previewStyle.dataset.workImageOverrides = '';
  const panelStyle = document.createElement('style');
  panelStyle.textContent = '[data-work-image-controls] .dialkit-panel-inner:not([data-collapsed="true"]) { max-height: calc(100dvh - 100px) !important; }';
  document.head.append(previewStyle, panelStyle);
  const root = DialKit.createDialRoot({ position: 'bottom-right', theme: 'dark', defaultOpen: true });
  root.element.dataset.workImageControls = '';
  let kit;
  kit = DialKit.createDialKit('Work · Image Size', config, {
    id: 'michael-work-image-size-v1',
    persist: true,
    defaultCollapsed: false,
    onAction(name) {
      if (name === 'reset') kit.resetValues();
      if (name === 'exportCss') {
        const url = URL.createObjectURL(new Blob([cssFor(kit.getValues())], { type: 'text/css' }));
        const link = document.createElement('a');
        link.href = url;
        link.download = 'work-image-size.css';
        link.click();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
      }
    },
  });
  const stop = kit.subscribe(values => { previewStyle.textContent = cssFor(values, true); });
  function syncPage() { root.element.style.display = document.querySelector(selector) ? '' : 'none'; }
  syncPage();
  document.addEventListener('site:page-change', syncPage);
  window.addEventListener('pagehide', event => {
    if (event.persisted) return;
    stop(); kit.destroy(); root.destroy(); previewStyle.remove(); panelStyle.remove();
    document.removeEventListener('site:page-change', syncPage);
  });
}
