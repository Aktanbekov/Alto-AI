import { Link } from "react-router-dom";
import { APPLICANTS_PREPPED, pricingPlans, checkoutPath } from "../constants/pricing";
import { CORPUS } from "../seo/site";
import { track } from "../analytics";
import { useLang, useCopy, formatNumber } from "../i18n";
import Arrow from "./ui/Arrow";
import "./PricingPlans.css";

const COPY = {
  en: {
    prepped: "applicants prepped",
    noSub: "No subscription. Pay once.",
    builtOn: (n) => <>Built on <strong>{n}</strong> interview reports</>,
    free: "Free",
    oneTime: "one-time",
    noCard: "no card needed",
    perInterview: (x) => `$${x} per interview`,
    foot: "Prices in US dollars. You pay once, and nothing renews.",
    details: "What each plan includes",
  },
  ru: {
    prepped: "заявителей уже подготовились",
    noSub: "Без подписки. Платите один раз.",
    builtOn: (n) => <>Основано на <strong>{n}</strong> отчётах о собеседованиях</>,
    free: "Бесплатно",
    oneTime: "разово",
    noCard: "карта не нужна",
    perInterview: (x) => `$${x} за собеседование`,
    foot: "Цены в долларах США. Вы платите один раз, ничего не продлевается.",
    details: "Что входит в каждый тариф",
  },
};

// Line icons in the same 1.6 stroke as the rest of the set.
const ICONS = {
  play: <path d="M8 5.5v13l10-6.5-10-6.5Z" strokeLinejoin="round" />,
  clock: <><circle cx="12" cy="12" r="8.5" /><path d="M12 7.5V12l3 2" strokeLinecap="round" /></>,
  target: <><circle cx="12" cy="12" r="8.5" /><circle cx="12" cy="12" r="4.5" /><circle cx="12" cy="12" r="1" fill="currentColor" /></>,
  shield: <><path d="M12 3.5 19 6v5.5c0 4.2-3 7.4-7 9-4-1.6-7-4.8-7-9V6l7-2.5Z" strokeLinejoin="round" /><path d="m9 12 2.2 2.2L15.5 10" strokeLinecap="round" strokeLinejoin="round" /></>,
  check: <path d="m5 12.5 4.5 4.5L19 7.5" strokeLinecap="round" strokeLinejoin="round" />,
  once: <><path d="M4.5 12a7.5 7.5 0 0 1 13-5.1M19.5 12a7.5 7.5 0 0 1-13 5.1" strokeLinecap="round" /><path d="M17.5 3.5v3.6h-3.6M6.5 20.5v-3.6h3.6" strokeLinecap="round" strokeLinejoin="round" /></>,
  report: <path d="M6 3h9l4 4v14H6V3Zm9 0v4h4M9 12h7M9 16h5" strokeLinejoin="round" />,
};

function Icon({ name, size = 20 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="1.6" aria-hidden="true">
      {ICONS[name]}
    </svg>
  );
}


/*
 * Four one-time plans, side by side. Each card is a subgrid row set, so the
 * names, prices, feature lists and buttons line up across the row however
 * long any one of them runs. Used by the home page section and by /pricing;
 * the home page passes `detailsLink` to point at the full page.
 */
export default function PricingPlans({ onStart, detailsLink = false }) {
  const { lang } = useLang();
  const c = useCopy(COPY);
  const plans = pricingPlans(lang);
  const choose = (plan) => track("pricing_plan_click", { plan: plan.id, price: plan.price });

  return (
    <>
      <ul className="price-trust">
        {/* A placeholder figure, so it shows in local development only. */}
        {import.meta.env.DEV && (
          <li><Icon name="check" size={18} /><span><strong>{APPLICANTS_PREPPED}</strong> {c.prepped}</span></li>
        )}
        <li><Icon name="once" size={18} /><span>{c.noSub}</span></li>
        <li><Icon name="report" size={18} /><span>{c.builtOn(formatNumber(lang, CORPUS.interviews))}</span></li>
      </ul>

      <ul className="price-tiers">
        {plans.map((p) => (
          <li key={p.id} className={`tier tier-${p.id}${p.badge ? " has-badge" : ""}`}>
            {p.badge && (
              <p className="tier-badge">
                {p.cover && <Icon name="shield" size={14} />}
                {p.badge}
              </p>
            )}

            <div className="tier-head">
              <h3><Icon name={p.icon} />{p.name}</h3>
              <p>{p.description}</p>
            </div>

            <div className="tier-price">
              <p className="tier-amount">
                <span className="tier-figure">{p.price ? `$${p.price}` : c.free}</span>
                <span className="tier-term">{p.price ? c.oneTime : c.noCard}</span>
              </p>
              {p.price > 0 && <p className="tier-unit">{c.perInterview((p.price / p.interviews).toFixed(2))}</p>}
            </div>

            <div className="tier-body">
              <ul className="tier-features">
                {p.features.map((f) => (
                  <li key={f.strong || f.text}>
                    <Icon name="check" size={16} />
                    {f.count ? (
                      <span><strong>{f.count}</strong> {f.text}</span>
                    ) : (
                      <span>
                        <strong>{f.strong}</strong>
                        {f.note && <span className="tier-note">{f.note}</span>}
                      </span>
                    )}
                  </li>
                ))}
              </ul>
              {p.cover && <p className="tier-cover">{p.cover}</p>}
            </div>

            <div className="tier-action">
              {p.price === 0 ? (
                <button type="button" className="btn tier-btn-quiet" onClick={onStart}>
                  {p.cta} <Arrow />
                </button>
              ) : (
                <Link
                  to={checkoutPath(p.id)}
                  className={p.badge ? "btn" : "btn tier-btn-quiet"}
                  onClick={() => choose(p)}
                >
                  {p.cta} <Arrow />
                </Link>
              )}
            </div>
          </li>
        ))}
      </ul>

      <p className="price-foot">
        {c.foot}{" "}
        {detailsLink && (
          <Link to="/pricing" className="more">{c.details} <Arrow /></Link>
        )}
      </p>
    </>
  );
}
