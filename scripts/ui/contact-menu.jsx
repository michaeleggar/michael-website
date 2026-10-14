import './showcase.js';
import './work-cards.js';
import React, { useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { Menu, useReducedMotion, useBloomContext } from 'bloom-menu';
import { MotionConfig, motion, useAnimationControls } from 'framer-motion';

const menuItemSelector = '[role="menuitem"], [role="menuitemcheckbox"]';

function DiscIcon() {
  return <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true" focusable="false"><circle cx="8" cy="8" r="5.5" /><circle cx="8" cy="8" r="1.5" /><path d="M4.5 8a3.5 3.5 0 0 1 3.5-3.5M11.5 8A3.5 3.5 0 0 1 8 11.5" /></svg>;
}

function Arrow() {
  return <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true" focusable="false"><path fillRule="evenodd" d="M4.22 11.78a.75.75 0 0 1 0-1.06L9.44 5.5H5.75a.75.75 0 0 1 0-1.5h5.5a.75.75 0 0 1 .75.75v5.5a.75.75 0 0 1-1.5 0V6.56l-5.22 5.22a.75.75 0 0 1-1.06 0Z" clipRule="evenodd" /></svg>;
}

function Heart() {
  return <svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true" focusable="false"><path d="M2 6.342a3.375 3.375 0 0 1 6-2.088 3.375 3.375 0 0 1 5.997 2.26c-.063 2.134-1.618 3.76-2.955 4.784a14.437 14.437 0 0 1-2.676 1.61c-.02.01-.038.017-.05.022l-.014.006-.004.002h-.002a.75.75 0 0 1-.592.001h-.002l-.004-.003-.015-.006a5.528 5.528 0 0 1-.232-.107 14.395 14.395 0 0 1-2.535-1.557C3.564 10.22 1.999 8.558 1.999 6.38L2 6.342Z" /></svg>;
}

function MenuTrigger({ label, controls }) {
  const { open, setOpen, triggerRef } = useBloomContext();
  return <button ref={triggerRef} className="site-nav-link elsewhere-trigger" aria-haspopup="menu" aria-expanded={open} aria-controls={controls} onClick={() => setOpen(!open)} onKeyDown={event => {
    if (event.key === 'ArrowDown' && !open) { event.preventDefault(); setOpen(true); }
  }}>{label}</button>;
}

function CopyConfirmation({ status, pulse, instant, reduced }) {
  const controls = useAnimationControls();
  useEffect(() => {
    let canceled = false;
    const rest = { scale: 1, y: 0, rotate: 0, opacity: 1 };
    if (!pulse || instant) { controls.set(rest); return; }
    async function celebrate() {
      if (reduced) {
        controls.set({ ...rest, opacity: 0.6 });
        await controls.start({ opacity: 1, transition: { duration: 0.16, ease: 'easeOut' } });
        return;
      }
      await controls.start({ scale: 1.06, y: -2, rotate: -1.5, transition: { duration: 0.07, ease: [0.19, 1, 0.22, 1] } });
      if (!canceled) await controls.start({ ...rest, transition: { type: 'spring', duration: 0.22, bounce: 0.25 } });
    }
    celebrate();
    return () => { canceled = true; controls.stop(); };
  }, [pulse, instant, reduced, controls]);
  return <motion.span className="elsewhere-copy-note" animate={controls} initial={false} data-copied={status.startsWith('Copied')}>{status.startsWith('Copied') ? status : 'Copy'}{status === 'Copied!' && <Heart />}</motion.span>;
}

// One text trigger that blooms into a menu. `measure` mirrors the items so the shell can be sized before it opens.
function SiteMenu({ name, label, anchor, initialGeometry, measure, status, children }) {
  const [open, setOpen] = useState(false);
  const wrapper = useRef(null);
  const keyboard = useRef(false);
  const reduced = useReducedMotion();
  const [geometry, setGeometry] = useState(initialGeometry);
  useEffect(() => {
    const measured = wrapper.current.querySelector('.elsewhere-measure');
    const update = () => {
      const css = getComputedStyle(wrapper.current);
      const trigger = measured.getBoundingClientRect();
      const menu = wrapper.current.querySelector('.elsewhere-menu-measure').getBoundingClientRect();
      const next = {
        width: trigger.width, height: trigger.height,
        menuWidth: menu.width, menuHeight: menu.height,
        radius: parseFloat(css.getPropertyValue('--control-radius')),
        menuRadius: parseFloat(css.getPropertyValue('--surface-radius')),
        key: `${trigger.height}-${menu.width}-${menu.height}`,
      };
      setGeometry(previous => JSON.stringify(previous) === JSON.stringify(next) ? previous : next);
    };
    const observer = new ResizeObserver(update);
    observer.observe(measured);
    observer.observe(wrapper.current.querySelector('.elsewhere-menu-measure'));
    document.fonts.ready.then(update);
    update();
    return () => observer.disconnect();
  }, []);
  useEffect(() => {
    if (open && keyboard.current) requestAnimationFrame(() => wrapper.current?.querySelector(menuItemSelector)?.focus());
  }, [open]);
  useEffect(() => {
    const close = () => setOpen(false);
    document.addEventListener('site:page-change', close);
    return () => document.removeEventListener('site:page-change', close);
  }, []);
  function changeOpen(next) {
    setOpen(next);
    if (!next && keyboard.current) setTimeout(() => wrapper.current?.querySelector('[aria-haspopup="menu"]')?.focus(), 220);
  }
  function keys(event) {
    keyboard.current = true;
    if (!open) return;
    const items = [...wrapper.current.querySelectorAll(menuItemSelector)];
    const index = items.indexOf(document.activeElement);
    const positions = { ArrowDown: (index + 1) % items.length, ArrowUp: (index - 1 + items.length) % items.length, Home: 0, End: items.length - 1 };
    if (event.key in positions) { event.preventDefault(); items[positions[event.key]]?.focus(); }
    if (event.key === 'Tab') keyboard.current = false;
  }
  return <MotionConfig reducedMotion="user"><div ref={wrapper} className="elsewhere-menu" style={{ width: geometry.width, "--elsewhere-width": `${geometry.width}px`, "--other-measured-width": `${geometry.menuWidth}px`, "--other-measured-height": `${geometry.menuHeight}px` }} data-open={open} data-anchor={anchor} onBlur={event => { if (event.relatedTarget && !event.currentTarget.contains(event.relatedTarget)) setOpen(false); }} onKeyDownCapture={keys} onPointerDownCapture={() => { keyboard.current = false; }}>
    <span className="site-nav-link elsewhere-measure" aria-hidden="true">{label}</span>
    <div className="elsewhere-menu-measure elsewhere-content" aria-hidden="true">{measure}</div>
    <Menu.Root open={open} onOpenChange={changeOpen} direction="bottom" anchor={anchor} visualDuration={0.25} bounce={0.12} animationConfig={{ contentDelay: 0.025, contentBlur: 4, triggerBlur: 4, contentScale: reduced ? 1 : 0.98 }}>
      <MenuTrigger label={label} controls={`${name}-links`} />
      <div className="elsewhere-bloom-origin">
      <Menu.Container key={geometry.key} buttonSize={{ width: geometry.width, height: geometry.height }} menuWidth={geometry.menuWidth} menuRadius={geometry.menuRadius} buttonRadius={geometry.radius} className="elsewhere-shell">
        <Menu.Content className="elsewhere-content">
          <div id={`${name}-links`} className="elsewhere-links">{children(changeOpen)}</div>
        </Menu.Content>
      </Menu.Container>
      </div>
    </Menu.Root>
    {status !== undefined && <span className="visually-hidden" role="status" aria-live="polite">{status}</span>}
  </div></MotionConfig>;
}

function ElsewhereMenu({ email, initialGeometry }) {
  const [status, setStatus] = useState('');
  const [copyFeedback, setCopyFeedback] = useState({ pulse: 0, instant: false });
  const copyCount = useRef(0);
  const reduced = useReducedMotion();
  async function copyEmail(event) {
    const instant = event.detail === 0;
    const trigger = event.currentTarget.closest('.elsewhere-menu')?.querySelector('button');
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
        trigger?.focus();
        if (!copied) throw new Error('Copy failed');
      }
      copyCount.current += 1;
      setStatus(copyCount.current === 1 ? 'Copied!' : 'Copied again!');
      setCopyFeedback({ pulse: copyCount.current, instant });
    } catch { setStatus(email); }
  }
  const measure = <>
    <div className="elsewhere-item">GitHub <Arrow /></div>
    <div className="elsewhere-item">LinkedIn <Arrow /></div>
    <div className="elsewhere-item">Email <span className="elsewhere-copy-note">Copied again!</span></div>
  </>;
  return <SiteMenu name="elsewhere" label="Elsewhere" anchor="start" initialGeometry={initialGeometry} measure={measure} status={status}>{changeOpen => <>
    <a role="menuitem" className="elsewhere-item" href="https://github.com/micha3l-e" target="_blank" rel="noopener noreferrer" onClick={() => changeOpen(false)}>GitHub <Arrow /></a>
    <a role="menuitem" className="elsewhere-item" href="https://www.linkedin.com/in/michaeleggar" target="_blank" rel="noopener noreferrer" onClick={() => changeOpen(false)}>LinkedIn <Arrow /></a>
    <button role="menuitem" className="elsewhere-item" onClick={copyEmail}>Email <CopyConfirmation status={status} pulse={copyFeedback.pulse} instant={copyFeedback.instant} reduced={reduced} /></button>
  </>}</SiteMenu>;
}

