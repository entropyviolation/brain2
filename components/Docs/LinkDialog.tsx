/**
 * components/Docs/LinkDialog.tsx — Google Docs–style insert/edit link dialog
 *
 * Text (optional) + Link URL fields. Empty text uses the URL as the label.
 * Win95-skinned to match the Docs chrome.
 */
"use client"

import { useEffect, useId, useRef, useState } from "react"
import { isPlainUrl, isSafeDocHref, normalizeHref } from "@/lib/doc-links"

export interface LinkDialogValues {
  text: string
  url: string
}

interface LinkDialogProps {
  open: boolean
  /** Prefill when opening (selection text / existing href). */
  initial: LinkDialogValues
  /** True when editing an existing anchor (shows Remove). */
  editing?: boolean
  onApply: (values: { text: string; href: string }) => void
  onRemove?: () => void
  onClose: () => void
}

export function LinkDialog({ open, initial, editing, onApply, onRemove, onClose }: LinkDialogProps) {
  const titleId = useId()
  const urlRef = useRef<HTMLInputElement>(null)
  const textRef = useRef<HTMLInputElement>(null)
  const [text, setText] = useState(initial.text)
  const [url, setUrl] = useState(initial.url)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    setText(initial.text)
    setUrl(initial.url)
    setError(null)
    // Prefer focusing URL when text already filled; otherwise text first.
    requestAnimationFrame(() => {
      if (initial.text.trim()) urlRef.current?.focus()
      else textRef.current?.focus()
      urlRef.current?.select()
    })
  }, [open, initial.text, initial.url])

  if (!open) return null

  const submit = () => {
    const rawUrl = url.trim()
    if (!rawUrl) {
      setError("Enter a link (URL or email).")
      urlRef.current?.focus()
      return
    }
    // Allow typing email without mailto:
    const withScheme =
      /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(rawUrl) && !/^mailto:/i.test(rawUrl)
        ? `mailto:${rawUrl}`
        : normalizeHref(rawUrl)
    if (!isSafeDocHref(withScheme) && !isPlainUrl(rawUrl)) {
      setError("That doesn’t look like a safe link.")
      return
    }
    const href = isSafeDocHref(withScheme) ? withScheme : normalizeHref(rawUrl)
    if (!isSafeDocHref(href)) {
      setError("That doesn’t look like a safe link.")
      return
    }
    const label = text.trim() || rawUrl.replace(/^mailto:/i, "")
    onApply({ text: label, href })
  }

  return (
    <div className="docs-link-overlay" role="presentation" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div
        className="docs-link-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onKeyDown={(e) => {
          if (e.key === "Escape") {
            e.stopPropagation()
            onClose()
          } else if (e.key === "Enter") {
            e.preventDefault()
            submit()
          }
        }}
      >
        <div className="docs-link-title" id={titleId}>
          {editing ? "Edit link" : "Insert link"}
        </div>
        <div className="docs-link-body">
          <label className="docs-link-field">
            <span>Text</span>
            <input
              ref={textRef}
              className="docs-link-input"
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Optional — defaults to the URL"
              aria-label="Link text"
            />
          </label>
          <label className="docs-link-field">
            <span>Link</span>
            <input
              ref={urlRef}
              className="docs-link-input"
              value={url}
              onChange={(e) => {
                setUrl(e.target.value)
                setError(null)
              }}
              placeholder="https:// · www. · or email"
              aria-label="Link URL"
              autoComplete="url"
            />
          </label>
          {error && <p className="docs-link-error">{error}</p>}
          <p className="docs-link-hint">
            Tip: click a link to open it · right-click to edit · paste a URL over selected text to link it · Cmd/Ctrl+K
          </p>
        </div>
        <div className="docs-link-actions">
          {editing && onRemove && (
            <button type="button" className="docs-btn docs-btn-danger" onClick={onRemove}>
              Remove
            </button>
          )}
          <span className="docs-link-actions-spacer" />
          <button type="button" className="docs-btn" onClick={onClose}>
            Cancel
          </button>
          <button type="button" className="docs-btn docs-btn-primary" onClick={submit}>
            Apply
          </button>
        </div>
      </div>
    </div>
  )
}
