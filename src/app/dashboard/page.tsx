'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import type { Memory, QueryHistoryItem, QueryResult } from '@/types'

import Header     from '@/components/Header'
import AddMemory  from '@/components/AddMemory'
import AskQuestion from '@/components/AskQuestion'
import AIResponse from '@/components/AIResponse'
import MemoryList from '@/components/MemoryList'

import { ArrowDown, ArrowUpRight, BookOpen, MessageSquare, Plus } from 'lucide-react'
import './workspace.css'

export default function DashboardPage() {
  const router   = useRouter()
  const supabase = createClient()

  const [userEmail, setUserEmail]   = useState<string>('')
  const [memories,  setMemories]    = useState<Memory[]>([])
  const [loadingMem, setLoadingMem] = useState(true)
  const [queryResult, setQueryResult] = useState<QueryResult | null>(null)
  const [activeQuery,  setActiveQuery]  = useState<string>('')
  const [queryHistory, setQueryHistory] = useState<QueryHistoryItem[]>([])
  const [prefillQuestion, setPrefillQuestion] = useState('')
  const [autoSubmitNonce, setAutoSubmitNonce] = useState(0)

  // ── Fetch user ───────────────────────────────────────────────────────────────
  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) { router.push('/auth/login'); return }
      setUserEmail(user.email ?? '')
    })
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Fetch memories ────────────────────────────────────────────────────────────
  const fetchMemories = useCallback(async () => {
    setLoadingMem(true)
    try {
      const res  = await fetch('/api/memories')
      const json = await res.json()
      if (json.data) setMemories(json.data)
    } catch (err) {
      console.error('Failed to fetch memories:', err)
    } finally {
      setLoadingMem(false)
    }
  }, [])

  useEffect(() => { fetchMemories() }, [fetchMemories])

  useEffect(() => {
    async function fetchQueryHistory() {
      try {
        const res = await fetch('/api/query-history')
        const json = await res.json()
        if (res.ok && json.data) {
          setQueryHistory(json.data as QueryHistoryItem[])
        }
      } catch (err) {
        console.error('Failed to fetch query history:', err)
      }
    }
    fetchQueryHistory()
  }, [])

  // ── Handlers ──────────────────────────────────────────────────────────────────

  function handleMemoryAdded(memory: Memory) {
    setMemories((prev) => [memory, ...prev])
  }

  function handleMemoryDeleted(id: string) {
    setMemories((prev) => prev.filter((m) => m.id !== id))
    // If the deleted memory was a source in the current result, clear it
    if (queryResult?.sources.some((s) => s.id === id)) {
      setQueryResult(null)
    }
  }

  function handleQueryResult(result: QueryResult, question: string) {
    setQueryResult(result)
    setActiveQuery(question)
    setQueryHistory((prev) => [
      {
        id: crypto.randomUUID(),
        question,
        result,
        createdAt: new Date().toISOString(),
        settingsSnapshot: {},
      },
      ...prev.slice(0, 9),
    ])
    // Scroll to response on mobile
    setTimeout(() => {
      document.getElementById('ai-response-section')?.scrollIntoView({
        behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth',
        block: 'start',
      })
    }, 100)
  }

  function handleClearResult() {
    setQueryResult(null)
    setActiveQuery('')
  }

  function handleMemoryUpdated(memory: Memory) {
    setMemories((prev) => prev.map((m) => (m.id === memory.id ? memory : m)))
  }

  // ── Logout ────────────────────────────────────────────────────────────────────
  async function handleLogout() {
    await supabase.auth.signOut()
    router.push('/')
    router.refresh()
  }

  // ─────────────────────────────────────────────────────────────────────────────

  const memoryCount = memories.length
  const totalWords  = memories.reduce(
    (acc, m) => acc + m.content.split(/\s+/).filter(Boolean).length,
    0
  )
  const taggedMemories = memories.filter((m) => (m.tags?.length ?? 0) > 0).length
  const recentQuestions = queryHistory.length

  return (
    <div className="workspace">
      <Header userEmail={userEmail} onLogout={handleLogout} />

      <main className="workspace-main">
        <section className="workspace-width workspace-overview" aria-labelledby="workspace-title">
          <div className="workspace-overview-inner">
            <div className="workspace-intro">
              <h1 id="workspace-title">Your notebook</h1>
              <dl className="workspace-stats" aria-label="Notebook totals">
                <div><dt>Memories</dt><dd>{memoryCount}</dd></div>
                <div><dt>Words stored</dt><dd>{totalWords.toLocaleString()}</dd></div>
                <div>
                  <dt>Tagged notes</dt>
                  <dd>
                    {taggedMemories}
                    {memoryCount > 0 && (
                      <span> ({Math.round((taggedMemories / memoryCount) * 100)}%)</span>
                    )}
                  </dd>
                </div>
                <div><dt>Recent questions</dt><dd>{recentQuestions}</dd></div>
              </dl>
            </div>
            <div className="workspace-actions">
              <a className="btn-secondary mobile-question-link" href="#ai-response-section">
                Ask a question <ArrowDown size={15} aria-hidden="true" />
              </a>
              <a className="btn-primary" href="#capture-section">
                <Plus size={17} aria-hidden="true" /> Add memory
              </a>
            </div>
          </div>
        </section>

        <div className="workspace-width workspace-columns">
          <section id="ai-response-section" className="workspace-sheet query-sheet" aria-labelledby="query-heading" tabIndex={-1}>
            <div className="workspace-section-heading">
              <MessageSquare size={17} aria-hidden="true" />
              <div>
                <h2 id="query-heading">Ask your notebook</h2>
                <p>Get an answer with sources from your saved notes.</p>
              </div>
            </div>
            <div className="query-sheet-body">
              <AskQuestion
                hasMemories={memoryCount > 0}
                onResult={handleQueryResult}
                prefillQuestion={prefillQuestion}
                autoSubmitNonce={autoSubmitNonce}
              />
              <AIResponse
                result={queryResult}
                question={activeQuery}
                onClear={handleClearResult}
              />
              {queryHistory.length > 0 && (
                <section className="question-history" aria-labelledby="history-heading">
                  <h3 id="history-heading">Recent questions</h3>
                  <ul className="history-list">
                    {queryHistory.map(({ id, question }) => (
                      <li key={id}>
                        <button
                          type="button"
                          onClick={() => {
                            setPrefillQuestion(question)
                            setAutoSubmitNonce((previous) => previous + 1)
                          }}
                          title="Ask again"
                        >
                          <span>{question}</span>
                          <ArrowUpRight size={16} aria-hidden="true" />
                        </button>
                      </li>
                    ))}
                  </ul>
                </section>
              )}
            </div>
          </section>

          <div className="workspace-column">
            <section id="memory-list-section" className="workspace-sheet library-section" aria-labelledby="memories-heading">
              <div className="workspace-section-heading">
                <BookOpen size={17} aria-hidden="true" />
                <h2 id="memories-heading">Your memories</h2>
              </div>
              {loadingMem ? (
                <div className="memory-skeleton" role="status">
                  <span className="sr-only">Loading memories</span>
                  <span /><span /><span />
                </div>
              ) : memoryCount === 0 ? (
                <div className="workspace-empty">
                  <h3>No memories yet</h3>
                  <p>Save a meeting note, book highlight, or an idea you want to come back to.</p>
                </div>
              ) : (
                <MemoryList
                  memories={memories}
                  onDelete={handleMemoryDeleted}
                  onUpdate={handleMemoryUpdated}
                />
              )}
            </section>

            <section id="capture-section" className="workspace-sheet capture-sheet" aria-labelledby="capture-heading" tabIndex={-1}>
              <div className="workspace-section-heading">
                <Plus size={17} aria-hidden="true" />
                <h2 id="capture-heading">Add memory</h2>
              </div>
              <AddMemory onMemoryAdded={handleMemoryAdded} />
            </section>
          </div>
        </div>
      </main>

      <footer className="workspace-width workspace-footer">
        <span>AI Second Brain</span>
        <span>Answers are grounded in your saved notes.</span>
      </footer>
    </div>
  )
}
