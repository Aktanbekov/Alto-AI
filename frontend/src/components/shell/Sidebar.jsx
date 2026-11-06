import { NavLink, Link } from "react-router-dom";
import { useCopy } from "../../i18n";
import LanguageSwitch from "../../i18n/LanguageSwitch";

// The four destinations from the design brief. "Profile check" is the working
// evaluator, and the name the home page, the page itself and the search
// listing all use; the other three are prototype screens with no backend yet,
// which is what their "Soon" badge says.
const NAV = [
  { to: "/check-profile", key: "check", icon: ClipboardIcon },
  { to: "/voice-interview", key: "voice", icon: MicIcon, soon: true },
  { to: "/case-builder", key: "builder", icon: BlocksIcon, soon: true },
  { to: "/answers", key: "answers", icon: ChatIcon, soon: true },
];

// Only pages that exist. The preview screens are reachable from Explore, marked Soon, and nowhere
// else - a second, unmarked link to them reads as a working feature.
const LEARN = [
  { to: "/data", key: "data", icon: ChartIcon },
  { to: "/about", key: "about", icon: CompassIcon },
  { to: "/faq", key: "faq", icon: BookIcon },
  { to: "/pricing", key: "pricing", icon: TagIcon },
];

const COPY = {
  en: {
    sections: "Sections",
    explore: "Explore",
    learn: "Learn",
    account: "Account",
    soon: "Soon",
    comingSoon: "coming soon",
    labels: {
      check: "Profile check",
      voice: "Voice Interview",
      builder: "Custom Case Builder",
      answers: "Questions/Answers",
      data: "The data",
      about: "How it works",
      faq: "Questions",
      pricing: "Pricing",
    },
    why: "The profile check needs a free account. It counts your free rounds and remembers where you got to.",
    signup: "Create free account",
    login: "Log in",
    signedIn: "Signed in",
    admin: "Admin panel",
    logout: "Log out",
    legal: "Legal",
    terms: "Terms",
    privacy: "Privacy",
    refunds: "Refunds",
    note: "Interview data updated monthly",
  },
  ru: {
    sections: "Разделы",
    explore: "Инструменты",
    learn: "Узнать больше",
    account: "Аккаунт",
    soon: "Скоро",
    comingSoon: "скоро",
    labels: {
      check: "Проверка профиля",
      voice: "Голосовое собеседование",
      builder: "Конструктор кейса",
      answers: "Вопросы и ответы",
      data: "Данные",
      about: "Как это работает",
      faq: "Частые вопросы",
      pricing: "Тарифы",
    },
    why: "Для проверки профиля нужен бесплатный аккаунт. Он считает ваши бесплатные раунды и запоминает, где вы остановились.",
    signup: "Создать аккаунт бесплатно",
    login: "Войти",
    signedIn: "Вы вошли",
    admin: "Админ-панель",
    logout: "Выйти",
    legal: "Документы",
    terms: "Условия",
    privacy: "Конфиденциальность",
    refunds: "Возвраты",
    note: "Данные о собеседованиях обновляются ежемесячно",
  },
};

