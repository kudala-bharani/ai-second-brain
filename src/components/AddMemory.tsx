'use client'

import { useState, useRef, type FormEvent } from 'react'
import { Loader2, Plus, CheckCircle2, AlertCircle, X, Lightbulb } from 'lucide-react'
import type { Memory, FormStatus } from '@/types'

interface AddMemoryProps {
  onMemoryAdded: (memory: Memory) => void
}

const EXAMPLE_PROMPTS = [
  'Meeting notes from today…',
  'Key takeaways from the book I just read…',
  'My workout routine for this week…',
  'Research findings on topic X…',
  'Ideas for my next project…',
]

const MAX_CONTENT_LENGTH = 10_000
const MAX_TITLE_LENGTH   = 120

export default function AddMemory({ onMemoryAdded }: AddMemoryProps) {
  const [title,   setTitle]   = useState('')
  const [content, setContent] = useState('')
  const [status,  setStatus]  = useState<FormStatus>('idle')
  const [error,   setError]   = useState<string | null>(null)

  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const placeholder = EXAMPLE_PROMPTS[Math.floor(Math.random() * EXAMPLE_PROMPTS.length)]

  const charCount       = content.length
  const isNearLimit     = charCount > MAX_CONTENT_LENGTH * 0.85
  const isOverLimit     = charCount > MAX_CONTENT_LENGTH
  const canSubmit       = content.trim().length > 0 && !isOverLimit && status !== 'loading'

  // ── Auto-resize textarea ─────────────────────────────────────────────────────
  function autoResize() {
    const el = textareaRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${Math.min(el.scrollHeight, 400)}px`
  }

  // ── Submit ────────────────────────────────────────────────────────────────────
  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!canSubmit) return

    setStatus('loading')
    setError(null)

    try {
      const response = await fetch('/api/memories', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          title:   title.trim()   || undefined,
          content: content.trim(),
        }),
      })

      const json = await response.json()

      if (!response.ok || json.error) {
        throw new Error(json.error ?? `Request failed with status ${response.status}`)
      }

      // Success
      onMemoryAdded(json.data as Memory)
      setTitle('')
      setContent('')
      setStatus('success')

      // Reset textarea height
      if (textareaRef.current) {
        textareaRef.current.style.height = 'auto'
      }

      // Reset status after 3 s
      setTimeout(() => setStatus('idle'), 3000)

    } catch (err) {
      const message = err instanceof Error ? err.message : 'Something went wrong. Please try again.'
      setError(message)
      setStatus('error')
    }
  }

  // ── Clear form ────────────────────────────────────────────────────────────────
  function handleClear() {
    setTitle('')
    setContent('')
    setError(null)
    setStatus('idle')
    if (textareaRef.current) textareaRef.current.style.height = 'auto'
  }

  // ─────────────────────────────────────────────────────────────────────────────

  return (
    <form onSubmit={handleSubmit} className="space-y-4" noValidate>

      {/* ── Success banner ── */}
      {status === 'success' && (
        <div className="flex items-center gap-3 rounded-xl border border-emerald-500/25 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-400 animate-slide-down">
          <CheckCircle2 className="h-4 w-4 flex-shrink-0" />
          <span>Memory saved successfully! Your Second Brain has been updated.</span>
          <button
            type="button"
            onClick={() => setStatus('idle')}
            className="ml-auto flex-shrink-0 text-emerald-500 hover:text-emerald-300 transition-colors"
            aria-label="Dismiss"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {/* ── Error banner ── */}
      {status === 'error' && error && (
        <div className="flex items-start gap-3 rounded-xl border border-red-500/25 bg-red-500/10 px-4 py-3 text-sm text-red-400 animate-slide-down">
          <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0" />
          <span className="flex-1">{error}</span>
          <button
            type="button"
            onClick={() => { setError(null); setStatus('idle') }}
            className="flex-shrink-0 text-red-500 hover:text-red-300 transition-colors"
            aria-label="Dismiss error"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {/* ── Title field ── */}
      <div>
        <label htmlFor="memory-title" className="label">
          Title
          <span className="ml-1 font-normal normal-case tracking-normal text-slate-600">(optional)</span>
        </label>
        <input
          id="memory-title"
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          maxLength={MAX_TITLE_LENGTH}
          placeholder="Give this memory a name…"
          className="input"
          disabled={status === 'loading'}
          autoComplete="off"
          spellCheck
        />
        {title.length > MAX_TITLE_LENGTH * 0.85 && (
          <p className="mt-1 text-right text-xs text-slate-500">
            {title.length} / {MAX_TITLE_LENGTH}
          </p>
        )}
      </div>

      {/* ── Content field ── */}
      <div>
        <div className="mb-1.5 flex items-center justify-between">
          <label htmlFor="memory-content" className="label mb-0">Content</label>
          {charCount > 0 && (
            <span className={`text-xs ${
              isOverLimit  ? 'text-red-400 font-semibold' :
              isNearLimit  ? 'text-amber-400' :
              'text-slate-600'
            }`}>
              {charCount.toLocaleString()} / {MAX_CONTENT_LENGTH.toLocaleString()}
            </span>
          )}
        </div>

        <div className="relative">
          <textarea
            ref={textareaRef}
            id="memory-content"
            value={content}
            onChange={(e) => { setContent(e.target.value); autoResize() }}
            placeholder={placeholder}
            className={`textarea w-full font-[inherit] leading-relaxed transition-all ${
              isOverLimit ? 'border-red-500/60 focus:border-red-500/80 focus:ring-red-500/20' : ''
            }`}
            style={{ minHeight: '130px', resize: 'none' }}
            disabled={status === 'loading'}
            required
            spellCheck
          />

          {/* Clear content button */}
          {content.length > 0 && status !== 'loading' && (
            <button
              type="button"
              onClick={() => { setContent(''); if (textareaRef.current) textareaRef.current.style.height = 'auto' }}
              className="absolute right-2.5 top-2.5 rounded-md p-1 text-slate-600 hover:text-slate-400 hover:bg-surface-600 transition-all"
              aria-label="Clear content"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        {isOverLimit && (
          <p className="mt-1.5 text-xs text-red-400 flex items-center gap-1.5">
            <AlertCircle className="h-3.5 w-3.5" />
            Content exceeds the {MAX_CONTENT_LENGTH.toLocaleString()}-character limit.
          </p>
        )}
      </div>

      {/* ── Tip ── */}
      {content.length === 0 && status === 'idle' && (
        <div className="flex items-start gap-2 rounded-lg px-3 py-2.5 text-xs text-slate-600"
          style={{ background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.05)' }}
        >
          <Lightbulb className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-amber-500/60" />
          <span>
            Paste in anything — meeting notes, book highlights, research, ideas, or facts you want to remember.
            The more detail you add, the better your AI answers will be.
          </span>
        </div>
      )}

      {/* ── Actions ── */}
      <div className="flex items-center gap-3 pt-1">
        <button
          type="submit"
          disabled={!canSubmit}
          className="btn btn-primary btn-md flex-1"
        >
          {status === 'loading' ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Saving memory…
            </>
          ) : (
            <>
              <Plus className="h-4 w-4" />
              Save Memory
            </>
          )}
        </button>

        {/* Clear button — only show when there's content */}
        {(title.length > 0 || content.length > 0) && status !== 'loading' && (
          <button
            type="button"
            onClick={handleClear}
            className="btn btn-ghost btn-md"
            aria-label="Clear form"
          >
            <X className="h-4 w-4" />
            <span className="hidden sm:inline">Clear</span>
          </button>
        )}
      </div>

      {/* ── Loading overlay hint ── */}
      {status === 'loading' && (
        <p className="text-center text-xs text-slate-500 animate-pulse">
          Generating embedding and saving to your Second Brain…
        </p>
      )}
    </form>
  )
}
