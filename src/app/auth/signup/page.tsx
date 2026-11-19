"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { ArrowRight, CircleAlert, Eye, EyeOff, Loader2, Mail } from "lucide-react";

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

  if (success) {
    return (
      <section className="auth-content" aria-labelledby="email-title">
        <Mail className="auth-status-icon" aria-hidden="true" />
        <header className="auth-heading" role="status">
          <h1 id="email-title">Check your email</h1>
          <p className="auth-email-message">
            We sent a confirmation link to <strong>{email}</strong>. Open the
            link to verify your account.
          </p>
        </header>
        <Link href="/auth/login" className="btn btn-primary btn-lg auth-submit">
          Back to sign in
          <ArrowRight aria-hidden="true" />
        </Link>
      </section>
    );
  }

  return (
    <section className="auth-content" aria-labelledby="signup-title">
      <header className="auth-heading">
        <h1 id="signup-title">Create your account</h1>
        <p>
          Already have an account? <Link href="/auth/login">Sign in</Link>
        </p>
      </header>

      {error && (
        <div className="notice-error auth-notice" role="alert">
          <CircleAlert aria-hidden="true" />
          <span>{error}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="auth-form" aria-busy={loading} noValidate>
        <div>
          <label htmlFor="email" className="label">Email address</label>
          <input
            id="email"
            name="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoComplete="username"
            spellCheck={false}
            enterKeyHint="next"
            className="input"
            disabled={loading}
          />
        </div>

        <div>
          <label htmlFor="password" className="label">Password</label>
          <div className="auth-password">
            <input
              id="password"
              name="password"
              type={showPass ? "text" : "password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete="new-password"
              enterKeyHint="next"
              aria-describedby="password-guidance"
              className="input"
              disabled={loading}
            />
            <button
              type="button"
              onClick={() => setShowPass((v) => !v)}
              className="auth-password-toggle"
              aria-label={showPass ? "Hide password" : "Show password"}
              aria-controls="password"
            >
              {showPass ? <EyeOff aria-hidden="true" /> : <Eye aria-hidden="true" />}
            </button>
          </div>

          <div id="password-guidance" className="auth-guidance">
            {password.length > 0 ? (
              <div className="auth-strength" data-strength={strengthScore}>
                <div className="auth-strength-meter" aria-hidden="true">
                  {[1, 2, 3].map((segment) => (
                    <span key={segment} data-met={segment <= strengthScore} />
                  ))}
                </div>
                <div className="auth-strength-summary">
                  <span data-met={hasMinLength}>8+ characters</span>
                  <span data-met={hasUppercase}>Uppercase</span>
                  <span data-met={hasNumber}>Number</span>
                  {strengthLabel && <strong>{strengthLabel}</strong>}
                </div>
              </div>
            ) : "Use at least 8 characters."}
          </div>
        </div>

        <div>
          <label htmlFor="confirm" className="label">Confirm password</label>
          <div className="auth-password">
            <input
              id="confirm"
              name="confirm-password"
              type={showConf ? "text" : "password"}
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              required
              autoComplete="new-password"
              enterKeyHint="go"
              aria-invalid={confirm.length > 0 && !passwordMatch}
              aria-describedby={confirm.length > 0 ? "password-match" : undefined}
              data-matched={passwordMatch}
              className="input"
              disabled={loading}
            />
            <button
              type="button"
              onClick={() => setShowConf((v) => !v)}
              className="auth-password-toggle"
              aria-label={showConf ? "Hide password confirmation" : "Show password confirmation"}
              aria-controls="confirm"
            >
              {showConf ? <EyeOff aria-hidden="true" /> : <Eye aria-hidden="true" />}
            </button>
          </div>
          {confirm.length > 0 && (
            <p id="password-match" className="auth-guidance auth-match" data-matched={passwordMatch}>
              {passwordMatch ? "Passwords match" : "Passwords do not match"}
            </p>
          )}
        </div>

        <button
          type="submit"
          disabled={loading || !email || !password || !confirm}
          className="btn btn-primary btn-lg auth-submit"
        >
          {loading ? (
            <>
              Creating account…
              <Loader2 className="status-spinner" aria-hidden="true" />
            </>
          ) : (
            <>
              Create account
              <ArrowRight aria-hidden="true" />
            </>
          )}
        </button>
      </form>

      <p className="auth-fine-print">
        By signing up you agree to our Terms of Service and Privacy Policy.
      </p>
    </section>
  );
}
