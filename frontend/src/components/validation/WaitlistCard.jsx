import { useState, useEffect } from "react";
import { getMe, joinWaitlist } from "../../api";
import { track } from "../../analytics";

// Deliberately loose, and only a first pass — the server validates too, and a
// browser that rejects an address a mail server would have accepted is worse
// than one that lets a typo through to a bounce.
const LOOKS_LIKE_EMAIL = /^[^@\s]+@[^@\s.]+(\.[^@\s.]+)+$/;

/*
 * The second way forward: register interest in the paid product.
 *
 * Someone signed in is asked to confirm the address we already have rather than
 * type it again — but it is a confirmation, not an assumption, because the
 * account address and the one they want product mail at are not always the same.
 */
export default function WaitlistCard({ access, onJoined }) {
  const [email, setEmail] = useState("");
  const [known, setKnown] = useState(false);
  const [state, setState] = useState(access.waitlist_joined ? "done" : "idle");
  const [error, setError] = useState("");

  // Prefill from the account when there is one. A guest simply types theirs.
  useEffect(() => {
    let cancelled = false;
    getMe()
      .then((u) => {
        if (cancelled || !u?.email) return;
        setEmail(u.email);
        setKnown(true);
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, []);

  const submit = async (e) => {
    e.preventDefault();
    const value = email.trim();
    if (!LOOKS_LIKE_EMAIL.test(value)) {
      setError("Enter a valid email address.");
      return;
    }
    setState("saving");
    setError("");
    try {
      await joinWaitlist(value);
      // The address itself never reaches the event stream.
      track("premium_waitlist_joined", { from_account: known });
      setState("done");
      onJoined?.();
    } catch (err) {
      setError(err.message || "Could not add you to the waitlist. Try again.");
      setState("idle");
    }
  };

  if (state === "done") {
    return (
      <div className="vz-card vwl" role="status">
        <h2>You’re on the premium waitlist</h2>
        <p className="sub">
          We’ll email you when unlimited practice is ready. No payment details needed.
        </p>
      </div>
    );
  }

  const busy = state === "saving";

  return (
    // noValidate: the browser's own bubble for a malformed address is styled
    // nothing like this page and appears in a different place each engine, so
    // the check below owns the message.
    <form className="vz-card vwl" onSubmit={submit} noValidate>
      <h2>Join the premium waitlist</h2>
      <p className="sub">
        {known
          ? "Confirm the address you’d like us to use."
          : "Leave an email and we’ll tell you when unlimited practice is ready."}
      </p>

      <label className="ev-f">
        <span className="fl">Email</span>
        <input
          type="email"
          value={email}
          disabled={busy}
          onChange={(e) => { setEmail(e.target.value); setError(""); }}
          placeholder="you@example.com"
          aria-invalid={error ? "true" : undefined}
        />
      </label>

      {error && <p className="vfb-err">{error}</p>}

      <button type="submit" className="ev-submit vwl-submit" disabled={busy}>
        {busy ? "Adding you…" : known ? "Confirm and join" : "Join the waitlist"}
      </button>
    </form>
  );
}
