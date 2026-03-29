let currentExercises = [], currentIndex = 0, xp = 0, correct = 0, answered = false;
let selectedTopic = '', currentTopic = '', mistakes = [];
let hearts = 3;
const MAX_HEARTS = 3;

// M11 — Expanded PRAISE and ENCOURAGE arrays (15–20 entries each, with Italian)
const PRAISE = [
  'Perfetto! 🎯', 'Esatto! 💪', 'Bravissimo! ⭐', 'Ottimo lavoro! 🔥',
  'Sì, giusto! 🙌', 'Corretto! ✓', 'Magnifico! 🌟', 'Ottimo! 🎉',
  'Bravo/a! 👏', 'Benissimo! 💫', 'Eccellente! 🏆', 'That\'s right! ✅',
  'Spot on! 🎯', 'Well done! 🌈', 'Keep it up! 🚀', 'Superb! ⚡',
  'Fantastico! 🎊', 'Meraviglioso! ✨'
];
const ENCOURAGE = [
  'Non ancora — quasi!', 'Riprova la prossima volta! 💪', 'Quasi! Continua così.',
  'Non mollare — ci sei quasi!', 'So close! Try again next time.',
  'Good effort — keep going! 🌱', 'You\'ll get it! 💡',
  'Almost there — don\'t give up!', 'Every mistake is a lesson. 📖',
  'Keep practicing! 🎯', 'Not quite — you\'re learning! 🌟',
  'Dai! Puoi farcela! 💪', 'Continua a provare! 🔥',
  'Ci vuole pratica — vai avanti!', 'Sbagliando si impara! 😊'
];

// L4 — Module-level answer variable (replaces inline onclick answer-passing)
let _currentAnswer = null;

// L6 — Speaking check failure tracking
let _speakFailCount = 0;

// M9 — Track how many times each generated topic has been played for replay variety
function _getReplayCount(topic) {
  try {
    const counts = JSON.parse(localStorage.getItem('parlami_replay_counts') || '{}');
    const n = counts[topic] || 0;
    counts[topic] = n + 1;
    localStorage.setItem('parlami_replay_counts', JSON.stringify(counts));
    return n;
  } catch { return 0; }
}

// ── Topic selector ───────────────────────────────────────────
function selectTopic(el, topic) {
  document.querySelectorAll('.tc').forEach(c => c.classList.remove('active'));
  el.classList.add('active');
  selectedTopic = topic;
  document.getElementById('custom-topic').value = '';
}

// H11 — Inline error helper (replaces alert())
function showInlineError(msg) {
  const existing = document.getElementById('inline-error-bar');
  if (existing) existing.remove();
  const bar = document.createElement('div');
  bar.id = 'inline-error-bar';
  bar.className = 'feedback-bar wrong inline-error';
  bar.style.cssText = 'margin:12px 0;cursor:pointer;';
  bar.innerHTML = `<div class="fb-icon">⚠️</div><div><div class="fb-label">${escHtml(msg)}</div><div class="fb-detail">Tap to dismiss</div></div>`;
  bar.onclick = () => bar.remove();
  // Try to insert near the exercise container, or prepend to body
  const container = document.getElementById('exercise-container');
  if (container) {
    container.prepend(bar);
  } else {
    document.body.prepend(bar);
  }
  // Auto-dismiss after 5 seconds
  setTimeout(() => { if (bar.parentNode) bar.remove(); }, 5000);
}

// ── Start generated lesson ───────────────────────────────────
async function startGeneratedLesson(lessonId) {
  const custom = document.getElementById('custom-topic').value.trim();
  const topic = custom || selectedTopic;
  // H11 — replaced alert() with inline error
  if (!topic) {
    showInlineError('Please select or type a topic first.');
    return;
  }

  showScreen('lesson');
  document.getElementById('progress-fill').style.width = '0%';
  document.getElementById('xp-counter').textContent = '0 XP';
  document.getElementById('exercise-container').innerHTML = `
    <div class="loading-state">
      <div class="spinner"></div>
      <div style="font-weight:500">${escHtml(topic.charAt(0).toUpperCase()+topic.slice(1))} lesson</div>
      <div class="loading-steps">
        <div class="loading-step active" id="ls1">Fetching vocabulary from Wiktionary...</div>
        <div class="loading-step" id="ls2">Finding real sentences from Tatoeba...</div>
        <div class="loading-step" id="ls3">Building exercises...</div>
      </div>
    </div>`;

  setTimeout(() => { const s=document.getElementById('ls2'); if(s){s.classList.add('active');} }, 1200);
  setTimeout(() => { const s=document.getElementById('ls3'); if(s){s.classList.add('active');} }, 2400);

  try {
    const r = await fetch(API + '/api/lesson', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ topic, userContext: getUserContext(), replayCount: _getReplayCount(topic) })
    });
    // M14 / H8 — check for structured server-side error flags before r.ok
    if (r.status === 504) {
      const data = await r.json().catch(() => ({}));
      throw new Error(data.timedOut ? 'Taking too long — try again' : `HTTP ${r.status}`);
    }
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    const data = await r.json();
    // M14: surface MyMemory rate-limit to user
    if (data.rateLimited && (!data.exercises || data.exercises.length === 0)) {
      throw new Error('Translation quota reached — try again later');
    }
    // H8: surface timeout flag even on a 200 response
    if (data.timedOut) {
      throw new Error('Taking too long — try again');
    }
    if (!data.exercises || data.exercises.length === 0) {
      throw new Error(data.error || 'No exercises generated for this topic');
    }
    currentTopic = lessonId || topic;
    currentExercises = data.exercises;
    currentIndex = 0; xp = 0; correct = 0; answered = false; mistakes = [];
    initHearts();
    renderExercise();
  } catch(e) {
    document.getElementById('exercise-container').innerHTML = `
      <div class="loading-state">
        <div style="font-size:32px">⚠️</div>
        <div>${e.message}</div>
        <button class="check-btn" style="margin-top:16px;max-width:200px" onclick="goHome()">Go back</button>
      </div>`;
  }
}

function startLesson(topic) {
  const exercises = HARDCODED[topic];
  if (!exercises) {
    document.getElementById('custom-topic').value = topic.replace(/_/g,' ');
    startGeneratedLesson(topic);
    return;
  }
  currentTopic = topic;
  currentExercises = shuffle([...exercises]);
  currentIndex = 0; xp = 0; correct = 0; answered = false; mistakes = [];
  initHearts();
  showScreen('lesson');
  renderExercise();
}

