/**
 * components/append-log.tsx — Shared append-log composer
 *
 * Write, Submit (stamps now), List / Bulk / Latest, copy. Past entries are
 * read-only. Plan and Tracking day notes share this; other dated notes can too.
 * Plan may pass `initialDraft` / `onDraftChange` so unsubmitted plaintext
 * survives refresh; Tracking omits those. Optional `viewsWellClassName` (Tracking: `.hab-view-changer`). Compact size
 * is a short strip so the Tracking plot keeps height. History lives in
 * `.append-log-history` so List / Bulk / Latest scroll apart from the composer.
 * Optional `rootStamp` / `logStamp` / `bulkStamp` for Names (Plan uses them).
 */
"use client"

import type React from "react"
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react"
import {
  formatAppendLog,
  formatAppendStamp,
  formatAppendStampLine,
  getAppendLogViewMode,
  setAppendLogViewMode,
  sortAppendLogNewestFirst,
  type AppendLogEntry,
  type AppendLogViewMode,
} from "@/lib/append-log"

const VIEWS: { id: AppendLogViewMode; label: string }[] = [
  { id: "list", label: "List" },
  { id: "bulk", label: "Bulk" },
  { id: "latest", label: "Latest" },
]

export type UiNameStamp = {
  name: string
  help?: string
  docs?: string
  docsAnchor?: string
}

export interface AppendLogProps {
  /** Changes when the log being edited changes (period key, day, …). Reloads `initialDraft`. */
  logKey: string
  entries: AppendLogEntry[]
  onSubmit: (text: string, at: Date) => void
  /** Restored when `logKey` changes. Tracking omits this. */
  initialDraft?: string
  /** Persist unsubmitted composer text. Tracking omits this. */
  onDraftChange?: (text: string) => void
  placeholder: string
  submitLabel: string
  emptyHint: string
  size?: "day" | "period" | "compact"
  composerTestId?: string
  composerAriaLabel?: string
  bulkAriaLabel?: string
  viewsAriaLabel?: string
  /** Extra class on the List / Bulk / Latest well (Tracking uses `.hab-view-changer`). */
  viewsWellClassName?: string
  /** Optional Names overlay stamps. Plan passes these; Tracking day notes omit them. */
  rootStamp?: UiNameStamp
  logStamp?: UiNameStamp
  bulkStamp?: UiNameStamp
}

function uiNameAttrs(stamp?: UiNameStamp) {
  if (!stamp) return {}
  return {
    "data-ui-name": stamp.name,
    ...(stamp.help ? { "data-ui-help": stamp.help } : {}),
    ...(stamp.docs ? { "data-ui-docs": stamp.docs } : {}),
    ...(stamp.docsAnchor ? { "data-ui-docs-anchor": stamp.docsAnchor } : {}),
  }
}

