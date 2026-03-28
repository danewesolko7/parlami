// ── Speech Recognition wrapper ───────────────────────────────
let _recog = null;
let _listening = false;

function speechSupported() {
  return !!(window.SpeechRecognition || window.webkitSpeechRecognition);
}

function startListening(onResult, onError, onEnd, onStart) {
  if (_listening) stopListening();
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  _recog = new SR();
  _recog.lang = 'it-IT';
  _recog.continuous = true;
  _recog.interimResults = true;
  _recog.maxAlternatives = 5;

  let _finalTranscript = '';

  _recog.onstart = () => {
    if (onStart) onStart();
  };
  _recog.onresult = (e) => {
    // Accumulate all final segments; ignore interim results
    _finalTranscript = '';
    for (let i = 0; i < e.results.length; i++) {
      if (e.results[i].isFinal) {
        _finalTranscript += e.results[i][0].transcript;
      }
    }
  };
  _recog.onerror = (e) => {
    _listening = false;
    onError(e.error);
  };
  _recog.onend = () => {
    _listening = false;
    if (_finalTranscript.trim()) onResult([_finalTranscript.trim()]);
    onEnd();
  };

  _recog.start();
  _listening = true;
}

function stopListening() {
  if (_recog && _listening) {
    try { _recog.stop(); } catch(_) {}
  }
  _listening = false;
}

// ── Text normalization & similarity ─────────────────────────
// Strip accents, punctuation, lowercase — for lenient comparison
function normSpeak(text) {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // remove combining accent marks
    .replace(/[.,!?;:'"«»]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

// Jaccard-style word overlap: matches / max(|a|, |b|)
function speakSimilarity(spoken, expected) {
  const wa = normSpeak(spoken).split(' ').filter(Boolean);
  const wb = normSpeak(expected).split(' ').filter(Boolean);
  if (!wa.length || !wb.length) return 0;
  const setB = new Set(wb);
  const matches = wa.filter(w => setB.has(w)).length;
  return matches / Math.max(wa.length, wb.length);
}

// Best similarity across all recognition alternatives
function bestSimilarity(alts, expected) {
  return Math.max(...alts.map(a => speakSimilarity(a, expected)));
}
function bestMatch(alts, expected) {
  return alts.reduce((best, a) =>
    speakSimilarity(a, expected) >= speakSimilarity(best, expected) ? a : best
  , alts[0]);
}
