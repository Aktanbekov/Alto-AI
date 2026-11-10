import { useState, useEffect, useRef } from "react";
import { Link } from "react-router-dom";
import { login, register, verifyEmail, resendVerificationCode, getMe } from "../../api";
import { API_BASE } from "../../utils/apiBase";
import { identify, track } from "../../analytics";
import { keepRedirect, safeRedirect } from "../../utils/authRedirect";
import { useLang, useCopy, serverMessage } from "../../i18n";

const COPY = {
  ru: {
    loginFailed: "Не удалось войти",
    needsVerify: "Этот email ещё не подтверждён. Введите код, который мы отправили.",
    mismatch: "Пароли не совпадают. Введите один и тот же пароль в оба поля.",
    short: "Пароль должен быть не короче 6 символов.",
    codeSent: "Мы отправили 6-значный код на вашу почту. Письмо может идти около минуты.",
    registerFailed: "Не удалось создать аккаунт",
    badCode: "Код не подошёл. Проверьте его и попробуйте снова или запросите новый.",
    newCode: "Новый код уже в пути.",
    resendFailed: "Не удалось отправить код ещё раз",
    undelivered: (mail) => <>Аккаунт создан, но письмо с кодом отправить не удалось. Нажмите «Отправить код ещё раз» ниже или напишите на {mail}.</>,
    checkEmail: "Проверьте почту",
    enterCode: (email) => <>Введите 6-значный код, отправленный на <strong>{email || "ваш адрес"}</strong>.</>,
    codeLabel: "Код подтверждения",
    verifying: "Проверяем…",
    verify: "Подтвердить и продолжить",
    resend: "Отправить код ещё раз",
    otherEmail: "Указать другой email",
    loginTitle: "Вход",
    signupTitle: "Создайте бесплатный аккаунт",
    loginSub: "Продолжите с того места, где остановились: раунды и отчёты хранятся в вашем аккаунте.",
    signupSub: "Бесплатно. Аккаунт хранит ваши раунды и отчёты, а регистрация займёт около минуты.",
    google: "Продолжить с Google",
    or: "или по email",
    name: "Имя",
    email: "Email",
    password: "Пароль",
    hidePw: "Скрыть пароль",
    showPw: "Показать пароль",
    hide: "Скрыть",
    show: "Показать",
    pwHint: "Не короче 6 символов.",
    confirm: "Повторите пароль",
    busy: "Секунду…",
    login: "Войти",
    create: "Создать аккаунт",
    newHere: "Впервые здесь?",
    createLink: "Создать аккаунт",
    forgot: "Забыли пароль?",
    haveOne: "Уже есть аккаунт?",
    legal: (terms, privacy) => <>Продолжая, вы соглашаетесь с {terms("Условиями использования")} и {privacy("Политикой конфиденциальности")}.</>,
  },
};

const GoogleMark = () => (
  <svg viewBox="0 0 533.5 544.3" width="18" height="18" aria-hidden="true">
    <path fill="#EA4335" d="M533.5 278.4c0-18.5-1.6-37-5-54.8H272v103.8h146.9c-6.3 34.6-25.4 64-54.2 83.7v69.5h87.7c51.3-47.3 81.1-117.1 81.1-202.2z" />
    <path fill="#34A853" d="M272 544.3c73.4 0 135.2-24.3 180.3-66.1l-87.7-69.5c-24.3 16.3-55.4 25.9-92.6 25.9-70.9 0-131-47.8-152.5-112.1H28.1v70.4C73.7 485.3 166.4 544.3 272 544.3z" />
    <path fill="#4A90E2" d="M119.5 322.5c-9.4-28.2-9.4-59 0-87.2V164.9H28.1C-9.4 235.8-9.4 308.5 28.1 379.4l91.4-56.9z" />
    <path fill="#FBBC05" d="M272 106.2c39.8-.6 78.3 14 107.5 41.5l80.1-80.1C408.8 24.1 343.9-.3 272 0 166.4 0 73.7 59 28.1 164.9l91.4 70.4C141 154 201.1 106.2 272 106.2z" />
  </svg>
);

