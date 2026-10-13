const localHost = ['localhost', '127.0.0.1', '[::1]'].includes(location.hostname);
if (localHost) startTypeTuner().catch(error => console.error('Could not load type and spacing controls.', error));

async function startTypeTuner() {
  const [DialKit] = await Promise.all([
    import('/assets/scripts/vendor/dialkit.js'),
    new Promise((resolve, reject) => {
      const link = document.createElement('link');
      link.rel = 'stylesheet'; link.href = '/assets/css/vendor/dialkit.css';
      link.onload = resolve; link.onerror = reject; document.head.append(link);
    }),
  ]);
  const config = {
    typography: {
      '--home-title-size': [16, 14, 40, 0.5],
      '--type-base': [16, 12, 22, 0.5],
      '--nav-font-size': [14, 11, 20, 0.5],
      '--type-meta': [13, 10, 18, 0.5],
      '--home-title-tracking': [3.2, 0, 8, 0.1],
    },
    contentSpacing: {
      '--paragraph-gap': [19, 0, 48],
      '--section-gap': [12, 12, 96],
      '--space-sm': [12, 4, 40],
    },
    layout: {
      _collapsed: true,
      '--content-width': [550, 400, 900, 10],
      '--page-gutter': [40, 8, 80],
      '--page-top-space': [52, 16, 120],
    },
    navigation: {
      '--nav-height': [33, 24, 48],
      '--nav-padding-inline': [11.5, 4, 24, 0.5],
      '--nav-gap': [10, 0, 24],
      '--nav-pill-inset': [3.5, 0, 8, 0.5],
    },
    submenu: {
      _collapsed: true,
      '--other-menu-padding': [6, 0, 20],
      '--other-menu-gap': [6, 0, 24],
      '--other-menu-min-width': [168, 140, 280, 2],
    },
    caption: {
      _collapsed: true,
      '--showcase-label-size': [13, 10, 20, 0.5],
      '--showcase-detail-size': [11, 9, 16, 0.5],
      '--showcase-label-gap': [12, 0, 40],
    },
    advanced: {
      _collapsed: true,
      '--line-body': [1.5, 1.2, 2, 0.05],
      '--line-snug': [1.45, 1.1, 1.8, 0.05],
      '--home-title-line': [1.55, 1, 2, 0.05],
      '--type-sm': [15, 12, 22, 0.5],
      '--control-radius': [11, 0, 24],
      '--surface-radius': [12, 0, 24],
      '--header-top-space': [16, 0, 48],
    },
    exportCss: { type: 'action', label: 'Export homepage CSS' },
    reset: { type: 'action', label: 'Reset to site defaults' },
  };
  const unitless = new Set(['--line-body', '--line-snug', '--home-title-line']);
  function declarations(values) {
    return Object.entries(values).filter(([name]) => name.startsWith('--')).map(([name, value]) => `  ${name}: ${value}${unitless.has(name) ? '' : 'px'};`).join('\n');
  }
  function cssFor(values) {
    const shared = Object.assign({}, values.typography, values.contentSpacing, values.layout, values.navigation, values.submenu, values.advanced);
    delete shared['--nav-pill-inset'];
    return `:root {\n${declarations(shared)}\n}\n.site-header-group {\n${declarations({ '--nav-pill-inset': values.navigation['--nav-pill-inset'] })}\n}\n.home-showcase {\n${declarations(values.caption).replaceAll(';', ' !important;')}\n}\n@media (max-width: 780px) {\n  :root { --page-gutter: 16px; }\n}`;
  }
  const previewStyle = document.createElement('style');
  const panelStyle = document.createElement('style');
  panelStyle.textContent = '[data-type-controls] .dialkit-panel-inner:not([data-collapsed="true"]) { max-height: calc(100dvh - 100px) !important; }';
  document.head.append(previewStyle, panelStyle);
  const root = DialKit.createDialRoot({ position: 'bottom-right', theme: 'dark', defaultOpen: true });
  root.element.dataset.typeControls = '';
  let kit;
  kit = DialKit.createDialKit('Homepage · Type & Spacing', config, {
    id: 'michael-home-type-spacing-v2', persist: { presets: true }, defaultCollapsed: false,
    onAction(name) {
      if (name === 'reset') kit.resetValues();
      if (name === 'exportCss') {
        const url = URL.createObjectURL(new Blob([cssFor(kit.getValues())], { type: 'text/css' }));
        const link = document.createElement('a'); link.href = url; link.download = 'homepage-type-spacing.css'; link.click();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
      }
    },
  });
  const stop = kit.subscribe(values => { previewStyle.textContent = cssFor(values); });
  function syncPage() { root.element.style.display = document.querySelector('.portfolio-home-title') ? '' : 'none'; }
  syncPage(); document.addEventListener('site:page-change', syncPage);
  window.addEventListener('pagehide', event => {
    if (event.persisted) return;
    stop(); kit.destroy(); root.destroy(); previewStyle.remove(); panelStyle.remove();
    document.removeEventListener('site:page-change', syncPage);
  });
}
