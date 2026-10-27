// The Elsewhere and Other Stuff menus: a text trigger that blooms into a small menu.
// The bloom is plain CSS in header.css; this builds each menu and handles opening, keys, and items.
const menuItemSelector = '[role="menuitem"], [role="menuitemcheckbox"]';
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
// framer-motion's spring (duration 0.22s, bounce 0.25), sampled for the copy note's settle.
const settle = 'linear(0, 0.127 6.5%, 0.349 12.6%, 0.57 18.7%, 0.75 24.8%, 0.878 30.9%, 0.958 37%, 1.001 43%, 1.02 49.1%, 1.025 55.2%, 1.022 61.3%, 1.017 67.4%, 1.011 73.5%, 1.007 79.6%, 1.003 85.7%, 1)';

const arrow = '<svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true" focusable="false"><path fill-rule="evenodd" d="M4.22 11.78a.75.75 0 0 1 0-1.06L9.44 5.5H5.75a.75.75 0 0 1 0-1.5h5.5a.75.75 0 0 1 .75.75v5.5a.75.75 0 0 1-1.5 0V6.56l-5.22 5.22a.75.75 0 0 1-1.06 0Z" clip-rule="evenodd" /></svg>';
const heart = '<svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true" focusable="false"><path d="M2 6.342a3.375 3.375 0 0 1 6-2.088 3.375 3.375 0 0 1 5.997 2.26c-.063 2.134-1.618 3.76-2.955 4.784a14.437 14.437 0 0 1-2.676 1.61c-.02.01-.038.017-.05.022l-.014.006-.004.002h-.002a.75.75 0 0 1-.592.001h-.002l-.004-.003-.015-.006a5.528 5.528 0 0 1-.232-.107 14.395 14.395 0 0 1-2.535-1.557C3.564 10.22 1.999 8.558 1.999 6.38L2 6.342Z" /></svg>';
const disc = '<svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true" focusable="false"><circle cx="8" cy="8" r="5.5" /><circle cx="8" cy="8" r="1.5" /><path d="M4.5 8a3.5 3.5 0 0 1 3.5-3.5M11.5 8A3.5 3.5 0 0 1 8 11.5" /></svg>';

// After keyboard use, opening focuses the first item and closing returns focus to the trigger.
function createMenu(mount, { name, label, items, status = false }) {
  mount.innerHTML = `<div class="elsewhere-menu" data-open="false">
    <button class="site-nav-link elsewhere-trigger" type="button" aria-haspopup="menu" aria-expanded="false" aria-controls="${name}-links">${label}</button>
    <div class="elsewhere-shell"><div class="elsewhere-surface"><div id="${name}-links" class="elsewhere-content" role="menu" aria-label="${label}">${items}</div></div></div>
    ${status ? '<span class="visually-hidden" role="status" aria-live="polite"></span>' : ''}
  </div>`;
  const menu = mount.firstElementChild;
  const trigger = menu.querySelector('.elsewhere-trigger');
  let open = false;
  let keyboard = false;

  // The closed shell is clipped to the trigger's pill, so it needs the trigger's width.
  new ResizeObserver(([entry]) => menu.style.setProperty('--trigger-width', `${entry.borderBoxSize[0].inlineSize}px`)).observe(trigger);

  function setOpen(next) {
    if (next === open) return;
    open = next;
    menu.dataset.open = open;
    trigger.setAttribute('aria-expanded', open);
    if (open && keyboard) menu.querySelector(menuItemSelector)?.focus();
    if (!open && keyboard && menu.contains(document.activeElement)) trigger.focus();
  }

  trigger.addEventListener('click', () => setOpen(!open));
  trigger.addEventListener('keydown', event => {
    if (event.key === 'ArrowDown' && !open) { event.preventDefault(); setOpen(true); }
  });
  menu.addEventListener('pointerdown', () => { keyboard = false; }, true);
  menu.addEventListener('keydown', event => {
    keyboard = true;
    if (!open) return;
    const items = [...menu.querySelectorAll(menuItemSelector)];
    const index = items.indexOf(document.activeElement);
    const positions = { ArrowDown: (index + 1) % items.length, ArrowUp: (index - 1 + items.length) % items.length, Home: 0, End: items.length - 1 };
    if (event.key in positions) { event.preventDefault(); items[positions[event.key]]?.focus(); }
    if (event.key === 'Tab') keyboard = false;
  }, true);
  menu.addEventListener('focusout', event => {
    if (event.relatedTarget && !menu.contains(event.relatedTarget)) setOpen(false);
  });
  document.addEventListener('keydown', event => {
    if (open && event.key === 'Escape') { event.preventDefault(); setOpen(false); }
  });
  document.addEventListener('pointerdown', event => {
    if (open && !menu.contains(event.target)) setOpen(false);
  });
  document.addEventListener('site:page-change', () => setOpen(false));
  return { menu, trigger, close: () => setOpen(false) };
}

const elsewhereItems = () => `<a role="menuitem" class="elsewhere-item" href="https://github.com/micha3l-e" target="_blank" rel="noopener noreferrer">GitHub ${arrow}</a>
  <a role="menuitem" class="elsewhere-item" href="https://www.linkedin.com/in/michaeleggar" target="_blank" rel="noopener noreferrer">LinkedIn ${arrow}</a>
  <button role="menuitem" class="elsewhere-item elsewhere-email" type="button">Email <span class="elsewhere-copy-note"><span class="elsewhere-copy-label">Copy</span><span class="elsewhere-copy-reserve" aria-hidden="true">Copied again!</span></span></button>`;

