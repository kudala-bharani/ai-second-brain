'use client'

import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import type { Memory, QueryHistoryItem } from '@/types'

import Header     from '@/components/Header'
import AddMemory  from '@/components/AddMemory'
import AskQuestion from '@/components/AskQuestion'
import MemoryList, { type MemoryRevealRequest } from '@/components/MemoryList'

import { ArrowDown, LibraryBig, Plus, X } from 'lucide-react'
import './workspace.css'

export default function DashboardPage() {
  const router   = useRouter()
  const supabase = createClient()

  const [user, setUser] = useState<{ id: string; email?: string } | null>(null)
  const [memories,  setMemories]    = useState<Memory[]>([])
  const [loadingMem, setLoadingMem] = useState(true)
  const [queryHistory, setQueryHistory] = useState<QueryHistoryItem[] | null>(null)
  const [historyError, setHistoryError] = useState(false)
  const [historyVersion, setHistoryVersion] = useState(0)
  const [revealMemory, setRevealMemory] = useState<MemoryRevealRequest | null>(null)
  const [captureOpen, setCaptureOpen] = useState(false)
  const capturePanel = useRef<HTMLElement>(null)
  const captureTrigger = useRef<HTMLElement | null>(null)
  const memoryIds = useMemo(() => new Set(memories.map((memory) => memory.id)), [memories])

  const refreshHistory = useCallback(() => {
    setHistoryError(false)
    setHistoryVersion((version) => version + 1)
  }, [])

  // ── Fetch user ───────────────────────────────────────────────────────────────
  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) { router.push('/auth/login'); return }
      setUser({ id: user.id, email: user.email })
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

  function handleMemoriesChanged(changes: Memory[]) {
    setMemories((previous) => {
      const changed = new Map(changes.map((memory) => [memory.id, memory]))
      const updated = previous.map((memory) => {
        const replacement = changed.get(memory.id)
        changed.delete(memory.id)
        return replacement ?? memory
      })
      return [...changed.values(), ...updated]
    })
  }

  function handleMemoryDeleted(id: string) {
    setMemories((prev) => prev.filter((m) => m.id !== id))
  }

  const handleOpenMemory = useCallback((id: string) => {
    setRevealMemory((previous) => ({ id, request: (previous?.request ?? 0) + 1 }))
  }, [])

  function handleMemoryChanged(memory: Memory) {
    handleMemoriesChanged([memory])
  }

  const focusCapture = useCallback(() => {
    capturePanel.current?.focus({ preventScroll: true })
    capturePanel.current?.scrollIntoView({ block: 'nearest' })
  }, [])

  useEffect(() => {
    if (captureOpen) focusCapture()
  }, [captureOpen, focusCapture])

  function openCapture() {
    captureTrigger.current = document.activeElement instanceof HTMLElement ? document.activeElement : null
    if (captureOpen) focusCapture()
    else setCaptureOpen(true)
  }

  function closeCapture() {
    setCaptureOpen(false)
    captureTrigger.current?.focus()
  }

  // ── Logout ────────────────────────────────────────────────────────────────────
  async function handleLogout() {
    await supabase.auth.signOut()
    router.push('/')
    router.refresh()
  }

  // ─────────────────────────────────────────────────────────────────────────────

  const memoryCount = memories.length

  return (
    <div className="workspace">
      <Header userEmail={user?.email ?? ''} onLogout={handleLogout} />

      <main className="workspace-main">
        <div className="workspace-width workspace-overview">
          <h1>Your notebook</h1>
          <div className="workspace-actions">
            <a className="btn-ghost workspace-library-link" href="#memory-list-section">
              Memories <ArrowDown size={15} aria-hidden="true" />
            </a>
            <button type="button" className="btn-primary workspace-add" onClick={openCapture} aria-expanded={captureOpen} aria-controls="capture-section">
              <Plus size={17} aria-hidden="true" /> Add memory
            </button>
          </div>
        </div>

        <div className="workspace-width workspace-columns">
          <AskQuestion
            key={user?.id}
            userId={user?.id}
            availableMemoryIds={memoryIds}
            loadingMemories={loadingMem}
            history={queryHistory}
            historyError={historyError}
            onRefreshHistory={refreshHistory}
            onOpenMemory={handleOpenMemory}
            onOpenCapture={openCapture}
            onMemoriesChanged={handleMemoriesChanged}
          />

          <aside className="workspace-column" aria-label="Memory library">
            <section ref={capturePanel} id="capture-section" hidden={!captureOpen} className="workspace-sheet capture-sheet" aria-labelledby="capture-heading" tabIndex={-1}>
              <div className="workspace-section-heading">
                <h2 id="capture-heading">Add memory</h2>
                <button type="button" className="icon-button" aria-label="Close add memory" onClick={closeCapture}>
                  <X size={18} aria-hidden="true" />
                </button>
              </div>
              <AddMemory onMemoryAdded={handleMemoryChanged} />
            </section>

            <section id="memory-list-section" className="workspace-sheet library-section" aria-labelledby="memories-heading">
              <div className="workspace-section-heading">
                <div className="workspace-heading-label">
                  <LibraryBig size={17} aria-hidden="true" />
                  <h2 id="memories-heading">Memories</h2>
                </div>
                {!loadingMem && <span className="library-total" aria-label={`${memoryCount} saved memories`}>{memoryCount.toLocaleString()}</span>}
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
                  onUpdate={handleMemoryChanged}
                  revealMemory={revealMemory}
                />
              )}
            </section>
          </aside>
        </div>
      </main>
    </div>
  )
}
