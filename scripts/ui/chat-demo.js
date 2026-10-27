// Live chat app demo: loads the actor's screen once the page is idle or the
// demo nears the viewport, scales it like a laptop display, and wires the cue
// sheet to the app through the bridge the chat-app repo publishes beside its
// demo builds.

const VIRTUAL_WIDTH = 960;
const VIRTUAL_HEIGHT = 600;
// Below this width the screen uses the app's own phone layout instead of scaling down.
const NATIVE_BELOW = 560;
const PHONE_WIDTH = 420;
// Once the demo is in view, the first line plays by itself after this pause.
const AUTOPLAY_DELAY = 1400;

let teardown = null;

function setUp(root) {
  const iframe = root.querySelector('.chat-demo__frame');
  const viewport = root.querySelector('[data-chat-demo-viewport]');
  const versions = [...root.querySelectorAll('.chat-demo__version')];
  const cues = [...root.querySelectorAll('.chat-demo__cue')];
  const reset = root.querySelector('[data-chat-demo-reset]');
  const take = root.querySelector('[data-chat-demo-take]');
  const control = root.querySelector('[data-chat-demo-control]');
  const opening = JSON.parse(root.querySelector('[data-chat-demo-opening]').textContent);
  const bridgeModule = import(root.dataset.bridge);
  const cleanups = [];
  let demo = null;
  let generation = 0;
  let takeNumber = 1;
  let started = false;
  let inView = false;
  let autoplayed = false;
  let autoplayTimer;

  const setReady = (ready) => {
    root.toggleAttribute('data-ready', ready);
    for (const button of [...cues, reset]) button.disabled = !ready;
  };

  const clearCues = () => {
    for (const cue of cues) delete cue.dataset.state;
  };

  // Resolves once the app inside the frame has rendered its member list.
  const whenAppReady = (current) => new Promise((resolve, reject) => {
    const deadline = Date.now() + 10000;
    const check = () => {
      if (current !== generation) return reject(new DOMException('Replaced', 'AbortError'));
      if (iframe.contentDocument?.querySelector('.sidebar__user[data-user-id]')) return resolve();
      if (Date.now() > deadline) return reject(new Error('Demo did not start'));
      setTimeout(check, 80);
    };
    check();
  });

  async function load(button) {
    const current = ++generation;
    demo?.close();
    demo = null;
    setReady(false);
    clearCues();
    takeNumber = 1;
    take.textContent = takeNumber;
    for (const version of versions) version.setAttribute('aria-pressed', String(version === button));
    control.href = button.dataset.control;
    root.dataset.version = button.dataset.version;
    iframe.src = button.dataset.screen;
    try {
      const [{ connect }] = await Promise.all([bridgeModule, whenAppReady(current)]);
      if (current !== generation) return;
      demo = connect(button.dataset.version);
      demo.reset(opening);
      setReady(true);
      maybeAutoplay();
    } catch (error) {
      if (error.name !== 'AbortError') root.dataset.failed = '';
    }
  }

  // Plays the first cue once, the first time the ready demo is in view.
  function maybeAutoplay() {
    if (autoplayed || !inView || !demo || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    autoplayed = true;
    autoplayTimer = setTimeout(() => {
      if (!cues.some(cue => cue.dataset.state)) cues[0]?.click();
    }, AUTOPLAY_DELAY);
  }
  const visibility = new IntersectionObserver(entries => {
    inView = entries.some(entry => entry.isIntersecting);
    maybeAutoplay();
  }, { threshold: 0.6 });
  visibility.observe(viewport);
  cleanups.push(() => { visibility.disconnect(); clearTimeout(autoplayTimer); });

  // Lay the app out at laptop size and scale it to fit. Phone-sized stages use
  // the app's small-screen layout instead, never narrower than PHONE_WIDTH.
  const fit = () => {
    const width = viewport.clientWidth;
    const narrow = width < NATIVE_BELOW;
    root.toggleAttribute('data-native', narrow);
    const layoutWidth = narrow ? Math.max(width, PHONE_WIDTH) : VIRTUAL_WIDTH;
    const scale = width / layoutWidth;
    viewport.style.setProperty('--chat-demo-scale', scale);
    viewport.style.setProperty('--chat-demo-width', `${layoutWidth}px`);
    viewport.style.setProperty('--chat-demo-height', `${narrow ? viewport.clientHeight / scale : VIRTUAL_HEIGHT}px`);
  };
  const resizer = new ResizeObserver(fit);
  resizer.observe(viewport);
  cleanups.push(() => resizer.disconnect());
  fit();

  // The app focuses its composer on load; keep that from scrolling the page to it.
  // Scrolling the visitor does meanwhile moves the spot to return to, and while
  // they're still scrolling nothing is undone.
  const holdScroll = () => {
    let { scrollX, scrollY } = window;
    let lastInput = -Infinity;
    const scrolling = () => performance.now() - lastInput < 400;
    const scrollKeys = ['ArrowUp', 'ArrowDown', 'PageUp', 'PageDown', 'Home', 'End', ' '];
    const input = event => { if (event.type !== 'keydown' || scrollKeys.includes(event.key)) lastInput = performance.now(); };
    const follow = () => { if (scrolling()) ({ scrollX, scrollY } = window); };
    const inputs = ['wheel', 'touchmove', 'keydown'];
    inputs.forEach(type => window.addEventListener(type, input, { capture: true, passive: true }));
    window.addEventListener('scroll', follow, { passive: true });
    const restore = () => { if (!scrolling()) window.scrollTo(scrollX, scrollY); };
    iframe.addEventListener('load', () => {
      requestAnimationFrame(restore);
      setTimeout(() => {
        restore();
        inputs.forEach(type => window.removeEventListener(type, input, { capture: true }));
        window.removeEventListener('scroll', follow);
      }, 150);
    }, { once: true });
  };

  const start = () => {
    if (started) return;
    started = true;
    holdScroll();
    load(versions.find(version => version.getAttribute('aria-pressed') === 'true') || versions[0]);
  };
  // Booting the app briefly busies the page, so do it while the visitor is still
  // reading the top rather than while they scroll down to it.
  const idle = window.requestIdleCallback || (callback => setTimeout(callback, 1));
  const startWhenIdle = () => idle(start, { timeout: 2000 });
  if (document.readyState === 'complete') startWhenIdle();
  else window.addEventListener('load', startWhenIdle, { once: true });
  const watcher = new IntersectionObserver(entries => {
    if (entries.some(entry => entry.isIntersecting)) { watcher.disconnect(); start(); }
  }, { rootMargin: '300px 0px' });
  watcher.observe(root);
  cleanups.push(() => { watcher.disconnect(); window.removeEventListener('load', startWhenIdle); });

  for (const version of versions) {
    const onClick = () => {
      if (version.getAttribute('aria-pressed') === 'true' && started) return;
      started = true;
      autoplayed = true;
      clearTimeout(autoplayTimer);
      holdScroll();
      load(version);
    };
    version.addEventListener('click', onClick);
    cleanups.push(() => version.removeEventListener('click', onClick));
  }

  for (const cue of cues) {
    const onClick = async () => {
      if (!demo || cue.dataset.state === 'typing') return;
      const current = generation;
      const run = demo;
      // Restart the progress animation even when the line is cued again.
      delete cue.dataset.state;
      void cue.offsetWidth;
      cue.dataset.state = 'typing';
      await run.cue({ userId: cue.dataset.userId, text: cue.dataset.text, delayMs: Number(cue.dataset.delay) });
      if (current === generation && cue.dataset.state === 'typing') cue.dataset.state = 'sent';
    };
    cue.addEventListener('click', onClick);
    cleanups.push(() => cue.removeEventListener('click', onClick));
  }

  const onReset = () => {
    if (!demo) return;
    clearCues();
    demo.reset(opening);
    takeNumber += 1;
    take.textContent = takeNumber;
  };
  reset.addEventListener('click', onReset);
  cleanups.push(() => reset.removeEventListener('click', onReset));

  // Open the control panel beside the page so both can be watched at once.
  const onControl = event => {
    if (window.matchMedia('(max-width: 780px)').matches) return;
    const width = Math.min(1040, screen.availWidth - 80);
    const height = Math.min(720, screen.availHeight - 80);
    const popup = window.open(control.href, 'chat-demo-control', `popup,width=${width},height=${height}`);
    if (popup) { event.preventDefault(); popup.focus(); }
  };
  control.addEventListener('click', onControl);
  cleanups.push(() => control.removeEventListener('click', onControl));

  return () => {
    generation += 1;
    demo?.close();
    cleanups.forEach(cleanup => cleanup());
  };
}

function initialize() {
  teardown?.();
  teardown = null;
  const root = document.querySelector('[data-chat-demo]');
  if (root) teardown = setUp(root);
}

initialize();
document.addEventListener('site:page-change', initialize);