// The links close the menu; Email copies the address and says so.
function wireElsewhere({ menu, trigger, close }, email) {
  for (const link of menu.querySelectorAll('a')) link.addEventListener('click', close);
  const note = menu.querySelector('.elsewhere-copy-note');
  const label = note.querySelector('.elsewhere-copy-label');
  const status = menu.querySelector('[role="status"]');
  let copies = 0;

  function celebrate() {
    for (const animation of label.getAnimations()) animation.cancel();
    if (reducedMotion.matches) { label.animate({ opacity: [0.6, 1] }, { duration: 160, easing: 'ease-out' }); return; }
    label.animate([
      { transform: 'none', easing: 'cubic-bezier(0.19, 1, 0.22, 1)' },
      { transform: 'translateY(-2px) scale(1.06) rotate(-1.5deg)', offset: 0.24, easing: settle },
      { transform: 'none' },
    ], { duration: 290 });
  }

  menu.querySelector('.elsewhere-email').addEventListener('click', async event => {
    const instant = event.detail === 0;
    try {
      try { await navigator.clipboard.writeText(email); }
      catch {
        const field = document.createElement('textarea');
        field.value = email;
        field.style.cssText = 'position:fixed;left:-9999px';
        document.body.append(field);
        field.select();
        const copied = document.execCommand('copy');
        field.remove();
        trigger.focus();
        if (!copied) throw new Error('Copy failed');
      }
      copies += 1;
      const message = copies === 1 ? 'Copied!' : 'Copied again!';
      status.textContent = message;
      label.innerHTML = copies === 1 ? `${message}${heart}` : message;
      note.dataset.copied = 'true';
      if (!instant) celebrate();
    } catch { status.textContent = email; }
  });
}

function createElsewhereMenu(mount) {
  const parts = createMenu(mount, { name: 'elsewhere', label: 'Elsewhere', status: true, items: elsewhereItems() });
  wireElsewhere(parts, mount.dataset.email);
}

// The disc looks the same every half turn, so it can come to rest at any multiple of 180°.
const discTurn = 1200;
const discCoast = 2; // Initial slope of the ease-out below, so the stop starts at the spin's speed.
const discCanSpin = matchMedia('(hover: hover) and (pointer: fine) and (prefers-reduced-motion: no-preference)');
// A transform (not the `rotate` property) keeps the spin on the compositor; the nudge matches header.css.
const turn = degrees => `translateY(0.5px) rotate(${degrees}deg)`;

function spinDisc(button) {
  const icon = button.querySelector('svg');
  let spin = null;
  const angle = () => {
    if (!spin) return 0;
    const { from, to } = spin.discRange;
    return from + (to - from) * spin.effect.getComputedTiming().progress;
  };
  button.addEventListener('pointerenter', () => {
    if (!discCanSpin.matches) return;
    const from = angle() % 360;
    spin?.cancel();
    spin = icon.animate({ transform: [turn(from), turn(from + 360)] }, { duration: discTurn, iterations: Infinity });
    spin.discRange = { from, to: from + 360 };
  });
  button.addEventListener('pointerleave', () => {
    if (!spin) return;
    const from = angle() % 360;
    let distance = 180 - (from % 180);
    if (distance < 45) distance += 180;
    spin.cancel();
    const stop = icon.animate({ transform: [turn(from), turn(from + distance)] }, { duration: distance / 360 * discTurn * discCoast, easing: 'cubic-bezier(0.5, 1, 0.89, 1)' });
    stop.discRange = { from, to: from + distance };
    stop.onfinish = () => { if (spin === stop) spin = null; };
    spin = stop;
  });
}

const otherItems = () => `<button role="menuitemcheckbox" class="elsewhere-item elsewhere-ambience" type="button" aria-checked="${document.querySelector('#ambient-player')?.hasAttribute('data-open') || false}" aria-controls="ambient-player">CD player ${disc}</button>`;

function wireOther({ menu, close }) {
  const ambience = menu.querySelector('.elsewhere-ambience');
  spinDisc(ambience);
  document.addEventListener('site:ambience-change', event => ambience.setAttribute('aria-checked', event.detail.open));
  ambience.addEventListener('click', event => {
    document.dispatchEvent(new CustomEvent('site:ambience-toggle', { detail: { instant: event.detail === 0 } }));
    close();
  });
}

function createOtherMenu(mount) {
  wireOther(createMenu(mount, { name: 'other', label: 'Other Stuff', items: otherItems() }));
}

// Phones get both menus in one (header.css picks which shows).
function createMoreMenu(mount) {
  const parts = createMenu(mount, {
    name: 'more',
    label: 'More',
    status: true,
    items: `${elsewhereItems()}<div class="elsewhere-divider" role="separator"></div>${otherItems()}`,
  });
  wireElsewhere(parts, mount.dataset.email);
  wireOther(parts);
}

const menus = { elsewhere: createElsewhereMenu, other: createOtherMenu, more: createMoreMenu };
document.querySelectorAll('[data-site-menu]').forEach(mount => menus[mount.dataset.siteMenu](mount));
