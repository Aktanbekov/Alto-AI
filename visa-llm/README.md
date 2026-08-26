# visa-llm

Turns Telegram F-1 visa interview reviews into a structured dataset, a
statistics report, and a grounded answer evaluator for applicants.

The evaluator does not guess from an LLM's priors: every number it cites comes
from precomputed corpus statistics, and every behavioural claim is backed by
retrieved real interviews that are shown to the model in the prompt.

## Pipeline

```bash
visa-llm ingest      # Telegram JSON exports -> filtered, deduped reviews.jsonl
visa-llm extract     # reviews -> structured records (interviews.parquet)
visa-llm analyze     # question taxonomy + stats.json + report.md/html
visa-llm index       # sentence-transformer embeddings -> data/processed/index
visa-llm export-web  # static JSON for the frontend -> web/data/
visa-llm evaluate examples/profile_example.yaml
```

Each stage writes to `data/` and can be re-run independently.

### Current corpus

Three channel exports (77 MB) → **16,204 unique reviews**, 15,154 with a clear
outcome, spanning 2020-10 to 2026-08.

| Stage | Result |
|---|---|
| ingest | 18,218 messages → 16,204 unique reviews (341 duplicates dropped) |
| extract | 94.2% outcome known, 90.0% with transcript — no LLM needed |
| analyze | 122,127 officer turns classified into 37 question types (76% matched) |
| index | 16,169 records embedded, 384-dim |

`extract` is fully deterministic. The optional `extract-llm` stage sends only
the 2,530-record residue (missing outcome or transcript) through the Batches
API — about **$8** at Opus 5 pricing:

```bash
visa-llm extract-llm --dry-run          # cost estimate, submits nothing
visa-llm extract-llm                    # submit the batch
visa-llm extract-llm-collect <batch_id> # collect + merge into the parquet
```

## Evaluating a profile

Write a YAML profile (see `examples/profile_example.yaml`) with the applicant's
own facts and the answers they plan to give, then:

```bash
visa-llm evaluate examples/profile_example.yaml
```

Inspect the exact prompt without spending anything:

```bash
visa-llm evaluate examples/profile_example.yaml --dry-run
```

Retrieval filters hard on consulate, country, and degree level before ranking by
cosine similarity, and reserves slots for **rejected** interviews — a model shown
only approvals learns nothing about what sinks a case. A filter that would leave
fewer than 40 comparable records is relaxed rather than applied.

### API key

Put your key in a `.env` file at the project root — it then works in every terminal,
and survives closing the tab (a bare `export` does not):

```bash
cp .env.example .env
```

Then edit `.env` and set `ANTHROPIC_API_KEY=...`. Every command loads it
automatically. `.env` is gitignored; never commit a real key.

A key exported in your shell takes precedence over the file, which is what you want
for a one-off override or for CI.

Verify it is being picked up:

```bash
curl -s localhost:8000/api/health
```

Uses `claude-opus-5` with structured outputs and a cached system + statistics prefix,
so repeat runs for the same student are cheap.

## Web frontend

Four views over the same data, served as a static site with no build step and no
framework:

| View | What it does | Needs a backend? |
|---|---|---|
| **Dashboard** | Approval share by consulate, degree, attempt and year, plus the question-impact chart | No |
| **Explorer** | Search all 16,204 interviews and read full transcripts | No |
| **Question bank** | 37 question types with real phrasings from the corpus | No |
| **Evaluate** | Score your planned answers | Yes |

Build the data and serve it:

```bash
visa-llm export-web
visa-llm serve
```

`serve` hosts the frontend *and* the evaluator API at http://127.0.0.1:8000. For the
three read-only views any static host works — `python3 -m http.server --directory web`
locally, or GitHub Pages / Netlify for free hosting. The evaluator detects that no
backend is present and says so plainly rather than appearing broken.

### How the data reaches the browser

The searchable index for all 16,204 records gzips to **193 KB**, so it ships whole and
search runs entirely client-side with no server round-trips. Transcripts are 25× larger,
so they are split into 64 shards fetched only when a record is opened — a record's shard
is `id % 64`, derivable in the browser, so no lookup table is shipped.

### Design notes

Charts are hand-written inline SVG — no charting library, no CDN, so the site works
offline and under a strict CSP. Colors were validated rather than eyeballed: the
obvious green/red for approved/rejected **fails** colorblind separation (ΔE 4.1 deutan),
so the palette uses blue↔red, which passes in both light and dark mode (ΔE 23.8 / 19.2).

Three presentation rules are deliberate, because misreading this data has real cost:
the self-selection caveat sits on the dashboard rather than in a footnote; the
question-impact chart carries its "causation runs backwards" explanation adjacent to
it; and cohorts under n=50 render de-emphasized with an explicit small-sample marker.
Outcome is never conveyed by color alone — every pill carries the word.

## Grading scales

The corpus is overwhelmingly Indian: **3,060 of the 3,158** records that state a GPA use
India's 10-point CGPA, and only 118 name their scale at all. A bare number in this
dataset therefore means "out of 10".

So the evaluator requires a scale alongside any GPA. `3.5` is strong out of 4 and weak
out of 10, and guessing wrong misjudges the applicant in the most consequential
direction. Supported scales are 4.0, 4.3, 5.0, 10, and percentage; an explicit scale
written into the value itself (`3.6/4`, `82%`) overrides the selector. Internally
[grading.py](src/visa_llm/grading.py) converts to percent-of-maximum so retrieval
compares like with like — a 3.5/4 applicant is matched against ~8.8/10 records rather
than against near-failing ones. That bridge is approximate, and the prompt says so
rather than implying an official conversion.

Applicants outside India also see a note in the evaluator: the statistics and retrieved
examples come mainly from Indian consulates, so comparables elsewhere are thin.

## What the data does and does not say

The corpus is **self-selected**: people who post reviews are not a random sample
of applicants, and approved applicants post more readily. The 87.2% approved
share describes posters, not the true consular base rate.

Question–outcome associations are correlational, and the causation usually runs
*backwards*: officers ask about prior refusals because a case is already
doubtful (−14.4 pp), and reach loan documentation because the interview is going
well (+7.1 pp). The evaluator's system prompt states this explicitly, and it
never predicts a decision or quotes an approval probability.

The evaluator refuses to help fabricate funding, sponsors, ties, or intent, and
every suggested revision must be truthful given the profile supplied.

## Layout

```
src/visa_llm/
├── ingest/     telegram_reader, review_filter, dedup
├── extract/    schema, template_parser (deterministic), llm_extractor (residue)
├── analytics/  taxonomy (37 question types), stats, report
├── rag/        embed, retrieve (filtered + outcome-balanced)
├── evaluator/  prompts, schema, evaluate
└── web/        export (static JSON), serve (FastAPI)

web/            index.html + css/ + js/ (dashboard, explorer, questions, evaluate)
```

## Development

```bash
uv venv && VIRTUAL_ENV=.venv uv pip install -e '.[rag,web,dev]'
.venv/bin/python -m pytest tests/ -q
```
