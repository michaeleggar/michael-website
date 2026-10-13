const localHost = ['localhost', '127.0.0.1', '[::1]'].includes(location.hostname);
if (localHost) startShowcaseTuner().catch(error => console.error('Could not load showcase controls.', error));

async function startShowcaseTuner() {
  if (!window.siteShowcase) await new Promise(resolve => document.addEventListener('showcase:ready', resolve, { once: true }));
  const [DialKit] = await Promise.all([
    import('/assets/scripts/vendor/dialkit.js'),
    new Promise((resolve, reject) => {
      const link = document.createElement('link'); link.rel = 'stylesheet'; link.href = '/assets/css/vendor/dialkit.css';
      link.onload = resolve; link.onerror = reject; document.head.append(link);
    }),
  ]);
  const api = window.siteShowcase;
  const d = api.getDefaults();
  const slider = (group, key, min, max, step = 1) => [d[group][key], min, max, step];
  const action = label => ({ type: 'action', label });
  const config = {
    sizing: {
      growth: slider('sizing', 'growth', 1, 1.8, 0.01),
      textClearance: slider('sizing', 'textClearance', 0, 100),
      bottomAnchored: d.sizing.bottomAnchored,
      fitToWindow: d.sizing.fitToWindow,
      protectTextOnHover: d.sizing.protectTextOnHover,
      matchCaptionToNav: d.sizing.matchCaptionToNav,
      captionBottomGap: slider('sizing', 'captionBottomGap', 0, 80),
    },
    motion: {
      _collapsed: true,
      spring: d.motion.spring,
      reducedMotionPreview: false,
    },
    hover: {
      _collapsed: true,
      ripple: true,
      reach: slider('hover', 'reach', 0.5, 4, 0.05),
      lift: slider('hover', 'lift', 0, 80),
      spread: slider('hover', 'spread', 0, 80),
      tilt: slider('hover', 'tilt', 0, 15, 0.1),
      neighborScale: slider('hover', 'neighborScale', 1, 1.2, 0.005),
      verticalInfluence: true,
    },
    spotlight: {
      _collapsed: true,
      popToFront: true,
      lift: slider('spotlight', 'lift', 0, 60),
      scale: slider('spotlight', 'scale', 1, 1.3, 0.005),
      rotationFollow: slider('spotlight', 'rotationFollow', 0, 1, 0.01),
      showLabels: true,
    },
    layout: {
      _collapsed: true,
      curve: { type: 'select', options: [{ value: 'smile', label: 'Smile' }, { value: 'arch', label: 'Arch' }, { value: 'flat', label: 'Flat' }], default: 'smile' },
      maxWidth: slider('layout', 'maxWidth', 600, 1600, 10),
      spacing: slider('layout', 'spacing', 60, 180),
      mobileSpacing: slider('layout', 'mobileSpacing', 60, 150),
      curveDepth: slider('layout', 'curveDepth', 0, 16, 0.25),
      rotation: slider('layout', 'rotation', 0, 10, 0.1),
      baseline: slider('layout', 'baseline', 20, 180),
      stagger: slider('layout', 'stagger', 0, 60),
      stageHeight: slider('layout', 'stageHeight', 280, 600, 10),
      mobileHeight: slider('layout', 'mobileHeight', 280, 500, 10),
    },
    photos: {
      _collapsed: true,
      workWidth: slider('photos', 'workWidth', 160, 360),
      mobileWidth: slider('photos', 'mobileWidth', 150, 280),
      workAspect: slider('photos', 'workAspect', 1, 2.4, 0.05),
      artHeight: slider('photos', 'artHeight', 0.5, 1.2, 0.01),
      artMaxWidth: slider('photos', 'artMaxWidth', 0.8, 1.6, 0.01),
      workRadius: slider('photos', 'workRadius', 0, 60),
      artRadius: slider('photos', 'artRadius', 0, 60),
      workFit: { type: 'select', options: ['cover', 'contain'], default: 'cover' },
    },
    appearance: {
      _collapsed: true,
      shadow: true,
      shadowOffset: slider('appearance', 'shadowOffset', 0, 30),
      shadowBlur: slider('appearance', 'shadowBlur', 0, 60),
      shadowOpacity: slider('appearance', 'shadowOpacity', 0, 100),
      labelSize: slider('appearance', 'labelSize', 10, 20, 0.5),
      labelGap: slider('appearance', 'labelGap', 0, 24),
      detailSize: slider('appearance', 'detailSize', 9, 16, 0.5),
      inactiveBlur: d.appearance.inactiveBlur,
      blurAmount: slider('appearance', 'blurAmount', 0, 8, 0.25),
      blurDuration: slider('appearance', 'blurDuration', 0, 300, 10),
      customFrameColor: false,
      frameColor: { type: 'color', default: d.appearance.frameColor },
    },
    preview: {
      _collapsed: true,
      enabled: false,
      point: { type: 'pad', x: [0, -1, 1, 0.01], y: [0, -1, 1, 0.01], labels: { x: 'Hover across fan', y: 'Hover height' } },
    },
    presets: { _collapsed: true, snappy: action('Snappy'), bouncy: action('Extra bouncy'), gentle: action('Gentle') },
    replay: action('Replay hover sweep'),
    exportSettings: action('Export showcase settings'),
    reset: action('Reset all showcase settings'),
  };
  const root = DialKit.createDialRoot({ position: 'bottom-right', theme: 'dark', defaultOpen: true });
  root.element.dataset.showcaseControls = '';
  const style = document.createElement('style');
  style.textContent = '[data-showcase-controls] .dialkit-panel-inner:not([data-collapsed="true"]) { max-height: calc(100dvh - 100px) !important; }';
  document.head.append(style);
  let kit;
  function applySpringPreset(spring) {
    kit.setValues({ motion: { spring } });
    DialKit.DialStore.updateTransitionMode(kit.id, 'motion.spring', 'advanced');
  }
  kit = DialKit.createDialKit('Showcase · Motion & Layout', config, {
    id: 'michael-showcase-motion-v1', persist: { presets: true }, defaultCollapsed: false,
    onAction(name) {
      if (name === 'reset') kit.resetValues();
      if (name === 'replay') api.replay();
      if (name === 'presets.snappy') applySpringPreset({ type: 'spring', stiffness: 650, damping: 24, mass: 0.55 });
      if (name === 'presets.bouncy') applySpringPreset({ type: 'spring', stiffness: 600, damping: 18, mass: 0.5 });
      if (name === 'presets.gentle') applySpringPreset({ type: 'spring', stiffness: 400, damping: 30, mass: 0.8 });
      if (name === 'exportSettings') {
        const url = URL.createObjectURL(new Blob([JSON.stringify(api.getValues(), null, 2)], { type: 'application/json' }));
        const link = document.createElement('a'); link.href = url; link.download = 'showcase-settings.json'; link.click();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
      }
    },
  });
  const stop = kit.subscribe(values => api.setValues(values));
  function syncPage() { root.element.style.display = document.querySelector('[data-showcase]') ? '' : 'none'; }
  syncPage(); document.addEventListener('site:page-change', syncPage);
  window.addEventListener('pagehide', event => {
    if (event.persisted) return;
    stop(); kit.destroy(); root.destroy(); style.remove(); document.removeEventListener('site:page-change', syncPage);
  });
}
