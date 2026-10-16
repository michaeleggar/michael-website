// Work page: hovering or focusing a project in the list shows its photograph
// beside it. The last one shown stays until another row takes its place.

let abort;
function initialize() {
  abort?.abort();
  const browser = document.querySelector('.work-browser');
  const preview = browser?.querySelector('.work-preview');
  if (!preview) return;
  abort = new AbortController();
  const images = new Map([...preview.querySelectorAll('[data-work-project]')].map(image => [image.dataset.workProject, image]));

  function show(link) {
    const next = images.get(link.dataset.workProject);
    if (!next || next.hasAttribute('data-active')) return;
    images.forEach(image => image.toggleAttribute('data-active', image === next));
  }

  for (const link of browser.querySelectorAll('.work-index-link')) {
    link.addEventListener('pointerenter', () => show(link), { signal: abort.signal });
    link.addEventListener('focus', () => show(link), { signal: abort.signal });
  }
}

initialize();
document.addEventListener('site:page-change', initialize);
