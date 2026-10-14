(() => {
  const panel = document.querySelector('#ambient-player');
  if (!panel) return;
  const expandedView = panel.querySelector('.cd-expanded');
  const mini = panel.querySelector('.cd-mini');
  const expandButton = panel.querySelector('[data-cd-expand]');
  const playButtons = [...panel.querySelectorAll('[data-cd-play]')];
  const volume = panel.querySelector('input[type="range"]');
  const status = panel.querySelector('[role="status"]');
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const finePointer = matchMedia('(hover: hover) and (pointer: fine)');
  let open = false;
  let expanded = true;
  let playing = false;
  let busy = false;
  let engine;
  let operation = 0;
  let visibilityGeneration = 0;
  let suspendTimer;
  let hoverTimer;
  let minimizeTimer;
  let hasInteracted = false;
  let pointerOverPlayer = false;
  let lastPointerType = 'mouse';
  const activePointers = new Set();
  let clockTimer;
  let seconds = 0;
  let startedAt = 0;
  let expandedScrollY = window.scrollY;
  let wheelDistance = 0;
  let lastWheelAt = 0;
  let touchStartY = 0;

  // The disc plays original wind-and-leaf synthesis.
  // A future local recording can be supplied through data-audio-src on the panel.
  function createEngine() {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) throw new Error('Audio is unavailable in this browser.');
    const context = new AudioContext();
    const master = context.createGain();
    const analyser = context.createAnalyser();
    analyser.fftSize = 256;
    master.gain.value = 0;
    analyser.connect(master).connect(context.destination);
    const result = { context, master, analyser, samples: new Uint8Array(analyser.fftSize) };
    context.addEventListener('statechange', () => {
      if (playing && context.state !== 'running') {
        pause();
        status.textContent = 'Playback paused.';
      }
    });
    try {
      if (panel.dataset.audioSrc) {
        const audio = new Audio(panel.dataset.audioSrc);
        audio.loop = true;
        audio.preload = 'none';
        audio.addEventListener('error', () => {
          pause();
          panel.setAttribute('data-error', '');
          status.textContent = 'Couldn’t load the recording. Press play to try again.';
        });
        context.createMediaElementSource(audio).connect(analyser);
        result.audio = audio;
        return result;
      }
      const frames = context.sampleRate * 12;
      const buffer = context.createBuffer(2, frames, context.sampleRate);
      for (let channel = 0; channel < 2; channel++) {
        const data = buffer.getChannelData(channel);
        for (let i = 0; i < frames; i++) data[i] = Math.random() * 2 - 1;
        // Taper the loop boundary. Filtering smooths the very short, silent seam.
        const seam = Math.floor(context.sampleRate * .02);
        for (let i = 0; i < seam; i++) {
          data[i] *= i / seam;
          data[frames - 1 - i] *= i / seam;
        }
      }
      function layer({ cutoff, highpass, gain, depth, rate, offset }) {
        const noise = context.createBufferSource();
        noise.buffer = buffer;
        noise.loop = true;
        const low = context.createBiquadFilter();
        low.type = 'lowpass';
        low.frequency.value = cutoff;
        low.Q.value = .5;
        const high = context.createBiquadFilter();
        high.type = 'highpass';
        high.frequency.value = highpass;
        const breath = context.createGain();
        breath.gain.value = gain;
        const breeze = context.createOscillator();
        breeze.frequency.value = rate;
        const amount = context.createGain();
        amount.gain.value = depth;
        breeze.connect(amount).connect(breath.gain);
        noise.connect(low).connect(high).connect(breath).connect(analyser);
        noise.start(0, offset);
        breeze.start();
      }
      layer({ cutoff: 650, highpass: 65, gain: 1.2, depth: .55, rate: .073, offset: 0 });
      layer({ cutoff: 3200, highpass: 1100, gain: .19, depth: .12, rate: .117, offset: 4.3 });
      layer({ cutoff: 1800, highpass: 450, gain: .24, depth: .14, rate: .043, offset: 8.1 });
      return result;
    } catch (error) {
      context.close().catch(() => {});
      throw error;
    }
  }

  function elapsed() {
    if (engine?.audio) return engine.audio.currentTime;
    return seconds + (playing ? engine.context.currentTime - startedAt : 0);
  }
  function updateClock() {
    const total = Math.floor(elapsed());
    const time = `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
    panel.querySelector('[data-cd-time]').textContent = time;
    panel.querySelector('.cd-lcd').setAttribute('aria-label', `Disc 1, ${Math.floor(total / 60)} minutes ${total % 60} seconds`);
  }
  function setBusy(value) {
    busy = value;
    panel.toggleAttribute('data-loading', value);
    playButtons.forEach(button => {
      button.disabled = value;
      button.setAttribute('aria-busy', String(value));
    });
    if (!value) scheduleMinimize();
  }
  function setPlaying(value) {
    playing = value;
    panel.toggleAttribute('data-playing', value);
    playButtons.forEach(button => button.setAttribute('aria-label', value ? 'Pause' : 'Play'));
    clearInterval(clockTimer);
    if (value) clockTimer = setInterval(() => { if (!document.hidden) updateClock(); }, 250);
    updateClock();
  }
  function pause() {
    seconds = elapsed();
    operation++;
    setBusy(false);
    clearTimeout(suspendTimer);
    setPlaying(false);
    if (engine) {
      engine.master.gain.setTargetAtTime(0, engine.context.currentTime, .035);
      engine.audio?.pause();
      suspendTimer = setTimeout(() => {
        if (!playing && !busy) engine.context.suspend().catch(() => {});
      }, 200);
    }
    status.textContent = '';
  }
  function resetTime() {
    seconds = 0;
    if (engine) startedAt = engine.context.currentTime;
    if (engine?.audio) engine.audio.currentTime = 0;
    updateClock();
  }
  function fail() {
    pause();
    panel.setAttribute('data-error', '');
    status.textContent = 'Audio couldn’t start. Press play to try again.';
  }
  function prepareAudio() {
    clearTimeout(suspendTimer);
    panel.removeAttribute('data-error');
    try {
      engine ||= createEngine();
      // Resume inside the user gesture so browser audio policies allow playback.
      return Promise.all([engine.context.resume(), engine.audio?.play()]).then(() => true, () => false);
    } catch {
      return Promise.resolve(false);
    }
  }
  async function finishPlaying(ready, token) {
    const success = await ready;
    if (token !== operation) {
      if (!playing && !busy) {
        engine?.audio?.pause();
        engine?.context.suspend().catch(() => {});
      }
      return;
    }
    if (!success || engine.context.state !== 'running') { fail(); return; }
    startedAt = engine.context.currentTime;
    setBusy(false);
    engine.master.gain.setTargetAtTime(Number(volume.value) / 100 * .65, engine.context.currentTime, .22);
    setPlaying(true);
    status.textContent = 'Playing.';
  }
  function togglePlayback(event) {
    if (busy) return;
    if (playing) { pause(); return; }
    panel.toggleAttribute('data-instant', event.detail === 0);
    const token = ++operation;
    setBusy(true);
    finishPlaying(prepareAudio(), token);
  }
  function setExpanded(value, { focus = false, instant = false } = {}) {
    if (value === expanded) return;
    clearTimeout(hoverTimer);
    clearTimeout(minimizeTimer);
    panel.toggleAttribute('data-instant', instant || reduced.matches);
    expanded = value;
    if (value) {
      expandedScrollY = window.scrollY;
      wheelDistance = 0;
    }
    panel.dataset.expanded = String(value);
    expandButton.setAttribute('aria-expanded', String(value));
    const from = value ? mini : expandedView;
    const to = value ? expandedView : mini;
    to.inert = false;
    to.removeAttribute('aria-hidden');
    if (focus || from.contains(document.activeElement)) {
      (value ? playButtons[0] : expandButton).focus({ preventScroll: true });
    }
    from.inert = true;
    from.setAttribute('aria-hidden', 'true');
  }
  function showPlayer(value, { instant = false } = {}) {
    const token = ++visibilityGeneration;
    open = value;
    panel.toggleAttribute('data-instant', instant || reduced.matches);
    document.dispatchEvent(new CustomEvent('site:ambience-change', { detail: { open: value } }));
    if (value) {
      expandedScrollY = window.scrollY;
      wheelDistance = 0;
      panel.hidden = false;
      panel.inert = false;
      panel.removeAttribute('aria-hidden');
      setExpanded(true, { instant });
      hasInteracted = false;
      pointerOverPlayer = false;
      getComputedStyle(panel).opacity;
      panel.setAttribute('data-open', '');
      if (instant) playButtons[0].focus({ preventScroll: true });
    } else {
      pause();
      clearTimeout(hoverTimer);
      clearTimeout(minimizeTimer);
      activePointers.clear();
      if (panel.contains(document.activeElement)) document.querySelector('[data-contact-menu] [aria-haspopup="menu"]')?.focus();
      panel.inert = true;
      panel.setAttribute('aria-hidden', 'true');
      panel.removeAttribute('data-open');
      Promise.allSettled(panel.getAnimations().map(animation => animation.finished)).then(() => {
        if (token === visibilityGeneration && !open) panel.hidden = true;
      });
    }
  }
  function tuckAway() {
    if (!open || !expanded || busy || activePointers.size || expandedView.querySelector(':focus-visible')) return;
    setExpanded(false);
  }
  function scheduleMinimize(delay = lastPointerType === 'mouse' ? 650 : 2400) {
    clearTimeout(minimizeTimer);
    if (!open || !expanded || !hasInteracted || pointerOverPlayer || activePointers.size || busy || expandedView.querySelector(':focus-visible')) return;
    minimizeTimer = setTimeout(() => {
      if (!pointerOverPlayer && !activePointers.size) tuckAway();
    }, delay);
  }
  playButtons.forEach(button => button.addEventListener('click', togglePlayback));
  panel.querySelector('[data-cd-restart]').addEventListener('click', resetTime);
  panel.querySelector('[data-cd-stop]').addEventListener('click', () => { pause(); resetTime(); });
  volume.addEventListener('input', () => {
    volume.style.setProperty('--volume', `${Math.ceil(Number(volume.value) / 10) * 10}%`);
    volume.setAttribute('aria-valuetext', Number(volume.value) === 0 ? 'Muted' : `${volume.value}%`);
    if (engine && playing) engine.master.gain.setTargetAtTime(Number(volume.value) / 100 * .65, engine.context.currentTime, .04);
  });
  expandButton.addEventListener('click', event => {
    setExpanded(true, { focus: event.detail === 0, instant: event.detail === 0 });
    hasInteracted = true;
    scheduleMinimize();
  });
  expandButton.addEventListener('pointerenter', event => {
    if (event.pointerType !== 'mouse' || !finePointer.matches) return;
    clearTimeout(hoverTimer);
    hoverTimer = setTimeout(() => {
      if (open && !expanded) {
        setExpanded(true);
        hasInteracted = true;
      }
    }, 160);
  });
  expandButton.addEventListener('pointerleave', () => { if (!expanded) clearTimeout(hoverTimer); });
  panel.addEventListener('pointerenter', event => {
    if (event.pointerType !== 'mouse' || !finePointer.matches) return;
    pointerOverPlayer = true;
    lastPointerType = event.pointerType;
    clearTimeout(minimizeTimer);
    if (expanded) hasInteracted = true;
  });
  panel.addEventListener('pointerleave', event => {
    if (event.pointerType !== 'mouse') return;
    pointerOverPlayer = false;
    scheduleMinimize();
  });
  panel.addEventListener('pointerdown', event => {
    lastPointerType = event.pointerType;
    if (event.pointerType !== 'mouse') pointerOverPlayer = false;
    activePointers.add(event.pointerId);
    hasInteracted = true;
    clearTimeout(minimizeTimer);
  });
  function endPointerInteraction(event) {
    if (!activePointers.delete(event.pointerId)) return;
    scheduleMinimize();
  }
  document.addEventListener('pointerup', endPointerInteraction);
  document.addEventListener('pointercancel', endPointerInteraction);
  panel.addEventListener('focusin', () => {
    if (!expanded) return;
    hasInteracted = true;
    clearTimeout(minimizeTimer);
  });
  panel.addEventListener('focusout', () => queueMicrotask(() => scheduleMinimize()));
  document.addEventListener('click', event => {
    if (!panel.contains(event.target)) scheduleMinimize(650);
  });
  document.addEventListener('scroll', () => {
    if (Math.abs(window.scrollY - expandedScrollY) > 24) tuckAway();
  }, { passive: true });
  document.addEventListener('wheel', event => {
    if (panel.contains(event.target)) return;
    const now = performance.now();
    if (now - lastWheelAt > 180) wheelDistance = 0;
    lastWheelAt = now;
    wheelDistance += Math.abs(event.deltaY) * (event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? window.innerHeight : 1);
    if (wheelDistance >= 32) tuckAway();
  }, { passive: true });
  document.addEventListener('touchstart', event => { touchStartY = event.touches[0]?.clientY || 0; }, { passive: true });
  document.addEventListener('touchmove', event => {
    if (!panel.contains(event.target) && Math.abs((event.touches[0]?.clientY ?? touchStartY) - touchStartY) > 24) tuckAway();
  }, { passive: true });
  document.addEventListener('site:page-change', tuckAway);
  document.addEventListener('site:ambience-toggle', event => showPlayer(!open, { instant: event.detail?.instant === true }));
  document.addEventListener('keydown', event => {
    if (event.key !== 'Escape' || !open) return;
    if (expanded) {
      if (busy) pause();
      setExpanded(false, { instant: true });
    } else showPlayer(false, { instant: true });
  });
  document.addEventListener('visibilitychange', () => {
    panel.toggleAttribute('data-background', document.hidden);
    if (!document.hidden) updateClock();
  });
  window.addEventListener('pagehide', pause);
})();
