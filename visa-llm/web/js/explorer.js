/* Explorer: client-side search over the whole index, with transcripts fetched
   lazily per record. No server round-trips. */

import { store, loadTranscript } from './app.js';

const PAGE = 50;
const state = { q: '', outcome: '', city: '', degree: '', year: '', transcript: true, shown: PAGE };

const OUTCOME_LABEL = {
  approved: 'Approved', rejected: 'Rejected',
  administrative_processing_221g: '221(g)', unknown: 'Not stated',
};
const pillClass = (o) => (o === 'approved' ? 'approved' : o === 'rejected' ? 'rejected' : 'other');

function options(select, values, current) {
  const keep = select.querySelector('option').outerHTML;
  select.innerHTML = keep + values
    .map((v) => `<option value="${v}"${v === current ? ' selected' : ''}>${v}</option>`).join('');
}

function buildFilters() {
  const uniq = (key) => [...new Set(store.index.map((r) => r[key]).filter(Boolean))];
  options(document.getElementById('f-outcome'),
    [...new Set(store.index.map((r) => r.o))].map((o) => o), state.outcome);
  options(document.getElementById('f-city'), uniq('c').sort(), state.city);
  options(document.getElementById('f-degree'), uniq('d').sort(), state.degree);
  options(document.getElementById('f-year'), uniq('y').sort((a, b) => b - a), state.year);
}

function matches(r) {
  if (state.outcome && r.o !== state.outcome) return false;
  if (state.city && r.c !== state.city) return false;
  if (state.degree && r.d !== state.degree) return false;
  if (state.year && String(r.y) !== state.year) return false;
  if (state.transcript && !r.n) return false;
  if (state.q) {
    const hay = `${r.u || ''} ${r.co || ''} ${r.c || ''} ${r.rc || ''}`.toLowerCase();
    if (!state.q.split(/\s+/).every((term) => hay.includes(term))) return false;
  }
  return true;
}

function render() {
  const hits = store.index.filter(matches);
  document.getElementById('count').textContent =
    `${hits.length.toLocaleString()} interviews${hits.length > state.shown ? ` — showing ${state.shown}` : ''}`;

  const rows = hits.slice(0, state.shown);
  document.getElementById('rows').innerHTML = rows.map((r) => `
    <div class="row-item" data-id="${r.id}">
      <span class="t">${r.u || '<span style="color:var(--ink-muted)">University not stated</span>'}</span>
      <span class="m">${[r.co, r.c || r.rc, r.y].filter(Boolean).join(' · ')}</span>
      <span class="sp">
        ${r.n ? `<span class="m">${r.n} turn${r.n === 1 ? '' : 's'}</span>` : ''}
        <span class="pill ${pillClass(r.o)}">${OUTCOME_LABEL[r.o] || r.o}</span>
      </span>
    </div>`).join('') || '<div class="card">No interviews match these filters.</div>';

  document.getElementById('more').classList.toggle('hidden', hits.length <= state.shown);
  document.querySelectorAll('.row-item').forEach((node) => {
    node.addEventListener('click', () => openRecord(Number(node.dataset.id)));
  });
}

export async function openRecord(id) {
  const meta = store.index.find((r) => r.id === id);
  const dlg = document.getElementById('detail');
  const body = document.getElementById('d-body');
  document.getElementById('d-title').textContent = meta?.u || 'Interview';
  document.getElementById('d-pill').innerHTML = meta
    ? `<span class="pill ${pillClass(meta.o)}">${OUTCOME_LABEL[meta.o] || meta.o}</span>` : '';
  body.innerHTML = '<p class="sub"><span class="spinner"></span> Loading transcript…</p>';
  if (!dlg.open) dlg.showModal();

  const rec = await loadTranscript(id);
  if (!rec) {
    body.innerHTML = '<p>No transcript was recorded for this interview.</p>';
    return;
  }
  const facts = [
    ['Consulate', rec.city], ['Course', rec.course], ['Degree', meta?.d],
    ['GPA', rec.gpa], ['Work', rec.work], ['Funding', rec.funding],
    ['Scholarship', rec.scholarship], ['Attempt', rec.attempt], ['Date', rec.date],
  ].filter(([, v]) => v !== null && v !== undefined && v !== '');

  body.innerHTML = `
    <div class="kv">${facts.map(([k, v]) => `<span><strong>${k}:</strong> ${v}</span>`).join('')}</div>
    <div class="transcript">
      ${rec.turns.map((t) => `
        ${t.q ? `<div class="turn vo"><span class="who">VO</span><span class="txt"></span></div>` : ''}
        ${t.a ? `<div class="turn me"><span class="who">ME</span><span class="txt"></span></div>` : ''}
      `).join('')}
    </div>
    ${rec.tips ? `<div class="note" style="margin-top:14px"><strong>Poster's tips:</strong> <span id="tips"></span></div>` : ''}`;

  // Transcript text is user-generated: insert as text, never as HTML.
  const slots = body.querySelectorAll('.turn .txt');
  let i = 0;
  rec.turns.forEach((t) => {
    if (t.q) slots[i++].textContent = t.q;
    if (t.a) slots[i++].textContent = t.a;
  });
  if (rec.tips) body.querySelector('#tips').textContent = rec.tips;
}

export function initExplorer() {
  buildFilters();
  const rerender = () => { state.shown = PAGE; render(); };
  const q = document.getElementById('q');
  let t;
  q.addEventListener('input', () => {
    clearTimeout(t);
    t = setTimeout(() => { state.q = q.value.trim().toLowerCase(); rerender(); }, 140);
  });
  for (const [id, key] of [['f-outcome', 'outcome'], ['f-city', 'city'],
                           ['f-degree', 'degree'], ['f-year', 'year']]) {
    document.getElementById(id).addEventListener('change', (e) => {
      state[key] = e.target.value; rerender();
    });
  }
  document.getElementById('f-transcript').addEventListener('change', (e) => {
    state.transcript = e.target.checked; rerender();
  });
  document.getElementById('f-reset').addEventListener('click', () => {
    Object.assign(state, { q: '', outcome: '', city: '', degree: '', year: '', transcript: true, shown: PAGE });
    q.value = '';
    ['f-outcome', 'f-city', 'f-degree', 'f-year'].forEach((id) => { document.getElementById(id).value = ''; });
    document.getElementById('f-transcript').checked = true;
    render();
  });
  document.getElementById('more').addEventListener('click', () => { state.shown += PAGE; render(); });
  render();
}
