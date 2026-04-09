'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import type { Memory, QueryResult } from '@/types'

import Header     from '@/components/Header'
import AddMemory  from '@/components/AddMemory'
import AskQuestion from '@/components/AskQuestion'
import AIResponse from '@/components/AIResponse'
import MemoryList from '@/components/MemoryList'

import { Brain, Sparkles, BookOpen, MessageSquare } from 'lucide-react'

// ─── Stat Card ────────────────────────────────────────────────────────────────

function StatCard({
  icon,
  label,
  value,
  sub,
  gradient,
}: {
  icon: React.ReactNode
  label: string
  value: string | number
  sub?: string
  gradient: string
}) {
  return (
    <div className="card p-5 flex items-center gap-4">
      <div className={`flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl ${gradient}`}>
        {icon}
      </div>
      <div>
        <p className="text-xs font-semibold uppercase tracking-widest text-slate-500">{label}</p>
        <p className="mt-0.5 text-2xl font-bold text-slate-100 leading-none">{value}</p>
        {sub && <p className="mt-1 text-xs text-slate-600">{sub}</p>}
      </div>
    </div>
  )
}

// ─── Empty Landing ────────────────────────────────────────────────────────────

function EmptyLanding() {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed py-16 px-8 text-center"
         style={{ borderColor: 'rgba(255,255,255,0.08)' }}>
      <div className="mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-brand-500/10 ring-1 ring-brand-500/20">
        <Brain className="h-8 w-8 text-brand-400" />
      </div>
      <h3 className="mb-2 text-lg font-semibold text-slate-200">Your Second Brain is empty</h3>
      <p className="max-w-sm text-sm text-slate-500 leading-relaxed">
        Start by adding your first memory above — paste in notes, ideas, facts, or anything
        you want to remember. Then ask AI questions to retrieve your knowledge instantly.
      </p>
      <div className="mt-6 flex flex-wrap justify-center gap-2">
        {['📝 Meeting notes', '💡 Ideas', '📚 Book summaries', '🔖 Research'].map((tag) => (
          <span
            key={tag}
            className="rounded-full border px-3 py-1 text-xs text-slate-500"
            style={{ borderColor: 'rgba(255,255,255,0.08)' }}
          >
            {tag}
          </span>
        ))}
      </div>
    </div>
  )
}

// ─── Section Header ───────────────────────────────────────────────────────────

function SectionHeader({
  icon,
  title,
  subtitle,
  badge,
}: {
  icon: React.ReactNode
  title: string
  subtitle?: string
  badge?: React.ReactNode
}) {
  return (
    <div className="mb-5 flex items-start justify-between gap-3">
      <div className="flex items-center gap-3">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-500/15 text-brand-400">
          {icon}
        </div>
        <div>
          <h2 className="text-base font-semibold text-slate-100">{title}</h2>
          {subtitle && <p className="text-xs text-slate-500">{subtitle}</p>}
        </div>
      </div>
      {badge}
    </div>
  )
}

// ─── Dashboard Page ───────────────────────────────────────────────────────────

