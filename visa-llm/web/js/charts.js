/* Inline-SVG charts. No library: these four forms cover every dashboard need,
   stay dependency-free, and read CSS custom properties so light/dark and the
   validated palette live in one place (css/style.css). */

const NS = 'http://www.w3.org/2000/svg';
const SMALL_N = 50; // cohorts below this are de-emphasised and marked

function el(name, attrs = {}, text) {
  const node = document.createElementNS(NS, name);
  for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, v);
  if (text !== undefined) node.textContent = text;
  return node;
}
const pct = (v) => `${(v * 100).toFixed(1)}%`;
const css = (name) => getComputedStyle(document.body).getPropertyValue(name).trim();

/* ------------------------------------------------------------- tooltip -- */
let tipEl = null;
function tip() {
  if (!tipEl) {
    tipEl = document.createElement('div');
    tipEl.className = 'tip';
    document.body.appendChild(tipEl);
  }
  return tipEl;
}
function showTip(evt, title, rows) {
  const t = tip();
  t.innerHTML = `<div class="t-title"></div>${rows.map(() => '<div class="t-row"></div>').join('')}`;
  t.querySelector('.t-title').textContent = title;
  t.querySelectorAll('.t-row').forEach((n, i) => { n.textContent = rows[i]; });
  t.style.opacity = '1';
  moveTip(evt);
}
function moveTip(evt) {
  const t = tip();
  const pad = 14;
  let x = evt.clientX + pad;
  let y = evt.clientY + pad;
  const r = t.getBoundingClientRect();
  if (x + r.width > window.innerWidth - 8) x = evt.clientX - r.width - pad;
  if (y + r.height > window.innerHeight - 8) y = evt.clientY - r.height - pad;
  t.style.left = `${x}px`;
  t.style.top = `${y}px`;
}
function hideTip() { if (tipEl) tipEl.style.opacity = '0'; }

function attachHover(node, title, rows) {
  // Hit target is the mark itself plus a transparent pad drawn by the caller.
  node.addEventListener('mouseenter', (e) => showTip(e, title, rows));
  node.addEventListener('mousemove', moveTip);
  node.addEventListener('mouseleave', hideTip);
}

/* --------------------------------------------------- horizontal bar chart --
   Approval rate by cohort. One measure, so one colour; n is always shown, and
   cohorts under SMALL_N are dimmed and flagged rather than silently plotted. */
export function barChart(target, rows, opts = {}) {
  const { valueKey = 'approval_rate', labelKey = 'label', nKey = 'n_decided',
          baseline = null, format = pct } = opts;
  const host = typeof target === 'string' ? document.querySelector(target) : target;
  host.innerHTML = '';
  if (!rows.length) return;

  const rowH = 30, gap = 6, padL = 132, padR = 62, padT = 8, padB = 26;
  const w = Math.max(host.clientWidth || 560, 340);
  const innerW = w - padL - padR;
  const h = padT + rows.length * (rowH + gap) + padB;
  const svg = el('svg', { viewBox: `0 0 ${w} ${h}`, width: w, height: h, role: 'img' });

  const max = Math.max(...rows.map((r) => r[valueKey]), baseline || 0) * 1.08;
  const x = (v) => (v / max) * innerW;

  // Gridlines every 20%, recessive.
  for (let g = 0; g <= max; g += 0.2) {
    const gx = padL + x(g);
    svg.appendChild(el('line', { x1: gx, x2: gx, y1: padT, y2: h - padB,
      stroke: css('--grid'), 'stroke-width': 1 }));
    svg.appendChild(el('text', { x: gx, y: h - padB + 15, 'text-anchor': 'middle',
      fill: css('--ink-muted'), 'font-size': 11 }, `${Math.round(g * 100)}%`));
  }

  rows.forEach((r, i) => {
    const y = padT + i * (rowH + gap);
    const small = r[nKey] !== undefined && r[nKey] < SMALL_N;
    const bw = Math.max(x(r[valueKey]), 2);

    svg.appendChild(el('text', {
      x: padL - 10, y: y + rowH / 2 + 4, 'text-anchor': 'end',
      fill: small ? css('--ink-muted') : css('--ink-2'), 'font-size': 12.5,
    }, r[labelKey] + (small ? ' *' : '')));

    const bar = el('rect', {
      x: padL, y, width: bw, height: rowH, rx: 4,
      fill: css('--pos'), opacity: small ? 0.45 : 1,
    });
    svg.appendChild(bar);
    attachHover(bar, r[labelKey], [
      `Approval share: ${format(r[valueKey])}`,
      `${r[nKey]?.toLocaleString() ?? '?'} decided interviews`,
      small ? 'Small sample — read with caution' : '',
    ].filter(Boolean));

    svg.appendChild(el('text', {
      x: padL + bw + 8, y: y + rowH / 2 + 4, fill: css('--ink-2'),
      'font-size': 12, 'font-weight': 600,
    }, format(r[valueKey])));
  });

  if (baseline !== null) {
    const bx = padL + x(baseline);
    svg.appendChild(el('line', { x1: bx, x2: bx, y1: padT, y2: h - padB,
      stroke: css('--ink-muted'), 'stroke-width': 2, 'stroke-dasharray': '4 3' }));
  }
  host.appendChild(svg);
}

