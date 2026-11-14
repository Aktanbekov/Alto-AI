import { useEffect, useRef, useState } from "react";
import { Link, Navigate, useSearchParams } from "react-router-dom";
import { PRICING_PLANS, perInterview } from "../constants/pricing";
import { track } from "../analytics";
import { createPaymentRequest } from "../api";
import { useCurrentUser } from "../components/ProtectedRoute";
import { useCopy } from "../i18n";

const COPY = {
  ru: {
    title: "Оформление",
    lede: "Оставьте контакты, и мы поможем оплатить. Подписки нет, оплата один раз.",
    noteTitle: "Оплата картой на сайте временно недоступна.",
    noteBody: "Мы свяжемся с вами, ответим на вопросы и поможем оплатить удобным способом.",
    name: "Имя",
    phone: "Номер телефона",
    plan: "Тариф",
    date: "Дата собеседования на визу",
    noDate: "Дата ещё не назначена",
    contact: "Как с вами связаться",
    telegram: "Юзернейм в Telegram",
    submit: "Отправить заявку",
    sending: "Отправляем…",
    doneTitle: "Готово!",
    doneBody: "С вами свяжутся в ближайшее время.",
    doneVia: (contact, telegram, phone) =>
      contact === "telegram" ? `Напишем в Telegram @${telegram}.` : `Напишем в WhatsApp на ${phone}.`,
    home: "На главную",
    summary: "Ваш заказ",
    perLabel: "За собеседование",
    perInterview: (x) => `${x} сом`,
    total: "Итого",
    account: "Аккаунт",
    change: "Сравнить тарифы",
    refunds: "Условия возврата",
  },
};

const PAID_PLANS = PRICING_PLANS.filter((p) => p.price > 0);

// Today in the visitor's own timezone, as the date input expects it.
function todayISO() {
  const d = new Date();
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 10);
}

/*
 * The checkout for a paid plan, reached from a plan card as
 * /checkout?plan=<id>. It sits behind sign-in, so a request always belongs to
 * an account.
 *
 * There is no card provider yet, so a paid plan is sold by hand: this page
 * collects who wants which plan, their interview date and how to reach them,
 * and an admin follows up from the "Payments" tab in the admin panel.
 */
