let currentExercises = [], currentIndex = 0, xp = 0, correct = 0, answered = false;
let selectedTopic = '', currentTopic = '', mistakes = [];
let hearts = 3;
const MAX_HEARTS = 3;
const PRAISE = ['Perfetto! 🎯','Esatto! 💪','Bravissimo! ⭐','Ottimo lavoro! 🔥','Sì, giusto! 🙌','Corretto! ✓'];
const ENCOURAGE = ['Non ancora — quasi!','Riprova la prossima volta! 💪','Quasi! Continua così.','Non mollare — ci sei quasi!'];

// ── Topic selector ───────────────────────────────────────────
function selectTopic(el, topic) {
  document.querySelectorAll('.tc').forEach(c => c.classList.remove('active'));
  el.classList.add('active');
  selectedTopic = topic;
  document.getElementById('custom-topic').value = '';
}

// ── Start generated lesson ───────────────────────────────────
async function startGeneratedLesson(lessonId) {
  const custom = document.getElementById('custom-topic').value.trim();
  const topic = custom || selectedTopic;
  if (!topic) { alert('Please select or type a topic first.'); return; }

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
      body: JSON.stringify({ topic })
    });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    const data = await r.json();
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

// ── Exercise rendering ───────────────────────────────────────
function hintHeader(typeLabel, hintText) {
  return `<div class="ex-header">
    <div class="ex-type">${typeLabel}</div>
    ${hintText ? `<button class="hint-btn" data-hint="${esc(hintText)}" onclick="revealHint(this)">💡 Hint</button>` : ''}
  </div>`;
}

function renderMC(ex) {
  return `<div class="exercise-card">
    ${hintHeader('Multiple choice', ex.hint)}
    <div class="ex-prompt">${escHtml(ex.prompt)}</div>
    ${ex.audio?`<div class="audio-section"><button class="play-btn" onclick="speakText('${esc(ex.audio)}')"><svg xmlns="http://www.w3.org/2000/svg" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><polygon points="5 3 19 12 5 21 5 3"/></svg></button><div style="font-size:13px;color:var(--text-muted)">Tap to hear the word</div></div>`:''}
    <div class="options-grid">${ex.options.map(o=>`<button class="opt" data-value="${esc(o)}" onclick="selectMC(this,'${esc(ex.answer)}')">${escHtml(o)}</button>`).join('')}</div>
  </div>
  <button class="check-btn" id="check-btn" disabled onclick="checkMC('${esc(ex.answer)}')">Check</button>`;
}

function renderFillBlank(ex) {
  return `<div class="exercise-card">
    ${hintHeader('Fill in the blank', ex.hint)}
    <div class="ex-prompt">${escHtml(ex.prompt)}</div>
    <input class="blank-input" id="blank-input" placeholder="${esc(ex.placeholder||'Type here...')}" oninput="enableIfFilled()" onkeydown="if(event.key==='Enter'&&!document.getElementById('check-btn').disabled)checkFill('${esc(ex.answer)}')" />
  </div>
  <button class="check-btn" id="check-btn" disabled onclick="checkFill('${esc(ex.answer)}')">Check</button>`;
}

