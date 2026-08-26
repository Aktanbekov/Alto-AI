/* Evaluator view. Three states, all deliberate:
   1. backend up      -> POST /api/evaluate and render the evaluation
   2. no backend      -> static hosting; explain plainly and keep the page useful
   3. backend erroring -> surface the real API message (a credit error should
                          read "add credits", never "something went wrong") */

import { store, resolveHash } from './app.js';

let backend = { available: false, reason: 'not checked' };

const SEED_QUESTIONS = [
  'Why did you choose this university?',
  'Who is sponsoring your education?',
  'What will you do after graduation?',
];

function qaRow(question = '', answer = '') {
  const wrap = document.createElement('div');
  wrap.className = 'qa-pair';
  wrap.innerHTML = `
    <label class="fl">Question</label>
    <input type="text" class="qa-q" style="width:100%;margin-bottom:8px">
    <label class="fl">Your planned answer</label>
    <textarea class="qa-a"></textarea>`;
  wrap.querySelector('.qa-q').value = question;
  wrap.querySelector('.qa-a').value = answer;
  return wrap;
}

const POSTGRAD = new Set(['Masters', 'MBA', 'PhD']);

function syncPriorField() {
  const level = document.getElementById('p-degree').value;
  const wrap = document.getElementById('prev-field-wrap');
  const show = POSTGRAD.has(level);
  wrap.classList.toggle('hidden', !show);
  if (!show) document.getElementById('p-major').value = '';
}

function collect() {
  const val = (id) => document.getElementById(id).value.trim();
  const answers = [...document.querySelectorAll('.qa-pair')].map((n) => ({
    question: n.querySelector('.qa-q').value.trim(),
    answer: n.querySelector('.qa-a').value.trim(),
  })).filter((qa) => qa.question && qa.answer);
  return {
    consulate_city: val('p-city'), consulate_country: val('p-country'),
    university: val('p-uni'), course: val('p-course'),
    // Distinct from `course`: what they already studied, not what they will study.
    major: val('p-major'),
    degree_level: val('p-degree'), gpa: val('p-gpa'),
    // Without the scale a bare number is ambiguous: 3.5/4 is strong, 3.5/10 is weak.
    gpa_scale: document.getElementById('p-gpa-scale').value || null,
    work_experience: val('p-work'), funding_source: val('p-funding'),
    attempt_number: Number(val('p-attempt')) || 1,
    planned_answers: answers,
  };
}

async function checkBackend() {
  try {
    const res = await fetch('api/health', { signal: AbortSignal.timeout(2500) });
    if (!res.ok) throw new Error(`health ${res.status}`);
    const data = await res.json();
    backend = { available: !!data.api_key_configured, reason: data.detail || '' };
  } catch {
    backend = { available: false, reason: 'no-backend' };
  }
  renderStatus();
}

/* The corpus is ~97% Indian consulates, so comparables for other countries are
   thin. Applicants deserve to know that before reading the output. */
function renderCorpusFit() {
  const host = document.getElementById('ev-fit');
  if (!host) return;
  const country = document.getElementById('p-country').value.trim().toLowerCase();
  const indian = !country || country === 'india';
  host.innerHTML = indian ? '' : `<div class="note"><strong>Limited comparables for your country.</strong>
    Most interviews in this dataset are from Indian consulates, and their GPAs are on a
    10-point scale. Your answers are still evaluated, but the statistics and retrieved
    examples come mainly from Indian applicants — weigh them accordingly.</div>`;
}

function renderStatus() {
  const host = document.getElementById('ev-status');
  if (backend.available) {
    host.innerHTML = `<div class="note">Connected to the local evaluator. Your answers are
      scored against comparable interviews from the corpus.</div>`;
    return;
  }
  if (backend.reason === 'no-backend') {
    host.innerHTML = `<div class="note"><strong>Read-only mode.</strong> This page is served as a
      static site, so answers cannot be scored here. The dashboard, explorer, and question bank
      all work fully. To score answers, run <code>visa-llm serve</code> locally and open the page
      it prints.</div>`;
  } else {
    host.innerHTML = `<div class="note error"><strong>The evaluator is not configured.</strong>
      ${backend.reason || 'No API key was found on the server.'} Set <code>ANTHROPIC_API_KEY</code>
      and restart <code>visa-llm serve</code>.</div>`;
  }
}

function esc(s) {
  const d = document.createElement('div');
  d.textContent = s ?? '';
  return d.innerHTML;
}