function OtherMenu({ initialGeometry }) {
  const [ambienceOpen, setAmbienceOpen] = useState(() => document.querySelector('#ambient-player')?.hasAttribute('data-open') || false);
  useEffect(() => {
    const update = event => setAmbienceOpen(event.detail.open);
    document.addEventListener('site:ambience-change', update);
    return () => document.removeEventListener('site:ambience-change', update);
  }, []);
  return <SiteMenu name="other" label="Other Stuff" anchor="end" initialGeometry={initialGeometry} measure={<div className="elsewhere-item">CD player <DiscIcon /></div>}>{changeOpen => (
    <button role="menuitemcheckbox" className="elsewhere-item elsewhere-ambience" aria-checked={ambienceOpen} aria-controls="ambient-player" onClick={event => {
      document.dispatchEvent(new CustomEvent('site:ambience-toggle', { detail: { instant: event.detail === 0 } }));
      changeOpen(false);
    }}>CD player <DiscIcon /></button>
  )}</SiteMenu>;
}

const menus = { elsewhere: { Component: ElsewhereMenu, rows: 3 }, other: { Component: OtherMenu, rows: 1 } };
document.querySelectorAll('[data-site-menu]').forEach(mount => {
  const { Component, rows } = menus[mount.dataset.siteMenu];
  const css = getComputedStyle(mount);
  const height = parseFloat(css.getPropertyValue('--nav-height'));
  const width = mount.querySelector('.site-nav-link').getBoundingClientRect().width;
  const menuWidth = parseFloat(css.getPropertyValue('--other-menu-min-width'));
  const menuHeight = rows * height + 2 * parseFloat(css.getPropertyValue('--other-menu-padding'));
  const initialGeometry = {
    width, height, menuWidth, menuHeight,
    radius: parseFloat(css.getPropertyValue('--control-radius')),
    menuRadius: parseFloat(css.getPropertyValue('--surface-radius')),
    key: `${height}-${menuWidth}-${menuHeight}`,
  };
  createRoot(mount).render(<Component email={mount.dataset.email} initialGeometry={initialGeometry} />);
});
