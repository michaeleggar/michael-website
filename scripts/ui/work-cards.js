import { motionValue, attachFollow, styleEffect } from 'motion-dom';

// Cards lean gently toward the pointer: the frame drifts toward it while the
// picture inside drifts the other way, like looking through a window.
const spring = { type: 'spring', stiffness: 420, damping: 28, mass: 1 };
const groups = [
  // Work cards.
  { card: '.portfolio-project-card a', frame: '.portfolio-project-image', pull: { x: 7, y: 5, rotate: 1.1 }, parallax: 5, scale: 1.04 },
  // Artwork, more quietly, so the gallery stays calm as the pointer crosses it.
  { card: '.art-item button', frame: (card) => card.closest('.art-item'), pull: { x: 3, y: 2, rotate: 0.4 }, parallax: 2, scale: 1.015 },
];

let dispose;
function initializeWorkCards() {
  dispose?.();
  dispose = undefined;
  const finePointer = matchMedia('(hover: hover) and (pointer: fine)');
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const abort = new AbortController();
  const options = { signal: abort.signal };
  const cleanups = [];
  groups.forEach(({ card: cardSelector, frame: frameSelector, pull, parallax, scale }) => {
    document.querySelectorAll(cardSelector).forEach(card => {
      const frame = typeof frameSelector === 'function' ? frameSelector(card) : card.querySelector(frameSelector);
      const image = frame?.querySelector('img');
      if (!frame || !image) return;
      const frameValues = { x: motionValue(0), y: motionValue(0), rotate: motionValue(0) };
      const imageValues = { x: motionValue(0), y: motionValue(0), scale: motionValue(1) };
      const values = [...Object.values(frameValues), ...Object.values(imageValues)];
      const followers = values.map(value => attachFollow(value, value.get(), spring));
      cleanups.push(styleEffect(frame, frameValues), styleEffect(image, imageValues), () => {
        followers.forEach(stop => stop());
        values.forEach(value => value.destroy());
      });
      function settle() {
        frameValues.x.set(0); frameValues.y.set(0); frameValues.rotate.set(0);
        imageValues.x.set(0); imageValues.y.set(0); imageValues.scale.set(1);
      }
      card.addEventListener('pointermove', event => {
        if (event.pointerType !== 'mouse' || !finePointer.matches || reduced.matches) return;
        const rect = frame.getBoundingClientRect();
        const nx = Math.max(-1, Math.min(1, (event.clientX - rect.left - rect.width / 2) / (rect.width / 2)));
        const ny = Math.max(-1, Math.min(1, (event.clientY - rect.top - rect.height / 2) / (rect.height / 2)));
        frameValues.x.set(nx * pull.x);
        frameValues.y.set(ny * pull.y);
        frameValues.rotate.set(nx * pull.rotate);
        imageValues.x.set(-nx * parallax);
        imageValues.y.set(-ny * parallax);
        imageValues.scale.set(scale);
      }, options);
      card.addEventListener('pointerleave', settle, options);
      reduced.addEventListener('change', settle, options);
    });
  });
  dispose = () => { abort.abort(); cleanups.forEach(cleanup => cleanup()); };
}

initializeWorkCards();
document.addEventListener('site:page-change', initializeWorkCards);
