(() => {
  if (!window.fetch || !window.DOMParser || !document.querySelector('#main-content')) return;

  const metadata = 'meta[name="description"], meta[property^="og:"], meta[name^="twitter:"], link[rel="canonical"]';
  const loadedScripts = new Set([...document.querySelectorAll('script[data-page-script]')].map(script => script.src));
  const scrollPositions = new Map();
  const announcement = document.createElement('span');
  announcement.className = 'visually-hidden';
  announcement.setAttribute('role', 'status');
  document.body.append(announcement);
  let request;
  let currentKey = history.state?.sitePageKey || createKey();

  function createKey() {
    return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  }

  history.replaceState({ ...history.state, sitePageKey: currentKey }, '', location.href);
  history.scrollRestoration = 'manual';

  function rememberScroll() {
    scrollPositions.set(currentKey, { left: window.scrollX, top: window.scrollY });
  }

  function loadStyles(page, url, signal) {
    const links = [...page.querySelectorAll('link[data-page-style]')];
    return Promise.all(links.map(source => new Promise((resolve, reject) => {
      const href = new URL(source.getAttribute('href'), url).href;
      const existing = [...document.querySelectorAll('link[data-page-style]')].find(link => link.href === href && !link.hasAttribute('data-staged-style'));
      if (existing) { resolve(existing); return; }
      const link = source.cloneNode(true);
      link.href = href;
      link.media = 'not all';
      link.dataset.stagedStyle = '';
      const abort = () => {
        if (link.hasAttribute('data-staged-style')) link.remove();
        reject(new DOMException('Navigation canceled', 'AbortError'));
      };
      const cleanup = () => signal.removeEventListener('abort', abort);
      link.onload = () => { cleanup(); resolve(link); };
      link.onerror = () => { cleanup(); link.remove(); reject(new Error('Page stylesheet failed to load')); };
      signal.addEventListener('abort', abort, { once: true });
      document.head.append(link);
    })));
  }

  async function loadScripts(page, url, signal) {
    for (const source of page.querySelectorAll('script[data-page-script]')) {
      if (signal.aborted) return;
      const src = new URL(source.getAttribute('src'), url).href;
      if (loadedScripts.has(src)) continue;
      await new Promise((resolve, reject) => {
        // Scripts parsed by DOMParser stay inert when cloned; create a fresh node.
        const script = document.createElement('script');
        for (const attribute of source.attributes) script.setAttribute(attribute.name, attribute.value);
        script.src = src;
        script.onload = () => { loadedScripts.add(src); resolve(); };
        script.onerror = () => { script.remove(); reject(new Error('Page script failed to load')); };
        document.body.append(script);
      });
    }
  }

  function updateHeader(page) {
    for (const link of document.querySelectorAll('.site-nav-links a')) {
      const next = [...page.querySelectorAll('.site-nav-links a')].find(candidate => candidate.getAttribute('href') === link.getAttribute('href'));
      if (next?.hasAttribute('aria-current')) link.setAttribute('aria-current', next.getAttribute('aria-current'));
      else link.removeAttribute('aria-current');
    }
  }

  function scrollToDestination(url, position) {
    if (position) { window.scrollTo({ ...position, behavior: 'instant' }); return; }
    if (url.hash) {
      let id;
      try { id = decodeURIComponent(url.hash.slice(1)); } catch { id = url.hash.slice(1); }
      const target = document.getElementById(id);
      if (target) { target.scrollIntoView({ behavior: 'instant' }); return; }
    }
    window.scrollTo({ left: 0, top: 0, behavior: 'instant' });
  }

  // Between Work pages, keep the project list and swap everything around it, so
  // the list animates between its widths instead of being redrawn (see work.css).
  function swapMain(oldMain, nextMain) {
    const list = oldMain.querySelector(':scope > .work-index');
    const incoming = [...nextMain.children];
    const at = incoming.findIndex(child => child.matches('.work-index'));
    if (!list || at < 0) {
      oldMain.replaceWith(nextMain);
      return nextMain;
    }
    for (const child of [...oldMain.children]) if (child !== list) child.remove();
    list.before(...incoming.slice(0, at));
    list.after(...incoming.slice(at + 1));
    oldMain.dataset.workView = nextMain.dataset.workView;
    for (const link of list.querySelectorAll('a[href]')) {
      const next = incoming[at].querySelector(`a[href="${link.getAttribute('href')}"]`);
      if (next?.hasAttribute('aria-current')) link.setAttribute('aria-current', next.getAttribute('aria-current'));
      else link.removeAttribute('aria-current');
    }
    const stage = oldMain.querySelector(':scope > .work-stage');
    if (stage) {
      stage.setAttribute('data-entering', '');
      const settle = event => {
        if (event.target !== stage) return;
        stage.removeAttribute('data-entering');
        stage.removeEventListener('animationend', settle);
      };
      stage.addEventListener('animationend', settle);
    }
    return oldMain;
  }

  async function navigate(destination, { pop = false, replace = false, key } = {}) {
    request?.abort();
    const controller = new AbortController();
    request = controller;
    const { signal } = controller;
    rememberScroll();
    document.querySelector('#main-content')?.setAttribute('aria-busy', 'true');

    try {
      const response = await fetch(destination.href, { signal, headers: { Accept: 'text/html' } });
      if (!response.ok || !response.headers.get('content-type')?.includes('text/html')) throw new Error('Page unavailable');
      const url = new URL(response.url);
      if (url.origin !== location.origin) throw new Error('External redirect');
      // Fetch excludes fragments; keep anchors from the requested URL.
      url.hash = destination.hash;
      const page = new DOMParser().parseFromString(await response.text(), 'text/html');
      const nextMain = page.querySelector('#main-content');
      if (!nextMain || !page.querySelector('#ambient-player')) throw new Error('Page has no shared layout');
      const styles = await loadStyles(page, url, signal);
      if (signal.aborted) return;

      const oldMain = document.querySelector('#main-content');
      rememberScroll();
      for (const dialog of oldMain.querySelectorAll('dialog[open]')) dialog.close();
      const main = swapMain(oldMain, nextMain);
      for (const link of styles) {
        link.removeAttribute('data-staged-style');
        link.removeAttribute('media');
      }
      for (const link of document.querySelectorAll('link[data-page-style]')) {
        if (!styles.includes(link)) link.remove();
      }
      document.title = page.title;
      document.querySelectorAll(metadata).forEach(node => node.remove());
      page.querySelectorAll(metadata).forEach(node => document.head.append(node.cloneNode(true)));
      updateHeader(page);

      currentKey = pop ? (key || createKey()) : createKey();
      if (!pop) {
        history[replace ? 'replaceState' : 'pushState']({ sitePageKey: currentKey }, '', url.href);
      }
      await loadScripts(page, url, signal);
      if (signal.aborted) return;
      document.dispatchEvent(new CustomEvent('site:page-change'));
      main.setAttribute('tabindex', '-1');
      if (!main.querySelector('dialog[open]')) main.focus({ preventScroll: true });
      scrollToDestination(url, pop ? scrollPositions.get(currentKey) : null);
      announcement.textContent = page.querySelector('h1')?.textContent || page.title;
    } catch (error) {
      if (signal.aborted) return;
      // Keep ordinary navigation available if fetching or page setup fails.
      if (pop) location.reload();
      else if (replace) location.replace(destination.href);
      else location.assign(destination.href);
    } finally {
      if (request === controller) document.querySelector('#main-content')?.removeAttribute('aria-busy');
    }
  }

  document.addEventListener('click', event => {
    if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    const link = event.target.closest('a[href]');
    if (!link || link.hasAttribute('download') || (link.target && link.target !== '_self')) return;
    const url = new URL(link.href);
    if (url.origin !== location.origin || !['http:', 'https:'].includes(url.protocol)) return;
    if (/\.[^/]+$/.test(url.pathname) && !/\.html?$/.test(url.pathname)) return;
    if (url.pathname === location.pathname && url.search === location.search) {
      if (!url.hash || url.hash === location.hash) {
        event.preventDefault();
        request?.abort();
        document.querySelector('#main-content')?.removeAttribute('aria-busy');
        scrollToDestination(url);
      }
      return;
    }
    event.preventDefault();
    navigate(url);
  });

  window.addEventListener('popstate', event => {
    navigate(new URL(location.href), { pop: true, key: event.state?.sitePageKey });
  });
  window.addEventListener('pagehide', rememberScroll);

  // Preserve bookmarks from before Work and Art had separate pages.
  function redirectLegacySection() {
    if (location.pathname !== '/') return;
    const path = { '#work': '/work/', '#art': '/art/' }[location.hash.toLowerCase()];
    if (path) navigate(new URL(path + location.search, location.origin), { replace: true });
  }
  window.addEventListener('hashchange', redirectLegacySection);
  redirectLegacySection();
})();
