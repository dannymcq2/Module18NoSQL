// Game definitions. Each game produces rounds; a round has:
//   prompt, transport buttons (play actions), answer options, correct index.
// Difficulty scales with the player's per-game level (0-3).

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

function fmtFreq(f) { return f >= 1000 ? (f / 1000).toFixed(f % 1000 === 0 ? 0 : 1) + ' kHz' : f + ' Hz'; }

const GAMES = {
  // ---- EQ Detective: which frequency band is boosted? ----
  eq: {
    id: 'eq',
    icon: '🎚️',
    name: 'EQ Detective',
    desc: 'Pink noise with one frequency band boosted. Identify which band it is — the core skill for mixing and mastering.',
    diffs: [
      { bands: [125, 500, 2000, 8000], gainDb: 12, q: 1.5 },
      { bands: [125, 250, 1000, 4000, 8000], gainDb: 9, q: 2 },
      { bands: [125, 250, 500, 1000, 2000, 4000, 8000], gainDb: 6, q: 2 },
      { bands: [63, 125, 250, 500, 1000, 2000, 4000, 8000, 16000], gainDb: 4.5, q: 2.5 },
    ],
    makeRound(diff) {
      const d = this.diffs[diff];
      const answerIdx = Math.floor(Math.random() * d.bands.length);
      const freq = d.bands[answerIdx];
      return {
        prompt: `A +${d.gainDb} dB boost is hiding in the noise. Which frequency is boosted? Compare against the flat reference.`,
        options: d.bands.map(fmtFreq),
        correct: answerIdx,
        transport: [
          { label: '▶ Boosted', play: (done) => AudioEngine.playNoiseEQ({ freq, gainDb: d.gainDb, q: d.q, duration: 2, onended: done }) },
          { label: '▶ Reference', play: (done) => AudioEngine.playNoiseEQ({ duration: 2, onended: done }) },
        ],
        explain: `It was ${fmtFreq(freq)}.`,
      };
    },
  },

  // ---- Pan Precision: where is the sound in the stereo field? ----
  pan: {
    id: 'pan',
    icon: '🎛️',
    name: 'Pan Precision',
    desc: 'A noise burst placed somewhere in the stereo field. Pinpoint its position — train your spatial hearing.',
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
      return {
        prompt: 'Where in the stereo field is the sound placed? (Use headphones for best results.)',
        options: d.positions.map((p) => this.label(p)),
        correct: answerIdx,
        transport: [
          { label: '▶ Play Sound', play: (done) => AudioEngine.playPanned(panVal, 1.2, done) },
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
    desc: 'Two clips, one slightly louder. Pick the louder one — level judgment is the foundation of gain staging.',
    diffs: [
      { deltaDb: 6 },
      { deltaDb: 3 },
      { deltaDb: 1.5 },
      { deltaDb: 0.8 },
    ],
    makeRound(diff) {
      const d = this.diffs[diff];
      const louderIsA = Math.random() < 0.5;
      const a = louderIsA ? 0 : -d.deltaDb;
      const b = louderIsA ? -d.deltaDb : 0;
      return {
        prompt: `One clip is ${d.deltaDb} dB louder than the other. Which one?`,
        options: ['Clip A', 'Clip B'],
        correct: louderIsA ? 0 : 1,
        transport: [
          { label: '▶ Clip A', play: (done) => AudioEngine.playLevel(a, 1.0, done) },
          { label: '▶ Clip B', play: (done) => AudioEngine.playLevel(b, 1.0, done) },
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
    desc: 'Noise runs through a mystery filter. Name the filter type — learn the sound of every curve.',
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
      return {
        prompt: 'What type of filter is applied to the noise? Compare with the unfiltered reference.',
        options: d.types.map((t) => this.labels[t]),
        correct: answerIdx,
        transport: [
          { label: '▶ Filtered', play: (done) => AudioEngine.playFiltered(type, 1.5, done) },
          { label: '▶ Reference', play: (done) => AudioEngine.playNoiseEQ({ duration: 1.5, onended: done }) },
        ],
        explain: `It was a ${this.labels[type]} filter.`,
      };
    },
  },
};
