// ── Vocabulary Library ────────────────────────────────────────
let currentVocabFilter = 'all';
let currentVocabSearch = '';

// vocabLevel() now returns strings: 'new' | 'learning' | 'good' | 'strong'
// Map each string level to a numeric order for sorting (lower = needs more work)
const LEVEL_ORDER = { new: 0, learning: 1, good: 2, strong: 3 };

const LEVEL_META = {
  new:      { label: 'New',      color: 'var(--text-muted)', bg: 'var(--border)',      bar: 'var(--text-hint)'  },
  learning: { label: 'Learning', color: 'var(--amber)',      bg: 'var(--amber-light)', bar: 'var(--amber)'      },
  good:     { label: 'Familiar', color: 'var(--blue)',       bg: 'var(--blue-light)',  bar: 'var(--blue)'       },
  strong:   { label: 'Strong',   color: 'var(--green)',      bg: 'var(--green-light)', bar: 'var(--green)'      },
};

function showVocabLibrary() {
  showScreen('vocab');
  _ensureVocabSearch();
  filterVocab('all', document.querySelector('.filter-tab'));
}

// ── L10: inject search bar above filter tabs (once) ──────────
function _ensureVocabSearch() {
  if (document.getElementById('vocab-search-row')) return;
  const filterTabs = document.querySelector('.filter-tabs');
  if (!filterTabs) return;

  const row = document.createElement('div');
  row.id = 'vocab-search-row';
  row.className = 'vocab-search-row';
  row.innerHTML =
    `<input id="vocab-search-input" class="custom-input vocab-search-input"
       placeholder="Search words or translations..." autocomplete="off" />
     <button id="vocab-search-clear" class="vocab-search-clear" aria-label="Clear search" style="display:none;">&#x2715;</button>`;
  filterTabs.parentNode.insertBefore(row, filterTabs);

  const input = document.getElementById('vocab-search-input');
  const clearBtn = document.getElementById('vocab-search-clear');

  input.addEventListener('input', () => {
    currentVocabSearch = input.value.trim().toLowerCase();
    clearBtn.style.display = currentVocabSearch ? 'flex' : 'none';
    _renderVocabGrid();
  });

  input.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') _clearVocabSearch();
  });

  clearBtn.addEventListener('click', _clearVocabSearch);
}

function _clearVocabSearch() {
  currentVocabSearch = '';
  const input = document.getElementById('vocab-search-input');
  const clearBtn = document.getElementById('vocab-search-clear');
  if (input) input.value = '';
  if (clearBtn) clearBtn.style.display = 'none';
  _renderVocabGrid();
}

function filterVocab(filter, tabEl) {
  currentVocabFilter = filter;
  document.querySelectorAll('.filter-tab').forEach(t => t.classList.remove('active'));
  if (tabEl) tabEl.classList.add('active');
  _renderVocabGrid();
}