// ── L1: Phonetic hints for hard Italian sounds ────────────────
const PHONETIC_HINTS = [
  { pattern: /gn/i,         hint: 'gn: ny sound, like "canyon"' },
  { pattern: /gli/i,        hint: 'gli: lli sound, like "million"' },
  { pattern: /sci|sce/i,    hint: 'sci/sce: sh sound, like "she"' },
  { pattern: /chi|che/i,    hint: 'chi/che: k sound (hard c)' },
  { pattern: /ghi|ghe/i,    hint: 'ghi/ghe: g sound (hard g)' },
  { pattern: /zz/i,         hint: 'zz: ts or dz sound' },
  { pattern: /cc(?=[ei])/i, hint: 'cc + e/i: tch sound, like "church"' },
  { pattern: /c(?=[ei])/i,  hint: 'c + e/i: ch sound, like "cheese"' },
  { pattern: /g(?=[ei])/i,  hint: 'g + e/i: soft g, like "gym"' },
  { pattern: /rr/i,         hint: 'rr: rolled r — trill!' },
  { pattern: /zione|sione/i,hint: '-zione: tsee-OH-neh sound' },
  { pattern: /sc(?=[ei])/i, hint: 'sc + e/i: sh sound' },
  { pattern: /gl/i,         hint: 'gl: lyuh sound before i' },
  { pattern: /e$/i,         hint: 'final e: always pronounced, not silent' },
];
function getPhoneticHint(text) {
  if (!text) return null;
  for (const e of PHONETIC_HINTS) { if (e.pattern.test(text)) return e.hint; }
  return null;
}

// ── P11: Grammar explanations for contrastive feedback ─────────
const GRAMMAR_EXPLANATIONS = {
  'adjective_agreement': 'Adjectives must agree in gender and number with the noun.',
  'reflexive':           'Reflexive verbs use mi/ti/si/ci/vi/si before the verb.',
  'past_auxiliary':      'Use "essere" for motion/state verbs, "avere" for action verbs.',
  'imperfetto':          'Imperfetto (-avo/-evo/-ivo) describes ongoing or repeated past actions.',
  'subjunctive':         'The subjunctive (congiuntivo) is used after expressions of doubt, wish, or emotion.',
};

