'use client'

import { useEffect, useId, useRef, useState } from 'react'
import { formatDistanceToNow } from 'date-fns'
import { Trash2, Loader2, ChevronDown, ChevronUp, Pencil, FileText, Search, Tag } from 'lucide-react'
import type { Memory } from '@/types'

// ─── Memory Card ──────────────────────────────────────────────────────────────

interface MemoryCardProps {
  memory: Memory
  onDelete: (id: string) => void
  onUpdate: (memory: Memory) => void
  revealRequest?: number
  onReveal: (request: number) => void
}

function MemoryCard({ memory, onDelete, onUpdate, revealRequest, onReveal }: MemoryCardProps) {
  const [deleting,  setDeleting]  = useState(false)
  const [expanded,  setExpanded]  = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [title, setTitle] = useState(memory.title ?? '')
  const [content, setContent] = useState(memory.content)
  const [tagsInput, setTagsInput] = useState((memory.tags ?? []).join(', '))

  const editorId = useId()
  const headingRef = useRef<HTMLHeadingElement>(null)
  const PREVIEW_LENGTH = 160

  const needsExpand  = memory.content.length > PREVIEW_LENGTH
  const previewText  = needsExpand && !expanded
    ? memory.content.slice(0, PREVIEW_LENGTH).trimEnd() + '…'
    : memory.content

  const timeAgo = formatDistanceToNow(new Date(memory.created_at), { addSuffix: true })

  // Word count
  const wordCount = memory.content.split(/\s+/).filter(Boolean).length

  useEffect(() => {
    const heading = headingRef.current
    if (revealRequest === undefined || !heading) return
    if (needsExpand && !expanded) {
      setExpanded(true)
      return
    }

    heading.focus({ preventScroll: true })
    heading.scrollIntoView({ block: 'center', behavior: 'instant' })
    onReveal(revealRequest)
  }, [expanded, needsExpand, onReveal, revealRequest])

  async function handleSaveEdit() {
    setSaving(true)
    try {
      const tags = tagsInput
        .split(',')
        .map((t) => t.trim().toLowerCase())
        .filter(Boolean)
      const res = await fetch(`/api/memories/${memory.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: title.trim() || null,
          content: content.trim(),
          tags,
        }),
      })
      const json = await res.json()
      if (!res.ok || json.error) throw new Error(json.error ?? 'Failed to update')
      onUpdate(json.data as Memory)
      setEditing(false)
    } catch (err) {
      console.error('Update error:', err)
    } finally {
      setSaving(false)
    }
  }

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
    <article className="memory-entry" aria-busy={deleting || saving}>
      <div className="memory-entry-header">
        <div className="memory-entry-icon" aria-hidden="true"><FileText size={17} strokeWidth={1.6} /></div>
        <div className="memory-entry-heading">
          <h3 id={`${editorId}-heading`} ref={headingRef} tabIndex={-1}>{memory.title || 'Untitled note'}</h3>
          <p className="field-detail">
            <time dateTime={memory.created_at}>{timeAgo}</time>
            <span aria-hidden="true"> · </span>
            {wordCount} {wordCount === 1 ? 'word' : 'words'}
          </p>
        </div>

        <div className="memory-entry-actions">
          {showConfirm ? (
            <>
              <button type="button" onClick={handleCancelDelete} className="btn-ghost btn-sm" disabled={deleting}>
                Cancel
              </button>
              <button type="button" onClick={handleDelete} disabled={deleting} className="btn-danger btn-sm">
                {deleting && <Loader2 size={16} className="status-spinner" aria-hidden="true" />}
                {deleting ? 'Deleting…' : 'Confirm delete'}
              </button>
            </>
          ) : (
            <>
              {!editing && (
                <button type="button" onClick={() => setEditing(true)} className="icon-button" aria-label="Edit memory" aria-describedby={`${editorId}-heading`} title="Edit memory">
                  <Pencil size={16} aria-hidden="true" />
                </button>
              )}
              <button type="button" onClick={handleDelete} className="icon-button memory-delete" aria-label="Delete memory" aria-describedby={`${editorId}-heading`} title="Delete memory">
                <Trash2 size={16} aria-hidden="true" />
              </button>
            </>
          )}
        </div>
      </div>

      {editing ? (
        <div className="memory-edit">
          <div>
            <label htmlFor={`${editorId}-title`} className="label">Title</label>
            <input id={`${editorId}-title`} value={title} onChange={(event) => setTitle(event.target.value)} className="input" />
          </div>
          <div>
            <label htmlFor={`${editorId}-content`} className="label">Content</label>
            <textarea id={`${editorId}-content`} value={content} onChange={(event) => setContent(event.target.value)} className="input textarea" rows={4} />
          </div>
          <div>
            <label htmlFor={`${editorId}-tags`} className="label">Tags</label>
            <input id={`${editorId}-tags`} value={tagsInput} onChange={(event) => setTagsInput(event.target.value)} className="input" placeholder="Separate tags with commas" />
          </div>
          <div className="form-actions">
            <button type="button" onClick={handleSaveEdit} disabled={saving} className="btn-primary btn-sm">
              {saving && <Loader2 size={16} className="status-spinner" aria-hidden="true" />}
              {saving ? 'Saving…' : 'Save'}
            </button>
            <button
              type="button"
              onClick={() => {
                setEditing(false)
                setTitle(memory.title ?? '')
                setContent(memory.content)
                setTagsInput((memory.tags ?? []).join(', '))
              }}
              className="btn-ghost btn-sm"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <>
          <p className="memory-preview" id={`${editorId}-preview`}>{previewText}</p>
          {needsExpand && (
            <button
              type="button"
              onClick={() => setExpanded((value) => !value)}
              className="text-control"
              aria-expanded={expanded}
              aria-controls={`${editorId}-preview`}
            >
              {expanded ? <ChevronUp size={16} aria-hidden="true" /> : <ChevronDown size={16} aria-hidden="true" />}
              {expanded ? 'Show less' : 'Show more'}
            </button>
          )}
          {!!memory.tags?.length && (
            <ul className="memory-tags" aria-label="Tags">
              {memory.tags.map((tag) => <li key={tag}>#{tag}</li>)}
            </ul>
          )}
        </>
      )}
    </article>
  )
}

export interface MemoryRevealRequest {
  id: string
  request: number
}

interface MemoryListProps {
  memories: Memory[]
  onDelete: (id: string) => void
  onUpdate: (memory: Memory) => void
  revealMemory: MemoryRevealRequest | null
}

export default function MemoryList({ memories, onDelete, onUpdate, revealMemory }: MemoryListProps) {
  const [search, setSearch] = useState('')
  const [tagFilter, setTagFilter] = useState('')
  const [lastRevealRequest, setLastRevealRequest] = useState<number | null>(null)
  const pendingReveal = revealMemory?.request !== lastRevealRequest ? revealMemory : null

  const filtered = memories.filter((m) => {
    const matchesSearch = search.trim()
      ? m.content.toLowerCase().includes(search.toLowerCase()) ||
        (m.title ?? '').toLowerCase().includes(search.toLowerCase())
      : true
    const matchesTag = tagFilter.trim()
      ? (m.tags ?? []).some((t) => t.includes(tagFilter.toLowerCase()))
      : true
    return matchesSearch && matchesTag
  })

  const revealHiddenByFilter = pendingReveal !== null &&
    memories.some((memory) => memory.id === pendingReveal.id) &&
    !filtered.some((memory) => memory.id === pendingReveal.id)

  useEffect(() => {
    if (!revealHiddenByFilter) return

    setSearch('')
    setTagFilter('')
  }, [revealHiddenByFilter])

  return (
    <div className="memory-list">
      <div className="memory-filters">
        <div className="memory-filter">
          <label htmlFor="memory-search" className="sr-only">Search memories</label>
          <Search size={16} aria-hidden="true" />
          <input
            id="memory-search"
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search notes"
            className="input"
          />
        </div>
        <div className="memory-filter">
          <label htmlFor="memory-tag-filter" className="sr-only">Filter by tag</label>
          <Tag size={15} aria-hidden="true" />
          <input
            id="memory-tag-filter"
            type="search"
            value={tagFilter}
            onChange={(event) => setTagFilter(event.target.value)}
            placeholder="Tag"
            className="input"
          />
        </div>
      </div>

      <p className={search || tagFilter ? 'field-detail memory-list-count' : 'sr-only'} role="status">
        {search || tagFilter
          ? `${filtered.length} of ${memories.length} ${memories.length === 1 ? 'memory' : 'memories'}`
          : `${memories.length} ${memories.length === 1 ? 'memory' : 'memories'} stored`}
      </p>

      {filtered.length === 0 ? (
        <div className="workspace-empty">
          <h3>No matching memories</h3>
          <button
            type="button"
            onClick={() => {
              setSearch('')
              setTagFilter('')
            }}
            className="text-control"
          >
            {search && !tagFilter ? 'Clear search' : 'Clear filters'}
          </button>
        </div>
      ) : (
        <div className="memory-entries">
          {filtered.map((memory) => (
            <MemoryCard
              key={memory.id}
              memory={memory}
              onDelete={onDelete}
              onUpdate={onUpdate}
              revealRequest={pendingReveal?.id === memory.id ? pendingReveal.request : undefined}
              onReveal={setLastRevealRequest}
            />
          ))}
        </div>
      )}
    </div>
  )
}