/*
 * Sign in, create an account, verify the emailed code.
 *
 * One form for every place an account is asked for: the header dialog, the
 * account gate in front of the profile check, and the /login and /signup
 * pages. They used to be three copies in three visual styles, and the copies
 * had already drifted - only one of them told analytics who had just signed in.
 *
 * Google OAuth is a full-page redirect by nature, so that button leaves the
 * page and comes back to `redirect` carrying a token.
 */
export default function AuthForm({
  mode = "login",
  redirect = "/",
  onAuthed,
  title,
  sub,
  autoFocus = true,
  idPrefix = "auth",
}) {
  const [tab, setTab] = useState(mode);
  const [step, setStep] = useState("form"); // "form" | "verify"

  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [code, setCode] = useState("");

  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  // Set when the account was created but the verification code never left the
  // server, so the verify step does not promise mail that will not arrive.
  const [undelivered, setUndelivered] = useState(false);

  const firstFieldRef = useRef(null);
  const id = (k) => `${idPrefix}-${k}`;
  const { lang } = useLang();
  const c = useCopy(COPY);
  // The server writes English; the messages a student can meet are translated.
  const said = (err, fallback) => serverMessage(lang, err?.message) || fallback;

  useEffect(() => { setTab(mode); }, [mode]);
  useEffect(() => {
    if (autoFocus) firstFieldRef.current?.focus();
  }, [autoFocus, tab, step]);

  const switchTo = (next) => {
    setTab(next);
    setError("");
    setNotice("");
  };

  const finish = async () => {
    // Links this browser's earlier anonymous events to the account, so the
    // pre-signup half of the funnel is attributable.
    identify();
    const user = await getMe().catch(() => null);
    onAuthed?.(user);
  };

  const submitLogin = async (e) => {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      await login(email, password);
      await finish();
    } catch (err) {
      const msg = err.message || "Login failed";
      // An unverified account cannot log in. Move straight to the code step
      // instead of leaving the user at a dead end.
      if (/not verified|verification/i.test(msg)) {
        setStep("verify");
        setNotice(c.needsVerify);
      } else {
        setError(said(err, c.loginFailed));
      }
    } finally {
      setBusy(false);
    }
  };

  const submitSignup = async (e) => {
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
    setBusy(true);
    try {
      const result = await register(email, name, password);
      track("email_submit");
      setStep("verify");
      // email_sent is false when the account was created but the code could not
      // be mailed. Saying "check your email" then would strand the user.
      if (result?.email_sent === false) {
        setUndelivered(true);
        setNotice("");
      } else {
        setUndelivered(false);
        setNotice(c.codeSent);
      }
    } catch (err) {
      setError(said(err, c.registerFailed));
    } finally {
      setBusy(false);
    }
  };

  const submitVerify = async (e) => {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      await verifyEmail(email, code);
      await finish();
    } catch (err) {
      setError(said(err, c.badCode));
    } finally {
      setBusy(false);
    }
  };

  const resend = async () => {
    setError("");
    setNotice("");
    setBusy(true);
    try {
      await resendVerificationCode(email);
      setUndelivered(false);
      setNotice(c.newCode);
    } catch (err) {
      setError(said(err, c.resendFailed));
    } finally {
      setBusy(false);
    }
  };

  const googleAuth = () => {
    const base = API_BASE ? API_BASE.replace(/\/$/, "") : "";
    window.location.href = `${base}/auth/google?redirect=${encodeURIComponent(safeRedirect(redirect))}`;
  };

  // A reset started from here still owes the visitor the page they wanted.
  const resetLink = keepRedirect(
    "/forgot-password",
    redirect && redirect !== "/" ? `redirect=${encodeURIComponent(redirect)}` : ""
  );

  const status = (
    <>
      {undelivered && (
        <p className="auth-warn" role="alert">
          {c.undelivered(<a href="mailto:support@altovisas.com">support@altovisas.com</a>)}
        </p>
      )}
      {notice && <p className="auth-notice" role="status">{notice}</p>}
      {error && <p className="auth-error" role="alert">{error}</p>}
    </>
  );

  if (step === "verify") {
    return (
      <>
        <h2 className="auth-title" id={id("title")}>{c.checkEmail}</h2>
        <p className="auth-sub">{c.enterCode(email)}</p>
        {status}

        <form onSubmit={submitVerify}>
          <label className="auth-label" htmlFor={id("code")}>{c.codeLabel}</label>
          <input
            id={id("code")} ref={firstFieldRef} className="auth-input auth-code" inputMode="numeric"
            autoComplete="one-time-code" maxLength={6} value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
            placeholder="000000" required
          />
          <button className="auth-primary" disabled={busy || code.length !== 6}>
            {busy ? c.verifying : c.verify}
          </button>
        </form>

        <div className="auth-foot">
          <button type="button" className="auth-link" onClick={resend} disabled={busy}>{c.resend}</button>
          <button
            type="button"
            className="auth-link"
            onClick={() => { setStep("form"); setError(""); setNotice(""); }}
          >
            {c.otherEmail}
          </button>
        </div>
      </>
    );
  }

  return (
    <>
      <h2 className="auth-title" id={id("title")}>
        {title || (tab === "login" ? c.loginTitle : c.signupTitle)}
      </h2>
      <p className="auth-sub">
        {sub || (tab === "login" ? c.loginSub : c.signupSub)}
      </p>

      <button className="auth-oauth" onClick={googleAuth} type="button">
        <GoogleMark /> {c.google}
      </button>

      <div className="auth-or"><span>{c.or}</span></div>

      {status}

      <form onSubmit={tab === "login" ? submitLogin : submitSignup}>
        {tab === "signup" && (
          <>
            <label className="auth-label" htmlFor={id("name")}>{c.name}</label>
            <input
              id={id("name")} ref={firstFieldRef} className="auth-input" value={name}
              onChange={(e) => setName(e.target.value)}
              autoComplete="name" required minLength={2}
            />
          </>
        )}

        <label className="auth-label" htmlFor={id("email")}>{c.email}</label>
        <input
          id={id("email")} ref={tab === "login" ? firstFieldRef : undefined}
          className="auth-input" type="email"
          value={email} onChange={(e) => setEmail(e.target.value)}
          placeholder="name@example.com" autoComplete="email" required
        />

        <label className="auth-label" htmlFor={id("password")}>{c.password}</label>
        <div className="auth-pw">
          <input
            id={id("password")} className="auth-input" type={show ? "text" : "password"}
            value={password} onChange={(e) => setPassword(e.target.value)}
            minLength={6} required
            autoComplete={tab === "login" ? "current-password" : "new-password"}
            aria-describedby={tab === "signup" ? id("pw-hint") : undefined}
          />
          <button
            type="button" className="auth-reveal" onClick={() => setShow((v) => !v)}
            aria-label={show ? c.hidePw : c.showPw}
          >
            {show ? c.hide : c.show}
          </button>
        </div>

        {tab === "signup" && (
          <>
            <p className="auth-legal" id={id("pw-hint")} style={{ margin: "-8px 0 14px" }}>
              {c.pwHint}
            </p>
            <label className="auth-label" htmlFor={id("confirm")}>{c.confirm}</label>
            <input
              id={id("confirm")} className="auth-input" type={show ? "text" : "password"}
              value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)}
              autoComplete="new-password" required
            />
          </>
        )}

        <button className="auth-primary" disabled={busy}>
          {busy ? c.busy : tab === "login" ? c.login : c.create}
        </button>
      </form>

      <div className="auth-foot">
        {tab === "login" ? (
          <>
            <span>
              {c.newHere}{" "}
              <button type="button" className="auth-link" onClick={() => switchTo("signup")}>
                {c.createLink}
              </button>
            </span>
            <Link className="auth-link" to={resetLink}>{c.forgot}</Link>
          </>
        ) : (
          <span>
            {c.haveOne}{" "}
            <button type="button" className="auth-link" onClick={() => switchTo("login")}>
              {c.login}
            </button>
          </span>
        )}
      </div>

      <p className="auth-legal">
        {c.legal(
          (label) => <Link to="/terms">{label}</Link>,
          (label) => <Link to="/privacy">{label}</Link>,
        )}
      </p>
    </>
  );
}
