// Game definitions. Each game produces rounds; a round has:
//   prompt, transport buttons (play actions), answer options, correct index.
// Difficulty scales with the player's per-game level (0-3).
// Every round draws random material (noise / pad / drum pattern / riff) from
// the AudioEngine palette so no two rounds sound alike.

const DIFF_NAMES = ['Easy', 'Medium', 'Hard', 'Pro'];
const ROUNDS_PER_GAME = 10;

function shuffle(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

// Sample n distinct items from arr (order preserved from arr)
function sample(arr, n) {
  const idx = shuffle(arr.map((_, i) => i)).slice(0, n).sort((a, b) => a - b);
  return idx.map((i) => arr[i]);
}

function fmtFreq(f) { return f >= 1000 ? (f / 1000).toFixed(f % 1000 === 0 ? 0 : 1) + ' kHz' : f + ' Hz'; }

const MATERIAL_NAMES = { pink: 'noise', white: 'bright noise', pad: 'a synth pad', drums: 'a drum loop' };

const GAMES = {
  // ---- EQ Detective: which frequency band is boosted? ----
  eq: {
    id: 'eq',
    icon: '🎚️',
    name: 'EQ Detective',
    answerType: 'freq',
    desc: 'One frequency band boosted in noise or a drum loop. Identify which band — the core skill for mixing and mastering.',
    allBands: [63, 125, 250, 500, 1000, 2000, 4000, 8000, 16000],
    diffs: [
      { count: 4, gainDb: 12, q: 1.5 },
      { count: 5, gainDb: 9, q: 2 },
      { count: 7, gainDb: 6, q: 2 },
      { count: 9, gainDb: 4.5, q: 2.5 },
    ],
    makeRound(diff) {
      const d = this.diffs[diff];
      // Random band subset each round, so the options themselves vary
      const bands = sample(this.allBands, d.count);
      const answerIdx = Math.floor(Math.random() * bands.length);
      const band = bands[answerIdx];
      // Jitter the actual boost within ±0.1 octave so the same band sounds a
      // little different each round (still comfortably within the band).
      const freq = band * Math.pow(2, (Math.random() - 0.5) * 0.2);
      // Random material; boosted and reference must share the same material
      const src = Math.random() < 0.55
        ? { kind: 'pink' }
        : { kind: 'drums', pattern: Math.floor(Math.random() * AudioEngine.DRUM_PATTERNS.length) };
      return {
        prompt: `A +${d.gainDb} dB boost is hiding in ${MATERIAL_NAMES[src.kind]}. Which frequency is boosted? Compare against the flat reference.`,
        options: bands.map(fmtFreq),
        correct: answerIdx,
        transport: [
          { label: '▶ Boosted', play: (done) => AudioEngine.playNoiseEQ({ freq, gainDb: d.gainDb, q: d.q, duration: 2, src, onended: done }) },
          { label: '▶ Reference', play: (done) => AudioEngine.playNoiseEQ({ duration: 2, src, onended: done }) },
        ],
        explain: `It was ${fmtFreq(band)}.`,
      };
    },
  },

  // ---- Pan Precision: where is the sound in the stereo field? ----
  pan: {
    id: 'pan',
    icon: '🎛️',
    name: 'Pan Precision',
    answerType: 'pan',
    desc: 'A sound placed somewhere in the stereo field. Pinpoint its position — train your spatial hearing.',
    diffs: [
      { positions: [-1, 0, 1] },
      { positions: [-1, -0.5, 0, 0.5, 1] },
      { positions: [-1, -0.6, -0.3, 0, 0.3, 0.6, 1] },
      { positions: [-1, -0.75, -0.5, -0.25, 0, 0.25, 0.5, 0.75, 1] },
    ],
    label(p) {
      if (p === 0) return 'Center';
      const side = p < 0 ? 'L' : 'R';
      return side + Math.round(Math.abs(p) * 100);
    },
    makeRound(diff) {
      const d = this.diffs[diff];
      const answerIdx = Math.floor(Math.random() * d.positions.length);
      const panVal = d.positions[answerIdx];
      const src = pick([{ kind: 'pink' }, { kind: 'white' }, { kind: 'pad' }]);
      return {
        prompt: 'Where in the stereo field is the sound placed? (Use headphones for best results.)',
        options: d.positions.map((p) => this.label(p)),
        correct: answerIdx,
        transport: [
          { label: '▶ Play Sound', play: (done) => AudioEngine.playPanned(panVal, 1.2, done, src) },
        ],
        explain: `It was panned ${this.label(panVal)}.`,
      };
    },
  },

  // ---- dB Boss: which clip is louder? ----
  level: {
    id: 'level',
    icon: '🔊',
    name: 'dB Boss',
    answerType: 'db',
    desc: 'Two clips, one slightly louder. Pick the louder one — level judgment is the foundation of gain staging.',
    diffs: [
      { deltaDb: 6 },
      { deltaDb: 3 },
      { deltaDb: 1.5 },
      { deltaDb: 0.8 },
    ],
    makeRound(diff) {
      const d = this.diffs[diff];
      // Jitter the gap ±20% so it isn't the identical delta every round
      const delta = +(d.deltaDb * (0.8 + Math.random() * 0.4)).toFixed(1);
      const louderIsA = Math.random() < 0.5;
      const a = louderIsA ? 0 : -delta;
      const b = louderIsA ? -delta : 0;
      // Both clips must share material to keep it a pure level comparison
      const src = pick([
        { kind: 'pink' },
        { kind: 'white' },
        { kind: 'pad', root: 82 * Math.pow(2, Math.random() * 1.3) },
      ]);
      return {
        prompt: `One clip is ${delta} dB louder than the other. Which one?`,
        options: ['Clip A', 'Clip B'],
        correct: louderIsA ? 0 : 1,
        transport: [
          { label: '▶ Clip A', play: (done) => AudioEngine.playLevel(a, 1.0, done, src) },
          { label: '▶ Clip B', play: (done) => AudioEngine.playLevel(b, 1.0, done, src) },
        ],
        explain: `Clip ${louderIsA ? 'A' : 'B'} was louder.`,
      };
    },
  },

  // ---- Filter Lab: identify the filter type ----
  filter: {
    id: 'filter',
    icon: '🧪',
    name: 'Filter Lab',
    answerType: 'category',
    desc: 'A mystery filter over noise or drums. Name the filter type — learn the sound of every curve.',
    diffs: [
      { types: ['lowpass', 'highpass'] },
      { types: ['lowpass', 'highpass', 'bandpass'] },
      { types: ['lowpass', 'highpass', 'bandpass', 'notch'] },
      { types: ['lowpass', 'highpass', 'bandpass', 'notch'] },
    ],
    labels: { lowpass: 'Low-pass', highpass: 'High-pass', bandpass: 'Band-pass', notch: 'Notch' },
    makeRound(diff) {
      const d = this.diffs[diff];
      const answerIdx = Math.floor(Math.random() * d.types.length);
      const type = d.types[answerIdx];
      const src = Math.random() < 0.6
        ? { kind: 'pink' }
        : { kind: 'drums', pattern: Math.floor(Math.random() * AudioEngine.DRUM_PATTERNS.length) };
      return {
        prompt: `What type of filter is applied to ${MATERIAL_NAMES[src.kind]}? Compare with the unfiltered reference.`,
        options: d.types.map((t) => this.labels[t]),
        correct: answerIdx,
        transport: [
          { label: '▶ Filtered', play: (done) => AudioEngine.playFiltered(type, 1.5, done, src) },
          { label: '▶ Reference', play: (done) => AudioEngine.playNoiseEQ({ duration: 1.5, src, onended: done }) },
        ],
        explain: `It was a ${this.labels[type]} filter.`,
      };
    },
  },

  // ---- Squash Test: which drum loop is compressed? ----
  comp: {
    id: 'comp',
    icon: '🥁',
    name: 'Squash Test',
    answerType: 'category',
    desc: 'Two drum loops, one run through a compressor. Spot the squashed one — hear how compression tames transients.',
    diffs: [
      { threshold: -35, ratio: 12, makeup: 1.8 },
      { threshold: -30, ratio: 8, makeup: 1.5 },
      { threshold: -26, ratio: 5, makeup: 1.3 },
      { threshold: -22, ratio: 3.5, makeup: 1.2 },
    ],
    makeRound(diff) {
      const d = this.diffs[diff];
      const compIsA = Math.random() < 0.5;
      // Random groove each round; A and B share it so compression is the only difference
      const pattern = Math.floor(Math.random() * AudioEngine.DRUM_PATTERNS.length);
      return {
        prompt: 'One loop is compressed, the other is raw. Which one is compressed?',
        options: ['Loop A', 'Loop B'],
        correct: compIsA ? 0 : 1,
        transport: [
          { label: '▶ Loop A', play: (done) => AudioEngine.playCompression(compIsA, d, 2.4, done, pattern) },
          { label: '▶ Loop B', play: (done) => AudioEngine.playCompression(!compIsA, d, 2.4, done, pattern) },
        ],
        explain: `Loop ${compIsA ? 'A' : 'B'} was compressed.`,
      };
    },
  },

  // ---- Space Cadet: how big is the reverb? ----
  reverb: {
    id: 'reverb',
    icon: '🏛️',
    name: 'Space Cadet',
    answerType: 'category',
    desc: 'A percussive hit in a mystery space. Judge the size of the reverb, from a dry room to a cathedral.',
    presets: [
      { name: 'Dry', decay: 0 },
      { name: 'Room', decay: 0.5 },
      { name: 'Plate', decay: 1.2 },
      { name: 'Chamber', decay: 2.0 },
      { name: 'Hall', decay: 3.2 },
    ],
    diffs: [
      ['Dry', 'Hall'],
      ['Dry', 'Room', 'Hall'],
      ['Dry', 'Room', 'Chamber', 'Hall'],
      ['Room', 'Plate', 'Chamber', 'Hall'],
    ],
    makeRound(diff) {
      const names = this.diffs[diff];
      const options = names.map((n) => this.presets.find((p) => p.name === n));
      const answerIdx = Math.floor(Math.random() * options.length);
      const chosen = options[answerIdx];
      const hitKind = pick(AudioEngine.HIT_KINDS); // clap / rim / tom / pluck
      return {
        prompt: 'How big is the reverb on this sound?',
        options: options.map((p) => p.name),
        correct: answerIdx,
        transport: [
          { label: '▶ Play Sound', play: (done) => AudioEngine.playReverb(chosen.decay, 2.6, done, hitKind) },
        ],
        explain: `It was ${chosen.name}.`,
      };
    },
  },

  // ---- Dirt Meter: how much distortion? ----
  dist: {
    id: 'dist',
    icon: '🎸',
    name: 'Dirt Meter',
    answerType: 'category',
    desc: 'A synth riff with mystery drive. Gauge how much distortion is cooking — clean, crunchy, or fully fried.',
    presets: [
      { name: 'Clean', amount: 0, out: 0.5 },
      { name: 'Light', amount: 8, out: 0.42 },
      { name: 'Medium', amount: 25, out: 0.32 },
      { name: 'Heavy', amount: 60, out: 0.24 },
    ],
    diffs: [
      ['Clean', 'Heavy'],
      ['Clean', 'Light', 'Heavy'],
      ['Clean', 'Light', 'Medium', 'Heavy'],
      ['Light', 'Medium', 'Heavy'],
    ],
    makeRound(diff) {
      const names = this.diffs[diff];
      const options = names.map((n) => this.presets.find((p) => p.name === n));
      const answerIdx = Math.floor(Math.random() * options.length);
      const chosen = options[answerIdx];
      // Random riff and waveform each round
      const riffOpts = {
        riff: Math.floor(Math.random() * AudioEngine.RIFFS.length),
        wave: Math.random() < 0.5 ? 'sawtooth' : 'square',
      };
      return {
        prompt: 'How much distortion is on this riff?',
        options: options.map((p) => p.name),
        correct: answerIdx,
        transport: [
          { label: '▶ Play Riff', play: (done) => AudioEngine.playDistortion(chosen.amount, chosen.out, 2.2, done, riffOpts) },
        ],
        explain: `It was ${chosen.name}.`,
      };
    },
  },

  // ---- Delay Control: identify the delay time ----
  delay: {
    id: 'delay',
    icon: '🕰️',
    name: 'Delay Control',
    answerType: 'time',
    desc: 'A repeat echoes behind the sound. Estimate the delay time in milliseconds using the dry/delayed comparison.',
    diffs: [
      [90, 250, 500],
      [80, 180, 320, 600],
      [70, 140, 250, 400, 650],
      [60, 120, 200, 300, 450, 700],
    ],
    makeRound(diff) {
      const times = this.diffs[diff];
      const answerIdx = Math.floor(Math.random() * times.length);
      const ms = times[answerIdx];
      const hitKind = pick(AudioEngine.HIT_KINDS);
      return {
        prompt: 'How long is the delay? Compare the original with the delayed version.',
        options: times.map((t) => `${t} ms`),
        correct: answerIdx,
        transport: [
          { label: '▶ Original', play: (done) => AudioEngine.playDelay(ms, false, 2.0, done, hitKind) },
          { label: '▶ With Delay', play: (done) => AudioEngine.playDelay(ms, true, 2.4, done, hitKind) },
        ],
        explain: `It was ${ms} ms.`,
      };
    },
  },

  // ---- Feedback Eliminator: identify the pure-tone frequency ----
  tone: {
    id: 'tone',
    icon: '📢',
    name: 'Feedback Eliminator',
    answerType: 'freq',
    desc: 'A pure sine tone rings out at one frequency. Pin down which frequency it is — the skill for killing feedback fast.',
    allBands: [80, 160, 250, 400, 630, 1000, 1600, 2500, 4000, 6300, 10000],
    diffs: [
      { count: 3 },
      { count: 4 },
      { count: 6 },
      { count: 8 },
    ],
    makeRound(diff) {
      const bands = sample(this.allBands, this.diffs[diff].count);
      const answerIdx = Math.floor(Math.random() * bands.length);
      const freq = bands[answerIdx];
      return {
        prompt: 'Which frequency is the tone ringing at?',
        options: bands.map(fmtFreq),
        correct: answerIdx,
        transport: [
          { label: '▶ Play Tone', play: (done) => AudioEngine.playTone(freq, 1.6, done) },
        ],
        explain: `It was ${fmtFreq(freq)}.`,
      };
    },
  },

  // ---- Stereohead: how wide is the stereo image? ----
  width: {
    id: 'width',
    icon: '🔀',
    name: 'Stereohead',
    answerType: 'pan',
    desc: 'Two sources spread across the stereo field. Judge how wide the image is, from mono to fully wide.',
    presets: [
      { name: 'Mono', w: 0 },
      { name: 'Narrow', w: 0.35 },
      { name: 'Medium', w: 0.65 },
      { name: 'Wide', w: 1 },
    ],
    diffs: [
      ['Mono', 'Wide'],
      ['Mono', 'Medium', 'Wide'],
      ['Mono', 'Narrow', 'Medium', 'Wide'],
      ['Narrow', 'Medium', 'Wide'],
    ],
    makeRound(diff) {
      const names = this.diffs[diff];
      const options = names.map((n) => this.presets.find((p) => p.name === n));
      const answerIdx = Math.floor(Math.random() * options.length);
      const chosen = options[answerIdx];
      return {
        prompt: 'How wide is the stereo image? (Headphones required.)',
        options: options.map((p) => p.name),
        correct: answerIdx,
        transport: [
          { label: '▶ Play Sound', play: (done) => AudioEngine.playWidth(chosen.w, 1.6, done) },
        ],
        explain: `It was ${chosen.name}.`,
      };
    },
  },

  // ---- Bass Detective: low-frequency EQ boost (50-400 Hz) ----
  bass: {
    id: 'bass',
    icon: '🔈',
    name: 'Bass Detective',
    answerType: 'freq',
    desc: 'A boost hides down in the low end (50–400 Hz). Track down the boosted frequency where mixes get muddy.',
    allBands: [50, 63, 80, 100, 125, 160, 200, 250, 315, 400],
    diffs: [
      { count: 3, gainDb: 12, q: 1.5 },
      { count: 4, gainDb: 9, q: 2 },
      { count: 5, gainDb: 6, q: 2.5 },
      { count: 6, gainDb: 5, q: 3 },
    ],
    makeRound(diff) {
      const d = this.diffs[diff];
      const bands = sample(this.allBands, d.count);
      const answerIdx = Math.floor(Math.random() * bands.length);
      const band = bands[answerIdx];
      const freq = band * Math.pow(2, (Math.random() - 0.5) * 0.14);
      const src = Math.random() < 0.5
        ? { kind: 'pink' }
        : { kind: 'drums', pattern: Math.floor(Math.random() * AudioEngine.DRUM_PATTERNS.length) };
      return {
        prompt: `A +${d.gainDb} dB low-end boost is hiding in ${MATERIAL_NAMES[src.kind]}. Which frequency is it?`,
        options: bands.map(fmtFreq),
        correct: answerIdx,
        transport: [
          { label: '▶ Boosted', play: (done) => AudioEngine.playNoiseEQ({ freq, gainDb: d.gainDb, q: d.q, duration: 2, src, onended: done }) },
          { label: '▶ Reference', play: (done) => AudioEngine.playNoiseEQ({ duration: 2, src, onended: done }) },
        ],
        explain: `It was ${fmtFreq(band)}.`,
      };
    },
  },

  // ---- Balance Memory: memorize and recreate a 4-track fader mix ----
  balance: {
    id: 'balance',
    icon: '🎚️',
    name: 'Balance Memory',
    desc: 'Memorize a 4-track mix, then recreate the balance on the faders from memory. Train your relative-level recall.',
    answerType: 'db',
    trackNames: ['Kick', 'Bass', 'Pad', 'Hats'],
    diffs: [
      { range: 8, tolerance: 2.5 },
      { range: 12, tolerance: 2 },
      { range: 16, tolerance: 1.5 },
      { range: 20, tolerance: 1 },
    ],
    makeRound(diff) {
      const d = this.diffs[diff];
      const targets = this.trackNames.map(() => Math.round(Math.random() * d.range - d.range / 2));
      const tracks = this.trackNames.map((name, i) => ({ name, min: -18, max: 6, step: 1, default: 0, target: targets[i] }));
      return {
        type: 'fader',
        prompt: 'Listen to the <b>reference mix</b>, then recreate the balance on the faders below. Use "Play My Mix" to check your work before submitting.',
        tracks,
        tolerance: d.tolerance,
        playReference: (done) => AudioEngine.playMixSnapshot(targets, 2.4, done),
        playAttempt: (vals, done) => AudioEngine.playMixSnapshot(vals, 2.4, done),
        explain: (vals, avgErr) => `Avg error ${avgErr.toFixed(1)} dB — target was ${tracks.map((t) => `${t.name} ${t.target > 0 ? '+' : ''}${t.target}`).join(', ')}.`,
      };
    },
  },

  // ---- EQ Mirror: dial in a frequency knob to match a hidden EQ boost ----
  eqmirror: {
    id: 'eqmirror',
    icon: '🪞',
    name: 'EQ Mirror',
    desc: 'Drag the knob to match a hidden EQ boost by ear — a continuous, precision version of EQ Detective.',
    answerType: 'freq',
    diffs: [
      { gainDb: 10, tolerancePct: 18, range: [150, 5000] },
      { gainDb: 8, tolerancePct: 13, range: [120, 6500] },
      { gainDb: 6, tolerancePct: 9, range: [100, 8000] },
      { gainDb: 5, tolerancePct: 6, range: [80, 9000] },
    ],
    makeRound(diff) {
      const d = this.diffs[diff];
      const [lo, hi] = d.range;
      const target = Math.round(lo * Math.pow(hi / lo, Math.random()));
      const src = Math.random() < 0.6
        ? { kind: 'pink' }
        : { kind: 'drums', pattern: Math.floor(Math.random() * AudioEngine.DRUM_PATTERNS.length) };
      const tolerance = target * d.tolerancePct / 100;
      return {
        type: 'knob',
        prompt: `A +${d.gainDb} dB peak is hidden in ${MATERIAL_NAMES[src.kind]}. Drag the knob, then compare <b>Target</b> vs <b>Yours</b> until they match.`,
        param: { min: lo, max: hi, scale: 'log', unit: 'Hz', default: Math.round(Math.sqrt(lo * hi)) },
        target,
        tolerance,
        playTarget: (done) => AudioEngine.playNoiseEQ({ freq: target, gainDb: d.gainDb, q: 2, duration: 1.8, src, onended: done }),
        playYours: (val, done) => AudioEngine.playNoiseEQ({ freq: val, gainDb: d.gainDb, q: 2, duration: 1.8, src, onended: done }),
        explain: (val, err) => `Target was ${fmtFreq(target)}, you dialed ${fmtFreq(Math.round(val))} (off by ${fmtFreq(Math.round(err))}).`,
      };
    },
  },

  // ---- Compressionist: dial in an Amount knob to match hidden compression ----
  compressionist: {
    id: 'compressionist',
    icon: '🎛️',
    name: 'Compressionist',
    desc: 'Drag the Amount knob to match a hidden compression setting on a drum loop — precision dynamics matching.',
    answerType: 'db',
    diffs: [
      { tolerance: 18 },
      { tolerance: 13 },
      { tolerance: 9 },
      { tolerance: 6 },
    ],
    makeRound(diff) {
      const tolerance = this.diffs[diff].tolerance;
      const target = Math.round(15 + Math.random() * 80);
      const pattern = Math.floor(Math.random() * AudioEngine.DRUM_PATTERNS.length);
      return {
        type: 'knob',
        prompt: 'Drag the <b>Amount</b> knob to match the hidden compression — listen for tamed transients and evened-out levels.',
        param: { min: 0, max: 100, scale: 'linear', unit: '%', default: 50 },
        target,
        tolerance,
        playTarget: (done) => AudioEngine.playCompressAmount(target, pattern, 2.4, done),
        playYours: (val, done) => AudioEngine.playCompressAmount(val, pattern, 2.4, done),
        explain: (val, err) => `Target was ${target}%, you dialed ${Math.round(val)}% (off by ${Math.round(err)}).`,
      };
    },
  },
};
