import { Link, useNavigate } from "react-router-dom";
import PricingPlans from "../components/PricingPlans";
import Arrow from "../components/ui/Arrow";
import { REFUSAL_COVER_INTERVIEWS, planComparison, pricingPlans } from "../constants/pricing";
import { SITE } from "../seo/site";
import { track } from "../analytics";
import { useLang, useCopy } from "../i18n";
import "./PricingPage.css";

const COPY = {
  en: {
    included: "Included",
    notIncluded: "Not included",
    free: "Free",
    title: "Plans and pricing",
    lede: "Start with a free mock interview. If you want more practice, choose a plan and pay once. Nothing renews.",
    plans: "Plans",
    compare: "What each plan includes",
    payTitle: "How paying works",
    pay: (refund) => [
      <><strong>One payment, no subscription.</strong> Each plan is a single charge in US dollars. Nothing renews, and you are not charged again unless you buy another plan. Your bank may add a currency conversion fee.</>,
      <><strong>Try it free first.</strong> The free mock interview needs no card. It shows you exactly what the feedback looks like before you decide to pay.</>,
      <><strong>No refunds.</strong> A plan starts working the moment you buy it, so we don&rsquo;t refund plans. We do put right billing mistakes, such as a double charge. {refund("Read the Refund Policy")}.</>,
      <><strong>Refusal cover on Complete.</strong> If your visa is refused after you buy Complete, we add {REFUSAL_COVER_INTERVIEWS} more mock interviews to your account, free. It is extra practice for your next attempt, not a refund.</>,
    ],
    qsTitle: "Questions about plans",
    qs: (refund, mail) => [
      ["What is a mock interview?", <>One round of interview questions that you answer in your own words, followed by feedback on each answer: where an officer is likely to push back, and the question likely to come next.</>],
      ["Do I need a card for the free plan?", <>No. You need a free account, and nothing else.</>],
      ["Is any plan a subscription?", <>No. Every plan is a one-time payment. There is nothing to cancel.</>],
      ["Can I get my money back?", <>No. Plans are digital and start working as soon as you buy them, so all sales are final. If you were charged by mistake, or charged without getting your plan, we will fix it. Your local consumer law may also give you rights this does not take away. The {refund("Refund Policy")} has the detail.</>],
      ["What if my visa is refused?", <>On the Complete plan, you get {REFUSAL_COVER_INTERVIEWS} more mock interviews free, to prepare for your next attempt. On the other plans nothing changes, and no plan is refunded because of a refusal. No plan can change what an officer decides; only the officer decides.</>],
      ["How do I claim the refusal cover?", <>Email {mail} from the address on your account and tell us your visa was refused. We add the interviews to your account. Do not send your passport, visa or DS-160 numbers; we never need them.</>],
    ],
    closeTitle: "Start with the free interview.",
    cta: "Start your profile check",
    closeMeta: "About four minutes. Needs a free account, no card.",
  },
  ru: {
    included: "Входит",
    notIncluded: "Не входит",
    free: "Бесплатно",
    title: "Тарифы и цены",
    lede: "Начните с бесплатного пробного собеседования. Если захотите больше практики, выберите тариф и заплатите один раз. Ничего не продлевается.",
    plans: "Тарифы",
    compare: "Что входит в каждый тариф",
    payTitle: "Как устроена оплата",
    pay: (refund) => [
      <><strong>Один платёж, без подписки.</strong> Каждый тариф — это одно списание в долларах США. Ничего не продлевается, и повторно с вас не спишут деньги, если вы не купите другой тариф. Банк может взять комиссию за конвертацию валюты.</>,
      <><strong>Сначала попробуйте бесплатно.</strong> Для бесплатного пробного собеседования карта не нужна. Вы увидите, как выглядит разбор, прежде чем решите платить.</>,
      <><strong>Без возвратов.</strong> Тариф начинает работать сразу после покупки, поэтому мы не возвращаем за него деньги. Но мы исправляем ошибки при оплате, например двойное списание. {refund("Политика возврата")}.</>,
      <><strong>Защита при отказе в тарифе «Максимум».</strong> Если после покупки «Максимума» вам откажут в визе, мы бесплатно добавим на ваш аккаунт ещё {REFUSAL_COVER_INTERVIEWS} пробных собеседований. Это дополнительная практика к следующей попытке, а не возврат денег.</>,
    ],
    qsTitle: "Вопросы о тарифах",
    qs: (refund, mail) => [
      ["Что такое пробное собеседование?", <>Один раунд вопросов, на которые вы отвечаете своими словами, и разбор каждого ответа: где офицер может засомневаться и какой вопрос, скорее всего, будет следующим.</>],
      ["Нужна ли карта для бесплатного тарифа?", <>Нет. Нужен только бесплатный аккаунт.</>],
      ["Есть ли тарифы с подпиской?", <>Нет. Каждый тариф оплачивается один раз. Отменять нечего.</>],
      ["Можно ли вернуть деньги?", <>Нет. Тарифы цифровые и начинают работать сразу после покупки, поэтому все продажи окончательны. Если деньги списали по ошибке или вы оплатили тариф, но не получили его, мы это исправим. Законы о защите прав потребителей в вашей стране могут давать вам права, которых это не отменяет. Подробности — в разделе {refund("Политика возврата")}.</>],
      ["Что, если мне откажут в визе?", <>На тарифе «Максимум» вы бесплатно получите ещё {REFUSAL_COVER_INTERVIEWS} пробных собеседований для подготовки к следующей попытке. На остальных тарифах ничего не меняется, и при отказе деньги за тариф не возвращаются. Ни один тариф не влияет на решение офицера: решает только он.</>],
      ["Как получить защиту при отказе?", <>Напишите на {mail} с адреса, привязанного к аккаунту, и сообщите об отказе в визе. Мы добавим собеседования на ваш аккаунт. Не присылайте номера паспорта, визы или DS-160 — они нам никогда не нужны.</>],
    ],
    closeTitle: "Начните с бесплатного собеседования.",
    cta: "Начать проверку профиля",
    closeMeta: "Около четырёх минут. Нужен бесплатный аккаунт, карта не нужна.",
  },
};

