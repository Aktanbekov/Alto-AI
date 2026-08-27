import { lazy, Suspense } from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import ProtectedRoute from "./components/ProtectedRoute";
import AppShell from "./components/shell/AppShell";

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

// Loading fallback component
const LoadingFallback = () => (
  <div className="min-h-screen bg-stone-50 flex items-center justify-center">
    <div className="text-center">
      <div className="text-6xl mb-4 animate-bounce">🤖</div>
      <div className="text-stone-700">Loading...</div>
    </div>
  </div>
);

export default function App() {
  return (
    <Suspense fallback={<LoadingFallback />}>
    <Routes>
        {/* Alto Visas shell: sidebar + the new design. Auth, chat and admin
            stay outside it and keep the existing indigo/stone layout. */}
        <Route path="/" element={<AppShell><HomePage /></AppShell>} />
        <Route path="/take-a-test" element={<AppShell><TakeATestPage /></AppShell>} />
        <Route path="/voice-interview" element={<AppShell><VoiceInterviewPage /></AppShell>} />
        <Route path="/case-builder" element={<AppShell><CaseBuilderPage /></AppShell>} />
        <Route path="/answers" element={<AppShell><AnswersPage /></AppShell>} />
        <Route path="/check-profile" element={<AppShell><CheckProfilePage /></AppShell>} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/signup" element={<SignupPage />} />
        <Route path="/forgot-password" element={<ForgotPasswordPage />} />
        <Route path="/faq" element={<FAQPage />} />
        <Route path="/about" element={<AboutPage />} />
        <Route path="/privacy" element={<PrivacyPolicyPage />} />
        <Route path="/terms" element={<TermsOfServicePage />} />
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
        path="/admin"
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
