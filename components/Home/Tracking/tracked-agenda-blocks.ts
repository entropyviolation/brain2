/**
 * components/Home/Tracking/tracked-agenda-blocks.ts
 *
 * Painted Tracking intervals as agenda slabs. Day Log (day and week) and the
 * Plan day-view ghosts both call this, so the names, pens, and spans stay one
 * log — not a second activity list.
 */
import { displayedPen, findPen, type TrackScope } from "@/lib/time-tracking-store"
import {
  assignedPenIds,
  entriesForDay,
  entryDisplayName,
  formatDuration,
  minutesToLabel,
  type TimeEntry,
} from "@/lib/time-entries"

export interface TrackedAgendaBlock {
  id: string
  label: string
  startMinutes: number
  durationMinutes: number
  color?: string
  sublabel?: string
}

/** Same slabs Day Log overlays on its agenda for this scope-day. */
export function trackedAgendaBlocks(
  entries: TimeEntry[],
  scope: TrackScope | undefined,
  dayKey: string,
): TrackedAgendaBlock[] {
  if (!scope) return []
  return entriesForDay(entries, dayKey, scope.id).map((entry) => {
    const pen = displayedPen(scope, entry.penId) ?? findPen([scope], entry.penId)
    const leaf = findPen([scope], entry.penId)
    const assumed = entry.precision === "estimated"
    const extra = assignedPenIds(entry)
      .slice(1)
      .map((id) => findPen([scope], id)?.name)
      .filter((name): name is string => Boolean(name))
    return {
      id: entry.id,
      label: `${entryDisplayName(entry, leaf?.name || pen?.name || "Tracked")}${assumed ? " ≈" : ""}`,
      startMinutes: entry.startMin,
      durationMinutes: Math.max(1, entry.endMin - entry.startMin),
      color: pen?.color,
      sublabel: `${minutesToLabel(entry.startMin)}–${minutesToLabel(entry.endMin)} · ${formatDuration(entry.endMin - entry.startMin)}${
        leaf && leaf.id !== pen?.id ? ` · ${leaf.name}` : ""
      }${extra.length ? ` · also ${extra.join(", ")}` : ""}${assumed ? " · assumed" : ""}`,
    }
  })
}
