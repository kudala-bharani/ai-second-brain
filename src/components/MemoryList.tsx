'use client'

import { useState } from 'react'
import { formatDistanceToNow } from 'date-fns'
import { Trash2, FileText, Clock, Loader2, ChevronDown, ChevronUp } from 'lucide-react'
import type { Memory } from '@/types'

// ─── Memory Card ──────────────────────────────────────────────────────────────

interface MemoryCardProps {
  memory: Memory
  onDelete: (id: string) => void
}

function MemoryCard({ memory, onDelete }: MemoryCardProps) {
  const [deleting,  setDeleting]  = useState(false)
  const [expanded,  setExpanded]  = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)

  const PREVIEW_LENGTH = 160

  const needsExpand  = memory.content.length > PREVIEW_LENGTH
  const previewText  = needsExpand && !expanded
    ? memory.content.slice(0, PREVIEW_LENGTH).trimEnd() + '…'
    : memory.content

  const timeAgo = formatDistanceToNow(new Date(memory.created_at), { addSuffix: true })

  // Word count
  const wordCount = memory.content.split(/\s+/).filter(Boolean).length

  async function handleDelete() {
    if (!showConfirm) {
      setShowConfirm(true)
      // Auto-dismiss confirm after 3 s if user doesn't act
      setTimeout(() => setShowConfirm(false), 3000)
      return
    }

    setDeleting(true)
    try {
      const res = await fetch(`/api/memories/${memory.id}`, { method: 'DELETE' })
      if (!res.ok) {
        const json = await res.json()
        console.error('Delete failed:', json.error)
        setDeleting(false)
        setShowConfirm(false)
        return
      }
      onDelete(memory.id)
    } catch (err) {
      console.error('Delete error:', err)
      setDeleting(false)
      setShowConfirm(false)
    }
  }

  function handleCancelDelete(e: React.MouseEvent) {
    e.stopPropagation()
    setShowConfirm(false)
  }

  return (
    <article
      className={`
        group relative rounded-xl border p-4
        transition-all duration-200
        ${deleting ? 'opacity-50 scale-[0.99] pointer-events-none' : 'hover:border-white/10'}
      `}
      style={{
        background: 'rgba(22, 22, 31, 0.6)',
        borderColor: 'rgba(255,255,255,0.07)',
      }}
    >
      {/* ── Top row: title + actions ── */}
      <div className="flex items-start justify-between gap-3 mb-2">

        {/* Title / fallback */}
        <div className="flex items-start gap-2.5 min-w-0">
          <div className="mt-0.5 flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg bg-brand-500/12"
            style={{ background: 'rgba(99,102,241,0.12)' }}>
            <FileText className="h-3.5 w-3.5 text-brand-400" />
          </div>
          <div className="min-w-0">
            <h3 className="truncate text-sm font-semibold text-slate-200 leading-snug">
              {memory.title || 'Untitled note'}
            </h3>
            <div className="mt-0.5 flex items-center gap-2 text-xs text-slate-600">
              <Clock className="h-3 w-3 flex-shrink-0" />
              <span>{timeAgo}</span>
              <span className="text-slate-700">·</span>
              <span>{wordCount} words</span>
            </div>
          </div>
        </div>

        {/* Delete button / confirm */}
        <div className="flex-shrink-0">
          {showConfirm ? (
            <div className="flex items-center gap-1.5 animate-scale-in">
              <button
                onClick={handleCancelDelete}
                className="rounded-lg px-2 py-1 text-xs text-slate-400
                           hover:text-slate-200 hover:bg-surface-600
                           transition-colors duration-150"
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="flex items-center gap-1 rounded-lg bg-red-500/15 px-2 py-1 text-xs font-medium
                           text-red-400 ring-1 ring-red-500/25
                           hover:bg-red-500/25 hover:text-red-300
                           transition-all duration-150
                           disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {deleting ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                  <Trash2 className="h-3 w-3" />
                )}
                Confirm
              </button>
            </div>
          ) : (
            <button
              onClick={handleDelete}
              className="rounded-lg p-1.5 text-slate-700
                         opacity-0 group-hover:opacity-100
                         hover:bg-red-500/10 hover:text-red-400
                         transition-all duration-150"
              aria-label="Delete memory"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>

      {/* ── Content preview ── */}
      <div className="pl-9">
        <p className="text-sm text-slate-400 leading-relaxed whitespace-pre-wrap break-words">
          {previewText}
        </p>

        {needsExpand && (
          <button
            onClick={() => setExpanded(e => !e)}
            className="mt-2 flex items-center gap-1 text-xs font-medium text-brand-400/70
                       hover:text-brand-400 transition-colors duration-150"
          >
            {expanded ? (
              <>
                <ChevronUp className="h-3.5 w-3.5" />
                Show less
              </>
            ) : (
              <>
                <ChevronDown className="h-3.5 w-3.5" />
                Show more
              </>
            )}
          </button>
        )}
      </div>

      {/* Deleting overlay */}
      {deleting && (
        <div className="absolute inset-0 flex items-center justify-center rounded-xl">
          <div className="flex items-center gap-2 text-xs text-red-400">
            <Loader2 className="h-4 w-4 animate-spin" />
            Deleting…
          </div>
        </div>
      )}
    </article>
  )
}

