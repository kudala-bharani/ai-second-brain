'use client'

import { useState } from 'react'
import type { QueryResult, MemoryMatch } from '@/types'
import {
  Brain,
  Sparkles,
  ChevronDown,
  ChevronUp,
  Clock,
  FileText,
  Copy,
  Check,
  X,
  AlertCircle,
  Info,
} from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'

// ─── Markdown renderer (lightweight, no external lib) ─────────────────────────

function renderMarkdown(text: string): React.ReactNode[] {
  const lines = text.split('\n')
  const nodes: React.ReactNode[] = []
  let i = 0
  let keyCounter = 0

  const key = () => keyCounter++

  while (i < lines.length) {
    const line = lines[i]

    // Fenced code block
    if (line.startsWith('```')) {
      const lang = line.slice(3).trim()
      const codeLines: string[] = []
      i++
      while (i < lines.length && !lines[i].startsWith('```')) {
        codeLines.push(lines[i])
        i++
      }
      nodes.push(
        <pre key={key()} className="my-3 overflow-x-auto rounded-lg bg-surface-700 p-4 ring-1 ring-white/5">
          {lang && (
            <div className="mb-2 text-[10px] font-semibold uppercase tracking-widest text-slate-500">
              {lang}
            </div>
          )}
          <code className="font-mono text-sm leading-relaxed text-slate-300">
            {codeLines.join('\n')}
          </code>
        </pre>
      )
      i++
      continue
    }

    // Heading 3
    if (line.startsWith('### ')) {
      nodes.push(
        <h3 key={key()} className="mb-1 mt-4 text-base font-semibold text-slate-100 first:mt-0">
          {inlineMarkdown(line.slice(4))}
        </h3>
      )
      i++
      continue
    }

    // Heading 2
    if (line.startsWith('## ')) {
      nodes.push(
        <h2 key={key()} className="mb-1 mt-4 text-lg font-semibold text-slate-100 first:mt-0">
          {inlineMarkdown(line.slice(3))}
        </h2>
      )
      i++
      continue
    }

    // Heading 1
    if (line.startsWith('# ')) {
      nodes.push(
        <h1 key={key()} className="mb-2 mt-4 text-xl font-bold text-slate-100 first:mt-0">
          {inlineMarkdown(line.slice(2))}
        </h1>
      )
      i++
      continue
    }

    // Horizontal rule
    if (/^---+$/.test(line.trim())) {
      nodes.push(
        <hr key={key()} className="my-4 border-white/10" />
      )
      i++
      continue
    }

    // Blockquote
    if (line.startsWith('> ')) {
      nodes.push(
        <blockquote
          key={key()}
          className="my-3 border-l-2 border-brand-500/50 pl-4 italic text-slate-400"
        >
          {inlineMarkdown(line.slice(2))}
        </blockquote>
      )
      i++
      continue
    }

    // Unordered list — collect consecutive list items
    if (line.startsWith('- ') || line.startsWith('* ')) {
      const items: string[] = []
      while (
        i < lines.length &&
        (lines[i].startsWith('- ') || lines[i].startsWith('* '))
      ) {
        items.push(lines[i].slice(2))
        i++
      }
      nodes.push(
        <ul key={key()} className="my-3 list-disc space-y-1.5 pl-5">
          {items.map((item, idx) => (
            <li key={idx} className="text-slate-300 leading-relaxed">
              {inlineMarkdown(item)}
            </li>
          ))}
        </ul>
      )
      continue
    }

    // Ordered list — collect consecutive numbered items
    if (/^\d+\.\s/.test(line)) {
      const items: string[] = []
      while (i < lines.length && /^\d+\.\s/.test(lines[i])) {
        items.push(lines[i].replace(/^\d+\.\s/, ''))
        i++
      }
      nodes.push(
        <ol key={key()} className="my-3 list-decimal space-y-1.5 pl-5">
          {items.map((item, idx) => (
            <li key={idx} className="text-slate-300 leading-relaxed">
              {inlineMarkdown(item)}
            </li>
          ))}
        </ol>
      )
      continue
    }

    // Empty line
    if (line.trim() === '') {
      i++
      continue
    }

    // Normal paragraph
    nodes.push(
      <p key={key()} className="mb-3 leading-7 text-slate-200 last:mb-0">
        {inlineMarkdown(line)}
      </p>
    )
    i++
  }

  return nodes
}

