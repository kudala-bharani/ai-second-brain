"use client";

import { useState, useRef, type FormEvent } from "react";
import {
  Loader2,
  CheckCircle2,
  AlertCircle,
  X,
} from "lucide-react";
import type { Memory, FormStatus } from "@/types";

interface AddMemoryProps {
  onMemoryAdded: (memory: Memory) => void;
}

const MAX_CONTENT_LENGTH = 10_000;
const MAX_TITLE_LENGTH = 120;

export default function AddMemory({ onMemoryAdded }: AddMemoryProps) {
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [tagsInput, setTagsInput] = useState("");
  const [status, setStatus] = useState<FormStatus>("idle");
  const [error, setError] = useState<string | null>(null);

  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const charCount = content.length;
  const isNearLimit = charCount > MAX_CONTENT_LENGTH * 0.85;
  const isOverLimit = charCount > MAX_CONTENT_LENGTH;
  const canSubmit =
    content.trim().length > 0 && !isOverLimit && status !== "loading";

  // ── Auto-resize textarea ─────────────────────────────────────────────────────
  function autoResize() {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 400)}px`;
  }

  // ── Submit ────────────────────────────────────────────────────────────────────
  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;

    setStatus("loading");
    setError(null);

    try {
      const response = await fetch("/api/memories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim() || undefined,
          content: content.trim(),
          tags: tagsInput
            .split(",")
            .map((t) => t.trim().toLowerCase())
            .filter(Boolean),
        }),
      });

      const json = await response.json();

      if (!response.ok || json.error) {
        throw new Error(
          json.error ?? `Request failed with status ${response.status}`,
        );
      }

      // Success
      onMemoryAdded(json.data as Memory);
      setTitle("");
      setContent("");
      setTagsInput("");
      setStatus("success");

      // Reset textarea height
      if (textareaRef.current) {
        textareaRef.current.style.height = "auto";
      }

      // Reset status after 3 s
      setTimeout(() => setStatus("idle"), 3000);
    } catch (err) {
      const message =
        err instanceof Error
          ? err.message
          : "Something went wrong. Please try again.";
      setError(message);
      setStatus("error");
    }
  }

  // ── Clear form ────────────────────────────────────────────────────────────────
  function handleClear() {
    setTitle("");
    setContent("");
    setTagsInput("");
    setError(null);
    setStatus("idle");
    if (textareaRef.current) textareaRef.current.style.height = "auto";
  }

  // ─────────────────────────────────────────────────────────────────────────────

  return (
    <form onSubmit={handleSubmit} className="memory-form" noValidate>
      {status === "success" && (
        <div className="notice-success" role="status">
          <CheckCircle2 size={17} aria-hidden="true" />
          <span>Memory saved</span>
          <button type="button" onClick={() => setStatus("idle")} className="notice-dismiss" aria-label="Dismiss">
            <X size={16} aria-hidden="true" />
          </button>
        </div>
      )}

      {status === "error" && error && (
        <div className="notice-error" role="alert">
          <AlertCircle size={17} aria-hidden="true" />
          <span>{error}</span>
          <button
            type="button"
            onClick={() => {
              setError(null);
              setStatus("idle");
            }}
            className="notice-dismiss"
            aria-label="Dismiss error"
          >
            <X size={16} aria-hidden="true" />
          </button>
        </div>
      )}

      <div>
        <label htmlFor="memory-title" className="label">
          Title <span className="field-detail">(optional)</span>
        </label>
        <input
          id="memory-title"
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          maxLength={MAX_TITLE_LENGTH}
          placeholder="e.g. Book notes"
          className="input"
          disabled={status === "loading"}
          autoComplete="off"
          spellCheck
        />
        {title.length > MAX_TITLE_LENGTH * 0.85 && (
          <p className="field-detail text-right mt-1">{title.length} / {MAX_TITLE_LENGTH}</p>
        )}
      </div>

      <div>
        <div className="field-with-count">
          <label htmlFor="memory-content" className="label">Content</label>
          {charCount > 0 && (
            <span className="field-detail" data-limit={isOverLimit ? "over" : isNearLimit ? "near" : undefined}>
              {charCount.toLocaleString()} / {MAX_CONTENT_LENGTH.toLocaleString()}
            </span>
          )}
        </div>
        <div className="memory-content-field">
          <textarea
            ref={textareaRef}
            id="memory-content"
            value={content}
            onChange={(e) => {
              setContent(e.target.value);
              autoResize();
            }}
            placeholder="Paste or write a note"
            className="input textarea"
            disabled={status === "loading"}
            aria-invalid={isOverLimit || undefined}
            aria-describedby={isOverLimit ? "memory-content-limit" : undefined}
            required
            spellCheck
          />
          {content.length > 0 && status !== "loading" && (
            <button
              type="button"
              onClick={() => {
                setContent("");
                if (textareaRef.current) textareaRef.current.style.height = "auto";
              }}
              className="icon-button clear-content"
              aria-label="Clear content"
            >
              <X size={16} aria-hidden="true" />
            </button>
          )}
        </div>
        {isOverLimit && (
          <p id="memory-content-limit" className="field-detail mt-1" data-limit="over">
            Content exceeds the {MAX_CONTENT_LENGTH.toLocaleString()}-character limit.
          </p>
        )}
      </div>

      <div>
        <label htmlFor="memory-tags" className="label">
          Tags <span className="field-detail">(optional)</span>
        </label>
        <input
          id="memory-tags"
          type="text"
          value={tagsInput}
          onChange={(e) => setTagsInput(e.target.value)}
          placeholder="work, ideas, research"
          className="input"
          aria-describedby="memory-tags-hint"
          disabled={status === "loading"}
        />
        <p id="memory-tags-hint" className="field-detail mt-1">Separate tags with commas.</p>
      </div>

      <div className="form-actions">
        <button type="submit" disabled={!canSubmit} className="btn-primary">
          {status === "loading" && <Loader2 size={17} className="status-spinner" aria-hidden="true" />}
          {status === "loading" ? "Saving memory…" : "Save memory"}
        </button>
        {(title.length > 0 || content.length > 0 || tagsInput.length > 0) && status !== "loading" && (
          <button type="button" onClick={handleClear} className="btn-ghost" aria-label="Clear form">
            Clear
          </button>
        )}
      </div>
      {status === "loading" && <p className="sr-only" role="status">Saving memory</p>}
    </form>
  );
}
