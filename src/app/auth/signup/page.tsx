"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import {
  Brain,
  Mail,
  Lock,
  Eye,
  EyeOff,
  ArrowRight,
  Loader2,
  CheckCircle2,
} from "lucide-react";

export default function SignupPage() {
  const router = useRouter();
  const supabase = createClient();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [showConf, setShowConf] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  // ── Password strength ───────────────────────────────────────────────────────
  const hasMinLength = password.length >= 8;
  const hasUppercase = /[A-Z]/.test(password);
  const hasNumber = /\d/.test(password);
  const passwordMatch = password === confirm && confirm.length > 0;

  const strengthScore = [hasMinLength, hasUppercase, hasNumber].filter(
    Boolean,
  ).length;
  const strengthLabel = ["", "Weak", "Fair", "Strong"][strengthScore];
  const strengthColor = ["", "bg-red-500", "bg-yellow-500", "bg-emerald-500"][
    strengthScore
  ];

  // ── Submit ──────────────────────────────────────────────────────────────────
  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    if (!passwordMatch) {
      setError("Passwords do not match.");
      return;
    }

    if (!hasMinLength) {
      setError("Password must be at least 8 characters.");
      return;
    }

    setLoading(true);

    try {
      const { error: signUpError } = await supabase.auth.signUp({
        email: email.trim().toLowerCase(),
        password,
        options: {
          emailRedirectTo: `${window.location.origin}/auth/callback`,
        },
      });

      if (signUpError) {
        const msg = signUpError.message;
        if (
          msg === "Failed to fetch" ||
          msg.includes("fetch") ||
          msg.includes("network") ||
          msg.includes("NetworkError")
        ) {
          setError(
            "Cannot reach the authentication server. Make sure your Supabase URL and anon key are set correctly in .env.local, then restart the dev server.",
          );
        } else {
          setError(msg);
        }
        return;
      }

      // Supabase may auto-confirm depending on your project settings.
      // Try to get the session immediately.
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (session) {
        router.push("/dashboard");
        router.refresh();
      } else {
        // Email confirmation is required
        setSuccess(true);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "";
      if (
        msg === "Failed to fetch" ||
        msg.includes("fetch") ||
        msg.includes("network")
      ) {
        setError(
          "Cannot reach the authentication server. Make sure your Supabase URL and anon key are set correctly in .env.local, then restart the dev server.",
        );
      } else {
        setError("An unexpected error occurred. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  }

  // ── Success screen ──────────────────────────────────────────────────────────
  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="w-full max-w-md text-center animate-scale-in">
          <div className="mb-6 flex justify-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-emerald-500/15 ring-1 ring-emerald-500/30">
              <CheckCircle2 className="h-8 w-8 text-emerald-400" />
            </div>
          </div>
          <h1 className="mb-2 text-2xl font-bold text-slate-100">
            Check your email
          </h1>
          <p className="mb-6 text-slate-400">
            We sent a confirmation link to{" "}
            <span className="font-medium text-slate-200">{email}</span>. Click
            it to activate your account and get started.
          </p>
          <Link href="/auth/login" className="btn btn-primary btn-md w-full">
            Back to Sign In
          </Link>
        </div>
      </div>
    );
  }

  // ── Form ────────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen flex">
      {/* ── Left panel — branding ── */}
      <div className="hidden lg:flex lg:w-1/2 flex-col items-center justify-center p-16 relative overflow-hidden">
        {/* Decorative blobs */}
        <div className="pointer-events-none absolute -top-32 -left-32 h-[600px] w-[600px] rounded-full bg-brand-600/10 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-32 -right-16 h-[500px] w-[500px] rounded-full bg-purple-600/08 blur-3xl" />

        <div className="relative z-10 max-w-md">
          <div className="mb-8 flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-gradient shadow-glow">
              <Brain className="h-6 w-6 text-white" />
            </div>
            <span className="text-xl font-bold text-white">
              AI Second Brain
            </span>
          </div>

          <h2 className="mb-4 text-4xl font-bold text-balance leading-tight">
            <span className="text-gradient">Store everything.</span>
            <br />
            <span className="text-slate-100">Recall anything.</span>
          </h2>

          <p className="mb-10 text-lg text-slate-400 leading-relaxed">
            Paste in your notes, ideas, and knowledge. Then ask questions and
            get answers powered by AI — grounded entirely in your own data.
          </p>

          {/* Feature list */}
          <ul className="space-y-4">
            {[
              { icon: "🧠", text: "RAG-powered answers from your notes" },
              { icon: "🔒", text: "Your data is private and isolated" },
              {
                icon: "⚡",
                text: "Instant semantic search across all memories",
              },
            ].map((item) => (
              <li key={item.text} className="flex items-center gap-3">
                <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl bg-surface-700 text-base ring-1 ring-white/8">
                  {item.icon}
                </span>
                <span className="text-sm text-slate-300">{item.text}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* ── Right panel — form ── */}
      <div className="flex w-full flex-col items-center justify-center p-6 lg:w-1/2">
        <div className="w-full max-w-md animate-fade-in">
          {/* Mobile logo */}
          <div className="mb-8 flex items-center gap-2 lg:hidden">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-gradient">
              <Brain className="h-5 w-5 text-white" />
            </div>
            <span className="font-bold text-white">AI Second Brain</span>
          </div>

          {/* Heading */}
          <div className="mb-8">
            <h1 className="text-2xl font-bold text-slate-100">
              Create your account
            </h1>
            <p className="mt-1 text-sm text-slate-400">
              Already have one?{" "}
              <Link
                href="/auth/login"
                className="font-medium text-brand-400 hover:text-brand-300"
              >
                Sign in
              </Link>
            </p>
          </div>

          {/* Error banner */}
          {error && (
            <div className="mb-5 flex items-start gap-3 rounded-xl border border-red-500/25 bg-red-500/10 px-4 py-3 text-sm text-red-400 animate-slide-down">
              <span className="mt-0.5 text-base">⚠</span>
              <span>{error}</span>
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-5" noValidate>
            {/* Email */}
            <div>
              <label htmlFor="email" className="label">
                Email address
              </label>
              <div className="relative">
                <Mail className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  autoComplete="email"
                  placeholder="you@example.com"
                  className="input pl-10"
                  disabled={loading}
                />
              </div>
            </div>

            {/* Password */}
            <div>
              <label htmlFor="password" className="label">
                Password
              </label>
              <div className="relative">
                <Lock className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
                <input
                  id="password"
                  type={showPass ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  autoComplete="new-password"
                  placeholder="At least 8 characters"
                  className="input pl-10 pr-11"
                  disabled={loading}
                />
                <button
                  type="button"
                  onClick={() => setShowPass((v) => !v)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition-colors"
                  tabIndex={-1}
                  aria-label={showPass ? "Hide password" : "Show password"}
                >
                  {showPass ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </button>
              </div>

              {/* Strength bar */}
              {password.length > 0 && (
                <div className="mt-2 space-y-1.5 animate-fade-in">
                  <div className="flex gap-1">
                    {[1, 2, 3].map((i) => (
                      <div
                        key={i}
                        className={`h-1 flex-1 rounded-full transition-all duration-300 ${
                          i <= strengthScore ? strengthColor : "bg-surface-600"
                        }`}
                      />
                    ))}
                  </div>
                  <div className="flex items-center justify-between text-xs text-slate-500">
                    <div className="flex gap-3">
                      <span className={hasMinLength ? "text-emerald-400" : ""}>
                        8+ chars
                      </span>
                      <span className={hasUppercase ? "text-emerald-400" : ""}>
                        Uppercase
                      </span>
                      <span className={hasNumber ? "text-emerald-400" : ""}>
                        Number
                      </span>
                    </div>
                    {strengthLabel && (
                      <span
                        className={`font-medium ${
                          strengthScore === 3
                            ? "text-emerald-400"
                            : strengthScore === 2
                              ? "text-yellow-400"
                              : "text-red-400"
                        }`}
                      >
                        {strengthLabel}
                      </span>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Confirm password */}
            <div>
              <label htmlFor="confirm" className="label">
                Confirm password
              </label>
              <div className="relative">
                <Lock className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
                <input
                  id="confirm"
                  type={showConf ? "text" : "password"}
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  required
                  autoComplete="new-password"
                  placeholder="Repeat your password"
                  className={`input pl-10 pr-11 ${
                    confirm.length > 0
                      ? passwordMatch
                        ? "border-emerald-500/50 focus:border-emerald-500/70 focus:ring-emerald-500/20"
                        : "border-red-500/50 focus:border-red-500/70 focus:ring-red-500/20"
                      : ""
                  }`}
                  disabled={loading}
                />
                <button
                  type="button"
                  onClick={() => setShowConf((v) => !v)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition-colors"
                  tabIndex={-1}
                  aria-label={showConf ? "Hide password" : "Show password"}
                >
                  {showConf ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </button>
              </div>
              {confirm.length > 0 && (
                <p
                  className={`mt-1.5 text-xs ${passwordMatch ? "text-emerald-400" : "text-red-400"}`}
                >
                  {passwordMatch
                    ? "✓ Passwords match"
                    : "✗ Passwords do not match"}
                </p>
              )}
            </div>

            {/* Submit */}
            <button
              type="submit"
              disabled={loading || !email || !password || !confirm}
              className="btn btn-primary btn-lg w-full mt-2"
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Creating account…
                </>
              ) : (
                <>
                  Create account
                  <ArrowRight className="h-4 w-4" />
                </>
              )}
            </button>
          </form>

          {/* Terms */}
          <p className="mt-6 text-center text-xs text-slate-600">
            By signing up you agree to our{" "}
            <span className="text-slate-500">Terms of Service</span> and{" "}
            <span className="text-slate-500">Privacy Policy</span>.
          </p>
        </div>
      </div>
    </div>
  );
}
