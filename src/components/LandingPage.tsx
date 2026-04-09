import Link from "next/link";
import {
  ArrowRight,
  Brain,
  CheckCircle2,
  Lock,
  MessageSquare,
  Search,
  ShieldCheck,
  Sparkles,
  Tags,
  Zap,
} from "lucide-react";

const FEATURES = [
  {
    icon: Search,
    title: "Semantic search",
    description:
      "Find relevant notes by meaning, not just keywords. Embeddings power fast similarity search across everything you save.",
  },
  {
    icon: Sparkles,
    title: "Grounded answers",
    description:
      "Ask questions and get answers constrained to your own memories, with source notes and evidence snippets.",
  },
  {
    icon: Tags,
    title: "Tags and organization",
    description:
      "Tag memories, filter your library, and keep long-form notes easy to revisit.",
  },
  {
    icon: MessageSquare,
    title: "Question history",
    description:
      "Recent questions are saved so you can rerun them and pick up where you left off.",
  },
  {
    icon: Lock,
    title: "Your data, isolated",
    description:
      "Supabase Auth and row-level security keep each account's memories private.",
  },
  {
    icon: Brain,
    title: "Smart model fallback",
    description:
      "If one model is unavailable, fallback routing keeps responses reliable so your workflow does not stop.",
  },
];

const QUICK_STATS = [
  "RAG answers with note sources",
  "Semantic retrieval from your memories",
  "Private by default with Supabase RLS",
];

const STEPS = [
  {
    title: "Capture",
    description: "Save notes, snippets, meeting takeaways, and ideas in seconds.",
  },
  {
    title: "Organize",
    description: "Use tags and filtering to keep your growing memory easy to browse.",
  },
  {
    title: "Ask",
    description:
      "Get grounded answers with evidence so you can verify where each response came from.",
  },
];

