// ── Streak ────────────────────────────────────────────────────
function calcStreak() {
  const stats = loadStats();
  const dates = new Set(Object.values(stats.lessons || {}).map(l => l.lastPlayed).filter(Boolean));
  if (dates.size === 0) return 0;
  const today = new Date().toLocaleDateString('en-CA');
  let streak = 0;
  let d = new Date(today);
  while (true) {
    const ds = d.toLocaleDateString('en-CA');
    if (dates.has(ds)) { streak++; d.setDate(d.getDate() - 1); }
    else break;
  }
  return streak;
}

// ── Streak Grace Period (L5) ──────────────────────────────────
function daysSinceLastActivity() {
  const stats = loadStats();
  const dates = Object.values(stats.lessons || {}).map(l => l.lastPlayed).filter(Boolean);
  if (dates.length === 0) return null;
  const lastDate = dates.sort().at(-1);
  const today = new Date().toLocaleDateString('en-CA');
  return Math.round((new Date(today) - new Date(lastDate)) / 86400000);
}

function restoreStreak() {
  const stats = loadStats();
  if ((stats.totalXP || 0) < 50) {
    showHomeError('Not enough XP to restore your streak (need 50 XP).');
    return;
  }
  stats.totalXP -= 50;
  const yesterday = new Date(Date.now() - 86400000).toLocaleDateString('en-CA');
  const RESTORE_KEY = '__streak_restore__';
  if (!stats.lessons[RESTORE_KEY]) stats.lessons[RESTORE_KEY] = { completions: 1, bestAccuracy: 0 };
  stats.lessons[RESTORE_KEY].lastPlayed = yesterday;
  stats.streakMissedDays = 0;
  localStorage.setItem(STATS_KEY, JSON.stringify(stats));
  updateHomeProgress();
}

// ── H11: inline error instead of alert() ─────────────────────
function showHomeError(msg) {
  let el = document.getElementById('home-inline-error');
  if (!el) {
    el = document.createElement('div');
    el.id = 'home-inline-error';
    el.className = 'inline-error';
    const actions = document.getElementById('home-actions');
    if (actions) actions.insertAdjacentElement('afterend', el);
    else document.getElementById('screen-home').appendChild(el);
  }
  el.textContent = msg;
  el.style.display = 'block';
  clearTimeout(el._hideTimer);
  el._hideTimer = setTimeout(() => { el.style.display = 'none'; }, 4000);
}

// ── Grammar Reference ─────────────────────────────────────────
function showGrammarRef() { showScreen('grammar'); }

// ── Daily Review ──────────────────────────────────────────────
function startDailyReview() {
  const vocab = loadVocab();
  // M1: use SRS-scheduled getDueWords() — only show words whose nextReview is today or overdue
  const dueEntries = getDueWords().filter(v => v.seen > 0);
  const due = dueEntries.slice(0, 10).map(v => v.word);

  if (due.length < 2) {
    showHomeError('Complete a few lessons first to unlock Daily Review!'); // H11
    return;
  }

  // H2: dictation exercises — TTS plays word, user types what they hear
  const exercises = due.slice(0, 8).map(word => ({
    type: 'listening',
    prompt: 'Listen and type the Italian word you hear:',
    audio: word,
    answer: word,
    hint: `You've seen this word ${vocab[word].seen} time${vocab[word].seen !== 1 ? 's' : ''}`
  }));

  currentTopic = 'daily_review';
  currentExercises = exercises;
  currentIndex = 0; xp = 0; correct = 0; answered = false; mistakes = [];
  initHearts(); // H10: was missing — stale hearts from previous lesson
  showScreen('lesson');
  document.getElementById('progress-fill').style.width = '0%';
  document.getElementById('xp-counter').textContent = '0 XP';
  renderExercise();
}

