import { lazy, Suspense } from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import ProtectedRoute from "./components/ProtectedRoute";
import AppShell from "./components/shell/AppShell";
import AccountGate from "./components/auth/AccountGate";

// Lazy load components for better performance
const HomePage = lazy(() => import("./pages/HomePage"));
const LoginPage = lazy(() => import("./pages/LoginPage"));
const SignupPage = lazy(() => import("./pages/SignupPage"));
const ForgotPasswordPage = lazy(() => import("./pages/ForgotPasswordPage"));
const LevelSelection = lazy(() => import("./ChooseLevels"));
const Chat = lazy(() => import("./pages/Chat"));
const FAQPage = lazy(() => import("./pages/FAQPage"));
const AboutPage = lazy(() => import("./pages/AboutPage"));
const PrivacyPolicyPage = lazy(() => import("./pages/PrivacyPolicyPage"));
const TermsOfServicePage = lazy(() => import("./pages/TermsOfServicePage"));
const AdminPage = lazy(() => import("./pages/AdminPage"));
const TakeATestPage = lazy(() => import("./pages/TakeATestPage"));
const VoiceInterviewPage = lazy(() => import("./pages/VoiceInterviewPage"));
const CaseBuilderPage = lazy(() => import("./pages/CaseBuilderPage"));
const AnswersPage = lazy(() => import("./pages/AnswersPage"));
const CheckProfilePage = lazy(() => import("./pages/CheckProfilePage"));
const DataPage = lazy(() => import("./pages/DataPage"));

// Shown while a page's code downloads - usually a blink. A quiet line, not a
// full-screen animation in a different design.
const LoadingFallback = () => <p className="route-wait" role="status">Loading…</p>;

export default function App() {
  return (
    <Suspense fallback={<LoadingFallback />}>
    <Routes>
        {/* Every public page sits in the shell: sidebar, header, one design.
            The legacy chat flow and the admin panel stay outside it. */}
        <Route path="/" element={<AppShell><HomePage /></AppShell>} />
        <Route path="/take-a-test" element={<AppShell><TakeATestPage /></AppShell>} />
        <Route path="/voice-interview" element={<AppShell><VoiceInterviewPage /></AppShell>} />
        <Route path="/case-builder" element={<AppShell><CaseBuilderPage /></AppShell>} />
        <Route path="/answers" element={<AppShell><AnswersPage /></AppShell>} />
        {/* Scoring needs an account. A signed-out visitor sees, in place, why
            and the form to make one - not a redirect to a bare login screen. */}
        <Route
          path="/check-profile"
          element={
            <AppShell>
              <ProtectedRoute gate={AccountGate}><CheckProfilePage /></ProtectedRoute>
            </AppShell>
          }
        />
        <Route path="/login" element={<AppShell><LoginPage /></AppShell>} />
        <Route path="/signup" element={<AppShell><SignupPage /></AppShell>} />
        <Route path="/forgot-password" element={<AppShell><ForgotPasswordPage /></AppShell>} />
        <Route path="/data" element={<AppShell><DataPage /></AppShell>} />
        <Route path="/faq" element={<AppShell><FAQPage /></AppShell>} />
        <Route path="/about" element={<AppShell><AboutPage /></AppShell>} />
        <Route path="/privacy" element={<AppShell><PrivacyPolicyPage /></AppShell>} />
        <Route path="/terms" element={<AppShell><TermsOfServicePage /></AppShell>} />
        <Route
          path="/choose-level"
          element={
            <ProtectedRoute>
              <LevelSelection />
            </ProtectedRoute>
          }
        />
      <Route
          path="/chat"
        element={
          <ProtectedRoute>
              <Chat />
          </ProtectedRoute>
        }
      />
      {/* AdminPage checks admin status itself and redirects non-admins home;
          ProtectedRoute only guarantees the user is logged in. */}
      <Route
        path="/lev"
        element={
          <ProtectedRoute>
            <AdminPage />
          </ProtectedRoute>
        }
      />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
    </Suspense>
  );
}