export default function LandingPage() {
  return (
    <div className="min-h-screen flex flex-col">
      <header className="border-b border-white/[0.07] bg-surface-900/80 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-gradient shadow-glow">
              <Brain className="h-5 w-5 text-white" />
            </div>
            <span className="text-sm font-bold tracking-tight text-white">
              AI Second Brain
            </span>
          </div>
          <div className="flex items-center gap-2 sm:gap-3">
            <Link
              href="/auth/login"
              className="btn btn-ghost btn-sm sm:btn-md text-slate-400 hover:text-slate-200"
            >
              Log in
            </Link>
            <Link
              href="/auth/signup"
              className="btn btn-primary btn-sm sm:btn-md transition-all duration-200 ease-out hover:-translate-y-0.5"
            >
              Sign up
            </Link>
          </div>
        </div>
      </header>

      <main className="flex-1">
        <section className="relative overflow-hidden px-4 pb-16 pt-14 sm:px-6 sm:pt-20 lg:pb-20 lg:pt-24">
          <div
            className="pointer-events-none absolute inset-0 opacity-40"
            aria-hidden
            style={{
              background:
                "radial-gradient(ellipse 80% 50% at 50% -20%, rgba(99, 102, 241, 0.15), transparent), radial-gradient(ellipse 60% 40% at 80% 100%, rgba(139, 92, 246, 0.08), transparent)",
            }}
          />

          <div className="relative mx-auto grid max-w-6xl items-center gap-10 lg:grid-cols-2 lg:gap-12">
            <div>
              <p className="mb-4 text-xs font-semibold uppercase tracking-widest text-brand-400/90">
                Personal knowledge base
              </p>
              <h1 className="text-balance text-3xl font-bold tracking-tight text-slate-100 sm:text-4xl lg:text-5xl">
                Remember everything. Ask anything - grounded in{" "}
                <span className="text-gradient">your notes</span>.
              </h1>
              <p className="mt-5 max-w-xl text-pretty text-base leading-relaxed text-slate-400 sm:text-lg">
                Store meeting notes, ideas, and research in one place. Your
                second brain retrieves what matters and answers from what you
                actually saved - not the open web.
              </p>

              <ul className="mt-7 space-y-3">
                {QUICK_STATS.map((item) => (
                  <li
                    key={item}
                    className="flex items-start gap-2 text-sm text-slate-300"
                  >
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>

              <div className="mt-9 flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:gap-4">
                <Link
                  href="/auth/signup"
                  className="btn btn-primary btn-lg inline-flex items-center gap-2 px-8 transition-all duration-200 ease-out hover:-translate-y-0.5"
                >
                  Get started free
                  <ArrowRight className="h-4 w-4" />
                </Link>
                <Link
                  href="/auth/login"
                  className="btn btn-secondary btn-lg px-8 transition-all duration-300 ease-out hover:-translate-y-0.5 hover:border-white/25"
                >
                  Log in
                </Link>
              </div>
            </div>

            <div className="card relative overflow-hidden p-5 sm:p-6">
              <div
                className="pointer-events-none absolute -right-16 -top-16 h-44 w-44 rounded-full bg-brand-500/20 blur-3xl"
                aria-hidden
              />
              <div className="relative">
                <p className="text-xs font-semibold uppercase tracking-wider text-brand-300">
                  Live workflow
                </p>
                <h3 className="mt-2 text-lg font-semibold text-slate-100">
                  From notes to instant, grounded answers
                </h3>

                <div className="mt-5 space-y-3 rounded-xl border border-white/10 bg-surface-800/70 p-4">
                  <p className="text-xs text-slate-500">Latest question</p>
                  <p className="text-sm text-slate-200">
                    What were the 3 action items from Monday&apos;s planning
                    meeting?
                  </p>
                </div>

                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  <div className="rounded-xl border border-white/10 bg-surface-800/70 p-4">
                    <div className="flex items-center gap-2 text-brand-300">
                      <Search className="h-4 w-4" />
                      <p className="text-xs font-semibold uppercase tracking-wide">
                        Retrieval
                      </p>
                    </div>
                    <p className="mt-2 text-xs leading-relaxed text-slate-400">
                      Similar notes are ranked using embeddings and semantic
                      search.
                    </p>
                  </div>
                  <div className="rounded-xl border border-white/10 bg-surface-800/70 p-4">
                    <div className="flex items-center gap-2 text-brand-300">
                      <Sparkles className="h-4 w-4" />
                      <p className="text-xs font-semibold uppercase tracking-wide">
                        AI answer
                      </p>
                    </div>
                    <p className="mt-2 text-xs leading-relaxed text-slate-400">
                      Response includes cited source notes so you can trust it.
                    </p>
                  </div>
                </div>

                <div className="mt-4 flex items-center justify-between rounded-xl border border-emerald-500/20 bg-emerald-500/[0.08] p-3 text-xs text-emerald-200">
                  <span className="inline-flex items-center gap-1.5">
                    <ShieldCheck className="h-4 w-4" />
                    Private account-scoped data access
                  </span>
                  <span className="font-semibold">RLS enabled</span>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="border-y border-white/[0.06] bg-surface-900/50 px-4 py-8 sm:px-6">
          <div className="mx-auto grid max-w-6xl gap-3 text-center sm:grid-cols-3 sm:text-left">
            <div className="card p-4">
              <div className="flex items-center gap-2 text-brand-300">
                <Zap className="h-4 w-4" />
                <p className="text-xs font-semibold uppercase tracking-wider">
                  Fast retrieval
                </p>
              </div>
              <p className="mt-2 text-sm text-slate-400">
                Ask naturally and get answers in seconds.
              </p>
            </div>
            <div className="card p-4">
              <div className="flex items-center gap-2 text-brand-300">
                <MessageSquare className="h-4 w-4" />
                <p className="text-xs font-semibold uppercase tracking-wider">
                  Answer history
                </p>
              </div>
              <p className="mt-2 text-sm text-slate-400">
                Revisit previous questions and rerun with new context.
              </p>
            </div>
            <div className="card p-4">
              <div className="flex items-center gap-2 text-brand-300">
                <Lock className="h-4 w-4" />
                <p className="text-xs font-semibold uppercase tracking-wider">
                  Secure by default
                </p>
              </div>
              <p className="mt-2 text-sm text-slate-400">
                Auth + policies keep each user&apos;s memory private.
              </p>
            </div>
          </div>
        </section>

        <section className="px-4 py-16 sm:px-6">
          <div className="mx-auto max-w-6xl">
            <h2 className="text-center text-sm font-semibold uppercase tracking-widest text-slate-500">
              Features
            </h2>
            <p className="mx-auto mt-2 max-w-2xl text-center text-lg font-semibold text-slate-200">
              Built for people who think in notes, not tabs
            </p>
            <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {FEATURES.map((f) => (
                <div
                  key={f.title}
                  className="card p-6 transition-colors hover:border-white/10"
                >
                  <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-lg bg-brand-500/15 text-brand-400">
                    <f.icon className="h-5 w-5" />
                  </div>
                  <h3 className="text-base font-semibold text-slate-100">
                    {f.title}
                  </h3>
                  <p className="mt-2 text-sm leading-relaxed text-slate-500">
                    {f.description}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="border-t border-white/[0.06] bg-surface-900/50 px-4 py-16 sm:px-6">
          <div className="mx-auto max-w-6xl">
            <h2 className="text-center text-sm font-semibold uppercase tracking-widest text-slate-500">
              How it works
            </h2>
            <p className="mx-auto mt-2 max-w-2xl text-center text-lg font-semibold text-slate-200">
              Three simple steps to build your second brain
            </p>

            <div className="mt-10 grid gap-4 md:grid-cols-3">
              {STEPS.map((step, idx) => (
                <div key={step.title} className="card p-6">
                  <div className="mb-4 inline-flex h-8 w-8 items-center justify-center rounded-full border border-brand-500/40 bg-brand-500/15 text-sm font-semibold text-brand-300">
                    {idx + 1}
                  </div>
                  <h3 className="text-base font-semibold text-slate-100">
                    {step.title}
                  </h3>
                  <p className="mt-2 text-sm leading-relaxed text-slate-500">
                    {step.description}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="px-4 py-16 sm:px-6">
          <div className="mx-auto max-w-3xl rounded-2xl border border-brand-500/25 bg-brand-500/[0.08] p-8 text-center sm:p-10">
            <h2 className="text-xl font-semibold text-slate-100 sm:text-3xl">
              Ready to build your second brain?
            </h2>
            <p className="mx-auto mt-3 max-w-xl text-sm text-slate-300">
              Join now to organize your notes, ask better questions, and get AI
              responses you can verify with your own saved context.
            </p>
            <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
              <Link
                href="/auth/signup"
                className="btn btn-primary btn-md px-8 transition-all duration-200 ease-out hover:-translate-y-0.5"
              >
                Create free account
              </Link>
              <Link
                href="/auth/login"
                className="btn btn-ghost btn-md border border-white/10 px-8 transition-all duration-300 ease-out hover:-translate-y-0.5 hover:border-white/25"
              >
                I already have an account
              </Link>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-white/[0.05] py-8 text-center text-xs text-slate-600">
        <span className="text-gradient font-semibold">AI Second Brain</span>
        {" - "}
        answers grounded in your stored notes
      </footer>
    </div>
  );
}
