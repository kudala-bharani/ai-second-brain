import Link from "next/link";
import { ArrowRight, BookOpen, ChevronDown, FileText, MessageSquare } from "lucide-react";
import "./landing.css";

const STEPS = [
  {
    title: "Save a note",
    description: "Keep a meeting note, a passage, or a decision. Add a title and tags to organize it.",
  },
  {
    title: "Ask a question",
    description: "Use your own words. Related notes can match even when they use different terms.",
  },
  {
    title: "Check the source",
    description: "Open the notes behind an answer and find past questions in your history.",
  },
];

function NotebookExample() {
  return (
    <figure className="workbench-example" id="example-workspace">
      <figcaption>
        <BookOpen size={16} aria-hidden="true" /> Example workspace
      </figcaption>

      <div className="workbench-grid">
        <div className="workbench-reading">
          <div className="example-question">
            <MessageSquare size={16} aria-hidden="true" />
            What did we decide about onboarding?
          </div>

          <div className="example-answer">
            <h2>From your notes</h2>
            <p>
              “Ship one example project and a short checklist first.”{" "}
              <a className="example-citation" href="#example-source-excerpt" aria-label="Source 1, Monday planning notes">1</a>
            </p>
          </div>

          <details className="example-evidence" id="example-source" open>
            <summary>
              <FileText size={15} aria-hidden="true" />
              <span>Monday planning notes</span>
              <ChevronDown size={15} aria-hidden="true" />
            </summary>
            <blockquote id="example-source-excerpt">
              “Ship one example project and a short checklist first. Wait
              until the first note is created before showing the tour.”
            </blockquote>
          </details>
        </div>

        <div className="workbench-library">
          <h2>Saved notes</h2>
          <ul>
            <li className="example-related">
              <FileText size={15} aria-hidden="true" />
              <div><span>Monday planning notes</span><small>onboarding</small></div>
            </li>
            <li>
              <FileText size={15} aria-hidden="true" />
              <div><span>Release checklist</span><small>product</small></div>
            </li>
            <li>
              <FileText size={15} aria-hidden="true" />
              <div><span>Interview takeaways</span><small>research</small></div>
            </li>
          </ul>
        </div>
      </div>
    </figure>
  );
}

type LandingPageProps = {
  showConfigWarning?: boolean;
};

export default function LandingPage({ showConfigWarning }: LandingPageProps) {
  return (
    <div className="landing-page" id="landing-top">
      <a className="sr-only focus:not-sr-only landing-skip" href="#landing-content">Skip to content</a>

      {showConfigWarning && (
        <div className="landing-config" role="alert">
          <div className="landing-frame">
            <strong>Deployment configuration</strong>{" "}
            Add <code>NEXT_PUBLIC_SUPABASE_URL</code> and{" "}
            <code>NEXT_PUBLIC_SUPABASE_ANON_KEY</code> in Vercel → Project →
            Settings → Environment Variables (Production), then redeploy.
            Login and the app need these values.
          </div>
        </div>
      )}

      <header className="landing-header">
        <div className="landing-frame landing-header-inner">
          <Link className="wordmark" href="/" aria-current="page">
            <span className="brand-mark" aria-hidden="true" />
            AI Second Brain
          </Link>
          <nav className="landing-page-links" aria-label="On this page">
            <a href="#how-it-works">How it works</a>
          </nav>
          <nav className="landing-actions" aria-label="Account">
            <Link href="/auth/login" className="btn-ghost btn-sm">Log in</Link>
            <Link href="/auth/signup" className="btn-primary btn-sm">Sign up</Link>
          </nav>
        </div>
      </header>

      <main id="landing-content" tabIndex={-1}>
        <section className="landing-frame landing-hero" aria-labelledby="landing-title">
          <div className="landing-hero-copy">
            <h1 id="landing-title"><span>Answers from</span> <span>your own notes.</span></h1>
            <p>
              Keep meeting notes, ideas, and details you’ll want again. Ask in
              your own words and go straight to the source.
            </p>
            <div className="landing-actions">
              <Link href="/auth/signup" className="btn-primary btn-lg">
                Get started free <ArrowRight size={16} aria-hidden="true" />
              </Link>
            </div>
          </div>
          <NotebookExample />
        </section>

        <section className="landing-workflow" id="how-it-works" aria-labelledby="workflow-heading">
          <div className="landing-frame landing-workflow-inner">
            <h2 id="workflow-heading">From a saved note to an answer</h2>
            <ol className="landing-steps" role="list">
              {STEPS.map(({ title, description }) => (
                <li key={title}>
                  <h3>{title}</h3>
                  <p>{description}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        <section className="landing-frame landing-closing" aria-labelledby="closing-heading">
          <div>
            <h2 id="closing-heading">Start with a note</h2>
            <p>Your saved notes and questions stay with your account.</p>
          </div>
          <div className="landing-actions">
            <Link href="/auth/signup" className="btn-primary btn-md">
              Create free account <ArrowRight size={16} aria-hidden="true" />
            </Link>
            <Link href="/auth/login" className="btn-ghost btn-md">Log in</Link>
          </div>
        </section>
      </main>

      <footer className="landing-footer">
        <div className="landing-frame landing-footer-inner">
          <span>AI Second Brain</span>
          <a href="#landing-top">Back to top</a>
        </div>
      </footer>
    </div>
  );
}
