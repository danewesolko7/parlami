const ACHIEVEMENTS = [
  { id:'first_lesson',  emoji:'🌱', name:'First Steps',     desc:'Complete your first lesson' },
  { id:'perfect_score', emoji:'⭐', name:'Perfectionist',   desc:'Get 100% on any lesson' },
  { id:'streak_3',      emoji:'🔥', name:'On Fire',         desc:'3-day study streak' },
  { id:'streak_7',      emoji:'🌟', name:'Devoted',         desc:'7-day study streak' },
  { id:'xp_100',        emoji:'💯', name:'Centurion',       desc:'Earn 100 XP' },
  { id:'xp_500',        emoji:'🏆', name:'High Roller',     desc:'Earn 500 XP' },
  { id:'words_25',      emoji:'📚', name:'Word Collector',  desc:'Learn 25 Italian words' },
  { id:'mastered_10',   emoji:'🧠', name:'Bilingual Brain', desc:'Master 10 words' },
  { id:'lessons_5',     emoji:'🎯', name:'Getting Fluent',  desc:'Complete 5 lessons' },
  { id:'lessons_10',    emoji:'🎓', name:'Polyglot',        desc:'Complete 10 lessons' },
];

function getEarnedBadgeIds(stats, vocab, streak) {
  const lessonsDone = Object.values(stats.lessons || {}).filter(l => l.completions > 0).length;
  const wordsLearned = Object.values(vocab).filter(w => w.correct >= 1).length;
  const wordsMastered = Object.values(vocab).filter(w => vocabLevel(w) >= 4).length;
  return ACHIEVEMENTS.filter(a => {
    switch (a.id) {
      case 'first_lesson':  return lessonsDone >= 1;
      case 'perfect_score': return Object.values(stats.lessons || {}).some(l => l.bestAccuracy === 100);
      case 'streak_3':      return streak >= 3;
      case 'streak_7':      return streak >= 7;
      case 'xp_100':        return (stats.totalXP || 0) >= 100;
      case 'xp_500':        return (stats.totalXP || 0) >= 500;
      case 'words_25':      return wordsLearned >= 25;
      case 'mastered_10':   return wordsMastered >= 10;
      case 'lessons_5':     return lessonsDone >= 5;
      case 'lessons_10':    return lessonsDone >= 10;
      default: return false;
    }
  }).map(a => a.id);
}

// Returns newly unlocked achievement objects, persists to stats.badges
function checkNewAchievements() {
  const stats = loadStats();
  const vocab = loadVocab();
  const streak = calcStreak();
  const earned = getEarnedBadgeIds(stats, vocab, streak);
  const prev = stats.badges || [];
  const newIds = earned.filter(id => !prev.includes(id));
  if (newIds.length) {
    stats.badges = earned;
    localStorage.setItem(STATS_KEY, JSON.stringify(stats));
  }
  return newIds.map(id => ACHIEVEMENTS.find(a => a.id === id)).filter(Boolean);
}

function renderAchievements() {
  const el = document.getElementById('achievements-section');
  if (!el) return;
  const stats = loadStats();
  const vocab = loadVocab();
  const streak = calcStreak();
  const earned = new Set(getEarnedBadgeIds(stats, vocab, streak));
  const earnedCount = earned.size;

  const html = ACHIEVEMENTS.map(a => {
    const done = earned.has(a.id);
    return `<div class="badge-item ${done ? 'badge-earned' : 'badge-locked'}" title="${escHtml(a.desc)}">
      <div class="badge-emoji">${done ? a.emoji : '🔒'}</div>
      <div class="badge-name">${escHtml(a.name)}</div>
    </div>`;
  }).join('');

  el.innerHTML = `<div class="badge-shelf-head">
    <span class="badge-shelf-label">Achievements</span>
    <span class="badge-shelf-count">${earnedCount} / ${ACHIEVEMENTS.length}</span>
  </div><div class="badge-grid">${html}</div>`;
}

function showAchievementToast(badges) {
  if (!badges.length) return;
  const container = document.getElementById('screen-complete');
  if (!container) return;
  const old = document.getElementById('achievement-toast');
  if (old) old.remove();
  const div = document.createElement('div');
  div.id = 'achievement-toast';
  div.className = 'achievement-toast';
  div.innerHTML = `<div class="ach-toast-title">🏅 Achievement${badges.length > 1 ? 's' : ''} Unlocked!</div>` +
    badges.map(b =>
      `<div class="ach-toast-badge">
        <span class="ach-emoji">${b.emoji}</span>
        <div><div class="ach-name">${escHtml(b.name)}</div><div class="ach-desc">${escHtml(b.desc)}</div></div>
      </div>`
    ).join('');
  const homeBtn = container.querySelector('.home-btn');
  if (homeBtn) container.insertBefore(div, homeBtn);
  else container.appendChild(div);
}
