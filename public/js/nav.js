// ── nav.js — Bottom navigation + tab management ───────────────

const TAB_SCREENS = ['home', 'lessons', 'vocab', 'achievements', 'profile'];

window.showScreen = function(name) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  const el = document.getElementById('screen-' + name);
  if (el) el.classList.add('active');
  window.scrollTo(0, 0);
  const nav = document.getElementById('bottom-nav');
  if (nav) nav.style.display = TAB_SCREENS.includes(name) ? 'flex' : 'none';
  document.querySelectorAll('#bottom-nav .nav-tab').forEach(t => {
    t.classList.toggle('active', t.dataset.tab === name);
  });
};

function showTab(tab) {
  showScreen(tab);
  if (tab === 'home') updateHomeProgress();
  if (tab === 'lessons') { renderCourseMap(); renderJourneyCard(); }
  if (tab === 'vocab') showVocabLibrary();
  if (tab === 'achievements') renderAchievementsTab();
  if (tab === 'profile') renderProfile();
}

window.goHome = function() {
  if (typeof currentIndex !== 'undefined' && typeof currentExercises !== 'undefined' &&
      currentIndex > 0 && currentIndex < currentExercises.length && !answered) {
    const existing = document.getElementById('exit-confirm-bar');
    if (existing) return;
    const bar = document.createElement('div');
    bar.id = 'exit-confirm-bar';
    bar.className = 'exit-confirm-bar';
    bar.innerHTML = '<span class="exit-confirm-msg">Leave lesson? Progress will be lost.</span>' +
      '<button class="exit-stay-btn" onclick="document.getElementById(\'exit-confirm-bar\').remove()">Keep going</button>' +
      '<button class="exit-leave-btn" onclick="speechSynthesis.cancel();showTab(\'home\')">Leave</button>';
    document.getElementById('exercise-container').prepend(bar);
    return;
  }
  speechSynthesis.cancel();
  if (typeof removeMCKeyHandler === 'function') removeMCKeyHandler();
  showTab('home');
};

function toggleLookup() {
  const panel = document.getElementById('lookup-panel');
  const sentPanel = document.getElementById('sentences-panel');
  if (panel) {
    const isOpen = panel.style.display !== 'none';
    panel.style.display = isOpen ? 'none' : 'block';
    if (!isOpen && sentPanel) sentPanel.style.display = 'none';
  }
}

function toggleSentences() {
  const panel = document.getElementById('sentences-panel');
  const lookupPanel = document.getElementById('lookup-panel');
  if (panel) {
    const isOpen = panel.style.display !== 'none';
    panel.style.display = isOpen ? 'none' : 'block';
    if (!isOpen && lookupPanel) lookupPanel.style.display = 'none';
  }
}

function renderAchievementsTab() {
  const el = document.getElementById('achievements-section');
  if (!el) return;
  const stats = loadStats();
  const vocab = loadVocab();
  const streak = calcStreak();
  const earned = new Set(getEarnedBadgeIds(stats, vocab, streak));

  const countEl = document.getElementById('ach-count-label');
  if (countEl) countEl.textContent = earned.size + ' / ' + ACHIEVEMENTS.length;

  const achMap = {};
  ACHIEVEMENTS.forEach(function(a) { achMap[a.id] = a; });

  const categories = [
    { label: '🔥 Streaks', ids: ['streak_3','streak_7','streak_14','streak_30','streak_60','streak_100'] },
    { label: '⭐ XP Milestones', ids: ['xp_100','xp_500','xp_1000','xp_2500','xp_5000','xp_10000'] },
    { label: '📚 Vocabulary', ids: ['words_25','words_50','words_100','words_200','words_500','mastered_10','mastered_50'] },
    { label: '🎓 Lessons', ids: ['first_lesson','perfect_score','lessons_5','lessons_10','lessons_25','lessons_50','lessons_100'] },
    { label: '🌍 CEFR Levels', ids: ['cefr_a1','cefr_a2','cefr_b1','cefr_b2','cefr_c1','cefr_c2'] },
  ];

  const html = categories.map(function(cat) {
    const items = cat.ids.map(function(id) {
      const a = achMap[id];
      if (!a) return '';
      const done = earned.has(a.id);
      return '<div class="badge-item ' + (done ? 'badge-earned' : 'badge-locked') + '" title="' + escHtml(a.desc) + '">' +
        '<div class="badge-emoji">' + (done ? a.emoji : '🔒') + '</div>' +
        '<div class="badge-name">' + escHtml(a.name) + '</div>' +
        '</div>';
    }).join('');
    return '<div class="ach-category">' +
      '<div class="ach-category-label">' + cat.label + '</div>' +
      '<div class="badge-grid">' + items + '</div>' +
      '</div>';
  }).join('');

  el.innerHTML = html;
}

