// ── Vocabulary Library ────────────────────────────────────────
let currentVocabFilter = 'all';

const LEVEL_META = [
  null,
  { label:'Struggling', color:'var(--red)',    bg:'var(--red-light)',    bar:'var(--red)'    },
  { label:'Learning',   color:'var(--amber)',  bg:'var(--amber-light)',  bar:'var(--amber)'  },
  { label:'Familiar',   color:'var(--blue)',   bg:'var(--blue-light)',   bar:'var(--blue)'   },
  { label:'Strong',     color:'var(--green)',  bg:'var(--green-light)',  bar:'var(--green)'  },
  { label:'Mastered',   color:'var(--purple)', bg:'var(--purple-light)', bar:'var(--purple)' },
];

function showVocabLibrary() {
  showScreen('vocab');
  filterVocab('all', document.querySelector('.filter-tab'));
}

function filterVocab(filter, tabEl) {
  currentVocabFilter = filter;
  document.querySelectorAll('.filter-tab').forEach(t => t.classList.remove('active'));
  if (tabEl) tabEl.classList.add('active');

  const vocab = loadVocab();
  let entries = Object.entries(vocab).map(([word, data]) => ({
    word, ...data, level: vocabLevel(data)
  }));

  if (filter === 'struggling') entries = entries.filter(e => e.level === 1);
  else if (filter === 'learning') entries = entries.filter(e => e.level === 2 || e.level === 3);
  else if (filter === 'strong')   entries = entries.filter(e => e.level === 4);
  else if (filter === 'mastered') entries = entries.filter(e => e.level === 5);

  // Sort: struggling first, then alphabetical
  entries.sort((a, b) => a.level !== b.level ? a.level - b.level : a.word.localeCompare(b.word));

  document.getElementById('vocab-count').textContent = entries.length + ' words';

  const practiceBtn = document.getElementById('vocab-practice-btn');
  if (practiceBtn) practiceBtn.style.display = entries.length >= 2 ? 'block' : 'none';

  if (entries.length === 0) {
    document.getElementById('vocab-grid').innerHTML =
      `<div style="grid-column:1/-1;text-align:center;color:var(--text-muted);padding:48px 0;font-size:14px;">No words in this category yet.</div>`;
    return;
  }

  document.getElementById('vocab-grid').innerHTML = entries.map(e => {
    const meta = LEVEL_META[e.level] || LEVEL_META[1];
    const acc = e.seen > 0 ? Math.round((e.correct / e.seen) * 100) : 0;
    return `<div class="word-card">
      <div class="wc-word">${e.word}</div>
      <span class="wc-level" style="background:${meta.bg};color:${meta.color};">${meta.label}</span>
      <div class="wc-bar-track"><div class="wc-bar-fill" style="width:${acc}%;background:${meta.bar};"></div></div>
      <div class="wc-stats">${acc}% · ${e.seen} seen</div>
    </div>`;
  }).join('');
}

// ── Vocab Practice ─────────────────────────────────────────────
function startVocabPractice() {
  const vocab = loadVocab();
  let entries = Object.entries(vocab).map(([word, data]) => ({
    word, ...data, level: vocabLevel(data)
  }));

  const filter = currentVocabFilter;
  if (filter === 'struggling') entries = entries.filter(e => e.level === 1);
  else if (filter === 'learning') entries = entries.filter(e => e.level === 2 || e.level === 3);
  else if (filter === 'strong')   entries = entries.filter(e => e.level === 4);
  else if (filter === 'mastered') entries = entries.filter(e => e.level === 5);

  if (entries.length < 2) { alert('Complete a few lessons first to build your vocabulary!'); return; }

  // Prioritise lowest level, then least recently seen
  entries.sort((a, b) => {
    const lvlDiff = a.level - b.level;
    if (lvlDiff !== 0) return lvlDiff;
    return (a.lastSeen || '') < (b.lastSeen || '') ? -1 : 1;
  });
  const words = entries.slice(0, 10).map(e => e.word);
  const allWords = Object.keys(vocab);

  const exercises = words.map(word => {
    // Alternate between listening and multiple-choice exercises
    const distractors = shuffle(allWords.filter(w => w !== word)).slice(0, 3);
    if (distractors.length < 3) {
      return { type: 'listening', prompt: 'Listen and type the word:', audio: word, answer: word };
    }
    return Math.random() < 0.5
      ? { type: 'listening', prompt: 'Listen and type the word:', audio: word, answer: word }
      : { type: 'multiple_choice', prompt: 'Which word do you hear?\n(Tap ▶ to listen)', options: shuffle([word, ...distractors]), answer: word, audio: word };
  });

  currentTopic = 'vocab_practice';
  currentExercises = shuffle(exercises);
  currentIndex = 0; xp = 0; correct = 0; answered = false;
  showScreen('lesson');
  document.getElementById('progress-fill').style.width = '0%';
  document.getElementById('xp-counter').textContent = '0 XP';
  renderExercise();
}
