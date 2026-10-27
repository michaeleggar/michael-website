// Safari doesn't focus what you tap or click, so when a script then moves
// focus (opening the art viewer, returning from it, landing on a new page)
// Safari takes it for keyboard focus and draws a ring. Track the last input
// instead; styles.css hides those rings while it was a pointer.
const root = document.documentElement;

addEventListener('pointerdown', () => { root.dataset.input = 'pointer'; }, true);
addEventListener('keydown', event => {
  if (event.metaKey || event.ctrlKey || event.altKey) return;
  root.dataset.input = 'keyboard';
}, true);
