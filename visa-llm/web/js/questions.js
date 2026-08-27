/* Question bank: the 37 canonical types with real phrasings from the corpus. */

import { store } from './app.js';

const state = { city: '', sort: 'freq' };

function deltaText(d) {
  const pp = (d * 100).toFixed(1);
  return `${d >= 0 ? '+' : ''}${pp} pp`;
}

function render() {
  let items = [...store.questions];

  if (state.city) {
    // Restrict to types actually asked at this consulate, ranked by local volume.
    items = items
      .map((q) => ({ ...q, local: (q.top_cities || []).find((c) => c.city === state.city) }))
      .filter((q) => q.local)
      .sort((a, b) => b.local.n - a.local.n);
  } else {
    items.sort((a, b) => (state.sort === 'delta'
      ? a.delta_vs_base - b.delta_vs_base
      : b.asked_in - a.asked_in));
  }

  document.getElementById('qlist').innerHTML = items.map((q) => {
    const name = q.question_type.replace(/_/g, ' ');
    const freq = state.city && q.local
      ? `asked in ${q.local.n.toLocaleString()} ${state.city} interviews`
      : `asked in ${(q.share_of_interviews * 100).toFixed(1)}% of interviews (${q.asked_in.toLocaleString()})`;
    const colour = q.delta_vs_base >= 0 ? 'var(--pos)' : 'var(--neg)';
    return `
      <details class="qt">
        <summary>
          <span class="name">${name}</span>
          <span class="freq">${freq}</span>
          <span class="delta" style="color:${colour}">${deltaText(q.delta_vs_base)}</span>
        </summary>
        <div class="body">
          <p class="sub" style="color:var(--ink-2)">
            Approval share when asked: <strong>${(q.approval_rate_when_asked * 100).toFixed(1)}%</strong>
            versus ${(store.stats.overall.approval_rate * 100).toFixed(1)}% overall.
            This is association, not cause — officers probe where they already have doubts.
          </p>
          ${q.examples?.length ? `<h3>Real phrasings from the corpus</h3><ul>${
            q.examples.map(() => '<li></li>').join('')}</ul>` : '<p class="sub">No short example phrasings captured.</p>'}
          ${q.top_cities?.length ? `<p class="sub" style="margin-top:10px;color:var(--ink-muted)">
            Most asked at: ${q.top_cities.map((c) => `${c.city} (${c.n.toLocaleString()})`).join(' · ')}</p>` : ''}
        </div>
      </details>`;
  }).join('') || '<div class="card">No question types for this filter.</div>';

  // Example questions come from user-posted text — insert as text, not HTML.
  document.querySelectorAll('#qlist .qt').forEach((node, i) => {
    const list = node.querySelectorAll('li');
    (items[i].examples || []).forEach((ex, j) => { if (list[j]) list[j].textContent = ex; });
  });
}

export function initQuestions() {
  const cities = [...new Set(store.questions.flatMap((q) => (q.top_cities || []).map((c) => c.city)))].sort();
  const sel = document.getElementById('q-city');
  sel.innerHTML = '<option value="">All consulates</option>' +
    cities.map((c) => `<option value="${c}">${c}</option>`).join('');
  sel.addEventListener('change', (e) => { state.city = e.target.value; render(); });
  document.getElementById('q-sort').addEventListener('change', (e) => {
    state.sort = e.target.value; render();
  });
  render();
}
