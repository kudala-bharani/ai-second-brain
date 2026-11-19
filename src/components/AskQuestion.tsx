'use client'

import { useEffect, useLayoutEffect, useRef, useState, type FormEvent, type KeyboardEvent } from 'react'
import { ArrowLeft, ArrowRight, ArrowUp, ArrowUpRight, Check, History, Loader2, MessageSquare, Plus, RotateCcw } from 'lucide-react'
import TextareaAutosize from 'react-textarea-autosize'
import type { ApiResponse, ChatMemoryMode, ChatReference, Memory, QueryHistoryItem, QueryResult } from '@/types'
import AIResponse from '@/components/AIResponse'

interface AskQuestionProps {
  userId?: string
  availableMemoryIds: ReadonlySet<string>
  loadingMemories: boolean
  history: QueryHistoryItem[] | null
  historyError: boolean
  onRefreshHistory: () => void
  onOpenMemory: (id: string) => void
  onMemoriesChanged: (memories: Memory[]) => void
}

interface ChatRequest {
  question: string
  memoryMode: ChatMemoryMode
  reference?: ChatReference
}

type ChatTurn = { id: string; request: ChatRequest } & (
  | { status: 'pending' }
  | { status: 'answered'; result: QueryResult }
  | { status: 'failed'; error: string }
)

type View =
  | { mode: 'chat' }
  | { mode: 'history' }
  | { mode: 'saved'; item: QueryHistoryItem }

const EXAMPLE_QUESTIONS = [
  'What did I learn recently?',
  'What goals have I written about?',
]
const FIRST_MEMORY_EXAMPLE = 'Remember that I prefer morning meetings.'
const MAX_REFERENCE_SOURCES = 5

const HISTORY_DATE = new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric' })

function getPreviousReference(turns: ChatTurn[], availableMemoryIds: ReadonlySet<string>): ChatReference | undefined {
  for (let index = turns.length - 1; index >= 0; index--) {
    const turn = turns[index]
    if (turn.status !== 'answered') continue
    const ids = new Set([
      ...(turn.result.meta?.memoryChanges ?? []).map((change) => change.id),
      ...turn.result.sources.map((source) => source.id),
    ])
    return {
      question: turn.request.question,
      sourceIds: Array.from(ids).filter((id) => availableMemoryIds.has(id)).slice(0, MAX_REFERENCE_SOURCES),
    }
  }
}

