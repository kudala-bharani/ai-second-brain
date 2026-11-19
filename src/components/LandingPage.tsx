import Link from "next/link";
import { ArrowRight, BookOpen, ChevronDown, FileText, Search } from "lucide-react";
import "./landing.css";

const STEPS = [
  {
    title: "Capture what matters",
    description: "Save a passage, a meeting note, or a decision. Add a title and tags if they’ll help you find it again.",
  },
  {
    title: "Ask in your own words",
    description: "Describe what you’re looking for. AI Second Brain searches for related notes even when the wording is different.",
  },
  {
    title: "Check the source",
    description: "Read the supporting excerpts and open the original notes. Return to a question from your history when your library changes.",
  },
];

function NotebookExample() {
  return (
    <figure className="workbench-example" id="example-workspace">
      <figcaption>
        <span><BookOpen size={15} aria-hidden="true" /> Your notebook</span>
        <span>Example workspace</span>
      </figcaption>

      <div className="workbench-grid">
        <div className="workbench-reading">
          <div className="example-question">
            <Search size={16} aria-hidden="true" />
            What did we decide about onboarding?
          </div>

          <div className="example-answer">
            <h2>Answer</h2>
            <p>
              Start with one example project and a short checklist. Save the
              product tour for after the{" "}
              <span className="example-source-reference">
                first note.{" "}
                <a className="example-citation" href="#example-source-excerpt" aria-label="Source 1, Monday planning notes">[1]</a>
              </span>
            </p>
          </div>

          <details className="example-evidence" id="example-source" open>
            <summary>
              <span className="example-citation" aria-hidden="true">[1]</span>
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
    <div className="landing-page">
      <a className="landing-skip sr-only" href="#landing-content">Skip to content</a>

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
            <a href="#example-workspace">Example</a>
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
            <h1 id="landing-title"><span>Answers from</span> your own notes.</h1>
            <p>
              Save what you learn. Come back with a question and get an answer
              that points to the notes it came from.
            </p>
            <div className="landing-actions">
              <Link href="/auth/signup" className="btn-primary btn-lg">
                Get started free <ArrowRight size={16} aria-hidden="true" />
              </Link>
              <Link href="/auth/login" className="btn-secondary btn-lg">Log in</Link>
            </div>
          </div>
          <NotebookExample />
        </section>

        <section className="landing-workflow" id="how-it-works" aria-labelledby="workflow-heading">
          <div className="landing-frame landing-workflow-inner">
            <div>
              <h2 id="workflow-heading">From a saved note to an answer</h2>
              <p>Your notebook keeps the question, the answer, and the original evidence together.</p>
            </div>
            <ol className="landing-steps" role="list">
              {STEPS.map(({ title, description }, index) => (
                <li key={title}>
                  <span className="landing-step-index" aria-hidden="true">{index + 1}</span>
                  <div><h3>{title}</h3><p>{description}</p></div>
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
          <span>Answers with sources from your notes</span>
        </div>
      </footer>
    </div>
  );
}
