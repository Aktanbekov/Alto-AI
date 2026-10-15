import { useState } from "react";
import { useNavigate, Link, useLocation } from "react-router-dom";
import { forgotPassword, resetPassword } from "../api";
import { keepRedirect } from "../utils/authRedirect";

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

  const handleRequest = async (e) => {
    e.preventDefault();
    setError("");
    setNotice("");
    setLoading(true);
    try {
      await forgotPassword(email);
      setNotice("If an account exists for this email, we've sent it a 6-digit reset code.");
      setStep("reset");
    } catch (err) {
      setError(err.message || "We couldn't send a reset code. Try again in a moment.");
    } finally {
      setLoading(false);
    }
  };

  const handleReset = async (e) => {
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
    setLoading(true);
    try {
      await resetPassword(email, code, password);
      navigate(keepRedirect("/login", search));
    } catch (err) {
      setError(err.message || "That code didn't work. Check it, or ask for a new one.");
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
                <h1 className="auth-title">Set a new password</h1>
                <p className="auth-sub">
                  Enter the code sent to <strong>{email}</strong>, then choose a new password.
                </p>
                {status}
                <form onSubmit={handleReset}>
                  <label className="auth-label" htmlFor="reset-code">Reset code</label>
                  <input
                    id="reset-code" className="auth-input auth-code" inputMode="numeric"
                    autoComplete="one-time-code" maxLength={6} value={code}
                    onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                    placeholder="000000" required autoFocus
                  />

                  <label className="auth-label" htmlFor="reset-password">New password</label>
                  <div className="auth-pw">
                    <input
                      id="reset-password" className="auth-input" type={show ? "text" : "password"}
                      value={password} onChange={(e) => setPassword(e.target.value)}
                      autoComplete="new-password" minLength={6} required
                      aria-describedby="reset-hint"
                    />
                    <button
                      type="button" className="auth-reveal" onClick={() => setShow((v) => !v)}
                      aria-label={show ? "Hide password" : "Show password"}
                    >
                      {show ? "Hide" : "Show"}
                    </button>
                  </div>
                  <p className="auth-legal" id="reset-hint" style={{ margin: "-8px 0 14px" }}>
                    At least 6 characters.
                  </p>

                  <label className="auth-label" htmlFor="reset-confirm">Confirm new password</label>
                  <input
                    id="reset-confirm" className="auth-input" type={show ? "text" : "password"}
                    value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)}
                    autoComplete="new-password" required
                  />

                  <button className="auth-primary" disabled={loading || code.length !== 6}>
                    {loading ? "Saving…" : "Save new password"}
                  </button>
                </form>
                <div className="auth-foot">
                  <button
                    type="button" className="auth-link"
                    onClick={() => { setStep("request"); setError(""); setNotice(""); }}
                  >
                    Use a different email
                  </button>
                  <Link className="auth-link" to={keepRedirect("/login", search)}>Back to log in</Link>
                </div>
              </>
            ) : (
              <>
                <h1 className="auth-title">Reset your password</h1>
                <p className="auth-sub">
                  Enter the email you signed up with and we&rsquo;ll send you a 6-digit code.
                </p>
                {status}
                <form onSubmit={handleRequest}>
                  <label className="auth-label" htmlFor="reset-email">Email address</label>
                  <input
                    id="reset-email" className="auth-input" type="email"
                    value={email} onChange={(e) => setEmail(e.target.value)}
                    placeholder="name@example.com" autoComplete="email" required autoFocus
                  />
                  <button className="auth-primary" disabled={loading}>
                    {loading ? "Sending…" : "Send reset code"}
                  </button>
                </form>
                <div className="auth-foot">
                  <span>
                    Remembered it?{" "}
                    <Link className="auth-link" to={keepRedirect("/login", search)}>Log in</Link>
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
