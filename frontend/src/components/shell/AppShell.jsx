import { useState, useEffect, useCallback, useRef } from "react";
import { Link, useLocation } from "react-router-dom";
import Sidebar from "./Sidebar";
import GuillocheDefs from "./GuillocheDefs";
import AuthModal from "../auth/AuthModal";
import { getMe, logout, getAdminMe } from "../../api";
import { track } from "../../analytics";
import { ROUTES, SITE } from "../../seo/site";
import { ShellContext } from "./shellContext";


/*
 * The tab title for client-side navigation. The SEO build bakes a per-route
 * <title> into static HTML for crawlers, but a visitor moving between routes
 * inside the app otherwise keeps whichever title the first page loaded with.
 * Indexable routes reuse the crawler title; the rest are named here.
 */
const TITLES = {
  "/login": "Log in",
  "/signup": "Create your account",
  "/forgot-password": "Reset your password",
  "/take-a-test": "Voice practice (preview)",
  "/voice-interview": "Voice interview (preview)",
  "/case-builder": "Case builder (preview)",
  "/answers": "Answer library (preview)",
};
function titleFor(pathname) {
  const seo = ROUTES.find((r) => r.path === pathname);
  if (seo) return seo.title;
  return TITLES[pathname] ? `${TITLES[pathname]} | ${SITE.name}` : SITE.name;
}

// Wraps every public route: sidebar, one header row, and the auth controls.
//
// On a wide screen the brand and navigation live in the sidebar, so the header
// carries only the sign-in pair (and disappears once signed in). Below the
// sidebar breakpoint the header is the only chrome left, so it always carries
// the brand and the menu button, signed in or not.
export default function AppShell({ children }) {
  const [open, setOpen] = useState(false);
  const [auth, setAuth] = useState({ open: false, mode: "login" });
  const [user, setUser] = useState(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const { pathname, hash } = useLocation();
  const burgerRef = useRef(null);

  // One page_view per route change. referrer is only meaningful on the first
  // view of a visit; later ones carry the path they came from.
  useEffect(() => {
    track("page_view", { referrer: document.referrer || "" });
    document.title = titleFor(pathname);
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

  // A route change closes the drawer and the sign-in dialog - "Forgot
  // password?" inside the dialog is a link to its own page.
  useEffect(() => {
    setOpen(false);
    setAuth((a) => (a.open ? { ...a, open: false } : a));
  }, [pathname]);

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

  // Escape closes the drawer and hands focus back to the button that opened
  // it, so a keyboard user is not left focused on something now hidden.
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => {
      if (e.key !== "Escape") return;
      setOpen(false);
      burgerRef.current?.focus();
    };
    addEventListener("keydown", onKey);
    document.querySelector("#app-side a, #app-side button")?.focus();
    return () => removeEventListener("keydown", onKey);
  }, [open]);

  const closeAuth = useCallback(() => setAuth((a) => ({ ...a, open: false })), []);
  const openAuth = useCallback((mode = "login") => {
    setOpen(false);
    setAuth({ open: true, mode });
  }, []);

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
    <ShellContext.Provider value={{ user, setUser, openAuth }}>
    <div className="app-root">
      <GuillocheDefs />

      {open && <div className="app-scrim" onClick={() => setOpen(false)} />}

      <div className="app-shell">
        <Sidebar
          open={open}
          onNavigate={() => setOpen(false)}
          user={user}
          isAdmin={isAdmin}
          onLogout={signOut}
          onAuth={openAuth}
        />

        <main className="app-main">
          <header className={`page-head${user ? " is-quiet" : ""}`}>
            <div className="page-w page-head-in">
              <Link to="/" className="page-brand">
                <img src="/logo.svg" alt="" width="26" height="26" />
                Altovisas
              </Link>
              <div className="page-spacer" />

              <div className="page-account">
                {!user && (
                  <>
                    <button className="hdr-login" onClick={() => openAuth("login")}>
                      Log in
                    </button>
                    <button className="hdr-signup" onClick={() => openAuth("signup")}>
                      Create free account
                    </button>
                  </>
                )}
                <button
                  ref={burgerRef}
                  className="app-burger"
                  aria-label={open ? "Close menu" : "Open menu"}
                  aria-expanded={open}
                  aria-controls="app-side"
                  onClick={() => setOpen((v) => !v)}
                >
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none"
                    stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
                    {open
                      ? <path d="M6 6l12 12M18 6L6 18" />
                      : <path d="M4 7h16M4 12h16M4 17h16" />}
                  </svg>
                </button>
              </div>
            </div>
          </header>

          {children}
        </main>
      </div>

      <AuthModal
        open={auth.open}
        mode={auth.mode}
        onClose={closeAuth}
        onAuthed={setUser}
        redirect={pathname}
      />
    </div>
    </ShellContext.Provider>
  );
}
