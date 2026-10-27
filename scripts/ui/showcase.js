import { motionValue, attachFollow, styleEffect } from 'motion-dom';
import { getShowcaseSettings } from './showcase-settings.js';

const transformKeys = ['x', 'y', 'rotate', 'scale'];
let dispose;
function initializeShowcase() {
  dispose?.();
  const stage = document.querySelector('[data-showcase]');
  if (!stage) return;
  const page = stage.closest('.home-page');
  const intro = page?.querySelector('.page-intro');
  const header = document.querySelector('.site-header');
  const navItem = header?.querySelector('.site-nav-link');
  const cards = [...stage.querySelectorAll('.showcase-card')];
  const status = stage.parentElement.querySelector('[data-showcase-status]');
  const compact = matchMedia('(max-width: 780px)');
  const caption = stage.parentElement.querySelector('[data-showcase-caption]');
  const captionTitle = caption.querySelector('.showcase-title');
  const captionCategory = caption.querySelector('.showcase-category');
  const captionYear = caption.querySelector('.showcase-year');
  let captionIndex = -1;
  let captionVisible;
  let captionInstant;
  let stageHasActive;
  let measuredCompact;
  let measuredViewportHeight;
  let measuredSectionTop;
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const finePointer = matchMedia('(hover: hover) and (pointer: fine)');
  const abort = new AbortController();
  const options = { signal: abort.signal };
  let settings = getShowcaseSettings();
  const states = cards.map(card => {
    const values = { x: motionValue(0), y: motionValue(0), rotate: motionValue(0), scale: motionValue(1) };
    return { values, targets: {}, stopStyle: styleEffect(card, values), followers: [], width: 0, photoHeight: 0, active: null, hidden: null };
  });
  let layoutScale = 1;
  let photoGrowth = 1;
  let photoTopLimit = -Infinity;
  let cardTop = 0;
  let mobileStep = settings.layout.mobileSpacing;
  let replayTimer;
  const viewportHeight = () => window.visualViewport?.scale === 1 ? window.visualViewport.height : window.innerHeight;
  function configureSprings() {
    states.forEach(state => {
      state.followers.forEach(stop => stop());
      const transition = settings.motion.spring.type === 'easing' ? { ...settings.motion.spring, type: 'tween' } : settings.motion.spring;
      state.followers = Object.values(state.values).map(value => attachFollow(value, value.get(), transition));
    });
  }
  function photoBounds(width, height, rotation, scale = 1) {
    const angle = rotation * Math.PI / 180;
    const cosine = Math.abs(Math.cos(angle));
    const sine = Math.abs(Math.sin(angle));
    return { width: (width * cosine + height * sine) * scale, height: (height * cosine + width * sine) * scale };
  }
  function bottomAnchor(state, rotation, scale = 1) {
    if (!settings.sizing.bottomAnchored) return 0;
    const bounds = photoBounds(state.width, state.photoHeight, rotation, scale);
    return (1 - 1 / photoGrowth) * (state.photoHeight + bounds.height) / 2;
  }
  function measureCards() {
    const fitWidth = settings.layout.spacing * (cards.length - 1) + settings.photos.workWidth * settings.photos.artMaxWidth + 64;
    const widthScale = compact.matches ? Math.min(1.15, Math.max(0.8, width / 358)) : Math.min(1, width / fitWidth);
    const stageHeight = compact.matches ? settings.layout.mobileHeight * 0.85 : settings.layout.stageHeight;
    layoutScale = widthScale;
    if (page) {
      const height = viewportHeight();
      const labelGap = Math.min(settings.appearance.labelGap, Math.max(4, (height - 300) * 0.04));
      stage.parentElement.style.setProperty('--showcase-label-gap', `${labelGap}px`);
      const pillInset = navItem ? parseFloat(getComputedStyle(navItem).getPropertyValue('--nav-pill-inset')) || 0 : 0;
      const bottomGap = settings.sizing.matchCaptionToNav && navItem ? navItem.getBoundingClientRect().top + pillInset : settings.sizing.captionBottomGap;
      page.style.setProperty('--home-bottom-gap', `${bottomGap}px`);
      page.style.setProperty('--home-header-height', `${header?.offsetHeight || 0}px`);
      const captionSpace = Math.max(caption.offsetHeight, settings.appearance.detailSize * 1.4 + 6) + labelGap;
      const sectionTop = intro.getBoundingClientRect().bottom + window.scrollY + parseFloat(getComputedStyle(page).rowGap);
      const availableHeight = height - sectionTop - captionSpace - bottomGap;
      layoutScale = Math.min(widthScale, Math.max(0, availableHeight / stageHeight));
    }
    mobileStep = settings.layout.mobileSpacing * width / 358;
    const style = stage.parentElement.style;
    style.setProperty('--showcase-desktop-width', `${settings.photos.workWidth * layoutScale}px`);
    style.setProperty('--showcase-mobile-width', `${settings.photos.mobileWidth * layoutScale}px`);
    style.setProperty('--showcase-stage-height', `${settings.layout.stageHeight * layoutScale}px`);
    style.setProperty('--showcase-mobile-height', `${settings.layout.mobileHeight * layoutScale * 0.85}px`);
    cardTop = (compact.matches ? 22 : 38) * layoutScale;
    style.setProperty('--showcase-card-top', `${cardTop}px`);
    photoGrowth = 1;
    photoTopLimit = page ? intro.getBoundingClientRect().bottom - stage.getBoundingClientRect().top + settings.sizing.textClearance : -Infinity;
    let growthLimit = settings.sizing.growth;
    const baseline = (settings.layout.baseline - (compact.matches ? 20 : 0)) * layoutScale;
    const direction = settings.layout.curve === 'smile' ? 1 : settings.layout.curve === 'arch' ? -1 : 0;
    states.forEach((state, index) => {
      state.width = cards[index].offsetWidth;
      state.photoHeight = cards[index].querySelector('.showcase-photo').offsetHeight;
      const slots = compact.matches ? [-1, 0, 1] : [index - (cards.length - 1) / 2];
      for (const slot of slots) {
        const arc = Math.min(baseline, slot * slot * settings.layout.curveDepth * layoutScale);
        const stagger = (index % 2 ? -settings.layout.stagger / 3 : settings.layout.stagger * 2 / 3) * layoutScale;
        const rotation = Math.max(-30, Math.min(30, -slot * settings.layout.rotation * direction));
        const bounds = photoBounds(state.width, state.photoHeight, rotation);
        const top = cardTop + baseline - direction * arc + stagger + state.photoHeight / 2 - bounds.height / 2;
        if (bounds.height > 0) growthLimit = Math.min(growthLimit, 1 + (top - photoTopLimit) / bounds.height);
        const horizontalRoom = compact.matches ? width / 2 - 12 : width / 2 - Math.abs(slot * settings.layout.spacing * layoutScale) - 12;
        if (bounds.width > 0) growthLimit = Math.min(growthLimit, horizontalRoom * 2 / (bounds.width * (compact.matches ? settings.spotlight.scale : 1)));
        if (!settings.sizing.bottomAnchored && bounds.height > 0) {
          const bottom = top + bounds.height;
          growthLimit = Math.min(growthLimit, 1 + (stage.clientHeight - bottom - 8) * 2 / (state.photoHeight + bounds.height));
        }
      }
    });
    photoGrowth = page ? Math.max(1, settings.sizing.fitToWindow ? growthLimit : settings.sizing.growth) : 1;
    style.setProperty('--showcase-desktop-width', `${settings.photos.workWidth * layoutScale * photoGrowth}px`);
    style.setProperty('--showcase-mobile-width', `${settings.photos.mobileWidth * layoutScale * photoGrowth}px`);
    states.forEach((state, index) => {
      state.width = cards[index].offsetWidth;
      state.photoHeight = cards[index].querySelector('.showcase-photo').offsetHeight;
    });
  }
  let active = -1;
  let hover = null;
  let center = (cards.length - 1) / 2;
  // On phones the fan is a loop: `position` is the card at the front, fractional
  // mid-drag or mid-settle, and every card's place, size, tilt, and fade follow
  // from it, so the deck moves as one under the finger.
  let position = 0;
  let trackFrame;
  const trackSpring = { stiffness: 600, damping: 40 };
  let frame;
  let immediateFrame = false;
  let press;
  let suppressClick = false;
  let width = stage.clientWidth;
  const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
  const wrap = value => value - cards.length * Math.round(value / cards.length);
  const front = () => ((Math.round(position) % cards.length) + cards.length) % cards.length;
  const dots = document.createElement('span');
  dots.className = 'showcase-dots';
  dots.innerHTML = cards.map(() => '<span></span>').join('');
  caption.append(dots);
  function announce() {
    const card = cards[active];
    status.textContent = `${card.dataset.showcaseTitle}, ${card.dataset.kind === 'work' ? 'Project' : 'Art'} ${card.dataset.year}, ${active + 1} of ${cards.length}`;
  }
  function stopTrack() { cancelAnimationFrame(trackFrame); trackFrame = undefined; }
  // How far the front card travels for one card of track: a step, plus the
  // spread that pushes neighbours apart. Dragging by this keeps it under the finger.
  function dragStep() {
    const reach = settings.hover.ripple ? Math.exp(-1.2 / (settings.hover.reach * settings.hover.reach)) : 0;
    return mobileStep + reach * settings.hover.spread * layoutScale;
  }
  // Springs the front card to `to`, from the finger's speed (cards a second).
  function settleTrack(to, velocity = 0, onSettled) {
    stopTrack();
    if (reduced.matches || settings.motion.reducedMotionPreview) { position = to; render(true); onSettled?.(); return; }
    let last = performance.now();
    const step = now => {
      let elapsed = Math.min(0.05, (now - last) / 1000);
      last = now;
      while (elapsed > 0) {
        const dt = Math.min(elapsed, 1 / 240);
        velocity += (-trackSpring.stiffness * (position - to) - trackSpring.damping * velocity) * dt;
        position += velocity * dt;
        elapsed -= dt;
      }
      const done = Math.abs(position - to) < 0.001 && Math.abs(velocity) < 0.02;
      if (done) position = to;
      render(true);
      if (done) { trackFrame = undefined; onSettled?.(); } else trackFrame = requestAnimationFrame(step);
    };
    trackFrame = requestAnimationFrame(step);
  }
  function render(instant = false) {
    const mobile = compact.matches;
    const step = mobile ? mobileStep : settings.layout.spacing * layoutScale;
    // On phones the track is already animated, so cards follow it exactly.
    const snap = mobile || instant || reduced.matches || settings.motion.reducedMotionPreview;
    if (mobile) active = front();
    const hasActive = active >= 0;
    const showCaption = hasActive && settings.spotlight.showLabels;
    if (stageHasActive !== hasActive) { stage.toggleAttribute('data-has-active', hasActive); stageHasActive = hasActive; }
    if (captionInstant !== snap) { caption.style.transitionDuration = snap ? '0ms' : ''; captionInstant = snap; }
    if (captionVisible !== showCaption) { caption.toggleAttribute('data-visible', showCaption); captionVisible = showCaption; }
    if (captionIndex !== active) {
      const card = cards[active];
      captionTitle.textContent = card?.dataset.showcaseTitle || '';
      captionCategory.textContent = card ? (card.dataset.kind === 'work' ? 'Project' : 'Art') : '';
      captionYear.textContent = card?.dataset.year || '';
      [...dots.children].forEach((dot, index) => dot.toggleAttribute('data-active', index === active));
      captionIndex = active;
    }
    const fieldCenter = hover ? hover.x : mobile ? 0 : hasActive ? (active - center) * step : null;
    const energy = hover && settings.hover.verticalInfluence ? clamp(1.2 - hover.y / 800, 0.75, 1.15) : 1;
    const direction = settings.layout.curve === 'smile' ? 1 : settings.layout.curve === 'arch' ? -1 : 0;
    const baseline = (settings.layout.baseline - (mobile ? 20 : 0)) * layoutScale;
    cards.forEach((card, index) => {
      const state = states[index];
      const slot = mobile ? wrap(index - position) : index - center;
      // How far in front this card is: 1 at the front, easing to 0 a card away.
      const spot = mobile ? Math.max(0, 1 - Math.abs(slot)) : active === index ? 1 : 0;
      // Two cards a side, the outer ones fading in as they come round.
      const opacity = mobile ? clamp((2.4 - Math.abs(slot)) / 0.9, 0, 1) : 1;
      if (state.opacity !== opacity) { card.style.opacity = mobile ? opacity : ''; state.opacity = opacity; }
      const hidden = mobile && opacity === 0;
      if (state.hidden !== hidden) {
        card.toggleAttribute('data-mobile-hidden', hidden);
        card.inert = hidden;
        if (hidden) card.setAttribute('aria-hidden', 'true'); else card.removeAttribute('aria-hidden');
        state.hidden = hidden;
      }
      const x = slot * step;
      // A broad pointer field lets adjacent cards share the lift and rotation.
      const distance = fieldCenter === null ? Infinity : (x - fieldCenter) / (step * settings.hover.reach);
      const influence = settings.hover.ripple ? Math.exp(-distance * distance * 1.2) : 0;
      const side = fieldCenter === null ? 0 : clamp((x - fieldCenter) / step, -1, 1);
      const lift = (influence * settings.hover.lift * energy + spot * settings.spotlight.lift) * layoutScale;
      const spread = side * influence * settings.hover.spread * layoutScale;
      const arc = Math.min(baseline, slot * slot * settings.layout.curveDepth * layoutScale);
      const stagger = (index % 2 ? -settings.layout.stagger / 3 : settings.layout.stagger * 2 / 3) * layoutScale;
      let y = baseline - direction * arc - lift + stagger;
      const restingRotation = clamp(-slot * settings.layout.rotation * direction, -30, 30);
      const looseRotation = restingRotation + side * influence * settings.hover.tilt;
      const rotation = looseRotation + (restingRotation * settings.spotlight.rotationFollow - looseRotation) * spot;
      const looseScale = 1 + influence * (settings.hover.neighborScale - 1);
      const scale = looseScale + (settings.spotlight.scale - looseScale) * spot;
      y -= bottomAnchor(state, rotation, scale);
      if (photoGrowth > 1 && settings.sizing.protectTextOnHover) {
        const top = cardTop + y + state.photoHeight / 2 - photoBounds(state.width, state.photoHeight, rotation, scale).height / 2;
        y += Math.max(0, photoTopLimit - top);
      }
      const target = { x: x + spread - state.width / 2, y, rotate: rotation, scale };
      if (!mobile && photoGrowth > 1 && settings.sizing.fitToWindow) {
        const halfWidth = photoBounds(state.width, state.photoHeight, rotation, scale).width / 2;
        target.x = clamp(x + spread, -width / 2 + halfWidth + 12, width / 2 - halfWidth - 12) - state.width / 2;
      }
      const selected = active === index;
      if (selected !== state.active) { card.toggleAttribute('data-active', selected); state.active = selected; }
      const layer = mobile ? 100 - Math.round(Math.abs(slot) * 10) : selected && settings.spotlight.popToFront ? 100 : 10 + index;
      if (state.layer !== layer) { card.style.zIndex = layer; state.layer = layer; }
      for (const key of transformKeys) {
        const value = target[key];
        if (snap) state.values[key].jump(value);
        else if (state.targets[key] !== value) state.values[key].set(value);
        state.targets[key] = value;
      }
    });
  }
  function schedule(instant = false) {
    immediateFrame ||= instant;
    if (frame) return;
    frame = requestAnimationFrame(() => { frame = undefined; const immediate = immediateFrame; immediateFrame = false; render(immediate); });
  }
  function select(index, instant = false, speak = false) {
    hover = null;
    index = clamp(index, 0, cards.length - 1);
    if (compact.matches) {
      // The short way round the loop.
      const to = Math.round(position) + wrap(index - front());
      if (instant) { stopTrack(); position = to; render(true); } else settleTrack(to);
      active = index;
    } else {
      active = index;
      render(instant);
    }
    if (speak) announce();
  }
  stage.addEventListener('pointermove', event => {
    if (press && event.pointerId === press.id) {
      const dx = event.clientX - press.x;
      const dy = event.clientY - press.y;
      if (Math.hypot(dx, dy) > 7) suppressClick = true;
      if (compact.matches) {
        if (!press.axis && Math.max(Math.abs(dx), Math.abs(dy)) > 8) press.axis = Math.abs(dx) > Math.abs(dy) * 1.2 ? 'horizontal' : 'vertical';
        press.samples.push({ x: event.clientX, t: event.timeStamp });
        if (press.samples.length > 6) press.samples.shift();
        if (press.axis === 'horizontal' && !reduced.matches && !settings.motion.reducedMotionPreview) {
          position = press.position - dx / dragStep();
          schedule(true);
        }
      }
      return;
    }
    if (compact.matches || !finePointer.matches || reduced.matches || settings.motion.reducedMotionPreview || settings.preview.enabled) return;
    const rect = stage.getBoundingClientRect();
    setHover(event.clientX - rect.left, event.clientY - rect.top);
  }, options);
  function setHover(localX, localY) {
    const step = compact.matches ? mobileStep : settings.layout.spacing * layoutScale;
    const direction = settings.layout.curve === 'smile' ? 1 : settings.layout.curve === 'arch' ? -1 : 0;
    const baseline = (settings.layout.baseline - (compact.matches ? 20 : 0)) * layoutScale;
    let next = -1;
    let closest = Infinity;
    cards.forEach((card, index) => {
      const slot = index - center;
      const x = width / 2 + slot * step;
      const stagger = (index % 2 ? -settings.layout.stagger / 3 : settings.layout.stagger * 2 / 3) * layoutScale;
      const rotation = clamp(-slot * settings.layout.rotation * direction, -30, 30);
      const top = cardTop + baseline - direction * Math.min(baseline, slot * slot * settings.layout.curveDepth * layoutScale) + stagger - bottomAnchor(states[index], rotation);
      const distance = Math.abs(localX - x);
      if (distance < states[index].width * 0.6 && localY >= top - 65 && localY <= top + states[index].photoHeight + 20 && distance < closest) { closest = distance; next = index; }
    });
    active = next;
    hover = next < 0 ? null : { x: localX - width / 2, y: localY };
    schedule();
  }
  function previewPoint(point) { setHover(width / 2 + point.x * width / 2, stage.clientHeight / 2 - point.y * stage.clientHeight / 2); }
  stage.addEventListener('pointerleave', () => {
    if (!compact.matches && !press && !settings.preview.enabled) {
      hover = null;
      const focused = stage.querySelector('.showcase-card:focus-visible');
      active = cards.indexOf(focused);
      render(Boolean(focused));
    }
  }, options);
  stage.addEventListener('pointerdown', event => {
    if (event.button !== 0 || event.isPrimary === false) return;
    suppressClick = false;
    if (compact.matches) stopTrack();
    press = { id: event.pointerId, x: event.clientX, y: event.clientY, position, samples: [{ x: event.clientX, t: event.timeStamp }] };
  }, options);
  window.addEventListener('pointerup', event => {
    if (!press || event.pointerId !== press.id) return;
    const dx = event.clientX - press.x;
    const dy = event.clientY - press.y;
    const ended = press;
    press = undefined;
    cancelAnimationFrame(frame); frame = undefined; immediateFrame = false;
    if (compact.matches) {
      // Carry the flick: a quick one runs on a few cards, a slow one settles
      // on the nearest. The finger's speed comes from its last ~100ms.
      const samples = ended.samples.filter(sample => event.timeStamp - sample.t < 100);
      const first = samples[0];
      const speed = first && event.timeStamp > first.t ? (event.clientX - first.x) / (event.timeStamp - first.t) : 0;
      const velocity = ended.axis === 'horizontal' ? -speed * 1000 / dragStep() : 0;
      const reach = clamp(Math.round(position + velocity * 0.12), Math.round(ended.position) - 3, Math.round(ended.position) + 3);
      const before = ((Math.round(ended.position) % cards.length) + cards.length) % cards.length;
      if (ended.axis === 'horizontal') suppressClick = true;
      settleTrack(reach, velocity, () => { if (front() !== before) announce(); });
    } else render();
  }, options);
  window.addEventListener('pointercancel', () => {
    press = undefined; suppressClick = false;
    cancelAnimationFrame(frame); frame = undefined; immediateFrame = false;
    if (compact.matches) settleTrack(Math.round(position)); else render();
  }, options);
  stage.addEventListener('dragstart', event => event.preventDefault(), options);
  stage.addEventListener('click', event => {
    if (suppressClick && event.detail !== 0) { event.preventDefault(); event.stopImmediatePropagation(); suppressClick = false; return; }
    suppressClick = false;
    const card = event.target.closest('.showcase-card');
    if (compact.matches && card && cards.indexOf(card) !== active) {
      event.preventDefault(); event.stopImmediatePropagation();
      select(cards.indexOf(card), event.detail === 0, true);
    }
  }, { ...options, capture: true });
  cards.forEach((card, index) => {
    card.addEventListener('focus', () => { if (card.matches(':focus-visible')) select(index, true); }, options);
    card.addEventListener('keydown', event => {
      let target;
      if (event.key === 'ArrowRight') target = (index + 1) % cards.length;
      if (event.key === 'ArrowLeft') target = (index - 1 + cards.length) % cards.length;
      if (event.key === 'Home') target = 0;
      if (event.key === 'End') target = cards.length - 1;
      if (target !== undefined) { event.preventDefault(); select(target, true, compact.matches); cards[target].focus({ preventScroll: true }); }
    }, options);
  });
  function applySettings() {
    const previousSpring = JSON.stringify(settings.motion.spring);
    settings = getShowcaseSettings();
    const section = stage.closest('.home-showcase');
    const style = section.style;
    const cssValues = {
      '--showcase-max-width': `${settings.layout.maxWidth}px`,
      '--showcase-desktop-width': `${settings.photos.workWidth}px`,
      '--showcase-mobile-width': `${settings.photos.mobileWidth}px`,
      '--showcase-stage-height': `${settings.layout.stageHeight}px`,
      '--showcase-mobile-height': `${settings.layout.mobileHeight}px`,
      '--showcase-work-aspect': settings.photos.workAspect,
      '--showcase-work-radius': `${settings.photos.workRadius}px`, '--showcase-art-radius': `${settings.photos.artRadius}px`,
      '--showcase-shadow': settings.appearance.shadow ? `0 ${settings.appearance.shadowOffset}px ${settings.appearance.shadowBlur}px color-mix(in oklch, var(--background) ${settings.appearance.shadowOpacity}%, transparent)` : 'none',
      '--showcase-label-size': `${settings.appearance.labelSize}px`, '--showcase-label-gap': `${settings.appearance.labelGap}px`,
      '--showcase-detail-size': `${settings.appearance.detailSize}px`, '--showcase-label-opacity': settings.spotlight.showLabels ? '1' : '0',
      '--showcase-frame-color': settings.appearance.customFrameColor ? settings.appearance.frameColor : 'var(--surface)',
      '--showcase-work-fit': settings.photos.workFit,
      '--showcase-inactive-blur': settings.appearance.inactiveBlur ? `${settings.appearance.blurAmount}px` : '0px',
      '--showcase-blur-duration': `${settings.motion.reducedMotionPreview ? 0 : settings.appearance.blurDuration}ms`,
    };
    for (const [key, value] of Object.entries(cssValues)) style.setProperty(key, value);
    cards.filter(card => card.dataset.kind === 'art').forEach(card => {
      const ratio = Number(card.dataset.artWidth) / Number(card.dataset.artHeight);
      card.style.setProperty('--art-width-scale', Math.min(ratio * settings.photos.artHeight, settings.photos.artMaxWidth));
    });
    measureCards();
    if (JSON.stringify(settings.motion.spring) !== previousSpring) configureSprings();
    if (settings.preview.enabled) previewPoint(settings.preview.point);
    else render(true);
  }
  document.addEventListener('showcase:settings', applySettings, options);
  document.addEventListener('showcase:replay', () => {
    clearInterval(replayTimer);
    const points = [-0.6, -0.3, 0, 0.3, 0.6, 0.3, 0];
    let index = 0;
    replayTimer = setInterval(() => {
      if (index >= points.length) { clearInterval(replayTimer); if (settings.preview.enabled) previewPoint(settings.preview.point); else { hover = null; active = -1; render(); } return; }
      previewPoint({ x: points[index++], y: 0 });
    }, 160);
  }, options);
  configureSprings();
  applySettings();
  function resize() {
    const nextWidth = stage.clientWidth;
    const nextHeight = viewportHeight();
    const sectionTop = stage.parentElement.getBoundingClientRect().top + window.scrollY;
    if (nextWidth === width && measuredCompact === compact.matches && measuredViewportHeight === nextHeight && measuredSectionTop === sectionTop) return;
    measuredCompact = compact.matches;
    measuredViewportHeight = nextHeight;
    measuredSectionTop = sectionTop;
    press = undefined; stopTrack();
    width = nextWidth;
    if (compact.matches) { active = active < 0 ? 0 : active; position = active; }
    else center = (cards.length - 1) / 2;
    measureCards();
    if (settings.preview.enabled) previewPoint(settings.preview.point); else render(true);
  }
  const observer = new ResizeObserver(resize);
  observer.observe(stage);
  if (intro) observer.observe(intro);
  if (header) observer.observe(header);
  window.addEventListener('resize', resize, options);
  window.visualViewport?.addEventListener('resize', resize, options);
  compact.addEventListener('change', resize, options);
  reduced.addEventListener('change', () => { hover = null; render(true); }, options);
  render(true);
  dispose = () => { abort.abort(); observer.disconnect(); cancelAnimationFrame(frame); stopTrack(); dots.remove(); clearInterval(replayTimer); states.forEach(state => { state.stopStyle(); state.followers.forEach(stop => stop()); Object.values(state.values).forEach(value => value.destroy()); }); };
}
initializeShowcase();
document.addEventListener('site:page-change', initializeShowcase);