async function renderEvaluation(ev) {
  const host = document.getElementById('ev-result');
  const verdictColour = (v) =>
    v === 'strong' ? 'var(--pos)' : v === 'weak' ? 'var(--neg)' : 'var(--ink-2)';

  const cited = await Promise.all((ev.comparable_interviews || []).map(async (c) => {
    // Citations lead with a record hash; resolve it to a deep link when we can.
    const hash = String(c).split(/[\s—-]/)[0];
    const id = await resolveHash(hash);
    return id === null ? `<li>${esc(c)}</li>`
      : `<li><a href="#/interview/${id}">${esc(c)}</a></li>`;
  }));

  host.innerHTML = `
    <div class="card">
      <h2>Readiness: <span style="color:${verdictColour(ev.readiness === 'needs_work' ? 'weak' : ev.readiness)}">
        ${esc(ev.readiness.replace('_', ' '))}</span></h2>
      <p>${esc(ev.summary)}</p>
    </div>

    ${ev.answer_feedback?.length ? `<div class="card"><h2>Your answers</h2>
      ${ev.answer_feedback.map((f) => `
        <div class="fb">
          <div class="verdict" style="color:${verdictColour(f.verdict)}">${esc(f.verdict)}</div>
          <p style="font-weight:580;margin:4px 0 8px">${esc(f.question)}</p>
          ${f.strengths?.length ? `<ul>${f.strengths.map((s) => `<li>${esc(s)}</li>`).join('')}</ul>` : ''}
          ${f.risks?.length ? `<ul>${f.risks.map((s) => `<li style="color:var(--neg)">${esc(s)}</li>`).join('')}</ul>` : ''}
          <p style="margin-top:8px"><strong>Suggested:</strong> ${esc(f.suggested_revision)}</p>
        </div>`).join('')}</div>` : ''}

    ${ev.likely_questions?.length ? `<div class="card"><h2>Likely questions for your profile</h2>
      ${ev.likely_questions.map((q) => `
        <div class="fb">
          <div class="verdict">${esc(q.question_type.replace(/_/g, ' '))} · ${esc(q.asked_in_share)}</div>
          <p style="font-weight:560;margin:4px 0">“${esc(q.example_question)}”</p>
          <p class="sub" style="color:var(--ink-2)">${esc(q.why_likely)}</p>
          <p><strong>Prepare:</strong> ${esc(q.how_to_prepare)}</p>
        </div>`).join('')}</div>` : ''}

    ${ev.risk_factors?.length ? `<div class="card"><h2>Risk factors</h2>
      ${ev.risk_factors.map((r) => `
        <div class="fb">
          <div class="verdict" style="color:${r.severity === 'high' ? 'var(--neg)' : 'var(--ink-2)'}">
            ${esc(r.severity)}</div>
          <p style="font-weight:560">${esc(r.factor)}</p>
          <p class="sub" style="color:var(--ink-2)">${esc(r.evidence)}</p>
        </div>`).join('')}</div>` : ''}

    ${cited.length ? `<div class="card"><h2>Interviews this drew on</h2><ul>${cited.join('')}</ul></div>` : ''}
    <div class="caveat">${esc(ev.caveat)}</div>`;
}

async function submit(e) {
  e.preventDefault();
  const profile = collect();
  const btn = document.getElementById('ev-submit');
  const host = document.getElementById('ev-result');

  if (!profile.planned_answers.length) {
    host.innerHTML = '<div class="note error">Add at least one question and answer first.</div>';
    return;
  }
  // A bare number is unusable: 3.5 is strong out of 4 and weak out of 10.
  if (profile.gpa && !profile.gpa_scale) {
    host.innerHTML = `<div class="note error"><strong>Pick your grading scale.</strong>
      A GPA on its own is ambiguous — 3.5 out of 4 is strong, 3.5 out of 10 is not.
      Choose the scale your institution uses, or clear the GPA field.</div>`;
    document.getElementById('p-gpa-scale').focus();
    return;
  }
  if (!backend.available) { renderStatus(); return; }

  btn.disabled = true;
  host.innerHTML = '<div class="note"><span class="spinner"></span> Retrieving comparable interviews and evaluating…</div>';
  try {
    const res = await fetch('api/evaluate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(profile),
    });
    const data = await res.json();
    if (!res.ok) {
      // Show what the API actually said, not a generic failure.
      host.innerHTML = `<div class="note error"><strong>Evaluation failed.</strong>
        ${esc(data.detail || res.statusText)}</div>`;
      return;
    }
    await renderEvaluation(data);
  } catch (err) {
    host.innerHTML = `<div class="note error"><strong>Could not reach the evaluator.</strong> ${esc(err.message)}</div>`;
  } finally {
    btn.disabled = false;
  }
}

export function initEvaluate() {
  const list = document.getElementById('qa-list');
  SEED_QUESTIONS.forEach((q) => list.appendChild(qaRow(q)));
  document.getElementById('add-qa').addEventListener('click', () => list.appendChild(qaRow()));
  document.getElementById('ev-form').addEventListener('submit', submit);

  // Prefill the consulate list from the corpus so the field matches the facets.
  const cities = [...new Set(store.index.map((r) => r.c).filter(Boolean))].sort();
  const input = document.getElementById('p-city');
  const dl = document.createElement('datalist');
  dl.id = 'city-list';
  dl.innerHTML = cities.map((c) => `<option value="${c}">`).join('');
  document.body.appendChild(dl);
  input.setAttribute('list', 'city-list');

  document.getElementById('p-degree').addEventListener('change', syncPriorField);
  syncPriorField();
  document.getElementById('p-country').addEventListener('input', renderCorpusFit);
  renderCorpusFit();
  checkBackend();
}
