/* Router, data loading, and shard cache. Everything is fetched from static
   JSON under data/, so the whole site works on any file host with no backend. */

import { initDashboard } from './dashboard.js';
import { initExplorer, openRecord } from './explorer.js';
import { initQuestions } from './questions.js';
import { initEvaluate } from './evaluate.js';

const VIEWS = ['dashboard', 'explorer', 'questions', 'evaluate'];
const cache = { shards: new Map() };

export const store = {
  index: null,
  stats: null,
  questions: null,
  manifest: null,
  hashmap: null,
};

async function getJSON(path) {
  const res = await fetch(path);
  if (!res.ok) throw new Error(`${path}: ${res.status}`);
  return res.json();
}

/* Transcripts are sharded; a record's shard is derivable from its id, so no
   lookup table is shipped. Each shard is fetched at most once. */
export async function loadTranscript(id) {
  const shard = id % 64;
  if (!cache.shards.has(shard)) {
    cache.shards.set(shard, getJSON(`data/transcripts/shard-${String(shard).padStart(2, '0')}.json`)
      .catch(() => ({})));
  }
  const data = await cache.shards.get(shard);
  return data[String(id)] || null;
}

/* Only the evaluator needs hash -> id resolution, and the map is incompressible,
   so it loads on demand rather than up front. */
export async function resolveHash(hash) {
  if (!store.hashmap) store.hashmap = await getJSON('data/hashmap.json').catch(() => ({}));
  const short = String(hash).slice(0, 12);
  return store.hashmap[short] ?? null;
}

function route() {
  const raw = location.hash.replace(/^#\/?/, '') || 'dashboard';
  const [name, arg] = raw.split('/');
  const view = VIEWS.includes(name) ? name : 'dashboard';

  VIEWS.forEach((v) => {
    document.getElementById(`view-${v}`).classList.toggle('active', v === view);
  });
  document.querySelectorAll('nav a').forEach((a) => {
    a.classList.toggle('active', a.dataset.view === view);
  });
  window.scrollTo(0, 0);

  // #/interview/<id> deep-links into the explorer and opens the record.
  if (name === 'interview' && arg !== undefined) {
    document.getElementById('view-explorer').classList.add('active');
    document.getElementById('view-dashboard').classList.remove('active');
    openRecord(Number(arg));
  }
}

function initTheme() {
  const saved = localStorage.getItem('theme');
  if (saved) document.documentElement.setAttribute('data-theme', saved);
  document.getElementById('theme-toggle').addEventListener('click', () => {
    const current = document.documentElement.getAttribute('data-theme');
    const isDark = current
      ? current === 'dark'
      : matchMedia('(prefers-color-scheme: dark)').matches;
    const next = isDark ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', next);
    localStorage.setItem('theme', next);
    window.dispatchEvent(new CustomEvent('themechange'));
  });
}

async function main() {
  initTheme();
  try {
    const [index, stats, questions, manifest] = await Promise.all([
      getJSON('data/index.json'),
      getJSON('data/stats.json'),
      getJSON('data/questions.json'),
      getJSON('data/manifest.json'),
    ]);
    Object.assign(store, { index, stats, questions, manifest });
  } catch (err) {
    document.querySelector('main').innerHTML =
      `<div class="card"><h2>Could not load data</h2><p class="sub">${err.message}</p>
       <p>Run <code>visa-llm export-web</code>, then serve this directory over HTTP
       (<code>python3 -m http.server</code>) — <code>file://</code> blocks fetch.</p></div>`;
    return;
  }

  initDashboard();
  initExplorer();
  initQuestions();
  initEvaluate();

  addEventListener('hashchange', route);
  route();
}

main();
