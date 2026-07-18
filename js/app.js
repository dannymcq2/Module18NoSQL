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
}

function renderHeader() {
  const l = Profile.level();
  $('levelBadge').textContent = `Lv ${l}`;
  $('xpFill').style.width = `${Math.round(Profile.levelProgress() * 100)}%`;
  $('xpLabel').textContent = `${Profile.data.xp} XP`;
  $('streakBadge').textContent = `🔥 ${Profile.data.streak}`;
}

// ---------- Home ----------
function renderHome() {
  const cards = $('gameCards');
  cards.innerHTML = '';
  Object.values(GAMES).forEach((g) => {
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
  show('game');
  nextRound();
}

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

function nextRound() {
  const s = session;
  if (s.round >= ROUNDS_PER_GAME) { endSession(); return; }
  s.round++;
  s.answered = false;
  s.current = s.game.makeRound(s.diff);
  shuffleOptions(s.current); // vary button positions so answers can't be pattern-matched

  $('roundInd').textContent = `Round ${s.round} / ${ROUNDS_PER_GAME}`;
  $('scoreVal').textContent = s.score;
  $('comboVal').textContent = s.combo;
  $('gamePrompt').textContent = s.current.prompt;
  $('feedback').textContent = '';
  $('feedback').className = 'feedback';
  renderDots();

  // Transport buttons (with animated EQ-bar indicator while playing)
  const tp = $('transport');
  tp.innerHTML = '';
  s.current.transport.forEach((t) => {
    const b = document.createElement('button');
    b.className = 'play-btn';
    b.innerHTML = `<span class="eqviz"><i></i><i></i><i></i><i></i></span><span>${t.label.replace('▶ ', '')}</span>`;
    b.addEventListener('click', () => {
      tp.querySelectorAll('.play-btn').forEach((x) => x.classList.remove('playing'));
      b.classList.add('playing');
      t.play(() => b.classList.remove('playing'));
    });
    tp.appendChild(b);
  });

  // Answer buttons
  const ans = $('answers');
  ans.innerHTML = '';
  s.current.options.forEach((opt, i) => {
    const b = document.createElement('button');
    b.className = 'answer';
    b.textContent = opt;
    b.addEventListener('click', () => answer(i, b));
    ans.appendChild(b);
  });
}

function answer(i, btn) {
  const s = session;
  if (s.answered) return;
  s.answered = true;
  AudioEngine.stop();

  const correct = i === s.current.correct;
  const buttons = $('answers').querySelectorAll('.answer');
  buttons.forEach((b) => (b.disabled = true));
  buttons[s.current.correct].classList.add('correct');

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
    fb.textContent = `✓ Correct! +${pts}`;
    fb.className = 'feedback good';
  } else {
    s.combo = 0;
    btn.classList.add('wrong');
    fb.textContent = `✗ ${s.current.explain}`;
    fb.className = 'feedback bad';
  }
  AudioEngine.blip(correct);
  s.results.push(correct);
  renderDots();
  $('scoreVal').textContent = s.score;
  $('comboVal').textContent = s.combo;
  if (correct) { popNumber($('scoreVal')); popNumber($('comboVal')); }

  setTimeout(nextRound, 1400);
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

$('homeBtn').addEventListener('click', () => { renderHome(); show('home'); });
$('quitBtn').addEventListener('click', () => { session = null; renderHome(); show('home'); });
$('backBtn').addEventListener('click', () => { renderHome(); show('home'); });
$('againBtn').addEventListener('click', () => startSession(session.game.id));
