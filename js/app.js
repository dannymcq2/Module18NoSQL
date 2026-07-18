// App shell: navigation, session flow, scoring, XP/levels/streaks (localStorage).

const STORAGE_KEY = 'eargym-profile-v1';

const Profile = {
  data: null,
  load() {
    try {
      this.data = JSON.parse(localStorage.getItem(STORAGE_KEY)) || null;
    } catch (e) { this.data = null; }
    if (!this.data) {
      this.data = {
        xp: 0,
        gamesPlayed: 0,
        totalCorrect: 0,
        totalAnswered: 0,
        streak: 0,
        lastPlayed: null, // 'YYYY-MM-DD'
        best: {},         // gameId -> best score
        gameLevel: {},    // gameId -> 0..3 difficulty unlocked
      };
    }
    return this.data;
  },
  save() { localStorage.setItem(STORAGE_KEY, JSON.stringify(this.data)); },

  level() { return Math.floor(Math.sqrt(this.data.xp / 100)) + 1; },
  xpForLevel(l) { return Math.pow(l - 1, 2) * 100; },
  levelProgress() {
    const l = this.level();
    const cur = this.data.xp - this.xpForLevel(l);
    const span = this.xpForLevel(l + 1) - this.xpForLevel(l);
    return Math.min(1, cur / span);
  },

  touchStreak() {
    const today = new Date().toISOString().slice(0, 10);
    if (this.data.lastPlayed === today) return;
    const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
    this.data.streak = this.data.lastPlayed === yesterday ? this.data.streak + 1 : 1;
    this.data.lastPlayed = today;
  },
};

// ---------- DOM helpers ----------
const $ = (id) => document.getElementById(id);

function show(screenId) {
  document.querySelectorAll('.screen').forEach((s) => s.classList.remove('active'));
  $(screenId).classList.add('active');
  AudioEngine.stop();
  $('game').classList.remove('live');
}

function renderHeader() {
  const l = Profile.level();
  $('levelBadge').textContent = `Lv ${l}`;
  $('xpFill').style.width = `${Math.round(Profile.levelProgress() * 100)}%`;
  $('xpLabel').textContent = `${Profile.data.xp} XP`;
  $('streakBadge').textContent = `🔥 ${Profile.data.streak}`;
}

// ---------- Home ----------
const CATEGORIES = ['All', 'Equalization', 'Dynamics', 'Space & Time', 'Distortion'];
let activeCategory = 'All';

function renderCatFilters() {
  const wrap = $('catFilters');
  wrap.innerHTML = '';
  CATEGORIES.forEach((cat) => {
    const count = cat === 'All'
      ? Object.keys(GAMES).length
      : Object.values(GAMES).filter((g) => g.category === cat).length;
    if (count === 0) return;
    const chip = document.createElement('button');
    chip.className = 'cat-chip' + (cat === activeCategory ? ' active' : '');
    chip.innerHTML = `${cat}<span class="count">${count}</span>`;
    chip.addEventListener('click', () => { activeCategory = cat; renderHome(); });
    wrap.appendChild(chip);
  });
}

function renderHome() {
  renderCatFilters();
  const cards = $('gameCards');
  cards.innerHTML = '';
  const games = Object.values(GAMES).filter((g) => activeCategory === 'All' || g.category === activeCategory);
  games.forEach((g) => {
    const lvl = Profile.data.gameLevel[g.id] || 0;
    const best = Profile.data.best[g.id];
    const card = document.createElement('div');
    card.className = 'game-card';
    card.innerHTML = `
      <div class="icon">${g.icon}</div>
      <div class="name">${g.name}</div>
      <div class="desc">${g.desc}</div>
      <div class="best">${best != null ? `⭐ Best: ${best} · ${DIFF_NAMES[lvl]}` : `New! Starts on ${DIFF_NAMES[lvl]}`}</div>
    `;
    card.addEventListener('click', () => startSession(g.id));
    // Cursor-tracking glow (drives the ::before radial via CSS vars)
    card.addEventListener('mousemove', (e) => {
      const r = card.getBoundingClientRect();
      card.style.setProperty('--mx', `${e.clientX - r.left}px`);
      card.style.setProperty('--my', `${e.clientY - r.top}px`);
    });
    cards.appendChild(card);
  });

  const acc = Profile.data.totalAnswered
    ? Math.round((Profile.data.totalCorrect / Profile.data.totalAnswered) * 100) : 0;
  $('statsRow').innerHTML = `
    <div class="stat"><div class="val">${Profile.data.gamesPlayed}</div><div class="lbl">Workouts</div></div>
    <div class="stat"><div class="val">${Profile.data.totalAnswered}</div><div class="lbl">Questions</div></div>
    <div class="stat"><div class="val">${acc}%</div><div class="lbl">Accuracy</div></div>
    <div class="stat"><div class="val">${Profile.data.xp}</div><div class="lbl">Total XP</div></div>
  `;
  renderHeader();
}

