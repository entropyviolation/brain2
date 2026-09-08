/**
 * components/Docs/DocsHome.tsx — Folder homepage (Google Docs-style card grid)
 *
 * Search + "new / upload" cards + document tiles for the current folder filter.
 */
"use client"

import { FileText, FileUp, Plus, Search } from "lucide-react"
import { documentPreviewText, htmlToPlainText } from "@/lib/doc-html"
import {
  documentFolder,
  documentStatus,
  documentUpdatedAt,
} from "./doc-actions"
import type { Task } from "@/lib/types"

function formatOpened(doc: Task): string {
  const date = documentUpdatedAt(doc) ?? (doc.createdAt instanceof Date ? doc.createdAt : new Date(doc.createdAt))
  if (Number.isNaN(date.getTime())) return ""
  const now = new Date()
  const sameDay = date.toDateString() === now.toDateString()
  if (sameDay) {
    return `Opened ${date.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })}`
  }
  return `Opened ${date.toLocaleDateString(undefined, { month: "short", day: "numeric" })}`
}

export function docMatchesQuery(doc: Task, query: string, fullBody?: string): boolean {
  const q = query.trim().toLowerCase()
  if (!q) return true
  const title = (doc.description || "").toLowerCase()
  if (title.includes(q)) return true
  const folder = documentFolder(doc).toLowerCase()
  if (folder.includes(q)) return true
  const text = htmlToPlainText(fullBody || doc.body || "").toLowerCase()
  return text.includes(q)
}

interface DocsHomeProps {
  folderLabel: string
  docs: Task[]
  bodies: Record<string, string>
  query: string
  onQueryChange: (q: string) => void
  onOpen: (id: string) => void
  onCreate: () => void
  onUpload: () => void
}

export function DocsHome({
  folderLabel,
  docs,
  bodies,
  query,
  onQueryChange,
  onOpen,
  onCreate,
  onUpload,
}: DocsHomeProps) {
  return (
    <div className="docs-home">
      <div className="docs-home-start">
        <div className="docs-home-start-head">
          <h3>Start a new document</h3>
        </div>
        <div className="docs-home-templates">
          <button type="button" className="docs-home-blank" onClick={onCreate}>
            <span className="docs-home-blank-plus" aria-hidden>
              +
            </span>
            <span className="docs-home-card-label">Blank document</span>
          </button>
          <button type="button" className="docs-home-blank docs-home-upload-card" onClick={onUpload}>
            <span className="docs-home-blank-plus" aria-hidden>
              <FileUp className="h-8 w-8" />
            </span>
            <span className="docs-home-card-label">Upload PDF</span>
          </button>
        </div>
      </div>

      <div className="docs-home-recent">
        <div className="docs-home-recent-head">
          <h3>{folderLabel}</h3>
          <label className="docs-home-search">
            <Search className="h-3.5 w-3.5" aria-hidden />
            <input
              type="search"
              value={query}
              onChange={(e) => onQueryChange(e.target.value)}
              placeholder="Search"
              aria-label={`Search ${folderLabel}`}
            />
          </label>
        </div>
        {docs.length === 0 ? (
          <p className="docs-home-empty">
            {query.trim() ? "No documents match that search." : "No documents here. Create a blank document or upload a PDF."}
          </p>
        ) : (
          <ul className="docs-home-grid">
            {docs.map((d) => {
              const html = bodies[d.id] || d.body || ""
              const thumb = html.length > 4000 ? html.slice(0, 4000) : html
              return (
                <li key={d.id}>
                  <button type="button" className="docs-home-card" onClick={() => onOpen(d.id)}>
                    <div className="docs-home-thumb" aria-hidden>
                      <div
                        className="docs-home-thumb-inner"
                        dangerouslySetInnerHTML={{
                          __html: thumb || "<p></p>",
                        }}
                      />
                    </div>
                    <div className="docs-home-card-meta">
                      <FileText className="h-3.5 w-3.5 docs-home-card-icon" aria-hidden />
                      <div className="docs-home-card-text">
                        <span className="docs-home-card-title">{d.description || "Untitled"}</span>
                        <span className="docs-home-card-sub">
                          {formatOpened(d)}
                          {documentStatus(d) !== "draft" ? ` · ${documentStatus(d)}` : ""}
                        </span>
                        <span className="docs-home-card-snippet">{documentPreviewText(html, 90)}</span>
                      </div>
                    </div>
                  </button>
                </li>
              )
            })}
          </ul>
        )}
      </div>
    </div>
  )
}
