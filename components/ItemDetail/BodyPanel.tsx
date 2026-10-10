/**
 * components/ItemDetail/BodyPanel.tsx — "Body" detail panel (document items)
 *
 * The `"body"` item-detail panel (Feature 4, Worker D). Renders the
 * `RichTextEditor` over an item's `Item.body` markdown and persists edits back to
 * the task store via `updateTask`. Used for the built-in `note` type and any list
 * whose `detailPanels` include `"body"` (wired by the integration pass).
 *
 * Reads the live task reactively from `useTaskStore`; writes are debounced so
 * typing doesn't thrash the persisted store, with a flush on blur and unmount.
 *
 * Spec: §5.5 (Item detail view) — docs/SPEC_MAPPING.md §5.
 */
"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { useTaskStore } from "@/lib/task-store"
import { RichTextEditor } from "@/components/Editor/RichTextEditor"
import { htmlToPlainText } from "@/lib/doc-html"

interface BodyPanelProps {
  /** Id of the task/item whose `body` is edited. */
  taskId: string
  readOnly?: boolean
  /** Debounce (ms) before persisting keystrokes. Defaults to 500ms. */
  debounceMs?: number
}

/** Edits an item's markdown `body`, persisting through `updateTask`. */
export function BodyPanel({ taskId, readOnly = false, debounceMs = 500 }: BodyPanelProps) {
  const task = useTaskStore((s) => s.tasks.find((t) => t.id === taskId))
  const updateTask = useTaskStore((s) => s.updateTask)

  // Local draft so typing is responsive; synced from the store when the
  // underlying item (or its body) changes from elsewhere.
  const [draft, setDraft] = useState(task?.body ?? "")
  const [showSource, setShowSource] = useState(false)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const pending = useRef<string | null>(null)

  useEffect(() => {
    // Only adopt the store value when we have no un-flushed local edit.
    if (pending.current === null) setDraft(task?.body ?? "")
  }, [task?.body])

  const flush = useCallback(() => {
    if (timer.current) {
      clearTimeout(timer.current)
      timer.current = null
    }
    if (pending.current === null) return
    const latest = useTaskStore.getState().tasks.find((t) => t.id === taskId)
    if (latest && latest.body !== pending.current) {
      updateTask({ ...latest, body: pending.current })
    }
    pending.current = null
  }, [taskId, updateTask])

  const handleChange = useCallback(
    (markdown: string) => {
      setDraft(markdown)
      pending.current = markdown
      if (timer.current) clearTimeout(timer.current)
      timer.current = setTimeout(flush, debounceMs)
    },
    [flush, debounceMs],
  )

  // Flush any pending edit on unmount.
  useEffect(() => () => flush(), [flush])

  if (!task) {
    return <p className="text-sm text-muted-foreground italic">Item not found.</p>
  }

  const looksLikeHtml = /<\/?[a-z][\s\S]*>/i.test(draft)
  const prose = looksLikeHtml ? htmlToPlainText(draft) : draft

  return (
    <div className="space-y-2 id-body-panel">
      <div className="id-body-mode">
        <button
          type="button"
          className="id-btn id-btn-sm"
          aria-pressed={showSource}
          onClick={() => setShowSource((on) => !on)}
        >
          {showSource ? "Rendered" : "Source"}
        </button>
      </div>
      {showSource ? (
        <textarea
          className="id-body-source"
          value={draft}
          readOnly={readOnly}
          onChange={(e) => handleChange(e.target.value)}
          onBlur={flush}
          rows={12}
          spellCheck={false}
          aria-label="Body source"
        />
      ) : readOnly || looksLikeHtml ? (
        <div className="id-body-prose" data-testid="body-prose">
          {prose.trim() ? prose : <span className="text-muted-foreground italic">No body yet.</span>}
        </div>
      ) : (
        <RichTextEditor
          value={draft}
          onChange={handleChange}
          onBlur={flush}
          readOnly={readOnly}
          placeholder="Write your note in markdown…"
        />
      )}
    </div>
  )
}