function Included({ value, c }) {
  if (value === true) {
    return (
      <>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor"
          strokeWidth="1.8" aria-hidden="true">
          <path d="m5 12.5 4.5 4.5L19 7.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        <span className="sr-only">{c.included}</span>
      </>
    );
  }
  if (value === false) {
    return (
      <>
        <span className="compare-no" aria-hidden="true" />
        <span className="sr-only">{c.notIncluded}</span>
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
  const { lang } = useLang();
  const c = useCopy(COPY);
  const plans = pricingPlans(lang);
  const comparison = planComparison(lang);
  const start = (location) => {
    track("cta_click", { location });
    navigate("/check-profile");
  };
  const refund = (label) => <Link to="/refund-policy">{label}</Link>;
  const mail = <a href={`mailto:${SITE.contact}`}>{SITE.contact}</a>;

  return (
    <div className="tf pricing-page">
      <div className="band-paper pricing-hero">
        <div className="wrap">
          <h1>{c.title}</h1>
          <p className="lede">{c.lede}</p>
        </div>
      </div>

      <section className="wrap section pricing" aria-label={c.plans}>
        <PricingPlans onStart={() => start("pricing_page")} />
      </section>

      {/* ----------------------------------------------------- compare -- */}
      <section className="wrap section compare-sec" aria-labelledby="compare-heading">
        <h2 id="compare-heading">{c.compare}</h2>
        <div className="compare-scroll">
          <table className="compare">
            <thead>
              <tr>
                <td />
                {plans.map((p) => (
                  <th scope="col" key={p.id} className={p.recommended ? "is-rec" : undefined}>
                    <span className="compare-plan">{p.name}</span>
                    <span className="compare-price">{p.price ? `$${p.price}` : c.free}</span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {comparison.map((row) => (
                <tr key={row.label}>
                  <th scope="row">{row.label}</th>
                  {row.values.map((v, i) => (
                    <td key={plans[i].id} className={plans[i].recommended ? "is-rec" : undefined}>
                      <Included value={v} c={c} />
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
          <h2 id="pay-heading">{c.payTitle}</h2>
          <ul className="no-grid">
            {c.pay(refund).map((item, i) => <li key={i}>{item}</li>)}
          </ul>
        </section>
      </div>

      {/* ------------------------------------------------------ questions -- */}
      <section className="wrap section plan-qs" aria-labelledby="qs-heading">
        <h2 id="qs-heading">{c.qsTitle}</h2>
        <div className="plan-qs-list">
          {c.qs(refund, mail).map(([q, a]) => (
            <div key={q}>
              <h3>{q}</h3>
              <p>{a}</p>
            </div>
          ))}
        </div>
      </section>

      {/* -------------------------------------------------------- close --- */}
      <div className="close-band band-ink">
        <div className="wrap">
          <h2>{c.closeTitle}</h2>
          <div className="hero-act">
            <button className="btn" onClick={() => start("pricing_close")}>
              {c.cta} <span className="btn-free">{c.free}</span>{" "}
              <Arrow />
            </button>
          </div>
          <p className="meta">{c.closeMeta}</p>
        </div>
      </div>
    </div>
  );
}
