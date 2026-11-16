import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import {
  getAdminMe, getAdminStats, listPaymentRequests,
  listAdminInterviews, getAdminInterview,
  getAdminQuestions, saveAdminQuestions,
  getEvaluatorHealth,
} from "../api";
import AdminToday from "../components/admin/AdminToday";
import AdminPayments, { TelegramPanel } from "../components/admin/AdminPayments";
import AdminPeople from "../components/admin/AdminPeople";
import AdminDashboard from "../components/admin/AdminDashboard";
import AdminInterviews from "../components/admin/AdminInterviews";
import AdminQuestions from "../components/admin/AdminQuestions";
import AdminEvaluator from "../components/admin/AdminEvaluator";
import AdminAnalytics from "../components/admin/AdminAnalytics";
import AdminLinks from "../components/admin/AdminLinks";
import AdminPartners from "../components/admin/AdminPartners";

/*
 * The admin panel, organised around the three things the founder does:
 * answer new requests, look after a person's plan, and check how things are
 * going. Everything else - corpus analytics, tracking links, the question
 * bank, the evaluator - sits one level down under Insights and Settings, so
 * the daily work is never more than one click away.
 *
 * The section lives in the URL hash (#people, #insights/links), so a reload
 * or a shared link lands on the same screen.
 */

const SECTIONS = [
  { id: "today", label: "Today", title: "Today", sub: "Who is waiting to hear from you.", icon: SunIcon },
  { id: "requests", label: "Requests", title: "Requests", sub: "Every request from the checkout. Mark Bought to turn the plan on.", icon: InboxIcon },
  { id: "people", label: "People", title: "People", sub: "Accounts, their plans, and their history.", icon: PeopleIcon },
  { id: "partners", label: "Partners", title: "Partners", sub: "Links people share, the sales they bring, and what you owe them.", icon: PartnerIcon },
  {
    id: "insights", label: "Insights", title: "Insights", sub: "How the product is used.", icon: ChartIcon,
    tabs: [
      { id: "overview", label: "Overview" },
      { id: "funnel", label: "Funnel & reports" },
      { id: "interviews", label: "Interviews" },
      { id: "links", label: "Tracking links" },
    ],
  },
  {
    id: "settings", label: "Settings", title: "Settings", sub: "Notifications, the question bank and the evaluator.", icon: GearIcon,
    tabs: [
      { id: "telegram", label: "Telegram" },
      { id: "questions", label: "Question bank" },
      { id: "evaluator", label: "Evaluator" },
    ],
  },
];

