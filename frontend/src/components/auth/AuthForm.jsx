import { useState, useEffect, useRef } from "react";
import { Link } from "react-router-dom";
import { login, register, verifyEmail, resendVerificationCode, getMe } from "../../api";
import { API_BASE } from "../../utils/apiBase";
import { identify, track } from "../../analytics";
import { keepRedirect, safeRedirect } from "../../utils/authRedirect";

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
        setNotice("This email still needs verifying. Enter the code we sent you.");
      } else {
        setError(msg);
      }
    } finally {
      setBusy(false);
    }
  };

  const submitSignup = async (e) => {
    e.preventDefault();
    setError("");
    if (password !== confirmPassword) {
      setError("The two passwords don't match. Type the same password in both fields.");
      return;
    }
    if (password.length < 6) {
      setError("Use a password of at least 6 characters.");
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
        setNotice("We sent a 6-digit code to your email. It can take a minute to arrive.");
      }
    } catch (err) {
      setError(err.message || "Registration failed");
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
      setError(err.message || "That code didn't work. Check it and try again, or ask for a new one.");
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
      setNotice("A new code is on its way.");
    } catch (err) {
      setError(err.message || "Could not resend the code");
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
          Your account was created, but we couldn&rsquo;t send the verification email.
          Try &ldquo;Resend code&rdquo; below, or contact{" "}
          <a href="mailto:support@altovisas.com">support@altovisas.com</a>.
        </p>
      )}
      {notice && <p className="auth-notice" role="status">{notice}</p>}
      {error && <p className="auth-error" role="alert">{error}</p>}
    </>
  );

  if (step === "verify") {
    return (
      <>
        <h2 className="auth-title" id={id("title")}>Check your email</h2>
        <p className="auth-sub">
          Enter the 6-digit code sent to <strong>{email || "your address"}</strong>.
        </p>
        {status}

        <form onSubmit={submitVerify}>
          <label className="auth-label" htmlFor={id("code")}>Verification code</label>
          <input
            id={id("code")} ref={firstFieldRef} className="auth-input auth-code" inputMode="numeric"
            autoComplete="one-time-code" maxLength={6} value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
            placeholder="000000" required
          />
          <button className="auth-primary" disabled={busy || code.length !== 6}>
            {busy ? "Verifying…" : "Verify and continue"}
          </button>
        </form>

        <div className="auth-foot">
          <button type="button" className="auth-link" onClick={resend} disabled={busy}>Resend code</button>
          <button
            type="button"
            className="auth-link"
            onClick={() => { setStep("form"); setError(""); setNotice(""); }}
          >
            Use a different email
          </button>
        </div>
      </>
    );
  }

  return (
    <>
      <h2 className="auth-title" id={id("title")}>
        {title || (tab === "login" ? "Log in" : "Create your free account")}
      </h2>
      <p className="auth-sub">
        {sub || (tab === "login"
          ? "Pick up where you left off: your rounds and reports are kept on your account."
          : "Free. It keeps your rounds and reports, and takes about a minute.")}
      </p>

      <button className="auth-oauth" onClick={googleAuth} type="button">
        <GoogleMark /> Continue with Google
      </button>

      <div className="auth-or"><span>or with email</span></div>

      {status}

      <form onSubmit={tab === "login" ? submitLogin : submitSignup}>
        {tab === "signup" && (
          <>
            <label className="auth-label" htmlFor={id("name")}>Name</label>
            <input
              id={id("name")} ref={firstFieldRef} className="auth-input" value={name}
              onChange={(e) => setName(e.target.value)}
              autoComplete="name" required minLength={2}
            />
          </>
        )}

        <label className="auth-label" htmlFor={id("email")}>Email address</label>
        <input
          id={id("email")} ref={tab === "login" ? firstFieldRef : undefined}
          className="auth-input" type="email"
          value={email} onChange={(e) => setEmail(e.target.value)}
          placeholder="name@example.com" autoComplete="email" required
        />

        <label className="auth-label" htmlFor={id("password")}>Password</label>
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
            aria-label={show ? "Hide password" : "Show password"}
          >
            {show ? "Hide" : "Show"}
          </button>
        </div>

        {tab === "signup" && (
          <>
            <p className="auth-legal" id={id("pw-hint")} style={{ margin: "-8px 0 14px" }}>
              At least 6 characters.
            </p>
            <label className="auth-label" htmlFor={id("confirm")}>Confirm password</label>
            <input
              id={id("confirm")} className="auth-input" type={show ? "text" : "password"}
              value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)}
              autoComplete="new-password" required
            />
          </>
        )}

        <button className="auth-primary" disabled={busy}>
          {busy ? "One moment…" : tab === "login" ? "Log in" : "Create account"}
        </button>
      </form>

      <div className="auth-foot">
        {tab === "login" ? (
          <>
            <span>
              New here?{" "}
              <button type="button" className="auth-link" onClick={() => switchTo("signup")}>
                Create an account
              </button>
            </span>
            <Link className="auth-link" to={resetLink}>Forgot password?</Link>
          </>
        ) : (
          <span>
            Already have one?{" "}
            <button type="button" className="auth-link" onClick={() => switchTo("login")}>
              Log in
            </button>
          </span>
        )}
      </div>

      <p className="auth-legal">
        By continuing you agree to the <Link to="/terms">Terms</Link> and{" "}
        <Link to="/privacy">Privacy Policy</Link>.
      </p>
    </>
  );
}
