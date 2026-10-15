# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

**Primary: anyone preparing for a US F-1 student visa interview.** There is no geographic focus. They are students who already have an admission, an I-20 and a booked interview slot, usually in the weeks before the appointment, after paying the SEVIS and MRV fees. The interview is spoken, in English, at a consulate window. It lasts about three minutes and four or five questions, and there is no appeal. Their job is to find out which of their answers will not survive the officer's follow-up question, and to fix those answers while they still can.

The corpus covers some consulates far better than others. Most country-tagged records come from Indian consulates (New Delhi, Mumbai, Hyderabad, Chennai, Kolkata), with a much smaller group from Tashkent and the UAE. Product scope is still all F-1 applicants. The thin coverage elsewhere is a limit of the evidence and does not narrow the audience.

**Secondary (internal):** the Altovisas operators, who use the admin panel at `/lev`. It covers users, interviews, questions, analytics, evaluator runs and a side-by-side model comparison.

## Product Purpose

Altovisas tells an F-1 applicant where their interview is likely to break, before it happens. The applicant gives a short profile (university, programme, funding, consulate) and answers three interview questions in their own words. The free profile check names the specific points where an officer is most likely to push back, the question likely to come next, and the corpus numbers behind each point. It takes about four minutes.

The product rests on one premise: most refused students do not have a bad case. They have a good case that they cannot yet explain under pressure. In three minutes at the window, a case that is stated badly looks the same as a weak one. Stating it well is the part the applicant controls.

Success means the student walks in knowing what is coming, with answers built from their own true facts that hold up through the second question.

**Business model:**
- **Free:** the full diagnosis. Running the check needs a free account (sign-in is required, by decision). Every account gets two free interview sets, and a short survey unlocks three more.
- **Paid (one-time payment, approaching launch):** "Your case, rebuilt". Altovisas works through each weak point, rebuilds the answer from facts the student supplies, then drills them by voice on the follow-ups.
- **Undecided:** the price.
- **Premium waitlist:** collects interest until the paid product ships.

## Positioning

Altovisas is the F-1 interview tool grounded in what actually happened at the window. It is built on 16,204 self-reported interview write-ups from 2020 to 2026. Students posted them publicly, then they were deduplicated, parsed question by question and classified into 37 question types. Roughly 200 more are added each month.

The evaluator does not guess from a language model's general knowledge:
- Every number it cites comes from precomputed corpus statistics.
- Every behavioural claim is backed by real retrieved interviews.
- Retrieval filters by consulate, country and degree level.
- Retrieval deliberately reserves slots for refused interviews, so the model sees what sinks a case and not only what passes.

A generic AI mock interviewer cannot truthfully claim any of this.

## Operating Context

- **Before the check:** the applicant has their profile facts to hand: university and programme, sponsor and sponsor's income or occupation, other admits, academic background, post-degree plan, and consulate.
- **Question areas the corpus shows most often:** funding and sponsor, sponsor income, other universities applied to, undergraduate background and grades, why this university and course, and plans after the degree. The mix varies by consulate.
- **The real interview is spoken.** People freeze on unexpected questions, and rehearsed-sounding answers are themselves a refusal signal. Planned voice drills are three minutes long on purpose: short and frequent practice beats one long rehearsal.
- **Corpus pipeline:** the corpus comes from public Telegram channel exports, processed by the `visa-llm` Python sidecar (ingest → extract → analyze → index → export-web).

## Capabilities and Constraints

**Live:**
- The profile check / evaluator at `/check-profile`, behind sign-in with a free account. The public sees one report per check. Only admins see the side-by-side comparison of the three AI models.
- The public corpus dashboard on the home page (`/#the-data`).
- FAQ, About, Terms and Privacy pages.
- Email and Google sign-in.
- The free-set, survey and waitlist access flow.
- The admin panel.

**Preview only, with no backend:**
- Voice Interview, Custom Case Builder and the Questions/Answers library.
- These ship with a "Soon" badge or a "Preview · not wired up yet" chip. The UI must never imply that they work.

