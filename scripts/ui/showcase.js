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
    return { values, targets: {}, stopStyle: styleEffect(card, values), followers: [], width: 0, photoHeight: 0, active: null };
  });
  let layoutScale = 1;
  let photoGrowth = 1;
  let photoTopLimit = -Infinity;
  let cardTop = 0;
  let curveShift = 0;
  let replayTimer;
  // Phones: the cards ride the top of a wheel that runs off both edges. `position`
  // is the card at the top, fractional while it turns.
  let position = 0;
  let wheelRadius = 0;
  let wheelSpacing = 0;
  let spinFrame;
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
  // How far down a card rests on the curve: a smile dips in the middle, an arch
  // (a frown, like the phone wheel) falls away at the ends, both within the baseline.
  function curveDrop(slot) {
    const direction = settings.layout.curve === 'smile' ? 1 : settings.layout.curve === 'arch' ? -1 : 0;
    const baseline = settings.layout.baseline * layoutScale;
    const arc = Math.min(baseline, slot * slot * settings.layout.curveDepth * layoutScale);
    return curveShift + (direction < 0 ? arc : baseline - direction * arc);
  }
  // Moves the curve so the middle pair of cards rests halfway between the intro
  // and the caption.
  function centreCurve() {
    const direction = settings.layout.curve === 'smile' ? 1 : settings.layout.curve === 'arch' ? -1 : 0;
    const stageTop = stage.getBoundingClientRect().top;
    const midpoint = (intro.getBoundingClientRect().bottom + caption.getBoundingClientRect().top) / 2 - stageTop;
    const middle = [Math.floor((cards.length - 1) / 2), Math.ceil((cards.length - 1) / 2)];
    const resting = middle.reduce((sum, index) => {
      const state = states[index];
      const slot = index - (cards.length - 1) / 2;
      const stagger = (index % 2 ? -settings.layout.stagger / 3 : settings.layout.stagger * 2 / 3) * layoutScale;
      const rotation = Math.max(-30, Math.min(30, -slot * settings.layout.rotation * direction));
      return sum + cardTop + curveDrop(slot) + stagger - bottomAnchor(state, rotation) + state.photoHeight / 2;
    }, 0) / middle.length;
    curveShift += midpoint - resting;
  }
  // The tallest a card can be at a given width: a project, or an upright painting.
  const tallest = cardWidth => cardWidth * Math.max(1 / settings.photos.workAspect, settings.photos.artHeight);
  // The wheel's height at a given scale: the top card raised and enlarged, and
  // the next ones down the rim, tilted. The cards grow until this fills the room.
  function wheelHeight(scale) {
    const cardWidth = settings.photos.mobileWidth * scale;
    const cardHeight = tallest(cardWidth);
    const radius = settings.layout.wheelRadius * scale;
    const angle = cardWidth * settings.layout.wheelSpacing / radius;
    const rimTop = cardHeight * settings.spotlight.scale / 2;
    const neighbour = rimTop + settings.spotlight.lift * scale + radius * (1 - Math.cos(angle)) + photoBounds(cardWidth, cardHeight, angle * 180 / Math.PI).height / 2;
    return Math.max(cardHeight * settings.spotlight.scale, neighbour) + 8;
  }
  function measureCards() {
    const mobile = compact.matches;
    const fitWidth = settings.layout.spacing * (cards.length - 1) + settings.photos.workWidth * settings.photos.artMaxWidth + 64;
    // Phones: the wheel runs off the edges anyway, so width only loosely caps it.
    const widthScale = mobile ? Math.min(1.4, Math.max(0.8, width / 300)) : Math.min(1, width / fitWidth);
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
      const sectionTop = stage.getBoundingClientRect().top + window.scrollY;
      const availableHeight = height - sectionTop - captionSpace - bottomGap;
      // Phones: as big as the room under the intro allows, so the page never scrolls.
      layoutScale = Math.min(widthScale, Math.max(0, availableHeight / (mobile ? wheelHeight(1) : settings.layout.stageHeight)));
    }
    const style = stage.parentElement.style;
    style.setProperty('--showcase-desktop-width', `${settings.photos.workWidth * layoutScale}px`);
    style.setProperty('--showcase-mobile-width', `${settings.photos.mobileWidth * layoutScale}px`);
    style.setProperty('--showcase-stage-height', `${settings.layout.stageHeight * layoutScale}px`);
    style.setProperty('--showcase-mobile-height', `${wheelHeight(layoutScale)}px`);
    cardTop = mobile ? 0 : 38 * layoutScale;
    style.setProperty('--showcase-card-top', `${cardTop}px`);
    photoGrowth = 1;
    curveShift = 0;
    states.forEach((state, index) => {
      state.width = cards[index].offsetWidth;
      state.photoHeight = cards[index].querySelector('.showcase-photo').offsetHeight;
    });
    if (mobile) {
      wheelRadius = settings.layout.wheelRadius * layoutScale;
      wheelSpacing = settings.photos.mobileWidth * layoutScale * settings.layout.wheelSpacing;
      return;
    }
    if (page) centreCurve();
    photoTopLimit = page ? intro.getBoundingClientRect().bottom - stage.getBoundingClientRect().top + settings.sizing.textClearance : -Infinity;
    let growthLimit = settings.sizing.growth;
    const direction = settings.layout.curve === 'smile' ? 1 : settings.layout.curve === 'arch' ? -1 : 0;
    states.forEach((state, index) => {
      const slot = index - (cards.length - 1) / 2;
      const stagger = (index % 2 ? -settings.layout.stagger / 3 : settings.layout.stagger * 2 / 3) * layoutScale;
      const rotation = Math.max(-30, Math.min(30, -slot * settings.layout.rotation * direction));
      const bounds = photoBounds(state.width, state.photoHeight, rotation);
      const top = cardTop + curveDrop(slot) + stagger + state.photoHeight / 2 - bounds.height / 2;
      if (bounds.height > 0) growthLimit = Math.min(growthLimit, 1 + (top - photoTopLimit) / bounds.height);
      const horizontalRoom = width / 2 - Math.abs(slot * settings.layout.spacing * layoutScale) - 12;
      if (bounds.width > 0) growthLimit = Math.min(growthLimit, horizontalRoom * 2 / bounds.width);
      if (!settings.sizing.bottomAnchored && bounds.height > 0) {
        const bottom = top + bounds.height;
        growthLimit = Math.min(growthLimit, 1 + (stage.clientHeight - bottom - 8) * 2 / (state.photoHeight + bounds.height));
      }
    });
    photoGrowth = page ? Math.max(1, settings.sizing.fitToWindow ? growthLimit : settings.sizing.growth) : 1;
    style.setProperty('--showcase-desktop-width', `${settings.photos.workWidth * layoutScale * photoGrowth}px`);
    states.forEach((state, index) => {
      state.width = cards[index].offsetWidth;
      state.photoHeight = cards[index].querySelector('.showcase-photo').offsetHeight;
    });
    // Growing lifts the cards off their bottoms, so settle the middle again.
    if (page) centreCurve();
  }
  let active = -1;
  let hover = null;
  const center = (cards.length - 1) / 2;
  let frame;
  let immediateFrame = false;
  let press;
  let suppressClick = false;
  let width = stage.clientWidth;
  const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
  const wrap = value => value - cards.length * Math.round(value / cards.length);
  const topCard = () => ((Math.round(position) % cards.length) + cards.length) % cards.length;
  function announce() {
    const card = cards[active];
    status.textContent = `${card.dataset.showcaseTitle}, ${card.dataset.kind === 'work' ? 'Project' : 'Art'} ${card.dataset.year}, ${active + 1} of ${cards.length}`;
  }
  function updateCaption(snap) {
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
  }
  function place(card, state, target, layer, snap) {
    const selected = active === cards.indexOf(card);
    if (selected !== state.active) { card.toggleAttribute('data-active', selected); state.active = selected; }
    if (state.layer !== layer) { card.style.zIndex = layer; state.layer = layer; }
    for (const key of transformKeys) {
      const value = target[key];
      if (snap) state.values[key].jump(value);
      else if (state.targets[key] !== value) state.values[key].set(value);
      state.targets[key] = value;
    }
  }
  // Each card's centre sits on the rim by its angle from the top: out along the
  // arc and down, tilted like a spoke. The one at the top rises and grows.
  function renderWheel() {
    active = topCard();
    updateCaption(true);
    const angleStep = wheelSpacing / wheelRadius;
    const maxLift = settings.spotlight.lift * layoutScale;
    const rimTop = tallest(settings.photos.mobileWidth * layoutScale) * settings.spotlight.scale / 2;
    cards.forEach((card, index) => {
      const state = states[index];
      const slot = wrap(index - position);
      const angle = slot * angleStep;
      const spot = Math.max(0, 1 - Math.abs(slot));
      const scale = 1 + (settings.spotlight.scale - 1) * spot;
      const y = rimTop + maxLift * (1 - spot) + wheelRadius * (1 - Math.cos(angle)) - state.photoHeight / 2;
      const target = { x: wheelRadius * Math.sin(angle) - state.width / 2, y, rotate: angle * 180 / Math.PI, scale };
      place(card, state, target, 100 - Math.round(Math.abs(slot) * 10), true);
    });
  }
  function render(instant = false) {
    if (compact.matches) { renderWheel(); return; }
    const step = settings.layout.spacing * layoutScale;
    const snap = instant || reduced.matches || settings.motion.reducedMotionPreview;
    updateCaption(snap);
    const hasActive = active >= 0;
    const fieldCenter = hover ? hover.x : hasActive ? (active - center) * step : null;
    const energy = hover && settings.hover.verticalInfluence ? clamp(1.2 - hover.y / 800, 0.75, 1.15) : 1;
    const direction = settings.layout.curve === 'smile' ? 1 : settings.layout.curve === 'arch' ? -1 : 0;
    cards.forEach((card, index) => {
      const state = states[index];
      const slot = index - center;
      const x = slot * step;
      // A broad pointer field lets adjacent cards share the lift and rotation.
      const distance = fieldCenter === null ? Infinity : (x - fieldCenter) / (step * settings.hover.reach);
      const influence = settings.hover.ripple ? Math.exp(-distance * distance * 1.2) : 0;
      const side = fieldCenter === null ? 0 : clamp((x - fieldCenter) / step, -1, 1);
      const lift = (influence * settings.hover.lift * energy + (active === index ? settings.spotlight.lift : 0)) * layoutScale;
      const spread = side * influence * settings.hover.spread * layoutScale;
      const stagger = (index % 2 ? -settings.layout.stagger / 3 : settings.layout.stagger * 2 / 3) * layoutScale;
      let y = curveDrop(slot) - lift + stagger;
      const restingRotation = clamp(-slot * settings.layout.rotation * direction, -30, 30);
      const rotation = active === index ? restingRotation * settings.spotlight.rotationFollow : restingRotation + side * influence * settings.hover.tilt;
      const scale = active === index ? settings.spotlight.scale : 1 + influence * (settings.hover.neighborScale - 1);
      y -= bottomAnchor(state, rotation, scale);
      if (photoGrowth > 1 && settings.sizing.protectTextOnHover) {
        const top = cardTop + y + state.photoHeight / 2 - photoBounds(state.width, state.photoHeight, rotation, scale).height / 2;
        y += Math.max(0, photoTopLimit - top);
      }
      const target = { x: x + spread - state.width / 2, y, rotate: rotation, scale };
      if (photoGrowth > 1 && settings.sizing.fitToWindow) {
        const halfWidth = photoBounds(state.width, state.photoHeight, rotation, scale).width / 2;
        target.x = clamp(x + spread, -width / 2 + halfWidth + 12, width / 2 - halfWidth - 12) - state.width / 2;
      }
      place(card, state, target, active === index && settings.spotlight.popToFront ? 100 : 10 + index, snap);
    });
  }
  function schedule(instant = false) {
    immediateFrame ||= instant;
    if (frame) return;
    frame = requestAnimationFrame(() => { frame = undefined; const immediate = immediateFrame; immediateFrame = false; render(immediate); });
  }
  function stopSpin() { cancelAnimationFrame(spinFrame); spinFrame = undefined; }
  // The wheel coasts on the flick, slowing like it has weight, then a detent
  // catches the nearest card and springs it to the top.
  function spin(velocity, settleOn) {
    stopSpin();
    const before = topCard();
    const done = () => { spinFrame = undefined; render(); if (topCard() !== before) announce(); };
    if (reduced.matches || settings.motion.reducedMotionPreview) { position = Math.round(settleOn ?? position); done(); return; }
    let target = settleOn;
    let last = performance.now();
    const step = now => {
      let elapsed = Math.min(0.05, (now - last) / 1000);
      last = now;
      while (elapsed > 0) {
        const dt = Math.min(elapsed, 1 / 240);
        if (target === undefined) {
          velocity *= Math.exp(-dt / settings.motion.wheelFriction);
          if (Math.abs(velocity) < 2.5) target = Math.round(position + velocity * 0.12);
        }
        if (target !== undefined) velocity += (-320 * (position - target) - 30 * velocity) * dt;
        position += velocity * dt;
        elapsed -= dt;
      }
      const settled = target !== undefined && Math.abs(position - target) < 0.001 && Math.abs(velocity) < 0.02;
      if (settled) position = target;
      render();
      if (settled) done(); else spinFrame = requestAnimationFrame(step);
    };
    spinFrame = requestAnimationFrame(step);
  }
  // Turns the wheel the short way round to a card.
  function turnTo(index, instant = false) {
    const to = Math.round(position) + wrap(index - topCard());
    if (instant) { stopSpin(); position = to; render(); announce(); } else spin(0, to);
  }
  function select(index, instant = false, speak = false) {
    if (compact.matches) { turnTo(index, instant); return; }
    hover = null;
    active = clamp(index, 0, cards.length - 1);
    render(instant);
    if (speak) announce();
  }
  stage.addEventListener('pointermove', event => {
    if (press && event.pointerId === press.id) {
      const dx = event.clientX - press.x;
      const dy = event.clientY - press.y;
      if (Math.hypot(dx, dy) > 7) suppressClick = true;
      if (compact.matches && suppressClick) {
        // The rim moves with the thumb.
        position = press.position - dx / wheelSpacing;
        press.samples.push({ x: event.clientX, t: event.timeStamp });
        if (press.samples.length > 6) press.samples.shift();
        schedule();
      }
      return;
    }
    if (compact.matches || !finePointer.matches || reduced.matches || settings.motion.reducedMotionPreview || settings.preview.enabled) return;
    const rect = stage.getBoundingClientRect();
    setHover(event.clientX - rect.left, event.clientY - rect.top);
  }, options);
  function setHover(localX, localY) {
    const step = settings.layout.spacing * layoutScale;
    const direction = settings.layout.curve === 'smile' ? 1 : settings.layout.curve === 'arch' ? -1 : 0;
    let next = -1;
    let closest = Infinity;
    cards.forEach((card, index) => {
      const slot = index - center;
      const x = width / 2 + slot * step;
      const stagger = (index % 2 ? -settings.layout.stagger / 3 : settings.layout.stagger * 2 / 3) * layoutScale;
      const rotation = clamp(-slot * settings.layout.rotation * direction, -30, 30);
      const top = cardTop + curveDrop(slot) + stagger - bottomAnchor(states[index], rotation);
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
    if (compact.matches) stopSpin();
    press = { id: event.pointerId, x: event.clientX, y: event.clientY, position, samples: [{ x: event.clientX, t: event.timeStamp }] };
  }, options);
  window.addEventListener('pointerup', event => {
    if (!press || event.pointerId !== press.id) return;
    const ended = press;
    press = undefined;
    cancelAnimationFrame(frame); frame = undefined; immediateFrame = false;
    if (!compact.matches) { render(); return; }
    if (!suppressClick) { if (!spinFrame) spin(0, Math.round(position)); return; }
    // The flick's speed over its last ~100ms, in cards a second.
    const recent = ended.samples.filter(sample => event.timeStamp - sample.t < 100);
    const first = recent[0];
    const speed = first && event.timeStamp > first.t ? (event.clientX - first.x) / (event.timeStamp - first.t) : 0;
    spin(-speed * 1000 / wheelSpacing);
  }, options);
  window.addEventListener('pointercancel', () => {
    press = undefined; suppressClick = false;
    cancelAnimationFrame(frame); frame = undefined; immediateFrame = false;
    if (compact.matches) spin(0, Math.round(position)); else render();
  }, options);
  stage.addEventListener('dragstart', event => event.preventDefault(), options);
  stage.addEventListener('click', event => {
    if (suppressClick && event.detail !== 0) { event.preventDefault(); event.stopImmediatePropagation(); suppressClick = false; return; }
    suppressClick = false;
    const card = event.target.closest('.showcase-card');
    // On phones a tap turns a card to the top; tapping the top card opens it.
    if (compact.matches && card && cards.indexOf(card) !== topCard()) {
      event.preventDefault(); event.stopImmediatePropagation();
      turnTo(cards.indexOf(card), event.detail === 0);
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
    stopSpin();
    width = nextWidth;
    if (compact.matches) position = Math.round(position);
    else if (!hover) active = -1;
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
  dispose = () => { abort.abort(); observer.disconnect(); cancelAnimationFrame(frame); stopSpin(); clearInterval(replayTimer); states.forEach(state => { state.stopStyle(); state.followers.forEach(stop => stop()); Object.values(state.values).forEach(value => value.destroy()); }); };
}
initializeShowcase();
document.addEventListener('site:page-change', initializeShowcase);