// ── Journey card ───────────────────────────────────────────────
const JM_LEVELS = [
  { id:'a1', label:'A1', name:'Beginner',           color:'#2d9b6f', bg:'#e8f7f1', need:4,  next:'A2' },
  { id:'a2', label:'A2', name:'Elementary',         color:'#378add', bg:'#eaf3fc', need:6,  next:'B1' },
  { id:'b1', label:'B1', name:'Intermediate',       color:'#ef9f27', bg:'#fdf3e3', need:6,  next:'B2' },
  { id:'b2', label:'B2', name:'Upper-Intermediate', color:'#e24b4a', bg:'#fdf0f0', need:8,  next:'C1' },
  { id:'c1', label:'C1', name:'Advanced',           color:'#7f77dd', bg:'#eeedfe', need:8,  next:'C2' },
  { id:'c2', label:'C2', name:'Mastery',            color:'#b84fa8', bg:'#fce9f4', need:null, next:null },
];

function renderJourneyCard() {
  const el = document.getElementById('journey-card');
  if (!el) return;
  const stats = loadStats();
  const done = { a1:0, a2:0, b1:0, b2:0, c1:0, c2:0 };
  Object.entries(stats.lessons || {}).forEach(([id, s]) => {
    if (s.completions > 0 && LESSON_DIFF[id]) done[LESSON_DIFF[id]]++;
  });

  let idx = 0;
  if (done.a1 >= 4) idx = 1;
  if (done.a2 >= 6) idx = 2;
  if (done.b1 >= 6) idx = 3;
  if (done.b2 >= 8) idx = 4;
  if (done.c1 >= 8) idx = 5;

  const cur = JM_LEVELS[idx];
  const doneCount = done[cur.id];
  const pct = cur.need ? Math.min(100, Math.round((doneCount / cur.need) * 100)) : 100;
  const remaining = cur.need ? Math.max(0, cur.need - doneCount) : 0;
  const hint = cur.next
    ? (remaining > 0 ? `Complete ${remaining} more ${cur.label} lesson${remaining > 1 ? 's' : ''} to reach ${cur.next}` : `Ready to advance to ${cur.next}!`)
    : 'You\'ve reached the highest level!';

  const dots = JM_LEVELS.map((lv, i) => {
    const past = i < idx, active = i === idx;
    const dotStyle = (past || active) ? `background:${lv.color};border-color:${lv.color};${active ? `box-shadow:0 0 0 3px ${lv.bg};` : ''}` : '';
    const segStyle = past ? `background:${JM_LEVELS[i].color};` : '';
    return `<div class="jm-dot" style="${dotStyle}"></div>${i < JM_LEVELS.length - 1 ? `<div class="jm-seg" style="${segStyle}"></div>` : ''}`;
  }).join('');

  const labels = JM_LEVELS.map((lv, i) => {
    const active = i <= idx;
    return `<span class="jm-lbl" style="${active ? `color:${lv.color};font-weight:700;` : ''}">${lv.label}</span>`;
  }).join('');

  el.innerHTML = `
    <div class="jm-dots-row">${dots}</div>
    <div class="jm-labels-row">${labels}</div>
    <div class="jm-info">
      <span class="jm-badge" style="background:${cur.bg};color:${cur.color};">${cur.label}</span>
      <div><div class="jm-name">${cur.name}</div><div class="jm-hint">${hint}</div></div>
    </div>
    ${cur.need ? `<div class="jm-bar-track"><div class="jm-bar-fill" style="width:${pct}%;background:${cur.color};"></div></div><div class="jm-bar-label">${doneCount} / ${cur.need} ${cur.label} lessons</div>` : ''}`;
}

