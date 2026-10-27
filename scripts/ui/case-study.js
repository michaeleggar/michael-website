// Live site showcases: a browser window and a phone that can be dragged anywhere
// on the page by their top bars and resized from their bottom-right corners.
// Positions are tracked in page coordinates, so dragging keeps working while the
// page scrolls, and dragging near the top or bottom of the window scrolls it.

const KEY_STEP = 24;
const MIN_WIDTH = { window: 280, phone: 120 };
const MIN_HEIGHT = 160;
const EDGE = 56; // px from the viewport edge where dragging scrolls the page
const EDGE_SPEED = 14; // px per frame at the very edge

let cleanup = () => {};

function setUp(showcase) {
  const devices = [...showcase.querySelectorAll('[data-showcase-window]')];
  const state = new Map(devices.map(device => [device, { x: 0, y: 0, width: null, height: null }]));
  const listeners = [];
  const on = (target, type, handler, options) => {
    target.addEventListener(type, handler, options);
    listeners.push(() => target.removeEventListener(type, handler, options));
  };

  const keepsAspect = device => device.hasAttribute('data-keep-aspect');
  const pageWidth = () => document.documentElement.clientWidth;

  // Where the device sits on the page without its drag offset.
  function base(device) {
    const rect = device.getBoundingClientRect();
    const { x, y } = state.get(device);
    return { left: rect.left - x, top: rect.top + window.scrollY - y, width: rect.width, height: rect.height };
  }

  function apply(device) {
    const { x, y, width, height } = state.get(device);
    device.style.setProperty('--dx', `${x}px`);
    device.style.setProperty('--dy', `${y}px`);
    device.style.width = width ? `${width}px` : '';
    device.style.height = width && !keepsAspect(device) ? `${height}px` : '';
    device.toggleAttribute('data-moved', Boolean(x || y || width));
  }

  // Keeps the device on the page: fully inside it sideways, and between the
  // top of the page and the page's height when the gesture began.
  function move(device, x, y, pageHeight = document.documentElement.scrollHeight) {
    const box = base(device);
    const s = state.get(device);
    s.x = Math.min(Math.max(x, -box.left), Math.max(-box.left, pageWidth() - box.width - box.left));
    s.y = Math.min(Math.max(y, -box.top), Math.max(-box.top, pageHeight - box.height - box.top));
    apply(device);
  }

  function resize(device, width, height) {
    const box = base(device);
    const s = state.get(device);
    const left = box.left + s.x;
    const kind = keepsAspect(device) ? 'phone' : 'window';
    s.width = Math.min(Math.max(width, MIN_WIDTH[kind]), pageWidth() - left);
    s.height = Math.max(height, MIN_HEIGHT);
    apply(device);
  }

  function reset(device) {
    state.set(device, { x: 0, y: 0, width: null, height: null });
    apply(device);
  }

  function bringToFront(device) {
    for (const other of devices) other.toggleAttribute('data-front', other === device);
  }

  // Runs a pointer gesture, scrolling the page when the pointer nears its edge.
  function gesture(event, handle, update) {
    if (event.button !== 0) return;
    event.preventDefault();
    handle.setPointerCapture(event.pointerId);
    const start = { x: event.clientX, y: event.clientY + window.scrollY };
    const pageHeight = document.documentElement.scrollHeight;
    let pointer = { x: event.clientX, y: event.clientY };
    let frame;
    showcase.setAttribute('data-dragging', '');
    document.documentElement.style.userSelect = 'none';

    const step = () => update(pointer.x - start.x, pointer.y + window.scrollY - start.y, pageHeight);
    const edgeScroll = () => {
      const { innerHeight } = window;
      const speed = pointer.y < EDGE ? -(EDGE - pointer.y) / EDGE : pointer.y > innerHeight - EDGE ? (pointer.y - innerHeight + EDGE) / EDGE : 0;
      if (speed) { window.scrollBy(0, speed * EDGE_SPEED); step(); }
      frame = requestAnimationFrame(edgeScroll);
    };
    frame = requestAnimationFrame(edgeScroll);

    const onMove = moveEvent => { pointer = { x: moveEvent.clientX, y: moveEvent.clientY }; step(); };
    const end = () => {
      cancelAnimationFrame(frame);
      showcase.removeAttribute('data-dragging');
      document.documentElement.style.userSelect = '';
      handle.removeEventListener('pointermove', onMove);
      handle.removeEventListener('pointerup', end);
      handle.removeEventListener('pointercancel', end);
    };
    handle.addEventListener('pointermove', onMove);
    handle.addEventListener('pointerup', end);
    handle.addEventListener('pointercancel', end);
  }

  for (const device of devices) {
    const handle = device.querySelector('[data-drag-handle]');
    const grip = device.querySelector('[data-resize-handle]');
    const resetKey = device.querySelector('[data-showcase-reset]');

    // The key hides once the window is back, so hand focus to the handle.
    if (resetKey) on(resetKey, 'click', () => { reset(device); handle.focus(); });

    on(device, 'pointerdown', () => bringToFront(device));
    on(device, 'focusin', () => bringToFront(device));

    on(handle, 'pointerdown', event => {
      const origin = { ...state.get(device) };
      gesture(event, handle, (dx, dy, pageHeight) => move(device, origin.x + dx, origin.y + dy, pageHeight));
    });
    on(handle, 'dblclick', () => reset(device));
    on(handle, 'keydown', event => {
      if (event.key === 'Home') { event.preventDefault(); reset(device); return; }
      const step = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }[event.key];
      if (!step) return;
      event.preventDefault();
      const amount = event.shiftKey ? KEY_STEP * 4 : KEY_STEP;
      const { x, y } = state.get(device);
      move(device, x + step[0] * amount, y + step[1] * amount);
    });

    on(grip, 'pointerdown', event => {
      const { width, height } = device.getBoundingClientRect();
      gesture(event, grip, (dx, dy) => resize(device, width + dx, height + dy));
    });
    on(grip, 'keydown', event => {
      const step = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }[event.key];
      if (!step) return;
      event.preventDefault();
      const amount = event.shiftKey ? KEY_STEP * 4 : KEY_STEP;
      const { width, height } = device.getBoundingClientRect();
      resize(device, width + step[0] * amount, height + step[1] * amount);
    });
  }

  // A narrower window can strand a moved or resized device off the side.
  on(window, 'resize', () => {
    for (const device of devices) {
      const s = state.get(device);
      if (s.width) resize(device, s.width, s.height);
      if (s.x || s.y) move(device, s.x, s.y);
    }
  });

  return () => listeners.forEach(remove => remove());
}

function initialize() {
  cleanup();
  const showcases = [...document.querySelectorAll('[data-site-showcase]')].map(setUp);
  cleanup = () => showcases.forEach(remove => remove());
}

initialize();
document.addEventListener('site:page-change', initialize);