function renderProfile() {
  const el = document.getElementById('profile-content');
  if (!el) return;
  const stats = loadStats();
  const vocab = loadVocab();
  const streak = calcStreak();
  const totalXP = stats.totalXP || 0;
  const wordsLearned = Object.values(vocab).filter(function(v) { return v.correct >= 1; }).length;
  const lessonsDone = Object.values(stats.lessons || {}).filter(function(l) { return l.completions > 0; }).length;
  const earned = getEarnedBadgeIds(stats, vocab, streak).length;

  // Determine current CEFR level from JM_LEVELS
  let cefrLabel = 'A1', cefrName = 'Beginner';
  if (typeof JM_LEVELS !== 'undefined') {
    const done = { a1:0, a2:0, b1:0, b2:0, c1:0, c2:0 };
    Object.entries(stats.lessons || {}).forEach(function(entry) {
      const id = entry[0], s = entry[1];
      if (s.completions > 0 && typeof LESSON_DIFF !== 'undefined' && LESSON_DIFF[id]) {
        done[LESSON_DIFF[id]]++;
      }
    });
    let idx = 0;
    if (done.a1 >= 4) idx = 1;
    if (done.a2 >= 6) idx = 2;
    if (done.b1 >= 6) idx = 3;
    if (done.b2 >= 8) idx = 4;
    if (done.c1 >= 8) idx = 5;
    cefrLabel = JM_LEVELS[idx].label;
    cefrName = JM_LEVELS[idx].name;
  }

  el.innerHTML =
    '<div class="profile-hero">' +
      '<div class="profile-avatar">🇮🇹</div>' +
      '<div class="profile-name">Italian Learner</div>' +
      '<div class="profile-tagline">Learning with Parlami</div>' +
    '</div>' +
    '<div class="profile-stats-card">' +
      '<div class="profile-stat"><div class="profile-stat-value">' + totalXP.toLocaleString() + '</div><div class="profile-stat-label">⭐ XP</div></div>' +
      '<div class="profile-stat-div"></div>' +
      '<div class="profile-stat"><div class="profile-stat-value">' + streak + '</div><div class="profile-stat-label">🔥 Streak</div></div>' +
      '<div class="profile-stat-div"></div>' +
      '<div class="profile-stat"><div class="profile-stat-value">' + wordsLearned + '</div><div class="profile-stat-label">📚 Words</div></div>' +
      '<div class="profile-stat-div"></div>' +
      '<div class="profile-stat"><div class="profile-stat-value">' + lessonsDone + '</div><div class="profile-stat-label">🎓 Lessons</div></div>' +
    '</div>' +
    '<div class="section-header">CEFR Level</div>' +
    '<div class="settings-card" style="margin-bottom:24px;">' +
      '<div class="settings-row"><span class="settings-label">Current level</span><span class="settings-value" style="font-weight:700;color:var(--green);">' + cefrLabel + ' — ' + cefrName + '</span></div>' +
      '<div class="settings-row settings-row-border"><span class="settings-label">See full CEFR path</span>' +
        '<button style="padding:5px 12px;border:1.5px solid var(--green);border-radius:99px;background:none;color:var(--green);font-size:12px;font-weight:600;cursor:pointer;font-family:\'DM Sans\',sans-serif;" onclick="showTab(\'lessons\')">Lessons →</button>' +
      '</div>' +
    '</div>' +
    '<div class="section-header">Achievements</div>' +
    '<div class="profile-ach-row" onclick="showTab(\'achievements\')">' +
      '<div class="profile-ach-left">' +
        '<span class="profile-ach-icon">🏅</span>' +
        '<span class="profile-ach-text">' + earned + ' of ' + (typeof ACHIEVEMENTS !== 'undefined' ? ACHIEVEMENTS.length : '?') + ' badges earned</span>' +
      '</div>' +
      '<span class="profile-ach-arrow">→</span>' +
    '</div>' +
    '<div class="section-header">About</div>' +
    '<div class="settings-card">' +
      '<div class="settings-row"><span class="settings-label">Version</span><span class="settings-value">1.0</span></div>' +
      '<div class="settings-row settings-row-border"><span class="settings-label">Data storage</span><span class="settings-value">Local only</span></div>' +
      '<div class="settings-row settings-row-border">' +
        '<span class="settings-label">Vocabulary</span><span class="settings-value">' + wordsLearned + ' words</span>' +
      '</div>' +
    '</div>' +
    '<button class="danger-btn" onclick="if(confirm(\'Clear all data? This cannot be undone.\')){localStorage.clear();location.reload();}">Clear all data</button>';
}
