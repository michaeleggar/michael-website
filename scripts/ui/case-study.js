// The hero's dots switch between its pictures, and clips play only while on screen.
let cleanupPage = () => {};

function setUpPage() {
  cleanupPage();
  const disposers = [];
  const hero = document.querySelector('[data-case-hero]');

  if (hero) {
    const dots = [...hero.querySelectorAll('[data-hero-frame]')];
    const frames = [...hero.querySelectorAll('.case-hero-frames img')];
    dots.forEach(dot => {
      const onClick = () => {
        const index = Number(dot.dataset.heroFrame);
        frames.forEach((frame, at) => frame.toggleAttribute('data-active', at === index));
        dots.forEach((other, at) => other.setAttribute('aria-pressed', String(at === index)));
      };
      dot.addEventListener('click', onClick);
      disposers.push(() => dot.removeEventListener('click', onClick));
    });
  }

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