// ── Go to current unit in lessons tab ────────────────────────
function goToCurrentUnit(unitId) {
  showTab('lessons');
  requestAnimationFrame(() => {
    const unitBlocks = document.querySelectorAll('#course-map .unit-block');
    const unitIndex = COURSE.findIndex(u => u.id === unitId);
    if (unitIndex >= 0 && unitBlocks[unitIndex]) {
      unitBlocks[unitIndex].scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  });
}

// ── Home current unit card ────────────────────────────────────
function renderHomeCurrentUnit() {
  const el = document.getElementById('home-current-unit');
  if (!el) return;
  const stats = loadStats();

  // Find the first unit that isn't fully completed
  let activeUnit = null;
  let activeUnitIdx = -1;
  for (let i = 0; i < COURSE.length; i++) {
    const unit = COURSE[i];
    const doneCount = unit.lessons.filter(l => stats.lessons[l.id]?.completions > 0).length;
    if (doneCount < unit.lessons.length) {
      activeUnit = unit;
      activeUnitIdx = i;
      break;
    }
  }
  // All units complete — show last
  if (!activeUnit) {
    activeUnit = COURSE[COURSE.length - 1];
    activeUnitIdx = COURSE.length - 1;
  }

  const doneCount = activeUnit.lessons.filter(l => stats.lessons[l.id]?.completions > 0).length;
  const total = activeUnit.lessons.length;
  const pct = Math.round((doneCount / total) * 100);

  // Find next lesson emoji
  const nextLesson = activeUnit.lessons.find(l => !(stats.lessons[l.id]?.completions > 0));
  const icon = nextLesson ? nextLesson.emoji : '✓';

  // Resolve CSS variable color to a raw value for inline style
  const colorMap = { 'var(--green)':'#2d9b6f','var(--blue)':'#378add','var(--purple)':'#7f77dd','var(--amber)':'#ef9f27','var(--red)':'#e24b4a' };
  const barColor = colorMap[activeUnit.color] || '#2d9b6f';

  el.innerHTML = `<div class="section-header" style="margin-top:8px;">Continue Learning</div><div class="home-unit-card" onclick="goToCurrentUnit('${activeUnit.id}')">
    <div class="huc-icon">${icon}</div>
    <div class="huc-body">
      <div class="huc-label">Current Unit</div>
      <div class="huc-title">${activeUnit.title}</div>
      <div class="huc-bar-track"><div class="huc-bar-fill" style="width:${pct}%;background:${barColor};"></div></div>
      <div class="huc-progress">${doneCount} of ${total} lessons complete</div>
    </div>
    <div class="huc-arrow">›</div>
  </div>`;
  el.style.display = 'block';
}

// ── updateHomeProgress ────────────────────────────────────────
function updateHomeProgress() {
  const stats = loadStats();
  const vocab = loadVocab();
  const totalXP = stats.totalXP || 0;
  const wordsLearned = Object.values(vocab).filter(v => v.correct >= 1).length;
  const wordsMastered = Object.values(vocab).filter(v => vocabLevel(v) === 'strong').length;
  const streak = calcStreak();

  if (totalXP > 0 || wordsLearned > 0) {
    const bar = document.getElementById('home-stats-bar');
    if (bar) bar.style.display = 'flex';
    const xpEl = document.getElementById('home-xp');
    if (xpEl) xpEl.textContent = totalXP;
    const wordsEl = document.getElementById('home-words');
    if (wordsEl) wordsEl.textContent = wordsLearned;
    const masteredEl = document.getElementById('home-mastered');
    if (masteredEl) masteredEl.textContent = wordsMastered;
    const actions = document.getElementById('home-actions');
    if (actions) actions.style.display = 'block';

    // Streak badge in header
    const badge = document.getElementById('home-streak-badge');
    if (badge) {
      const countEl = document.getElementById('home-streak-count');
      if (streak >= 1) {
        badge.style.display = 'flex';
        if (countEl) countEl.textContent = streak === 1 ? '1d' : streak + 'd streak';
      } else {
        badge.style.display = 'none';
      }
    }

    // Update daily review subtitle with due word count
    const drcSub = document.getElementById('drc-sub');
    if (drcSub) {
      const dueCount = getDueWords().filter(v => v.seen > 0).length;
      drcSub.textContent = dueCount > 0
        ? `${Math.min(dueCount, 8)} word${dueCount !== 1 ? 's' : ''} due for review`
        : 'No words due — keep learning!';
    }

    // L5: show streak restore bar if user missed exactly 1 day and has XP
    const restoreBar = document.getElementById('streak-restore-bar');
    if (restoreBar) {
      const missed = daysSinceLastActivity();
      restoreBar.style.display = (missed === 1 && streak === 0 && totalXP >= 50) ? 'flex' : 'none';
    }
  }
  renderCourseMap();
  renderJourneyCard();
  renderHomeCurrentUnit();
}

// ── Skill-tree unlock logic ────────────────────────────────────
function isUnitUnlocked(unitIdx, stats) {
  if (unitIdx === 0) return true;
  const prevUnit = COURSE[unitIdx - 1];
  const doneCount = prevUnit.lessons.filter(l => stats.lessons[l.id]?.completions > 0).length;
  return doneCount >= Math.ceil(prevUnit.lessons.length * 0.5);
}

function isLessonUnlocked(unitIdx, _lessonIdx, stats) {
  return isUnitUnlocked(unitIdx, stats);
}

// ── Skill-tree course map ──────────────────────────────────────
function renderCourseMap() {
  const stats = loadStats();
  const el = document.getElementById('course-map');
  if (!el) return;

  let firstAvailableMarked = false;

  const html = COURSE.map((unit, unitIdx) => {
    const lessons = unit.lessons;
    const doneCount = lessons.filter(l => stats.lessons[l.id]?.completions > 0).length;
    const allDone = doneCount === lessons.length;
    const firstUnlocked = isLessonUnlocked(unitIdx, 0, stats);

    // Completed unit — L11: each dot is clickable to replay
    if (allDone) {
      const dots = lessons.map(lesson =>
        `<span class="ucr-dot ucr-dot-replay" onclick="startLesson('${lesson.id}')" title="Replay: ${escHtml(lesson.title)}">✓</span>`
      ).join('');
      return `<div class="unit-block unit-done">
        <div class="unit-header-bar" style="background:${unit.color};">
          <span class="uhb-title">${unit.title}</span>
          <span class="uhb-badge">Complete ✓</span>
        </div>
        <div class="unit-complete-row">${dots}</div>
      </div>`;
    }

    // Future locked unit
    if (!firstUnlocked) {
      const prevUnit = COURSE[unitIdx - 1];
      const prevDone = prevUnit ? prevUnit.lessons.filter(l => stats.lessons[l.id]?.completions > 0).length : 0;
      const needed = prevUnit ? Math.ceil(prevUnit.lessons.length * 0.5) - prevDone : 0;
      const note = needed > 0 ? `Complete ${needed} more in Unit ${unitIdx} to unlock` : 'Almost unlocked!';
      return `<div class="unit-block unit-locked">
        <div class="unit-header-bar unit-header-locked">
          <span class="uhb-title">${unit.title}</span>
          <span class="uhb-lock">🔒</span>
        </div>
        <div class="uhb-unlock-note">${note}</div>
      </div>`;
    }

    // Active unit: full zigzag skill tree
    const nodesHtml = lessons.map((lesson, lessonIdx) => {
      const unlocked = isLessonUnlocked(unitIdx, lessonIdx, stats);
      const done = !!(stats.lessons[lesson.id]?.completions > 0);
      let state;
      if (done) { state = 'done'; }
      else if (!unlocked) { state = 'locked'; }
      else if (!firstAvailableMarked) { state = 'current'; firstAvailableMarked = true; }
      else { state = 'open'; }

      const side = lessonIdx % 2 === 0 ? 'left' : 'right';
      const onclick = state !== 'locked' ? `onclick="startLesson('${lesson.id}')"` : '';
      const ring = state === 'current' ? '<div class="tn-ring"></div>' : '';
      let inner;
      if (state === 'done') {
        inner = `<span class="tn-check">✓</span>`;
      } else if (state === 'locked') {
        inner = `<svg class="tn-lock" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/></svg>`;
      } else {
        inner = `<span class="tn-emoji">${lesson.emoji}</span>`;
      }

      const completions = stats.lessons[lesson.id]?.completions || 0;
      const meta = done ? `Completed ${completions}×`
        : state === 'current' ? 'Start →'
        : state === 'open' ? lesson.desc
        : 'Complete previous lesson';

      return `<div class="tree-node tree-node-${side} tree-state-${state}" ${onclick}>
        <div class="tn-circle">${ring}${inner}</div>
        <div class="tn-label">
          <div class="tn-title">${lesson.title}</div>
          <div class="tn-meta">${meta}</div>
        </div>
      </div>`;
    }).join('');

    return `<div class="unit-block unit-active">
      <div class="unit-header-bar" style="background:${unit.color};">
        <span class="uhb-title">${unit.title}</span>
        <span class="uhb-prog">${doneCount}/${lessons.length}</span>
      </div>
      <div class="tree-unit-nodes">${nodesHtml}</div>
    </div>`;
  }).join('');

  el.innerHTML = html;
}

// Init
renderCourseMap();
renderJourneyCard();
renderHomeCurrentUnit();
updateHomeProgress();
