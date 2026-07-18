// Audio engine: synthesizes all training material with the Web Audio API,
// so the app needs no audio files and works offline.
//
// Material system: every game draws from a palette of synthesized sources
// (pink/white noise, synth pads, drum loops with multiple patterns, varied
// percussion hits, varied riffs) so no two rounds sound alike.
const AudioEngine = (() => {
  let ctx = null;
  let master = null;
  let current = null; // currently playing chain { stop() }
  let pinkBuffer = null;
  let whiteBuffer = null;

  const NOISE_SECONDS = 6; // long buffers so each play starts at a random offset

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
    const len = ctx.sampleRate * NOISE_SECONDS;
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

  function getWhiteBuffer() {
    if (whiteBuffer) return whiteBuffer;
    const len = ctx.sampleRate * NOISE_SECONDS;
    whiteBuffer = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let ch = 0; ch < 2; ch++) {
      const data = whiteBuffer.getChannelData(ch);
      for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * 0.18;
    }
    return whiteBuffer;
  }

  function stop() {
    if (current) {
      try { current.stop(); } catch (e) { /* already stopped */ }
      current = null;
    }
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

  // Register scheduled sources + timers as the current playback so stop()
  // cancels them all cleanly, and fire onended once done.
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

  // ---------- Drum kit voices (ac param so calibration can render offline) ----------
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
    s.start(t, Math.random() * NOISE_SECONDS); s.stop(t + 0.2);
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
    s.start(t, Math.random() * NOISE_SECONDS); s.stop(t + 0.08);
    sources.push(s);
  }

  // Drum patterns: [voice, 16th-step, velocity]. Each 2s bar at 120 BPM.
  const DRUM_PATTERNS = [
    [ // four-on-the-floor with ghosts
      ['k', 0, 1.0], ['k', 3, 0.3], ['k', 6, 0.9], ['k', 10, 1.0],
      ['s', 4, 0.9], ['s', 7, 0.25], ['s', 12, 1.0],
      ['h', 0, 0.35], ['h', 2, 0.14], ['h', 4, 0.35], ['h', 6, 0.14],
      ['h', 8, 0.35], ['h', 10, 0.14], ['h', 12, 0.35], ['h', 14, 0.14],
    ],
    [ // half-time feel, heavy backbeat
      ['k', 0, 1.0], ['k', 7, 0.5], ['k', 9, 0.85],
      ['s', 8, 1.0], ['s', 14, 0.2],
      ['h', 0, 0.3], ['h', 3, 0.12], ['h', 4, 0.25], ['h', 8, 0.3],
      ['h', 11, 0.12], ['h', 12, 0.25], ['h', 15, 0.18],
    ],
    [ // syncopated funk
      ['k', 0, 1.0], ['k', 5, 0.7], ['k', 8, 0.4], ['k', 11, 0.9],
      ['s', 4, 1.0], ['s', 10, 0.3], ['s', 12, 1.0], ['s', 15, 0.2],
      ['h', 0, 0.3], ['h', 2, 0.16], ['h', 4, 0.3], ['h', 6, 0.16],
      ['h', 7, 0.1], ['h', 8, 0.3], ['h', 10, 0.16], ['h', 12, 0.3], ['h', 14, 0.16],
    ],
    [ // driving 8ths, busy kick
      ['k', 0, 1.0], ['k', 2, 0.5], ['k', 6, 0.85], ['k', 8, 1.0], ['k', 14, 0.6],
      ['s', 4, 0.95], ['s', 12, 1.0],
      ['h', 1, 0.14], ['h', 3, 0.14], ['h', 5, 0.14], ['h', 7, 0.14],
      ['h', 9, 0.14], ['h', 11, 0.14], ['h', 13, 0.14], ['h', 15, 0.14],
    ],
  ];
  const VOICES = { k: kick, s: snare, h: hat };

  function scheduleDrumBar(ac, dest, t0, sources, patternIdx = 0) {
    const step = 0.125; // 16th at 120 BPM
    for (const [v, s, vel] of DRUM_PATTERNS[patternIdx]) {
      VOICES[v](ac, dest, t0 + step * s, vel, sources);
    }
  }

  // ---------- Sustained material palette ----------
  // Feed material of the given kind into `dest` for `duration` seconds.
  // kinds: 'pink' | 'white' | 'pad' | 'drums'
  // opts: { pattern (drums), root (pad) } — pass the same opts to two plays to
  // compare the same material (e.g. boosted vs reference in the EQ game).
  function sourceInto(kind, dest, duration, opts = {}) {
    const sources = [];
    const t0 = ctx.currentTime;
    if (kind === 'pink' || kind === 'white') {
      const src = ctx.createBufferSource();
      src.buffer = kind === 'pink' ? getPinkBuffer() : getWhiteBuffer();
      src.loop = true;
      src.connect(dest);
      src.start(t0, Math.random() * NOISE_SECONDS);
      src.stop(t0 + duration + 0.05);
      sources.push(src);
    } else if (kind === 'pad') {
      // Detuned saw stack: root + fifth + octave(s), mellowed by a lowpass
      const root = opts.root || 82 * Math.pow(2, Math.random() * 1.3);
      const lp = ctx.createBiquadFilter();
      lp.type = 'lowpass'; lp.frequency.value = 2600; lp.Q.value = 0.5;
      const pg = ctx.createGain();
      pg.gain.value = 0.16;
      lp.connect(pg); pg.connect(dest);
      [1, 1.4983, 2, 2.9966].forEach((ratio) => {
        const o = ctx.createOscillator();
        o.type = 'sawtooth';
        o.frequency.value = root * ratio;
        o.detune.value = (Math.random() - 0.5) * 14;
        o.connect(lp);
        o.start(t0); o.stop(t0 + duration + 0.1);
        sources.push(o);
      });
    } else if (kind === 'drums') {
      const pattern = opts.pattern ?? Math.floor(Math.random() * DRUM_PATTERNS.length);
      for (let start = t0 + 0.02; start < t0 + duration; start += 2.0) {
        scheduleDrumBar(ctx, dest, start, sources, pattern);
      }
    }
    return sources;
  }

  // ---------- Game playback ----------

  // Material through an optional peaking EQ boost.
  // opts: { freq, gainDb, q, duration, src: {kind, ...}, onended }
  function playNoiseEQ(opts = {}) {
    ensureCtx(); stop();
    const g = ctx.createGain();
    let head = g; // node the material feeds into
    if (opts.freq && opts.gainDb) {
      const eq = ctx.createBiquadFilter();
      eq.type = 'peaking';
      eq.frequency.value = opts.freq;
      eq.gain.value = opts.gainDb;
      eq.Q.value = opts.q || 2;
      eq.connect(g);
      head = eq;
    }
    g.connect(master);
    const duration = opts.duration || 2;
    envelope(g, duration);
    const srcOpts = opts.src || { kind: 'pink' };
    const sources = sourceInto(srcOpts.kind, head, duration, srcOpts);
    return finish(sources, [], opts.onended, duration + 0.1);
  }

  // Material placed in the stereo field. pan: -1..1
  function playPanned(pan, duration = 1.2, onended, srcOpts = { kind: 'pink' }) {
    ensureCtx(); stop();
    const g = ctx.createGain();
    const panner = ctx.createStereoPanner();
    panner.pan.value = pan;
    g.connect(panner);
    panner.connect(master);
    envelope(g, duration);
    const sources = sourceInto(srcOpts.kind, g, duration, srcOpts);
    return finish(sources, [], onended, duration + 0.1);
  }

  // Material at a relative level in dB (0 = reference).
  function playLevel(levelDb, duration = 1.0, onended, srcOpts = { kind: 'pink' }) {
    ensureCtx(); stop();
    const g = ctx.createGain();
    const lvl = ctx.createGain();
    lvl.gain.value = Math.pow(10, levelDb / 20);
    g.connect(lvl);
    lvl.connect(master);
    envelope(g, duration);
    const sources = sourceInto(srcOpts.kind, g, duration, srcOpts);
    return finish(sources, [], onended, duration + 0.1);
  }

  // Material through a given filter type for the Filter ID game.
  function playFiltered(type, duration = 1.5, onended, srcOpts = { kind: 'pink' }) {
    ensureCtx(); stop();
    const g = ctx.createGain();
    const f = ctx.createBiquadFilter();
    f.type = type;
    if (type === 'lowpass') { f.frequency.value = 500; f.Q.value = 0.9; }
    else if (type === 'highpass') { f.frequency.value = 2000; f.Q.value = 0.9; }
    else if (type === 'bandpass') { f.frequency.value = 1000; f.Q.value = 1.5; }
    else if (type === 'notch') { f.frequency.value = 1000; f.Q.value = 0.8; }
    f.connect(g);
    g.connect(master);
    envelope(g, duration);
    const sources = sourceInto(srcOpts.kind, f, duration, srcOpts);
    return finish(sources, [], onended, duration + 0.1);
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

  // ---------- Compression ----------
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

  // Render one drum bar offline and return its RMS, optionally compressed
  // (unity makeup). Used to loudness-match compressed vs raw per pattern.
  async function renderDrumRMS(settings, patternIdx) {
    const rate = ctx.sampleRate;
    const dur = 2.1;
    const oac = new OfflineAudioContext(2, Math.ceil(rate * dur), rate);
    const input = settings ? buildCompressor(oac, oac.destination, settings, 1) : oac.destination;
    scheduleDrumBar(oac, input, 0.02, [], patternIdx);
    const buf = await oac.startRendering();
    let sum = 0, n = 0;
    for (let ch = 0; ch < buf.numberOfChannels; ch++) {
      const d = buf.getChannelData(ch);
      for (let i = 0; i < d.length; i++) sum += d[i] * d[i];
      n += d.length;
    }
    return Math.sqrt(sum / n);
  }

  // For each difficulty × drum pattern, compute the makeup gain that equalizes
  // compressed and raw RMS, so the game tests compression *character*, not
  // loudness. Fills each settings object's `makeupByPattern` array.
  async function calibrateCompression(diffs) {
    if (typeof OfflineAudioContext === 'undefined') return;
    ensureCtx();
    try {
      for (let p = 0; p < DRUM_PATTERNS.length; p++) {
        const rawRMS = await renderDrumRMS(null, p);
        for (const d of diffs) {
          const compRMS = await renderDrumRMS(d, p);
          d.makeupByPattern = d.makeupByPattern || [];
          if (rawRMS > 0 && compRMS > 0) d.makeupByPattern[p] = rawRMS / compRMS;
        }
      }
    } catch (e) { /* keep the hand-tuned fallback makeup values */ }
  }

  function playCompression(compressed, settings, duration = 2.4, onended, patternIdx = 0) {
    ensureCtx(); stop();
    const out = ctx.createGain();
    out.connect(master);
    const makeup = settings.makeupByPattern?.[patternIdx] ?? settings.makeup;
    const input = compressed ? buildCompressor(ctx, out, settings, makeup) : out;
    const sources = [];
    const t0 = ctx.currentTime + 0.06;
    for (let start = t0; start < t0 + duration; start += 2.0) {
      scheduleDrumBar(ctx, input, start, sources, patternIdx);
    }
    return finish(sources, [], onended, duration + 0.4);
  }

  // ---------- Reverb ----------
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

  // Percussive hit varieties for the reverb game
  const HITS = {
    clap(t, dest, sources) {
      const s = ctx.createBufferSource();
      s.buffer = getPinkBuffer();
      const bp = ctx.createBiquadFilter();
      bp.type = 'bandpass'; bp.frequency.value = 1800; bp.Q.value = 1;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.95, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.07);
      s.connect(bp); bp.connect(g); g.connect(dest);
      s.start(t, Math.random() * NOISE_SECONDS); s.stop(t + 0.1);
      sources.push(s);
    },
    rim(t, dest, sources) {
      const s = ctx.createBufferSource();
      s.buffer = getWhiteBuffer();
      const hp = ctx.createBiquadFilter();
      hp.type = 'highpass'; hp.frequency.value = 3500;
      const g = ctx.createGain();
      g.gain.setValueAtTime(1.0, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.04);
      s.connect(hp); hp.connect(g); g.connect(dest);
      s.start(t, Math.random() * NOISE_SECONDS); s.stop(t + 0.06);
      sources.push(s);
    },
    tom(t, dest, sources) {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.frequency.setValueAtTime(220, t);
      o.frequency.exponentialRampToValueAtTime(90, t + 0.2);
      g.gain.setValueAtTime(0.9, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.25);
      o.connect(g); g.connect(dest);
      o.start(t); o.stop(t + 0.3);
      sources.push(o);
    },
    pluck(t, dest, sources) {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = 'triangle';
      o.frequency.value = 300 * Math.pow(2, Math.random());
      g.gain.setValueAtTime(0.8, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.12);
      o.connect(g); g.connect(dest);
      o.start(t); o.stop(t + 0.15);
      sources.push(o);
    },
  };
  const HIT_KINDS = Object.keys(HITS);

  function playReverb(decay, duration = 2.6, onended, hitKind = 'clap') {
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
    const junction = ctx.createGain();
    junction.connect(dry);
    if (conv) junction.connect(conv);
    const sources = [];
    const t0 = ctx.currentTime + 0.06;
    const hit = HITS[hitKind] || HITS.clap;
    [0, 0.7, 1.4].forEach((off) => hit(t0 + off, junction, sources));
    return finish(sources, [], onended, Math.min(4, 1.6 + decay));
  }

  // ---------- Distortion ----------
  const RIFFS = [
    [110, 110, 146.83, 110],      // A2 chug
    [82.41, 82.41, 110, 98],      // E2 low riff
    [146.83, 130.81, 110, 146.83],// descending D3
    [110, 164.81, 110, 220],      // octave bounce
  ];

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

  function playDistortion(amount, outGainVal, duration = 2.2, onended, opts = {}) {
    ensureCtx(); stop();
    const out = ctx.createGain();
    const wave = opts.wave || 'sawtooth';
    out.gain.value = outGainVal * (wave === 'square' ? 0.75 : 1);
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
    const notes = RIFFS[opts.riff ?? 0];
    const noteLen = duration / notes.length;
    notes.forEach((f, i) => {
      const o = ctx.createOscillator();
      o.type = wave; o.frequency.value = f;
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

  // ---------- Delay (Space & Time) ----------
  function playDelay(ms, withDelay, duration = 2.4, onended, hitKind = 'pluck') {
    ensureCtx(); stop();
    const out = ctx.createGain();
    out.connect(master);
    const dry = ctx.createGain();
    dry.gain.value = 0.95; dry.connect(out);
    const junction = ctx.createGain();
    junction.connect(dry);
    if (withDelay) {
      const d = ctx.createDelay(1.2);
      d.delayTime.value = ms / 1000;
      const fb = ctx.createGain(); fb.gain.value = 0.34;
      const wet = ctx.createGain(); wet.gain.value = 0.8;
      junction.connect(d);
      d.connect(wet); wet.connect(out);
      d.connect(fb); fb.connect(d);
    }
    const sources = [];
    const t0 = ctx.currentTime + 0.06;
    const hit = HITS[hitKind] || HITS.pluck;
    [0, 1.0].forEach((off) => hit(t0 + off, junction, sources));
    return finish(sources, [], onended, duration);
  }

  // ---------- Pure tone (Feedback Eliminator) ----------
  function playTone(freq, duration = 1.6, onended) {
    ensureCtx(); stop();
    const o = ctx.createOscillator();
    o.type = 'sine';
    o.frequency.value = freq;
    const g = ctx.createGain();
    envelope(g, duration);
    o.connect(g); g.connect(master);
    o.start(); o.stop(ctx.currentTime + duration + 0.05);
    return finish([o], [], onended, duration + 0.1);
  }

  // ---------- Stereo width (Stereohead) ----------
  function playWidth(width, duration = 1.6, onended) {
    ensureCtx(); stop();
    const g = ctx.createGain();
    envelope(g, duration);
    g.connect(master);
    const sources = [];
    // Two decorrelated pink sources panned to +/- width
    [-1, 1].forEach((side) => {
      const src = ctx.createBufferSource();
      src.buffer = getPinkBuffer();
      src.loop = true;
      const p = ctx.createStereoPanner();
      p.pan.value = side * width;
      const sg = ctx.createGain();
      sg.gain.value = 0.7;
      src.connect(p); p.connect(sg); sg.connect(g);
      src.start(ctx.currentTime, Math.random() * NOISE_SECONDS);
      src.stop(ctx.currentTime + duration + 0.05);
      sources.push(src);
    });
    return finish(sources, [], onended, duration + 0.1);
  }

  return {
    ensureCtx, stop, playNoiseEQ, playPanned, playLevel, playFiltered, blip,
    playCompression, playReverb, playDistortion, calibrateCompression,
    playDelay, playTone, playWidth,
    DRUM_PATTERNS, RIFFS, HIT_KINDS,
  };
})();