function renderMatchPairs(ex) {
  const en = shuffle(ex.pairs.map(p=>p[1]));
  const it = shuffle(ex.pairs.map(p=>p[0]));
  window._pairs = ex.pairs; window._sel = null; window._matched = 0;
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

function renderTranslate(ex) {
  const bank = shuffle([...ex.words]);
  window._placed = []; window._transAnswer = ex.answer.toLowerCase();
  return `<div class="exercise-card">
    ${hintHeader('Translate the sentence', ex.hint)}
    <div class="ex-prompt">${escHtml(ex.prompt)}</div>
    <div class="ex-hint" style="font-size:16px;font-weight:500;color:var(--text);margin-bottom:16px">"${escHtml(ex.english)}"</div>
    <div class="sentence-area" id="sent-area"></div>
    <div class="word-bank" id="word-bank">${bank.map((w,i)=>`<button class="word-token" data-word="${esc(w)}" data-idx="${i}" onclick="placeWord(this)">${escHtml(w)}</button>`).join('')}</div>
    <button class="word-hint-btn" id="word-hint-btn" onclick="showWordHint()">💡 Show me the next word</button>
  </div>
  <button class="check-btn" id="check-btn" disabled onclick="checkTranslate()">Check</button>`;
}

function renderListening(ex) {
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
    <input class="blank-input" id="blank-input" placeholder="Type what you hear..." oninput="enableIfFilled()" onkeydown="if(event.key==='Enter'&&!document.getElementById('check-btn').disabled)checkListen('${esc(ex.answer)}')" />
  </div>
  <button class="check-btn" id="check-btn" disabled onclick="checkListen('${esc(ex.answer)}')">Check</button>`;
}

// ── Exercise interactions ────────────────────────────────────
let _mcSel = null;
function selectMC(btn, answer) {
  if (answered) return;
  document.querySelectorAll('.opt').forEach(b=>b.classList.remove('selected'));
  btn.classList.add('selected'); _mcSel = btn.dataset.value;
  const cb = document.getElementById('check-btn');
  cb.disabled = false; cb.onclick = ()=>checkMC(answer);
}
function checkMC(answer) {
  if (answered) { advanceExercise(); return; }
  answered = true;
  const ok = _mcSel === answer;
  document.querySelectorAll('.opt').forEach(b=>{ b.disabled=true; if(b.dataset.value===answer)b.classList.add('correct'); else if(b.classList.contains('selected')&&!ok)b.classList.add('wrong'); });
  trackWords(getExerciseWords(currentExercises[currentIndex]), ok);
  showFeedback(ok, answer, _mcSel);
}
function enableIfFilled() { const i=document.getElementById('blank-input'); if(i) document.getElementById('check-btn').disabled=i.value.trim().length===0; }
function checkFill(answer) {
  if (answered) { advanceExercise(); return; }
  answered = true;
  const i = document.getElementById('blank-input'); i.disabled = true;
  const userFill = i.value.trim();
  const ok = userFill.toLowerCase() === answer.toLowerCase();
  trackWord(answer, ok);
  i.classList.add(ok?'correct':'wrong'); showFeedback(ok, answer, userFill);
}
function checkListen(answer) {
  if (answered) { advanceExercise(); return; }
  answered = true;
  const i = document.getElementById('blank-input'); i.disabled = true;
  const userListen = i.value.trim();
  const val = userListen.toLowerCase().replace(/[.,!?;:]/g,'');
  const ok = val === answer.toLowerCase().replace(/[.,!?;:]/g,'');
  trackWords(answer.split(/\s+/).filter(w=>w.length>2), ok);
  i.classList.add(ok?'correct':'wrong'); showFeedback(ok, window._listenAudio, userListen);
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
  trackWords(window._transAnswer.split(/\s+/).filter(w=>w.length>2), ok);
  document.querySelectorAll('.word-token.placed').forEach(t=>{ t.style.pointerEvents='none'; t.style.borderColor=ok?'var(--green)':'var(--red)'; t.style.background=ok?'var(--green-light)':'var(--red-light)'; t.style.color=ok?'var(--green)':'var(--red)'; });
  showFeedback(ok, window._transAnswer, window._placed.map(x=>x.word).join(' '));
}

function showFeedback(ok, answer, userAnswer) {
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
  fb.innerHTML = `<div class="fb-icon">${ok?'✓':'✗'}</div><div><div class="fb-label">${msg}</div>${!ok&&answer?`<div class="fb-detail">Answer: <strong>${escHtml(answer)}</strong></div>`:`<div class="fb-detail">+10 XP</div>`}</div>`;
  const btn = document.getElementById('check-btn');
  btn.parentNode.insertBefore(fb, btn);
  btn.textContent = currentIndex < currentExercises.length-1 ? 'Next →' : 'Finish';
  btn.className = 'check-btn next'; btn.disabled = false; btn.onclick = advanceExercise;
}
function advanceExercise() { currentIndex++; if(currentIndex>=currentExercises.length){showComplete();return;} renderExercise(); }
function showComplete() {
  const acc = currentExercises.length>0?Math.round((correct/currentExercises.length)*100):0;
  document.getElementById('final-xp').textContent = xp+' XP';
  document.getElementById('final-acc').textContent = acc+'% correct';
  if (currentTopic) saveCompletion(currentTopic, xp, acc);
  if (mistakes.length > 0) {
    showMistakeReview();
  } else {
    showScreen('complete');
    const newBadges = checkNewAchievements();
    showAchievementToast(newBadges);
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
  if (hearts === 0) setTimeout(showNoHeartsOverlay, 700);
}
function showNoHeartsOverlay() {
  if (document.getElementById('no-hearts-overlay')) return;
  const overlay = document.createElement('div');
  overlay.className = 'no-hearts-overlay'; overlay.id = 'no-hearts-overlay';
  overlay.innerHTML = `<div class="no-hearts-card">
    <div class="no-hearts-emoji">💔</div>
    <div class="no-hearts-title">Out of hearts!</div>
    <div class="no-hearts-sub">You've used all your hearts. Keep going or take a break.</div>
    <div class="no-hearts-btns">
      <button class="check-btn" onclick="refillHearts()">Keep going →</button>
      <button class="check-btn" style="background:none;color:var(--text-muted);border:1.5px solid var(--border)" onclick="goHome()">Go home</button>
    </div>
  </div>`;
  document.body.appendChild(overlay);
}
function refillHearts() {
  const o = document.getElementById('no-hearts-overlay'); if (o) o.remove();
  hearts = MAX_HEARTS; renderHearts();
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

// ── Word hint (translate / reorder) ──────────────────────────
function showWordHint() {
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
  const hintBtn = document.getElementById('word-hint-btn');
  if (hintBtn) { hintBtn.disabled = true; hintBtn.textContent = '💡 Hint used'; }
}

function finishReview() {
  showScreen('complete');
  const newBadges = checkNewAchievements();
  showAchievementToast(newBadges);
}
function speakText(text) {
  if(!('speechSynthesis' in window)){alert('Speech not supported');return;}
  const u = new SpeechSynthesisUtterance(text); u.lang='it-IT'; u.rate=0.85;
  speechSynthesis.cancel(); speechSynthesis.speak(u);
}
function showScreen(name) { document.querySelectorAll('.screen').forEach(s=>s.classList.remove('active')); document.getElementById('screen-'+name).classList.add('active'); window.scrollTo(0,0); }
function goHome() { showScreen('home'); updateHomeProgress(); }

// ── New exercise renderers ────────────────────────────────────
function renderConjugation(ex) {
  // ex.verb, ex.tense, ex.rows: [{pronoun, answer}]
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
  trackWords(answers, allOk);
  showFeedback(allOk, answers.join(', '), userConjAnswers.join(', '));
}

function renderErrorCorrection(ex) {
  // ex.sentence (with error), ex.answer (corrected)
  return `<div class="exercise-card">
    ${hintHeader('Error correction', ex.hint)}
    <div class="ex-prompt">${escHtml(ex.prompt || 'Find and fix the error in this sentence:')}</div>
    <div class="error-sentence">${escHtml(ex.sentence)}</div>
    <input class="correction-input" id="blank-input" placeholder="Type the corrected sentence..."
      oninput="enableIfFilled()"
      onkeydown="if(event.key==='Enter'&&!document.getElementById('check-btn').disabled)checkFill('${esc(ex.answer)}')" />
  </div>
  <button class="check-btn" id="check-btn" disabled onclick="checkFill('${esc(ex.answer)}')">Check</button>`;
}

function renderReorder(ex) {
  // ex.words: shuffled array, ex.answer: correct sentence
  const words = shuffle([...ex.words]);
  window._placed = []; window._transAnswer = ex.answer.toLowerCase().replace(/[.,!?;:]/g, '');
  return `<div class="exercise-card">
    ${hintHeader('Reorder the words', ex.hint)}
    <div class="ex-prompt">${escHtml(ex.prompt || 'Put the words in the correct order:')}</div>
    <div class="reorder-area" id="sent-area"></div>
    <div class="word-bank" id="word-bank">${words.map((w, i) => `<button class="word-token" data-word="${esc(w)}" data-idx="${i}" onclick="placeWord(this)">${escHtml(w)}</button>`).join('')}</div>
    <button class="word-hint-btn" id="word-hint-btn" onclick="showWordHint()">💡 Show me the next word</button>
  </div>
  <button class="check-btn" id="check-btn" disabled onclick="checkTranslate()">Check</button>`;
}

// ── Speaking exercise ─────────────────────────────────────────
function renderSpeaking(ex) {
  window._speakAnswer = ex.answer;
  window._speakAudio  = ex.audio || ex.answer;
  window._speakHeard  = null;
  window._speakScore  = 0;

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
    </div>` : `<div class="speak-unsupported">🎙️ Speech recognition requires Chrome or Edge. <button class="speak-fallback-btn" onclick="showSpeakFallback()">Type instead</button></div>
    <div id="speak-fallback-area" style="display:none"><input class="blank-input" id="blank-input" placeholder="${esc(isTranslate ? 'Type the Italian...' : 'Type what you hear...')}" oninput="enableIfFilled()" onkeydown="if(event.key==='Enter'&&!document.getElementById('check-btn').disabled)checkSpeakFallback('${esc(ex.answer)}')" /></div>`}
  </div>
  <button class="check-btn" id="check-btn" disabled onclick="checkSpeaking()">Check</button>`;
}

function showSpeakFallback() {
  document.querySelector('.speak-unsupported').style.display = 'none';
  document.getElementById('speak-fallback-area').style.display = 'block';
  const btn = document.getElementById('check-btn');
  btn.onclick = () => checkSpeakFallback(window._speakAnswer);
}
function checkSpeakFallback(answer) {
  if (answered) { advanceExercise(); return; }
  answered = true;
  const i = document.getElementById('blank-input'); i.disabled = true;
  const userSpeak = i.value.trim();
  const ok = userSpeak.toLowerCase().replace(/[.,!?;:]/g,'') === answer.toLowerCase().replace(/[.,!?;:]/g,'');
  i.classList.add(ok ? 'correct' : 'wrong');
  showFeedback(ok, answer, userSpeak);
}

function startSpeaking() {
  if (!speechSupported()) return;
  document.getElementById('speak-idle').style.display = 'none';
  document.getElementById('speak-recording').style.display = 'flex';
  document.getElementById('speak-result').style.display = 'none';

  startListening(
    (alts) => {
      const score = bestSimilarity(alts, window._speakAnswer);
      window._speakHeard = bestMatch(alts, window._speakAnswer);
      window._speakScore = score;
      showSpeakResult();
    },
    (err) => {
      document.getElementById('speak-recording').style.display = 'none';
      document.getElementById('speak-idle').style.display = 'flex';
      if (err !== 'no-speech') {
        const lbl = document.querySelector('.speak-label');
        if (lbl) lbl.textContent = 'Could not hear you — try again';
      }
    },
    () => {
      // onend fires after result or error
      document.getElementById('speak-recording').style.display = 'none';
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

function checkSpeaking() {
  if (answered) { advanceExercise(); return; }
  if (window._speakHeard === null) return; // no result yet
  answered = true;
  const ok = window._speakScore >= 0.6;
  trackWords((window._speakAnswer || '').split(/\s+/).filter(w => w.length > 2), ok);
  showFeedback(ok, ok ? '' : window._speakAudio, window._speakHeard || '');
}

// ── Patch renderExercise to include new types ─────────────────
const _origRenders = { multiple_choice: renderMC, fill_blank: renderFillBlank, match_pairs: renderMatchPairs, translate: renderTranslate, listening: renderListening, conjugation: renderConjugation, error_correction: renderErrorCorrection, reorder: renderReorder, speaking: renderSpeaking };
function renderExercise() {
  if (currentIndex >= currentExercises.length) { showComplete(); return; }
  const ex = currentExercises[currentIndex];
  answered = false;
  document.getElementById('progress-fill').style.width = Math.round((currentIndex / currentExercises.length) * 100) + '%';
  document.getElementById('xp-counter').textContent = xp + ' XP';
  document.getElementById('exercise-container').innerHTML = (_origRenders[ex.type] || renderMC)(ex);
}
