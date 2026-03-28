// ── Streak ────────────────────────────────────────────────────
function calcStreak() {
  const stats = loadStats();
  const dates = new Set(Object.values(stats.lessons || {}).map(l => l.lastPlayed).filter(Boolean));
  if (dates.size === 0) return 0;
  const today = new Date().toISOString().slice(0, 10);
  let streak = 0;
  let d = new Date(today);
  while (true) {
    const ds = d.toISOString().slice(0, 10);
    if (dates.has(ds)) { streak++; d.setDate(d.getDate() - 1); }
    else break;
  }
  return streak;
}

// ── Grammar Reference ─────────────────────────────────────────
function showGrammarRef() { showScreen('grammar'); }

// ── Daily Review ──────────────────────────────────────────────
function startDailyReview() {
  const vocab = loadVocab();
  // Pick words that have been seen but are not yet mastered
  const due = Object.entries(vocab)
    .filter(([, v]) => v.seen > 0 && vocabLevel(v) < 4)
    .sort((a, b) => {
      // Prioritise: low level first, then least recently seen
      const lvlDiff = vocabLevel(a[1]) - vocabLevel(b[1]);
      if (lvlDiff !== 0) return lvlDiff;
      return (a[1].lastSeen || '') < (b[1].lastSeen || '') ? -1 : 1;
    })
    .slice(0, 10)
    .map(([word]) => word);

  if (due.length < 2) {
    alert('Complete a few lessons first to unlock Daily Review!');
    return;
  }

  // Build simple MC exercises from due words
  const allWords = Object.keys(vocab);
  const exercises = due.slice(0, 8).map(word => {
    const distractors = shuffle(allWords.filter(w => w !== word)).slice(0, 3);
    return {
      type: 'multiple_choice',
      prompt: `Which is the Italian word shown below?\n"${word}"`,
      options: shuffle([word, ...distractors]),
      answer: word,
      hint: `You've seen this word ${vocab[word].seen} time${vocab[word].seen !== 1 ? 's' : ''}`
    };
  });

  currentTopic = 'daily_review';
  currentExercises = exercises;
  currentIndex = 0; xp = 0; correct = 0; answered = false; mistakes = [];
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

// ── Patch updateHomeProgress to include streak ────────────────
function updateHomeProgress() {
  const stats = loadStats();
  const vocab = loadVocab();
  const totalXP = stats.totalXP || 0;
  const wordsLearned = Object.values(vocab).filter(v => v.correct >= 1).length;
  const wordsMastered = Object.values(vocab).filter(v => vocabLevel(v) >= 4).length;
  const streak = calcStreak();

  if (totalXP > 0 || wordsLearned > 0) {
    const bar = document.getElementById('home-stats-bar');
    bar.style.display = 'flex';
    document.getElementById('home-xp').textContent = totalXP;
    document.getElementById('home-words').textContent = wordsLearned;
    document.getElementById('home-mastered').textContent = wordsMastered;
    const actions = document.getElementById('home-actions');
    if (actions) actions.style.display = 'flex';

    const chip = document.getElementById('streak-chip');
    if (chip) {
      if (streak >= 2) {
        chip.style.display = 'inline-flex';
        document.getElementById('home-streak').textContent = streak;
      } else {
        chip.style.display = 'none';
      }
    }
  }
  renderCourseMap();
  renderJourneyCard();
  renderAchievements();
}

// ── Skill-tree unlock logic ────────────────────────────────────
function isLessonUnlocked(unitIdx, lessonIdx, stats) {
  const lessonId = COURSE[unitIdx].lessons[lessonIdx].id;
  if (stats.lessons[lessonId]?.completions > 0) return true;
  if (unitIdx === 0 && lessonIdx === 0) return true;
  if (lessonIdx > 0) {
    const prevId = COURSE[unitIdx].lessons[lessonIdx - 1].id;
    return !!(stats.lessons[prevId]?.completions > 0);
  }
  if (lessonIdx === 0 && unitIdx > 0) {
    const prevUnit = COURSE[unitIdx - 1];
    const doneCount = prevUnit.lessons.filter(l => stats.lessons[l.id]?.completions > 0).length;
    return doneCount >= Math.ceil(prevUnit.lessons.length * 0.7);
  }
  return false;
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

    // Completed unit: compact dot row
    if (allDone) {
      const dots = lessons.map(() => `<span class="ucr-dot">✓</span>`).join('');
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
      const needed = prevUnit ? Math.ceil(prevUnit.lessons.length * 0.7) - prevDone : 0;
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
updateHomeProgress();
