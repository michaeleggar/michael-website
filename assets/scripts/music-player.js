(() => {
  const panel = document.querySelector('#music-player');
  if (!panel) return;

  // Official, verified Magdalena Bay upload; streaming and embeds are enabled.
  const trackURL = 'https://soundcloud.com/magbae/angel-on-a-satellite';
  const play = panel.querySelector('[data-music-play]');
  const seek = panel.querySelector('.music-player-seek');
  const status = panel.querySelector('.music-player-status');
  const source = panel.querySelector('[data-music-source]');
  const sourceToggle = panel.querySelector('[data-music-source-toggle]');
  let player;
  let frame;
  let ready = false;
  let loading = false;
  let pendingPlay = false;
  let dragging = false;
  let finished = false;
  let duration = 243;
  let loadTimer;
  let playTimer;
  let progressTimer;
  let apiPromise;
  let generation = 0;
  let lastProgressAt = 0;
  let lastPosition = 0;
  const time = seconds => `${Math.floor(seconds / 60)}:${String(Math.floor(seconds) % 60).padStart(2, '0')}`;

  function updateProgress(seconds) {
    const position = Math.max(0, Math.min(duration, Number(seconds) || 0));
    seek.value = position;
    seek.style.setProperty('--progress', `${position / duration * 100}%`);
    seek.setAttribute('aria-valuetext', `${time(position)} of ${time(duration)}`);
  }

  function showSource(value) {
    source.hidden = !value;
    sourceToggle.setAttribute('aria-expanded', String(value));
    sourceToggle.setAttribute('aria-label', `${value ? 'Hide' : 'Show'} SoundCloud player`);
  }

  function setPlaying(value) {
    panel.toggleAttribute('data-playing', value);
    play.setAttribute('aria-label', `${value ? 'Pause' : 'Play'} Angel on a Satellite`);
    play.removeAttribute('aria-busy');
    clearInterval(progressTimer);
    if (value) {
      lastProgressAt = Date.now();
      progressTimer = setInterval(() => {
        if (dragging || Date.now() - lastProgressAt < 4000) return;
        status.textContent = 'Buffering audio…';
        play.setAttribute('aria-busy', 'true');
      }, 1000);
    }
  }

  function clearPlaybackStatus() {
    clearTimeout(playTimer);
    pendingPlay = false;
    status.textContent = '';
    play.removeAttribute('aria-busy');
    panel.removeAttribute('data-error');
  }

  function fail(message, reset = false) {
    clearTimeout(loadTimer);
    clearTimeout(playTimer);
    pendingPlay = false;
    setPlaying(false);
    panel.setAttribute('data-error', '');
    status.textContent = message;
    showSource(false);
    if (reset) {
      generation++;
      ready = loading = false;
      dragging = false;
      seek.disabled = true;
      if (player && window.SC?.Widget?.Events) {
        for (const event of Object.values(window.SC.Widget.Events)) player.unbind(event);
      }
      frame?.remove();
      frame = player = null;
    }
  }

  function loadAPI() {
    if (window.SC?.Widget) return Promise.resolve();
    if (apiPromise) return apiPromise;
    const request = new Promise((resolve, reject) => {
      const script = document.createElement('script');
      let timeout;
      const failed = () => {
        clearTimeout(timeout);
        script.remove();
        reject(new Error('SoundCloud API failed to load'));
      };
      script.src = 'https://w.soundcloud.com/player/api.js';
      script.async = true;
      script.onload = () => {
        clearTimeout(timeout);
        if (window.SC?.Widget) resolve();
        else failed();
      };
      script.onerror = failed;
      timeout = setTimeout(failed, 15000);
      document.head.append(script);
    });
    apiPromise = request.catch(error => {
      apiPromise = null;
      throw error;
    });
    return apiPromise;
  }

  function startPlayback() {
    // Keep the native widget visible during playback, including provider ads.
    showSource(true);
    panel.removeAttribute('data-error');
    status.textContent = 'Loading audio…';
    play.setAttribute('aria-busy', 'true');
    pendingPlay = true;
    clearTimeout(playTimer);
    const attempt = generation;
    playTimer = setTimeout(() => {
      if (attempt !== generation) return;
      player.pause();
      fail('SoundCloud didn’t start. Press play to retry.');
    }, 20000);
    if (finished) {
      player.seekTo(0);
      finished = false;
    }
    player.setVolume(70);
    player.play();
  }

  async function initialize() {
    if (loading || ready) return;
    loading = true;
    const attempt = ++generation;
    loadTimer = setTimeout(() => fail('Couldn’t load SoundCloud. Press play to retry.', true), 25000);
    try {
      await loadAPI();
      if (attempt !== generation) return;
      frame = document.createElement('iframe');
      frame.title = 'Angel on a Satellite by Magdalena Bay — SoundCloud player';
      frame.width = '100%';
      frame.height = '166';
      frame.style.cssText = 'display: block; width: 100%; height: 166px; border: 0; border-radius: 8px;';
      frame.allow = 'autoplay; encrypted-media';
      frame.referrerPolicy = 'strict-origin-when-cross-origin';
      const params = new URLSearchParams({
        url: trackURL, auto_play: 'false', visual: 'false',
        show_artwork: 'false', show_comments: 'false', show_user: 'true',
      });
      frame.src = `https://w.soundcloud.com/player/?${params}`;
      source.append(frame);
      player = window.SC.Widget(frame);
      const widget = player;
      const events = window.SC.Widget.Events;
      const bind = (event, listener) => widget.bind(event, data => {
        if (attempt === generation) listener(data);
      });
      bind(events.READY, () => {
        clearTimeout(loadTimer);
        ready = true;
        loading = false;
        seek.disabled = false;
        panel.removeAttribute('data-error');
        status.textContent = '';
        widget.getDuration(milliseconds => {
          if (attempt !== generation || !(milliseconds > 0)) return;
          duration = milliseconds / 1000;
          seek.max = duration;
          updateProgress(Number(seek.value));
        });
        if (pendingPlay) startPlayback();
      });
      bind(events.PLAY, () => {
        if (source.hidden) {
          widget.pause();
          return;
        }
        finished = false;
        showSource(true);
        clearPlaybackStatus();
        setPlaying(true);
      });
      bind(events.PAUSE, () => {
        if (!panel.hasAttribute('data-error')) clearPlaybackStatus();
        setPlaying(false);
      });
      bind(events.FINISH, () => {
        finished = true;
        clearPlaybackStatus();
        setPlaying(false);
        updateProgress(0);
      });
      bind(events.PLAY_PROGRESS, data => {
        const position = data.currentPosition / 1000;
        if (!Number.isFinite(position)) return;
        if (Math.abs(position - lastPosition) > 0.01) {
          lastPosition = position;
          lastProgressAt = Date.now();
          play.removeAttribute('aria-busy');
          if (!panel.hasAttribute('data-error')) status.textContent = '';
        }
        if (!dragging) updateProgress(position);
      });
      bind(events.SEEK, data => {
        lastProgressAt = Date.now();
        if (!dragging) updateProgress(data.currentPosition / 1000);
      });
      bind(events.LOAD_PROGRESS, () => {
        if (pendingPlay) status.textContent = 'Loading audio…';
      });
      bind(events.ERROR, () => {
        fail('This track couldn’t play on SoundCloud. Press play to retry, or open the song link.', true);
      });
    } catch {
      if (attempt === generation) fail('Couldn’t load SoundCloud. Press play to retry.', true);
    }
  }

  function pausePlayback() {
    pendingPlay = false;
    clearTimeout(playTimer);
    player?.pause();
    setPlaying(false);
    if (!panel.hasAttribute('data-error')) status.textContent = '';
  }

  play.addEventListener('click', () => {
    if (pendingPlay || panel.hasAttribute('data-playing')) {
      pausePlayback();
      return;
    }
    showSource(true);
    if (!ready) {
      panel.removeAttribute('data-error');
      pendingPlay = true;
      status.textContent = 'Loading audio…';
      play.setAttribute('aria-busy', 'true');
      initialize();
      return;
    }
    startPlayback();
  });
  seek.addEventListener('input', () => {
    dragging = true;
    updateProgress(Number(seek.value));
  });
  seek.addEventListener('change', () => {
    if (ready) player.seekTo(Number(seek.value) * 1000);
    dragging = false;
    lastProgressAt = Date.now();
  });
  sourceToggle.addEventListener('click', () => {
    if (!source.hidden) {
      pausePlayback();
      showSource(false);
      return;
    }
    showSource(true);
    initialize();
  });
  panel.querySelector('[data-music-source-close]').addEventListener('click', () => {
    pausePlayback();
    showSource(false);
    sourceToggle.focus();
  });
  // Prepare metadata, without autoplay; actual playback always comes from a click.
  initialize();
})();
