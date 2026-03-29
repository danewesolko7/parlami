const ACHIEVEMENTS = [
  { id:'first_lesson',   emoji:'🌱', name:'First Steps',       desc:'Complete your first lesson' },
  { id:'perfect_score',  emoji:'⭐', name:'Perfectionist',     desc:'Get 100% on any lesson' },
  { id:'streak_3',       emoji:'🔥', name:'On Fire',           desc:'3-day study streak' },
  { id:'streak_7',       emoji:'🌟', name:'Devoted',           desc:'7-day study streak' },
  { id:'streak_14',      emoji:'🔥', name:'Fortnight Fighter',  desc:'14-day study streak' },
  { id:'streak_30',      emoji:'🏅', name:'Unstoppable',       desc:'30-day study streak' },
  { id:'streak_60',      emoji:'💪', name:'Iron Will',          desc:'60-day study streak' },
  { id:'streak_100',     emoji:'🦁', name:'Century Streak',     desc:'100-day study streak' },
  { id:'xp_100',         emoji:'💯', name:'Centurion',         desc:'Earn 100 XP' },
  { id:'xp_500',         emoji:'🏆', name:'High Roller',       desc:'Earn 500 XP' },
  { id:'xp_1000',        emoji:'💎', name:'XP Elite',          desc:'Earn 1,000 XP' },
  { id:'xp_2500',        emoji:'🔮', name:'XP Champion',        desc:'Earn 2,500 XP' },
  { id:'xp_5000',        emoji:'👑', name:'XP Legend',         desc:'Earn 5,000 XP' },
  { id:'xp_10000',       emoji:'🌌', name:'XP Immortal',        desc:'Earn 10,000 XP' },
  { id:'words_25',       emoji:'📚', name:'Word Collector',    desc:'Learn 25 Italian words' },
  { id:'words_50',       emoji:'📖', name:'Word Hoarder',      desc:'Learn 50 Italian words' },
  { id:'words_100',      emoji:'🗂️', name:'Vocabulary Builder', desc:'Learn 100 Italian words' },
  { id:'words_200',      emoji:'📕', name:'Lexicon Keeper',     desc:'Learn 200 Italian words' },
  { id:'words_500',      emoji:'🏛️', name:'Living Dictionary',  desc:'Learn 500 Italian words' },
  { id:'mastered_10',    emoji:'🧠', name:'Bilingual Brain',   desc:'Master 10 words' },
  { id:'mastered_50',    emoji:'🎖️', name:'Word Master',       desc:'Master 50 words' },
  { id:'lessons_5',      emoji:'🎯', name:'Getting Fluent',    desc:'Complete 5 lessons' },
  { id:'lessons_10',     emoji:'🎓', name:'Polyglot',          desc:'Complete 10 lessons' },
  { id:'lessons_25',     emoji:'🚀', name:'Dedicated Learner', desc:'Complete 25 lessons' },
  { id:'lessons_50',     emoji:'🌍', name:'World Citizen',     desc:'Complete 50 lessons' },
  { id:'lessons_100',    emoji:'🏆', name:'Century Scholar',    desc:'Complete 100 lessons' },
  { id:'cefr_a1',        emoji:'🟢', name:'A1 Graduate',       desc:'Complete all A1 lessons' },
  { id:'cefr_a2',        emoji:'🔵', name:'A2 Graduate',       desc:'Complete all A2 lessons' },
  { id:'cefr_b1',        emoji:'🟡', name:'B1 Graduate',       desc:'Complete all B1 lessons' },
  { id:'cefr_b2',        emoji:'🟠', name:'B2 Graduate',       desc:'Complete all B2 lessons' },
  { id:'cefr_c1',        emoji:'🔴', name:'C1 Graduate',       desc:'Complete all C1 lessons' },
  { id:'cefr_c2',        emoji:'🟣', name:'C2 Master',         desc:'Complete all C2 lessons — Mastery!' },
];

// M12 — CEFR level thresholds (mirrors JM_LEVELS in home.js)
const CEFR_NEEDS = { a1: 4, a2: 6, b1: 6, b2: 8, c1: 8, c2: null };

function getEarnedBadgeIds(stats, vocab, streak) {
  const lessonsDone = Object.values(stats.lessons || {}).filter(l => l.completions > 0).length;
  const wordsLearned = Object.values(vocab).filter(w => w.correct >= 1).length;
  const wordsMastered = Object.values(vocab).filter(w => vocabLevel(w) === 'strong').length;
  const totalXP = stats.totalXP || 0;

  // Count completed lessons per CEFR tier
  const cefrDone = { a1:0, a2:0, b1:0, b2:0, c1:0, c2:0 };
  if (typeof LESSON_DIFF !== 'undefined') {
    Object.entries(stats.lessons || {}).forEach(([id, s]) => {
      const tier = LESSON_DIFF[id];
      if (s.completions > 0 && tier && cefrDone[tier] !== undefined) cefrDone[tier]++;
    });
  }

  return ACHIEVEMENTS.filter(a => {
    switch (a.id) {
      case 'first_lesson':   return lessonsDone >= 1;
      case 'perfect_score':  return Object.values(stats.lessons || {}).some(l => l.bestAccuracy === 100);
      case 'streak_3':       return streak >= 3;
      case 'streak_7':       return streak >= 7;
      case 'streak_14':      return streak >= 14;
      case 'streak_30':      return streak >= 30;
      case 'streak_60':      return streak >= 60;
      case 'streak_100':     return streak >= 100;
      case 'xp_100':         return totalXP >= 100;
      case 'xp_500':         return totalXP >= 500;
      case 'xp_1000':        return totalXP >= 1000;
      case 'xp_2500':        return totalXP >= 2500;
      case 'xp_5000':        return totalXP >= 5000;
      case 'xp_10000':       return totalXP >= 10000;
      case 'words_25':       return wordsLearned >= 25;
      case 'words_50':       return wordsLearned >= 50;
      case 'words_100':      return wordsLearned >= 100;
      case 'words_200':      return wordsLearned >= 200;
      case 'words_500':      return wordsLearned >= 500;
      case 'mastered_10':    return wordsMastered >= 10;
      case 'mastered_50':    return wordsMastered >= 50;
      case 'lessons_5':      return lessonsDone >= 5;
      case 'lessons_10':     return lessonsDone >= 10;
      case 'lessons_25':     return lessonsDone >= 25;
      case 'lessons_50':     return lessonsDone >= 50;
      case 'lessons_100':    return lessonsDone >= 100;
      case 'cefr_a1':        return cefrDone.a1 >= CEFR_NEEDS.a1;
      case 'cefr_a2':        return cefrDone.a2 >= CEFR_NEEDS.a2;
      case 'cefr_b1':        return cefrDone.b1 >= CEFR_NEEDS.b1;
      case 'cefr_b2':        return cefrDone.b2 >= CEFR_NEEDS.b2;
      case 'cefr_c1':        return cefrDone.c1 >= CEFR_NEEDS.c1;
      case 'cefr_c2':        return cefrDone.c2 >= 1;
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
