// Shared helpers for recording the live sites: opening a page in a recording-
// ready state, finding pointer targets, and easing pointer moves.
const puppeteer = require('./tools/node_modules/puppeteer-core');

const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const DESKTOP = { width: 1512, height: 926, deviceScaleFactor: 2 };
const FULL = { width: 1512, height: 945, deviceScaleFactor: 1.5 };
const PHONE = { width: 393, height: 736, deviceScaleFactor: 2, isMobile: true, hasTouch: true };

const quint = t => (t < 0.5 ? 16 * t ** 5 : 1 - Math.pow(-2 * t + 2, 5) / 2);
const sine = t => -(Math.cos(Math.PI * t) - 1) / 2;
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

// Scroll stops as fractions of the page's scroll range: each move eases over
// `move` seconds, then holds for `hold`.
function stopsTrack(stops, max, { lead = 0.8, move = 1.3, hold = 1.1 } = {}) {
  const moves = [];
  let t = lead;
  for (let i = 1; i < stops.length; i++) {
    moves.push([t, t + move, Math.round(stops[i - 1] * max), Math.round(stops[i] * max)]);
    t += move + hold;
  }
  const seconds = t - hold + 1.2;
  const at = time => {
    let value = moves.length ? moves[0][2] : 0;
    for (const [s, e, a, b] of moves) {
      if (time >= e) value = b;
      else if (time > s) return a + (b - a) * quint((time - s) / (e - s));
    }
    return value;
  };
  return { at, seconds };
}

// Things that sit over a page and aren't part of the design: cookie banners,
// popups, chat and accessibility widgets, the reCAPTCHA badge.
const JUNK = /cky|cookie|consent|gdpr|accessib|userway|uwy|equalweb|dialog|popup|modal|chat|intercom|grecaptcha/i;
async function tidy(page, extraCss = '') {
  await page.addStyleTag({ content: `html { scroll-behavior: auto !important; } .grecaptcha-badge, .cky-consent-container, .cky-modal, .cky-overlay, .cky-btn-revisit-wrapper, .elementor-popup-modal, .dialog-widget, access-widget-ui { display: none !important; } ${extraCss}` });
  await page.evaluate(junk => {
    const re = new RegExp(junk, 'i');
    for (const el of document.querySelectorAll('body *')) {
      const cs = getComputedStyle(el);
      if (cs.position !== 'fixed') continue;
      const id = `${el.id} ${el.className} ${el.getAttribute('aria-label') || ''} ${el.tagName === 'IFRAME' ? el.src : ''}`;
      if (re.test(id) || el.tagName === 'IFRAME' || /^back to top$/i.test(el.textContent.trim())) el.style.setProperty('display', 'none', 'important');
    }
    document.documentElement.style.overflow = ''; document.body.style.overflow = '';
    // Widgets that force their own styles are removed, and kept out.
    const strip = () => document.querySelectorAll('access-widget-ui, [id^="userway"], .uwy').forEach(el => el.remove());
    strip();
    if (!window.__tidy) { window.__tidy = new MutationObserver(strip); window.__tidy.observe(document.body, { childList: true }); }
  }, JUNK.source);
}

async function open(browser, url, viewport, { css = '', slow = 1 } = {}) {
  const page = await browser.newPage();
  await page.setViewport(viewport);
  await page.goto(url, { waitUntil: 'networkidle2', timeout: 90000 }).catch(() => {});
  // Real input releases scripts that wait for a visitor (sticky headers, sliders).
  await page.mouse.move(viewport.width * 0.7, viewport.height * 0.7);
  await page.mouse.move(viewport.width * 0.71, viewport.height * 0.69);
  await new Promise(r => setTimeout(r, 3500));
  await tidy(page, css);
  // Load everything below the fold so nothing pops in mid-shot.
  const height = await page.evaluate(() => document.documentElement.scrollHeight);
  for (let y = 0; y < height; y += 450) { await page.evaluate(y => scrollTo(0, y), y); await new Promise(r => setTimeout(r, 140)); }
  await page.evaluate(() => scrollTo(0, 0));
  await new Promise(r => setTimeout(r, 1500));
  await tidy(page, css);
  await page.evaluate(slow => {
    document.querySelectorAll('.swiper, .swiper-container').forEach(el => el.swiper?.autoplay?.stop());
    document.querySelectorAll('.slick-slider').forEach(el => window.jQuery?.(el).slick?.('slickPause'));
    // Background videos keep pace with the slowed clock (Chrome's floor is 1/16).
    document.querySelectorAll('video').forEach(v => { v.playbackRate = Math.max(1 / slow, 0.0625); });
  }, slow);
  return page;
}

