// Local preview controls. This module is omitted from production builds.
const selector = '[data-work-spacing-preview]';
if (['localhost', '127.0.0.1', '[::1]'].includes(location.hostname)) {
  let starting = false;
  async function initialize() {
    if (starting || !document.querySelector(selector)) return;
    starting = true;
    try { await startWorkSpacingTuner(); }
    catch (error) { starting = false; console.error('Could not load work spacing controls.', error); }
  }
  initialize();
  document.addEventListener('site:page-change', initialize);
}

async function startWorkSpacingTuner() {
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
    pageGaps: {
      headerToLinks: [32, 0, 96, 1],
      linksToIntro: [32, 0, 96, 1],
      titleToDescription: [8, 0, 32, 1],
      introToInfo: [48, 0, 96, 1],
      infoToImage: [48, 0, 96, 1],
    },
    infoTable: {
      rowPadding: [10, 0, 32, 1],
      columnGap: [32, 8, 80, 1],
      dividerExtension: [16, 0, 40, 1],
      contributorGap: [6, 0, 24, 1],
    },
    categoryTags: {
      _collapsed: true,
      verticalPadding: [3, 0, 12, 0.5],
      horizontalPadding: [7, 0, 20, 0.5],
    },
    layout: {
      _collapsed: true,
      contentWidth: [550, 320, 900, 10],
      pageGutter: [40, 8, 80, 1],
      mobileGutter: [16, 8, 40, 1],
      mobileDividerExtension: [4, 0, 16, 1],
    },
    linkSpacing: {
      _collapsed: true,
      iconGap: [7.2, 0, 20, 0.2],
      horizontalPadding: [11.5, 0, 24, 0.5],
    },
    exportCss: { type: 'action', label: 'Export spacing CSS' },
    reset: { type: 'action', label: 'Reset to current design' },
  };
  function cssFor(values) {
    const { pageGaps: gaps, infoTable: table, categoryTags: tags, layout, linkSpacing: links } = values;
    // One overhang value drives both axes; the divider remains centered in the column gap.
    return `${selector} {
  --content-width: ${layout.contentWidth}px;
  --page-gutter: ${layout.pageGutter}px;
  --project-details-overhang: min(${table.dividerExtension}px, var(--page-gutter));
  padding-block-start: ${gaps.headerToLinks}px;
}
${selector} .portfolio-project-intro { margin-block-start: ${gaps.linksToIntro}px; }
${selector} .portfolio-project-intro h1 { margin-block-end: ${gaps.titleToDescription}px; }
${selector} .project-details {
  --project-details-column-gap: ${table.columnGap}px;
  margin-block-start: ${gaps.introToInfo}px;
}
${selector} .project-details > div { padding-block: ${table.rowPadding}px; }
${selector} .project-credit-list { gap: ${table.contributorGap}px; }
${selector} .project-details dt { padding: ${tags.verticalPadding}px ${tags.horizontalPadding}px; }
${selector} .portfolio-first-media { margin-block-start: ${gaps.infoToImage}px; }
${selector} .project-nav-link {
  gap: ${links.iconGap}px;
  padding-inline: ${links.horizontalPadding}px;
}
@media (max-width: 780px) {
  ${selector} {
    --page-gutter: ${layout.mobileGutter}px;
    --project-details-overhang: min(${layout.mobileDividerExtension}px, var(--page-gutter));
  }
}
`;
  }
  const previewStyle = document.createElement('style');
  previewStyle.dataset.workSpacingOverrides = '';
  const panelStyle = document.createElement('style');
  panelStyle.textContent = '[data-work-spacing-controls] .dialkit-panel-inner:not([data-collapsed="true"]) { max-height: calc(100dvh - 100px) !important; }';
  document.head.append(previewStyle, panelStyle);
  const root = DialKit.createDialRoot({ position: 'bottom-right', theme: 'dark', defaultOpen: true });
  root.element.dataset.workSpacingControls = '';
  let kit;
  kit = DialKit.createDialKit('Work · Spacing', config, {
    id: 'michael-work-spacing-v2',
    persist: true,
    defaultCollapsed: false,
    onAction(name) {
      if (name === 'reset') kit.resetValues();
      if (name === 'exportCss') {
        const url = URL.createObjectURL(new Blob([cssFor(kit.getValues())], { type: 'text/css' }));
        const link = document.createElement('a');
        link.href = url;
        link.download = 'work-page-spacing.css';
        link.click();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
      }
    },
  });
  const stop = kit.subscribe(values => { previewStyle.textContent = cssFor(values); });
  function syncPage() { root.element.style.display = document.querySelector(selector) ? '' : 'none'; }
  syncPage();
  document.addEventListener('site:page-change', syncPage);
  window.addEventListener('pagehide', event => {
    if (event.persisted) return;
    stop(); kit.destroy(); root.destroy(); previewStyle.remove(); panelStyle.remove();
    document.removeEventListener('site:page-change', syncPage);
  });
}
