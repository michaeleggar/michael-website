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
  let mobileStep = 0;
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
  // Phones show the first few cards as a miniature of the desktop fan.
  function fanCount() { return compact.matches ? Math.min(cards.length, settings.layout.mobileCount) : cards.length; }
  // The desktop fan's curve, stagger, and spread, scaled to the phone spacing so it keeps its shape.
  function shapeScale() { return compact.matches ? mobileStep / (settings.layout.spacing * layoutScale) : 1; }
  function measureCards() {
    center = (fanCount() - 1) / 2;
    cards.forEach((card, index) => {
      const hidden = index >= fanCount();
      if (states[index].hidden === hidden) return;
      card.toggleAttribute('data-mobile-hidden', hidden);
      card.inert = hidden;
      if (hidden) card.setAttribute('aria-hidden', 'true'); else card.removeAttribute('aria-hidden');
      states[index].hidden = hidden;
    });
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
    fitMobileStep();
    const shape = shapeScale();
    states.forEach((state, index) => {
      state.width = cards[index].offsetWidth;
      state.photoHeight = cards[index].querySelector('.showcase-photo').offsetHeight;
      if (!state.hidden) {
        const slot = index - center;
        const arc = Math.min(baseline, slot * slot * settings.layout.curveDepth * layoutScale * shape);
        const stagger = (index % 2 ? -settings.layout.stagger / 3 : settings.layout.stagger * 2 / 3) * layoutScale * shape;
        const rotation = Math.max(-30, Math.min(30, -slot * settings.layout.rotation * direction));
        const bounds = photoBounds(state.width, state.photoHeight, rotation);
        const top = cardTop + baseline - direction * arc + stagger + state.photoHeight / 2 - bounds.height / 2;
        if (bounds.height > 0) growthLimit = Math.min(growthLimit, 1 + (top - photoTopLimit) / bounds.height);
        const horizontalRoom = width / 2 - Math.abs(slot * (compact.matches ? mobileStep : settings.layout.spacing * layoutScale)) - 12;
        if (bounds.width > 0) growthLimit = Math.min(growthLimit, horizontalRoom * 2 / bounds.width);
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
    fitMobileStep();
  }
  // On phones the fan fits the width: the step leaves room for each outer
  // card as it sits there, tilted.
  function fitMobileStep() {
    const half = Math.max(1, (fanCount() - 1) / 2);
    const tilt = Math.min(30, half * settings.layout.rotation);
    const outer = [cards[0], cards[fanCount() - 1]].map(card => photoBounds(card.offsetWidth, card.querySelector('.showcase-photo').offsetHeight, tilt).width);
    mobileStep = Math.max(12, (width / 2 - 12 - Math.max(...outer) / 2) / half);
  }
  let hover = null;
  let center = (fanCount() - 1) / 2;
  // Phones rest with the middle card raised, since there's no cursor to show the way.
  let active = compact.matches ? Math.round(center) : -1;
  let frame;
  let immediateFrame = false;
  let press;
  let tapFrom = -1;
  let suppressClick = false;
  let width = stage.clientWidth;
  const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
  function announce() {
    const card = cards[active];
    status.textContent = `${card.dataset.showcaseTitle}, ${card.dataset.kind === 'work' ? 'Project' : 'Art'} ${card.dataset.year}, ${active + 1} of ${fanCount()}`;
  }
  function render(instant = false) {
    const mobile = compact.matches;
    const step = mobile ? mobileStep : settings.layout.spacing * layoutScale;
    const snap = instant || reduced.matches || settings.motion.reducedMotionPreview;
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
      captionIndex = active;
    }
    const fieldCenter = hover ? hover.x : hasActive ? (active - center) * step : null;
    const energy = hover && settings.hover.verticalInfluence ? clamp(1.2 - hover.y / 800, 0.75, 1.15) : 1;
    const direction = settings.layout.curve === 'smile' ? 1 : settings.layout.curve === 'arch' ? -1 : 0;
    const baseline = (settings.layout.baseline - (mobile ? 20 : 0)) * layoutScale;
    const shape = shapeScale();
    cards.forEach((card, index) => {
      const state = states[index];
      if (state.hidden) return;
      const slot = index - center;
      const spot = active === index ? 1 : 0;
      const x = slot * step;
      // A broad pointer field lets adjacent cards share the lift and rotation.
      const distance = fieldCenter === null ? Infinity : (x - fieldCenter) / (step * settings.hover.reach);
      const influence = settings.hover.ripple ? Math.exp(-distance * distance * 1.2) : 0;
      const side = fieldCenter === null ? 0 : clamp((x - fieldCenter) / step, -1, 1);
      const lift = (influence * settings.hover.lift * energy + spot * settings.spotlight.lift) * layoutScale;
      const spread = side * influence * settings.hover.spread * layoutScale * shape;
      const arc = Math.min(baseline, slot * slot * settings.layout.curveDepth * layoutScale * shape);
      const stagger = (index % 2 ? -settings.layout.stagger / 3 : settings.layout.stagger * 2 / 3) * layoutScale * shape;
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
      const layer = selected && settings.spotlight.popToFront ? 100 : 10 + index;
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
    active = clamp(index, 0, fanCount() - 1);
    render(instant);
    if (speak) announce();
  }
  stage.addEventListener('pointermove', event => {
    if (press && event.pointerId === press.id) {
      const dx = event.clientX - press.x;
      const dy = event.clientY - press.y;
      if (Math.hypot(dx, dy) > 7) suppressClick = true;
      if (compact.matches) scrub(event);
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
  // Phones: the thumb plays the cursor. The card nearest it across the fan
  // rises, wherever the thumb is up or down, and the neighbours part around it.
  function scrub(event) {
    const rect = stage.getBoundingClientRect();
    const localX = event.clientX - rect.left;
    let closest = Infinity;
    cards.slice(0, fanCount()).forEach((card, index) => {
      const distance = Math.abs(localX - (width / 2 + (index - center) * mobileStep));
      if (distance < closest) { closest = distance; active = index; }
    });
    hover = { x: localX - width / 2, y: event.clientY - rect.top };
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
    press = { id: event.pointerId, x: event.clientX, y: event.clientY };
    tapFrom = active;
    if (compact.matches) scrub(event);
  }, options);
  window.addEventListener('pointerup', event => {
    if (!press || event.pointerId !== press.id) return;
    const dx = event.clientX - press.x;
    const dy = event.clientY - press.y;
    press = undefined;
    cancelAnimationFrame(frame); frame = undefined; immediateFrame = false;
    // The card the thumb let go over stays raised, as if the cursor rested there.
    if (compact.matches) hover = null;
    render();
  }, options);
  window.addEventListener('pointercancel', () => {
    press = undefined; suppressClick = false;
    cancelAnimationFrame(frame); frame = undefined; immediateFrame = false;
    if (compact.matches) hover = null;
    render();
  }, options);
  stage.addEventListener('dragstart', event => event.preventDefault(), options);
  stage.addEventListener('click', event => {
    if (suppressClick && event.detail !== 0) { event.preventDefault(); event.stopImmediatePropagation(); suppressClick = false; return; }
    suppressClick = false;
    const card = event.target.closest('.showcase-card');
    // On phones a tap raises a card first; tapping the raised card opens it.
    if (compact.matches && card && event.detail !== 0) {
      if (tapFrom !== active) { event.preventDefault(); event.stopImmediatePropagation(); announce(); }
      else if (card !== cards[active]) { event.preventDefault(); event.stopImmediatePropagation(); cards[active].click(); }
    }
  }, { ...options, capture: true });
  cards.forEach((card, index) => {
    card.addEventListener('focus', () => { if (card.matches(':focus-visible')) select(index, true); }, options);
    card.addEventListener('keydown', event => {
      let target;
      const count = fanCount();
      if (event.key === 'ArrowRight') target = (index + 1) % count;
      if (event.key === 'ArrowLeft') target = (index - 1 + count) % count;
      if (event.key === 'Home') target = 0;
      if (event.key === 'End') target = count - 1;
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
    press = undefined;
    width = nextWidth;
    measureCards();
    if (compact.matches) { if (active < 0 || active >= fanCount()) active = Math.round(center); }
    else if (!hover) active = -1;
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
  dispose = () => { abort.abort(); observer.disconnect(); cancelAnimationFrame(frame); clearInterval(replayTimer); states.forEach(state => { state.stopStyle(); state.followers.forEach(stop => stop()); Object.values(state.values).forEach(value => value.destroy()); }); };
}
initializeShowcase();
document.addEventListener('site:page-change', initializeShowcase);