// Per-game console accent colors
const GAME_ACCENT = {
  eq: '#22d3ee', pan: '#34d399', level: '#f59e0b', filter: '#a78bfa',
  comp: '#fb7185', reverb: '#38bdf8', dist: '#f97316', delay: '#c084fc',
  tone: '#facc15', width: '#4ade80', bass: '#f472b6',
  balance: '#a3e635', eqmirror: '#38bdf8', compressionist: '#f43f5e',
};

// ---------- Session ----------
let session = null;

function startSession(gameId) {
  const game = GAMES[gameId];
  const diff = Profile.data.gameLevel[gameId] || 0;
  session = {
    game,
    diff,
    round: 0,
    score: 0,
    correct: 0,
    combo: 0,
    bestCombo: 0,
    answered: false,
    results: [], // per-round true/false for the progress dots
  };
  $('gameTitle').textContent = `${game.icon} ${game.name}`;
  $('diffVal').textContent = DIFF_NAMES[diff];
  $('game').style.setProperty('--game-accent', GAME_ACCENT[gameId] || '#22d3ee');
  show('game');
  nextRound();
}

// Toggle the studio "live" animations while audio plays
function setLive(on) { $('game').classList.toggle('live', on); }

// Shuffle a round's answer buttons in place, keeping `correct` pointing at the
// right option.
function shuffleOptions(round) {
  const perm = round.options.map((_, i) => i);
  for (let i = perm.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [perm[i], perm[j]] = [perm[j], perm[i]];
  }
  round.options = perm.map((i) => round.options[i]);
  round.correct = perm.indexOf(round.correct);
}

function renderDots() {
  const s = session;
  const wrap = $('roundDots');
  wrap.innerHTML = '';
  for (let i = 0; i < ROUNDS_PER_GAME; i++) {
    const d = document.createElement('div');
    d.className = 'dot';
    if (i < s.results.length) d.classList.add(s.results[i] ? 'hit' : 'miss');
    else if (i === s.results.length) d.classList.add('now');
    wrap.appendChild(d);
  }
}

function popNumber(el) {
  el.classList.remove('pop');
  void el.offsetWidth; // restart the animation
  el.classList.add('pop');
}

// Maps a game's semantic answerType to the CSS variable that colors segment
// hover — kept independent of --game-accent so e.g. frequency answers always
// hover cyan, pan/width answers always hover green, dB answers always hover
// amber, regardless of which game you're in.
const TYPE_HOVER_VAR = {
  freq: 'var(--type-freq)', pan: 'var(--type-pan)', db: 'var(--type-db)',
  time: 'var(--type-time)', category: 'var(--type-category)',
};

function buildTransport(s) {
  const tp = $('transport');
  tp.innerHTML = '';
  (s.current.transport || []).forEach((t, idx) => {
    const b = document.createElement('button');
    b.className = 'play-btn';
    b.innerHTML = `<span class="eqviz"><i></i><i></i><i></i><i></i></span><span>${t.label.replace('▶ ', '')}</span>`;
    b.addEventListener('click', () => {
      tp.querySelectorAll('.play-btn').forEach((x) => x.classList.remove('playing'));
      b.classList.add('playing');
      setLive(true);
      s.lastTransportIdx = idx;
      t.play(() => { b.classList.remove('playing'); setLive(false); });
    });
    tp.appendChild(b);
  });
  s.lastTransportIdx = 0;
  return tp;
}

