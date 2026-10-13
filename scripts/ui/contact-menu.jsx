import './showcase.js';
import React, { useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { Menu, useReducedMotion, useBloomContext } from 'bloom-menu';
import { MotionConfig, motion, useAnimationControls } from 'framer-motion';

const menuItemSelector = '[role="menuitem"], [role="menuitemcheckbox"]';

function MusicNote() {
  return <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true" focusable="false"><path d="M14 1.75a.75.75 0 0 0-.89-.737l-7.502 1.43a.75.75 0 0 0-.61.736v2.5c0 .018 0 .036.002.054V9.73a1 1 0 0 1-.813.983l-.58.11a1.978 1.978 0 0 0 .741 3.886l.603-.115c.9-.171 1.55-.957 1.55-1.873v-1.543l-.001-.043V6.3l6-1.143v3.146a1 1 0 0 1-.813.982l-.584.111a1.978 1.978 0 0 0 .74 3.886l.326-.062A2.252 2.252 0 0 0 14 11.007V1.75Z" /></svg>;
}

function Arrow() {
  return <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true" focusable="false"><path fillRule="evenodd" d="M4.22 11.78a.75.75 0 0 1 0-1.06L9.44 5.5H5.75a.75.75 0 0 1 0-1.5h5.5a.75.75 0 0 1 .75.75v5.5a.75.75 0 0 1-1.5 0V6.56l-5.22 5.22a.75.75 0 0 1-1.06 0Z" clipRule="evenodd" /></svg>;
}

function Heart() {
  return <svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true" focusable="false"><path d="M2 6.342a3.375 3.375 0 0 1 6-2.088 3.375 3.375 0 0 1 5.997 2.26c-.063 2.134-1.618 3.76-2.955 4.784a14.437 14.437 0 0 1-2.676 1.61c-.02.01-.038.017-.05.022l-.014.006-.004.002h-.002a.75.75 0 0 1-.592.001h-.002l-.004-.003-.015-.006a5.528 5.528 0 0 1-.232-.107 14.395 14.395 0 0 1-2.535-1.557C3.564 10.22 1.999 8.558 1.999 6.38L2 6.342Z" /></svg>;
}

function ContactTrigger() {
  const { open, setOpen, triggerRef } = useBloomContext();
  return <button ref={triggerRef} className="site-nav-link elsewhere-trigger" aria-haspopup="menu" aria-expanded={open} aria-controls="elsewhere-links" onClick={() => setOpen(!open)} onKeyDown={event => {
    if (event.key === 'ArrowDown' && !open) { event.preventDefault(); setOpen(true); }
  }}>Other Stuff</button>;
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

function ContactMenu({ email, initialGeometry }) {
  const [open, setOpen] = useState(false);
  const [musicEnabled, setMusicEnabled] = useState(() => document.querySelector('#music-player')?.hasAttribute('data-open') || false);
  const [status, setStatus] = useState('');
  const [copyFeedback, setCopyFeedback] = useState({ pulse: 0, instant: false });
  const wrapper = useRef(null);
  const keyboard = useRef(false);
  const copyCount = useRef(0);
  const reduced = useReducedMotion();
  const [geometry, setGeometry] = useState(initialGeometry);
  useEffect(() => {
    const measure = wrapper.current.querySelector('.elsewhere-measure');
    const update = () => {
      const css = getComputedStyle(wrapper.current);
      const trigger = measure.getBoundingClientRect();
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
    observer.observe(measure);
    observer.observe(wrapper.current.querySelector('.elsewhere-menu-measure'));
    document.fonts.ready.then(update);
    update();
    return () => observer.disconnect();
  }, []);
  useEffect(() => {
    if (open && keyboard.current) requestAnimationFrame(() => wrapper.current?.querySelector(menuItemSelector)?.focus());
  }, [open]);
  useEffect(() => {
    const update = event => setMusicEnabled(event.detail.open);
    document.addEventListener('site:music-change', update);
    return () => document.removeEventListener('site:music-change', update);
  }, []);
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
  function toggleMusic(event) {
    document.dispatchEvent(new CustomEvent('site:music-toggle', { detail: { instant: event.detail === 0 } }));
    changeOpen(false);
  }
  async function copyEmail(event) {
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
        wrapper.current?.querySelector('button')?.focus();
        if (!copied) throw new Error('Copy failed');
      }
      copyCount.current += 1;
      setStatus(copyCount.current === 1 ? 'Copied!' : 'Copied again!');
      setCopyFeedback({ pulse: copyCount.current, instant });
    } catch { setStatus(email); }
  }
  return <MotionConfig reducedMotion="user"><div ref={wrapper} className="elsewhere-menu" style={{ width: geometry.width, "--elsewhere-width": `${geometry.width}px`, "--other-measured-width": `${geometry.menuWidth}px`, "--other-measured-height": `${geometry.menuHeight}px` }} data-open={open} onBlur={event => { if (event.relatedTarget && !event.currentTarget.contains(event.relatedTarget)) setOpen(false); }} onKeyDownCapture={keys} onPointerDownCapture={() => { keyboard.current = false; }}>
    <span className="site-nav-link elsewhere-measure" aria-hidden="true">Other Stuff</span>
    <div className="elsewhere-menu-measure elsewhere-content" aria-hidden="true">
      <div className="elsewhere-item">GitHub <Arrow /></div>
      <div className="elsewhere-item">LinkedIn <Arrow /></div>
      <div className="elsewhere-item">Email <span className="elsewhere-copy-note">Copied again!</span></div>
      <div className="elsewhere-divider" />
      <div className="elsewhere-item">Disable music <MusicNote /></div>
    </div>
    <Menu.Root open={open} onOpenChange={changeOpen} direction="bottom" anchor="end" visualDuration={0.25} bounce={0.12} animationConfig={{ contentDelay: 0.025, contentBlur: 4, triggerBlur: 4, contentScale: reduced ? 1 : 0.98 }}>
      <ContactTrigger />
      <div className="elsewhere-bloom-origin">
      <Menu.Container key={geometry.key} buttonSize={{ width: geometry.width, height: geometry.height }} menuWidth={geometry.menuWidth} menuRadius={geometry.menuRadius} buttonRadius={geometry.radius} className="elsewhere-shell">
        <Menu.Content className="elsewhere-content">
          <div id="elsewhere-links">
          <a role="menuitem" className="elsewhere-item" href="https://github.com/micha3l-e" target="_blank" rel="noopener noreferrer" onClick={() => changeOpen(false)}>GitHub <Arrow /></a>
          <a role="menuitem" className="elsewhere-item" href="https://www.linkedin.com/in/michaeleggar" target="_blank" rel="noopener noreferrer" onClick={() => changeOpen(false)}>LinkedIn <Arrow /></a>
          <button role="menuitem" className="elsewhere-item" onClick={copyEmail}>Email <CopyConfirmation status={status} pulse={copyFeedback.pulse} instant={copyFeedback.instant} reduced={reduced} /></button>
          <div className="elsewhere-divider" role="separator" />
          <button role="menuitemcheckbox" className="elsewhere-item elsewhere-music" aria-checked={musicEnabled} aria-controls="music-player" onClick={toggleMusic}>{musicEnabled ? 'Disable music' : 'Enable music'} <MusicNote /></button>
          </div>
        </Menu.Content>
      </Menu.Container>
      </div>
    </Menu.Root>
    <span className="visually-hidden" role="status" aria-live="polite">{status}</span>
  </div></MotionConfig>;
}
const mount = document.querySelector('[data-contact-menu]');
if (mount) {
  const css = getComputedStyle(mount);
  const height = parseFloat(css.getPropertyValue('--nav-height'));
  const width = mount.querySelector('.site-nav-link').getBoundingClientRect().width;
  const menuWidth = parseFloat(css.getPropertyValue('--other-menu-min-width'));
  const menuHeight = 4 * height + 2 * parseFloat(css.getPropertyValue('--other-menu-padding')) + 13;
  const initialGeometry = {
    width, height, menuWidth, menuHeight,
    radius: parseFloat(css.getPropertyValue('--control-radius')),
    menuRadius: parseFloat(css.getPropertyValue('--surface-radius')),
    key: `${height}-${menuWidth}-${menuHeight}`,
  };
  createRoot(mount).render(<ContactMenu email={mount.dataset.email} initialGeometry={initialGeometry} />);
}
