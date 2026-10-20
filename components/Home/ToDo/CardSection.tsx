/**
 * components/Home/ToDo/CardSection.tsx — A titled, optionally collapsible zone of the task card
 *
 * The whole title row is the toggle (`aria-expanded`). Open or shut is a view
 * preference kept in localStorage under `storageKey` (default open; storage
 * may be blocked, so every read and write is guarded). Collapsed, `summary`
 * stays on the row as one quiet line. Without `storageKey` it is not collapsible.
 */
"use client"

import { useId, useState } from "react"
import type { ReactNode } from "react"

function readOpen(key: string | undefined): boolean {
  if (!key) return true
  try {
    return localStorage.getItem(key) !== "closed"
  } catch {
    return true
  }
}

export function CardSection({
  title,
  count,
  summary,
  storageKey,
  className = "",
  children,
}: {
  title: string
  count?: number
  summary?: ReactNode
  storageKey?: string
  className?: string
  children: ReactNode
}) {
  const [open, setOpen] = useState(() => readOpen(storageKey))
  const bodyId = useId()
  const toggle = () =>
    setOpen((was) => {
      try {
        if (storageKey) localStorage.setItem(storageKey, was ? "closed" : "open")
      } catch {
        /* view state only */
      }
      return !was
    })
  return (
    <section className={`tc-section ${className}`.trim()} aria-label={title}>
      {storageKey ? (
        <button type="button" className="tc-section-head is-toggle" aria-expanded={open} aria-controls={bodyId} onClick={toggle}>
          <span className="tc-section-title">{title}</span>
          {count != null ? <span className="tc-section-count">{count}</span> : null}
          {!open && summary ? <span className="tc-section-summary">{summary}</span> : null}
          <i className="tc-section-chev" aria-hidden>▾</i>
        </button>
      ) : (
        <div className="tc-section-head">
          <span className="tc-section-title">{title}</span>
          {count != null ? <span className="tc-section-count">{count}</span> : null}
        </div>
      )}
      <div id={bodyId} className="tc-section-body" hidden={!open}>
        {children}
      </div>
    </section>
  )
}
