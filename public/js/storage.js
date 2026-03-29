const VOCAB_KEY = 'parlami_vocab';
const STATS_KEY = 'parlami_stats';

function loadVocab() {
  try { return JSON.parse(localStorage.getItem(VOCAB_KEY)) || {}; } catch { return {}; }
}
function loadStats() {
  try { return JSON.parse(localStorage.getItem(STATS_KEY)) || { totalXP: 0, lessons: {} }; } catch { return { totalXP: 0, lessons: {} }; }
}

// H12 — require minimum seen counts so two lucky answers don't over-promote a word
function vocabLevel(entry) {
  if (!entry || !entry.seen) return 'new';
  const acc = entry.correct / entry.seen;
  if (entry.correct >= 5 && entry.seen >= 7 && acc >= 0.75) return 'strong';
  if (entry.correct >= 3 && entry.seen >= 5 && acc >= 0.6)  return 'good';
  if (entry.seen >= 2)                                       return 'learning';
  return 'new';
}

// M1 — helper: add N days to a local-date string (YYYY-MM-DD)
function addDays(dateStr, days) {
  const d = new Date(dateStr + 'T00:00:00');
  d.setDate(d.getDate() + days);
  return d.toLocaleDateString('en-CA');
}

// H3 — optional `english` gloss persisted per word
// M1 — SRS fields (interval, easeFactor, nextReview) maintained per word
function trackWord(word, isCorrect, english) {
  if (!word) return;
  word = word.toLowerCase().replace(/[^a-zàèéìòùü']/g, '');
  if (word.length < 2) return;
  const vocab = loadVocab();
  const today = new Date().toLocaleDateString('en-CA');

  if (!vocab[word]) {
    vocab[word] = {
      seen: 0, correct: 0, lastSeen: null,
      interval: 1, easeFactor: 2.5, nextReview: today
    };
  }

  if (english) vocab[word].english = english;

  vocab[word].seen++;
  if (isCorrect) {
    vocab[word].correct++;
    const ef = vocab[word].easeFactor;
    vocab[word].interval   = Math.round((vocab[word].interval || 1) * ef);
    vocab[word].nextReview = addDays(today, vocab[word].interval);
    vocab[word].easeFactor = Math.min(2.5, ef + 0.1);
  } else {
    vocab[word].interval   = 1;
    vocab[word].easeFactor = Math.max(1.3, (vocab[word].easeFactor || 2.5) - 0.2);
    vocab[word].nextReview = addDays(today, 1);
  }

  vocab[word].lastSeen = today;
  localStorage.setItem(VOCAB_KEY, JSON.stringify(vocab));
}
function trackWords(words, isCorrect, english) { words.forEach(w => trackWord(w, isCorrect, english)); }

// M1 — words whose nextReview is today or overdue
function getDueWords() {
  const today = new Date().toLocaleDateString('en-CA');
  const vocab = loadVocab();
  return Object.entries(vocab)
    .filter(([, v]) => !v.nextReview || v.nextReview <= today)
    .map(([word, v]) => ({ word, ...v }));
}

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

  const done = { a1:0, a2:0, b1:0, b2:0, c1:0, c2:0 };
  Object.entries(stats.lessons || {}).forEach(([id, s]) => {
    const diff = (typeof LESSON_DIFF !== 'undefined') ? LESSON_DIFF[id] : null;
    if (s.completions > 0 && diff && done[diff] !== undefined) done[diff]++;
  });

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
    if (lv === 'strong' || lv === 'good') knownWords.push(w);
    else if (lv === 'learning')           strugglingWords.push(w);
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

// H14 — local date (not UTC) for lastPlayed
function saveCompletion(topic, earnedXP, accuracy) {
  const stats = loadStats();
  stats.totalXP = (stats.totalXP || 0) + earnedXP;
  if (!stats.lessons[topic]) stats.lessons[topic] = { completions: 0, bestAccuracy: 0 };
  stats.lessons[topic].completions++;
  stats.lessons[topic].bestAccuracy = Math.max(stats.lessons[topic].bestAccuracy, accuracy);
  stats.lessons[topic].lastPlayed = new Date().toLocaleDateString('en-CA');
  localStorage.setItem(STATS_KEY, JSON.stringify(stats));
}
