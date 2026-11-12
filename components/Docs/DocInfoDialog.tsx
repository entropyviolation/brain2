/**
 * components/Docs/DocInfoDialog.tsx — "i" info sheet for the open document
 *
 * Read-only facts about one doc: dates (created / modified / last opened),
 * size (words, characters, reading time), where it lives (folder, status,
 * font, secret), and how often its text was sent elsewhere. Win95 chrome
 * shared with `LinkDialog` (`.docs-link-*` in `document-editor.css`).
 */
"use client"

import { useEffect, useId, useMemo, useRef } from "react"
import type { Task } from "@/lib/types"
import { htmlToPlainText } from "@/lib/doc-html"
import { useDocOutLinks } from "@/lib/doc-selection/doc-out-links"
import {
  documentFolder,
  documentFont,
  documentStatus,
  documentUpdatedAt,
} from "./doc-actions"

interface DocInfoDialogProps {
  open: boolean
  doc: Task
  /** Current editor HTML (may be newer than the saved body). */
  html: string
  /** The open before this one; null when this is the first recorded open. */
  previousOpenedAt: Date | null
  /** When this visit opened the doc. */
  openedNowAt: Date | null
  onClose: () => void
}

function toDate(v: Date | string | undefined | null): Date | null {
  if (!v) return null
  const d = v instanceof Date ? v : new Date(v)
  return Number.isNaN(d.getTime()) ? null : d
}

function fmtDate(d: Date | null): string {
  if (!d) return "—"
  return d.toLocaleString(undefined, {
    weekday: "short",
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  })
}

function ago(d: Date | null, now = Date.now()): string {
  if (!d) return ""
  const s = Math.round((now - d.getTime()) / 1000)
  if (s < 60) return "just now"
  const m = Math.round(s / 60)
  if (m < 60) return `${m} min ago`
  const h = Math.round(m / 60)
  if (h < 24) return `${h} h ago`
  const days = Math.round(h / 24)
  if (days < 60) return `${days} day${days === 1 ? "" : "s"} ago`
  const mo = Math.round(days / 30)
  if (mo < 24) return `${mo} months ago`
  return `${Math.round(days / 365)} years ago`
}

function fmtBytes(n: number): string {
  if (n < 1024) return `${n} B`
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`
  return `${(n / 1024 / 1024).toFixed(2)} MB`
}

export function DocInfoDialog({ open, doc, html, previousOpenedAt, openedNowAt, onClose }: DocInfoDialogProps) {
  const titleId = useId()
  const closeRef = useRef<HTMLButtonElement>(null)
  const outLinks = useDocOutLinks((s) => s.links)

  useEffect(() => {
    if (open) requestAnimationFrame(() => closeRef.current?.focus())
  }, [open])

  const stats = useMemo(() => {
    if (!open) return null
    const text = htmlToPlainText(html)
    const words = (text.match(/\S+/g) ?? []).length
    const parsed = typeof DOMParser !== "undefined" ? new DOMParser().parseFromString(html, "text/html") : null
    return {
      words,
      chars: text.length,
      charsNoSpaces: text.replace(/\s/g, "").length,
      paragraphs: parsed ? parsed.body.querySelectorAll("p,li,h1,h2,h3,h4,h5,h6").length : 0,
      images: parsed ? parsed.body.querySelectorAll("img").length : 0,
      links: parsed ? parsed.body.querySelectorAll("a[href]").length : 0,
      readMin: Math.max(1, Math.round(words / 230)),
      bytes: new Blob([html]).size,
    }
  }, [open, html])

  if (!open || !stats) return null

  const created = toDate(doc.createdAt)
  const modified = documentUpdatedAt(doc)
  const sends = outLinks.filter((l) => l.docId === doc.id)
  const lastSend = sends.length ? toDate(sends[sends.length - 1].at) : null
  const fromPdf = /^<p><strong>From PDF:/i.test(html.trim())
  const folder = documentFolder(doc)

  const rows: Array<[string, string, string?]> = [
    ["Created", fmtDate(created), ago(created)],
    ["Last modified", fmtDate(modified), ago(modified)],
    [
      "Last opened",
      previousOpenedAt ? fmtDate(previousOpenedAt) : "First recorded open",
      previousOpenedAt ? `${ago(previousOpenedAt)}, before this visit` : undefined,
    ],
    ["Opened now", fmtDate(openedNowAt), ago(openedNowAt)],
  ]
  const sizeRows: Array<[string, string, string?]> = [
    ["Words", stats.words.toLocaleString(), `~${stats.readMin} min read`],
    ["Characters", stats.chars.toLocaleString(), `${stats.charsNoSpaces.toLocaleString()} without spaces`],
    ["Blocks", stats.paragraphs.toLocaleString(), "paragraphs, headings, list items"],
    ["Images · links", `${stats.images} · ${stats.links}`],
    ["Size", fmtBytes(stats.bytes), "HTML on this device"],
  ]
  const placeRows: Array<[string, string, string?]> = [
    ["Folder", folder || "Unfiled"],
    ["Status", documentStatus(doc)],
    ["Font", documentFont(doc)],
    ["Secret", doc.secret ? "Yes, hidden from search and BIM" : "No"],
    ["Source", fromPdf ? "Uploaded PDF" : folder === "From phone" ? "Phone (Telegram)" : "Written here"],
    ["Text sent out", sends.length ? `${sends.length} time${sends.length === 1 ? "" : "s"}` : "Never", lastSend ? `last ${ago(lastSend)}` : undefined],
    ["Tags", doc.tags?.length ? doc.tags.join(", ") : "—"],
    ["ID", doc.id],
  ]

  const section = (head: string, list: Array<[string, string, string?]>) => (
    <section className="docs-info-section">
      <h3 className="docs-info-head">{head}</h3>
      <dl className="docs-info-grid">
        {list.map(([k, v, sub]) => (
          <div key={k} className="docs-info-row">
            <dt>{k}</dt>
            <dd>
              <span className={k === "ID" ? "docs-info-mono" : undefined}>{v}</span>
              {sub ? <span className="docs-info-sub">{sub}</span> : null}
            </dd>
          </div>
        ))}
      </dl>
    </section>
  )

  return (
    <div className="docs-link-overlay" role="presentation" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div
        className="docs-link-dialog docs-info-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onKeyDown={(e) => {
          if (e.key === "Escape") {
            e.stopPropagation()
            onClose()
          }
        }}
      >
        <div className="docs-link-title" id={titleId}>
          Document info
        </div>
        <div className="docs-link-body docs-info-body">
          <p className="docs-info-name">{doc.description || "Untitled document"}</p>
          {section("Dates", rows)}
          {section("Size", sizeRows)}
          {section("Place", placeRows)}
        </div>
        <div className="docs-link-actions">
          <span className="docs-link-actions-spacer" />
          <button ref={closeRef} type="button" className="docs-btn docs-btn-primary" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  )
}
