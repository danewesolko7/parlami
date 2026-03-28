const VOCAB_KEY = 'parlami_vocab';
const STATS_KEY = 'parlami_stats';

function loadVocab() {
  try { return JSON.parse(localStorage.getItem(VOCAB_KEY)) || {}; } catch { return {}; }
}
function loadStats() {
  try { return JSON.parse(localStorage.getItem(STATS_KEY)) || { totalXP: 0, lessons: {} }; } catch { return { totalXP: 0, lessons: {} }; }
}
function vocabLevel(entry) {
  if (!entry || !entry.seen) return 0;
  const acc = entry.correct / entry.seen;
  if (entry.correct >= 5 && acc >= 0.9) return 5;  // mastered
  if (entry.correct >= 3 && acc >= 0.75) return 4;  // strong
  if (entry.correct >= 2) return 3;                 // good
  if (entry.correct >= 1) return 2;                 // learning
  return 1;                                         // seen, not yet correct
}
function trackWord(word, isCorrect) {
  if (!word) return;
  word = word.toLowerCase().replace(/[^a-zàèéìòùü']/g, '');
  if (word.length < 2) return;
  const vocab = loadVocab();
  if (!vocab[word]) vocab[word] = { seen: 0, correct: 0, lastSeen: null };
  vocab[word].seen++;
  if (isCorrect) vocab[word].correct++;
  vocab[word].lastSeen = new Date().toISOString().slice(0, 10);
  localStorage.setItem(VOCAB_KEY, JSON.stringify(vocab));
}
function trackWords(words, isCorrect) { words.forEach(w => trackWord(w, isCorrect)); }

function getExerciseWords(ex) {
  if (!ex) return [];
  switch (ex.type) {
    case 'multiple_choice': {
      const m = ex.prompt.match(/"([^"]+)"/);
      if (m) return ex.prompt.includes('in Italian') ? [ex.answer] : [m[1]];
      return [];
    }
    case 'fill_blank': return [ex.answer];
    case 'listening': return (ex.answer || '').split(/\s+/).filter(w => w.length > 2);
    case 'translate': return (ex.answer || '').split(/\s+/).filter(w => w.length > 2);
    default: return [];
  }
}
// Returns a snapshot of the user's learning state to send with lesson requests
function getUserContext() {
  const stats = loadStats();
  const vocab = loadVocab();

  // Count unique lessons completed per CEFR tier
  const done = { a1:0, a2:0, b1:0, b2:0, c1:0, c2:0 };
  Object.entries(stats.lessons || {}).forEach(([id, s]) => {
    const diff = (typeof LESSON_DIFF !== 'undefined') ? LESSON_DIFF[id] : null;
    if (s.completions > 0 && diff && done[diff] !== undefined) done[diff]++;
  });

  // Walk tiers to determine current CEFR level (mirrors JM_LEVELS in home.js)
  const tiers = [
    { id:'a1', need:4 }, { id:'a2', need:6 }, { id:'b1', need:6 },
    { id:'b2', need:8 }, { id:'c1', need:8 }, { id:'c2', need:null }
  ];
  let cefrLevel = 'a1';
  for (const tier of tiers) {
    const tierDone = done[tier.id] || 0;
    cefrLevel = tier.id;
    if (!tier.need || tierDone < tier.need) break;
  }

  const knownWords = [];
  const strugglingWords = [];
  Object.entries(vocab).forEach(([w, v]) => {
    const lv = vocabLevel(v);
    if (lv >= 3) knownWords.push(w);
    else if (lv > 0) strugglingWords.push(w);
  });

  const totalLessons = Object.values(stats.lessons || {})
    .reduce((sum, l) => sum + (l.completions || 0), 0);

  return {
    cefrLevel,
    totalLessons,
    totalXP: stats.totalXP || 0,
    knownWords: knownWords.slice(0, 50),
    strugglingWords: strugglingWords.slice(0, 30)
  };
}

function saveCompletion(topic, earnedXP, accuracy) {
  const stats = loadStats();
  stats.totalXP = (stats.totalXP || 0) + earnedXP;
  if (!stats.lessons[topic]) stats.lessons[topic] = { completions: 0, bestAccuracy: 0 };
  stats.lessons[topic].completions++;
  stats.lessons[topic].bestAccuracy = Math.max(stats.lessons[topic].bestAccuracy, accuracy);
  stats.lessons[topic].lastPlayed = new Date().toISOString().slice(0, 10);
  localStorage.setItem(STATS_KEY, JSON.stringify(stats));
}