// ─── Inline markdown: bold, italic, code, links ───────────────────────────────

function inlineMarkdown(text: string): React.ReactNode {
  const parts: React.ReactNode[] = []
  // Pattern: **bold**, *italic*, `code`, [text](url)
  const regex = /(\*\*(.+?)\*\*|\*(.+?)\*|`([^`]+)`|\[([^\]]+)\]\(([^)]+)\))/g
  let lastIndex = 0
  let match: RegExpExecArray | null

  while ((match = regex.exec(text)) !== null) {
    // Text before match
    if (match.index > lastIndex) {
      parts.push(text.slice(lastIndex, match.index))
    }

    if (match[2] !== undefined) {
      // **bold**
      parts.push(
        <strong key={match.index} className="font-semibold text-slate-100">
          {match[2]}
        </strong>
      )
    } else if (match[3] !== undefined) {
      // *italic*
      parts.push(
        <em key={match.index} className="italic text-slate-300">
          {match[3]}
        </em>
      )
    } else if (match[4] !== undefined) {
      // `code`
      parts.push(
        <code
          key={match.index}
          className="rounded bg-surface-600 px-1.5 py-0.5 font-mono text-xs text-brand-400 ring-1 ring-white/5"
        >
          {match[4]}
        </code>
      )
    } else if (match[5] !== undefined && match[6] !== undefined) {
      // [text](url)
      parts.push(
        <a
          key={match.index}
          href={match[6]}
          target="_blank"
          rel="noopener noreferrer"
          className="text-brand-400 underline underline-offset-2 hover:text-brand-300 transition-colors"
        >
          {match[5]}
        </a>
      )
    }

    lastIndex = regex.lastIndex
  }

  // Remaining text
  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex))
  }

  return parts.length === 1 ? parts[0] : <>{parts}</>
}

function renderHighlightedText(text: string, terms: string[]): React.ReactNode {
  if (!terms.length) return text
  const escaped = terms.map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
  const regex = new RegExp(`\\b(${escaped.join("|")})\\b`, "i")
  const splitRegex = new RegExp(`\\b(${escaped.join("|")})\\b`, "gi")
  const parts = text.split(splitRegex)
  return (
    <>
      {parts.map((part, idx) =>
        regex.test(part) ? (
          <mark key={idx} className="rounded bg-amber-500/20 px-0.5 text-amber-200">
            {part}
          </mark>
        ) : (
          <span key={idx}>{part}</span>
        )
      )}
    </>
  )
}

// ─── Source Card ──────────────────────────────────────────────────────────────

function SourceCard({
  source,
  index,
}: {
  source: MemoryMatch
  index: number
}) {
  const [expanded, setExpanded] = useState(false)
  const preview = source.content.slice(0, 180)
  const snippet = source.evidence_snippet?.trim() || preview
  const terms = source.evidence_terms ?? []
  const isLong  = source.content.length > 180

  const similarityPct = Math.round((source.similarity ?? 0) * 100)
  const similarityColor =
    similarityPct >= 80
      ? 'text-emerald-400 bg-emerald-500/10 ring-emerald-500/25'
      : similarityPct >= 60
      ? 'text-amber-400 bg-amber-500/10 ring-amber-500/25'
      : 'text-slate-400 bg-slate-500/10 ring-slate-500/25'

  return (
    <div
      className="group rounded-xl border p-4 transition-all duration-200 hover:border-white/12 hover:bg-surface-700/50 animate-fade-in"
      style={{
        borderColor: 'rgba(255,255,255,0.07)',
        animationDelay: `${index * 60}ms`,
      }}
    >
      {/* Card Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2.5 min-w-0">
          {/* Index badge */}
          <span className="flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-md bg-brand-500/20 text-[10px] font-bold text-brand-400">
            {index + 1}
          </span>

          {/* Title */}
          <span className="truncate text-sm font-medium text-slate-200">
            {source.title ?? 'Untitled note'}
          </span>
        </div>

        {/* Similarity + timestamp */}
        <div className="flex flex-shrink-0 items-center gap-2">
          <span
            className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 ${similarityColor}`}
          >
            {similarityPct}% match
          </span>
        </div>
      </div>

      {/* Timestamp */}
      <div className="mt-1.5 flex items-center gap-1.5 text-[11px] text-slate-600">
        <Clock className="h-3 w-3" />
        <span>
          {formatDistanceToNow(new Date(source.created_at), { addSuffix: true })}
        </span>
      </div>

      {/* Evidence snippet / content preview */}
      <p className="mt-2.5 text-xs leading-relaxed text-slate-500">
        {expanded ? source.content : renderHighlightedText(snippet, terms)}
        {!expanded && isLong && '…'}
      </p>

      {/* Expand toggle */}
      {isLong && (
        <button
          onClick={() => setExpanded((v) => !v)}
          className="mt-2 flex items-center gap-1 text-[11px] font-medium text-brand-500/70 hover:text-brand-400 transition-colors"
        >
          {expanded ? (
            <>
              <ChevronUp className="h-3 w-3" /> Show less
            </>
          ) : (
            <>
              <ChevronDown className="h-3 w-3" /> Show full note
            </>
          )}
        </button>
      )}
    </div>
  )
}

