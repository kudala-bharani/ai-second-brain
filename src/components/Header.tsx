"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Brain, LogOut, ChevronDown, User, Loader2 } from "lucide-react";

interface HeaderProps {
  userEmail: string;
  onLogout?: () => Promise<void> | void;
}

export default function Header({ userEmail, onLogout }: HeaderProps) {
  const router = useRouter();
  const supabase = createClient();
  const [loggingOut, setLoggingOut] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  async function handleLogout() {
    setLoggingOut(true);
    if (onLogout) {
      await onLogout();
    } else {
      await supabase.auth.signOut();
      router.push("/auth/login");
      router.refresh();
    }
    setLoggingOut(false);
  }

  // Derive display name from email
  const displayName = userEmail.split("@")[0];
  const avatarInitial = displayName.charAt(0).toUpperCase();

  return (
    <header
      className="sticky top-0 z-40 w-full border-b bg-surface-900/80 backdrop-blur-xl"
      style={{ borderColor: "rgba(255,255,255,0.07)" }}
    >
      <div className="mx-auto flex h-14 max-w-screen-xl items-center justify-between px-4 sm:px-6">
        {/* ── Logo ── */}
        <div className="flex items-center gap-2.5 select-none">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-gradient shadow-glow">
            <Brain
              className="h-4.5 w-4.5 text-white"
              style={{ width: "1.1rem", height: "1.1rem" }}
            />
          </div>
          <div className="flex flex-col leading-none">
            <span className="text-sm font-bold text-white tracking-tight">
              AI Second Brain
            </span>
            <span className="text-[10px] font-medium text-slate-500 tracking-wider uppercase">
              Personal Knowledge Base
            </span>
          </div>
        </div>

        {/* ── Right side ── */}
        <div className="flex items-center gap-3">
          {/* Status badge */}
          <div
            className="hidden sm:flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs"
            style={{
              borderColor: "rgba(16,185,129,0.25)",
              background: "rgba(16,185,129,0.08)",
            }}
          >
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse-slow" />
            <span className="text-emerald-400 font-medium">Connected</span>
          </div>

          {/* User menu */}
          <div className="relative">
            <button
              onClick={() => setMenuOpen((o) => !o)}
              className="flex items-center gap-2 rounded-xl border px-3 py-1.5 text-sm transition-all duration-150
                         hover:bg-surface-700 hover:border-white/10 active:scale-[0.98]"
              style={{ borderColor: "rgba(255,255,255,0.07)" }}
              aria-haspopup="true"
              aria-expanded={menuOpen}
            >
              {/* Avatar */}
              <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-brand-gradient text-xs font-bold text-white select-none">
                {avatarInitial}
              </span>
              <span className="hidden max-w-[160px] truncate text-slate-300 sm:block">
                {displayName}
              </span>
              <ChevronDown
                className={`h-3.5 w-3.5 text-slate-500 transition-transform duration-200 ${menuOpen ? "rotate-180" : ""}`}
              />
            </button>

            {/* Dropdown */}
            {menuOpen && (
              <>
                {/* Backdrop */}
                <div
                  className="fixed inset-0 z-10"
                  onClick={() => setMenuOpen(false)}
                  aria-hidden="true"
                />

                <div
                  className="absolute right-0 top-full mt-2 z-20 w-56 animate-slide-down overflow-hidden rounded-xl border shadow-card-hover"
                  style={{
                    background: "var(--surface-700)",
                    borderColor: "rgba(255,255,255,0.10)",
                  }}
                >
                  {/* User info */}
                  <div
                    className="px-4 py-3 border-b"
                    style={{ borderColor: "rgba(255,255,255,0.07)" }}
                  >
                    <div className="flex items-center gap-2.5">
                      <span className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-brand-gradient text-sm font-bold text-white">
                        {avatarInitial}
                      </span>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-slate-100">
                          {displayName}
                        </p>
                        <p className="truncate text-xs text-slate-500">
                          {userEmail}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Menu items */}
                  <div className="p-1">
                    <button
                      disabled
                      className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-slate-400
                                 opacity-50 cursor-not-allowed"
                    >
                      <User className="h-4 w-4" />
                      Profile settings
                      <span className="ml-auto text-[10px] text-slate-600 font-medium uppercase tracking-wider">
                        soon
                      </span>
                    </button>

                    <div
                      className="my-1 border-t"
                      style={{ borderColor: "rgba(255,255,255,0.06)" }}
                    />

                    <button
                      onClick={handleLogout}
                      disabled={loggingOut}
                      className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm
                                 text-red-400 hover:bg-red-500/10 transition-colors duration-150
                                 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {loggingOut ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <LogOut className="h-4 w-4" />
                      )}
                      {loggingOut ? "Signing out…" : "Sign out"}
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