// ── P17: New vs Review badge ──────────────────────────────────
function exBadge(ex) {
  const words = getExerciseWords(ex);
  if (!words || words.length === 0) return '';
  const vocab = loadVocab();
  const key = words[0] ? words[0].toLowerCase().replace(/[^a-zàèéìòùü']/g, '') : null;
  if (!key || key.length < 2) return '';
  const entry = vocab[key];
  if (!entry || entry.seen === 0) return `<span class="ex-badge ex-badge-new">✨ New</span>`;
  if (entry.seen > 2) return `<span class="ex-badge ex-badge-review">🔁 Review</span>`;
  return '';
}

// ── Exercise rendering ───────────────────────────────────────
function hintHeader(typeLabel, hintText) {
  return `<div class="ex-header">
    <div class="ex-type">${typeLabel}</div>
    ${hintText ? `<button class="hint-btn" data-hint="${esc(hintText)}" onclick="revealHint(this)">💡 Hint</button>` : ''}
  </div>`;
}

// M14 — Key hint helper: show [1][2] labels on desktop
function keyHint(n) {
  return window.innerWidth >= 768 ? ` <span class="mc-key-hint">[${n}]</span>` : '';
}

function renderMC(ex) {
  // L4 — store answer in module-level variable
  _currentAnswer = ex.answer;
  return `<div class="exercise-card">
    ${hintHeader('Multiple choice', ex.hint)}
    <div class="ex-prompt">${escHtml(ex.prompt)}</div>
    ${ex.audio?`<div class="audio-section"><button class="play-btn" onclick="speakText('${esc(ex.audio)}')"><svg xmlns="http://www.w3.org/2000/svg" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><polygon points="5 3 19 12 5 21 5 3"/></svg></button><div style="font-size:13px;color:var(--text-muted)">Tap to hear the word</div></div>`:''}
    <div class="options-grid">${ex.options.map((o,i)=>`<button class="opt" data-value="${esc(o)}" onclick="selectMC(this)">${escHtml(o)}${keyHint(i+1)}</button>`).join('')}</div>
  </div>
  <button class="check-btn" id="check-btn" disabled onclick="checkMC()">Check</button>`;
}

function renderFillBlank(ex) {
  // L4 — store answer in module-level variable
  _currentAnswer = ex.answer;
  return `<div class="exercise-card">
    ${hintHeader('Fill in the blank', ex.hint)}
    <div class="ex-prompt">${escHtml(ex.prompt)}</div>
    <input class="blank-input" id="blank-input" placeholder="${esc(ex.placeholder||'Type here...')}" oninput="enableIfFilled()" onkeydown="if(event.key==='Enter'&&!document.getElementById('check-btn').disabled)checkFill()" />
  </div>
  <button class="check-btn" id="check-btn" disabled onclick="checkFill()">Check</button>`;
}

function renderMatchPairs(ex) {
  const en = shuffle(ex.pairs.map(p=>p[1]));
  const it = shuffle(ex.pairs.map(p=>p[0]));
  window._pairs = ex.pairs; window._sel = null; window._matched = 0;
  _currentAnswer = null; // pairs don't use _currentAnswer
  // attr() escapes only what HTML attributes inside double quotes need — not apostrophes
  const attr = s => (s||'').replace(/&/g,'&amp;').replace(/"/g,'&quot;');
  return `<div class="exercise-card">
    ${hintHeader('Match pairs', ex.hint)}
    <div class="ex-prompt">${escHtml(ex.prompt)}</div>
    <div class="pairs-container">
      ${en.map((w,i) => `<button class="pair-btn" data-word="${attr(w)}" data-side="en" onclick="selectPair(this)">${escHtml(w)}</button><button class="pair-btn" data-word="${attr(it[i])}" data-side="it" onclick="selectPair(this)">${escHtml(it[i])}</button>`).join('')}
    </div>
  </div>
  <button class="check-btn" id="check-btn" disabled onclick="advanceExercise()">Continue</button>`;
}

// M10 — Word hint: up to 3 hints per translate exercise
let _wordHintsLeft = 3;

function renderTranslate(ex) {
  const bank = shuffle([...ex.words]);
  window._placed = []; window._transAnswer = ex.answer.toLowerCase();
  _currentAnswer = ex.answer; // L4
  _wordHintsLeft = 3; // M10 — reset hint count
  return `<div class="exercise-card">
    ${hintHeader('Translate the sentence', ex.hint)}
    <div class="ex-prompt">${escHtml(ex.prompt)}</div>
    <div class="ex-hint" style="font-size:16px;font-weight:500;color:var(--text);margin-bottom:16px">"${escHtml(ex.english)}"</div>
    <div class="sentence-area" id="sent-area"></div>
    <div class="word-bank" id="word-bank">${bank.map((w,i)=>`<button class="word-token" data-word="${esc(w)}" data-idx="${i}" onclick="placeWord(this)">${escHtml(w)}</button>`).join('')}</div>
    <button class="word-hint-btn" id="word-hint-btn" onclick="showWordHint()">💡 ${_wordHintsLeft} hints left</button>
  </div>
  <button class="check-btn" id="check-btn" disabled onclick="checkTranslate()">Check</button>`;
}

function renderListening(ex) {
  _currentAnswer = ex.answer; // L4
  window._listenAudio = ex.audio;
  return `<div class="exercise-card">
    ${hintHeader('Listening', ex.hint)}
    <div class="ex-prompt">${escHtml(ex.prompt)}</div>
    <div class="audio-section">
      <button class="play-btn" onclick="speakText('${esc(ex.audio)}')">
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><polygon points="5 3 19 12 5 21 5 3"/></svg>
      </button>
      <div style="font-size:13px;color:var(--text-muted)">Tap to hear the phrase</div>
    </div>
    ${getPhoneticHint(ex.audio || ex.answer || '') ? `<div class="phonetic-hint">🔤 ${escHtml(getPhoneticHint(ex.audio || ex.answer || ''))}</div>` : ''}
    <input class="blank-input" id="blank-input" placeholder="Type what you hear..." oninput="enableIfFilled()" onkeydown="if(event.key==='Enter'&&!document.getElementById('check-btn').disabled)checkListen()" />
  </div>
  <button class="check-btn" id="check-btn" disabled onclick="checkListen()">Check</button>`;
}

// ── Accent-tolerant comparison helper (H9) ───────────────────
function stripAccents(s) {
  return s.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

// ── P1: Info card ─────────────────────────────────────────────
function renderInfoCard(ex) {
  return `<div class="exercise-card info-card">
    <div class="info-card-icon">💡</div>
    <div class="info-card-title">${escHtml(ex.title || 'Did you know?')}</div>
    <div class="info-card-content">${ex.content || ''}</div>
  </div>
  <button class="check-btn" id="check-btn" onclick="advanceExercise()">Got it →</button>`;
}

// ── P2: Free write ────────────────────────────────────────────
function renderFreeWrite(ex) {
  window._freeWriteAnswer = ex.answer;
  const wordCount = ex.wordCount || (ex.answer ? ex.answer.split(/\s+/).length : 0);
  return `<div class="exercise-card">
    ${exBadge(ex)}
    ${hintHeader('Free write', ex.hint)}
    <div class="ex-prompt">${escHtml(ex.english || ex.prompt)}</div>
    <div class="free-write-hint">Aim for about ${wordCount} word${wordCount !== 1 ? 's' : ''}</div>
    <textarea class="free-write-area" id="free-write-input" placeholder="Write in Italian..." oninput="enableIfFreeWriteFilled()"></textarea>
  </div>
  <button class="check-btn" id="check-btn" disabled onclick="checkFreeWrite()">Check</button>`;
}
function enableIfFreeWriteFilled() {
  const ta = document.getElementById('free-write-input');
  if (ta) document.getElementById('check-btn').disabled = ta.value.trim().length === 0;
}
function checkFreeWrite() {
  if (answered) { advanceExercise(); return; }
  answered = true;
  const ta = document.getElementById('free-write-input'); ta.disabled = true;
  const userText = ta.value.trim();
  const answer = window._freeWriteAnswer || '';
  const normalize = s => s.toLowerCase().replace(/[.,!?;:'"()]/g, '').split(/\s+/).filter(w => w.length > 0);
  const userWords = normalize(userText);
  const answerWords = normalize(answer);
  const strip = w => stripAccents(w);
  const userSet = new Set(userWords.map(strip));
  const answerSet = new Set(answerWords.map(strip));
  let intersection = 0;
  answerSet.forEach(w => { if (userSet.has(w)) intersection++; });
  const union = new Set([...userSet, ...answerSet]).size;
  const overlap = union > 0 ? intersection / union : 0;
  const ok = overlap >= 0.5;
  ta.classList.add(ok ? 'correct' : 'wrong');
  trackWords(answerWords, ok, currentExercises[currentIndex].english);
  if (ok) xp += 5; // 15 XP total (10 base + 5 extra for free write)
  showFeedback(ok, answer, userText);
}

// ── P6: Agreement drill ───────────────────────────────────────
function renderAgreementDrill(ex) {
  window._agreementAnswer = ex.answer;
  return `<div class="exercise-card">
    ${exBadge(ex)}
    ${hintHeader('Agreement drill', ex.hint)}
    <div class="ex-prompt">${escHtml(ex.noun ? `"${ex.noun}" + ?` : (ex.prompt || ''))}</div>
    <div class="ex-hint">Adjective base form: <strong>${escHtml(ex.adjective)}</strong> — What is the correct form?</div>
    <input class="blank-input" id="blank-input" placeholder="Type the correct form..." oninput="enableIfFilled()"
      onkeydown="if(event.key==='Enter'&&!document.getElementById('check-btn').disabled)checkAgreementDrill()" />
  </div>
  <button class="check-btn" id="check-btn" disabled onclick="checkAgreementDrill()">Check</button>`;
}
function checkAgreementDrill() {
  if (answered) { advanceExercise(); return; }
  answered = true;
  const answer = window._agreementAnswer;
  const i = document.getElementById('blank-input'); i.disabled = true;
  const userVal = i.value.trim();
  const ok = stripAccents(userVal.toLowerCase()) === stripAccents(answer.toLowerCase());
  trackWord(answer, ok, currentExercises[currentIndex].english);
  i.classList.add(ok ? 'correct' : 'wrong');
  showFeedback(ok, answer, userVal);
}

// ── P16: Make plural ──────────────────────────────────────────
function renderMakePlural(ex) {
  window._makePluralAnswer = ex.answer;
  return `<div class="exercise-card">
    ${exBadge(ex)}
    ${hintHeader('Make plural', ex.hint)}
    <div class="ex-prompt">${escHtml(ex.singular || ex.prompt)}</div>
    <div class="ex-hint">Give the plural form (with article)</div>
    <input class="blank-input" id="blank-input" placeholder="Plural form..." oninput="enableIfFilled()"
      onkeydown="if(event.key==='Enter'&&!document.getElementById('check-btn').disabled)checkMakePlural()" />
  </div>
  <button class="check-btn" id="check-btn" disabled onclick="checkMakePlural()">Check</button>`;
}
function checkMakePlural() {
  if (answered) { advanceExercise(); return; }
  answered = true;
  const answer = window._makePluralAnswer;
  const i = document.getElementById('blank-input'); i.disabled = true;
  const userVal = i.value.trim();
  const ok = stripAccents(userVal.toLowerCase()) === stripAccents(answer.toLowerCase());
  trackWord(answer, ok, currentExercises[currentIndex].english);
  i.classList.add(ok ? 'correct' : 'wrong');
  showFeedback(ok, answer, userVal);
}

// ── Exercise interactions ────────────────────────────────────
let _mcSel = null;

// L4 — selectMC no longer takes answer as parameter
function selectMC(btn) {
  if (answered) return;
  document.querySelectorAll('.opt').forEach(b=>b.classList.remove('selected'));
  btn.classList.add('selected'); _mcSel = btn.dataset.value;
  const cb = document.getElementById('check-btn');
  cb.disabled = false; cb.onclick = checkMC;
}

// M14 — Keyboard navigation for MC exercises
let _mcKeyHandler = null;
function attachMCKeyHandler() {
  if (_mcKeyHandler) document.removeEventListener('keydown', _mcKeyHandler);
  _mcKeyHandler = (e) => {
    const n = parseInt(e.key, 10);
    if (n >= 1 && n <= 4) {
      const opts = document.querySelectorAll('.opt');
      if (opts[n - 1]) opts[n - 1].click();
    }
  };
  document.addEventListener('keydown', _mcKeyHandler);
}
function removeMCKeyHandler() {
  if (_mcKeyHandler) {
    document.removeEventListener('keydown', _mcKeyHandler);
    _mcKeyHandler = null;
  }
}

// L4 — checkMC now reads _currentAnswer from module-level variable
function checkMC() {
  if (answered) { advanceExercise(); return; }
  answered = true;
  removeMCKeyHandler();
  const answer = _currentAnswer;
  const ok = _mcSel === answer;
  document.querySelectorAll('.opt').forEach(b=>{ b.disabled=true; if(b.dataset.value===answer)b.classList.add('correct'); else if(b.classList.contains('selected')&&!ok)b.classList.add('wrong'); });
  const _ex = currentExercises[currentIndex];
  trackWords(getExerciseWords(_ex), ok, _ex.english);
  showFeedback(ok, answer, _mcSel);
}
function enableIfFilled() { const i=document.getElementById('blank-input'); if(i) document.getElementById('check-btn').disabled=i.value.trim().length===0; }

// L4 — checkFill reads _currentAnswer
function checkFill() {
  if (answered) { advanceExercise(); return; }
  answered = true;
  const answer = _currentAnswer;
  const i = document.getElementById('blank-input'); i.disabled = true;
  const userFill = i.value.trim();
  const ok = userFill.toLowerCase() === answer.toLowerCase();
  // H9: detect accent-only mismatch and give targeted feedback
  const almostOk = !ok && stripAccents(userFill.toLowerCase()) === stripAccents(answer.toLowerCase());
  trackWord(answer, ok, currentExercises[currentIndex].english);
  i.classList.add(ok ? 'correct' : 'wrong');
  showFeedback(ok, answer, userFill, almostOk ? `Almost! Check the accent: ${answer}` : null);
}

// L4 — checkListen reads _currentAnswer
function checkListen() {
  if (answered) { advanceExercise(); return; }
  answered = true;
  const answer = _currentAnswer;
  const i = document.getElementById('blank-input'); i.disabled = true;
  const userListen = i.value.trim();
  const clean = s => s.toLowerCase().replace(/[.,!?;:]/g, '');
  const ok = clean(userListen) === clean(answer);
  // H9: accent-only mismatch feedback
  const almostOk = !ok && stripAccents(clean(userListen)) === stripAccents(clean(answer));
  trackWords(answer.split(/\s+/).filter(w => w.length > 2), ok, currentExercises[currentIndex].english);
  i.classList.add(ok ? 'correct' : 'wrong');
  showFeedback(ok, window._listenAudio, userListen, almostOk ? `Almost! Check the accent: ${answer}` : null);
}
function selectPair(btn) {
  if (btn.classList.contains('matched')) return;
  const sel = window._sel;
  if (!sel) { document.querySelectorAll('.pair-btn.selected').forEach(b=>b.classList.remove('selected')); btn.classList.add('selected'); window._sel = btn; return; }
  if (sel === btn) { btn.classList.remove('selected'); window._sel = null; return; }
  if (sel.dataset.side === btn.dataset.side) { document.querySelectorAll('.pair-btn.selected').forEach(b=>b.classList.remove('selected')); btn.classList.add('selected'); window._sel = btn; return; }
  const it = sel.dataset.side==='it'?sel.dataset.word:btn.dataset.word;
  const en = sel.dataset.side==='en'?sel.dataset.word:btn.dataset.word;
  const match = window._pairs.find(p=>p[0]===it&&p[1]===en);
  if (match) {
    sel.classList.remove('selected'); btn.classList.remove('selected');
    sel.classList.add('matched'); btn.classList.add('matched');
    sel.disabled = true; btn.disabled = true;
    trackWord(it, true);
    window._sel = null; window._matched++;
    if (window._matched === window._pairs.length) { showFeedback(true,''); }
  } else {
    sel.classList.add('wrong-pair'); btn.classList.add('wrong-pair');
    setTimeout(()=>{ sel.classList.remove('wrong-pair','selected'); btn.classList.remove('wrong-pair','selected'); window._sel=null; }, 700);
  }
}
function placeWord(btn) {
  if (btn.classList.contains('used')) return;
  window._placed.push({word:btn.dataset.word,btn});
  btn.classList.add('used');
  const area = document.getElementById('sent-area');
  const tok = document.createElement('button');
  tok.className = 'word-token placed'; tok.textContent = btn.dataset.word;
  tok.onclick = () => { const idx=window._placed.findIndex(x=>x.btn===btn); if(idx!==-1){window._placed.splice(idx,1);btn.classList.remove('used');tok.remove();} updateTransBtn(); };
  area.appendChild(tok); updateTransBtn();
}
function updateTransBtn() { const b=document.getElementById('check-btn'); if(b) b.disabled=window._placed.length===0; }
function checkTranslate() {
  if (answered) { advanceExercise(); return; }
  answered = true;
  const placed = window._placed.map(x=>x.word.toLowerCase()).join(' ');
  const ok = placed === window._transAnswer;
  trackWords(window._transAnswer.split(/\s+/).filter(w=>w.length>2), ok, currentExercises[currentIndex].english);
  document.querySelectorAll('.word-token.placed').forEach(t=>{ t.style.pointerEvents='none'; t.style.borderColor=ok?'var(--green)':'var(--red)'; t.style.background=ok?'var(--green-light)':'var(--red-light)'; t.style.color=ok?'var(--green)':'var(--red)'; });
  showFeedback(ok, window._transAnswer, window._placed.map(x=>x.word).join(' '));
}

function showFeedback(ok, answer, userAnswer, note) {
  if (ok) { correct++; xp+=10; } else {
    const ex = currentExercises[currentIndex];
    mistakes.push({ type: ex.type, prompt: ex.prompt || ex.sentence || '', answer, userAnswer: userAnswer || '' });
    loseHeart();
  }
  document.getElementById('xp-counter').textContent = xp+' XP';
  const old = document.getElementById('fb-bar'); if(old) old.remove();
  const fb = document.createElement('div');
  fb.id = 'fb-bar'; fb.className = 'feedback-bar '+(ok?'correct':'wrong');
  const msg = ok ? PRAISE[Math.floor(Math.random()*PRAISE.length)] : ENCOURAGE[Math.floor(Math.random()*ENCOURAGE.length)];
  // note overrides the default detail line (used for accent hints, H9)
  let detail;
  if (note) detail = `<div class="fb-detail">${escHtml(note)}</div>`;
  else if (!ok && answer) detail = `<div class="fb-detail">Answer: <strong>${escHtml(answer)}</strong></div>`;
  else detail = `<div class="fb-detail">+10 XP</div>`;
  // P11: grammar note on wrong answer
  let grammarNote = '';
  if (!ok) {
    const _gex = currentExercises[currentIndex];
    if (_gex && _gex.grammar_tag && GRAMMAR_EXPLANATIONS[_gex.grammar_tag]) {
      grammarNote = `<div class="fb-grammar-note">${escHtml(GRAMMAR_EXPLANATIONS[_gex.grammar_tag])}</div>`;
    }
  }
  fb.innerHTML = `<div class="fb-icon">${ok?'✓':'✗'}</div><div><div class="fb-label">${msg}</div>${detail}${grammarNote}</div>`;
  const btn = document.getElementById('check-btn');
  btn.parentNode.insertBefore(fb, btn);
  btn.textContent = currentIndex < currentExercises.length-1 ? 'Next →' : 'Finish';
  btn.className = 'check-btn next'; btn.disabled = false; btn.onclick = advanceExercise;
}
function advanceExercise() { removeMCKeyHandler(); currentIndex++; if(currentIndex>=currentExercises.length){showComplete();return;} renderExercise(); }

// ── Next lesson helper (M8 / L12) ────────────────────────────
function getNextLesson() {
  if (typeof COURSE === 'undefined' || typeof loadStats === 'undefined') return null;
  const stats = loadStats();
  // Find the current lesson's position across the flat course map
  const allLessons = [];
  COURSE.forEach((unit, unitIdx) => {
    unit.lessons.forEach((lesson, lessonIdx) => {
      allLessons.push({ lesson, unitIdx, lessonIdx });
    });
  });
  // Find current topic in the flat list
  const currentPos = allLessons.findIndex(e => e.lesson.id === currentTopic);
  // Search for the next unlocked lesson after current position
  const start = currentPos >= 0 ? currentPos + 1 : 0;
  for (let i = start; i < allLessons.length; i++) {
    const { lesson, unitIdx } = allLessons[i];
    if (typeof isUnitUnlocked === 'function' && isUnitUnlocked(unitIdx, stats)) {
      return lesson;
    }
  }
  return null;
}

// M8 / L12 — showComplete with "Play again" and "Next lesson" buttons
function showComplete() {
  const acc = currentExercises.length>0?Math.round((correct/currentExercises.length)*100):0;
  document.getElementById('final-xp').textContent = xp+' XP';
  document.getElementById('final-acc').textContent = acc+'% correct';
  if (currentTopic) saveCompletion(currentTopic, xp, acc);
  if (mistakes.length > 0) {
    showMistakeReview();
  } else {
    showScreen('complete');
    // M8 / L12 — inject Play again + Next lesson buttons
    injectCompleteButtons();
    // P15 — inject vocab summary
    injectVocabSummary();
    const newBadges = checkNewAchievements();
    showAchievementToast(newBadges);
  }
}

// P15 — Vocabulary summary on completion screen
function injectVocabSummary() {
  const oldSummary = document.getElementById('lesson-vocab-summary');
  if (oldSummary) oldSummary.remove();
  const words = [];
  const seen = new Set();
  for (const ex of currentExercises) {
    for (const w of getExerciseWords(ex)) {
      const clean = w.toLowerCase().replace(/[^a-zàèéìòùü']/g, '');
      if (clean.length >= 2 && !seen.has(clean)) { seen.add(clean); words.push(clean); }
      if (words.length >= 8) break;
    }
    if (words.length >= 8) break;
  }
  if (words.length === 0) return;
  const vocab = loadVocab();
  const items = words.map(w => {
    const entry = vocab[w];
    const level = entry ? vocabLevel(entry) : 'new';
    const dot = level === 'strong' ? '🟢' : level === 'good' ? '🟡' : level === 'learning' ? '🟡' : '🔴';
    const gloss = entry && entry.english ? `<span class="vsi-gloss">${escHtml(entry.english)}</span>` : '';
    return `<div class="vocab-summary-item"><span class="vsi-dot">${dot}</span><span class="vsi-word">${escHtml(w)}</span>${gloss}</div>`;
  }).join('');
  const wrap = document.createElement('div');
  wrap.id = 'lesson-vocab-summary';
  wrap.className = 'lesson-vocab-summary';
  wrap.innerHTML = `<div class="lvs-title">Words from this lesson</div>${items}`;
  const completeScreen = document.getElementById('screen-complete');
  if (completeScreen) {
    const stats = completeScreen.querySelector('.complete-stats');
    if (stats) stats.insertAdjacentElement('afterend', wrap);
    else completeScreen.appendChild(wrap);
  }
}

function injectCompleteButtons() {
  // Remove any previously injected completion action buttons
  const old = document.getElementById('complete-actions');
  if (old) old.remove();

  const nextLesson = getNextLesson();
  const topicForReplay = currentTopic;

  const wrap = document.createElement('div');
  wrap.id = 'complete-actions';
  wrap.style.cssText = 'display:flex;flex-direction:column;gap:10px;width:100%;max-width:320px;margin:12px auto 0;';

  // Play again button
  const playAgainBtn = document.createElement('button');
  playAgainBtn.className = 'check-btn';
  playAgainBtn.textContent = '🔁 Play again';
  playAgainBtn.onclick = () => { startLesson(topicForReplay); };

  wrap.appendChild(playAgainBtn);

  // Next lesson / Continue button
  const nextBtn = document.createElement('button');
  if (nextLesson) {
    nextBtn.className = 'check-btn next';
    nextBtn.innerHTML = `Continue → ${escHtml(nextLesson.emoji || '')} ${escHtml(nextLesson.title)}`;
    nextBtn.onclick = () => { startLesson(nextLesson.id); };
  } else {
    nextBtn.className = 'home-btn';
    nextBtn.textContent = 'Back to lessons';
    nextBtn.onclick = () => { goHome(); };
  }
  wrap.appendChild(nextBtn);

  // Insert after the existing "Back to lessons" button in complete screen
  const completeScreen = document.getElementById('screen-complete');
  if (completeScreen) {
    const existingHomeBtn = completeScreen.querySelector('.home-btn');
    if (existingHomeBtn) {
      existingHomeBtn.style.display = 'none'; // hide the static button
    }
    completeScreen.appendChild(wrap);
  }
}

function showMistakeReview() {
  const list = document.getElementById('mistake-list');
  list.innerHTML = mistakes.map(m => `
    <div class="mistake-card">
      <div class="mistake-type">${escHtml(formatExType(m.type))}</div>
      <div class="mistake-prompt">${escHtml(m.prompt)}</div>
      <div class="mistake-row wrong-row"><span class="mistake-label">You answered</span><span class="mistake-val wrong-val">${escHtml(m.userAnswer || '—')}</span></div>
      <div class="mistake-row correct-row"><span class="mistake-label">Correct answer</span><span class="mistake-val correct-val">${escHtml(m.answer)}</span></div>
    </div>`).join('');
  showScreen('review');
}

function formatExType(type) {
  return { multiple_choice:'Multiple choice', fill_blank:'Fill in the blank', match_pairs:'Match pairs', translate:'Translate', listening:'Listening', conjugation:'Conjugation', error_correction:'Error correction', reorder:'Reorder', speaking:'Speaking' }[type] || type;
}

// ── Hearts ────────────────────────────────────────────────────
function initHearts() {
  hearts = MAX_HEARTS;
  renderHearts();
}
function renderHearts() {
  const el = document.getElementById('hearts-display');
  if (!el) return;
  el.innerHTML = Array.from({length: MAX_HEARTS}, (_, i) =>
    `<span class="heart${i >= hearts ? ' broken' : ''}">${i >= hearts ? '🖤' : '❤️'}</span>`
  ).join('');
}
function loseHeart() {
  if (hearts > 0) hearts--;
  // animate the heart that just broke
  const el = document.getElementById('hearts-display');
  if (el) {
    const heartEls = el.querySelectorAll('.heart');
    const broke = heartEls[hearts];
    if (broke) { broke.classList.add('breaking'); broke.addEventListener('animationend', () => broke.classList.remove('breaking'), {once:true}); }
  }
  renderHearts();
  if (hearts === 0) {
    // H1: show overlay instead of silently refilling
    const overlay = document.getElementById('no-hearts-overlay');
    if (overlay) {
      setTimeout(() => { overlay.classList.add('visible'); }, 400);
    } else {
      setTimeout(() => { hearts = MAX_HEARTS; renderHearts(); }, 900);
    }
  }
}
function refillHearts() {
  hearts = MAX_HEARTS;
  renderHearts();
  const overlay = document.getElementById('no-hearts-overlay');
  if (overlay) overlay.classList.remove('visible');
}

// ── Hint reveal ───────────────────────────────────────────────
function revealHint(btn) {
  const text = btn.dataset.hint;
  btn.style.display = 'none';
  const card = btn.closest('.exercise-card');
  const prompt = card.querySelector('.ex-prompt');
  const d = document.createElement('div');
  d.className = 'ex-hint hint-reveal';
  d.textContent = text;
  prompt.insertAdjacentElement('afterend', d);
}

// M10 — Word hint: up to 3 hints, each subtracts 3 XP
function showWordHint() {
  if (_wordHintsLeft <= 0) return;
  const nextIdx = window._placed.length;
  const words = (window._transAnswer || '').split(/\s+/);
  if (nextIdx >= words.length) return;
  const nextWord = words[nextIdx];
  const tokens = document.querySelectorAll('#word-bank .word-token:not(.used)');
  const match = [...tokens].find(t => t.dataset.word.toLowerCase() === nextWord.toLowerCase());
  if (match) {
    match.classList.add('word-hint-highlight');
    setTimeout(() => match.classList.remove('word-hint-highlight'), 2000);
  }
  // Deduct 3 XP per hint (minimum 0)
  xp = Math.max(0, xp - 3);
  document.getElementById('xp-counter').textContent = xp + ' XP';
  _wordHintsLeft--;
  const hintBtn = document.getElementById('word-hint-btn');
  if (hintBtn) {
    if (_wordHintsLeft <= 0) {
      hintBtn.disabled = true;
      hintBtn.textContent = '💡 No hints left';
    } else {
      hintBtn.textContent = `💡 ${_wordHintsLeft} hint${_wordHintsLeft !== 1 ? 's' : ''} left`;
    }
  }
}

function finishReview() {
  showScreen('complete');
  injectCompleteButtons();
  const newBadges = checkNewAchievements();
  showAchievementToast(newBadges);
}
// Cache the best available Italian voice (M3)
let _itVoice = null;
function getItalianVoice() {
  if (_itVoice) return _itVoice;
  const voices = speechSynthesis.getVoices();
  const italian = voices.filter(v => v.lang.startsWith('it'));
  if (!italian.length) return null;
  _itVoice = italian.find(v => /Google|Microsoft/i.test(v.name)) || italian[0];
  return _itVoice;
}
// Pre-load voices when they become available (Chrome lazy-loads them)
if ('speechSynthesis' in window) speechSynthesis.addEventListener('voiceschanged', () => { _itVoice = null; getItalianVoice(); });

// H11 — speakText: replaced alert() with inline error
function speakText(text) {
  if (!('speechSynthesis' in window)) {
    showInlineError('Speech synthesis is not supported in this browser.');
    return;
  }
  speechSynthesis.cancel();
  // setTimeout(0) avoids Chrome post-cancel silence bug (M3)
  setTimeout(() => {
    const u = new SpeechSynthesisUtterance(text);
    u.lang = 'it-IT'; u.rate = 0.85;
    const voice = getItalianVoice();
    if (voice) u.voice = voice;
    speechSynthesis.speak(u);
  }, 0);
}
function showScreen(name) { document.querySelectorAll('.screen').forEach(s=>s.classList.remove('active')); document.getElementById('screen-'+name).classList.add('active'); window.scrollTo(0,0); }
function goHome() {
  // M4: warn before abandoning a lesson in progress
  if (currentIndex > 0 && currentIndex < currentExercises.length && !answered) {
    const existing = document.getElementById('exit-confirm-bar');
    if (existing) return; // already showing
    const bar = document.createElement('div');
    bar.id = 'exit-confirm-bar';
    bar.className = 'exit-confirm-bar';
    bar.innerHTML = `<span class="exit-confirm-msg">Leave lesson? Progress will be lost.</span>
      <button class="exit-stay-btn" onclick="document.getElementById('exit-confirm-bar').remove()">Keep going</button>
      <button class="exit-leave-btn" onclick="speechSynthesis.cancel();showScreen('home');updateHomeProgress()">Leave</button>`;
    document.getElementById('exercise-container').prepend(bar);
    return;
  }
  speechSynthesis.cancel();
  removeMCKeyHandler();
  showScreen('home');
  updateHomeProgress();
}

// ── New exercise renderers ────────────────────────────────────
function renderConjugation(ex) {
  // ex.verb, ex.tense, ex.rows: [{pronoun, answer}]
  _currentAnswer = ex.rows ? ex.rows.map(r => r.answer).join(', ') : null; // L4
  window._conjAnswers = ex.rows.map(r => r.answer.toLowerCase());
  const rows = ex.rows.map((r, i) =>
    `<tr>
      <td class="conj-pronoun">${escHtml(r.pronoun)}</td>
      <td><input class="conj-input" id="conj-${i}" data-idx="${i}" placeholder="..." oninput="enableConjCheck()" /></td>
    </tr>`).join('');
  return `<div class="exercise-card">
    ${hintHeader('Conjugation', ex.hint)}
    <div class="ex-prompt">${ex.prompt ? escHtml(ex.prompt) : `Conjugate &ldquo;${escHtml(ex.verb)}&rdquo; (${escHtml(ex.tense)})`}</div>
    <table class="conj-table">${rows}</table>
  </div>
  <button class="check-btn" id="check-btn" disabled onclick="checkConjugation()">Check</button>`;
}

function enableConjCheck() {
  const inputs = document.querySelectorAll('.conj-input');
  const allFilled = [...inputs].every(i => i.value.trim().length > 0);
  const btn = document.getElementById('check-btn');
  if (btn) btn.disabled = !allFilled;
}

function checkConjugation() {
  if (answered) { advanceExercise(); return; }
  answered = true;
  const answers = window._conjAnswers;
  let allOk = true;
  const userConjAnswers = [];
  document.querySelectorAll('.conj-input').forEach((inp, i) => {
    inp.disabled = true;
    const userVal = inp.value.trim();
    userConjAnswers.push(userVal);
    const ok = userVal.toLowerCase() === answers[i];
    inp.classList.add(ok ? 'correct' : 'wrong');
    if (!ok) allOk = false;
  });
  trackWords(answers, allOk, currentExercises[currentIndex].english);
  showFeedback(allOk, answers.join(', '), userConjAnswers.join(', '));
}

function renderErrorCorrection(ex) {
  // ex.sentence (with error), ex.answer (corrected)
  _currentAnswer = ex.answer; // L4
  return `<div class="exercise-card">
    ${hintHeader('Error correction', ex.hint)}
    <div class="ex-prompt">${escHtml(ex.prompt || 'Find and fix the error in this sentence:')}</div>
    <div class="error-sentence">${escHtml(ex.sentence)}</div>
    <input class="correction-input" id="blank-input" placeholder="Type the corrected sentence..."
      oninput="enableIfFilled()"
      onkeydown="if(event.key==='Enter'&&!document.getElementById('check-btn').disabled)checkFill()" />
  </div>
  <button class="check-btn" id="check-btn" disabled onclick="checkFill()">Check</button>`;
}

function renderReorder(ex) {
  // ex.words: shuffled array, ex.answer: correct sentence
  const words = shuffle([...ex.words]);
  window._placed = []; window._transAnswer = ex.answer.toLowerCase().replace(/[.,!?;:]/g, '');
  _currentAnswer = ex.answer; // L4
  _wordHintsLeft = 3; // M10 — also apply to reorder
  return `<div class="exercise-card">
    ${hintHeader('Reorder the words', ex.hint)}
    <div class="ex-prompt">${escHtml(ex.prompt || 'Put the words in the correct order:')}</div>
    <div class="reorder-area" id="sent-area"></div>
    <div class="word-bank" id="word-bank">${words.map((w, i) => `<button class="word-token" data-word="${esc(w)}" data-idx="${i}" onclick="placeWord(this)">${escHtml(w)}</button>`).join('')}</div>
    <button class="word-hint-btn" id="word-hint-btn" onclick="showWordHint()">💡 ${_wordHintsLeft} hints left</button>
  </div>
  <button class="check-btn" id="check-btn" disabled onclick="checkTranslate()">Check</button>`;
}

// ── Speaking exercise ─────────────────────────────────────────
function renderSpeaking(ex) {
  window._speakAnswer = ex.answer;
  window._speakAudio  = ex.audio || ex.answer;
  window._speakHeard  = null;
  window._speakScore  = 0;
  _currentAnswer = ex.answer; // L4
  _speakFailCount = 0; // L6 — reset fail counter

  const isTranslate = ex.subtype === 'translate';
  const micSvg = `<svg xmlns="http://www.w3.org/2000/svg" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><rect x="9" y="2" width="6" height="12" rx="3"/><path d="M5 10a7 7 0 0 0 14 0M12 19v3M9 22h6"/></svg>`;

  const supported = typeof speechSupported === 'function' && speechSupported();

  return `<div class="exercise-card">
    ${hintHeader(`Speaking${isTranslate ? '' : ' — Repeat'}`, ex.hint)}
    <div class="ex-prompt">${escHtml(isTranslate ? (ex.english || ex.prompt) : ex.prompt)}</div>
    ${!isTranslate && ex.audio ? `<div class="audio-section">
      <button class="play-btn" onclick="speakText('${esc(ex.audio)}')">
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><polygon points="5 3 19 12 5 21 5 3"/></svg>
      </button>
      <div style="font-size:13px;color:var(--text-muted)">Tap to hear it first</div>
    </div>` : ''}

    ${supported ? `<div class="speak-area">
      <div class="speak-idle" id="speak-idle">
        <button class="mic-btn" id="mic-btn" onclick="startSpeaking()">${micSvg}</button>
        <div class="speak-label">Tap to speak</div>
        <button class="speak-fallback-btn" onclick="showSpeakFallback()" style="margin-top:10px">Type instead</button>
      </div>
      <div class="speak-recording" id="speak-recording" style="display:none">
        <div class="mic-wave"><span></span><span></span><span></span><span></span><span></span></div>
        <div class="speak-label" style="color:var(--red)">Listening…</div>
        <button class="stop-speak-btn" onclick="stopSpeaking()">Done</button>
      </div>
      <div class="speak-result" id="speak-result" style="display:none">
        <div class="heard-label">You said:</div>
        <div class="heard-text" id="heard-text"></div>
        <div class="score-bar-wrap"><div class="score-bar-fill" id="score-bar-fill"></div></div>
        <div class="score-label" id="score-label"></div>
      </div>
    </div>` : `<div class="speak-unsupported">🎙️ Speech recognition requires Chrome or Edge. <button class="speak-fallback-btn" onclick="showSpeakFallback()">Type instead</button></div>`}
    <div id="speak-no-speech-msg" style="display:none" class="feedback-bar wrong" style="margin:8px 0;">
      <div class="fb-icon">🎙️</div>
      <div><div class="fb-label">No speech detected — try again.</div><div class="fb-detail" id="speak-type-fallback-hint"></div></div>
    </div>
    <div id="speak-fallback-area" style="display:none"><input class="blank-input" id="blank-input" placeholder="${esc(isTranslate ? 'Type the Italian...' : 'Type what you hear...')}" oninput="enableIfFilled()" onkeydown="if(event.key==='Enter'&&!document.getElementById('check-btn').disabled)checkSpeakFallback()" /></div>
  </div>
  <button class="check-btn" id="check-btn" disabled onclick="checkSpeaking()">Check</button>`;
}

function showSpeakFallback() {
  const unsupported = document.querySelector('.speak-unsupported');
  if (unsupported) unsupported.style.display = 'none';
  const speakArea = document.querySelector('.speak-area');
  if (speakArea) speakArea.style.display = 'none';
  const noSpeechMsg = document.getElementById('speak-no-speech-msg');
  if (noSpeechMsg) noSpeechMsg.style.display = 'none';
  document.getElementById('speak-fallback-area').style.display = 'block';
  const btn = document.getElementById('check-btn');
  btn.disabled = false;
  btn.onclick = checkSpeakFallback;
}

// L4 — checkSpeakFallback reads _currentAnswer
function checkSpeakFallback() {
  if (answered) { advanceExercise(); return; }
  answered = true;
  const answer = _currentAnswer;
  const i = document.getElementById('blank-input'); i.disabled = true;
  const userSpeak = i.value.trim();
  const ok = userSpeak.toLowerCase().replace(/[.,!?;:]/g,'') === answer.toLowerCase().replace(/[.,!?;:]/g,'');
  i.classList.add(ok ? 'correct' : 'wrong');
  showFeedback(ok, answer, userSpeak);
}

function startSpeaking() {
  if (!speechSupported()) return;
  // Cancel TTS and wait for the audio pipeline to fully release before opening the mic
  if ('speechSynthesis' in window) speechSynthesis.cancel();

  document.getElementById('speak-idle').style.display = 'none';
  document.getElementById('speak-recording').style.display = 'none'; // shown on onstart
  document.getElementById('speak-result').style.display = 'none';
  // Hide any previous no-speech message when starting a new attempt
  const noSpeechMsg = document.getElementById('speak-no-speech-msg');
  if (noSpeechMsg) noSpeechMsg.style.display = 'none';

  startListening(
    (alts) => {
      const score = bestSimilarity(alts, window._speakAnswer);
      window._speakHeard = bestMatch(alts, window._speakAnswer);
      window._speakScore = score;
      showSpeakResult();
    },
    (err) => {
      document.getElementById('speak-recording').style.display = 'none';
      if (err === 'network') {
        // Chrome routes speech through Google's servers — fall back to typing
        showSpeakFallback();
        const lbl = document.querySelector('.speak-label');
        if (lbl) lbl.textContent = 'Speech unavailable — type your answer below';
      } else {
        document.getElementById('speak-idle').style.display = 'flex';
        const lbl = document.querySelector('.speak-label');
        if (lbl) {
          if (err === 'not-allowed' || err === 'permission-denied') lbl.textContent = 'Microphone blocked — check browser permissions';
          else if (err === 'audio-capture') lbl.textContent = 'Mic error — check your microphone';
          else if (err === 'no-speech') lbl.textContent = 'No speech detected — tap to try again';
          else lbl.textContent = `Error: ${err} — tap to try again`;
        }
      }
    },
    () => {
      document.getElementById('speak-recording').style.display = 'none';
      if (window._speakHeard === null) {
        document.getElementById('speak-idle').style.display = 'flex';
      }
    },
    () => {
      document.getElementById('speak-recording').style.display = 'flex';
    }
  );
}

function stopSpeaking() {
  stopListening();
}

function showSpeakResult() {
  document.getElementById('speak-recording').style.display = 'none';
  document.getElementById('speak-idle').style.display = 'none';
  const res = document.getElementById('speak-result');
  res.style.display = 'block';

  const score = window._speakScore;
  const pct = Math.round(score * 100);
  document.getElementById('heard-text').textContent = window._speakHeard || '(nothing detected)';
  const fill = document.getElementById('score-bar-fill');
  fill.style.width = pct + '%';
  fill.style.background = score >= 0.6 ? 'var(--green)' : score >= 0.35 ? 'var(--amber)' : 'var(--red)';
  document.getElementById('score-label').textContent = pct + '% match';
  document.getElementById('score-label').style.color = score >= 0.6 ? 'var(--green)' : score >= 0.35 ? 'var(--amber)' : 'var(--red)';

  const btn = document.getElementById('check-btn');
  btn.disabled = false;
}

// L6 — checkSpeaking: show inline error if no speech detected; offer "Type instead" after 2 fails
function checkSpeaking() {
  if (answered) { advanceExercise(); return; }
  if (window._speakHeard === null) {
    // L6 — show inline "no speech" message instead of silent no-op
    _speakFailCount++;
    const msg = document.getElementById('speak-no-speech-msg');
    if (msg) {
      msg.style.display = 'flex';
      const hint = document.getElementById('speak-type-fallback-hint');
      if (hint) {
        if (_speakFailCount >= 2) {
          hint.innerHTML = '<button class="speak-fallback-btn" onclick="showSpeakFallback()" style="margin-top:6px;font-size:12px;">Type instead</button>';
        } else {
          hint.textContent = 'Tap the microphone and speak clearly.';
        }
      }
    }
    return;
  }
  answered = true;
  const ok = window._speakScore >= 0.6;
  trackWords((window._speakAnswer || '').split(/\s+/).filter(w => w.length > 2), ok, currentExercises[currentIndex].english);
  showFeedback(ok, ok ? '' : window._speakAudio, window._speakHeard || '');
}

// ── Skip exercise ─────────────────────────────────────────────
function skipExercise() {
  if (answered) { advanceExercise(); return; }
  const ex = currentExercises[currentIndex];
  const answerText = ex.answer || (ex.pairs ? ex.pairs.map(p => `${p[0]} = ${p[1]}`).join(', ') : '');
  mistakes.push({ type: ex.type, prompt: ex.prompt || ex.sentence || '', answer: answerText, userAnswer: '(skipped)' });
  answered = true;
  const old = document.getElementById('fb-bar'); if (old) old.remove();
  const fb = document.createElement('div');
  fb.id = 'fb-bar'; fb.className = 'feedback-bar wrong';
  fb.innerHTML = `<div class="fb-icon">⏭</div><div><div class="fb-label">Skipped</div>${answerText ? `<div class="fb-detail">Answer: <strong>${escHtml(answerText)}</strong></div>` : ''}</div>`;
  const btn = document.getElementById('check-btn');
  if (btn) {
    btn.parentNode.insertBefore(fb, btn);
    btn.textContent = currentIndex < currentExercises.length - 1 ? 'Next →' : 'Finish';
    btn.className = 'check-btn next'; btn.disabled = false; btn.onclick = advanceExercise;
  }
  const skipBtn = document.querySelector('.skip-btn');
  if (skipBtn) skipBtn.style.display = 'none';
}

// ── Patch renderExercise to include new types ─────────────────
const _origRenders = { multiple_choice: renderMC, fill_blank: renderFillBlank, match_pairs: renderMatchPairs, translate: renderTranslate, listening: renderListening, conjugation: renderConjugation, error_correction: renderErrorCorrection, reorder: renderReorder, speaking: renderSpeaking, info_card: renderInfoCard, free_write: renderFreeWrite, agreement_drill: renderAgreementDrill, make_plural: renderMakePlural };
function renderExercise() {
  if (currentIndex >= currentExercises.length) { showComplete(); return; }
  const ex = currentExercises[currentIndex];
  answered = false;
  removeMCKeyHandler(); // clean up any previous MC handler
  // M6: off-by-one fix — show current exercise position, not previous
  document.getElementById('progress-fill').style.width = Math.round(((currentIndex + 1) / currentExercises.length) * 100) + '%';
  document.getElementById('xp-counter').textContent = xp + ' XP';
  document.getElementById('exercise-container').innerHTML = (_origRenders[ex.type] || renderMC)(ex);
  const skipBtn = document.createElement('button');
  skipBtn.className = 'skip-btn';
  skipBtn.textContent = 'Skip this one';
  skipBtn.onclick = skipExercise;
  document.getElementById('exercise-container').appendChild(skipBtn);
  // H7: auto-play listening exercises so users actually hear before typing
  if (ex.type === 'listening' && ex.audio) {
    setTimeout(() => speakText(ex.audio), 350);
  }
  // M14 — attach keyboard handler for MC exercises
  if (ex.type === 'multiple_choice') {
    attachMCKeyHandler();
  }
}