/* ------------------------------------------------------- diverging chart --
   The signature visual: question types by approval delta vs the corpus base.
   Two hues either side of a neutral zero line — never a rainbow. */
export function divergingChart(target, rows, opts = {}) {
  const { valueKey = 'delta_vs_base', labelKey = 'question_type', nKey = 'asked_in' } = opts;
  const host = typeof target === 'string' ? document.querySelector(target) : target;
  host.innerHTML = '';
  if (!rows.length) return;

  const rowH = 22, gap = 4, padL = 168, padR = 58, padT = 22, padB = 26;
  const w = Math.max(host.clientWidth || 620, 380);
  const innerW = w - padL - padR;
  const h = padT + rows.length * (rowH + gap) + padB;
  const svg = el('svg', { viewBox: `0 0 ${w} ${h}`, width: w, height: h, role: 'img' });

  const maxAbs = Math.max(...rows.map((r) => Math.abs(r[valueKey]))) * 1.12;
  const mid = padL + innerW / 2;
  const x = (v) => (v / maxAbs) * (innerW / 2);

  svg.appendChild(el('text', { x: mid - 8, y: 13, 'text-anchor': 'end',
    fill: css('--ink-muted'), 'font-size': 11 }, 'lower approval'));
  svg.appendChild(el('text', { x: mid + 8, y: 13, fill: css('--ink-muted'),
    'font-size': 11 }, 'higher approval'));

  rows.forEach((r, i) => {
    const y = padT + i * (rowH + gap);
    const v = r[valueKey];
    const bw = Math.max(Math.abs(x(v)), 1.5);
    const bx = v >= 0 ? mid : mid - bw;

    svg.appendChild(el('text', { x: padL - 10, y: y + rowH / 2 + 4, 'text-anchor': 'end',
      fill: css('--ink-2'), 'font-size': 12 }, r[labelKey].replace(/_/g, ' ')));

    const bar = el('rect', { x: bx, y, width: bw, height: rowH, rx: 3,
      fill: v >= 0 ? css('--pos') : css('--neg') });
    svg.appendChild(bar);
    attachHover(bar, r[labelKey].replace(/_/g, ' '), [
      `${v >= 0 ? '+' : ''}${(v * 100).toFixed(1)} pp vs corpus base`,
      `Asked in ${r[nKey]?.toLocaleString()} interviews`,
      `Approval when asked: ${pct(r.approval_rate_when_asked)}`,
    ]);

    // Long bars carry their value inside; only short ones hang it outside,
    // so the longest bar can never collide with the category label.
    const inside = bw > 40;
    const lx = inside
      ? (v >= 0 ? bx + bw - 6 : bx + 6)
      : (v >= 0 ? bx + bw + 6 : bx - 6);
    const anchor = inside ? (v >= 0 ? 'end' : 'start') : (v >= 0 ? 'start' : 'end');
    svg.appendChild(el('text', {
      x: lx, y: y + rowH / 2 + 4, 'text-anchor': anchor,
      fill: inside ? css('--surface') : css('--ink-2'),
      'font-size': 11.5, 'font-weight': inside ? 600 : 400,
      'font-variant-numeric': 'tabular-nums',
    }, `${v >= 0 ? '+' : ''}${(v * 100).toFixed(1)}`));
  });

  // Zero line last so it sits above the bars.
  svg.appendChild(el('line', { x1: mid, x2: mid, y1: padT - 4, y2: h - padB,
    stroke: css('--axis'), 'stroke-width': 2 }));
  host.appendChild(svg);
}

/* ------------------------------------------------------------- line chart --
   Approval share over time. Years whose sample is thin are drawn dashed with a
   hollow marker: posting volume collapsed after 2023, so the late points swing
   on very few records and must not read as a trend. */
