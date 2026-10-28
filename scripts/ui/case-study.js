// Clips, the hero's recording among them, load as they near the screen and
// play only while on it.
let cleanupPage = () => {};

function setUpPage() {
  cleanupPage();
  const disposers = [];
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