// ── Shared grid render (applies both filter + search) ────────
function _renderVocabGrid() {
  const vocab = loadVocab();
  let entries = Object.entries(vocab).map(([word, data]) => ({
    word, ...data, level: vocabLevel(data)
  }));

  // Filter by tab — levels are now strings
  const filter = currentVocabFilter;
  if (filter === 'struggling') entries = entries.filter(e => e.level === 'new');
  else if (filter === 'learning') entries = entries.filter(e => e.level === 'learning');
  else if (filter === 'strong')   entries = entries.filter(e => e.level === 'good' || e.level === 'strong');
  else if (filter === 'mastered') entries = entries.filter(e => e.level === 'strong');

  // L10: apply search on top of active filter
  if (currentVocabSearch) {
    const q = currentVocabSearch;
    entries = entries.filter(e =>
      e.word.toLowerCase().includes(q) ||
      (e.english && e.english.toLowerCase().includes(q))
    );
  }

  // Sort: lowest level first (needs most work), then alphabetical
  entries.sort((a, b) => {
    const orderDiff = (LEVEL_ORDER[a.level] || 0) - (LEVEL_ORDER[b.level] || 0);
    if (orderDiff !== 0) return orderDiff;
    return a.word.localeCompare(b.word);
  });

  document.getElementById('vocab-count').textContent = entries.length + ' words';

  const practiceBtn = document.getElementById('vocab-practice-btn');
  if (practiceBtn) practiceBtn.style.display = entries.length >= 2 ? 'block' : 'none';

  if (entries.length === 0) {
    const msg = currentVocabSearch
      ? `No words match &ldquo;${escHtml(currentVocabSearch)}&rdquo; in this category.`
      : 'No words in this category yet.';
    document.getElementById('vocab-grid').innerHTML =
      `<div style="grid-column:1/-1;text-align:center;color:var(--text-muted);padding:48px 0;font-size:14px;">${msg}</div>`;
    return;
  }

  document.getElementById('vocab-grid').innerHTML = entries.map(e => {
    const meta = LEVEL_META[e.level] || LEVEL_META['new'];
    const acc = e.seen > 0 ? Math.round((e.correct / e.seen) * 100) : 0;
    return `<div class="word-card">
      <div class="wc-word">${escHtml(e.word)}</div>
      ${e.english ? `<div class="wc-english">${escHtml(e.english)}</div>` : ''}
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

  // Filter by tab — levels are now strings
  const filter = currentVocabFilter;
  if (filter === 'struggling') entries = entries.filter(e => e.level === 'new');
  else if (filter === 'learning') entries = entries.filter(e => e.level === 'learning');
  else if (filter === 'strong')   entries = entries.filter(e => e.level === 'good' || e.level === 'strong');
  else if (filter === 'mastered') entries = entries.filter(e => e.level === 'strong');

  // H11: replace alert() with inline error in the vocab screen
  if (entries.length < 2) {
    _showVocabInlineError('Complete a few lessons first to build your vocabulary!');
    return;
  }

  // Prioritise lowest level, then least recently seen
  entries.sort((a, b) => {
    const orderDiff = (LEVEL_ORDER[a.level] || 0) - (LEVEL_ORDER[b.level] || 0);
    if (orderDiff !== 0) return orderDiff;
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
      : { type: 'multiple_choice', prompt: 'Which word do you hear?\n(Tap \u25B6 to listen)', options: shuffle([word, ...distractors]), answer: word, audio: word };
  });

  currentTopic = 'vocab_practice';
  currentExercises = shuffle(exercises);
  currentIndex = 0; xp = 0; correct = 0; answered = false; mistakes = [];
  showScreen('lesson');
  document.getElementById('progress-fill').style.width = '0%';
  document.getElementById('xp-counter').textContent = '0 XP';
  renderExercise();

  // H13: auto-play audio for the first exercise if it's a multiple_choice with audio
  const firstEx = currentExercises[0];
  if (firstEx && firstEx.type === 'multiple_choice' && firstEx.audio) {
    setTimeout(() => speakText(firstEx.audio), 350);
  }
}

// H11: show an inline error message on the vocab screen
function _showVocabInlineError(message) {
  // Remove any existing inline error
  const existing = document.getElementById('vocab-inline-error');
  if (existing) existing.remove();

  const err = document.createElement('div');
  err.id = 'vocab-inline-error';
  err.className = 'inline-error';
  err.innerHTML = `<span class="inline-error-icon">&#9888;</span> ${escHtml(message)}
    <button class="inline-error-close" aria-label="Dismiss" onclick="document.getElementById('vocab-inline-error').remove()">&#x2715;</button>`;

  // Insert above the vocab grid
  const grid = document.getElementById('vocab-grid');
  if (grid) grid.parentNode.insertBefore(err, grid);

  // Auto-hide after 4 seconds
  setTimeout(() => {
    const el = document.getElementById('vocab-inline-error');
    if (el) el.remove();
  }, 4000);
}

// H13: patch renderExercise so that subsequent vocab_practice MC exercises also auto-play
// (renderExercise in lesson.js already handles type:'listening'; we extend it for vocab MC)
(function _patchRenderExerciseForVocabMC() {
  const _orig = renderExercise;
  renderExercise = function() {
    _orig.apply(this, arguments);
    // Only auto-play MC audio when we're in vocab_practice; listening is handled by lesson.js
    if (currentTopic === 'vocab_practice') {
      const ex = currentExercises[currentIndex];
      if (ex && ex.type === 'multiple_choice' && ex.audio) {
        setTimeout(() => speakText(ex.audio), 350);
      }
    }
  };
})();