// ─── Empty / Placeholder State ────────────────────────────────────────────────

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-center">
      <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-surface-700 ring-1 ring-white/6">
        <Brain className="h-7 w-7 text-slate-600" />
      </div>
      <p className="text-sm font-medium text-slate-500">No response yet</p>
      <p className="mt-1.5 max-w-xs text-xs text-slate-600 leading-relaxed">
        Ask a question above and the AI will search your memories to generate
        a grounded answer.
      </p>

      {/* Hint pills */}
      <div className="mt-5 flex flex-wrap justify-center gap-2">
        {[
          'What did I note about…?',
          'Summarize my notes on…',
          'What do I know about…?',
        ].map((hint) => (
          <span
            key={hint}
            className="rounded-full border px-3 py-1 text-[11px] text-slate-600 italic"
            style={{ borderColor: 'rgba(255,255,255,0.06)' }}
          >
            "{hint}"
          </span>
        ))}
      </div>
    </div>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────

interface AIResponseProps {
  result:   QueryResult | null
  question: string
  onClear?: () => void
}

export default function AIResponse({ result, question, onClear }: AIResponseProps) {
  const [copied,           setCopied]           = useState(false)
  const [sourcesExpanded,  setSourcesExpanded]  = useState(true)

  if (!result) {
    return <EmptyState />
  }

  const { answer, sources } = result
  const hasNoSources = !sources || sources.length === 0
  const meta = result.meta

  // ── Copy answer to clipboard ──────────────────────────────────────────────
  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(answer)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // Clipboard API unavailable — silently fail
    }
  }

  return (
    <div className="flex flex-col gap-5 animate-slide-up">

      {/* ── Question echo ──────────────────────────────────────────────────── */}
      {question && (
        <div
          className="flex items-start gap-3 rounded-xl border px-4 py-3"
          style={{ borderColor: 'rgba(99,102,241,0.2)', background: 'rgba(99,102,241,0.06)' }}
        >
          <span className="mt-0.5 text-base flex-shrink-0">💬</span>
          <p className="text-sm text-slate-300 italic leading-relaxed">{question}</p>
        </div>
      )}

      {/* ── Answer block ──────────────────────────────────────────────────── */}
      <div className="relative rounded-xl border p-5" style={{ borderColor: 'rgba(255,255,255,0.08)', background: 'var(--surface-700)' }}>

        {/* Top bar */}
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="flex h-6 w-6 items-center justify-center rounded-md bg-brand-gradient">
              <Sparkles className="h-3.5 w-3.5 text-white" />
            </div>
            <span className="text-xs font-semibold uppercase tracking-widest text-slate-500">
              AI Answer
            </span>
            {meta?.modelUsed && (
              <span className="badge-slate text-[10px] px-1.5 py-0.5">{meta.modelUsed}</span>
            )}
          </div>
          <div className="flex items-center gap-2">
            {/* Grounded badge */}
            {!hasNoSources && (
              <div
                className="hidden sm:flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-medium ring-1"
                style={{
                  color: 'rgb(52,211,153)',
                  background: 'rgba(52,211,153,0.08)',
                  borderColor: 'rgba(52,211,153,0.25)',
                }}
              >
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                Grounded in your data
              </div>
            )}

            {/* Copy button */}
            <button
              onClick={handleCopy}
              className="btn btn-ghost btn-sm gap-1.5 text-slate-500 hover:text-slate-300"
              title="Copy answer"
            >
              {copied ? (
                <Check className="h-3.5 w-3.5 text-emerald-400" />
              ) : (
                <Copy className="h-3.5 w-3.5" />
              )}
              <span className="hidden sm:inline text-xs">
                {copied ? 'Copied' : 'Copy'}
              </span>
            </button>

            {/* Clear button */}
            {onClear && (
              <button
                onClick={onClear}
                className="btn btn-ghost btn-sm text-slate-600 hover:text-slate-300"
                title="Clear response"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* Rendered answer */}
        <div className="prose-answer text-[14.5px]">
          {renderMarkdown(answer)}
        </div>

        {/* No-sources warning */}
        {hasNoSources && (
          <div
            className="mt-4 flex items-start gap-2.5 rounded-lg px-3 py-2.5 text-xs"
            style={{
              background: 'rgba(245,158,11,0.08)',
              border: '1px solid rgba(245,158,11,0.2)',
            }}
          >
            <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0 text-amber-400" />
            <span className="text-amber-400/80 leading-relaxed">
              No relevant memories were found. Add more notes about this topic, or try rephrasing your question.
            </span>
          </div>
        )}
      </div>

      {/* ── Sources section ────────────────────────────────────────────────── */}
      {!hasNoSources && (
        <div>
          {/* Sources header */}
          <button
            onClick={() => setSourcesExpanded((v) => !v)}
            className="flex w-full items-center justify-between py-2 text-left group"
          >
            <div className="flex items-center gap-2">
              <FileText className="h-4 w-4 text-slate-500" />
              <span className="text-xs font-semibold uppercase tracking-widest text-slate-500 group-hover:text-slate-400 transition-colors">
                Source Notes
              </span>
              <span className="badge-brand text-[10px] px-1.5 py-0.5">
                {sources.length}
              </span>
            </div>
            <div className="flex items-center gap-1.5 text-xs text-slate-600 group-hover:text-slate-500 transition-colors">
              <Info className="h-3 w-3" />
              <span className="hidden sm:inline">Answer based on these notes</span>
              {sourcesExpanded ? (
                <ChevronUp className="h-3.5 w-3.5" />
              ) : (
                <ChevronDown className="h-3.5 w-3.5" />
              )}
            </div>
          </button>

          {/* Sources list */}
          {sourcesExpanded && (
            <div className="mt-2 flex flex-col gap-2">
              {sources.map((source, idx) => (
                <SourceCard key={source.id} source={source} index={idx} />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
