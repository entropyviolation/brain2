/**
 * components/Home/Tracking/tracking-find.tsx — Jump to a block by its words
 *
 * Tracker field. Matches display names, notes, pens, counts-as chains, and
 * action formats (`lib/tracking-search.ts`). The hit list is portaled so the
 * plot strip's overflow does not cover it. Choosing a row calls `onJump`.
 */
"use client"

import { useLayoutEffect, useMemo, useRef, useState } from "react"
import { createPortal } from "react-dom"
import { minutesToLabel } from "@/lib/time-entries"
import { useTimeTrackingStore } from "@/lib/time-tracking-store"
import { searchTracking, type TrackingSearchHit } from "@/lib/tracking-search"

export function TrackingFind({ onJump }: { onJump: (hit: TrackingSearchHit) => void }) {
  const entries = useTimeTrackingStore((s) => s.entries)
  const scopes = useTimeTrackingStore((s) => s.scopes)
  const anchorRef = useRef<HTMLDivElement>(null)
  const [query, setQuery] = useState("")
  const [open, setOpen] = useState(false)
  const [box, setBox] = useState<{ top: number; left: number; width: number } | null>(null)
  const hits = useMemo(() => searchTracking(query, entries, scopes), [query, entries, scopes])
  const show = open && query.trim().length >= 2

  useLayoutEffect(() => {
    if (!show) return
    const place = () => {
      const el = anchorRef.current
      if (!el) return
      const rect = el.getBoundingClientRect()
      setBox({ top: rect.bottom + 2, left: rect.left, width: Math.max(rect.width, 220) })
    }
    place()
    window.addEventListener("scroll", place, true)
    window.addEventListener("resize", place)
    return () => {
      window.removeEventListener("scroll", place, true)
      window.removeEventListener("resize", place)
    }
  }, [show, query])

  const list =
    show && box && typeof document !== "undefined"
      ? createPortal(
          <div className="trk95" style={{ position: "fixed", top: box.top, left: box.left, width: box.width, zIndex: 400 }}>
            <ul className="trk-find-list" role="listbox" aria-label="Matching blocks" style={{ position: "static", width: "100%" }}>
              {hits.length === 0 ? (
                <li className="trk-find-empty">No blocks match.</li>
              ) : (
                hits.map((hit) => (
                  <li key={hit.entryId}>
                    <button
                      type="button"
                      role="option"
                      className="trk-find-hit"
                      onClick={() => {
                        onJump(hit)
                        setOpen(false)
                      }}
                    >
                      <span className="truncate">
                        {hit.label}
                        <span className="trk-parent-path">
                          {" "}
                          · {hit.scopeName} · {hit.match}
                        </span>
                      </span>
                      <span className="trk-log-mins shrink-0">
                        {hit.date} {minutesToLabel(hit.startMin)}
                      </span>
                    </button>
                  </li>
                ))
              )}
            </ul>
          </div>,
          document.body,
        )
      : null

  return (
    <div className="trk-find" ref={anchorRef}>
      <label className="trk-field">
        <span className="trk-field-label">Find</span>
        <input
          aria-label="Find blocks"
          value={query}
          placeholder="Name, pen, counts as…"
          onChange={(event) => {
            setQuery(event.target.value)
            setOpen(true)
          }}
          onFocus={() => setOpen(true)}
        />
      </label>
      {list}
    </div>
  )
}
