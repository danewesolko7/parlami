const API = window.location.origin;

async function apiFetch(path) {
  const r = await fetch(API + path);
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return r.json();
}

async function lookupWord() {
  const word = document.getElementById('dict-input').value.trim();
  if (!word) return;
  const el = document.getElementById('dict-result');
  el.style.display = 'block';
  el.innerHTML = '<div style="color:var(--text-muted);font-size:13px;padding:4px 0">Looking up...</div>';
  try {
    const data = await apiFetch(`/api/define/${encodeURIComponent(word)}`);
    if (!data.definitions || data.definitions.length === 0) {
      el.innerHTML = `<div style="color:var(--text-muted);font-size:13px;padding:4px 0">No definition found for "<strong>${escHtml(word)}</strong>"</div>`;
      return;
    }
    el.innerHTML = `
      <div class="dict-word">${escHtml(data.word)}</div>
      ${data.definitions.map(s => `
        <div class="dict-pos">${escHtml(s.partOfSpeech)}</div>
        ${s.definitions.map(d => `
          <div class="dict-def">${escHtml(d.definition)}</div>
          ${d.examples.map(e => `<div class="dict-example">"${escHtml(e)}"</div>`).join('')}
        `).join('')}
      `).join('')}`;
  } catch(e) {
    el.innerHTML = `<div style="color:var(--red);font-size:13px;padding:4px 0">Error: ${e.message}</div>`;
  }
}

async function searchSentences() {
  const q = document.getElementById('sent-input').value.trim();
  if (!q) return;
  const el = document.getElementById('sentences-result');
  el.innerHTML = '<div style="color:var(--text-muted);font-size:13px;padding:4px 0">Searching Tatoeba...</div>';
  try {
    const data = await apiFetch(`/api/sentences?q=${encodeURIComponent(q)}&limit=8`);
    if (!data.sentences || data.sentences.length === 0) {
      el.innerHTML = '<div style="color:var(--text-muted);font-size:13px;padding:4px 0">No sentences found.</div>';
      return;
    }
    el.innerHTML = data.sentences.map(s => `
      <div class="sent-card">
        <div class="sent-italian">${escHtml(s.italian)}</div>
        <div class="sent-english">${escHtml(s.english)}</div>
      </div>`).join('');
  } catch(e) {
    el.innerHTML = `<div style="color:var(--red);font-size:13px;">Error: ${e.message}</div>`;
  }
}
