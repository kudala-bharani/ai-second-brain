"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle, Brain, ArrowRight, X } from "lucide-react";
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
    <div className="min-h-screen flex items-center justify-center p-4 bg-surface-900">
      <div className="w-full max-w-md">
        {/* Success Card */}
        <div className="card p-8 text-center animate-slide-up">
          {/* Logo */}
          <div className="flex justify-center mb-6">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-brand-gradient shadow-glow">
              <Brain className="h-6 w-6 text-white" />
            </div>
          </div>

          {/* Success Icon */}
          <div className="flex justify-center mb-4">
            <div className="relative">
              <div className="absolute inset-0 bg-emerald-500/20 blur-xl rounded-full" />
              <CheckCircle className="relative h-16 w-16 text-emerald-400" />
            </div>
          </div>

          {/* Title */}
          <h1 className="text-2xl font-bold text-white mb-2">
            Email Verified! 🎉
          </h1>

          {/* Description */}
          <p className="text-slate-400 mb-6">
            Your email has been successfully verified. You can now access your AI Second Brain.
          </p>

          {/* Auto-redirect notice */}
          {autoRedirect && countdown > 0 && (
            <div className="mb-6 p-3 rounded-lg bg-brand-500/10 border border-brand-500/20">
              <p className="text-sm text-brand-300">
                Redirecting to dashboard in{" "}
                <span className="font-bold text-brand-200">{countdown}</span>{" "}
                seconds...
              </p>
            </div>
          )}

          {/* Actions */}
          <div className="space-y-3">
            <Link
              href="/dashboard"
              className="btn btn-primary w-full inline-flex items-center justify-center gap-2"
            >
              Go to Dashboard
              <ArrowRight className="h-4 w-4" />
            </Link>

            <button
              onClick={() => setAutoRedirect(false)}
              className="w-full text-sm text-slate-500 hover:text-slate-400 transition-colors"
            >
              Cancel auto-redirect
            </button>
          </div>

          {/* Divider */}
          <div className="relative my-6">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-white/5" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-surface-800 px-2 text-slate-600">or</span>
            </div>
          </div>

          {/* Close tab option */}
          <button
            onClick={() => window.close()}
            className="text-sm text-slate-500 hover:text-slate-400 transition-colors inline-flex items-center gap-1"
          >
            <X className="h-3.5 w-3.5" />
            Close this tab
          </button>

          {/* Helper text */}
          <p className="mt-6 text-xs text-slate-600">
            If the tab doesn't close, you can safely close it manually.
          </p>
        </div>
      </div>
    </div>
  );
}