**Legacy:** `/chat` and `/choose-level`, the earlier leveled chat interview, behind auth.

**Data honesty rules (fixed):**
- The corpus is self-selected and self-reported. Approval shares describe who chose to post. They are not consular approval rates.
- Associations in the data are correlational, not causal.
- Nothing predicts an individual outcome.
- Cells under 25 records are not reported.
- A retrieval filter that would leave fewer than 40 comparable records is relaxed rather than applied.

**Corpus figures:** the only figures allowed in marketing copy live in `CORPUS` in `frontend/src/seo/site.js`. They are checked against `visa-llm/web/data/stats.json` at build time.

**Single sources of truth for copy:**
- Per-route titles and descriptions: `frontend/src/seo/site.js`. They are baked into static HTML per route.
- FAQ: `frontend/src/data/faq.js`. It also generates the FAQPage JSON-LD, so the visible copy and the structured data must stay identical.

**Legal position (published in the Terms and FAQ):**
- Interview preparation, not legal or immigration advice.
- Not affiliated with the US Department of State, any consulate, or any government body.
- No guarantee of a visa.

**Facts are the user's own:**
- Suggestions cover structure only: what to lead with, what to leave out, how much detail to give.
- Altovisas does not write scripts and does not invent facts for a student. Misrepresenting a material fact at the window can mean a permanent bar.

**Scope:** F-1 student visas.

**Terminology in use:** profile check, interview set, weak point, comparable posts, interview write-ups / reports, refusal, officer, window, consulate, 221(g) administrative processing.

**Known stale material (predates the current positioning; do not treat as product truth):**
- `README.md`: describes a generic interview-practice app on GPT-3.5.
- The $29 / $59 / $119 tiers in `frontend/src/constants/pricing.js`, including "F1 & B2". Superseded by the single one-time payment. Only the unrouted `StrategyPage.jsx` still imports it.
- The Privacy Policy's "AI processing" section names one provider (Anthropic). Scoring sends answers to three (Claude, GPT and DeepSeek). The legal text needs updating; it has not been changed.

## Brand Commitments

- **Name:** Altovisas.
- **Domain:** www.altovisas.com.
- **Contact:** altovisas@gmail.com.
- **Logo:** `frontend/public/logo.svg` and `logo.png`. Social image: `frontend/public/og-image.png`.

**Voice: not settled.** The current direction is the home page copy: plain, candid and specific, with no hype. It explains the stakes concretely and closes with an explicit list of what the tool will not do. Treat it as the working direction, not a commitment.

## Evidence on Hand

**The corpus**
- 16,204 unique write-ups, October 2020 to August 2026. 15,154 have a known outcome; in those, 87.2% of posters report approval.
- Country-tagged, decided records:
  - India: 7,499
  - Uzbekistan: 165
  - UAE: 31
- About 122,000 officer turns, classified into 37 question types with real phrasings.
- Data files: `visa-llm/web/data/stats.json` and `visa-llm/web/data/questions.json`.

**Pages and components**
- The live corpus dashboard: `frontend/src/components/CorpusDashboard.jsx`.
- The illustrative "Profile check · sample" card on the home page. It is a sample, not a real user.

**Absent:** there are no testimonials, user counts, outcome or success-rate claims about Altovisas users, press, partnerships or endorsements. None of these may be fabricated or implied.

## Product Principles

1. **Every number traces to the corpus.** Any statistic shown must exist in the dataset and come with its caveat. A number that drifts from the data is worse than no number, because it is the one claim a reader can check.
2. **The diagnosis is free; payment buys the work.** The free check gives the complete weak-point read. The paid product sells the rebuild and the drilling, never a hidden verdict.
3. **The student's facts, in the student's words.** Altovisas shapes answers and rehearses follow-ups. It never supplies facts, scripts or claims the student cannot stand behind.
4. **Show only what works.** Unbuilt features are labelled as previews. The interface never implies capability, accuracy or affiliation that the product does not have.
5. **Open to every applicant, honest about thin evidence.** Serve applicants from any consulate, and say plainly when their consulate or profile has few comparable records instead of borrowing confidence from better-covered ones.
