'use client'

import { useId, useState } from 'react'
import type { QueryResult, MemoryMatch } from '@/types'
import { Check, ChevronDown, ChevronUp, Copy, X } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import './response.css'

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
        <pre key={key()}>
          {lang && (
            <span className="answer-code-language">
              {lang}
            </span>
          )}
          <code>
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
        <h3 key={key()}>
          {inlineMarkdown(line.slice(4))}
        </h3>
      )
      i++
      continue
    }

    // Heading 2
    if (line.startsWith('## ')) {
      nodes.push(
        <h2 key={key()}>
          {inlineMarkdown(line.slice(3))}
        </h2>
      )
      i++
      continue
    }

    // Heading 1
    if (line.startsWith('# ')) {
      nodes.push(
        <h1 key={key()}>
          {inlineMarkdown(line.slice(2))}
        </h1>
      )
      i++
      continue
    }

    // Horizontal rule
    if (/^---+$/.test(line.trim())) {
      nodes.push(
        <hr key={key()} />
      )
      i++
      continue
    }

    // Blockquote
    if (line.startsWith('> ')) {
      nodes.push(
        <blockquote key={key()}>
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
        <ul key={key()}>
          {items.map((item, idx) => (
            <li key={idx}>
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
        <ol key={key()}>
          {items.map((item, idx) => (
            <li key={idx}>
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
      <p key={key()}>
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
        <strong key={match.index}>
          {match[2]}
        </strong>
      )
    } else if (match[3] !== undefined) {
      // *italic*
      parts.push(
        <em key={match.index}>
          {match[3]}
        </em>
      )
    } else if (match[4] !== undefined) {
      // `code`
      parts.push(
        <code key={match.index}>
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
          <mark key={idx}>
            {part}
          </mark>
        ) : (
          <span key={idx}>{part}</span>
        )
      )}
    </>
  )
}

function SourceNote({ source, index }: { source: MemoryMatch; index: number }) {
  const [expanded, setExpanded] = useState(false)
  const excerptId = useId()
  const preview = source.content.slice(0, 180)
  const snippet = source.evidence_snippet?.trim() || preview
  const terms = source.evidence_terms ?? []
  const isLong = source.content.length > 180
  const similarityPct = Math.round((source.similarity ?? 0) * 100)

  return (
    <li className="answer-source">
      <div className="answer-source-head">
        <h4>
          <span className="citation-index">[{index + 1}]</span>
          {source.title ?? 'Untitled note'}
        </h4>
        <span className="answer-meta">{similarityPct}% match</span>
      </div>
      <p className="answer-meta">
        {formatDistanceToNow(new Date(source.created_at), { addSuffix: true })}
      </p>
      <p id={excerptId} className="answer-source-excerpt">
        {expanded ? source.content : renderHighlightedText(snippet, terms)}
        {!expanded && isLong && '…'}
      </p>
      {isLong && (
        <button
          type="button"
          className="btn btn-ghost btn-sm answer-source-toggle"
          aria-controls={excerptId}
          aria-expanded={expanded}
          onClick={() => setExpanded((previous) => !previous)}
        >
          {expanded ? (
            <><ChevronUp size={16} aria-hidden="true" /> Show less</>
          ) : (
            <><ChevronDown size={16} aria-hidden="true" /> Show full note</>
          )}
        </button>
      )}
    </li>
  )
}

function EmptyState() {
  return (
    <div className="answer-reading answer-empty">
      <p>No response yet</p>
      <p>Ask a question above to see an answer and the notes it draws from.</p>
    </div>
  )
}

interface AIResponseProps {
  result: QueryResult | null
  question: string
  onClear?: () => void
}

export default function AIResponse({ result, question, onClear }: AIResponseProps) {
  const [copied, setCopied] = useState(false)
  const [sourcesExpanded, setSourcesExpanded] = useState(true)
  const answerHeadingId = useId()
  const sourcesId = useId()

  if (!result) {
    return <EmptyState />
  }

  const { answer, sources, meta } = result
  const hasNoSources = !sources || sources.length === 0

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(answer)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // The browser may deny clipboard access.
    }
  }

  return (
    <section className="answer-reading" aria-labelledby={answerHeadingId}>
      {question && (
        <dl className="answer-question">
          <dt>Your question</dt>
          <dd>{question}</dd>
        </dl>
      )}

      <header className="answer-header">
        <div>
          <h3 id={answerHeadingId}>Answer</h3>
          <div className="answer-metadata">
            {!hasNoSources && <span className="answer-grounded">Grounded in your notes</span>}
            {meta?.modelUsed && <span className="answer-meta">{meta.modelUsed}</span>}
          </div>
        </div>
        <div className="answer-actions">
          <button type="button" className="btn btn-secondary btn-sm" onClick={handleCopy}>
            {copied ? <Check size={16} aria-hidden="true" /> : <Copy size={16} aria-hidden="true" />}
            {copied ? 'Copied' : 'Copy answer'}
          </button>
          <span className="sr-only" role="status">{copied ? 'Answer copied' : ''}</span>
          {onClear && (
            <button
              type="button"
              className="icon-button"
              onClick={onClear}
              aria-label="Clear response"
              title="Clear response"
            >
              <X size={16} aria-hidden="true" />
            </button>
          )}
        </div>
      </header>

      <div className="answer-markdown">{renderMarkdown(answer)}</div>

      {hasNoSources && (
        <p className="notice notice-warning answer-no-sources">
          No relevant memories were found. Add more notes about this topic, or try rephrasing your question.
        </p>
      )}

      {!hasNoSources && (
        <div className="answer-sources">
          <h3>
            <button
              type="button"
              className="answer-sources-toggle"
              aria-controls={sourcesId}
              aria-expanded={sourcesExpanded}
              onClick={() => setSourcesExpanded((previous) => !previous)}
            >
              <span>Source notes <span className="answer-meta">({sources.length})</span></span>
              {sourcesExpanded ? <ChevronUp size={18} aria-hidden="true" /> : <ChevronDown size={18} aria-hidden="true" />}
            </button>
          </h3>
          <ol className="answer-source-list" id={sourcesId} hidden={!sourcesExpanded} role="list">
            {sourcesExpanded && sources.map((source, index) => (
              <SourceNote key={source.id} source={source} index={index} />
            ))}
          </ol>
        </div>
      )}
    </section>
  )
}