function readHash() {
  const [section = "today", tab = ""] = window.location.hash.replace(/^#/, "").split("/");
  const s = SECTIONS.find((x) => x.id === section) || SECTIONS[0];
  const t = s.tabs ? (s.tabs.find((x) => x.id === tab) || s.tabs[0]).id : "";
  return { section: s.id, tab: t };
}

function useHashRoute() {
  const [route, setRoute] = useState(readHash);
  useEffect(() => {
    const on = () => setRoute(readHash());
    window.addEventListener("hashchange", on);
    return () => window.removeEventListener("hashchange", on);
  }, []);
  const go = useCallback((section, tab) => {
    const next = `#${section}${tab ? `/${tab}` : ""}`;
    if (window.location.hash !== next) window.location.hash = next;
    else setRoute(readHash());
  }, []);
  return [route, go];
}

export default function AdminPage() {
  const navigate = useNavigate();
  const [checking, setChecking] = useState(true);
  const [admin, setAdmin] = useState(null);
  const [route, go] = useHashRoute();
  const [waiting, setWaiting] = useState(null);

  useEffect(() => {
    let cancelled = false;
    getAdminMe()
      .then((res) => {
        if (cancelled) return;
        if (!res?.is_admin) {
          navigate("/", { replace: true });
          return;
        }
        setAdmin(res);
      })
      .finally(() => !cancelled && setChecking(false));
    return () => { cancelled = true; };
  }, [navigate]);

  // The rail's count: requests nobody has reached out to yet. Refreshed on
  // every section change, so it drops as the founder works the list.
  const refreshCount = useCallback(() => {
    listPaymentRequests({ limit: 200 })
      .then((d) => setWaiting((d.items || []).filter((r) => !r.contacted && r.contact !== "manual").length))
      .catch(() => setWaiting(null));
  }, []);
  useEffect(() => { if (admin) refreshCount(); }, [admin, route.section, refreshCount]);

  useEffect(() => {
    const s = SECTIONS.find((x) => x.id === route.section);
    document.title = `${s.title} · Admin · Altovisas`;
  }, [route.section]);

  if (checking) {
    return (
      <div className="adm" style={{ display: "grid", placeItems: "center" }}>
        <p style={{ color: "var(--ink-soft)" }}>Checking access…</p>
      </div>
    );
  }
  if (!admin) return null;

  const section = SECTIONS.find((x) => x.id === route.section);

  return (
    <div className="adm">
      <div className="adm-frame">
        <aside className="adm-rail" aria-label="Admin sections">
          <a href="/" className="adm-brand" onClick={(e) => { e.preventDefault(); navigate("/"); }}>
            <img src="/logo.svg" alt="Altovisas" />
            <span>Admin</span>
          </a>
          <nav className="adm-nav">
            {SECTIONS.map((s) => {
              const Icon = s.icon;
              return (
                <a
                  key={s.id}
                  href={`#${s.id}`}
                  aria-current={route.section === s.id ? "page" : undefined}
                >
                  <Icon />
                  {s.label}
                  {s.id === "requests" && waiting > 0 && (
                    <span className="adm-count" aria-label={`${waiting} waiting`}>{waiting}</span>
                  )}
                </a>
              );
            })}
          </nav>
          <div className="adm-rail-foot">
            <p>{admin.email}</p>
            <a href="/" onClick={(e) => { e.preventDefault(); navigate("/"); }}>Back to site</a>
          </div>
        </aside>

        <main className="adm-main">
          <header className="adm-head">
            <div>
              <h1>{section.title}</h1>
              <p>{section.sub}</p>
            </div>
          </header>

          {section.tabs && (
            <div className="adm-tabs" role="tablist" aria-label={`${section.title} views`}>
              {section.tabs.map((t) => (
                <button
                  key={t.id}
                  role="tab"
                  aria-selected={route.tab === t.id}
                  onClick={() => go(section.id, t.id)}
                >
                  {t.label}
                </button>
              ))}
            </div>
          )}

          {route.section === "today" && <AdminToday go={go} onChange={refreshCount} />}
          {route.section === "requests" && <AdminPayments onChange={refreshCount} go={go} />}
          {route.section === "people" && <AdminPeople />}
          {route.section === "partners" && <AdminPartners />}

          {route.section === "insights" && route.tab === "overview" && <AdminDashboard load={getAdminStats} />}
          {route.section === "insights" && route.tab === "funnel" && <AdminAnalytics />}
          {route.section === "insights" && route.tab === "interviews" && (
            <AdminInterviews list={listAdminInterviews} get={getAdminInterview} />
          )}
          {route.section === "insights" && route.tab === "links" && <AdminLinks />}

          {route.section === "settings" && route.tab === "telegram" && <TelegramPanel />}
          {route.section === "settings" && route.tab === "questions" && (
            <AdminQuestions load={getAdminQuestions} save={saveAdminQuestions} />
          )}
          {route.section === "settings" && route.tab === "evaluator" && <AdminEvaluator load={getEvaluatorHealth} />}
        </main>
      </div>
    </div>
  );
}

/* Rail icons, drawn in the same 1.7 stroke as the site's sidebar. */
function base(children) {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {children}
    </svg>
  );
}
function SunIcon() {
  return base(<><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" /></>);
}
function InboxIcon() {
  return base(<><path d="M3 13l2.5-8h13L21 13v6a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1z" /><path d="M3 13h5l1.5 3h5L16 13h5" /></>);
}
function PeopleIcon() {
  return base(<><circle cx="9" cy="8" r="3.5" /><path d="M2.5 20a6.5 6.5 0 0 1 13 0" /><path d="M16 4.6a3.5 3.5 0 0 1 0 6.8M18.5 14.4A6.5 6.5 0 0 1 21.5 20" /></>);
}
function PartnerIcon() {
  // A link: what a partner is given to share.
  return base(<><path d="M10 14a4.5 4.5 0 0 0 6.4 0l3.2-3.2a4.5 4.5 0 0 0-6.4-6.4L12 5.6" /><path d="M14 10a4.5 4.5 0 0 0-6.4 0l-3.2 3.2a4.5 4.5 0 0 0 6.4 6.4l1.2-1.2" /></>);
}
function ChartIcon() {
  return base(<path d="M4 20V10M10 20V4M16 20v-6M22 20H2" />);
}
function GearIcon() {
  return base(<><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" /></>);
}
