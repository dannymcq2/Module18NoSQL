// Audio engine: synthesizes all training material with the Web Audio API,
// so the app needs no audio files and works offline.
const AudioEngine = (() => {
  let ctx = null;
  let master = null;
  let current = null; // currently playing node chain { stop() }
  let pinkBuffer = null;

  function ensureCtx() {
    if (!ctx) {
      ctx = new (window.AudioContext || window.webkitAudioContext)();
      master = ctx.createGain();
      master.gain.value = 0.5;
      master.connect(ctx.destination);
    }
    if (ctx.state === 'suspended') ctx.resume();
    return ctx;
  }

  // Pink noise sounds even across the spectrum to human ears — the standard
  // material for EQ training.
  function getPinkBuffer() {
    if (pinkBuffer) return pinkBuffer;
    const len = ctx.sampleRate * 2;
    pinkBuffer = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let ch = 0; ch < 2; ch++) {
      const data = pinkBuffer.getChannelData(ch);
      let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
      for (let i = 0; i < len; i++) {
        const white = Math.random() * 2 - 1;
        b0 = 0.99886 * b0 + white * 0.0555179;
        b1 = 0.99332 * b1 + white * 0.0750759;
        b2 = 0.96900 * b2 + white * 0.1538520;
        b3 = 0.86650 * b3 + white * 0.3104856;
        b4 = 0.55000 * b4 + white * 0.5329522;
        b5 = -0.7616 * b5 - white * 0.0168980;
        data[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362) * 0.11;
        b6 = white * 0.115926;
      }
    }
    return pinkBuffer;
  }

  function stop() {
    if (current) {
      try { current.stop(); } catch (e) { /* already stopped */ }
      current = null;
    }
  }

  function makeNoiseSource() {
    const src = ctx.createBufferSource();
    src.buffer = getPinkBuffer();
    src.loop = true;
    return src;
  }

  // Fade helper to avoid clicks
  function envelope(gainNode, duration) {
    const now = ctx.currentTime;
    gainNode.gain.setValueAtTime(0, now);
    gainNode.gain.linearRampToValueAtTime(1, now + 0.02);
    if (duration) {
      gainNode.gain.setValueAtTime(1, now + duration - 0.03);
      gainNode.gain.linearRampToValueAtTime(0, now + duration);
    }
  }

  // Play pink noise, optionally through a peaking EQ boost/cut.
  // opts: { freq, gainDb, q, duration }
  function playNoiseEQ(opts = {}) {
    ensureCtx();
    stop();
    const src = makeNoiseSource();
    const g = ctx.createGain();
    let node = src;
    if (opts.freq && opts.gainDb) {
      const eq = ctx.createBiquadFilter();
      eq.type = 'peaking';
      eq.frequency.value = opts.freq;
      eq.gain.value = opts.gainDb;
      eq.Q.value = opts.q || 2;
      node.connect(eq);
      node = eq;
    }
    node.connect(g);
    g.connect(master);
    envelope(g, opts.duration);
    src.start();
    if (opts.duration) src.stop(ctx.currentTime + opts.duration + 0.05);
    current = { stop: () => { try { src.stop(); } catch (e) {} } };
    if (opts.duration) src.onended = () => { if (opts.onended) opts.onended(); };
    return current;
  }

  // Play a short panned noise burst. pan: -1..1
  function playPanned(pan, duration = 1.2, onended) {
    ensureCtx();
    stop();
    const src = makeNoiseSource();
    const g = ctx.createGain();
    const panner = ctx.createStereoPanner();
    panner.pan.value = pan;
    src.connect(g);
    g.connect(panner);
    panner.connect(master);
    envelope(g, duration);
    src.start();
    src.stop(ctx.currentTime + duration + 0.05);
    src.onended = () => { if (onended) onended(); };
    current = { stop: () => { try { src.stop(); } catch (e) {} } };
    return current;
  }

  // Play noise at a relative level in dB (0 = reference).
  function playLevel(levelDb, duration = 1.0, onended) {
    ensureCtx();
    stop();
    const src = makeNoiseSource();
    const g = ctx.createGain();
    const lvl = ctx.createGain();
    lvl.gain.value = Math.pow(10, levelDb / 20);
    src.connect(g);
    g.connect(lvl);
    lvl.connect(master);
    envelope(g, duration);
    src.start();
    src.stop(ctx.currentTime + duration + 0.05);
    src.onended = () => { if (onended) onended(); };
    current = { stop: () => { try { src.stop(); } catch (e) {} } };
    return current;
  }

  // Play noise through a given filter type for the Filter ID game.
  function playFiltered(type, duration = 1.5, onended) {
    ensureCtx();
    stop();
    const src = makeNoiseSource();
    const g = ctx.createGain();
    const f = ctx.createBiquadFilter();
    f.type = type;
    if (type === 'lowpass') { f.frequency.value = 500; f.Q.value = 0.9; }
    else if (type === 'highpass') { f.frequency.value = 2000; f.Q.value = 0.9; }
    else if (type === 'bandpass') { f.frequency.value = 1000; f.Q.value = 1.5; }
    else if (type === 'notch') { f.frequency.value = 1000; f.Q.value = 0.8; }
    src.connect(f);
    f.connect(g);
    g.connect(master);
    envelope(g, duration);
    src.start();
    src.stop(ctx.currentTime + duration + 0.05);
    src.onended = () => { if (onended) onended(); };
    current = { stop: () => { try { src.stop(); } catch (e) {} } };
    return current;
  }

  // UI blips for right/wrong feedback
  function blip(good) {
    ensureCtx();
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = 'sine';
    o.frequency.value = good ? 880 : 220;
    g.gain.setValueAtTime(0.15, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.25);
    o.connect(g);
    g.connect(master);
    o.start();
    o.stop(ctx.currentTime + 0.3);
    if (good) {
      const o2 = ctx.createOscillator();
      const g2 = ctx.createGain();
      o2.type = 'sine';
      o2.frequency.value = 1320;
      g2.gain.setValueAtTime(0.12, ctx.currentTime + 0.08);
      g2.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.35);
      o2.connect(g2);
      g2.connect(master);
      o2.start(ctx.currentTime + 0.08);
      o2.stop(ctx.currentTime + 0.4);
    }
  }

  return { ensureCtx, stop, playNoiseEQ, playPanned, playLevel, playFiltered, blip };
})();
