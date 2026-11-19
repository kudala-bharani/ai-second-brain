'use client'

import { useCallback, useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from 'react'
import { AlertCircle, ArrowUpRight, Loader2, X } from 'lucide-react'
import type { QueryResult } from '@/types'

interface AskQuestionProps {
  hasMemories: boolean
  onResult: (result: QueryResult, question: string) => void
  prefillQuestion?: string
  autoSubmitNonce?: number
}

const EXAMPLE_QUESTIONS = [
  'What are my key ideas about productivity?',
  'Summarize my notes on this topic',
  'What did I learn recently?',
  'What tasks or goals have I written about?',
]

export default function AskQuestion({
  hasMemories,
  onResult,
  prefillQuestion,
  autoSubmitNonce,
}: AskQuestionProps) {
  const [question, setQuestion] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const lastAutoNonce = useRef(0)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const canSubmit = question.trim().length >= 3 && !loading && hasMemories

  const submitQuestion = useCallback(async (value: string) => {
    const submittedQuestion = value.trim()
    if (submittedQuestion.length < 3 || loading || !hasMemories) return

    setError(null)
    setLoading(true)
    try {
      const res = await fetch('/api/query', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question: submittedQuestion }),
      })
      const json = await res.json()

      if (!res.ok || json.error) {
        setError(json.error ?? 'Something went wrong. Please try again.')
        return
      }
      onResult(json.data as QueryResult, submittedQuestion)
    } catch {
      setError('Network error. Please check your connection and try again.')
    } finally {
      setLoading(false)
    }
  }, [hasMemories, loading, onResult])

  useEffect(() => {
    if (!autoSubmitNonce || autoSubmitNonce === lastAutoNonce.current || !prefillQuestion || loading) return
    lastAutoNonce.current = autoSubmitNonce
    setQuestion(prefillQuestion)
    void submitQuestion(prefillQuestion)
  }, [autoSubmitNonce, prefillQuestion, loading, submitQuestion])

  function handleSubmit(event: FormEvent) {
    event.preventDefault()
    void submitQuestion(question)
  }

  function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') {
      event.preventDefault()
      void submitQuestion(question)
    }
  }

  function handleExampleClick(example: string) {
    setQuestion(example)
    setError(null)
    textareaRef.current?.focus()
  }

  return (
    <div className="question-composer">
      {error && (
        <div className="notice-error" role="alert">
          <AlertCircle size={17} aria-hidden="true" />
          <span>{error}</span>
          <button type="button" onClick={() => setError(null)} className="notice-dismiss" aria-label="Dismiss error">
            <X size={16} aria-hidden="true" />
          </button>
        </div>
      )}

      <form className="question-form" onSubmit={handleSubmit}>
        <label htmlFor="notebook-question" className="label sr-only">Your question</label>
        <textarea
          ref={textareaRef}
          id="notebook-question"
          value={question}
          onChange={(event) => {
            setQuestion(event.target.value)
            if (error) setError(null)
          }}
          onKeyDown={handleKeyDown}
          placeholder={hasMemories ? 'What do your notes say about…' : 'Add a memory to ask a question'}
          disabled={loading || !hasMemories}
          rows={3}
          className="input textarea question-input"
          aria-describedby="question-hint"
        />
        <div className="question-actions">
          <p id="question-hint" className="field-detail">
            {hasMemories
              ? <><kbd>Ctrl/Cmd</kbd> + <kbd>Enter</kbd> to send</>
              : 'Save at least one memory to start asking questions.'}
          </p>
          <button type="submit" disabled={!canSubmit} className="btn-primary">
            {loading ? 'Asking…' : 'Ask question'}
            {loading
              ? <Loader2 size={17} className="status-spinner" aria-hidden="true" />
              : <ArrowUpRight size={17} aria-hidden="true" />}
          </button>
        </div>
      </form>

      {loading && (
        <div className="notice-neutral" role="status">
          <span>Searching your notes and writing an answer…</span>
        </div>
      )}

      {!question && hasMemories && !loading && (
        <div className="question-examples">
          <p className="label">Try asking</p>
          <ul>
            {EXAMPLE_QUESTIONS.map((example) => (
              <li key={example}>
                <button type="button" onClick={() => handleExampleClick(example)}>
                  <ArrowUpRight size={15} aria-hidden="true" />
                  {example}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
