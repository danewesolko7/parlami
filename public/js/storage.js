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
function saveCompletion(topic, earnedXP, accuracy) {
  const stats = loadStats();
  stats.totalXP = (stats.totalXP || 0) + earnedXP;
  if (!stats.lessons[topic]) stats.lessons[topic] = { completions: 0, bestAccuracy: 0 };
  stats.lessons[topic].completions++;
  stats.lessons[topic].bestAccuracy = Math.max(stats.lessons[topic].bestAccuracy, accuracy);
  stats.lessons[topic].lastPlayed = new Date().toISOString().slice(0, 10);
  localStorage.setItem(STATS_KEY, JSON.stringify(stats));
}
