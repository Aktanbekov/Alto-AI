import { NavLink, Link } from "react-router-dom";

// The four destinations from the design brief. "Take a test" points at the
// working evaluator; the other three are prototype screens with no backend
// yet, which is what their "Soon" badge says.
const NAV = [
  { to: "/check-profile", label: "Take a test", icon: ClipboardIcon },
  { to: "/voice-interview", label: "Voice Interview", icon: MicIcon, soon: true },
  { to: "/case-builder", label: "Custom Case Builder", icon: BlocksIcon, soon: true },
  { to: "/answers", label: "Questions/Answers", icon: ChatIcon, soon: true },
];

// Moved out of the page header so it holds one row. "The data" targets a
// section of the home page rather than a route; AppShell scrolls to it once
// the section has actually rendered.
const LEARN = [
  { href: "/#the-data", label: "The data", icon: ChartIcon },
  { to: "/answers", label: "Answer library", icon: BookIcon },
  { to: "/case-builder", label: "How this works", icon: CompassIcon },
];

export default function Sidebar({ open, onNavigate }) {
  return (
    <aside className={`app-side${open ? " is-open" : ""}`} aria-label="Sections">
      <NavLink to="/" className="brand" onClick={onNavigate}>
        <img src="/logo.svg" alt="" width="30" height="30" />
        Alto Visas
      </NavLink>

      <div className="side-label">Explore</div>
      <nav className="app-nav">
        {NAV.map((item) => {
          const Icon = item.icon;

          // Not-yet-built screens render as inert rows rather than links, so
          // the badge and the behaviour agree — nothing to click, nowhere to go.
          if (item.soon) {
            return (
              <span
                key={item.to}
                className="app-navitem is-soon"
                aria-disabled="true"
                title={`${item.label} — coming soon`}
              >
                <Icon />
                <span className="lbl">{item.label}</span>
                <span className="soon">Soon</span>
              </span>
            );
          }

          return (
            <NavLink
              key={item.to}
              to={item.to}
              onClick={onNavigate}
              className={({ isActive }) => `app-navitem${isActive ? " is-active" : ""}`}
            >
              <Icon />
              <span className="lbl">{item.label}</span>
            </NavLink>
          );
        })}
      </nav>

      <div className="side-label">Learn</div>
      <nav className="app-nav">
        {LEARN.map((item) => {
          const Icon = item.icon;
          if (item.href) {
            return (
              <Link key={item.label} to={item.href} className="app-navitem" onClick={onNavigate}>
                <Icon />
                {item.label}
              </Link>
            );
          }
          return (
            <NavLink
              key={item.label}
              to={item.to}
              onClick={onNavigate}
              className={({ isActive }) => `app-navitem${isActive ? " is-active" : ""}`}
            >
              <Icon />
              {item.label}
            </NavLink>
          );
        })}
      </nav>

      <div className="side-foot">
        <nav className="side-legal" aria-label="Legal">
          <Link to="/terms" onClick={onNavigate}>Terms</Link>
          <Link to="/privacy" onClick={onNavigate}>Privacy</Link>
          <Link to="/faq" onClick={onNavigate}>FAQ</Link>
          <Link to="/about" onClick={onNavigate}>About</Link>
        </nav>
        <p className="side-note">Prototype · data updated monthly</p>
      </div>
    </aside>
  );
}

/* Inline icons — a handful of strokes each, not worth an icon dependency. */
function base(children) {
  return (
    <svg className="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {children}
    </svg>
  );
}
function ClipboardIcon() {
  return base(<>
    <path d="M9 4h6v3H9z" /><path d="M8 5H6a1 1 0 0 0-1 1v13a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V6a1 1 0 0 0-1-1h-2" />
    <path d="M9 12h6M9 16h4" />
  </>);
}
function MicIcon() {
  return base(<>
    <rect x="9" y="3" width="6" height="11" rx="3" /><path d="M5 11a7 7 0 0 0 14 0" /><path d="M12 18v3" />
  </>);
}
function BlocksIcon() {
  return base(<>
    <rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" />
    <rect x="3" y="14" width="7" height="7" rx="1" /><path d="M17.5 14v7M14 17.5h7" />
  </>);
}
function ChartIcon() {
  return base(<>
    <path d="M4 20V10M10 20V4M16 20v-6M22 20H2" />
  </>);
}
function BookIcon() {
  return base(<>
    <path d="M4 4.5A2.5 2.5 0 0 1 6.5 2H20v16H6.5A2.5 2.5 0 0 0 4 20.5z" /><path d="M8 7h8M8 11h5" />
  </>);
}
function CompassIcon() {
  return base(<>
    <circle cx="12" cy="12" r="9" /><path d="m15.5 8.5-2 5-5 2 2-5z" />
  </>);
}
function ChatIcon() {
  return base(<>
    <path d="M20 15a2 2 0 0 1-2 2H8l-4 3V6a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2z" /><path d="M8 9h8M8 12h5" />
  </>);
}
