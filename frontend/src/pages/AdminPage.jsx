import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  getAdminMe, getAdminStats,
  listAdminUsers, getAdminUser, deleteAdminUser, verifyAdminUser,
  listAdminInterviews, getAdminInterview,
  getAdminQuestions, saveAdminQuestions,
  getEvaluatorHealth,
} from "../api";
import AdminDashboard from "../components/admin/AdminDashboard";
import AdminUsers from "../components/admin/AdminUsers";
import AdminInterviews from "../components/admin/AdminInterviews";
import AdminQuestions from "../components/admin/AdminQuestions";
import AdminEvaluator from "../components/admin/AdminEvaluator";
import AdminAnalytics from "../components/admin/AdminAnalytics";

const TABS = [
  { id: "dashboard", label: "Dashboard" },
  { id: "users", label: "Users" },
  { id: "interviews", label: "Interviews" },
  { id: "questions", label: "Questions" },
  { id: "evaluator", label: "Evaluator" },
  { id: "analytics", label: "Analytics" },
];

export default function AdminPage() {
  const navigate = useNavigate();
  const [checking, setChecking] = useState(true);
  const [admin, setAdmin] = useState(null);
  const [tab, setTab] = useState("dashboard");

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

  if (checking) {
    return (
      <div className="min-h-screen bg-stone-50 flex items-center justify-center">
        <p className="text-stone-600">Checking access…</p>
      </div>
    );
  }
  if (!admin) return null;

  return (
    <div className="min-h-screen bg-stone-50">
      <header className="bg-white border-b border-stone-200 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <button
              onClick={() => navigate("/")}
              className="flex items-center gap-2 bg-transparent border-none p-0"
            >
              <img src="/logo.svg" alt="" className="h-8 w-auto" />
            </button>
            <div className="min-w-0">
              <h1 className="text-lg font-bold text-stone-900 leading-tight">Admin</h1>
              <p className="text-xs text-stone-600 truncate">{admin.email}</p>
            </div>
          </div>
          <button
            onClick={() => navigate("/")}
            className="text-sm text-stone-700 hover:text-indigo-700 transition-colors whitespace-nowrap"
          >
            Back to site
          </button>
        </div>
        <nav className="max-w-7xl mx-auto px-4 sm:px-6 flex gap-1 overflow-x-auto">
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`px-4 py-2.5 text-sm font-medium border-b-2 -mb-px whitespace-nowrap transition-colors ${
                tab === t.id
                  ? "border-indigo-700 text-indigo-700"
                  : "border-transparent text-stone-600 hover:text-stone-900"
              }`}
            >
              {t.label}
            </button>
          ))}
        </nav>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
        {tab === "dashboard" && <AdminDashboard load={getAdminStats} />}
        {tab === "users" && (
          <AdminUsers
            list={listAdminUsers}
            get={getAdminUser}
            remove={deleteAdminUser}
            verify={verifyAdminUser}
          />
        )}
        {tab === "interviews" && (
          <AdminInterviews list={listAdminInterviews} get={getAdminInterview} />
        )}
        {tab === "evaluator" && <AdminEvaluator load={getEvaluatorHealth} />}
        {tab === "analytics" && <AdminAnalytics />}
        {tab === "questions" && (
          <AdminQuestions load={getAdminQuestions} save={saveAdminQuestions} />
        )}
      </main>
    </div>
  );
}
