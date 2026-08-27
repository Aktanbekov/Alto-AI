/* Dashboard: stat tiles plus the five charts, redrawn on resize and theme change
   (SVG reads CSS custom properties at build time, so a theme flip needs a redraw). */

import { store } from './app.js';
import { barChart, divergingChart, lineChart, proportionBar, css, pct } from './charts.js';

const LABELS = {
  approved: 'Approved',
  rejected: 'Rejected',
  unknown: 'Not stated',
  administrative_processing_221g: '221(g) processing',
};

function tiles() {
  const { overall, meta } = store.stats;
  const host = document.getElementById('tiles');
  const withTranscript = store.manifest.n_with_transcript;
  const items = [
    { k: 'Interviews', v: meta.n_records.toLocaleString(), n: 'deduplicated reviews' },
    { k: 'With an outcome', v: overall.n_decided.toLocaleString(),
      n: `${Math.round((overall.n_decided / meta.n_records) * 100)}% of corpus` },
    { k: 'Approved share', v: pct(overall.approval_rate), n: 'among posters, not the true rate' },
    { k: 'Full transcripts', v: withTranscript.toLocaleString(), n: 'readable question by question' },
    { k: 'Years covered', v: (meta.year_range || []).join('–'), n: 'earliest to latest post' },
  ];
  host.innerHTML = items.map((i) => `
    <div class="tile"><div class="k">${i.k}</div><div class="v">${i.v}</div>
    <div class="n">${i.n}</div></div>`).join('');
}

function toRows(obj, limit = 12) {
  return Object.entries(obj || {})
    .map(([label, v]) => ({ label, ...v }))
    .sort((a, b) => b.n_decided - a.n_decided)
    .slice(0, limit);
}

function draw() {
  const s = store.stats;

  proportionBar('#c-outcomes', [
    { label: LABELS.approved, value: s.meta.outcome_counts.approved || 0, color: css('--pos') },
    { label: LABELS.rejected, value: s.meta.outcome_counts.rejected || 0, color: css('--neg') },
    { label: LABELS.administrative_processing_221g,
      value: s.meta.outcome_counts.administrative_processing_221g || 0, color: css('--ink-muted') },
    { label: LABELS.unknown, value: s.meta.outcome_counts.unknown || 0, color: css('--neutral') },
  ]);

  barChart('#c-city', toRows(s.by_city), { baseline: s.overall.approval_rate });
  barChart('#c-degree', toRows(s.by_degree));
  barChart('#c-attempt',
    toRows(s.by_attempt).map((r) => ({ ...r, label: `Attempt ${String(r.label).replace('.0', '')}` })));

  const years = Object.entries(s.by_year || {})
    .map(([label, v]) => ({ label: Number(label), value: v.approval_rate, n: v.n_decided }))
    .sort((a, b) => a.label - b.label);
  // Posting volume collapsed after 2023 (2022: 5,678 decided; 2025: 192), so
  // thin years are marked rather than presented as a trend.
  lineChart('#c-year', years, { thinBelow: 500 });

  // Show the types that actually carry signal; tiny-n rows would be noise.
  const qt = (s.question_types || [])
    .filter((q) => q.asked_in >= 150)
    .sort((a, b) => a.delta_vs_base - b.delta_vs_base);
  divergingChart('#c-delta', qt);
}

export function initDashboard() {
  tiles();
  draw();
  let t;
  addEventListener('resize', () => { clearTimeout(t); t = setTimeout(draw, 160); });
  addEventListener('themechange', draw);
}
