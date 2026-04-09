// ─── Memory ──────────────────────────────────────────────────────────────────

export interface Memory {
  id: string
  user_id: string
  title: string | null
  content: string
  created_at: string
}

// ─── Query / RAG ─────────────────────────────────────────────────────────────

export interface MemoryMatch extends Memory {
  similarity: number
}

export interface QueryResult {
  answer: string
  sources: MemoryMatch[]
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
