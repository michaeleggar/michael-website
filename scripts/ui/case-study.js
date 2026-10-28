// Clips, the hero's recording among them, load as they near the screen and
// play only while on it.
let cleanupPage = () => {};

// The entrance: on desktop, the hero's recording (or picture) opens filling
// the window, then settles into its frame. It is drawn at its place in the
// layout and scaled up from there, so nothing on the page moves when it
// lands. Each page plays it once, then not again for two days.
const ENTRANCE_HOLD = 450;
const ENTRANCE_MS = 1000;
const ENTRANCE_EASE = 'cubic-bezier(0.7, 0, 0.2, 1)';
const ENTRANCE_AGAIN_AFTER = 2 * 24 * 60 * 60 * 1000;
const entranceKey = () => `case-entrance:${location.pathname}`;

function enteredRecently() {
  try { return Date.now() - Number(localStorage.getItem(entranceKey()) || 0) < ENTRANCE_AGAIN_AFTER; } catch { return false; }
}

function enter(disposers) {
  const screen = document.querySelector('.case-hero-screen');
  const media = screen?.querySelector('video, img');
  if (!media || enteredRecently()) return;
  if (!matchMedia('(min-width: 64rem) and (hover: hover) and (pointer: fine)').matches) return;
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const root = document.documentElement;
  // Page coordinates: on a swap between pages the old page's scroll still
  // stands at this moment; the new one opens at the top.
  const box = screen.getBoundingClientRect();
  const left = box.left, top = box.top + scrollY;
  const scale = root.clientWidth / box.width;
  const reset = () => {
    delete root.dataset.heroEntrance;
    for (const el of [screen, media]) el.style.removeProperty('transition');
    screen.style.removeProperty('transform');
    screen.style.removeProperty('transform-origin');
    media.style.removeProperty('border-radius');
    media.style.removeProperty('box-shadow');
  };
  root.dataset.heroEntrance = 'start';
  screen.style.transformOrigin = '0 0';
  screen.style.transform = `translate(${-left}px, ${-top}px) scale(${scale})`;
  media.style.borderRadius = '0';
  media.style.boxShadow = 'none';
  let timer = 0;
  // By the next frame the page has its final scroll; only enter from the top.
  const frame = requestAnimationFrame(() => {
    if (scrollY > 4) { reset(); return; }
    try { localStorage.setItem(entranceKey(), String(Date.now())); } catch {}
    timer = setTimeout(() => {
      root.dataset.heroEntrance = 'settle';
      screen.style.transition = `transform ${ENTRANCE_MS}ms ${ENTRANCE_EASE}`;
      media.style.transition = `border-radius ${ENTRANCE_MS}ms ${ENTRANCE_EASE}, box-shadow ${ENTRANCE_MS}ms ease`;
      screen.style.removeProperty('transform');
      media.style.removeProperty('border-radius');
      media.style.removeProperty('box-shadow');
      timer = setTimeout(reset, ENTRANCE_MS + 700);
    }, ENTRANCE_HOLD);
  });
  disposers.push(() => { cancelAnimationFrame(frame); clearTimeout(timer); reset(); });
}

function setUpPage() {
  cleanupPage();
  const disposers = [];
  enter(disposers);
  const films = [...document.querySelectorAll('[data-clip] video')];
  const motion = !matchMedia('(prefers-reduced-motion: reduce)').matches;
  // A screen ahead of a clip, its poster arrives and, when motion is
  // welcome, it starts buffering, so it is ready by the time it's in view.
  // Nothing far down the page loads on arrival.
  const approach = new IntersectionObserver(entries => {
    entries.forEach(({ target, isIntersecting }) => {
      if (!isIntersecting) return;
      if (target.dataset.poster) { target.poster = target.dataset.poster; delete target.dataset.poster; }
      if (motion) target.preload = 'auto';
      approach.unobserve(target);
    });
  }, { rootMargin: '75% 0px' });
  // The hero's recording gets the connection to itself first: the rest start
  // watching for their approach once it can play through (or after a few
  // seconds on a slow connection).
  const hero = document.querySelector('.case-hero-screen video');
  const others = films.filter(video => video !== hero);
  let started = false;
  const watchOthers = () => { if (started) return; started = true; others.forEach(video => approach.observe(video)); };
  if (hero && motion && hero.readyState < 4) {
    hero.addEventListener('canplaythrough', watchOthers, { once: true });
    const timer = setTimeout(watchOthers, 3000);
    disposers.push(() => { clearTimeout(timer); hero.removeEventListener('canplaythrough', watchOthers); });
  } else watchOthers();
  disposers.push(() => approach.disconnect());

  // Clips play while on screen, and only when motion is welcome.
  if (films.length && motion) {
    const filmWatcher = new IntersectionObserver(entries => {
      entries.forEach(({ target, isIntersecting }) => {
        if (isIntersecting) target.play().catch(() => {}); else target.pause();
      });
    }, { threshold: 0.25 });
    films.forEach(video => filmWatcher.observe(video));
    disposers.push(() => filmWatcher.disconnect());
  }

  cleanupPage = () => disposers.forEach(dispose => dispose());
}

setUpPage();
document.addEventListener('site:page-change', setUpPage);
