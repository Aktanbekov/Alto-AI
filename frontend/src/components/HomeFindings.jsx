import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { getCorpusStats } from "../api";
import { questionLabel } from "../data/questionLabels";
import Arrow from "./ui/Arrow";
import { useLang, useCopy } from "../i18n";

const COPY = {
  ru: {
    loading: "Загружаем цифры…",
    moneyTitle: "Сначала о деньгах.",
    askedTitle: "О чём офицеры спрашивают чаще всего.",
    moneyText: "Самые частые вопросы касаются того, кто платит за вашу учёбу.",
    askedText: "Вопросы, которые звучали чаще всего во всех собеседованиях.",
    askedNote: "Доля собеседований, где задавали этот вопрос",
    attemptHarder: "Вторая попытка сложнее.",
    attemptSame: "Первая и вторая попытки.",
    attemptText: (a, b) => `Об одобрении пишут ${a} заявителей с первой попытки и ${b} со второй.`,
    first: "Первая попытка",
    second: "Вторая попытка",
    approvalNote: "Доля отзывов с одобрением",
    degreeHarder: "Поступающим в бакалавриат отказывают чаще.",
    degreeSame: "Бакалавриат и магистратура.",
    degreeText: (m, b) => `Об одобрении пишут ${m} поступающих в магистратуру и ${b} в бакалавриат.`,
    masters: "Магистратура",
    bachelors: "Бакалавриат",
    foot: "Это данные о студентах, которые сами решили написать о своём собеседовании, а не официальная статистика одобрений.",
    more: "Все цифры",
  },
};

const pct = (x) => `${Math.round(x * 100)}%`;

// Question types that are about who pays. Used only to decide whether the
// first finding may say "money comes up first" - the heading follows the
// data, so a rebuilt corpus where it no longer holds gets a neutral one.
const MONEY = new Set([
  "sponsor_occupation", "funding_sponsor", "funding_general", "sponsor_income",
  "funding_loan", "scholarship", "business_details", "tuition_cost",
]);

function Bars({ rows }) {
  return (
    <ul className="mbars">
      {rows.map((r) => (
        <li key={r.label}>
          <span className="mbar-l">{r.label}</span>
          <span className="mbar-v">{pct(r.value)}</span>
          <span className="mbar-t" aria-hidden="true">
            <span className="mbar-f" style={{ width: `${Math.max(0, Math.min(1, r.value)) * 100}%` }} />
          </span>
        </li>
      ))}
    </ul>
  );
}

/*
 * Three things the data says, each as one sentence and one small chart.
 *
 * The home page used to carry the whole dashboard - five charts and four
 * tiles - in the middle of the story. It moved to /data; this keeps the
 * findings a nervous applicant can use, in words they read once.
 */
export default function HomeFindings() {
  const [stats, setStats] = useState(null);
  const [failed, setFailed] = useState(false);
  const { lang } = useLang();
  const c = useCopy(COPY);

  useEffect(() => {
    let cancelled = false;
    getCorpusStats()
      .then((s) => !cancelled && setStats(s))
      .catch(() => !cancelled && setFailed(true));
    return () => { cancelled = true; };
  }, []);

  if (failed) return null;
  if (!stats) return <p className="meta" role="status">{c.loading}</p>;

  const findings = [];

  const asked = (stats.question_types || [])
    .slice()
    .sort((a, b) => b.share_of_interviews - a.share_of_interviews)
    .slice(0, 4);
  if (asked.length) {
    const money = asked.slice(0, 3).every((q) => MONEY.has(q.question_type));
    findings.push({
      key: "asked",
      title: money ? c.moneyTitle : c.askedTitle,
      text: money ? c.moneyText : c.askedText,
      rows: asked.map((q) => ({ label: questionLabel(q.question_type, lang), value: q.share_of_interviews })),
      note: c.askedNote,
    });
  }

  const first = stats.by_attempt?.["1.0"] || stats.by_attempt?.["1"];
  const second = stats.by_attempt?.["2.0"] || stats.by_attempt?.["2"];
  if (first && second) {
    const harder = second.approval_rate < first.approval_rate - 0.05;
    findings.push({
      key: "attempt",
      title: harder ? c.attemptHarder : c.attemptSame,
      text: c.attemptText(pct(first.approval_rate), pct(second.approval_rate)),
      rows: [
        { label: c.first, value: first.approval_rate },
        { label: c.second, value: second.approval_rate },
      ],
      note: c.approvalNote,
    });
  }

  const masters = stats.by_degree?.Masters;
  const bachelors = stats.by_degree?.Bachelors;
  if (masters && bachelors) {
    const harder = bachelors.approval_rate < masters.approval_rate - 0.05;
    findings.push({
      key: "degree",
      title: harder ? c.degreeHarder : c.degreeSame,
      text: c.degreeText(pct(masters.approval_rate), pct(bachelors.approval_rate)),
      rows: [
        { label: c.masters, value: masters.approval_rate },
        { label: c.bachelors, value: bachelors.approval_rate },
      ],
      note: c.approvalNote,
    });
  }

  if (!findings.length) return null;

  return (
    <>
      <div className="findings">
        {findings.map((f) => (
          <section className="finding" key={f.key}>
            <h3>{f.title}</h3>
            <p>{f.text}</p>
            <Bars rows={f.rows} />
            <p className="finding-note">{f.note}</p>
          </section>
        ))}
      </div>
      <p className="findings-foot">
        {c.foot}{" "}
        <Link to="/data" className="more">
          {c.more} <Arrow />
        </Link>
      </p>
    </>
  );
}
