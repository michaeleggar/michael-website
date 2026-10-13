(() => {
  const names = ['Ledger', 'Columns', 'Sidebar', 'Inline', 'Card', 'Year stamp'];
  function initializePreview() {
    const root = document.querySelector('[data-details-preview]');
    if (!root || root.hasAttribute('data-preview-ready')) return;
    root.dataset.previewReady = '';
    const tabs = [...root.querySelectorAll('[data-variant-target]')];
    const panels = [...root.querySelectorAll('[data-details-variant]')];
    const status = root.querySelector('[data-preview-status]');
    let active = 0;

    function select(index, { focus = false, updateUrl = true } = {}) {
      if (index < 0 || index >= tabs.length) return;
      active = index;
      panels.forEach((panel, i) => { panel.hidden = i !== index; });
      tabs.forEach((tab, i) => {
        tab.setAttribute('aria-selected', String(i === index));
        tab.tabIndex = i === index ? 0 : -1;
      });
      if (focus) {
        tabs[index].focus({ preventScroll: true });
        tabs[index].scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: 'instant' });
      }
      if (updateUrl) {
        const url = new URL(location.href);
        url.searchParams.set('variant', tabs[index].dataset.variantTarget);
        history.replaceState(history.state, '', url.href);
      }
      status.textContent = `${index + 1} of ${tabs.length}: ${names[index]}`;
    }

    root.addEventListener('click', event => {
      const tab = event.target.closest('[data-variant-target]');
      if (tab && tabs.includes(tab)) select(tabs.indexOf(tab));
    });
    function onKeyDown(event) {
      if (!root.isConnected || event.ctrlKey || event.metaKey || event.altKey) return;
      if (event.target.closest('input, textarea, select, [contenteditable], .elsewhere-menu')) return;
      if (/^[1-6]$/.test(event.key)) {
        event.preventDefault();
        select(Number(event.key) - 1, { focus: true });
      } else if (event.target.closest('.preview-tabs')) {
        const offset = { ArrowLeft: -1, ArrowRight: 1 }[event.key];
        if (offset) {
          event.preventDefault();
          select((active + offset + tabs.length) % tabs.length, { focus: true });
        } else if (event.key === 'Home' || event.key === 'End') {
          event.preventDefault();
          select(event.key === 'Home' ? 0 : tabs.length - 1, { focus: true });
        }
      }
    }
    document.addEventListener('keydown', onKeyDown);
    const requested = new URL(location.href).searchParams.get('variant');
    const index = tabs.findIndex(tab => tab.dataset.variantTarget === requested);
    select(index >= 0 ? index : 0, { updateUrl: false });

    function cleanup() {
      if (root.isConnected) return;
      document.removeEventListener('keydown', onKeyDown);
      document.removeEventListener('site:page-change', cleanup);
    }
    document.addEventListener('site:page-change', cleanup);
  }
  initializePreview();
  document.addEventListener('site:page-change', initializePreview);
})();
