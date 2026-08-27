import { useState, useEffect, useRef } from "react";
import { login, register, verifyEmail, resendVerificationCode, getMe } from "../../api";

const API_BASE =
  import.meta?.env?.VITE_API_BASE || (import.meta.env.PROD ? "" : "http://localhost:8080");

const GoogleMark = () => (
  <svg viewBox="0 0 533.5 544.3" width="18" height="18" aria-hidden="true">
    <path fill="#EA4335" d="M533.5 278.4c0-18.5-1.6-37-5-54.8H272v103.8h146.9c-6.3 34.6-25.4 64-54.2 83.7v69.5h87.7c51.3-47.3 81.1-117.1 81.1-202.2z" />
    <path fill="#34A853" d="M272 544.3c73.4 0 135.2-24.3 180.3-66.1l-87.7-69.5c-24.3 16.3-55.4 25.9-92.6 25.9-70.9 0-131-47.8-152.5-112.1H28.1v70.4C73.7 485.3 166.4 544.3 272 544.3z" />
    <path fill="#4A90E2" d="M119.5 322.5c-9.4-28.2-9.4-59 0-87.2V164.9H28.1C-9.4 235.8-9.4 308.5 28.1 379.4l91.4-56.9z" />
    <path fill="#FBBC05" d="M272 106.2c39.8-.6 78.3 14 107.5 41.5l80.1-80.1C408.8 24.1 343.9-.3 272 0 166.4 0 73.7 59 28.1 164.9l91.4 70.4C141 154 201.1 106.2 272 106.2z" />
  </svg>
);

/*
 * Sign-in / sign-up in a dialog rather than on its own page.
 *
 * The flows are the ones already working on LoginPage and SignupPage — the same
 * login/register/verifyEmail/resendVerificationCode calls and the same Google
 * redirect — so behaviour, including email verification, is unchanged. Only the
 * container is different.
 *
 * Google OAuth is the exception: it is a full-page redirect by nature, so that
 * button still leaves the page and returns to "/" carrying a token.
 */
export default function AuthModal({ open, mode = "login", onClose, onAuthed }) {
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

  const firstFieldRef = useRef(null);

  useEffect(() => {
    if (open) {
      setTab(mode);
      setStep("form");
      setError("");
      setNotice("");
    }
  }, [open, mode]);

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => e.key === "Escape" && onClose();
    addEventListener("keydown", onKey);
    // Stop the page behind the dialog from scrolling while it is open.
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    firstFieldRef.current?.focus();
    return () => {
      removeEventListener("keydown", onKey);
      document.body.style.overflow = previous;
    };
  }, [open, onClose]);

  if (!open) return null;

  const finish = async () => {
    const user = await getMe().catch(() => null);
    onAuthed?.(user);
    onClose();
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
      setError("Passwords do not match");
      return;
    }
    if (password.length < 6) {
      setError("Password must be at least 6 characters");
      return;
    }
    setBusy(true);
    try {
      await register(email, name, password);
      setStep("verify");
      setNotice("We sent a 6-digit code to your email.");
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
      setError(err.message || "Verification failed");
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
      setNotice("A new code is on its way.");
    } catch (err) {
      setError(err.message || "Could not resend the code");
    } finally {
      setBusy(false);
    }
  };

  // OAuth cannot complete inside a dialog; it needs a top-level navigation.
  const googleAuth = () => {
    const base = API_BASE ? API_BASE.replace(/\/$/, "") : "";
    window.location.href = `${base}/auth/google?redirect=${encodeURIComponent("/")}`;
  };

  return (
    <div
      className="auth-scrim"
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="auth-dialog" role="dialog" aria-modal="true" aria-labelledby="auth-title">
        <button className="auth-close" onClick={onClose} aria-label="Close">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor"
            strokeWidth="2" strokeLinecap="round">
            <path d="M6 6l12 12M18 6L6 18" />
          </svg>
        </button>

        {step === "verify" ? (
          <>
            <h2 className="auth-title" id="auth-title">Check your email</h2>
            <p className="auth-sub">
              Enter the 6-digit code sent to <strong>{email || "your address"}</strong>.
            </p>
            {notice && <p className="auth-notice">{notice}</p>}
            {error && <p className="auth-error">{error}</p>}

            <form onSubmit={submitVerify}>
              <label className="auth-label" htmlFor="auth-code">Verification code</label>
              <input
                id="auth-code" className="auth-input auth-code" inputMode="numeric"
                autoComplete="one-time-code" maxLength={6} value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
                placeholder="000000" required
              />
              <button className="auth-primary" disabled={busy || code.length !== 6}>
                {busy ? "Verifying…" : "Verify and continue"}
              </button>
            </form>

            <div className="auth-foot">
              <button className="auth-link" onClick={resend} disabled={busy}>Resend code</button>
              <button
                className="auth-link"
                onClick={() => { setStep("form"); setError(""); setNotice(""); }}
              >
                Back
              </button>
            </div>
          </>
        ) : (
          <>
            <h2 className="auth-title" id="auth-title">
              {tab === "login" ? "Welcome back" : "Create your profile"}
            </h2>
            <p className="auth-sub">
              {tab === "login"
                ? "Sign in to continue your interview practice."
                : "Free, and it takes about a minute."}
            </p>

            <button className="auth-oauth" onClick={googleAuth} type="button">
              <GoogleMark /> Continue with Google
            </button>

            <div className="auth-or"><span>or</span></div>

            {error && <p className="auth-error">{error}</p>}
            {notice && <p className="auth-notice">{notice}</p>}

            <form onSubmit={tab === "login" ? submitLogin : submitSignup}>
              {tab === "signup" && (
                <>
                  <label className="auth-label" htmlFor="auth-name">Name</label>
                  <input
                    id="auth-name" className="auth-input" value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Your name" autoComplete="name" required minLength={2}
                  />
                </>
              )}

              <label className="auth-label" htmlFor="auth-email">Email address</label>
              <input
                id="auth-email" ref={firstFieldRef} className="auth-input" type="email"
                value={email} onChange={(e) => setEmail(e.target.value)}
                placeholder="name@example.com" autoComplete="email" required
              />

              <label className="auth-label" htmlFor="auth-password">Password</label>
              <div className="auth-pw">
                <input
                  id="auth-password" className="auth-input" type={show ? "text" : "password"}
                  value={password} onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••" minLength={6} required
                  autoComplete={tab === "login" ? "current-password" : "new-password"}
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
                  <label className="auth-label" htmlFor="auth-confirm">Confirm password</label>
                  <input
                    id="auth-confirm" className="auth-input" type={show ? "text" : "password"}
                    value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="••••••••" autoComplete="new-password" required
                  />
                </>
              )}

              <button className="auth-primary" disabled={busy}>
                {busy ? "Please wait…" : tab === "login" ? "Log in" : "Create profile"}
              </button>
            </form>

            <div className="auth-foot">
              {tab === "login" ? (
                <span>
                  New here?{" "}
                  <button className="auth-link" onClick={() => { setTab("signup"); setError(""); }}>
                    Create a profile
                  </button>
                </span>
              ) : (
                <span>
                  Already have one?{" "}
                  <button className="auth-link" onClick={() => { setTab("login"); setError(""); }}>
                    Log in
                  </button>
                </span>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
