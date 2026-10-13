const localHost = ['localhost', '127.0.0.1', '[::1]'].includes(location.hostname);
if (localHost) {
  let starting = false;
  async function initialize() {
    if (starting || !document.querySelector('.art-page')) return;
    starting = true;
    try { await startArtTuner(); }
    catch (error) { starting = false; console.error('Could not load art controls.', error); }
  }
  initialize();
  document.addEventListener('site:page-change', initialize);
}

async function startArtTuner() {
  const [DialKit] = await Promise.all([
    import('/assets/scripts/vendor/dialkit.js'),
    new Promise((resolve, reject) => {
      const link = document.createElement('link');
      link.rel = 'stylesheet'; link.href = '/assets/css/vendor/dialkit.css';
      link.onload = resolve; link.onerror = reject; document.head.append(link);
    }),
  ]);
  const page = document.querySelector('.art-page');
  if (!page) throw new Error('Art page changed while controls were loading.');
  const action = label => ({ type: 'action', label });
  const config = {
    layout: {
      mode: { type: 'select', options: ['masonry', 'grid'], default: 'masonry' },
      '--art-content-width': [1040, 300, 1600, 10],
      '--art-columns': [4, 1, 6, 1],
      '--art-column-gap': [16, 0, 64, 1],
      '--art-row-gap': [16, 0, 64, 1],
      '--art-page-gutter': [40, 8, 100, 1],
      '--art-top-space': [30, 0, 160, 1],
      '--art-section-gap': [0, 0, 80, 1],
      '--art-bottom-space': [48, 0, 160, 1],
    },
    images: {
      _collapsed: true,
      '--art-image-ratio': { type: 'select', options: [
        { value: 'auto', label: 'Original proportions' },
        { value: '1 / 1', label: 'Square' },
        { value: '4 / 3', label: 'Landscape · 4:3' },
        { value: '3 / 4', label: 'Portrait · 3:4' },
        { value: '16 / 9', label: 'Wide · 16:9' },
      ], default: 'auto' },
      '--art-image-fit': { type: 'select', options: ['cover', 'contain'], default: 'cover' },
      '--art-card-radius': [6, 0, 48, 1],
      '--art-image-padding': [0, 0, 32, 1],
    },
    mobile: {
      _collapsed: true,
      '--art-mobile-columns': [2, 1, 4, 1],
      '--art-mobile-gutter': [16, 8, 40, 1],
      '--art-mobile-top-scale': [1, 0, 3, 0.05],
    },
    viewer: {
      _collapsed: true,
      '--art-dialog-width': [80, 40, 98, 1],
      '--art-dialog-height': [80, 40, 98, 1],
      '--art-viewer-image-height': [80, 20, 85, 1],
      '--art-viewer-image-radius': [1, 0, 40, 1],
      '--art-close-gap': [16, 0, 48, 1],
    },
    caption: {
      _collapsed: true,
      '--art-title-size': [15, 12, 28, 0.5],
      '--art-detail-size': [13, 10, 22, 0.5],
      '--art-caption-line': [1.5, 1.1, 2, 0.05],
      '--art-caption-padding': [24, 0, 48, 1],
      '--art-caption-gap': [32, 0, 64, 1],
    },
    navigation: {
      _collapsed: true,
      '--nav-font-size': [14, 11, 20, 0.5],
      '--nav-height': [33, 24, 48, 1],
      '--nav-padding-inline': [11.5, 4, 24, 0.5],
      '--nav-gap': [10, 0, 24, 1],
      '--nav-pill-inset': [3.5, 0, 8, 0.5],
    },
    preview: action('Preview / close artwork viewer'),
    exportCss: action('Export art page CSS'),
    reset: action('Reset to art page defaults'),
  };
  const unitless = new Set([
    '--art-columns', '--art-mobile-columns', '--art-mobile-top-scale', '--art-caption-line',
    '--art-dialog-width', '--art-dialog-height', '--art-viewer-image-height',
  ]);
  function declarations(values) {
    return Object.entries(values).filter(([name]) => name.startsWith('--')).map(([name, val]) => {
      const unit = typeof val === 'number' && !unitless.has(name) ? 'px' : '';
      return `  ${name}: ${val}${unit};`;
    }).join('\n');
  }
  function cssFor(values) {
    const variables = Object.assign({}, values.layout, values.images, values.mobile, values.viewer, values.caption);
    const grid = values.layout.mode === 'grid';
    const navigation = { ...values.navigation };
    delete navigation['--nav-pill-inset'];
    return `.art-page {\n${declarations(variables)}\n}\n` +
      `.art-page .art-masonry {\n  display: ${grid ? 'grid' : 'block'};\n  columns: ${grid ? 'auto' : 'var(--art-columns)'};\n  grid-template-columns: repeat(var(--art-columns), minmax(0, 1fr));\n  gap: var(--art-row-gap) var(--art-column-gap);\n  align-items: start;\n}\n` +
      `.art-page .art-item { margin-bottom: ${grid ? '0' : 'var(--art-row-gap)'}; }\n` +
      `:root:has(.art-page) {\n${declarations(navigation)}\n}\n` +
      `body:has(.art-page) .site-header-group {\n${declarations({ '--nav-pill-inset': values.navigation['--nav-pill-inset'] })}\n}\n` +
      `@media (max-width: 780px) {\n  .art-page {\n    --art-columns: var(--art-mobile-columns);\n    --art-page-gutter: var(--art-mobile-gutter);\n  }\n}`;
  }
  const previewStyle = document.createElement('style');
  const panelStyle = document.createElement('style');
  panelStyle.textContent = '[data-art-controls] .dialkit-panel-inner:not([data-collapsed="true"]) { max-height: calc(100dvh - 100px) !important; }\n.art-page #art-modal[data-art-tuning-preview] { position: fixed; inset: 0; z-index: 9998; }';
  document.head.append(previewStyle, panelStyle);
  const root = DialKit.createDialRoot({ position: 'bottom-right', theme: 'dark', defaultOpen: true });
  root.element.dataset.artControls = '';
  let kit;
  function closePreview() {
    const modal = document.querySelector('.art-page #art-modal[data-art-tuning-preview]');
    if (modal?.open) modal.close();
  }
  function togglePreview() {
    const modal = document.querySelector('.art-page #art-modal');
    if (!modal) return;
    modal.dispatchEvent(new Event('art:preview'));
  }
  kit = DialKit.createDialKit('Art · Layout & Type', config, {
    id: 'michael-art-layout-type-v1', persist: { presets: true }, defaultCollapsed: false,
    onAction(name) {
      if (name === 'preview') togglePreview();
      if (name === 'reset') { closePreview(); kit.resetValues(); }
      if (name === 'exportCss') {
        const url = URL.createObjectURL(new Blob([cssFor(kit.getValues())], { type: 'text/css' }));
        const link = document.createElement('a'); link.href = url; link.download = 'art-page-settings.css'; link.click();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
      }
    },
  });
  const stop = kit.subscribe(values => { previewStyle.textContent = cssFor(values); });
  function syncPage() { root.element.style.display = document.querySelector('.art-page') ? '' : 'none'; }
  function onGalleryClick(event) {
    if (event.target.closest('.art-page button[data-modal-src]')) closePreview();
  }
  function onKeyDown(event) { if (event.key === 'Escape') closePreview(); }
  syncPage();
  document.addEventListener('site:page-change', syncPage);
  document.addEventListener('click', onGalleryClick, true);
  document.addEventListener('keydown', onKeyDown);
  window.addEventListener('pagehide', event => {
    if (event.persisted) return;
    stop(); kit.destroy(); root.destroy(); previewStyle.remove(); panelStyle.remove();
    document.removeEventListener('site:page-change', syncPage);
    document.removeEventListener('click', onGalleryClick, true);
    document.removeEventListener('keydown', onKeyDown);
  });
}
