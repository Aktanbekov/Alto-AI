import { useEffect, useState } from "react";
import { getCorpusStats } from "../api";
import ProportionBar from "./charts/ProportionBar";
import BarChart from "./charts/BarChart";
import DivergingChart from "./charts/DivergingChart";
import { SMALL_N } from "./charts/useChartWidth";
import { useLang, useCopy, formatNumber } from "../i18n";

// Question types below this many appearances are dropped rather than faded:
// with a handful of observations the percentage-point delta is meaningless.
const MIN_ASKED = 150;

// Sorted by decided volume so the largest, most trustworthy groups lead.
function toRows(obj, limit = 12) {
  return Object.entries(obj || {})
    .map(([label, v]) => ({ label, ...v }))
    .sort((a, b) => b.n_decided - a.n_decided)
    .slice(0, limit);
}

// The stats keys are the pipeline's English names. These are how they read in
// Russian; anything unlisted (a new consulate, say) shows as the data names it.
const NAMES_RU = {
  Masters: "Магистратура",
  Bachelors: "Бакалавриат",
  MBA: "MBA",
  PhD: "PhD",
  "New Delhi": "Нью-Дели",
  Mumbai: "Мумбаи",
  Hyderabad: "Хайдарабад",
  Chennai: "Ченнаи",
  Kolkata: "Калькутта",
  Tashkent: "Ташкент",
  "Abu Dhabi": "Абу-Даби",
};

const COPY = {
  en: {
    loading: "Loading the corpus…",
    failedTitle: "The statistics didn’t load.",
    failedBody: "Refresh the page to try again.",
    tiles: {
      interviews: ["Interviews", "deduplicated posts"],
      decided: ["With an outcome", (p) => `${p}% of corpus`],
      approved: ["Approved share", "among posters, not the true rate"],
      transcripts: ["Full transcripts", "readable question by question"],
      years: ["Years covered", "earliest to latest post"],
    },
    attempt: (n) => `Attempt ${n}`,
    readFirst: "Read this first.",
    readFirstBody: <>These are self-selected, self-reported posts. The approval share describes <em>who chose to post</em>, not the true consular approval rate. Nothing here predicts an individual outcome.</>,
    mixTitle: "Outcome mix",
    mixSub: "Every record in the corpus, including those with no stated decision.",
    outcomes: { approved: "Approved", rejected: "Refused", ap: "221(g) processing", unknown: "Not stated" },
    degreeTitle: "By degree level",
    degreeSub: "Bachelor’s applicants post markedly worse outcomes than Masters.",
    attemptTitle: "By visa attempt",
    attemptSub: (n) => `A second attempt posts a much lower approval share. Faded bars are small samples (under ${n} decided) - read them as noise, not signal.`,
    cityTitle: "By consulate",
    citySub: (n) => `How many interviews the data holds from each consulate, and the approval share among them. A consulate with few posts gives a thin comparison - the faded bars are under ${n} decided interviews.`,
    questionsTitle: "Which questions track with which outcomes",
    questionsSub: "Percentage-point difference from the corpus-wide approval share when a question type appears in an interview.",
    backwards: "The causation runs backwards.",
    backwardsBody: <>A question does not cause a refusal. Officers probe prior refusals <em>because</em> a case already looks doubtful, and reach loan paperwork <em>because</em> the interview is going well. You cannot control what you are asked - so treat this as a map of where officers dig, not a list of topics to dodge.</>,
  },
  ru: {
    loading: "Загружаем данные…",
    failedTitle: "Статистика не загрузилась.",
    failedBody: "Обновите страницу, чтобы попробовать снова.",
    tiles: {
      interviews: ["Собеседования", "без дубликатов"],
      decided: ["С известным итогом", (p) => `${p}% всех данных`],
      approved: ["Доля одобрений", "среди написавших, а не реальная"],
      transcripts: ["Полные расшифровки", "можно читать по вопросам"],
      years: ["Период", "от первого до последнего рассказа"],
    },
    attempt: (n) => `Попытка ${n}`,
    readFirst: "Сначала прочитайте это.",
    readFirstBody: <>Это рассказы, которые люди сами решили опубликовать. Доля одобрений описывает <em>тех, кто решил написать</em>, а не реальную долю одобрений в консульстве. Ничто здесь не предсказывает исход конкретного собеседования.</>,
    mixTitle: "Итоги собеседований",
    mixSub: "Все записи в данных, включая те, где решение не указано.",
    outcomes: { approved: "Одобрено", rejected: "Отказ", ap: "Проверка 221(g)", unknown: "Не указано" },
    degreeTitle: "По ступени обучения",
    degreeSub: "У поступающих в бакалавриат итоги заметно хуже, чем у поступающих в магистратуру.",
    attemptTitle: "По номеру попытки",
    attemptSub: (n) => `При второй попытке доля одобрений намного ниже. Бледные столбцы — маленькие группы (меньше ${n} собеседований с итогом): это скорее шум, чем закономерность.`,
    cityTitle: "По консульствам",
    citySub: (n) => `Сколько собеседований из каждого консульства есть в данных и какая среди них доля одобрений. Если рассказов мало, сравнивать почти не с чем — бледные столбцы означают меньше ${n} собеседований с итогом. Справа — доля одобрений и число рассказов.`,
    questionsTitle: "Какие вопросы связаны с какими итогами",
    questionsSub: "Разница в процентных пунктах с общей долей одобрений, когда этот вопрос звучит на собеседовании.",
    backwards: "Причина и следствие здесь перевёрнуты.",
    backwardsBody: <>Вопрос не вызывает отказ. Офицеры расспрашивают о прошлых отказах <em>потому, что</em> кейс уже выглядит сомнительно, и доходят до документов по кредиту <em>потому, что</em> собеседование идёт хорошо. Вы не выбираете, о чём вас спросят, — поэтому считайте это картой того, где офицеры копают глубже, а не списком тем, которых надо избегать.</>,
  },
};