export default function DashboardPage() {
  const router   = useRouter()
  const supabase = createClient()

  const [userEmail, setUserEmail]   = useState<string>('')
  const [memories,  setMemories]    = useState<Memory[]>([])
  const [loadingMem, setLoadingMem] = useState(true)
  const [queryResult, setQueryResult] = useState<QueryResult | null>(null)
  const [activeQuery,  setActiveQuery]  = useState<string>('')

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
    // Scroll to response on mobile
    setTimeout(() => {
      document.getElementById('ai-response-section')?.scrollIntoView({
        behavior: 'smooth',
        block: 'start',
      })
    }, 100)
  }

  function handleClearResult() {
    setQueryResult(null)
    setActiveQuery('')
  }

  // ── Logout ────────────────────────────────────────────────────────────────────
  async function handleLogout() {
    await supabase.auth.signOut()
    router.push('/auth/login')
    router.refresh()
  }

  // ─────────────────────────────────────────────────────────────────────────────

  const memoryCount = memories.length
  const totalWords  = memories.reduce(
    (acc, m) => acc + m.content.split(/\s+/).filter(Boolean).length,
    0
  )

  return (
    <div className="min-h-screen flex flex-col">

      {/* ── Header ──────────────────────────────────────────────────────────── */}
      <Header userEmail={userEmail} onLogout={handleLogout} />

      {/* ── Main content ─────────────────────────────────────────────────────── */}
      <main className="flex-1 mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8 py-8">

        {/* Stats row */}
        <div className="mb-8 grid grid-cols-2 gap-3 sm:grid-cols-4 animate-slide-up">
          <StatCard
            icon={<BookOpen className="h-5 w-5 text-brand-400" />}
            label="Memories"
            value={memoryCount}
            sub={memoryCount === 1 ? '1 note stored' : `${memoryCount} notes stored`}
            gradient="bg-brand-500/15"
          />
          <StatCard
            icon={<span className="text-lg">📝</span>}
            label="Words stored"
            value={totalWords.toLocaleString()}
            sub="across all notes"
            gradient="bg-violet-500/15"
          />
          <StatCard
            icon={<Sparkles className="h-5 w-5 text-amber-400" />}
            label="AI Model"
            value="OpenRouter (auto-fallback)"
            sub="BAAI/bge-small-en-v1.5"
            gradient="bg-amber-500/15"
          />
          <StatCard
            icon={<MessageSquare className="h-5 w-5 text-emerald-400" />}
            label="RAG enabled"
            value="Active"
            sub="answers from your data"
            gradient="bg-emerald-500/15"
          />
        </div>

        {/* ── Two-column grid ──────────────────────────────────────────────────── */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">

          {/* ── Left column (Add Memory + Memory List) ─────────────────────────── */}
          <div className="lg:col-span-2 flex flex-col gap-6">

            {/* Add Memory */}
            <section className="card p-6 animate-slide-up stagger-1">
              <SectionHeader
                icon={<span className="text-sm">✍️</span>}
                title="Add Memory"
                subtitle="Store a new note into your Second Brain"
              />
              <AddMemory onMemoryAdded={handleMemoryAdded} />
            </section>

            {/* Memory List */}
            <section className="card p-6 animate-slide-up stagger-2" id="memory-list-section">
              <SectionHeader
                icon={<BookOpen className="h-4 w-4" />}
                title="Your Memories"
                subtitle="All stored notes"
                badge={
                  memoryCount > 0 ? (
                    <span className="badge-brand">{memoryCount}</span>
                  ) : undefined
                }
              />

              {loadingMem ? (
                <div className="space-y-3">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="skeleton h-20 w-full" />
                  ))}
                </div>
              ) : memoryCount === 0 ? (
                <EmptyLanding />
              ) : (
                <MemoryList
                  memories={memories}
                  onDelete={handleMemoryDeleted}
                />
              )}
            </section>
          </div>

          {/* ── Right column (Unified Ask + Response) ───────────────────────────── */}
          <div className="lg:col-span-3 flex flex-col gap-6">
            <section
              id="ai-response-section"
              className="card p-6 animate-slide-up stagger-2"
              style={{ minHeight: '260px' }}
            >
              <SectionHeader
                icon={<Sparkles className="h-4 w-4" />}
                title="Ask Your Brain"
                subtitle={
                  queryResult
                    ? `Answer uses ${queryResult.sources.length} source${queryResult.sources.length !== 1 ? 's' : ''}`
                    : 'Ask a question and get an answer from your notes'
                }
                badge={
                  queryResult && queryResult.sources.length > 0 ? (
                    <span className="badge-green">
                      {queryResult.sources.length} source{queryResult.sources.length !== 1 ? 's' : ''}
                    </span>
                  ) : undefined
                }
              />
              <AskQuestion
                hasMemories={memoryCount > 0}
                onResult={handleQueryResult}
              />
              <div className="divider" />
              <AIResponse
                result={queryResult}
                question={activeQuery}
                onClear={handleClearResult}
              />
            </section>
          </div>
        </div>
      </main>

      {/* ── Footer ───────────────────────────────────────────────────────────── */}
      <footer className="mt-8 border-t py-5 text-center text-xs text-slate-700"
              style={{ borderColor: 'rgba(255,255,255,0.05)' }}>
        <span className="text-gradient font-semibold">AI Second Brain</span>
        {' '}— answers are grounded exclusively in your stored notes
      </footer>
    </div>
  )
}