export function lineChart(target, points, opts = {}) {
  const { thinBelow = 0 } = opts;
  const host = typeof target === 'string' ? document.querySelector(target) : target;
  host.innerHTML = '';
  if (points.length < 2) return;

  const padL = 46, padR = 20, padT = 14, padB = 30;
  const w = Math.max(host.clientWidth || 560, 320);
  const h = 230;
  const innerW = w - padL - padR, innerH = h - padT - padB;
  const svg = el('svg', { viewBox: `0 0 ${w} ${h}`, width: w, height: h, role: 'img' });

  const vals = points.map((p) => p.value);
  const lo = Math.max(0, Math.min(...vals) - 0.08);
  const hi = Math.min(1, Math.max(...vals) + 0.08);
  const x = (i) => padL + (i / (points.length - 1)) * innerW;
  const y = (v) => padT + innerH - ((v - lo) / (hi - lo)) * innerH;

  for (let g = 0; g <= 4; g++) {
    const v = lo + ((hi - lo) * g) / 4;
    svg.appendChild(el('line', { x1: padL, x2: w - padR, y1: y(v), y2: y(v),
      stroke: css('--grid'), 'stroke-width': 1 }));
    svg.appendChild(el('text', { x: padL - 8, y: y(v) + 4, 'text-anchor': 'end',
      fill: css('--ink-muted'), 'font-size': 11 }, `${Math.round(v * 100)}%`));
  }

  const thin = (p) => thinBelow > 0 && (p.n ?? Infinity) < thinBelow;
  const solid = [], dashed = [];
  points.forEach((p, i) => {
    (thin(p) ? dashed : solid).push([x(i), y(p.value)]);
    // Bridge the gap so the dashed run connects to the last solid point.
    if (thin(p) && dashed.length === 1 && i > 0) dashed.unshift([x(i - 1), y(points[i - 1].value)]);
  });
  const path = (pts) => pts.map((p, i) => `${i ? 'L' : 'M'}${p[0]},${p[1]}`).join(' ');
  if (solid.length > 1) svg.appendChild(el('path', { d: path(solid), fill: 'none',
    stroke: css('--pos'), 'stroke-width': 2, 'stroke-linejoin': 'round' }));
  if (dashed.length > 1) svg.appendChild(el('path', { d: path(dashed), fill: 'none',
    stroke: css('--pos'), 'stroke-width': 2, 'stroke-dasharray': '5 4' }));

  points.forEach((p, i) => {
    const isThin = thin(p);
    const dot = el('circle', { cx: x(i), cy: y(p.value), r: 5,
      fill: isThin ? css('--surface') : css('--pos'),
      stroke: css('--pos'), 'stroke-width': 2 });
    svg.appendChild(dot);
    attachHover(dot, String(p.label) + (isThin ? ' — thin sample' : ''),
      [`Approval share: ${pct(p.value)}`, `${p.n?.toLocaleString()} decided`,
       isThin ? 'Too few records to read as a trend' : '']. filter(Boolean));
    svg.appendChild(el('text', { x: x(i), y: h - padB + 16, 'text-anchor': 'middle',
      fill: css('--ink-muted'), 'font-size': 11 }, p.label));
  });
  host.appendChild(svg);
}

/* ------------------------------------------------------- proportion bar --
   Outcome mix as one stacked row. Segments carry a 2px surface gap and every
   segment is labelled in the legend — colour never carries meaning alone. */
export function proportionBar(target, segments) {
  const host = typeof target === 'string' ? document.querySelector(target) : target;
  host.innerHTML = '';
  const total = segments.reduce((s, x) => s + x.value, 0);
  if (!total) return;

  const w = Math.max(host.clientWidth || 560, 300), h = 34, gapPx = 2;
  const svg = el('svg', { viewBox: `0 0 ${w} ${h}`, width: w, height: h, role: 'img' });
  let cursor = 0;
  segments.forEach((s, i) => {
    const segW = (s.value / total) * w - (i < segments.length - 1 ? gapPx : 0);
    const rect = el('rect', { x: cursor, y: 0, width: Math.max(segW, 1), height: h,
      rx: 4, fill: s.color });
    svg.appendChild(rect);
    attachHover(rect, s.label,
      [`${s.value.toLocaleString()} interviews`, `${((s.value / total) * 100).toFixed(1)}% of corpus`]);
    cursor += (s.value / total) * w;
  });
  host.appendChild(svg);

  const legend = document.createElement('div');
  legend.className = 'legend';
  segments.forEach((s) => {
    const item = document.createElement('span');
    const swatch = document.createElement('i');
    swatch.style.background = s.color;
    item.appendChild(swatch);
    item.appendChild(document.createTextNode(
      `${s.label} — ${s.value.toLocaleString()} (${((s.value / total) * 100).toFixed(1)}%)`));
    legend.appendChild(item);
  });
  host.appendChild(legend);
}

export { pct, css, SMALL_N };