export default function CheckoutPage() {
  const c = useCopy(COPY);
  const user = useCurrentUser();
  const [params, setParams] = useSearchParams();
  const plan = PAID_PLANS.find((p) => p.id === params.get("plan"));

  const [form, setForm] = useState({
    name: "",
    phone: "",
    date: "",
    noDate: false,
    contact: "whatsapp",
    telegram: "",
  });
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState("");
  const [sending, setSending] = useState(false);
  const [done, setDone] = useState(null);
  const doneRef = useRef(null);

  // Prefill the name once the account has loaded, without overwriting typing.
  useEffect(() => {
    if (user?.name) setForm((f) => (f.name ? f : { ...f, name: user.name }));
  }, [user?.name]);

  useEffect(() => {
    if (plan) track("checkout_view", { plan: plan.id, price: plan.price, currency: "KGS" });
    // Only on arrival: switching plans in the form is not a new visit.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (done) doneRef.current?.focus();
  }, [done]);

  // An unknown plan, or the free one, has nothing to pay for.
  if (!plan) return <Navigate to="/pricing" replace />;

  const set = (key) => (e) => {
    const value = e.target.type === "checkbox" ? e.target.checked : e.target.value;
    setForm((f) => ({ ...f, [key]: value }));
    setErrors((errs) => ({ ...errs, [key === "noDate" ? "date" : key]: undefined }));
  };

  const choosePlan = (e) => setParams({ plan: e.target.value }, { replace: true });

  const validate = () => {
    const errs = {};
    if (form.name.trim().length < 2) errs.name = "Укажите имя.";
    const digits = form.phone.replace(/\D/g, "");
    if (digits.length < 7 || digits.length > 15) errs.phone = "Укажите номер телефона с кодом страны.";
    if (!form.noDate && !form.date) errs.date = "Укажите дату или отметьте, что она ещё не назначена.";
    if (form.contact === "telegram" && !/^@?[A-Za-z][A-Za-z0-9_]{4,31}$/.test(form.telegram.trim())) {
      errs.telegram = "Укажите юзернейм в Telegram, например @username.";
    }
    return errs;
  };

  const submit = async (e) => {
    e.preventDefault();
    setFormError("");
    const errs = validate();
    setErrors(errs);
    if (Object.keys(errs).length) {
      document.getElementById(`co-${Object.keys(errs)[0]}`)?.focus();
      return;
    }

    setSending(true);
    try {
      await createPaymentRequest({
        name: form.name,
        phone: form.phone,
        plan: plan.id,
        interview_date: form.noDate ? "" : form.date,
        contact: form.contact,
        telegram: form.contact === "telegram" ? form.telegram : "",
      });
      track("checkout_request_submit", { plan: plan.id, price: plan.price, contact: form.contact });
      setDone({
        contact: form.contact,
        telegram: form.telegram.trim().replace(/^@/, ""),
        phone: form.phone.trim(),
      });
    } catch (err) {
      const details = err.details || {};
      const mapped = {
        name: details.name,
        phone: details.phone,
        date: details.interview_date,
        telegram: details.telegram,
      };
      if (Object.values(mapped).some(Boolean)) setErrors(mapped);
      else setFormError(err.message);
    } finally {
      setSending(false);
    }
  };

  if (done) {
    return (
      <div className="tf">
        <div className="page-w checkout">
          <section className="checkout-done" role="status" aria-live="polite">
            <svg className="checkout-check" viewBox="0 0 96 96" aria-hidden="true">
              <circle className="checkout-check-ring" cx="48" cy="48" r="44" />
              <path className="checkout-check-tick" d="M29 49.5 L42 62 L68 35" />
            </svg>
            <h1 ref={doneRef} tabIndex={-1}>{c.doneTitle}</h1>
            <p className="lede">{c.doneBody}</p>
            <p className="checkout-done-via">{c.doneVia(done.contact, done.telegram, done.phone)}</p>
            <Link to="/" className="btn">{c.home}</Link>
          </section>
        </div>
      </div>
    );
  }

  const fieldErr = (key) =>
    errors[key] ? <p className="checkout-err" id={`co-${key}-err`}>{errors[key]}</p> : null;
  const errProps = (key) =>
    errors[key] ? { "aria-invalid": true, "aria-describedby": `co-${key}-err` } : {};

  return (
    <div className="tf">
      <div className="page-w checkout">
        <h1>{c.title}</h1>
        <p className="lede">{c.lede}</p>

        <div className="checkout-grid">
          <form className="checkout-form" onSubmit={submit} noValidate>
            <p className="banner">
              <b>{c.noteTitle}</b> {c.noteBody}
            </p>

            <label className="auth-label" htmlFor="co-name">{c.name}</label>
            <input id="co-name" className="auth-input" autoComplete="name" maxLength={120}
              value={form.name} onChange={set("name")} {...errProps("name")} />
            {fieldErr("name")}

            <label className="auth-label" htmlFor="co-phone">{c.phone}</label>
            <input id="co-phone" className="auth-input" type="tel" inputMode="tel" autoComplete="tel"
              maxLength={32} placeholder="+996 555 123 456"
              value={form.phone} onChange={set("phone")} {...errProps("phone")} />
            {fieldErr("phone")}

            <label className="auth-label" htmlFor="co-plan">{c.plan}</label>
            <select id="co-plan" className="auth-input checkout-select" value={plan.id} onChange={choosePlan}>
              {PAID_PLANS.map((p) => (
                <option key={p.id} value={p.id}>{p.name} · {p.price} сом</option>
              ))}
            </select>

            <label className="auth-label" htmlFor="co-date">{c.date}</label>
            <input id="co-date" className="auth-input" type="date" min={todayISO()}
              value={form.noDate ? "" : form.date} onChange={set("date")} disabled={form.noDate}
              {...errProps("date")} />
            <label className="checkout-check-row">
              <input type="checkbox" checked={form.noDate} onChange={set("noDate")} />
              {c.noDate}
            </label>
            {fieldErr("date")}

            <fieldset className="checkout-contact">
              <legend className="auth-label">{c.contact}</legend>
              <div className="checkout-seg">
                {[["whatsapp", "WhatsApp"], ["telegram", "Telegram"]].map(([id, label]) => (
                  <label key={id} className={form.contact === id ? "on" : ""}>
                    <input type="radio" name="contact" value={id}
                      checked={form.contact === id} onChange={set("contact")} />
                    {label}
                  </label>
                ))}
              </div>
            </fieldset>

            {form.contact === "telegram" && (
              <div className="checkout-reveal">
                <label className="auth-label" htmlFor="co-telegram">{c.telegram}</label>
                <div className="checkout-at">
                  <span aria-hidden="true">@</span>
                  <input id="co-telegram" className="auth-input" autoComplete="off" autoCapitalize="none"
                    spellCheck={false} maxLength={33} placeholder="username"
                    value={form.telegram} onChange={set("telegram")} {...errProps("telegram")} />
                </div>
                {fieldErr("telegram")}
              </div>
            )}

            {formError && <p className="banner banner-bad" role="alert">{formError}</p>}

            <button type="submit" className="btn checkout-pay" disabled={sending}>
              {sending ? c.sending : c.submit}
            </button>
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