export default function Sidebar({ open, onNavigate, user, isAdmin, onLogout, onAuth }) {
  const c = useCopy(COPY);
  return (
    <aside id="app-side" className={`app-side${open ? " is-open" : ""}`} aria-label={c.sections}>
      <NavLink to="/" className="brand" onClick={onNavigate}>
        <img src="/logo.svg" alt="" width="30" height="30" />
        Altovisas
      </NavLink>

      <div className="side-label">{c.explore}</div>
      <nav className="app-nav">
        {NAV.map((item) => {
          const Icon = item.icon;
          const label = c.labels[item.key];

          // Not-yet-built screens render as inert rows rather than links, so
          // the badge and the behaviour agree - nothing to click, nowhere to go.
          if (item.soon) {
            return (
              <span
                key={item.to}
                className="app-navitem is-soon"
                aria-disabled="true"
                title={`${label} - ${c.comingSoon}`}
              >
                <Icon />
                <span className="lbl">{label}</span>
                <span className="soon">{c.soon}</span>
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
              <span className="lbl">{label}</span>
            </NavLink>
          );
        })}
      </nav>

      <div className="side-label">{c.learn}</div>
      <nav className="app-nav">
        {LEARN.map((item) => {
          const Icon = item.icon;
          return (
            <NavLink
              key={item.key}
              to={item.to}
              onClick={onNavigate}
              className={({ isActive }) => `app-navitem${isActive ? " is-active" : ""}`}
            >
              <Icon />
              {c.labels[item.key]}
            </NavLink>
          );
        })}
      </nav>

      {/* Signed out, the drawer is where a phone finds the way in - the header
          has room for the brand and the menu button only. */}
      {!user && onAuth && (
        <div className="side-account side-guest">
          <div className="side-label">{c.account}</div>
          <p className="side-why">{c.why}</p>
          <button type="button" className="side-cta" onClick={() => onAuth("signup")}>
            {c.signup}
          </button>
          <button type="button" className="app-navitem" onClick={() => onAuth("login")}>
            <EnterIcon />
            <span className="lbl">{c.login}</span>
          </button>
        </div>
      )}

      {user && (
        <div className="side-account">
          <div className="side-label">{c.account}</div>
          <div className="side-who">
            <p className="side-name">{user.name || c.signedIn}</p>
            {user.email && <p className="side-mail">{user.email}</p>}
          </div>

          {isAdmin && (
            <NavLink
              to="/lev"
              onClick={onNavigate}
              className={({ isActive }) => `app-navitem${isActive ? " is-active" : ""}`}
            >
              <ShieldIcon />
              <span className="lbl">{c.admin}</span>
            </NavLink>
          )}

          <button
            type="button"
            className="app-navitem is-danger"
            onClick={() => { onNavigate?.(); onLogout?.(); }}
          >
            <ExitIcon />
            <span className="lbl">{c.logout}</span>
          </button>
        </div>
      )}

      <div className="side-foot">
        {/* Signed in on a wide screen the header row collapses, and the
            switch with it - so the rail carries its own. */}
        {user && <LanguageSwitch className="side-lang" />}
        <nav className="side-legal" aria-label={c.legal}>
          <Link to="/terms" onClick={onNavigate}>{c.terms}</Link>
          <Link to="/privacy" onClick={onNavigate}>{c.privacy}</Link>
          <Link to="/refund-policy" onClick={onNavigate}>{c.refunds}</Link>
        </nav>
        <p className="side-note">{c.note}</p>
      </div>
    </aside>
  );
}

/* Inline icons - a handful of strokes each, not worth an icon dependency. */
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
function TagIcon() {
  return base(<>
    <path d="M3 12.2V4a1 1 0 0 1 1-1h8.2a1 1 0 0 1 .7.3l8 8a1 1 0 0 1 0 1.4l-8.2 8.2a1 1 0 0 1-1.4 0l-8-8a1 1 0 0 1-.3-.7z" /><circle cx="8" cy="8" r="1.6" />
  </>);
}
function CompassIcon() {
  return base(<>
    <circle cx="12" cy="12" r="9" /><path d="m15.5 8.5-2 5-5 2 2-5z" />
  </>);
}
function ShieldIcon() {
  return base(<>
    <path d="M12 3l7 3v6c0 4-3 7.2-7 9-4-1.8-7-5-7-9V6z" /><path d="m9 12 2 2 4-4" />
  </>);
}
function EnterIcon() {
  return base(<>
    <path d="M9 4h9a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1H9" /><path d="m12 15 3-3-3-3M15 12H4" />
  </>);
}
function ExitIcon() {
  return base(<>
    <path d="M15 20H6a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1h9" /><path d="m17 15 3-3-3-3M20 12H9" />
  </>);
}
function ChatIcon() {
  return base(<>
    <path d="M20 15a2 2 0 0 1-2 2H8l-4 3V6a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2z" /><path d="M8 9h8M8 12h5" />
  </>);
}
