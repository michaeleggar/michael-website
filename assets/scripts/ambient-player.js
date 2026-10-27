(() => {
  const panel = document.querySelector('#ambient-player');
  if (!panel) return;
  const machine = panel.querySelector('.cd-machine');
  const lcd = panel.querySelector('.cd-lcd');
  const readout = panel.querySelector('.cd-readout');
  const digits = panel.querySelector('[data-cd-time]');
  const level = panel.querySelector('.cd-level');
  const playButton = panel.querySelector('[data-cd-play]');
  const volume = panel.querySelector('input[type="range"]');
  const status = panel.querySelector('[role="status"]');
  const artwork = panel.querySelector('.cd-artwork');
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const finePointer = matchMedia('(hover: hover) and (pointer: fine)');
  let open = false;
  let tucked = false;
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
  let raisedScrollY = window.scrollY;
  let wheelDistance = 0;
  let lastWheelAt = 0;
  let touchStartY = 0;
  let spinRate = 0;
  let spinFrame;

  // Seven-segment digits, drawn as a, b, c, d, e, f, g. Unlit segments stay in the DOM.
  const SEGMENTS = ['M1.5.7h3.5', 'M5.8 1.4v3.9', 'M5.8 6.7v3.9', 'M1.5 11.3h3.5', 'M.7 6.7v3.9', 'M.7 1.4v3.9', 'M1.5 6h3.5'];
  const GLYPHS = ['abcdef', 'bc', 'abged', 'abgcd', 'fgbc', 'afgcd', 'afgedc', 'abc', 'abcdefg', 'abcdfg'];
  const cells = [0, 8.5, 23, 31.5].map(x => SEGMENTS.map(d => {
    const segment = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    segment.setAttribute('d', d);
    segment.setAttribute('transform', `translate(${x})`);
    return digits.appendChild(segment);
  }));
  const colon = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  colon.setAttribute('d', 'M18.4 3.6h1.3M18.4 8.4h1.3');
  colon.toggleAttribute('data-on', true);
  digits.appendChild(colon);

  // The ink eases up to speed and coasts to a stop, like a disc on a motor.
  // It turns by transform on top of its resting -13° rotate: Chrome restyles a
  // spinning `rotate` property on every frame, but leaves a transform to the compositor.
  const spin = artwork.animate({ transform: ['rotate(0deg)', 'rotate(360deg)'] }, { duration: 10000, iterations: Infinity });
  spin.pause();
  function setSpin(target) {
    cancelAnimationFrame(spinFrame);
    if (reduced.matches) { spinRate = 0; spin.pause(); return; }
    const from = spinRate;
    const began = performance.now();
    const duration = target ? 1400 : 2200;
    if (target) spin.play();
    (function step(now) {
      const t = Math.min(1, Math.max(0, now - began) / duration);
      spinRate = from + (target - from) * (1 - (1 - t) ** 3);
      spin.playbackRate = spinRate;
      if (t < 1) spinFrame = requestAnimationFrame(step);
      else if (!target) spin.pause();
    })(began);
  }

  // The disc plays original wind-and-leaf synthesis.
  // A future local recording can be supplied through data-audio-src on the panel.
  function createEngine() {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) throw new Error('Audio is unavailable in this browser.');
    const context = new AudioContext();
    const master = context.createGain();
    master.gain.value = 0;
    master.connect(context.destination);
    const result = { context, master };
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
        context.createMediaElementSource(audio).connect(master);
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
        noise.connect(low).connect(high).connect(breath).connect(master);
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
  let shownClock;
  function updateClock() {
    const total = Math.floor(elapsed());
    const minutes = Math.floor(total / 60);
    const text = `${String(minutes % 100).padStart(2, '0')}${String(total % 60).padStart(2, '0')}`;
    // The clock ticks four times a second; only touch the display when it changes.
    const shown = `${text} ${playing} ${busy}`;
    if (shown === shownClock) return;
    shownClock = shown;
    cells.forEach((cell, index) => {
      const lit = GLYPHS[text[index]];
      cell.forEach((segment, position) => segment.toggleAttribute('data-on', lit.includes('abcdefg'[position])));
    });
    readout.setAttribute('aria-label', `Disc 1, ${minutes} minutes ${total % 60} seconds`);
    // A held disc blinks its time, the way a paused player does.
    panel.toggleAttribute('data-paused', !playing && !busy && total > 0);
  }
  function setBusy(value) {
    busy = value;
    panel.toggleAttribute('data-loading', value);
    playButton.disabled = value;
    playButton.setAttribute('aria-busy', String(value));
    if (!value) scheduleMinimize();
  }
  function setPlaying(value) {
    playing = value;
    panel.toggleAttribute('data-playing', value);
    playButton.setAttribute('aria-label', value ? 'Pause' : 'Play');
    clearInterval(clockTimer);
    if (value) clockTimer = setInterval(() => { if (!document.hidden) updateClock(); }, 250);
    setSpin(value ? 1 : 0);
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
  function togglePlayback() {
    if (busy) return;
    if (playing) { pause(); return; }
    const token = ++operation;
    setBusy(true);
    finishPlaying(prepareAudio(), token);
  }
  function showVolume() {
    level.style.setProperty('--volume', `${Math.ceil(Number(volume.value) / 10) * 10}%`);
    volume.setAttribute('aria-valuetext', Number(volume.value) === 0 ? 'Muted' : `${volume.value}%`);
  }
  // Tucking only lowers the player; every control stays reachable in both positions.
  function setTucked(value, { instant = false } = {}) {
    if (value === tucked) return;
    clearTimeout(hoverTimer);
    clearTimeout(minimizeTimer);
    panel.toggleAttribute('data-instant', instant || reduced.matches);
    tucked = value;
    if (!value) {
      raisedScrollY = window.scrollY;
      wheelDistance = 0;
    }
    panel.toggleAttribute('data-tucked', value);
  }
  function showPlayer(value, { instant = false } = {}) {
    const token = ++visibilityGeneration;
    open = value;
    document.dispatchEvent(new CustomEvent('site:ambience-change', { detail: { open: value } }));
    if (value) {
      panel.hidden = false;
      panel.inert = false;
      panel.removeAttribute('aria-hidden');
      setTucked(false, { instant: true });
      raisedScrollY = window.scrollY;
      wheelDistance = 0;
      hasInteracted = false;
      pointerOverPlayer = false;
      getComputedStyle(machine).opacity;
      panel.toggleAttribute('data-instant', instant || reduced.matches);
      panel.setAttribute('data-open', '');
      if (instant) playButton.focus({ preventScroll: true });
    } else {
      pause();
      clearTimeout(hoverTimer);
      clearTimeout(minimizeTimer);
      activePointers.clear();
      if (panel.contains(document.activeElement)) document.querySelector('[data-site-menu="other"] [aria-haspopup="menu"]')?.focus();
      panel.inert = true;
      panel.setAttribute('aria-hidden', 'true');
      panel.toggleAttribute('data-instant', instant || reduced.matches);
      panel.removeAttribute('data-open');
      const leaving = machine.getAnimations().filter(animation => animation instanceof CSSTransition);
      Promise.allSettled(leaving.map(animation => animation.finished)).then(() => {
        if (token === visibilityGeneration && !open) panel.hidden = true;
      });
    }
  }
  function raise(options) {
    if (!open || !tucked) return;
    setTucked(false, options);
    hasInteracted = true;
  }
  function tuckAway() {
    if (!open || tucked || busy || activePointers.size || panel.querySelector(':focus-visible')) return;
    setTucked(true);
  }
  function scheduleMinimize(delay = lastPointerType === 'mouse' ? 650 : 2400) {
    clearTimeout(minimizeTimer);
    if (!open || tucked || !hasInteracted || pointerOverPlayer || activePointers.size || busy || panel.querySelector(':focus-visible')) return;
    minimizeTimer = setTimeout(() => {
      if (!pointerOverPlayer && !activePointers.size) tuckAway();
    }, delay);
  }
  playButton.addEventListener('click', togglePlayback);
  panel.querySelector('[data-cd-restart]').addEventListener('click', resetTime);
  panel.querySelector('[data-cd-stop]').addEventListener('click', () => { pause(); resetTime(); });
  volume.addEventListener('input', () => {
    showVolume();
    if (engine && playing) engine.master.gain.setTargetAtTime(Number(volume.value) / 100 * .65, engine.context.currentTime, .04);
  });
  lcd.addEventListener('wheel', event => {
    if (tucked) return;
    event.preventDefault();
    volume.value = Number(volume.value) + (event.deltaY < 0 ? 5 : -5);
    volume.dispatchEvent(new Event('input'));
  }, { passive: false });
  // The display and the disc invite the player back up; the keys just work where they are.
  panel.querySelectorAll('[data-cd-peek]').forEach(element => {
    element.addEventListener('pointerenter', event => {
      if (event.pointerType !== 'mouse' || !finePointer.matches) return;
      clearTimeout(hoverTimer);
      hoverTimer = setTimeout(raise, 140);
    });
    element.addEventListener('pointerleave', () => clearTimeout(hoverTimer));
  });
  machine.addEventListener('click', event => {
    if (!event.target.closest('button')) raise();
  });
  panel.addEventListener('pointerenter', event => {
    if (event.pointerType !== 'mouse' || !finePointer.matches) return;
    pointerOverPlayer = true;
    lastPointerType = event.pointerType;
    clearTimeout(minimizeTimer);
    if (!tucked) hasInteracted = true;
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
    if (!panel.querySelector(':focus-visible')) return;
    raise({ instant: true });
    hasInteracted = true;
    clearTimeout(minimizeTimer);
  });
  panel.addEventListener('focusout', () => queueMicrotask(() => scheduleMinimize()));
  document.addEventListener('click', event => {
    if (!panel.contains(event.target)) scheduleMinimize(650);
  });
  document.addEventListener('scroll', () => {
    if (Math.abs(window.scrollY - raisedScrollY) > 24) tuckAway();
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
    if (!tucked) {
      if (busy) pause();
      setTucked(true, { instant: true });
    } else showPlayer(false, { instant: true });
  });
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) updateClock();
  });
  window.addEventListener('pagehide', pause);
  showVolume();
  updateClock();
})();
