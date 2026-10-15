import { useEffect, useRef } from "react";
import AuthForm from "./AuthForm";

const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), select, textarea, [tabindex]:not([tabindex="-1"])';

/*
 * The sign-in form in a dialog, for the header's Log in / Create account.
 *
 * A real modal: focus moves in on open, Tab cycles inside it instead of
 * escaping to the page behind the scrim, Escape closes it, and focus goes
 * back to whatever opened it.
 */
export default function AuthModal({ open, mode = "login", onClose, onAuthed, redirect = "/" }) {
  const dialogRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    const opener = document.activeElement;

    const onKey = (e) => {
      if (e.key === "Escape") {
        onClose();
        return;
      }
      if (e.key !== "Tab" || !dialogRef.current) return;
      const items = [...dialogRef.current.querySelectorAll(FOCUSABLE)];
      if (!items.length) return;
      const first = items[0];
      const last = items[items.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    addEventListener("keydown", onKey);
    // Stop the page behind the dialog from scrolling while it is open.
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      removeEventListener("keydown", onKey);
      document.body.style.overflow = previous;
      if (opener && typeof opener.focus === "function") opener.focus();
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="auth-scrim"
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        ref={dialogRef}
        className="auth-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="dlg-title"
      >
        <button className="auth-close" onClick={onClose} aria-label="Close">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor"
            strokeWidth="2" strokeLinecap="round" aria-hidden="true">
            <path d="M6 6l12 12M18 6L6 18" />
          </svg>
        </button>

        <AuthForm
          key={mode}
          mode={mode}
          redirect={redirect}
          idPrefix="dlg"
          onAuthed={(user) => { onAuthed?.(user); onClose(); }}
        />
      </div>
    </div>
  );
}
