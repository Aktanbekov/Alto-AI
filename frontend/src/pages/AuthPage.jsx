import { useState } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";

// Minimal inline SVG icons so you don't need extra deps
const MailIcon = (props) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
    <path d="M4 4h16v16H4z" opacity=".15"></path>
    <path d="M4 4h16v16H4z" />
    <path d="m22 6-10 7L2 6" />
  </svg>
);
const LockIcon = (props) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
    <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
    <path d="M7 11V7a5 5 0 0 1 10 0v4" />
  </svg>
);
const EyeIcon = (props) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
    <path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7S1 12 1 12Z" />
    <circle cx="12" cy="12" r="3" />
  </svg>
);
const EyeOffIcon = (props) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
    <path d="M17.94 17.94A10.94 10.94 0 0 1 12 20c-7 0-11-8-11-8a20.77 20.77 0 0 1 5.06-5.94" />
    <path d="M1 1l22 22" />
    <path d="M10.58 10.58a3 3 0 0 0 4.24 4.24" />
    <path d="M9.88 4.24A10.94 10.94 0 0 1 12 4c7 0 11 8 11 8a20.8 20.8 0 0 1-3.78 5.11" />
  </svg>
);
const GoogleIcon = (props) => (
  <svg viewBox="0 0 533.5 544.3" {...props}>
    <path fill="#EA4335" d="M533.5 278.4c0-18.5-1.6-37-5-54.8H272v103.8h146.9c-6.3 34.6-25.4 64-54.2 83.7v69.5h87.7c51.3-47.3 81.1-117.1 81.1-202.2z"/>
    <path fill="#34A853" d="M272 544.3c73.4 0 135.2-24.3 180.3-66.1l-87.7-69.5c-24.3 16.3-55.4 25.9-92.6 25.9-70.9 0-131-47.8-152.5-112.1H28.1v70.4C73.7 485.3 166.4 544.3 272 544.3z"/>
    <path fill="#4A90E2" d="M119.5 322.5c-9.4-28.2-9.4-59 0-87.2V164.9H28.1C-9.4 235.8-9.4 308.5 28.1 379.4l91.4-56.9z"/>
    <path fill="#FBBC05" d="M272 106.2c39.8-.6 78.3 14 107.5 41.5l80.1-80.1C408.8 24.1 343.9-.3 272 0 166.4 0 73.7 59 28.1 164.9l91.4 70.4C141 154 201.1 106.2 272 106.2z"/>
  </svg>
);

export default function AuthPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [loading, setLoading] = useState(false);
  const API_BASE = import.meta?.env?.VITE_API_BASE || "http://localhost:8080";

  const onSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      // Example local login endpoint (adjust to your backend)
      const res = await fetch(`${API_BASE}/api/v1/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ email, password }),
      });
      if (!res.ok) throw new Error("Invalid credentials");
      // Navigate to dashboard
      window.location.href = "/dashboard";
    } catch (err) {
      alert(err.message || "Login failed");
    } finally {
      setLoading(false);
    }
  };

  const googleLogin = () => {
    window.location.href = `${API_BASE}/auth/google`;
  };

  return (
    <div className="min-h-screen bg-[#0b0d10] text-slate-200 grid place-items-center px-4">
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35 }}
        className="w-full max-w-md"
      >
        {/* Card */}
        <div className="rounded-2xl bg-[#121418]/95 shadow-2xl ring-1 ring-white/5 p-8">
          {/* Logo */}
          <div className="flex items-center justify-center gap-2 mb-6 select-none">
            <svg width="34" height="34" viewBox="0 0 24 24" className="text-sky-400">
              <path fill="currentColor" d="M12 2l4.2 2.5v5L12 12l-4.2-2.5v-5z"/>
              <path fill="currentColor" opacity=".6" d="M7.8 9.5 12 12v5l-4.2-2.5zM16.2 9.5 12 12v5l4.2-2.5z"/>
            </svg>
            <span className="text-xl font-semibold tracking-wide">Alto</span>
          </div>

          <p className="text-sm text-slate-400 mb-6">
            Only login via email, Google, or phone number is supported in your region.
          </p>

          <form onSubmit={onSubmit} className="space-y-4">
            {/* Email */}
            <label className="block">
              <span className="text-sm text-slate-300">Phone number / email address</span>
              <div className="mt-1.5 relative">
                <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-500">
                  <MailIcon className="w-4 h-4" />
                </span>
                <input
                  type="text"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@example.com"
                  className="w-full bg-[#0f1115] border border-white/10 rounded-xl py-2.5 pl-10 pr-3 outline-none text-sm placeholder:text-slate-500 focus:ring-2 focus:ring-sky-500/50 focus:border-sky-500"
                />
              </div>
            </label>

            {/* Password */}
            <label className="block">
              <span className="text-sm text-slate-300">Password</span>
              <div className="mt-1.5 relative">
                <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-500">
                  <LockIcon className="w-4 h-4" />
                </span>
                <input
                  type={show ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full bg-[#0f1115] border border-white/10 rounded-xl py-2.5 pl-10 pr-10 outline-none text-sm placeholder:text-slate-500 focus:ring-2 focus:ring-sky-500/50 focus:border-sky-500"
                />
                <button
                  type="button"
                  onClick={() => setShow(s => !s)}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-500 hover:text-slate-300"
                  aria-label={show ? "Hide password" : "Show password"}
                >
                  {show ? <EyeOffIcon className="w-5 h-5"/> : <EyeIcon className="w-5 h-5"/>}
                </button>
              </div>
            </label>

            {/* Log in button */}
            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-xl py-2.5 text-sm font-medium bg-gradient-to-tr from-sky-500 to-indigo-500 hover:opacity-95 disabled:opacity-60 transition"
            >
              {loading ? "Logging in…" : "Log in"}
            </button>

            <div className="flex justify-between text-xs text-slate-400">
              <a className="hover:text-slate-200" href="#">Forgot password?</a>
              <a className="hover:text-slate-200" href="#">Sign up</a>
            </div>

            {/* Divider */}
            <div className="relative my-3">
              <div className="h-px bg-white/10" />
              <span className="absolute -top-2 left-1/2 -translate-x-1/2 bg-[#121418] px-3 text-[11px] text-slate-400">OR</span>
            </div>

            {/* Google login */}
            <button
              type="button"
              onClick={googleLogin}
              className="w-full border border-white/10 rounded-xl py-2.5 text-sm font-medium bg-[#0f1115] hover:bg-[#131620] transition flex items-center justify-center gap-2"
            >
              <GoogleIcon className="w-4 h-4" />
              <span>Log in with Google</span>
            </button>
          </form>
        </div>

        {/* Footer */}
        <p className="text-center text-[11px] text-slate-500 mt-6">
          By signing up or logging in, you agree to Altovisas' <Link className="underline underline-offset-2 hover:text-slate-300" to="/terms">Terms of Service</Link> and <Link className="underline underline-offset-2 hover:text-slate-300" to="/privacy">Privacy Policy</Link>.
        </p>
      </motion.div>
    </div>
  );
}
