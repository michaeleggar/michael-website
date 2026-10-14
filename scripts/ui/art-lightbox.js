function initializeGallery() {
  const gallery = document.getElementById('art-gallery');
  const modal = document.getElementById('art-modal');
  if (!gallery || !modal || gallery.hasAttribute('data-initialized')) return;
  gallery.dataset.initialized = '';
  // After client-side navigation the inline reveal script doesn't run, so mark loaded images here too.
  for (const thumbnail of gallery.querySelectorAll('img')) {
    const reveal = () => thumbnail.setAttribute('data-loaded', '');
    if (thumbnail.complete) reveal();
    else {
      thumbnail.addEventListener('load', reveal, { once: true });
      thumbnail.addEventListener('error', reveal, { once: true });
    }
  }
  gallery.setAttribute('data-reveal', '');
  const galleryPath = location.pathname;
  const artworks = [...gallery.querySelectorAll('button[data-modal-src]')];
  const image = modal.querySelector('#modal-img');
  const title = modal.querySelector('#modal-title');
  const details = modal.querySelector('#modal-details');
  const close = modal.querySelector('.modal-close');
  const previous = modal.querySelector('.modal-previous');
  const next = modal.querySelector('.modal-next');
  const content = modal.querySelector('.modal-content');
  const header = modal.querySelector('.modal-header');
  const browser = modal.querySelector('.modal-browser');
  const navigation = modal.querySelector('.modal-navigation');
  const status = modal.querySelector('[data-art-viewer-status]');
  const count = modal.querySelector('[data-art-viewer-count]');
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
  let active = 0;
  let request = 0;
  let opener;
  let transition;
  let touchStart;

  function updateArtworkUrl(button) {
    if (!gallery.isConnected || location.pathname !== galleryPath || modal.hasAttribute('data-art-tuning-preview')) return;
    const url = new URL(location.href);
    url.hash = button?.id || '';
    history.replaceState(history.state, '', url.href);
  }

  function fitArtwork() {
    if (!modal.open || !image.naturalWidth || !image.naturalHeight) return;
    const ratio = image.naturalWidth / image.naturalHeight;
    const imageHeightLimit = parseFloat(getComputedStyle(image).maxHeight);
    const availableHeight = Math.max(0, Math.min(imageHeightLimit, browser.getBoundingClientRect().height));
    const width = Math.min(content.clientWidth, availableHeight * ratio);
    image.style.width = `${width}px`;
    image.style.height = `${width / ratio}px`;
  }
  const observer = new ResizeObserver(fitArtwork);
  observer.observe(browser);
  observer.observe(header);
  observer.observe(navigation);
  image.addEventListener('load', fitArtwork);

  function neighbor(button, index) {
    const data = artworks[index]?.dataset;
    const label = `${button === previous ? 'Previous' : 'Next'} artwork`;
    button.disabled = !data;
    button.setAttribute('aria-label', data ? `${label}: ${data.title}` : label);
  }

  async function showArtwork(index, { instant = false } = {}) {
    if (index < 0 || index >= artworks.length) return;
    const direction = index >= active ? 1 : -1;
    active = index;
    const version = ++request;
    const data = artworks[index].dataset;
    updateArtworkUrl(artworks[index]);
    neighbor(previous, index - 1);
    neighbor(next, index + 1);
    count.textContent = `${index + 1} / ${artworks.length}`;
    status.textContent = `Loading ${data.title}…`;
    const loaded = new Image();
    loaded.src = data.modalSrc;
    try { await loaded.decode(); }
    catch {
      if (version === request) status.textContent = `Could not load ${data.title}. Try another artwork.`;
      return;
    }
    if (version !== request || !modal.open) return;
    transition?.cancel();
    image.src = data.modalSrc;
    image.alt = data.alt || data.title || '';
    title.textContent = data.title || 'Artwork';
    details.textContent = [data.year, data.medium, data.dimensions].filter(Boolean).join(' / ');
    details.hidden = !details.textContent;
    fitArtwork();
    if (!instant && !reducedMotion.matches) {
      transition = image.animate([
        { opacity: 0.65, transform: `translateX(${direction * 8}px)` },
        { opacity: 1, transform: 'translateX(0)' },
      ], { duration: 180, easing: 'cubic-bezier(0.19, 1, 0.22, 1)' });
    }
    status.textContent = `${index + 1} of ${artworks.length}: ${data.title}`;
  }

  function openArtwork(button, preview = false) {
    opener = preview ? null : button;
    if (!preview) button.focus({ preventScroll: true });
    if (modal.open) modal.close();
    if (preview) {
      modal.dataset.artTuningPreview = '';
      modal.show();
    } else {
      delete modal.dataset.artTuningPreview;
      document.documentElement.style.overflow = 'hidden';
      modal.showModal();
      close.focus();
    }
    showArtwork(artworks.indexOf(button), { instant: true });
  }
  gallery.addEventListener('click', event => {
    const button = event.target.closest('button[data-modal-src]');
    if (button && artworks.includes(button)) openArtwork(button);
  });
  previous.addEventListener('click', () => showArtwork(active - 1));
  next.addEventListener('click', () => showArtwork(active + 1));
  close.addEventListener('click', () => modal.close());
  modal.addEventListener('click', event => {
    const content = event.target.closest('#modal-img, #modal-title, #modal-details, button, .modal-count');
    if (!content) modal.close();
  });
  modal.addEventListener('keydown', event => {
    if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
    event.preventDefault();
    showArtwork(active + (event.key === 'ArrowRight' ? 1 : -1), { instant: true });
  });
  image.addEventListener('touchstart', event => {
    const touch = event.changedTouches[0];
    touchStart = { x: touch.clientX, y: touch.clientY };
  }, { passive: true });
  image.addEventListener('touchend', event => {
    if (!touchStart) return;
    const touch = event.changedTouches[0];
    const dx = touch.clientX - touchStart.x;
    const dy = touch.clientY - touchStart.y;
    touchStart = null;
    if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) * 1.5) showArtwork(active + (dx < 0 ? 1 : -1));
  }, { passive: true });
  modal.addEventListener('close', () => {
    if (modal.open) return;
    request++;
    transition?.cancel();
    const preview = modal.hasAttribute('data-art-tuning-preview');
    delete modal.dataset.artTuningPreview;
    if (!document.querySelector('dialog[open]')) document.documentElement.style.overflow = '';
    image.removeAttribute('src');
    if (!preview) updateArtworkUrl();
    if (gallery.isConnected) opener?.focus({ preventScroll: true });
  });
  function onPreview() {
    if (modal.open) modal.close();
    else openArtwork(artworks[active] || artworks[0], true);
  }
  modal.addEventListener('art:preview', onPreview);
  function openFromUrl() {
    if (!gallery.isConnected || location.pathname !== galleryPath) return;
    let slug;
    try { slug = decodeURIComponent(location.hash.slice(1)); } catch { return; }
    const button = artworks.find(artwork => artwork.id === slug);
    if (button) {
      if (!modal.open) openArtwork(button);
      else if (artworks[active] !== button) showArtwork(artworks.indexOf(button), { instant: true });
    } else if (modal.open) modal.close();
  }
  window.addEventListener('hashchange', openFromUrl);
  openFromUrl();
  function cleanup() {
    if (gallery.isConnected) return;
    request++;
    observer.disconnect();
    transition?.cancel();
    image.removeEventListener('load', fitArtwork);
    window.removeEventListener('hashchange', openFromUrl);
    document.removeEventListener('site:page-change', cleanup);
  }
  document.addEventListener('site:page-change', cleanup);
}

initializeGallery();
document.addEventListener('site:page-change', initializeGallery);
