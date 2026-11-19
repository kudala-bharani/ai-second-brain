"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, CircleCheck, X } from "lucide-react";
import Link from "next/link";

export default function ConfirmedPage() {
  const router = useRouter();
  const [countdown, setCountdown] = useState(5);
  const [autoRedirect, setAutoRedirect] = useState(true);

  useEffect(() => {
    if (!autoRedirect || countdown <= 0) return;

    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          router.push("/dashboard");
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [countdown, autoRedirect, router]);

  return (
    <section className="auth-content" aria-labelledby="confirmed-title">
      <CircleCheck className="auth-status-icon auth-status-success" aria-hidden="true" />
      <header className="auth-heading">
        <h1 id="confirmed-title">Email verified</h1>
        <p>Your account is ready. You can now open your workspace.</p>
      </header>

      <div className="auth-confirmed-actions">
        <Link href="/dashboard" className="btn btn-primary btn-lg auth-submit">
          Go to dashboard
          <ArrowRight aria-hidden="true" />
        </Link>

        {autoRedirect && countdown > 0 ? (
          <div className="auth-redirect">
            <p role="timer">
              Opening the dashboard in {countdown} {countdown === 1 ? "second" : "seconds"}
            </p>
            <button type="button" onClick={() => setAutoRedirect(false)} className="auth-text-button">
              Cancel auto-redirect
            </button>
          </div>
        ) : !autoRedirect && (
          <p className="auth-guidance" role="status">Automatic redirect canceled.</p>
        )}

        <div className="auth-close-tab">
          <button type="button" onClick={() => window.close()} className="auth-text-button">
            <X aria-hidden="true" />
            Close this tab
          </button>
          <p>If the tab stays open, you can close it manually.</p>
        </div>
      </div>
    </section>
  );
}
