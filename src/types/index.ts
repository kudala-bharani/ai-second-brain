// ─── Memory ──────────────────────────────────────────────────────────────────

export interface Memory {
  id: string
  user_id: string
  title: string | null
  content: string
  tags?: string[]
  created_at: string
}

// ─── Query / RAG ─────────────────────────────────────────────────────────────

export interface MemoryMatch extends Memory {
  similarity: number
  evidence_snippet?: string
  evidence_terms?: string[]
}

export type ChatMemoryMode = 'auto' | 'manual' | 'read-only'

export interface ChatReference {
  question: string
  sourceIds: string[]
  historyId?: string
}

export interface ChatMemoryChange {
  action: 'saved' | 'updated'
  id: string
  title: string | null
}

export interface QueryResult {
  answer: string
  sources: MemoryMatch[]
  meta?: QueryMeta
  changedMemories?: Memory[]
  historyId?: string
}

export interface QueryMeta {
  modelUsed?: string
  retrievalCount?: number
  strictness?: number
  maxSources?: number
  durationMs?: number
  memoryChanges?: ChatMemoryChange[]
  pendingContactUpdate?: { subject: string; memoryId: string; barePhone?: string }
}

export interface QueryControls {
  strictness?: number // 0..1
  maxSources?: number // 1..10
  modelOrder?: string[]
}

export interface QueryHistoryItem {
  id: string
  question: string
  result: QueryResult
  createdAt: string
  settingsSnapshot: QueryControls
}

// ─── API Responses ────────────────────────────────────────────────────────────

export interface ApiSuccess<T = unknown> {
  data: T
  error?: never
}

export interface ApiError {
  error: string
  data?: never
}

export type ApiResponse<T = unknown> = ApiSuccess<T> | ApiError

// ─── Form States ─────────────────────────────────────────────────────────────

export type FormStatus = 'idle' | 'loading' | 'success' | 'error'

export interface AddMemoryForm {
  title: string
  content: string
}

export interface QueryForm {
  question: string
}

// ─── Auth ────────────────────────────────────────────────────────────────────

export interface AuthForm {
  email: string
  password: string
}
