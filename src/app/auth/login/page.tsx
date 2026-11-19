"use client";

import { useState, useEffect, type FormEvent } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { ArrowRight, CircleAlert, Eye, EyeOff, Loader2 } from "lucide-react";

export default function LoginPage() {
  const router = useRouter();
  const supabase = createClient();
  const searchParams = useSearchParams();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Check for verification errors in URL
  useEffect(() => {
    const urlError = searchParams.get("error");
    if (urlError === "verification_failed") {
      setError(
        "Email verification failed. Please try again or contact support.",
      );
    }
  }, [searchParams]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const { error: authError } = await supabase.auth.signInWithPassword({
      email: email.trim().toLowerCase(),
      password,
    });

    if (authError) {
      const msg = authError.message;
      if (
        msg === "Failed to fetch" ||
        msg.includes("fetch") ||
        msg.includes("network") ||
        msg.includes("NetworkError")
      ) {
        setError(
          "Cannot reach the authentication server. Make sure your Supabase URL and anon key are set correctly in .env.local, then restart the dev server.",
        );
      } else if (msg === "Invalid login credentials") {
        setError("Incorrect email or password. Please try again.");
      } else {
        setError(msg);
      }
      setLoading(false);
      return;
    }

    router.push("/dashboard");
    router.refresh();
  }

  return (
    <section className="auth-content" aria-labelledby="login-title">
      <header className="auth-heading">
        <h1 id="login-title">Sign in</h1>
        <p>Return to your saved notes and questions.</p>
      </header>

      {error && (
        <div className="notice-error auth-notice" role="alert">
          <CircleAlert aria-hidden="true" />
          <span>{error}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="auth-form" aria-busy={loading}>
        <div>
          <label htmlFor="email" className="label">Email address</label>
          <input
            id="email"
            name="email"
            type="email"
            autoComplete="username"
            spellCheck={false}
            enterKeyHint="next"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
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
              autoComplete="current-password"
              enterKeyHint="go"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="input"
              disabled={loading}
            />
            <button
              type="button"
              className="auth-password-toggle"
              onClick={() => setShowPass((p) => !p)}
              aria-label={showPass ? "Hide password" : "Show password"}
              aria-controls="password"
            >
              {showPass ? <EyeOff aria-hidden="true" /> : <Eye aria-hidden="true" />}
            </button>
          </div>
        </div>

        <button
          type="submit"
          disabled={loading || !email || !password}
          className="btn btn-primary btn-lg auth-submit"
        >
          {loading ? (
            <>
              Signing in…
              <Loader2 className="status-spinner" aria-hidden="true" />
            </>
          ) : (
            <>
              Sign in
              <ArrowRight aria-hidden="true" />
            </>
          )}
        </button>
      </form>

      <p className="auth-alternate">
        New to AI Second Brain? <Link href="/auth/signup">Create an account</Link>
      </p>
    </section>
  );
}
