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
  const rootCss = getComputedStyle(document.documentElement);
  const rem = parseFloat(rootCss.fontSize);
  function current(name, scope = document.documentElement) {
    const value = getComputedStyle(scope).getPropertyValue(name).trim();
    return parseFloat(value) * (value.endsWith('rem') ? rem : 1);
  }
  const slider = (name, min, max, step = 1, scope) => [current(name, scope), min, max, step];
  const caption = document.querySelector('.home-showcase');
  const config = {
    typography: {
      '--home-title-size': slider('--home-title-size', 14, 40, 0.5),
      '--type-base': slider('--type-base', 12, 22, 0.5),
      '--nav-font-size': slider('--nav-font-size', 11, 20, 0.5),
      '--type-meta': slider('--type-meta', 10, 18, 0.5),
      '--home-title-tracking': slider('--home-title-tracking', 0, 8, 0.1),
    },
    contentSpacing: {
      '--paragraph-gap': slider('--paragraph-gap', 0, 48),
      '--section-gap': slider('--section-gap', 12, 96),
      '--space-sm': slider('--space-sm', 4, 40),
    },
    layout: {
      _collapsed: true,
      '--content-width': slider('--content-width', 400, 900, 10),
      '--page-gutter': [40, 8, 80],
      '--page-top-space': slider('--page-top-space', 16, 120),
    },
    navigation: {
      '--nav-height': slider('--nav-height', 24, 48),
      '--nav-padding-inline': slider('--nav-padding-inline', 4, 24, 0.5),
      '--nav-gap': slider('--nav-gap', 0, 24),
      '--nav-pill-inset': slider('--nav-pill-inset', 0, 8, 0.5, document.querySelector('.site-header-group')),
    },
    submenu: {
      _collapsed: true,
      '--other-menu-padding': slider('--other-menu-padding', 0, 20),
      '--other-menu-gap': slider('--other-menu-gap', 0, 24),
      '--other-menu-min-width': slider('--other-menu-min-width', 140, 280, 2),
    },
    caption: {
      _collapsed: true,
      '--showcase-label-size': caption ? slider('--showcase-label-size', 10, 20, 0.5, caption) : [13, 10, 20, 0.5],
      '--showcase-detail-size': caption ? slider('--showcase-detail-size', 9, 16, 0.5, caption) : [11, 9, 16, 0.5],
      '--showcase-label-gap': caption ? slider('--showcase-label-gap', 0, 40, 1, caption) : [12, 0, 40],
    },
    advanced: {
      _collapsed: true,
      '--line-body': slider('--line-body', 1.2, 2, 0.05),
      '--line-snug': slider('--line-snug', 1.1, 1.8, 0.05),
      '--home-title-line': slider('--home-title-line', 1, 2, 0.05),
      '--type-sm': slider('--type-sm', 12, 22, 0.5),
      '--control-radius': slider('--control-radius', 0, 24),
      '--surface-radius': slider('--surface-radius', 0, 24),
      '--header-top-space': slider('--header-top-space', 0, 48),
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