function renderChoiceRound(s) {
  const disp = $('display');
  disp.className = 'console-display';
  disp.innerHTML = '';
  disp.style.setProperty('--seg-hover', TYPE_HOVER_VAR[s.game.answerType] || 'var(--game-accent)');
  s.current.options.forEach((opt, i) => {
    const seg = document.createElement('button');
    seg.className = 'seg';
    seg.innerHTML = `<span class="seg-key">${i + 1}</span><span class="seg-label">${opt}</span>`;
    seg.addEventListener('click', () => answer(i, seg));
    disp.appendChild(seg);
  });
  buildTransport(s);
  $('kbdHint').innerHTML = `<kbd>1</kbd>–<kbd>${s.current.options.length}</kbd> to answer · <kbd>Space</kbd> to replay`;
}

function renderFaderRound(s) {
  const disp = $('display');
  disp.className = 'console-display fader-bank';
  disp.innerHTML = '';
  s.tuneValues = s.current.tracks.map((t) => t.default);
  s.current.tracks.forEach((t, i) => {
    const track = document.createElement('div');
    track.className = 'fader-track';
    const val = document.createElement('div');
    val.className = 'fader-val';
    val.textContent = `${t.default > 0 ? '+' : ''}${t.default} dB`;
    const input = document.createElement('input');
    input.type = 'range';
    input.className = 'fader-input';
    input.min = t.min; input.max = t.max; input.step = t.step; input.value = t.default;
    input.addEventListener('input', () => {
      const v = Number(input.value);
      s.tuneValues[i] = v;
      val.textContent = `${v > 0 ? '+' : ''}${v} dB`;
    });
    const name = document.createElement('div');
    name.className = 'fader-name';
    name.textContent = t.name;
    track.appendChild(val); track.appendChild(input); track.appendChild(name);
    disp.appendChild(track);
  });

  const tp = buildTransport(s);
  const refBtn = document.createElement('button');
  refBtn.className = 'play-btn';
  refBtn.innerHTML = `<span class="eqviz"><i></i><i></i><i></i><i></i></span><span>Reference</span>`;
  refBtn.addEventListener('click', () => {
    tp.querySelectorAll('.play-btn').forEach((x) => x.classList.remove('playing'));
    refBtn.classList.add('playing');
    setLive(true);
    s.current.playReference(() => { refBtn.classList.remove('playing'); setLive(false); });
  });
  const mixBtn = document.createElement('button');
  mixBtn.className = 'play-btn';
  mixBtn.innerHTML = `<span class="eqviz"><i></i><i></i><i></i><i></i></span><span>My Mix</span>`;
  mixBtn.addEventListener('click', () => {
    tp.querySelectorAll('.play-btn').forEach((x) => x.classList.remove('playing'));
    mixBtn.classList.add('playing');
    setLive(true);
    s.current.playAttempt(s.tuneValues, () => { mixBtn.classList.remove('playing'); setLive(false); });
  });
  tp.appendChild(refBtn); tp.appendChild(mixBtn);
  addSubmitButton(tp, submitTune);
  $('kbdHint').innerHTML = `<kbd>Space</kbd> to replay · <kbd>Enter</kbd> to submit`;
}

