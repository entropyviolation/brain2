"use client"

/**
 * The open list's caption bar: stamped key glyphs (search, add, settings,
 * close) and the one-list search field that takes the right half of the
 * caption while the list name keeps the left. Name-only by default; the
 * "All fields" lamp also reads notes, body, tags, subtasks, and every
 * attribute value (`filterListItemsBySearch` in lib/list-item-sort.ts).
 */
import { useEffect, useRef } from "react"

type GlyphKind = "search" | "add" | "settings" | "close"

/* 16-unit stamped marks. Drawn twice: a 1px lower lip, then the ink. */
const GLYPHS: Record<GlyphKind, string> = {
  search:
    "M6.6 1.4a5.2 5.2 0 1 0 2.9 9.52l3.6 3.6a1.25 1.25 0 0 0 1.77-1.77l-3.6-3.6A5.2 5.2 0 0 0 6.6 1.4Zm0 2.2a3 3 0 1 1 0 6 3 3 0 0 1 0-6Z",
  add: "M6.7 2.2h2.6v4.5h4.5v2.6H9.3v4.5H6.7V9.3H2.2V6.7h4.5Z",
  settings:
    "M13.35 6.35 L15.15 6.55 L15.15 9.45 L13.35 9.65 L12.95 10.61 L14.08 12.03 L12.03 14.08 L10.61 12.95 L9.65 13.35 L9.45 15.15 L6.55 15.15 L6.35 13.35 L5.39 12.95 L3.97 14.08 L1.92 12.03 L3.05 10.61 L2.65 9.65 L0.85 9.45 L0.85 6.55 L2.65 6.35 L3.05 5.39 L1.92 3.97 L3.97 1.92 L5.39 3.05 L6.35 2.65 L6.55 0.85 L9.45 0.85 L9.65 2.65 L10.61 3.05 L12.03 1.92 L14.08 3.97 L12.95 5.39ZM8 5.5a2.5 2.5 0 1 0 0 5a2.5 2.5 0 1 0 0 -5Z",
  close:
    "M3.35 1.5 8 6.15l4.65-4.65 1.85 1.85L9.85 8l4.65 4.65-1.85 1.85L8 9.85 3.35 14.5 1.5 12.65 6.15 8 1.5 3.35Z",
}

export function CaptionKeyGlyph({ kind }: { kind: GlyphKind }) {
  const d = GLYPHS[kind]
  return (
    <svg className="fm-cap-glyph" viewBox="0 0 16 16" width="16" height="16" aria-hidden focusable="false">
      <path className="fm-cap-glyph-lip" d={d} transform="translate(0 1)" fillRule="evenodd" />
      <path className="fm-cap-glyph-ink" d={d} fillRule="evenodd" />
    </svg>
  )
}

export function ListCaptionSearch({
  listName,
  query,
  onQueryChange,
  allFields,
  onAllFieldsChange,
  matchCount,
  onClose,
}: {
  listName: string
  query: string
  onQueryChange: (q: string) => void
  allFields: boolean
  onAllFieldsChange: (on: boolean) => void
  /** Rows matching now, or null while the field is empty. */
  matchCount: number | null
  onClose: () => void
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  return (
    <div className="fm-list-search" role="search" data-testid="list-caption-search">
      <svg className="fm-list-search-lens" viewBox="0 0 16 16" width="13" height="13" aria-hidden>
        <path d={GLYPHS.search} fillRule="evenodd" />
      </svg>
      <input
        ref={inputRef}
        className="fm-list-search-input"
        type="search"
        value={query}
        placeholder={`Search ${listName || "this list"}…`}
        aria-label={`Search ${listName || "this list"}`}
        onChange={(e) => onQueryChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Escape") {
            e.preventDefault()
            if (query) onQueryChange("")
            else onClose()
          }
        }}
        spellCheck={false}
        autoComplete="off"
      />
      {matchCount != null ? (
        <span className="fm-list-search-count" aria-live="polite">
          {matchCount}
        </span>
      ) : null}
      <button
        type="button"
        data-no95
        className="fm-list-search-scope"
        aria-pressed={allFields}
        title={allFields ? "Searching names, notes, tags, and every attribute" : "Searching names only — switch on to search notes and attributes too"}
        onClick={() => {
          onAllFieldsChange(!allFields)
          inputRef.current?.focus()
        }}
      >
        <span className="fm-list-search-lamp" aria-hidden />
        All fields
      </button>
    </div>
  )
}
