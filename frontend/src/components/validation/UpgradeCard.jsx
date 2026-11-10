import { useEffect, useRef } from "react";
import { Link } from "react-router-dom";
import { PRICING_PLANS, checkoutPath } from "../../constants/pricing";
import { track } from "../../analytics";
import { useCopy, plural } from "../../i18n";
import Arrow from "../ui/Arrow";

// The plan the card offers: the recommended one, read from the single pricing
// table so the card can never quote a stale price or feature.
const PLAN = PRICING_PLANS.find((p) => p.recommended) || PRICING_PLANS.find((p) => p.price > 0);

const COPY = {
  ru: {
    rework: (n) => `${n} ${plural("ru", n, ["ответ", "ответа", "ответов"])} стоит доработать. Сделайте это до собеседования.`,
    allStrong: "Хорошее начало. Теперь закрепите его.",
    leadReport: "Это был один короткий раунд. В полной подготовке вы отработаете все частые вопросы, а слабые места перепишем на основе ваших фактов.",
    titleAccess: "Продолжите с полной подготовкой",
    leadAccess: "Платите один раз и тренируйтесь дальше. Все частые вопросы и разбор каждого слабого места.",
    oneTime: "разово, без подписки",
    choose: (name) => `Выбрать «${name}»`,
    all: "Сравнить тарифы",
  },
};

// "Полная подготовка" -> "Полную", the form the plan buttons already use.
const shortName = (plan) => plan.cta.match(/«(.+)»/)?.[1] || plan.name;

/*
 * The way from a free report to a paid plan.
 *
 * It opens with what this report found - how many answers still need work -
 * so the offer reads as the next step for this person rather than an advert
 * bolted under their results. One plan, with its real price and features,
 * and a quiet link to the rest. The free way on stays beside it.
 *
 * `ev` is the report it follows; without one (the out-of-rounds screen) the
 * card speaks to continuing instead.
 */
export default function UpgradeCard({ ev, from = "report" }) {
  const c = useCopy(COPY);
  const ref = useRef(null);

  const feedback = ev?.answer_feedback || [];
  const rework = feedback.filter((f) => f.verdict !== "strong").length;
  const title = !ev ? c.titleAccess : rework > 0 ? c.rework(rework) : c.allStrong;

  // Count the view only once the card is actually on screen: it sits under a
  // long report, and most of a report is read above it. The fade-in is CSS
  // (scroll-driven), so the card never depends on this firing to be visible.
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === "undefined") return undefined;
    const io = new IntersectionObserver(([entry]) => {
      if (!entry.isIntersecting) return;
      track("upgrade_viewed", { from, plan: PLAN.id, rework });
      io.disconnect();
    }, { threshold: 0.35 });
    io.observe(el);
    return () => io.disconnect();
  }, [from, rework]);

  if (!PLAN) return null;

  return (
    <section ref={ref} className="vz-card pc-upgrade" aria-labelledby="pc-upgrade-h">
      <h2 id="pc-upgrade-h">{title}</h2>
      <p className="sub">{ev ? c.leadReport : c.leadAccess}</p>

      <div className="pc-upgrade-plan">
        <div>
          <p className="pc-upgrade-name">{PLAN.name}</p>
          <ul className="pc-upgrade-features">
            {PLAN.features.map((f) => (
              <li key={f.strong || f.text}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                  strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="m5 12.5 4.5 4.5L19 7.5" />
                </svg>
                {f.count ? `${f.count} ${f.text}` : f.strong}
              </li>
            ))}
          </ul>
        </div>
        <p className="pc-upgrade-price">
          <strong>{PLAN.price} сом</strong>
          <span>{c.oneTime}</span>
        </p>
      </div>

      <div className="pc-upgrade-act">
        <Link
          to={checkoutPath(PLAN.id)}
          className="ev-submit"
          onClick={() => track("upgrade_click", { from, plan: PLAN.id, rework })}
        >
          {c.choose(shortName(PLAN))} <Arrow />
        </Link>
        <Link to="/pricing" className="pc-quiet" onClick={() => track("upgrade_compare_click", { from })}>
          {c.all}
        </Link>
      </div>
    </section>
  );
}