function ChatAnswer({
  result,
  availableMemoryIds,
  onOpenMemory,
}: Pick<AskQuestionProps, 'availableMemoryIds' | 'onOpenMemory'> & { result: QueryResult }) {
  const changes = result.meta?.memoryChanges
  return (
    <>
      {!!changes?.length && (
        <ul className="chat-memory-changes" aria-label="Memory changes" role="list">
          {changes.map((change) => (
            <li key={change.id} className="chat-memory-change">
              <Check size={16} aria-hidden="true" />
              <p>
                <strong>{change.action === 'updated' ? 'Memory updated' : 'Memory saved'}</strong>
                <span>{change.title || 'Untitled memory'}</span>
              </p>
              {availableMemoryIds.has(change.id) && (
                <button type="button" className="text-control" onClick={() => onOpenMemory(change.id)}>
                  Open memory <ArrowUpRight size={15} aria-hidden="true" />
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
      <AIResponse result={result} availableMemoryIds={availableMemoryIds} onOpenMemory={onOpenMemory} />
    </>
  )
}

export default function AskQuestion({
  userId,
  availableMemoryIds,
  loadingMemories,
  history,
  historyError,
  onRefreshHistory,
  onOpenMemory,
  onMemoriesChanged,
}: AskQuestionProps) {
  const preferenceKey = userId ? `ai-second-brain:chat:auto-save-facts:v1:${userId}` : null
  const [autoSaveFacts, setAutoSaveFacts] = useState(() => {
    if (!preferenceKey || typeof window === 'undefined') return true
    try {
      return window.localStorage.getItem(preferenceKey) !== 'off'
    } catch {
      return true
    }
  })
  const [question, setQuestion] = useState('')
  const [turns, setTurns] = useState<ChatTurn[]>([])
  const [view, setView] = useState<View>({ mode: 'chat' })
  const [announcement, setAnnouncement] = useState('')
  const requestRef = useRef<AbortController | null>(null)
  const composerRef = useRef<HTMLTextAreaElement>(null)
  const conversationRef = useRef<HTMLDivElement>(null)
  const chatHeadingRef = useRef<HTMLHeadingElement>(null)
  const historyHeadingRef = useRef<HTMLHeadingElement>(null)
  const shouldMoveFocus = useRef(false)
  const followConversation = useRef(true)

  const hasMemories = availableMemoryIds.size > 0
  const pending = turns.some((turn) => turn.status === 'pending')
  const chatReady = !!userId && !loadingMemories
  const canAsk = chatReady && !pending

  useEffect(() => () => requestRef.current?.abort(), [])

  useLayoutEffect(() => {
    if (!shouldMoveFocus.current) return
    shouldMoveFocus.current = false
    const heading = view.mode === 'chat' ? chatHeadingRef.current : historyHeadingRef.current
    heading?.focus({ preventScroll: true })
  }, [view])

  useLayoutEffect(() => {
    const conversation = conversationRef.current
    const latestTurn = conversation?.querySelector('.chat-turn:last-child')
    if (view.mode !== 'chat' || !conversation || !latestTurn || !followConversation.current) return

    const lastTurn = turns[turns.length - 1]
    const isMemoryAcknowledgement = lastTurn?.status === 'answered' && lastTurn.result.sources.length === 0
    const latestContent = isMemoryAcknowledgement
      ? latestTurn.querySelector('.chat-memory-changes') ?? latestTurn
      : latestTurn
    const turnStart = latestContent.getBoundingClientRect().top
      - conversation.getBoundingClientRect().top + conversation.scrollTop - 16
    conversation.scrollTop = Math.min(conversation.scrollHeight - conversation.clientHeight, turnStart)
  }, [turns, view.mode])

  function showView(nextView: View) {
    shouldMoveFocus.current = true
    setView(nextView)
  }

  function updateTurn(next: ChatTurn) {
    setTurns((previous) => previous.map((turn) => turn.id === next.id ? next : turn))
  }

  async function ask(submission: ChatRequest, retryId?: string) {
    if (submission.question.length < 3 || !chatReady || requestRef.current) return

    const request = new AbortController()
    requestRef.current = request
    const turn = { id: retryId ?? crypto.randomUUID(), request: submission }
    const pendingTurn = { ...turn, status: 'pending' } as const

    setAnnouncement('')
    if (retryId) {
      updateTurn(pendingTurn)
    } else {
      followConversation.current = true
      setTurns((previous) => [...previous, pendingTurn])
    }

    try {
      const response = await fetch('/api/query', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(submission),
        signal: request.signal,
      })
      const payload: ApiResponse<QueryResult> | null = await response.json().catch(() => null)
      if (request.signal.aborted) return
      if (!response.ok || !payload?.data) {
        updateTurn({
          ...turn,
          status: 'failed',
          error: payload?.error ?? 'Your question couldn’t be answered. Please try again.',
        })
        return
      }
      const result = payload.data
      updateTurn({ ...turn, status: 'answered', result })
      if (result.changedMemories?.length) onMemoriesChanged(result.changedMemories)
      const changes = result.meta?.memoryChanges ?? []
      setAnnouncement(changes.length === 1
        ? (changes[0].action === 'updated' ? 'Memory updated.' : 'Memory saved.')
        : changes.length ? `${changes.length} memory changes applied.` : 'Answer ready.')
      onRefreshHistory()
    } catch {
      if (!request.signal.aborted) {
        updateTurn({ ...turn, status: 'failed', error: 'Connection interrupted. Please try again.' })
      }
    } finally {
      requestRef.current = null
    }
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const submittedQuestion = question.trim()
    if (submittedQuestion.length < 3 || !canAsk || requestRef.current) return
    void ask({
      question: submittedQuestion,
      memoryMode: autoSaveFacts ? 'auto' : 'manual',
      reference: getPreviousReference(turns, availableMemoryIds),
    })
    setQuestion('')
  }

  function changeAutoSaveFacts(enabled: boolean) {
    setAutoSaveFacts(enabled)
    if (!preferenceKey) return
    try {
      window.localStorage.setItem(preferenceKey, enabled ? 'on' : 'off')
    } catch {
      // The control still applies to this chat if browser storage is unavailable.
    }
  }

  function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key !== 'Enter' || event.shiftKey) return
    // Some Safari versions emit the confirming Enter after compositionend.
    if (event.nativeEvent.isComposing || event.nativeEvent.keyCode === 229) return
    event.preventDefault()
    event.currentTarget.form?.requestSubmit()
  }

  function startNewChat() {
    if (requestRef.current) return
    setTurns([])
    setQuestion('')
    setAnnouncement('')
    followConversation.current = true
    chatHeadingRef.current?.focus({ preventScroll: true })
  }

  return (
    <section id="ai-response-section" className="workspace-sheet query-sheet" aria-labelledby="query-heading" tabIndex={-1}>
      <div className="workspace-section-heading chat-heading">
        <div className="chat-heading-title">
          <MessageSquare size={17} aria-hidden="true" />
          <div>
            <h2 id="query-heading" ref={chatHeadingRef} tabIndex={-1}>Ask your notebook</h2>
            <p>Ask a question or share a fact.</p>
          </div>
        </div>
        <div className="chat-toolbar">
          {view.mode === 'chat' && turns.length > 0 && (
            <button className="btn-ghost chat-tool" type="button" onClick={startNewChat} disabled={pending}>
              <Plus size={15} aria-hidden="true" /> New chat
            </button>
          )}
          {view.mode === 'chat' ? (
            <button className="btn-secondary chat-tool" type="button" onClick={() => showView({ mode: 'history' })}>
              <History size={16} aria-hidden="true" /> History
            </button>
          ) : (
            <button className="btn-secondary chat-tool" type="button" onClick={() => showView({ mode: 'chat' })}>
              <MessageSquare size={15} aria-hidden="true" /> Back to chat
            </button>
          )}
        </div>
      </div>

      <div
        className="chat-scroll"
        ref={conversationRef}
        role="region"
        aria-label="Conversation"
        tabIndex={0}
        hidden={view.mode !== 'chat'}
        onScroll={(event) => {
          const { scrollHeight, scrollTop, clientHeight } = event.currentTarget
          followConversation.current = scrollHeight - scrollTop - clientHeight < 48
        }}
      >
        {turns.length === 0 ? (
          <div className="chat-empty">
            {!chatReady ? (
              <p className="field-detail">Loading your notes…</p>
            ) : hasMemories ? (
              <>
                <h3>Start with a question</h3>
                <ul className="chat-starters" aria-label="Suggested questions">
                  {EXAMPLE_QUESTIONS.map((example) => (
                    <li key={example}>
                      <button type="button" onClick={() => {
                        setQuestion(example)
                        composerRef.current?.focus()
                      }}>
                        {example} <ArrowRight size={15} aria-hidden="true" />
                      </button>
                    </li>
                  ))}
                </ul>
              </>
            ) : (
              <>
                <h3>Start with something to remember</h3>
                <p>Share a detail in chat or <a href="#capture-section" className="chat-capture-link">add a memory</a>.</p>
                <ul className="chat-starters" aria-label="Suggested message">
                  <li>
                    <button type="button" onClick={() => {
                      setQuestion(FIRST_MEMORY_EXAMPLE)
                      composerRef.current?.focus()
                    }}>
                      {FIRST_MEMORY_EXAMPLE} <ArrowRight size={15} aria-hidden="true" />
                    </button>
                  </li>
                </ul>
              </>
            )}
          </div>
        ) : (
          <ol className="chat-turns" role="list">
            {turns.map((turn) => (
              <li className="chat-turn" key={turn.id}>
                <div className="chat-question" tabIndex={-1}>
                  <span>You</span>
                  <p>{turn.request.question}</p>
                </div>
                {turn.status === 'pending' && (
                  <div className="chat-turn-status" role="status">
                    <Loader2 size={16} className="status-spinner" aria-hidden="true" />
                    Working on your message…
                  </div>
                )}
                {turn.status === 'failed' && (
                  <div className="chat-turn-error">
                    <p role="alert">{turn.error}</p>
                    <button type="button" className="btn-secondary chat-tool" disabled={!canAsk}
                      onClick={(event) => {
                        event.currentTarget.closest('.chat-turn')
                          ?.querySelector<HTMLElement>('.chat-question')?.focus({ preventScroll: true })
                        void ask(turn.request, turn.id)
                      }}>
                      <RotateCcw size={15} aria-hidden="true" /> Retry
                    </button>
                  </div>
                )}
                {turn.status === 'answered' && (
                  <ChatAnswer result={turn.result} availableMemoryIds={availableMemoryIds} onOpenMemory={onOpenMemory} />
                )}
              </li>
            ))}
          </ol>
        )}
      </div>

      {view.mode === 'chat' ? (
        <form className="chat-composer" onSubmit={handleSubmit}>
          <label htmlFor="notebook-question" className="sr-only">Your message</label>
          <div className="chat-compose-row">
            <TextareaAutosize
              ref={composerRef}
              id="notebook-question"
              value={question}
              onChange={(event) => setQuestion(event.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask or share a detail…"
              disabled={!chatReady}
              maxLength={2000}
              minRows={1}
              maxRows={4}
              className="input chat-input"
            />
            <button type="submit" className="btn-primary chat-send" disabled={!canAsk || question.trim().length < 3}>
              <span>Send</span><ArrowUp size={17} aria-hidden="true" />
            </button>
          </div>
          <div className="chat-composer-footer">
            <label className="chat-auto-save">
              <input type="checkbox" checked={autoSaveFacts} disabled={!chatReady} onChange={(event) => changeAutoSaveFacts(event.target.checked)} />
              Auto-save facts
            </label>
            <p className="field-detail chat-keyboard-hint">
              <kbd>Enter</kbd> to send <span aria-hidden="true">·</span> <kbd>Shift</kbd> + <kbd>Enter</kbd> for a new line
            </p>
          </div>
        </form>
      ) : (
        <div className="chat-scroll chat-history-view" key={view.mode}>
          {view.mode === 'history' ? (
            <>
              <h3 ref={historyHeadingRef} tabIndex={-1}>Saved answers</h3>
              {history && history.length > 0 ? (
                <ul className="history-list">
                  {history.map((item) => (
                    <li key={item.id}>
                      <button type="button" onClick={() => showView({ mode: 'saved', item })}>
                        <span className="history-question">{item.question}</span>
                        <time dateTime={item.createdAt}>{HISTORY_DATE.format(new Date(item.createdAt))}</time>
                        <ArrowRight size={15} aria-hidden="true" />
                      </button>
                    </li>
                  ))}
                </ul>
              ) : historyError ? (
                <div className="chat-history-empty">
                  <p>Saved answers couldn’t be loaded.</p>
                  <button type="button" className="btn-secondary chat-tool" onClick={onRefreshHistory}>Try again</button>
                </div>
              ) : (
                <p className="chat-history-empty" role="status">
                  {history ? 'Saved answers will appear here.' : 'Loading saved answers…'}
                </p>
              )}
            </>
          ) : (
            <>
              <div className="chat-saved-toolbar">
                <button type="button" className="btn-ghost chat-tool" onClick={() => showView({ mode: 'history' })}>
                  <ArrowLeft size={15} aria-hidden="true" /> Back to history
                </button>
                <button type="button" className="btn-secondary chat-tool" disabled={!canAsk} onClick={() => {
                  showView({ mode: 'chat' })
                  void ask({ question: view.item.question, memoryMode: 'read-only' })
                }}>
                  <RotateCcw size={15} aria-hidden="true" /> Ask again
                </button>
              </div>
              <h3 ref={historyHeadingRef} tabIndex={-1} className="chat-saved-question">{view.item.question}</h3>
              <ChatAnswer key={view.item.id} result={view.item.result} availableMemoryIds={availableMemoryIds} onOpenMemory={onOpenMemory} />
            </>
          )}
        </div>
      )}
      <p className="sr-only" role="status">{announcement}</p>
    </section>
  )
}