export function AppendLog({
  logKey,
  entries,
  onSubmit,
  initialDraft = "",
  onDraftChange,
  placeholder,
  submitLabel,
  emptyHint,
  size = "period",
  composerTestId,
  composerAriaLabel = "New append-log entry",
  bulkAriaLabel = "All append-log entries, copy only",
  viewsAriaLabel = "How to show this append log",
  viewsWellClassName,
  rootStamp,
  logStamp,
  bulkStamp,
}: AppendLogProps) {
  const [draft, setDraft] = useState(initialDraft)
  const [now, setNow] = useState(() => new Date())
  const [mode, setMode] = useState<AppendLogViewMode>(() => getAppendLogViewMode())
  const [copied, setCopied] = useState(false)
  const composerRef = useRef<HTMLTextAreaElement>(null)
  const initialDraftRef = useRef(initialDraft)
  initialDraftRef.current = initialDraft

  useEffect(() => {
    setDraft(initialDraftRef.current)
    setMode(getAppendLogViewMode())
  }, [logKey])

  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 15_000)
    return () => window.clearInterval(id)
  }, [])

  useLayoutEffect(() => {
    const el = composerRef.current
    if (!el) return
    el.style.height = "auto"
    const min = size === "day" ? 160 : size === "compact" ? 40 : 104
    el.style.height = `${Math.max(el.scrollHeight, min)}px`
  }, [draft, size])

  const ordered = useMemo(() => sortAppendLogNewestFirst(entries), [entries])
  const visible = mode === "latest" ? ordered.slice(0, 1) : ordered
  const bulkText = useMemo(
    () => formatAppendLog(entries, mode === "latest" ? "latest" : "all", now),
    [entries, mode, now],
  )
  const stampPreview = formatAppendStamp(now.toISOString(), now)

  const submit = () => {
    if (!draft.trim()) return
    onSubmit(draft, new Date())
    setDraft("")
    onDraftChange?.("")
    setNow(new Date())
    composerRef.current?.focus()
  }

  const onComposerKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
      e.preventDefault()
      submit()
    }
  }

  const chooseView = (next: AppendLogViewMode) => {
    setAppendLogViewMode(next)
    setMode(next)
  }

  const copyLog = async () => {
    const text = formatAppendLog(entries, mode === "latest" ? "latest" : "all", now)
    if (!text) return
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1600)
    } catch {
      /* clipboard may be denied in tests */
    }
  }

  const composerClass =
    size === "day"
      ? "min-h-[10rem] overflow-hidden resize-y [field-sizing:content]"
      : "overflow-hidden resize-y [field-sizing:content]"

  return (
    <div className="append-log" {...uiNameAttrs(rootStamp)}>
      <div className="append-log-toolbar" role="toolbar" aria-label="Append log views">
        <div className={viewsWellClassName ? `append-log-views-well ${viewsWellClassName}` : "append-log-views-well"}>
          <div className="append-log-views" role="tablist" aria-label={viewsAriaLabel}>
            {VIEWS.map((view) => (
              <button
                key={view.id}
                type="button"
                role="tab"
                aria-selected={mode === view.id}
                aria-pressed={mode === view.id}
                data-state={mode === view.id ? "active" : undefined}
                onClick={() => chooseView(view.id)}
              >
                {view.label}
              </button>
            ))}
          </div>
        </div>
        <button type="button" className="append-log-copy" onClick={() => void copyLog()} disabled={entries.length === 0}>
          {copied ? "Copied" : "Copy"}
        </button>
      </div>

      <textarea
        ref={composerRef}
        placeholder={placeholder}
        value={draft}
        onChange={(e) => {
          const next = e.target.value
          setDraft(next)
          onDraftChange?.(next)
        }}
        onKeyDown={onComposerKeyDown}
        rows={size === "day" ? 12 : size === "compact" ? 2 : 6}
        className={composerClass}
        data-testid={composerTestId}
        aria-label={composerAriaLabel}
      />

      <div className="append-log-compose">
        <button type="button" className="append-log-submit" data-default="true" onClick={submit} disabled={!draft.trim()}>
          {submitLabel}
        </button>
        <p className="append-log-hint">
          Will stamp as <strong>{stampPreview}</strong> — ⌘/Ctrl+Enter
        </p>
      </div>

      <div className="append-log-history" {...uiNameAttrs(logStamp)}>
        {entries.length === 0 ? (
          <p className="append-log-hint">{emptyHint}</p>
        ) : mode === "bulk" ? (
          <textarea
            readOnly
            value={bulkText}
            rows={size === "compact" ? 8 : Math.min(18, Math.max(6, bulkText.split("\n").length + 1))}
            className="append-log-bulk"
            aria-label={bulkAriaLabel}
            {...uiNameAttrs(bulkStamp)}
          />
        ) : (
          <ol className="append-log-list">
            {visible.map((entry) => (
              <li key={entry.id} className="append-log-entry">
                <div className="append-log-stamp">{formatAppendStampLine(entry, now)}</div>
                <pre className="append-log-body">{entry.text}</pre>
              </li>
            ))}
          </ol>
        )}
      </div>
    </div>
  )
}