export default function CorpusDashboard() {
  const [state, setState] = useState({ loading: true, error: null, stats: null });
  const { lang } = useLang();
  const c = useCopy(COPY);

  useEffect(() => {
    let cancelled = false;
    getCorpusStats()
      .then((stats) => !cancelled && setState({ loading: false, error: null, stats }))
      .catch((err) => !cancelled && setState({ loading: false, error: err.message, stats: null }));
    return () => { cancelled = true; };
  }, []);

  if (state.loading) return <p className="sub">{c.loading}</p>;
  if (state.error) {
    return (
      <div className="caveat bad" role="alert">
        <strong>{c.failedTitle}</strong> {c.failedBody}
      </div>
    );
  }

  const s = state.stats;
  const counts = s.meta.outcome_counts || {};
  const years = (s.meta.year_range || []).join("-");
  // Only shown when the export carries it. A remembered figure in its place
  // would be the one number on the page that no longer matches the data.
  const withTranscript = s.meta.n_with_transcript;
  const name = (label) => (lang === "ru" && NAMES_RU[label]) || label;
  const named = (rows) => rows.map((r) => ({ ...r, label: name(r.label) }));

  const tiles = [
    { k: c.tiles.interviews[0], n: formatNumber(lang, s.meta.n_records), sub: c.tiles.interviews[1] },
    {
      k: c.tiles.decided[0],
      n: formatNumber(lang, s.overall.n_decided),
      sub: c.tiles.decided[1](Math.round((s.overall.n_decided / s.meta.n_records) * 100)),
    },
    {
      k: c.tiles.approved[0],
      n: `${(s.overall.approval_rate * 100).toFixed(1)}%`,
      sub: c.tiles.approved[1],
    },
    withTranscript != null && {
      k: c.tiles.transcripts[0], n: formatNumber(lang, withTranscript), sub: c.tiles.transcripts[1],
    },
    { k: c.tiles.years[0], n: years, sub: c.tiles.years[1] },
  ].filter(Boolean);

  const attempts = toRows(s.by_attempt).map((r) => ({
    ...r,
    label: c.attempt(String(r.label).replace(".0", "")),
  }));

  const questionTypes = (s.question_types || [])
    .filter((q) => q.asked_in >= MIN_ASKED)
    .sort((a, b) => a.delta_vs_base - b.delta_vs_base);

  return (
    <>
      <div className="caveat">
        <strong>{c.readFirst}</strong> {c.readFirstBody}
      </div>

      <div className="tiles">
        {tiles.map((t) => (
          <div className="tile" key={t.k}>
            <div className="k">{t.k}</div>
            <div className="v">{t.n}</div>
            <div className="n">{t.sub}</div>
          </div>
        ))}
      </div>

      <div className="vz-card">
        <h2>{c.mixTitle}</h2>
        <p className="sub">{c.mixSub}</p>
        <ProportionBar
          segments={[
            { label: c.outcomes.approved, value: counts.approved || 0, color: "var(--series-pos)" },
            { label: c.outcomes.rejected, value: counts.rejected || 0, color: "var(--series-neg)" },
            {
              label: c.outcomes.ap,
              value: counts.administrative_processing_221g || 0,
              color: "var(--series-alt)",
            },
            { label: c.outcomes.unknown, value: counts.unknown || 0, color: "var(--series-none)" },
          ]}
        />
      </div>

      <div className="vz-grid-two">
        <div className="vz-card">
          <h2>{c.degreeTitle}</h2>
          <p className="sub">{c.degreeSub}</p>
          <BarChart rows={named(toRows(s.by_degree))} />
        </div>
        <div className="vz-card">
          <h2>{c.attemptTitle}</h2>
          <p className="sub">{c.attemptSub(SMALL_N)}</p>
          <BarChart rows={attempts} />
        </div>
      </div>

      <div className="vz-card">
        <h2>{c.cityTitle}</h2>
        <p className="sub">{c.citySub(SMALL_N)}</p>
        <BarChart rows={named(toRows(s.by_city, 16))} showCount />
      </div>

      <div className="vz-card">
        <h2>{c.questionsTitle}</h2>
        <p className="sub">{c.questionsSub}</p>
        <div className="caveat bad">
          <strong>{c.backwards}</strong> {c.backwardsBody}
        </div>
        <DivergingChart rows={questionTypes} />
      </div>
    </>
  );
}
