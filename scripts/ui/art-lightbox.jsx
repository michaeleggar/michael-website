import React from 'react';
import { createRoot } from 'react-dom/client';
import { Stepper } from 'pasito/react';

function initializeGallery() {
  const gallery = document.getElementById('art-gallery');
  const modal = document.getElementById('art-modal');
  if (!gallery || !modal || gallery.dataset.initialized) return;
  gallery.dataset.initialized = '';
  const artworks = [...gallery.querySelectorAll('button[data-modal-src]')];
  const image = modal.querySelector('#modal-img');
  const title = modal.querySelector('#modal-title');
  const details = modal.querySelector('#modal-details');
  const close = modal.querySelector('.modal-close');
  const previous = modal.querySelector('.modal-previous');
  const next = modal.querySelector('.modal-next');
  const status = modal.querySelector('[data-art-viewer-status]');
  const pagination = createRoot(modal.querySelector('.modal-pagination'));
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
  let active = 0;
  let request = 0;
  let opener;
  let transition;
  let touchStart;

  function alignCaption() {
    if (!modal.open || !image.naturalWidth || !image.naturalHeight) return;
    const box = image.getBoundingClientRect();
    const width = Math.min(box.width, box.height * image.naturalWidth / image.naturalHeight);
    modal.style.setProperty('--art-caption-width', `${width}px`);
  }
  const observer = new ResizeObserver(alignCaption);
  observer.observe(image);
  image.addEventListener('load', alignCaption);

  function neighbor(button, index) {
    const data = artworks[index]?.dataset;
    button.disabled = !data;
    button.querySelector('img').hidden = !data;
    if (!data) return;
    button.querySelector('img').src = data.modalSrc.replace('-large.webp', '-thumb.webp');
    button.setAttribute('aria-label', `${button === previous ? 'Previous' : 'Next'} artwork: ${data.title}`);
  }

  function renderStepper(instant) {
    pagination.render(<Stepper count={artworks.length} active={active} maxVisible={7}
      transitionDuration={instant || reducedMotion.matches ? 0 : 180}
      onStepClick={index => showArtwork(index)} className="art-stepper" />);
  }

  async function showArtwork(index, { instant = false } = {}) {
    if (index < 0 || index >= artworks.length) return;
    const direction = index >= active ? 1 : -1;
    active = index;
    const version = ++request;
    const data = artworks[index].dataset;
    neighbor(previous, index - 1);
    neighbor(next, index + 1);
    renderStepper(instant);
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
    alignCaption();
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
    if (event.target === modal || event.target.classList.contains('modal-browser')) modal.close();
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
    delete modal.dataset.artTuningPreview;
    document.documentElement.style.overflow = '';
    image.removeAttribute('src');
    opener?.focus({ preventScroll: true });
  });
  function onPreview() {
    if (modal.open) modal.close();
    else openArtwork(artworks[active] || artworks[0], true);
  }
  modal.addEventListener('art:preview', onPreview);
  function cleanup() {
    if (gallery.isConnected) return;
    request++;
    observer.disconnect();
    pagination.unmount();
    transition?.cancel();
    image.removeEventListener('load', alignCaption);
    document.removeEventListener('site:page-change', cleanup);
  }
  document.addEventListener('site:page-change', cleanup);
}

initializeGallery();
document.addEventListener('site:page-change', initializeGallery);
