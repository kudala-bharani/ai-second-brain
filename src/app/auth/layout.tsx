import "./auth.css";

export const dynamic = "force-dynamic";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="auth-shell">
      <header className="auth-masthead">
        <div className="wordmark">
          <span className="brand-mark" aria-hidden="true" />
          AI Second Brain
        </div>
      </header>

      <main className="auth-layout">
        <div className="auth-workspace">{children}</div>
      </main>
    </div>
  );
}
