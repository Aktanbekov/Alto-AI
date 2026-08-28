import { useState } from "react";
import { useNavigate, Link, useLocation } from "react-router-dom";
import { forgotPassword, resetPassword } from "../api";
import { keepRedirect } from "../utils/authRedirect";

// Minimal inline SVG icons
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

export default function ForgotPasswordPage() {
    const navigate = useNavigate();
    // A reset started from a gated page still owes the visitor their page back.
    const { search } = useLocation();
    const [step, setStep] = useState("request"); // "request" or "reset"
    const [email, setEmail] = useState("");
    const [code, setCode] = useState("");
    const [password, setPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [show, setShow] = useState(false);
    const [showConfirm, setShowConfirm] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");
    const [success, setSuccess] = useState("");

    const handleRequest = async (e) => {
        e.preventDefault();
        setError("");
        setSuccess("");
        setLoading(true);
        try {
            await forgotPassword(email);
            setSuccess("If an account exists with this email, a password reset code has been sent.");
            setStep("reset");
        } catch (err) {
            setError(err.message || "Request failed");
        } finally {
            setLoading(false);
        }
    };

    const handleReset = async (e) => {
        e.preventDefault();
        setError("");

        if (password !== confirmPassword) {
            setError("Passwords do not match");
            return;
        }

        if (password.length < 6) {
            setError("Password must be at least 6 characters");
            return;
        }

        setLoading(true);
        try {
            await resetPassword(email, code, password);
            navigate(keepRedirect("/login", search));
        } catch (err) {
            setError(err.message || "Password reset failed");
        } finally {
            setLoading(false);
        }
    };

    if (step === "reset") {
        return (
            <div className="min-h-screen bg-stone-50 grid place-items-center px-4 py-8 sm:py-12">
                <div className="w-full max-w-md animate-fade-in-up">
                    <div className="rounded-2xl bg-white shadow-2xl ring-1 ring-stone-200 p-6 sm:p-8">
                        <div className="flex items-center justify-center gap-2 sm:gap-3 mb-4 sm:mb-6 select-none">
                            <span className="text-3xl sm:text-4xl">🤖</span>
                            <span className="text-xl sm:text-2xl font-bold text-indigo-700">
                                AI Interviewer
                            </span>
                        </div>

                        {success && (
                            <div className="text-sm text-emerald-600 bg-emerald-50 border border-emerald-200 rounded-lg p-3 mb-4">
                                {success}
                            </div>
                        )}

                        <p className="text-xs sm:text-sm text-stone-700 mb-4 sm:mb-6 text-center">
                            Enter the reset code sent to <strong>{email}</strong> and your new password
                        </p>

                        <form onSubmit={handleReset} className="space-y-4">
                            <label className="block">
                                <span className="text-sm text-stone-700 font-medium">Reset Code</span>
                                <div className="mt-1.5 relative">
                                    <input
                                        type="text"
                                        value={code}
                                        onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                                        placeholder="000000"
                                        maxLength={6}
                                        className="w-full bg-stone-50 border border-stone-300 rounded-xl py-3 sm:py-2.5 px-3 outline-none text-sm placeholder:text-stone-400 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-stone-900 text-center text-xl sm:text-2xl tracking-widest min-h-[44px]"
                                    />
                                </div>
                            </label>

                            <label className="block">
                                <span className="text-sm text-stone-700 font-medium">New Password</span>
                                <div className="mt-1.5 relative">
                                    <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-stone-400">
                                        <LockIcon className="w-4 h-4" />
                                    </span>
                                    <input
                                        type={show ? "text" : "password"}
                                        value={password}
                                        onChange={(e) => setPassword(e.target.value)}
                                        placeholder="••••••••"
                                        className="w-full bg-stone-50 border border-stone-300 rounded-xl py-3 sm:py-2.5 pl-10 pr-10 outline-none text-sm placeholder:text-stone-400 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-stone-900 min-h-[44px]"
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShow(s => !s)}
                                        className="absolute inset-y-0 right-0 pr-3 flex items-center text-stone-400 hover:text-stone-700"
                                        aria-label={show ? "Hide password" : "Show password"}
                                    >
                                        {show ? <EyeOffIcon className="w-5 h-5" /> : <EyeIcon className="w-5 h-5" />}
                                    </button>
                                </div>
                            </label>

                            <label className="block">
                                <span className="text-sm text-stone-700 font-medium">Confirm New Password</span>
                                <div className="mt-1.5 relative">
                                    <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-stone-400">
                                        <LockIcon className="w-4 h-4" />
                                    </span>
                                    <input
                                        type={showConfirm ? "text" : "password"}
                                        value={confirmPassword}
                                        onChange={(e) => setConfirmPassword(e.target.value)}
                                        placeholder="••••••••"
                                        className="w-full bg-stone-50 border border-stone-300 rounded-xl py-3 sm:py-2.5 pl-10 pr-10 outline-none text-sm placeholder:text-stone-400 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-stone-900 min-h-[44px]"
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowConfirm(s => !s)}
                                        className="absolute inset-y-0 right-0 pr-3 flex items-center text-stone-400 hover:text-stone-700"
                                        aria-label={showConfirm ? "Hide password" : "Show password"}
                                    >
                                        {showConfirm ? <EyeOffIcon className="w-5 h-5" /> : <EyeIcon className="w-5 h-5" />}
                                    </button>
                                </div>
                            </label>

                            {error && (
                                <div className="text-sm text-rose-600 bg-rose-50 border border-rose-200 rounded-lg p-3">
                                    {error}
                                </div>
                            )}

                            <button
                                type="submit"
                                disabled={loading || code.length !== 6}
                                className="w-full rounded-xl py-3 sm:py-2.5 text-sm font-semibold bg-indigo-700 text-white hover:shadow-lg disabled:opacity-60 transition-all min-h-[44px]"
                            >
                                {loading ? "Resetting password…" : "Reset Password"}
                            </button>

                            <div className="text-center text-xs text-stone-600">
                                <button
                                    type="button"
                                    onClick={() => setStep("request")}
                                    className="hover:text-indigo-600 transition-colors"
                                >
                                    Back
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-stone-50 grid place-items-center px-4 py-8 sm:py-12">
            <div className="w-full max-w-md animate-fade-in-up">
                <div className="rounded-2xl bg-white shadow-2xl ring-1 ring-stone-200 p-6 sm:p-8">
                    <div className="flex items-center justify-center gap-2 sm:gap-3 mb-4 sm:mb-6 select-none">
                        <span className="text-3xl sm:text-4xl">🤖</span>
                        <span className="text-xl sm:text-2xl font-bold text-indigo-700">
                            AI Interviewer
                        </span>
                    </div>

                    <p className="text-xs sm:text-sm text-stone-700 mb-4 sm:mb-6 text-center">
                        Enter your email address and we'll send you a code to reset your password
                    </p>

                    <form onSubmit={handleRequest} className="space-y-4">
                        <label className="block">
                            <span className="text-sm text-stone-700 font-medium">Email address</span>
                            <div className="mt-1.5 relative">
                                <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-stone-400">
                                    <MailIcon className="w-4 h-4" />
                                </span>
                                <input
                                    type="email"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    placeholder="name@example.com"
                                    className="w-full bg-stone-50 border border-stone-300 rounded-xl py-3 sm:py-2.5 pl-10 pr-3 outline-none text-sm placeholder:text-stone-400 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-stone-900 min-h-[44px]"
                                />
                            </div>
                        </label>

                        {error && (
                            <div className="text-sm text-rose-600 bg-rose-50 border border-rose-200 rounded-lg p-3">
                                {error}
                            </div>
                        )}

                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full rounded-xl py-3 sm:py-2.5 text-sm font-semibold bg-indigo-700 text-white hover:shadow-lg disabled:opacity-60 transition-all min-h-[44px]"
                        >
                            {loading ? "Sending code…" : "Send Reset Code"}
                        </button>

                        <div className="text-center text-xs text-stone-600">
                            Remember your password?{" "}
                            <Link to={keepRedirect("/login", search)} className="hover:text-indigo-600 transition-colors font-medium">
                                Log in
                            </Link>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    );
}

