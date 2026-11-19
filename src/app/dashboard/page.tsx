'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import type { Memory, QueryHistoryItem } from '@/types'

import Header     from '@/components/Header'
import AddMemory  from '@/components/AddMemory'
import AskQuestion from '@/components/AskQuestion'
import MemoryList, { type MemoryRevealRequest } from '@/components/MemoryList'

import { ArrowDown, BookOpen, Plus } from 'lucide-react'
import './workspace.css'

export default function DashboardPage() {
  const router   = useRouter()
  const supabase = createClient()

  const [userEmail, setUserEmail]   = useState<string>('')
  const [memories,  setMemories]    = useState<Memory[]>([])
  const [loadingMem, setLoadingMem] = useState(true)
  const [queryHistory, setQueryHistory] = useState<QueryHistoryItem[] | null>(null)
  const [historyError, setHistoryError] = useState(false)
  const [historyVersion, setHistoryVersion] = useState(0)
  const [revealMemory, setRevealMemory] = useState<MemoryRevealRequest | null>(null)
  const memoryIds = useMemo(() => new Set(memories.map((memory) => memory.id)), [memories])

  const refreshHistory = useCallback(() => {
    setHistoryError(false)
    setHistoryVersion((version) => version + 1)
  }, [])

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
    const request = new AbortController()
    async function fetchQueryHistory() {
      try {
        const res = await fetch('/api/query-history', { signal: request.signal })
        if (!res.ok) throw new Error('Unable to load query history')
        const json = await res.json()
        if (!request.signal.aborted) setQueryHistory(json.data as QueryHistoryItem[])
      } catch {
        if (!request.signal.aborted) setHistoryError(true)
      }
    }
    void fetchQueryHistory()
    return () => request.abort()
  }, [historyVersion])

  // ── Handlers ──────────────────────────────────────────────────────────────────

  function handleMemoryAdded(memory: Memory) {
    setMemories((prev) => [memory, ...prev])
  }

  function handleMemoryDeleted(id: string) {
    setMemories((prev) => prev.filter((m) => m.id !== id))
  }

  const handleOpenMemory = useCallback((id: string) => {
    setRevealMemory((previous) => ({ id, request: (previous?.request ?? 0) + 1 }))
  }, [])

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
  const recentQuestions = queryHistory?.length ?? 0

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
          <AskQuestion
            availableMemoryIds={memoryIds}
            loadingMemories={loadingMem}
            history={queryHistory}
            historyError={historyError}
            onRefreshHistory={refreshHistory}
            onOpenMemory={handleOpenMemory}
          />

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
                  revealMemory={revealMemory}
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
