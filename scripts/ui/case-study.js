// Clips, the hero's recording among them, play only while on screen.
let cleanupPage = () => {};

function setUpPage() {
  cleanupPage();
  const disposers = [];
  // Clips play while on screen, and only when motion is welcome.
  const films = [...document.querySelectorAll('[data-clip] video')];
  if (films.length && !matchMedia('(prefers-reduced-motion: reduce)').matches) {
    const filmWatcher = new IntersectionObserver(entries => {
      entries.forEach(({ target, isIntersecting }) => {
        if (isIntersecting) { target.preload = 'auto'; target.play().catch(() => {}); } else target.pause();
      });
    }, { threshold: 0.25 });
    films.forEach(video => filmWatcher.observe(video));
    disposers.push(() => filmWatcher.disconnect());
  }

  cleanupPage = () => disposers.forEach(dispose => dispose());
}

setUpPage();
document.addEventListener('site:page-change', setUpPage);
