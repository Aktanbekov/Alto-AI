import { Link, useNavigate } from "react-router-dom";
import PricingPlans from "../components/PricingPlans";
import Arrow from "../components/ui/Arrow";
import { PLAN_COMPARISON, PRICING_PLANS, REFUSAL_COVER_INTERVIEWS } from "../constants/pricing";
import { SITE } from "../seo/site";
import { track } from "../analytics";
import "./PricingPage.css";

function Included({ value }) {
  if (value === true) {
    return (
      <>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor"
          strokeWidth="1.8" aria-hidden="true">
          <path d="m5 12.5 4.5 4.5L19 7.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        <span className="sr-only">Included</span>
      </>
    );
  }
  if (value === false) {
    return (
      <>
        <span className="compare-no" aria-hidden="true" />
        <span className="sr-only">Not included</span>
      </>
    );
  }
  return value;
}

/*
 * The full pricing page: the same four plans as the home page, then the
 * detail a buyer checks before paying - what each plan includes side by side,
 * how payment works, and the questions people ask about money.
 */
export default function PricingPage() {
  const navigate = useNavigate();
  const start = (location) => {
    track("cta_click", { location });
    navigate("/check-profile");
  };

  return (
    <div className="tf pricing-page">
      <div className="band-paper pricing-hero">
        <div className="wrap">
          <h1>Plans and pricing</h1>
          <p className="lede">
            Start with a free mock interview. If you want more practice, choose a plan
            and pay once. Nothing renews.
          </p>
        </div>
      </div>

      <section className="wrap section pricing" aria-label="Plans">
        <PricingPlans onStart={() => start("pricing_page")} />
      </section>

      {/* ----------------------------------------------------- compare -- */}
      <section className="wrap section compare-sec" aria-labelledby="compare-heading">
        <h2 id="compare-heading">What each plan includes</h2>
        <div className="compare-scroll">
          <table className="compare">
            <thead>
              <tr>
                <td />
                {PRICING_PLANS.map((p) => (
                  <th scope="col" key={p.id} className={p.badge === "Recommended" ? "is-rec" : undefined}>
                    <span className="compare-plan">{p.name}</span>
                    <span className="compare-price">{p.price ? `$${p.price}` : "Free"}</span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {PLAN_COMPARISON.map((row) => (
                <tr key={row.label}>
                  <th scope="row">{row.label}</th>
                  {row.values.map((v, i) => (
                    <td key={PRICING_PLANS[i].id} className={PRICING_PLANS[i].badge === "Recommended" ? "is-rec" : undefined}>
                      <Included value={v} />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* --------------------------------------------------------- pay --- */}
      <div className="band band-paper">
        <section className="wrap section pay" aria-labelledby="pay-heading">
          <h2 id="pay-heading">How paying works</h2>
          <ul className="no-grid">
            <li>
              <strong>One payment, no subscription.</strong> Each plan is a single charge
              in US dollars. Nothing renews, and you are not charged again unless you buy
              another plan. Your bank may add a currency conversion fee.
            </li>
            <li>
              <strong>Try it free first.</strong> The free mock interview needs no card. It
              shows you exactly what the feedback looks like before you decide to pay.
            </li>
            <li>
              <strong>No refunds.</strong> A plan starts working the moment you buy it, so
              we don&rsquo;t refund plans. We do put right billing mistakes, such as a
              double charge. <Link to="/refund-policy">Read the Refund Policy</Link>.
            </li>
            <li>
              <strong>Refusal cover on Complete.</strong> If your visa is refused after you
              buy Complete, we add {REFUSAL_COVER_INTERVIEWS} more mock interviews to your
              account, free. It is extra practice for your next attempt, not a refund.
            </li>
          </ul>
        </section>
      </div>

      {/* ------------------------------------------------------ questions -- */}
      <section className="wrap section plan-qs" aria-labelledby="qs-heading">
        <h2 id="qs-heading">Questions about plans</h2>
        <div className="plan-qs-list">
          <div>
            <h3>What is a mock interview?</h3>
            <p>
              One round of interview questions that you answer in your own words, followed
              by feedback on each answer: where an officer is likely to push back, and the
              question likely to come next.
            </p>
          </div>
          <div>
            <h3>Do I need a card for the free plan?</h3>
            <p>No. You need a free account, and nothing else.</p>
          </div>
          <div>
            <h3>Is any plan a subscription?</h3>
            <p>No. Every plan is a one-time payment. There is nothing to cancel.</p>
          </div>
          <div>
            <h3>Can I get my money back?</h3>
            <p>
              No. Plans are digital and start working as soon as you buy them, so all sales
              are final. If you were charged by mistake, or charged without getting your
              plan, we will fix it. Your local consumer law may also give you rights this
              does not take away. The <Link to="/refund-policy">Refund Policy</Link> has the
              detail.
            </p>
          </div>
          <div>
            <h3>What if my visa is refused?</h3>
            <p>
              On the Complete plan, you get {REFUSAL_COVER_INTERVIEWS} more mock interviews
              free, to prepare for your next attempt. On the other plans nothing changes,
              and no plan is refunded because of a refusal. No plan can change what an
              officer decides; only the officer decides.
            </p>
          </div>
          <div>
            <h3>How do I claim the refusal cover?</h3>
            <p>
              Email <a href={`mailto:${SITE.contact}`}>{SITE.contact}</a> from the address on
              your account and tell us your visa was refused. We add the interviews to your
              account. Do not send your passport, visa or DS-160 numbers; we never need them.
            </p>
          </div>
        </div>
      </section>

      {/* -------------------------------------------------------- close --- */}
      <div className="close-band band-ink">
        <div className="wrap">
          <h2>Start with the free interview.</h2>
          <div className="hero-act">
            <button className="btn" onClick={() => start("pricing_close")}>
              Start your profile check <span className="btn-free">Free</span>{" "}
              <Arrow />
            </button>
          </div>
          <p className="meta">
            About four minutes. Needs a free account, no card.
          </p>
        </div>
      </div>
    </div>
  );
}
