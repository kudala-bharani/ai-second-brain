'use client'

import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react'
import type { QueryResult, MemoryMatch } from '@/types'
import { ArrowUpRight, BookOpenText, Check, ChevronDown, Copy } from 'lucide-react'
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

function SourceExcerpt({ source }: { source: MemoryMatch }) {
  const content = source.content.trim()
  const snippet = source.evidence_snippet?.trim() || content.slice(0, 180)
  const start = content.indexOf(snippet)

  return (
    <blockquote className="answer-source-excerpt">
      {start > 0 && '…'}
      {renderHighlightedText(snippet, source.evidence_terms ?? [])}
      {start >= 0 && start + snippet.length < content.length && '…'}
    </blockquote>
  )
}

interface AIResponseProps {
  result: QueryResult
  onOpenMemory: (id: string) => void
  availableMemoryIds: ReadonlySet<string>
}

export default function AIResponse({ result, onOpenMemory, availableMemoryIds }: AIResponseProps) {
  const [copyStatus, setCopyStatus] = useState('')
  const [selectedSourceId, setSelectedSourceId] = useState<string | null>(null)
  const answerHeadingId = useId()
  const sourcePreviewId = useId()
  const sourcePreviewRef = useRef<HTMLDivElement>(null)
  const { answer, sources } = result
  const selectedSource = sources.find((source) => source.id === selectedSourceId)
  const copied = copyStatus === 'Answer copied'

  useLayoutEffect(() => {
    if (selectedSourceId) {
      sourcePreviewRef.current?.scrollIntoView({ block: 'nearest', behavior: 'instant' })
    }
  }, [selectedSourceId])

  useEffect(() => {
    if (!copyStatus) return
    const timer = window.setTimeout(() => setCopyStatus(''), 2000)
    return () => window.clearTimeout(timer)
  }, [copyStatus])

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(answer)
      setCopyStatus('Answer copied')
    } catch {
      setCopyStatus('Could not copy answer')
    }
  }

  return (
    <section className="answer-reading" aria-labelledby={answerHeadingId}>
      <header className="answer-header">
        <div className="answer-identity">
          <span className="answer-notebook-mark" aria-hidden="true"><BookOpenText size={16} strokeWidth={1.65} /></span>
          <h3 id={answerHeadingId}>Answer</h3>
        </div>
        <button type="button" className="btn-ghost btn-sm answer-copy" onClick={handleCopy}>
          {copied ? <Check size={15} aria-hidden="true" /> : <Copy size={15} aria-hidden="true" />}
          {copied ? 'Copied' : 'Copy answer'}
        </button>
        <span className="sr-only" role="status">{copyStatus}</span>
      </header>

      <div className="answer-markdown">{renderMarkdown(answer)}</div>

      {sources.length > 0 && (
        <div className="answer-sources">
          <p className="answer-sources-label">Sources</p>
          <ul className="answer-citations" aria-label="Source notes" role="list">
            {sources.map((source, index) => {
              const title = source.title || 'Untitled note'
              return (
                <li key={source.id}>
                  <button
                    type="button"
                    className="answer-citation"
                    aria-label={`Source ${index + 1}: ${title}`}
                    aria-controls={sourcePreviewId}
                    aria-expanded={selectedSourceId === source.id}
                    onClick={() => setSelectedSourceId((id) => id === source.id ? null : source.id)}
                  >
                    <span className="citation-index" aria-hidden="true">{index + 1}</span>
                    <span className="answer-citation-title">{title}</span>
                    <ChevronDown size={14} aria-hidden="true" />
                  </button>
                </li>
              )
            })}
          </ul>
          <div id={sourcePreviewId} ref={sourcePreviewRef} className="answer-source-preview" hidden={!selectedSource}>
            {selectedSource && (
              <>
                <SourceExcerpt source={selectedSource} />
                {availableMemoryIds.has(selectedSource.id) ? (
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm answer-source-open"
                    onClick={() => onOpenMemory(selectedSource.id)}
                  >
                    Open memory <ArrowUpRight size={15} aria-hidden="true" />
                  </button>
                ) : (
                  <p className="field-detail answer-source-unavailable">Original memory unavailable</p>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </section>
  )
}
