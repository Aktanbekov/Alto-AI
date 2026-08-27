import { useState, useEffect, useCallback } from "react";
import { useLocation } from "react-router-dom";
import Sidebar from "./Sidebar";
import GuillocheDefs from "./GuillocheDefs";
import ProfileMenu from "./ProfileMenu";
import AuthModal from "../auth/AuthModal";
import { getMe, logout, getAdminMe } from "../../api";
import { track } from "../../analytics";

// Wraps the Alto Visas routes: sidebar, one header row, and the auth controls.
//
// Navigation and the brand both live in the sidebar; the header carries only
// the account controls, so the name is never shown twice on one screen.
export default function AppShell({ children }) {
  const [open, setOpen] = useState(false);
  const [auth, setAuth] = useState({ open: false, mode: "login" });
  const [user, setUser] = useState(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const { pathname, hash } = useLocation();

  // One page_view per route change. referrer is only meaningful on the first
  // view of a visit; later ones carry the path they came from.
  useEffect(() => {
    track("page_view", { referrer: document.referrer || "" });
  }, [pathname]);

  useEffect(() => {
    let cancelled = false;
    getMe()
      .then((u) => !cancelled && setUser(u))
      .catch(() => !cancelled && setUser(null));
    return () => { cancelled = true; };
  }, [pathname]);

  // Only ask about admin rights once there is a session to ask about.
  useEffect(() => {
    if (!user) { setIsAdmin(false); return undefined; }
    let cancelled = false;
    getAdminMe()
      .then((r) => !cancelled && setIsAdmin(Boolean(r?.is_admin)))
      .catch(() => !cancelled && setIsAdmin(false));
    return () => { cancelled = true; };
  }, [user]);

  useEffect(() => { setOpen(false); }, [pathname]);

  // Scroll to a hash target such as #the-data. The browser's own attempt fires
  // before the dashboard's data arrives, so the section is either absent or in
  // the wrong place; re-align each frame until its offset stops moving.
  useEffect(() => {
    if (!hash) return undefined;
    let raf;
    let frames = 0;
    let settled = 0;
    let lastTop = -1;
    const tick = () => {
      const el = document.querySelector(hash);
      if (el) {
        const top = Math.round(el.getBoundingClientRect().top + window.scrollY);
        if (top !== lastTop) {
          lastTop = top;
          settled = 0;
          window.scrollTo({ top: Math.max(0, top - 12), behavior: "auto" });
        } else if (++settled > 4) {
          return;
        }
      }
      if (++frames < 90) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [pathname, hash]);

  useEffect(() => {
    const onKey = (e) => e.key === "Escape" && setOpen(false);
    addEventListener("keydown", onKey);
    return () => removeEventListener("keydown", onKey);
  }, []);

  const closeAuth = useCallback(() => setAuth((a) => ({ ...a, open: false })), []);

  const signOut = async () => {
    try {
      await logout();
    } catch {
      // logout() clears the local token regardless; a failed round-trip must
      // not leave the user looking signed in.
    }
    setUser(null);
    setIsAdmin(false);
  };

  return (
    <div className="app-root">
      <GuillocheDefs />

      {open && <div className="app-scrim" onClick={() => setOpen(false)} />}

      <div className="app-shell">
        <Sidebar open={open} onNavigate={() => setOpen(false)} />

        <main className="app-main">
          <header className="page-head">
            <div className="page-w page-head-in">
              <button
                className="app-burger"
                aria-label={open ? "Close menu" : "Open menu"}
                aria-expanded={open}
                onClick={() => setOpen((v) => !v)}
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none"
                  stroke="currentColor" strokeWidth="1.8">
                  {open
                    ? <path d="M6 6l12 12M18 6L6 18" />
                    : <path d="M4 7h16M4 12h16M4 17h16" />}
                </svg>
              </button>

              <div className="page-spacer" />

              <div className="page-account">
                {user ? (
                  <ProfileMenu
                    user={user}
                    onLogout={signOut}
                    isAdmin={isAdmin}
                  />
                ) : (
                  <>
                    <button
                      className="hdr-login"
                      onClick={() => setAuth({ open: true, mode: "login" })}
                    >
                      Login
                    </button>
                    <button
                      className="hdr-signup"
                      onClick={() => setAuth({ open: true, mode: "signup" })}
                    >
                      Sign up
                    </button>
                  </>
                )}
              </div>
            </div>
          </header>

          {children}
        </main>
      </div>

      <AuthModal open={auth.open} mode={auth.mode} onClose={closeAuth} onAuthed={setUser} />
    </div>
  );
}