// Rotary knob control. Drag vertically (up = increase) or use arrow keys
// while focused. `scale: 'log'` maps drag position onto a log-frequency range.
function attachKnob(el, valEl, { min, max, scale = 'linear', value, unit, fmt }, onChange) {
  let val = value;
  const toNorm = (v) => (scale === 'log' ? Math.log(v / min) / Math.log(max / min) : (v - min) / (max - min));
  const fromNorm = (n) => {
    n = Math.min(1, Math.max(0, n));
    return scale === 'log' ? min * Math.pow(max / min, n) : min + n * (max - min);
  };
  const format = fmt || ((v) => `${Math.round(v)}${unit || ''}`);
  function render() {
    const n = toNorm(val);
    el.querySelector('.knob-indicator').style.transform = `rotate(${-135 + n * 270}deg)`;
    el.style.setProperty('--knob-fill', String(n * 100));
    valEl.textContent = format(val);
  }
  function setValue(v, fire) {
    val = Math.min(max, Math.max(min, v));
    render();
    if (fire !== false && onChange) onChange(val);
  }
  let dragging = false, startY = 0, startNorm = 0;
  el.addEventListener('pointerdown', (e) => {
    dragging = true; startY = e.clientY; startNorm = toNorm(val);
    el.setPointerCapture(e.pointerId);
    el.classList.add('dragging');
  });
  el.addEventListener('pointermove', (e) => {
    if (!dragging) return;
    setValue(fromNorm(startNorm + (startY - e.clientY) / 140));
  });
  const endDrag = () => { dragging = false; el.classList.remove('dragging'); };
  el.addEventListener('pointerup', endDrag);
  el.addEventListener('pointercancel', endDrag);
  el.tabIndex = 0;
  el.addEventListener('keydown', (e) => {
    const n = toNorm(val);
    if (e.key === 'ArrowUp' || e.key === 'ArrowRight') { setValue(fromNorm(n + 0.02)); e.preventDefault(); }
    if (e.key === 'ArrowDown' || e.key === 'ArrowLeft') { setValue(fromNorm(n - 0.02)); e.preventDefault(); }
  });
  render();
  return { setValue, getValue: () => val };
}

function renderKnobRound(s) {
  const disp = $('display');
  disp.className = 'console-display knob-panel';
  disp.innerHTML = `
    <div class="knob" role="slider" aria-label="value knob"><div class="knob-indicator"></div></div>
    <div class="knob-val"></div>
    <div class="knob-hint">Drag up/down or use arrow keys</div>
  `;
  const p = s.current.param;
  const fmt = p.unit === 'Hz' ? (v) => fmtFreq(Math.round(v)) : (v) => `${Math.round(v)}${p.unit}`;
  s.tuneValue = p.default;
  s.knobCtl = attachKnob(
    disp.querySelector('.knob'),
    disp.querySelector('.knob-val'),
    { min: p.min, max: p.max, scale: p.scale, value: p.default, unit: p.unit, fmt },
    (v) => { s.tuneValue = v; }
  );

  const tp = buildTransport(s);
  const targetBtn = document.createElement('button');
  targetBtn.className = 'play-btn';
  targetBtn.innerHTML = `<span class="eqviz"><i></i><i></i><i></i><i></i></span><span>Target</span>`;
  targetBtn.addEventListener('click', () => {
    tp.querySelectorAll('.play-btn').forEach((x) => x.classList.remove('playing'));
    targetBtn.classList.add('playing');
    setLive(true);
    s.current.playTarget(() => { targetBtn.classList.remove('playing'); setLive(false); });
  });
  const yoursBtn = document.createElement('button');
  yoursBtn.className = 'play-btn';
  yoursBtn.innerHTML = `<span class="eqviz"><i></i><i></i><i></i><i></i></span><span>Yours</span>`;
  yoursBtn.addEventListener('click', () => {
    tp.querySelectorAll('.play-btn').forEach((x) => x.classList.remove('playing'));
    yoursBtn.classList.add('playing');
    setLive(true);
    s.current.playYours(s.tuneValue, () => { yoursBtn.classList.remove('playing'); setLive(false); });
  });
  tp.appendChild(targetBtn); tp.appendChild(yoursBtn);
  addSubmitButton(tp, submitTune);
  $('kbdHint').innerHTML = `<kbd>Space</kbd> to replay · <kbd>Enter</kbd> to submit`;
}

function addSubmitButton(tp, handler) {
  const btn = document.createElement('button');
  btn.className = 'primary small';
  btn.id = 'submitBtn';
  btn.textContent = 'Submit';
  btn.addEventListener('click', handler);
  tp.appendChild(btn);
}

function nextRound() {
  const s = session;
  if (s.round >= ROUNDS_PER_GAME) { endSession(); return; }
  s.round++;
  s.answered = false;
  s.current = s.game.makeRound(s.diff);
  if (!s.current.type || s.current.type === 'choice') shuffleOptions(s.current);

  $('roundInd').textContent = `${s.round} / ${ROUNDS_PER_GAME}`;
  $('scoreVal').textContent = s.score;
  $('comboVal').textContent = s.combo;
  $('gamePrompt').innerHTML = s.current.prompt;
  $('feedback').textContent = '';
  $('feedback').className = 'feedback';
  renderDots();

  if (s.current.type === 'fader') renderFaderRound(s);
  else if (s.current.type === 'knob') renderKnobRound(s);
  else renderChoiceRound(s);
}

