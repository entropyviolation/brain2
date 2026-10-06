/**
 * components/Analytics/BlockSearch.tsx — Find blocks without leaving Analytics
 *
 * Calls `findBlocks` (`block-search.ts` → `lib/tracking-search.ts`). A row jumps
 * to that block on this surface. "Show matches in this view" keeps the Tracking
 * measures on the matching set.
 */
"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { minutesToLabel, type TimeEntry } from "@/lib/time-entries"
import type { TrackScope } from "@/lib/time-tracking-store"
import type { TrackingSearchHit } from "@/lib/tracking-search"
import { findBlocks, SEARCH_LIST_LIMIT } from "./block-search"
import "./analytics-boards.css"

export function BlockSearch({
  entries,
  scopes,
  filterQuery,
  filterDetail,
  outsideNote,
  onShowMatches,
  onClear,
  onJump,
}: {
  entries: TimeEntry[]
  scopes: TrackScope[]
  filterQuery: string | null
  filterDetail: string | null
  outsideNote: string | null
  onShowMatches: (query: string) => void
  onClear: () => void
  onJump: (hit: TrackingSearchHit) => void
}) {
  const [query, setQuery] = useState(filterQuery ?? "")
  const [open, setOpen] = useState(false)
  const hits = useMemo(() => findBlocks(query, entries, scopes, SEARCH_LIST_LIMIT), [query, entries, scopes])
  const ready = query.trim().length >= 2
  const popRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (open && ready) popRef.current?.scrollIntoView({ block: "nearest" })
  }, [open, ready, hits.length])

  return (
    <div className="an-find" data-testid="analytics-block-search">
      <div className="an-find-field">
        <label className="an-find-label">
          Find blocks
          <input
            aria-label="Find blocks"
            value={query}
            placeholder="Name, pen, counts as, action…"
            title="Matches display names, notes, pens, secondary pens, counts-as chains, and action formats."
            onChange={(event) => {
              setQuery(event.target.value)
              setOpen(true)
            }}
            onFocus={() => setOpen(true)}
            onClick={() => setOpen(true)}
          />
        </label>
        {open && ready && (
          <div className="an-find-pop" ref={popRef}>
            <ul className="an-find-list" role="listbox" aria-label="Matching blocks">
              {hits.length === 0 ? (
                <li className="an-find-empty">No blocks match.</li>
              ) : (
                hits.map((hit) => (
                  <li key={hit.entryId}>
                    <button
                      type="button"
                      role="option"
                      className="an-find-hit"
                      onClick={() => {
                        onJump(hit)
                        setOpen(false)
                      }}
                    >
                      <span className="an-find-hit-label">
                        {hit.label}
                        <span className="an-find-hit-meta">
                          {" "}
                          · {hit.scopeName} · {hit.match}
                        </span>
                      </span>
                      <span className="an-find-hit-when">
                        {hit.date} {minutesToLabel(hit.startMin)}
                      </span>
                    </button>
                  </li>
                ))
              )}
            </ul>
            {hits.length > 0 && (
              <button
                type="button"
                className="an-chip"
                data-testid="block-search-show"
                title="Redraw this Tracking view on the matching blocks. Other paint is hidden, not called untracked."
                onClick={() => {
                  onShowMatches(query.trim())
                  setOpen(false)
                }}
              >
                Show matches in this view
              </button>
            )}
          </div>
        )}
      </div>
      {filterQuery && (
        <p className="an-find-note" data-testid="block-search-filter">
          Showing blocks that match “{filterQuery}”. {filterDetail ? `${filterDetail}. ` : ""}
          Other paint is hidden, not counted as untracked.{" "}
          <button type="button" className="an-open-lists" onClick={onClear}>
            Clear
          </button>
        </p>
      )}
      {outsideNote && <p className="an-find-note">{outsideNote}</p>}
    </div>
  )
}
