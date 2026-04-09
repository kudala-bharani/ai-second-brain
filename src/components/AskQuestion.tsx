'use client'

import { useState, useRef, type FormEvent, type KeyboardEvent } from 'react'
import { Sparkles, Loader2, SendHorizonal, AlertCircle, LightbulbIcon } from 'lucide-react'
import type { QueryResult } from '@/types'

interface AskQuestionProps {
  hasMemories: boolean
  onResult: (result: QueryResult, question: string) => void
}

const EXAMPLE_QUESTIONS = [
  'What are my key ideas about productivity?',
  'Summarize my notes on this topic',
  'What did I learn recently?',
  'What tasks or goals have I written about?',
]

export default function AskQuestion({ hasMemories, onResult }: AskQuestionProps) {
  const [question, setQuestion]   = useState('')
  const [loading,  setLoading]    = useState(false)
  const [error,    setError]      = useState<string | null>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const canSubmit = question.trim().length >= 3 && !loading && hasMemories

  // ── Submit ──────────────────────────────────────────────────────────────────
  async function handleSubmit(e?: FormEvent) {
    e?.preventDefault()
    if (!canSubmit) return

    setError(null)
    setLoading(true)

    try {
      const res = await fetch('/api/query', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ question: question.trim() }),
      })

      const json = await res.json()

      if (!res.ok || json.error) {
        setError(json.error ?? 'Something went wrong. Please try again.')
        return
      }

      onResult(json.data as QueryResult, question.trim())
    } catch {
      setError('Network error. Please check your connection and try again.')
    } finally {
      setLoading(false)
    }
  }

  // Submit on Cmd/Ctrl + Enter
  function handleKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
      e.preventDefault()
      handleSubmit()
    }
  }

  function handleExampleClick(q: string) {
    setQuestion(q)
    setError(null)
    textareaRef.current?.focus()
  }

  // ─────────────────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-4">

      {/* No memories warning */}
      {!hasMemories && (
        <div className="flex items-start gap-3 rounded-xl border border-amber-500/20 bg-amber-500/8 px-4 py-3">
          <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0 text-amber-400" />
          <div>
            <p className="text-sm font-medium text-amber-300">No memories yet</p>
            <p className="mt-0.5 text-xs text-amber-500/80">
              Add at least one memory before asking questions.
            </p>
          </div>
        </div>
      )}

      {/* Error banner */}
      {error && (
        <div className="flex items-start gap-3 rounded-xl border border-red-500/25 bg-red-500/10 px-4 py-3 animate-slide-down">
          <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0 text-red-400" />
          <p className="text-sm text-red-400">{error}</p>
          <button
            onClick={() => setError(null)}
            className="ml-auto text-red-500/60 hover:text-red-400 transition-colors"
            aria-label="Dismiss error"
          >
            ×
          </button>
        </div>
      )}

      {/* Main form */}
      <form onSubmit={handleSubmit} className="space-y-3">
        <div className="relative">
          <textarea
            ref={textareaRef}
            value={question}
            onChange={(e) => {
              setQuestion(e.target.value)
              if (error) setError(null)
            }}
            onKeyDown={handleKeyDown}
            placeholder={
              hasMemories
                ? 'Ask anything about your stored notes…'
                : 'Add memories first, then ask questions here…'
            }
            disabled={loading || !hasMemories}
            rows={4}
            className="textarea w-full pr-14 resize-none"
            aria-label="Your question"
          />

          {/* Send button inside textarea */}
          <button
            type="submit"
            disabled={!canSubmit}
            aria-label="Submit question"
            className="absolute bottom-3 right-3 flex h-9 w-9 items-center justify-center rounded-lg
                       bg-brand-500 text-white shadow-glow transition-all duration-150
                       hover:bg-brand-600 active:scale-95
                       disabled:bg-surface-600 disabled:text-slate-500 disabled:shadow-none disabled:cursor-not-allowed"
          >
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <SendHorizonal className="h-4 w-4" />
            )}
          </button>
        </div>

        {/* Hint row */}
        <div className="flex items-center justify-between text-xs text-slate-600">
          <div className="flex items-center gap-1.5">
            <Sparkles className="h-3 w-3 text-brand-500/60" />
            <span>Powered by RAG — answers only from your notes</span>
          </div>
          <span className="hidden sm:block">
            <kbd className="rounded border border-white/10 bg-surface-700 px-1.5 py-0.5 font-mono text-[10px] text-slate-500">
              ⌘
            </kbd>
            {' '}+{' '}
            <kbd className="rounded border border-white/10 bg-surface-700 px-1.5 py-0.5 font-mono text-[10px] text-slate-500">
              Enter
            </kbd>
            {' '}to send
          </span>
        </div>
      </form>

      {/* Loading state */}
      {loading && (
        <div className="rounded-xl border bg-surface-700/50 px-4 py-5 animate-fade-in"
          style={{ borderColor: 'rgba(99,102,241,0.2)' }}
        >
          <div className="flex items-center gap-3">
            <div className="relative flex h-9 w-9 flex-shrink-0 items-center justify-center">
              <span className="absolute inset-0 rounded-full bg-brand-500/20 animate-ping" />
              <span className="relative flex h-9 w-9 items-center justify-center rounded-full bg-brand-500/15">
                <Sparkles className="h-4 w-4 text-brand-400" />
              </span>
            </div>
            <div>
              <p className="text-sm font-medium text-slate-200">Searching your memories…</p>
              <p className="text-xs text-slate-500">
                Embedding your question → vector search → generating answer
              </p>
            </div>
          </div>

          {/* Progress steps */}
          <div className="mt-4 flex items-center gap-2">
            {[
              'Embedding query',
              'Similarity search',
              'Generating answer',
            ].map((step, idx) => (
              <div key={step} className="flex items-center gap-2">
                <div className="flex items-center gap-1.5 rounded-full border border-brand-500/20 bg-brand-500/10 px-2.5 py-1">
                  <span
                    className="h-1.5 w-1.5 rounded-full bg-brand-400"
                    style={{ animationDelay: `${idx * 300}ms` }}
                  />
                  <span className="text-[10px] font-medium text-brand-400">{step}</span>
                </div>
                {idx < 2 && (
                  <span className="text-slate-700">→</span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Example questions (shown when no question typed and has memories) */}
      {!question && hasMemories && !loading && (
        <div className="space-y-2 animate-fade-in">
          <div className="flex items-center gap-1.5">
            <LightbulbIcon className="h-3.5 w-3.5 text-slate-600" />
            <p className="text-xs font-medium text-slate-600 uppercase tracking-widest">
              Try asking
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {EXAMPLE_QUESTIONS.map((q) => (
              <button
                key={q}
                type="button"
                onClick={() => handleExampleClick(q)}
                className="rounded-full border px-3 py-1.5 text-xs text-slate-400
                           transition-all duration-150
                           hover:border-brand-500/40 hover:bg-brand-500/10 hover:text-brand-300
                           active:scale-95"
                style={{ borderColor: 'rgba(255,255,255,0.08)' }}
              >
                {q}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
