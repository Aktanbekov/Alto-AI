import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";

function initials(user) {
  const source = (user?.name || user?.email || "U").trim();
  const parts = source.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return source.slice(0, 2).toUpperCase();
}

/*
 * Avatar button plus its menu: account identity and sign-out.
 */
export default function ProfileMenu({ user, onLogout, isAdmin }) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef(null);
  const navigate = useNavigate();

  useEffect(() => {
    if (!open) return undefined;
    const onDown = (e) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false);
    };
    const onKey = (e) => e.key === "Escape" && setOpen(false);
    addEventListener("mousedown", onDown);
    addEventListener("keydown", onKey);
    return () => {
      removeEventListener("mousedown", onDown);
      removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div className="pm" ref={wrapRef}>
      <button
        className="pm-avatar"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="Account menu"
      >
        {user?.picture ? (
          <img src={user.picture} alt="" referrerPolicy="no-referrer" />
        ) : (
          <span>{initials(user)}</span>
        )}
      </button>

      {open && (
        <div className="pm-menu" role="menu">
          <div className="pm-head">
            <div className="pm-avatar sm" aria-hidden="true">
              {user?.picture ? (
                <img src={user.picture} alt="" referrerPolicy="no-referrer" />
              ) : (
                <span>{initials(user)}</span>
              )}
            </div>
            <div className="pm-id">
              <p className="pm-name">{user?.name || "Signed in"}</p>
              <p className="pm-mail">{user?.email}</p>
            </div>
          </div>

          {isAdmin && (
            <button
              className="pm-item"
              role="menuitem"
              onClick={() => { setOpen(false); navigate("/admin"); }}
            >
              Admin panel
            </button>
          )}

          <button
            className="pm-item danger"
            role="menuitem"
            onClick={() => { setOpen(false); onLogout(); }}
          >
            Log out
          </button>
        </div>
      )}
    </div>
  );
}
