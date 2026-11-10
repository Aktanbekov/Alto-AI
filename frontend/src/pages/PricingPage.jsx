import { Link, useNavigate } from "react-router-dom";
import PricingPlans from "../components/PricingPlans";
import Arrow from "../components/ui/Arrow";
import { REFUSAL_COVER_INTERVIEWS, PLAN_COMPARISON, PRICING_PLANS, formatPrice } from "../constants/pricing";
import { SITE } from "../seo/site";
import { track } from "../analytics";
import { useCopy } from "../i18n";
import "./PricingPage.css";

const COPY = {
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
      <><strong>Один платёж, без подписки.</strong> Каждый тариф оплачивается один раз, в сомах. Ничего не продлевается, и деньги с вас не спишут повторно, пока вы сами не купите другой тариф.</>,
      <><strong>Сначала попробуйте бесплатно.</strong> Для бесплатного пробного собеседования карта не нужна. Вы увидите, как выглядит разбор, ещё до того, как решите платить.</>,
      <><strong>Деньги за тариф не возвращаются.</strong> Тариф начинает работать сразу после покупки, поэтому возврата нет. Но ошибки при оплате, например двойное списание, мы исправляем. Подробнее: {refund("Политика возврата")}.</>,
      <><strong>Защита при отказе в тарифе «Максимум».</strong> Если после покупки «Максимума» вам откажут в визе, мы бесплатно добавим на ваш аккаунт ещё {REFUSAL_COVER_INTERVIEWS} пробных собеседований. Это дополнительная практика перед следующей попыткой, а не возврат денег.</>,
    ],
    qsTitle: "Вопросы о тарифах",
    qs: (refund, mail) => [
      ["Что такое пробное собеседование?", <>Это один раунд вопросов, на которые вы отвечаете своими словами. После него вы получаете разбор каждого ответа: где офицер может засомневаться и о чём, скорее всего, спросит дальше.</>],
      ["Нужна ли карта для бесплатного тарифа?", <>Нет. Нужен только бесплатный аккаунт.</>],
      ["Есть ли тарифы с подпиской?", <>Нет. Каждый тариф оплачивается один раз, отменять ничего не придётся.</>],
      ["Можно ли вернуть деньги?", <>Нет. Тарифы цифровые и начинают работать сразу после покупки, поэтому все продажи окончательны. Если деньги списали по ошибке или вы заплатили, но тариф не получили, мы всё исправим. Кроме того, закон о защите прав потребителей в вашей стране может давать вам права, и мы их не ограничиваем. Подробности в {refund("Политике возврата")}.</>],
      ["Что, если мне откажут в визе?", <>На тарифе «Максимум» вы бесплатно получите ещё {REFUSAL_COVER_INTERVIEWS} пробных собеседований, чтобы подготовиться к следующей попытке. На остальных тарифах ничего не меняется, а деньги за тариф при отказе не возвращаются. Ни один тариф не влияет на решение офицера: решает только он.</>],
      ["Как получить защиту при отказе?", <>Напишите на {mail} с адреса, который указан в аккаунте, и сообщите, что вам отказали в визе. Мы добавим собеседования на ваш аккаунт. Номера паспорта, визы и DS-160 присылать не нужно, они нам ни к чему.</>],
    ],
    closeTitle: "Начните с бесплатного собеседования.",
    cta: "Начать проверку профиля",
    closeMeta: "Займёт 3 минуты. Нужен бесплатный аккаунт, карта не нужна.",
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
  const c = useCopy(COPY);
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
                {PRICING_PLANS.map((p) => (
                  <th scope="col" key={p.id} className={p.recommended ? "is-rec" : undefined}>
                    <span className="compare-plan">{p.name}</span>
                    <span className="compare-price">{p.price ? formatPrice(p.price) : c.free}</span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {PLAN_COMPARISON.map((row) => (
                <tr key={row.label}>
                  <th scope="row">{row.label}</th>
                  {row.values.map((v, i) => (
                    <td key={PRICING_PLANS[i].id} className={PRICING_PLANS[i].recommended ? "is-rec" : undefined}>
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