// Shared scoring: both multiple-choice answers and knob/fader submissions
// route through here so combo, XP, dots, and feedback stay consistent.
function settleRound(correct, detailMsg) {
  const s = session;
  Profile.data.totalAnswered++;
  const fb = $('feedback');
  if (correct) {
    s.combo++;
    s.bestCombo = Math.max(s.bestCombo, s.combo);
    s.correct++;
    Profile.data.totalCorrect++;
    // Base 100, +10 per combo step, +25 per difficulty tier
    const pts = 100 + (s.combo - 1) * 10 + s.diff * 25;
    s.score += pts;
    fb.innerHTML = `✓ Correct! +${pts}` + (detailMsg ? `<span class="feedback-detail">${detailMsg}</span>` : '');
  } else {
    s.combo = 0;
    fb.innerHTML = `✗ ${detailMsg || 'Not quite.'}`;
  }
  fb.className = correct ? 'feedback good' : 'feedback bad';
  AudioEngine.blip(correct);
  s.results.push(correct);
  renderDots();
  $('scoreVal').textContent = s.score;
  $('comboVal').textContent = s.combo;
  document.querySelector('.ch-num.combo').classList.toggle('hot', s.combo >= 3);
  if (correct) { popNumber($('scoreVal')); popNumber($('comboVal')); }

  setTimeout(nextRound, 1600);
}

function answer(i, btn) {
  const s = session;
  if (s.answered) return;
  s.answered = true;
  AudioEngine.stop();
  setLive(false);
  $('transport').querySelectorAll('.play-btn').forEach((x) => x.classList.remove('playing'));

  const correct = i === s.current.correct;
  const buttons = $('display').querySelectorAll('.seg');
  buttons.forEach((b) => (b.disabled = true));
  buttons[s.current.correct].classList.add('correct');
  if (!correct) btn.classList.add('wrong');

  settleRound(correct, correct ? null : s.current.explain);
}

function submitTune() {
  const s = session;
  if (s.answered) return;
  s.answered = true;
  AudioEngine.stop();
  setLive(false);
  $('transport').querySelectorAll('.play-btn').forEach((x) => x.classList.remove('playing'));
  const submitBtn = $('submitBtn');
  if (submitBtn) submitBtn.disabled = true;
  $('display').querySelectorAll('input, .knob').forEach((el) => { el.disabled = true; el.style.pointerEvents = 'none'; });

  let correct, detail;
  if (s.current.type === 'knob') {
    const val = s.tuneValue;
    const err = Math.abs(val - s.current.target);
    correct = err <= s.current.tolerance;
    detail = s.current.explain(val, err);
  } else {
    const vals = s.tuneValues;
    const errs = vals.map((v, i) => Math.abs(v - s.current.tracks[i].target));
    const avgErr = errs.reduce((a, b) => a + b, 0) / errs.length;
    correct = avgErr <= s.current.tolerance;
    detail = s.current.explain(vals, avgErr);
  }
  settleRound(correct, detail);
}

