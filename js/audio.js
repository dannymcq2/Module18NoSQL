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
  const PINK_SECONDS = 6; // long buffer so each play can start at a random offset

  function getPinkBuffer() {
    if (pinkBuffer) return pinkBuffer;
    const len = ctx.sampleRate * PINK_SECONDS;
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
    src.start(ctx.currentTime, Math.random() * PINK_SECONDS);
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
    src.start(ctx.currentTime, Math.random() * PINK_SECONDS);
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
    src.start(ctx.currentTime, Math.random() * PINK_SECONDS);
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
    src.start(ctx.currentTime, Math.random() * PINK_SECONDS);
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

  // ---------- Shared scheduling helpers for the "musical" games ----------

  // Register a set of scheduled sources + timers as the current playback so
  // stop() can cancel them all cleanly.
  function finish(sources, timers, onended, endsAfter) {
    const t = setTimeout(() => { if (onended) onended(); }, endsAfter * 1000);
    timers.push(t);
    current = {
      stop: () => {
        sources.forEach((s) => { try { s.stop(); } catch (e) {} });
        timers.forEach(clearTimeout);
      },
    };
    return current;
  }

  // One-shot percussive voices, scheduled at absolute time t into a destination.
  // `ac` is the audio context to build on (online ctx live, OfflineAudioContext
  // during RMS calibration).
  function kick(ac, dest, t, vel, sources) {
    const o = ac.createOscillator();
    const g = ac.createGain();
    o.frequency.setValueAtTime(150, t);
    o.frequency.exponentialRampToValueAtTime(50, t + 0.12);
    g.gain.setValueAtTime(vel, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.28);
    o.connect(g); g.connect(dest);
    o.start(t); o.stop(t + 0.32);
    sources.push(o);
  }
  function snare(ac, dest, t, vel, sources) {
    const s = ac.createBufferSource();
    s.buffer = getPinkBuffer();
    const hp = ac.createBiquadFilter();
    hp.type = 'highpass'; hp.frequency.value = 1400;
    const g = ac.createGain();
    g.gain.setValueAtTime(vel, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.18);
    s.connect(hp); hp.connect(g); g.connect(dest);
    s.start(t, Math.random() * PINK_SECONDS); s.stop(t + 0.2);
    sources.push(s);
  }
  function hat(ac, dest, t, vel, sources) {
    const s = ac.createBufferSource();
    s.buffer = getPinkBuffer();
    const hp = ac.createBiquadFilter();
    hp.type = 'highpass'; hp.frequency.value = 7000;
    const g = ac.createGain();
    g.gain.setValueAtTime(vel, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.05);
    s.connect(hp); hp.connect(g); g.connect(dest);
    s.start(t, Math.random() * PINK_SECONDS); s.stop(t + 0.08);
    sources.push(s);
  }

  // Schedule one 2s bar of a dynamic drum pattern (accents + ghost notes give
  // the compressor something to grab).
  function scheduleDrumBar(ac, dest, t0, sources) {
    const step = 0.125; // 16th note at 120 BPM
    kick(ac, dest, t0 + step * 0, 1.0, sources);
    kick(ac, dest, t0 + step * 3, 0.3, sources);   // ghost
    kick(ac, dest, t0 + step * 6, 0.9, sources);
    kick(ac, dest, t0 + step * 10, 1.0, sources);
    snare(ac, dest, t0 + step * 4, 0.9, sources);
    snare(ac, dest, t0 + step * 7, 0.25, sources); // ghost
    snare(ac, dest, t0 + step * 12, 1.0, sources);
    for (let i = 0; i < 16; i += 2) {
      hat(ac, dest, t0 + step * i, i % 4 === 0 ? 0.35 : 0.14, sources);
    }
  }

  // Build a compressor with makeup on `ac`, returning its input node.
  function buildCompressor(ac, dest, settings, makeupGain) {
    const comp = ac.createDynamicsCompressor();
    comp.threshold.value = settings.threshold;
    comp.ratio.value = settings.ratio;
    comp.knee.value = 6;
    comp.attack.value = 0.003;
    comp.release.value = 0.15;
    const makeup = ac.createGain();
    makeup.gain.value = makeupGain;
    comp.connect(makeup); makeup.connect(dest);
    return comp;
  }

  // Render one drum bar offline and return its RMS, optionally through a
  // compressor (with unity makeup). Used to loudness-match compressed vs raw.
  async function renderDrumRMS(settings) {
    const rate = ctx.sampleRate;
    const dur = 2.1;
    const oac = new OfflineAudioContext(2, Math.ceil(rate * dur), rate);
    const input = settings ? buildCompressor(oac, oac.destination, settings, 1) : oac.destination;
    scheduleDrumBar(oac, input, 0.02, []);
    const buf = await oac.startRendering();
    let sum = 0, n = 0;
    for (let ch = 0; ch < buf.numberOfChannels; ch++) {
      const d = buf.getChannelData(ch);
      for (let i = 0; i < d.length; i++) sum += d[i] * d[i];
      n += d.length;
    }
    return Math.sqrt(sum / n);
  }

  // For each difficulty, compute the makeup gain that equalizes the compressed
  // loop's RMS to the raw loop's, so the game tests compression *character*, not
  // loudness. Mutates each settings object's `makeup` in place.
  async function calibrateCompression(diffs) {
    if (typeof OfflineAudioContext === 'undefined') return;
    ensureCtx();
    try {
      const rawRMS = await renderDrumRMS(null);
      for (const d of diffs) {
        const compRMS = await renderDrumRMS(d);
        if (rawRMS > 0 && compRMS > 0) d.makeup = rawRMS / compRMS;
      }
    } catch (e) { /* keep the hand-tuned fallback makeup values */ }
  }

  // ---- Compression: same drum loop, with or without a compressor + makeup ----
  function playCompression(compressed, settings, duration = 2.4, onended) {
    ensureCtx(); stop();
    const out = ctx.createGain();
    out.connect(master);
    const input = compressed ? buildCompressor(ctx, out, settings, settings.makeup) : out;
    const sources = [];
    const t0 = ctx.currentTime + 0.06;
    for (let start = t0; start < t0 + duration; start += 2.0) {
      scheduleDrumBar(ctx, input, start, sources);
    }
    return finish(sources, [], onended, duration + 0.4);
  }

  // ---- Reverb: percussive claps through a synthesized impulse response ----
  function makeReverbIR(decay) {
    const len = Math.max(1, Math.floor(ctx.sampleRate * decay));
    const ir = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let ch = 0; ch < 2; ch++) {
      const d = ir.getChannelData(ch);
      for (let i = 0; i < len; i++) {
        d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 2.5);
      }
    }
    return ir;
  }
  function playReverb(decay, duration = 2.6, onended) {
    ensureCtx(); stop();
    const out = ctx.createGain();
    out.connect(master);
    const dry = ctx.createGain();
    dry.gain.value = 0.9; dry.connect(out);
    let conv = null;
    if (decay > 0) {
      conv = ctx.createConvolver();
      conv.buffer = makeReverbIR(decay);
      const wet = ctx.createGain();
      wet.gain.value = 0.9;
      conv.connect(wet); wet.connect(out);
    }
    const sources = [];
    const t0 = ctx.currentTime + 0.06;
    [0, 0.7, 1.4].forEach((off) => {
      const t = t0 + off;
      const s = ctx.createBufferSource();
      s.buffer = getPinkBuffer();
      const bp = ctx.createBiquadFilter();
      bp.type = 'bandpass'; bp.frequency.value = 1800; bp.Q.value = 1;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.95, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.07);
      s.connect(bp); bp.connect(g);
      g.connect(dry);
      if (conv) g.connect(conv);
      s.start(t, Math.random()); s.stop(t + 0.1);
      sources.push(s);
    });
    return finish(sources, [], onended, Math.min(4, 1.6 + decay));
  }

  // ---- Distortion: a sawtooth riff through a waveshaper at varying drive ----
  function makeDistortionCurve(amount) {
    const n = 2048;
    const curve = new Float32Array(n);
    const deg = Math.PI / 180;
    for (let i = 0; i < n; i++) {
      const x = (i * 2) / n - 1;
      curve[i] = ((3 + amount) * x * 20 * deg) / (Math.PI + amount * Math.abs(x));
    }
    return curve;
  }
  function playDistortion(amount, outGainVal, duration = 2.2, onended) {
    ensureCtx(); stop();
    const out = ctx.createGain();
    out.gain.value = outGainVal;
    out.connect(master);
    let input = out;
    if (amount > 0) {
      const ws = ctx.createWaveShaper();
      ws.curve = makeDistortionCurve(amount);
      ws.oversample = '4x';
      ws.connect(out);
      input = ws;
    }
    const sources = [];
    const t0 = ctx.currentTime + 0.06;
    const notes = [110, 110, 146.83, 110]; // A2 riff
    const noteLen = duration / notes.length;
    notes.forEach((f, i) => {
      const o = ctx.createOscillator();
      o.type = 'sawtooth'; o.frequency.value = f;
      const g = ctx.createGain();
      const t = t0 + i * noteLen;
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(0.5, t + 0.02);
      g.gain.setValueAtTime(0.5, t + noteLen - 0.05);
      g.gain.linearRampToValueAtTime(0, t + noteLen);
      o.connect(g); g.connect(input);
      o.start(t); o.stop(t + noteLen + 0.02);
      sources.push(o);
    });
    return finish(sources, [], onended, duration + 0.2);
  }

  return {
    ensureCtx, stop, playNoiseEQ, playPanned, playLevel, playFiltered, blip,
    playCompression, playReverb, playDistortion, calibrateCompression,
  };
})();