// ─── Memory List ──────────────────────────────────────────────────────────────

interface MemoryListProps {
  memories: Memory[]
  onDelete: (id: string) => void
}

export default function MemoryList({ memories, onDelete }: MemoryListProps) {
  const [search, setSearch] = useState('')

  const filtered = search.trim()
    ? memories.filter(
        (m) =>
          m.content.toLowerCase().includes(search.toLowerCase()) ||
          (m.title ?? '').toLowerCase().includes(search.toLowerCase())
      )
    : memories

  return (
    <div className="flex flex-col gap-3">

      {/* Search */}
      {memories.length > 2 && (
        <div className="relative mb-1">
          <svg
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-600"
            fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round"
              d="M21 21l-4.35-4.35m0 0A7.5 7.5 0 104.5 4.5a7.5 7.5 0 0012.15 12.15z" />
          </svg>
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search your notes…"
            className="input pl-9 py-2 text-xs"
          />
        </div>
      )}

      {/* Results count */}
      {search && (
        <p className="text-xs text-slate-600 -mt-1 mb-1">
          {filtered.length === 0
            ? 'No notes match your search'
            : `${filtered.length} of ${memories.length} note${memories.length !== 1 ? 's' : ''}`}
        </p>
      )}

      {/* Cards */}
      <div className="flex flex-col gap-2 max-h-[520px] overflow-y-auto pr-0.5">
        {filtered.length === 0 && search ? (
          <div className="flex flex-col items-center justify-center rounded-xl border border-dashed py-10 text-center"
            style={{ borderColor: 'rgba(255,255,255,0.07)' }}>
            <p className="text-sm text-slate-500">No notes match &ldquo;{search}&rdquo;</p>
            <button
              onClick={() => setSearch('')}
              className="mt-2 text-xs text-brand-400 hover:text-brand-300 transition-colors"
            >
              Clear search
            </button>
          </div>
        ) : (
          filtered.map((memory, i) => (
            <div
              key={memory.id}
              className="animate-slide-up"
              style={{ animationDelay: `${Math.min(i * 40, 200)}ms` }}
            >
              <MemoryCard memory={memory} onDelete={onDelete} />
            </div>
          ))
        )}
      </div>

      {/* Footer count */}
      {memories.length > 0 && !search && (
        <p className="text-center text-xs text-slate-700 pt-1">
          {memories.length} memor{memories.length === 1 ? 'y' : 'ies'} stored
        </p>
      )}
    </div>
  )
}
