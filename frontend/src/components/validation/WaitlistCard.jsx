import { useState, useEffect } from "react";
import { getMe, joinWaitlist } from "../../api";
import { track } from "../../analytics";
import { useLang, useCopy, serverMessage } from "../../i18n";

const COPY = {
  en: {
    invalid: "Enter a valid email address.",
    failed: "Could not add you to the waitlist. Try again.",
    doneTitle: "You’re on the waitlist",
    doneSub: "We’ll email you when the paid version is ready. No payment details needed now.",
    title: "Or wait for the paid version",
    sub: "It works through each weak point with you, rebuilds the answer from your own facts, then drills you on the follow-ups by voice. One payment.",
    confirmKnown: "Confirm the address you’d like us to use.",
    leaveEmail: "Leave an email and we’ll tell you when it’s ready.",
    email: "Email",
    adding: "Adding you…",
    confirm: "Confirm and join",
    join: "Join the waitlist",
  },
  ru: {
    invalid: "Введите корректный email.",
    failed: "Не удалось добавить вас в лист ожидания. Попробуйте ещё раз.",
    doneTitle: "Вы в листе ожидания",
    doneSub: "Мы напишем вам, когда платная версия будет готова. Платёжные данные сейчас не нужны.",
    title: "Или дождитесь платной версии",
    sub: "Она вместе с вами разберёт каждое слабое место, пересоберёт ответ из ваших собственных фактов и потренирует вас голосом на уточняющих вопросах. Один платёж.",
    confirmKnown: "Подтвердите адрес, на который нам писать.",
    leaveEmail: "Оставьте email, и мы сообщим, когда она будет готова.",
    email: "Email",
    adding: "Добавляем…",
    confirm: "Подтвердить и записаться",
    join: "Записаться в лист ожидания",
  },
};

// Deliberately loose, and only a first pass - the server validates too, and a
// browser that rejects an address a mail server would have accepted is worse
// than one that lets a typo through to a bounce.
const LOOKS_LIKE_EMAIL = /^[^@\s]+@[^@\s.]+(\.[^@\s.]+)+$/;

/*
 * The second way forward: register interest in the paid product.
 *
 * Someone signed in is asked to confirm the address we already have rather than
 * type it again - but it is a confirmation, not an assumption, because the
 * account address and the one they want product mail at are not always the same.
 */
export default function WaitlistCard({ access, onJoined }) {
  const [email, setEmail] = useState("");
  const [known, setKnown] = useState(false);
  const [state, setState] = useState(access.waitlist_joined ? "done" : "idle");
  const [error, setError] = useState("");
  const { lang } = useLang();
  const c = useCopy(COPY);

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
      setError(c.invalid);
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
      setError(serverMessage(lang, err.message) || c.failed);
      setState("idle");
    }
  };

  if (state === "done") {
    return (
      <div className="vz-card vwl" role="status">
        <h2>{c.doneTitle}</h2>
        <p className="sub">{c.doneSub}</p>
      </div>
    );
  }

  const busy = state === "saving";

  return (
    // noValidate: the browser's own bubble for a malformed address is styled
    // nothing like this page and appears in a different place each engine, so
    // the check below owns the message.
    <form className="vz-card vwl" onSubmit={submit} noValidate>
      <h2>{c.title}</h2>
      <p className="sub">
        {c.sub} {known ? c.confirmKnown : c.leaveEmail}
      </p>

      <label className="ev-f">
        <span className="fl">{c.email}</span>
        <input
          type="email"
          autoComplete="email"
          value={email}
          disabled={busy}
          onChange={(e) => { setEmail(e.target.value); setError(""); }}
          placeholder="you@example.com"
          aria-invalid={error ? "true" : undefined}
        />
      </label>

      {error && <p className="vfb-err" role="alert">{error}</p>}

      <button type="submit" className="ev-submit vwl-submit" disabled={busy}>
        {busy ? c.adding : known ? c.confirm : c.join}
      </button>
    </form>
  );
}
