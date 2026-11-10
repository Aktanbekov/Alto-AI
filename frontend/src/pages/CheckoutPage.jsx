import { useEffect } from "react";
import { Link, Navigate, useSearchParams } from "react-router-dom";
import { PRICING_PLANS, perInterview } from "../constants/pricing";
import { track } from "../analytics";
import { useCurrentUser } from "../components/ProtectedRoute";
import { useCopy } from "../i18n";

const COPY = {
  ru: {
    title: "Оплата",
    lede: "Проверьте тариф и оплатите один раз. Подписки нет, ничего не продлевается.",
    soonTitle: "Оплата картой скоро появится.",
    soonBody: "Поля ниже пока отключены: форма ничего не отправляет и не сохраняет.",
    card: "Данные карты",
    number: "Номер карты",
    expiry: "Срок действия",
    cvc: "CVC",
    holder: "Имя на карте",
    pay: (price) => `Оплатить ${price} сом`,
    summary: "Ваш заказ",
    plan: "Тариф",
    perLabel: "За собеседование",
    perInterview: (x) => `${x} сом`,
    total: "Итого",
    account: "Аккаунт",
    change: "Выбрать другой тариф",
    refunds: "Условия возврата",
  },
};

/*
 * The checkout for a paid plan, reached from a plan card as
 * /checkout?plan=<id>. It sits behind sign-in, so a purchase always belongs to
 * an account.
 *
 * There is no payment provider yet. The card form is laid out as it will be,
 * but every field is disabled and nothing is submitted or stored: a form that
 * looks live and goes nowhere invites people to type a real card number into
 * it. Wire a provider's hosted fields in here when payments exist.
 */
export default function CheckoutPage() {
  const c = useCopy(COPY);
  const user = useCurrentUser();
  const [params] = useSearchParams();
  const plan = PRICING_PLANS.find((p) => p.id === params.get("plan") && p.price > 0);

  useEffect(() => {
    if (plan) track("checkout_view", { plan: plan.id, price: plan.price, currency: "KGS" });
  }, [plan]);

  // An unknown plan, or the free one, has nothing to pay for.
  if (!plan) return <Navigate to="/pricing" replace />;

  return (
    <div className="tf">
      <div className="page-w checkout">
        <h1>{c.title}</h1>
        <p className="lede">{c.lede}</p>

        <div className="checkout-grid">
          <form className="checkout-form" onSubmit={(e) => e.preventDefault()} aria-describedby="checkout-soon">
            <p className="banner" id="checkout-soon" role="status">
              <b>{c.soonTitle}</b> {c.soonBody}
            </p>

            <fieldset disabled>
              <legend className="card-h">{c.card}</legend>
              <label className="auth-label" htmlFor="cc-number">{c.number}</label>
              <input id="cc-number" className="auth-input" inputMode="numeric" autoComplete="off"
                placeholder="0000 0000 0000 0000" />
              <div className="checkout-pair">
                <div>
                  <label className="auth-label" htmlFor="cc-exp">{c.expiry}</label>
                  <input id="cc-exp" className="auth-input" inputMode="numeric" autoComplete="off" placeholder="ММ/ГГ" />
                </div>
                <div>
                  <label className="auth-label" htmlFor="cc-cvc">{c.cvc}</label>
                  <input id="cc-cvc" className="auth-input" inputMode="numeric" autoComplete="off" placeholder="123" />
                </div>
              </div>
              <label className="auth-label" htmlFor="cc-name">{c.holder}</label>
              <input id="cc-name" className="auth-input" autoComplete="off" placeholder="IVAN IVANOV" />
              <button type="submit" className="btn checkout-pay">{c.pay(plan.price)}</button>
            </fieldset>
          </form>

          <aside className="card checkout-summary" aria-labelledby="checkout-summary-h">
            <h2 id="checkout-summary-h" className="card-h">{c.summary}</h2>
            <dl>
              <div><dt>{c.plan}</dt><dd>{plan.name}</dd></div>
              <div><dt>{c.perLabel}</dt><dd>{c.perInterview(perInterview(plan))}</dd></div>
              {user?.email && <div><dt>{c.account}</dt><dd>{user.email}</dd></div>}
            </dl>
            <ul className="checkout-features">
              {plan.features.map((f) => (
                <li key={f.strong || f.text}>{f.count ? `${f.count} ${f.text}` : f.strong}</li>
              ))}
            </ul>
            <p className="checkout-total"><span>{c.total}</span><strong>{plan.price} сом</strong></p>
            <p className="checkout-links">
              <Link to="/pricing">{c.change}</Link>
              <Link to="/refund-policy">{c.refunds}</Link>
            </p>
          </aside>
        </div>
      </div>
    </div>
  );
}
