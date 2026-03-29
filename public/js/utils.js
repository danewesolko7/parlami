function shuffle(arr) { const a=[...arr]; for(let i=a.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]];}return a; }
// esc(s)     — escape for HTML *attribute* values (quotes only). Use inside onclick="..." or data-attr="..."
// escHtml(s) — escape for HTML *text content* (<, >, &, ", '). Use inside innerHTML text nodes.
// Rule: if the string goes INSIDE an attribute value → esc(). If it goes INTO visible text/HTML → escHtml().
function esc(s) { return (s||'').replace(/'/g,"\\'").replace(/"/g,'&quot;'); }
function escHtml(s) { return (s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;'); }
const attr = esc; // alias: use attr() for HTML attribute values
