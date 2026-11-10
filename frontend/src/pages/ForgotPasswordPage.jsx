import { useState } from "react";
import { useNavigate, Link, useLocation } from "react-router-dom";
import { forgotPassword, resetPassword } from "../api";
import { keepRedirect } from "../utils/authRedirect";
import { useLang, useCopy, serverMessage } from "../i18n";

const COPY = {
  ru: {
    sent: "Если аккаунт с этим email существует, мы отправили на него 6-значный код для сброса.",
    sendFailed: "Не удалось отправить код для сброса. Попробуйте ещё раз чуть позже.",
    mismatch: "Пароли не совпадают. Введите один и тот же пароль в оба поля.",
    short: "Пароль должен быть не короче 6 символов.",
    badCode: "Код не подошёл. Проверьте его или запросите новый.",
    setTitle: "Задайте новый пароль",
    setSub: (email) => <>Введите код, отправленный на <strong>{email}</strong>, и придумайте новый пароль.</>,
    code: "Код для сброса",
    newPw: "Новый пароль",
    hidePw: "Скрыть пароль",
    showPw: "Показать пароль",
    hide: "Скрыть",
    show: "Показать",
    pwHint: "Не короче 6 символов.",
    confirm: "Повторите новый пароль",
    saving: "Сохраняем…",
    save: "Сохранить пароль",
    otherEmail: "Указать другой email",
    backToLogin: "Вернуться ко входу",
    resetTitle: "Восстановление пароля",
    resetSub: "Введите email, с которым вы регистрировались, и мы пришлём 6-значный код.",
    email: "Email",
    sending: "Отправляем…",
    send: "Отправить код",
    remembered: "Вспомнили пароль?",
    login: "Войти",
  },
};

/*
 * Two steps on one page: ask for a code, then set a new password with it.
 * Set in the same form styles as sign-in, inside the site shell.
 */
export default function ForgotPasswordPage() {
  const navigate = useNavigate();
  // A reset started from a gated page still owes the visitor their page back.
  const { search } = useLocation();
  const [step, setStep] = useState("request"); // "request" or "reset"
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [show, setShow] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const { lang } = useLang();
  const c = useCopy(COPY);
  const said = (err, fallback) => serverMessage(lang, err?.message) || fallback;

  const handleRequest = async (e) => {
    e.preventDefault();
    setError("");
    setNotice("");
    setLoading(true);
    try {
      await forgotPassword(email);
      setNotice(c.sent);
      setStep("reset");
    } catch (err) {
      setError(said(err, c.sendFailed));
    } finally {
      setLoading(false);
    }
  };

  const handleReset = async (e) => {
    e.preventDefault();
    setError("");
    if (password !== confirmPassword) {
      setError(c.mismatch);
      return;
    }
    if (password.length < 6) {
      setError(c.short);
      return;
    }
    setLoading(true);
    try {
      await resetPassword(email, code, password);
      navigate(keepRedirect("/login", search));
    } catch (err) {
      setError(said(err, c.badCode));
    } finally {
      setLoading(false);
    }
  };

  const status = (
    <>
      {notice && <p className="auth-notice" role="status">{notice}</p>}
      {error && <p className="auth-error" role="alert">{error}</p>}
    </>
  );

  return (
    <div className="tf">
      <div className="page-w auth-page">
        <div className="auth-page-in">
          <div className="auth-panel">
            {step === "reset" ? (
              <>
                <h1 className="auth-title">{c.setTitle}</h1>
                <p className="auth-sub">{c.setSub(email)}</p>
                {status}
                <form onSubmit={handleReset}>
                  <label className="auth-label" htmlFor="reset-code">{c.code}</label>
                  <input
                    id="reset-code" className="auth-input auth-code" inputMode="numeric"
                    autoComplete="one-time-code" maxLength={6} value={code}
                    onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                    placeholder="000000" required autoFocus
                  />

                  <label className="auth-label" htmlFor="reset-password">{c.newPw}</label>
                  <div className="auth-pw">
                    <input
                      id="reset-password" className="auth-input" type={show ? "text" : "password"}
                      value={password} onChange={(e) => setPassword(e.target.value)}
                      autoComplete="new-password" minLength={6} required
                      aria-describedby="reset-hint"
                    />
                    <button
                      type="button" className="auth-reveal" onClick={() => setShow((v) => !v)}
                      aria-label={show ? c.hidePw : c.showPw}
                    >
                      {show ? c.hide : c.show}
                    </button>
                  </div>
                  <p className="auth-legal" id="reset-hint" style={{ margin: "-8px 0 14px" }}>
                    {c.pwHint}
                  </p>

                  <label className="auth-label" htmlFor="reset-confirm">{c.confirm}</label>
                  <input
                    id="reset-confirm" className="auth-input" type={show ? "text" : "password"}
                    value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)}
                    autoComplete="new-password" required
                  />

                  <button className="auth-primary" disabled={loading || code.length !== 6}>
                    {loading ? c.saving : c.save}
                  </button>
                </form>
                <div className="auth-foot">
                  <button
                    type="button" className="auth-link"
                    onClick={() => { setStep("request"); setError(""); setNotice(""); }}
                  >
                    {c.otherEmail}
                  </button>
                  <Link className="auth-link" to={keepRedirect("/login", search)}>{c.backToLogin}</Link>
                </div>
              </>
            ) : (
              <>
                <h1 className="auth-title">{c.resetTitle}</h1>
                <p className="auth-sub">{c.resetSub}</p>
                {status}
                <form onSubmit={handleRequest}>
                  <label className="auth-label" htmlFor="reset-email">{c.email}</label>
                  <input
                    id="reset-email" className="auth-input" type="email"
                    value={email} onChange={(e) => setEmail(e.target.value)}
                    placeholder="name@example.com" autoComplete="email" required autoFocus
                  />
                  <button className="auth-primary" disabled={loading}>
                    {loading ? c.sending : c.send}
                  </button>
                </form>
                <div className="auth-foot">
                  <span>
                    {c.remembered}{" "}
                    <Link className="auth-link" to={keepRedirect("/login", search)}>{c.login}</Link>
                  </span>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
