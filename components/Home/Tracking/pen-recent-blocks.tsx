/**
 * components/Home/Tracking/pen-recent-blocks.tsx — Recent blocks in this pen's color
 *
 * A short, scrollable list inside Pen settings: the latest entries whose
 * primary pen is this one (the blocks the grid colors with it), newest first.
 * Each row opens the same block editor as clicking the block on the grid. It
 * only reads entries; editing happens in `EntryDialog`.
 */
"use client"

import { useMemo, useState } from "react"
import { useTimeTrackingStore, type TimeEntry } from "@/lib/time-tracking-store"
import { entryDisplayName, formatDuration, minutesToLabel } from "@/lib/time-entries"
import { parseLocalDate } from "@/lib/date-utils"
import { EntryDialog } from "@/components/Home/Tracking/entry-dialog"
import "./tracking-chrome.css"

/** Enough to scroll back a few weeks without walking the whole vault into the DOM. */
export const PEN_RECENT_LIMIT = 40

/** Newest first: later date, then later start, then id for a stable order. */
export function recentPenBlocks(
  entries: readonly TimeEntry[],
  scopeId: string,
  penId: string,
  limit = PEN_RECENT_LIMIT,
): TimeEntry[] {
  return entries
    .filter((entry) => entry.scopeId === scopeId && entry.penId === penId)
    .sort((a, b) => b.date.localeCompare(a.date) || b.startMin - a.startMin || a.id.localeCompare(b.id))
    .slice(0, limit)
}

function dayLabel(date: string): string {
  const parsed = parseLocalDate(date)
  return parsed ? parsed.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" }) : date
}

export function PenRecentBlocks({
  scopeId,
  penId,
  penName,
  color,
}: {
  scopeId: string
  penId: string
  penName: string
  /** The swatch color, so an unsaved recolor previews in the list too. */
  color: string
}) {
  const entries = useTimeTrackingStore((s) => s.entries)
  const rows = useMemo(() => recentPenBlocks(entries, scopeId, penId), [entries, scopeId, penId])
  const [openId, setOpenId] = useState<string | null>(null)
  const open = openId ? entries.find((entry) => entry.id === openId) : undefined

  return (
    <div className="trk-section space-y-1.5">
      <span className="trk-section-title">Recent blocks</span>
      {rows.length === 0 ? (
        <p className="trk-help">Nothing painted with this pen yet.</p>
      ) : (
        <ul className="trk-pen-recent" aria-label="Recent blocks with this pen">
          {rows.map((entry) => {
            const span = entry.kind === "instant" || entry.endMin <= entry.startMin
            const clock = span
              ? minutesToLabel(entry.startMin)
              : `${minutesToLabel(entry.startMin)}–${minutesToLabel(entry.endMin)}`
            const title = entryDisplayName(entry, penName)
            return (
              <li key={entry.id}>
                <button
                  type="button"
                  className="trk-pen-recent-row"
                  title="Open this block"
                  onClick={() => setOpenId(entry.id)}
                >
                  <span className="trk-pen-recent-bead" style={{ background: color }} aria-hidden />
                  <span className="trk-pen-recent-date">{dayLabel(entry.date)}</span>
                  <span className="trk-pen-recent-clock">{clock}</span>
                  {title !== penName ? <span className="trk-pen-recent-title">{title}</span> : null}
                  {!span ? (
                    <span className="trk-pen-recent-dur">{formatDuration(entry.endMin - entry.startMin)}</span>
                  ) : null}
                </button>
              </li>
            )
          })}
        </ul>
      )}
      {open ? <EntryDialog entry={open} onClose={() => setOpenId(null)} /> : null}
    </div>
  )
}