function countUp(el, target, ms = 900) {
  const start = performance.now();
  const tick = (now) => {
    const p = Math.min(1, (now - start) / ms);
    const eased = 1 - Math.pow(1 - p, 3);
    el.textContent = Math.round(target * eased);
    if (p < 1) requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}

function burstConfetti(count = 90) {
  const colors = ['#6366f1', '#8b5cf6', '#22d3ee', '#34d399', '#fbbf24', '#fb7185'];
  for (let i = 0; i < count; i++) {
    const p = document.createElement('div');
    p.className = 'confetti-piece';
    p.style.left = `${Math.random() * 100}vw`;
    p.style.background = colors[i % colors.length];
    p.style.animationDuration = `${2 + Math.random() * 2.2}s`;
    p.style.animationDelay = `${Math.random() * 0.7}s`;
    p.style.transform = `rotate(${Math.random() * 360}deg)`;
    document.body.appendChild(p);
    p.addEventListener('animationend', () => p.remove());
  }
}

function endSession() {
  const s = session;
  Profile.data.gamesPlayed++;
  Profile.touchStreak();

  const xpEarned = Math.round(s.score / 10);
  const levelBefore = Profile.level();
  Profile.data.xp += xpEarned;

  const prevBest = Profile.data.best[s.game.id] || 0;
  const isBest = s.score > prevBest;
  if (isBest) Profile.data.best[s.game.id] = s.score;

  // Promote difficulty at >= 80% accuracy, demote below 40%
  const accuracy = s.correct / ROUNDS_PER_GAME;
  let promoMsg = '';
  const lvl = Profile.data.gameLevel[s.game.id] || 0;
  if (accuracy >= 0.8 && lvl < 3) {
    Profile.data.gameLevel[s.game.id] = lvl + 1;
    promoMsg = `⬆️ Promoted to <b>${DIFF_NAMES[lvl + 1]}</b> difficulty!`;
  } else if (accuracy < 0.4 && lvl > 0) {
    Profile.data.gameLevel[s.game.id] = lvl - 1;
    promoMsg = `You'll get it — moving back to <b>${DIFF_NAMES[lvl - 1]}</b> to rebuild.`;
  }
  Profile.save();

  $('resultTitle').textContent = accuracy >= 0.8 ? '🏆 Crushed It!' : accuracy >= 0.5 ? 'Workout Complete!' : 'Keep Training!';
  countUp($('finalScore'), s.score);
  if (accuracy >= 0.8 || (isBest && prevBest > 0)) burstConfetti();
  if (Profile.level() > levelBefore) {
    $('levelBadge').classList.add('bump');
    setTimeout(() => $('levelBadge').classList.remove('bump'), 600);
  }
  $('resultLines').innerHTML = [
    `<b>${s.correct} / ${ROUNDS_PER_GAME}</b> correct · best streak <b>${s.bestCombo}</b>`,
    `+<b>${xpEarned} XP</b> earned`,
    isBest && prevBest > 0 ? `<span class="gold">🎉 New personal best!</span>` : '',
    promoMsg,
  ].filter(Boolean).join('<br>');

  renderHeader();
  show('results');
}

// ---------- Wiring ----------
Profile.load();
renderHome();
show('home');

// Loudness-match the compression game's clips in the background (offline render).
AudioEngine.calibrateCompression(GAMES.comp.diffs);
// Pre-render Balance Memory's 4 loopable stems (offline render).
AudioEngine.prepareMixBuffers();

$('homeBtn').addEventListener('click', () => { renderHome(); show('home'); });
$('quitBtn').addEventListener('click', () => { session = null; renderHome(); show('home'); });
$('backBtn').addEventListener('click', () => { renderHome(); show('home'); });
$('againBtn').addEventListener('click', () => startSession(session.game.id));

// Keyboard shortcuts during a round: 1-9 pick an answer segment, Space
// replays the last-played transport button, Enter submits a knob/fader
// round. Deferred to native behavior when a button/input/knob already has
// focus, so Tab-based keyboard navigation still works normally.
document.addEventListener('keydown', (e) => {
  if (!session || !$('game').classList.contains('active')) return;
  if (e.target.closest && e.target.closest('button, input, .knob')) return;

  if (e.key >= '1' && e.key <= '9') {
    const segs = document.querySelectorAll('#display .seg');
    const seg = segs[Number(e.key) - 1];
    if (seg && !seg.disabled) { e.preventDefault(); seg.click(); }
  } else if (e.code === 'Space') {
    const buttons = document.querySelectorAll('#transport .play-btn');
    const btn = buttons[Math.min(session.lastTransportIdx || 0, buttons.length - 1)];
    if (btn) { e.preventDefault(); btn.click(); }
  } else if (e.key === 'Enter') {
    const submitBtn = $('submitBtn');
    if (submitBtn && !submitBtn.disabled) { e.preventDefault(); submitBtn.click(); }
  }
});