// Targets: 'rest:x,y' (fractions of the viewport), 'text:Label', or
// 'in:Scope text|Label' (a label inside the nearest block holding the scope
// text), or 'sel:Scope text|css selector'. Returned in viewport coordinates at
// the page's current scroll; `doc` marks targets that move with the page.
async function locate(page, target) {
  const { width, height } = page.viewport();
  const [kind, rest] = [target.slice(0, target.indexOf(':')), target.slice(target.indexOf(':') + 1)];
  if (kind === 'rest') { const [fx, fy] = rest.split(',').map(Number); return { x: width * fx, y: height * fy, doc: false }; }
  const box = await page.evaluate((kind, rest) => {
    const visible = n => { const r = n.getBoundingClientRect(); return r.width > 0 && r.height > 0; };
    const scopeOf = text => {
      // The smallest visible element holding the text, whatever its markup.
      const leaf = [...document.querySelectorAll('body *')].filter(n => n.textContent.toLowerCase().includes(text.toLowerCase()) && visible(n)).sort((a, b) => a.textContent.length - b.textContent.length)[0];
      let s = leaf; while (s && s.parentElement && s.getBoundingClientRect().height < 260) s = s.parentElement;
      return s;
    };
    let node = null;
    if (kind === 'text') node = [...document.querySelectorAll('body *')].find(n => !n.children.length && n.textContent.trim().toLowerCase() === rest.toLowerCase() && visible(n));
    if (kind === 'sel' && rest.startsWith('|')) {
      // 'sel:|css@Text' searches the whole page; '@Text' requires that exact text.
      const [css, text] = rest.slice(1).split('@');
      node = [...document.querySelectorAll(css)].find(n => visible(n) && (!text || n.textContent.trim().toLowerCase() === text.toLowerCase()));
    } else if (kind === 'in' || kind === 'sel') {
      const [scopeText, what] = rest.split('|');
      let scope = scopeOf(scopeText);
      for (let up = 0; scope && up < 6 && !node; up++, scope = scope.parentElement) {
        node = kind === 'in'
          ? [...scope.querySelectorAll('*')].find(n => n.textContent.trim().toLowerCase() === what.toLowerCase() && visible(n) && ![...n.children].some(c => c.textContent.trim().toLowerCase() === what.toLowerCase()))
          : [...scope.querySelectorAll(what)].find(visible);
      }
    }
    if (!node) return null;
    const r = node.getBoundingClientRect();
    const fixed = (() => { for (let n = node; n; n = n.parentElement) if (getComputedStyle(n).position === 'fixed') return true; return false; })();
    return { x: r.x + Math.min(r.width * 0.35, 60), y: r.y + r.height / 2, fixed };
  }, kind, rest);
  if (!box) throw new Error(`Target not found: ${target}`);
  return { x: box.x, y: box.y, doc: !box.fixed };
}

function pointerAt(moves, points, t) {
  const [s, e, from, to] = moves.find(([a, b]) => t >= a && t < b) || moves.at(-1);
  const k = sine(clamp((t - s) / (e - s), 0, 1)), a = points[from], b = points[to];
  return { x: a.x + (b.x - a.x) * k, y: a.y + (b.y - a.y) * k - Math.sin(Math.PI * k) * (from === to ? 0 : 18) };
}

module.exports = { puppeteer, CHROME, DESKTOP, FULL, PHONE, stopsTrack, tidy, open, locate, pointerAt, quint, sine, clamp };
