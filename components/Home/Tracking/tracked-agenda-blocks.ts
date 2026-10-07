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
import { discreteLogInstants, penNameById } from "@/components/Home/Tracking/discrete-log-instants"

export interface TrackedAgendaBlock {
  id: string
  label: string
  startMinutes: number
  durationMinutes: number
  color?: string
  sublabel?: string
}

/**
 * Same slabs Day Log overlays on its agenda for this scope-day, plus discrete
 * log instants from any view. Intervals stay blocks. Pass every scope so a
 * switch on Location still finds its pen while Activity is selected.
 */
export function trackedAgendaBlocks(
  entries: TimeEntry[],
  scope: TrackScope | undefined,
  dayKey: string,
  scopes?: readonly TrackScope[],
): TrackedAgendaBlock[] {
  if (!scope) return []
  const views = scopes && scopes.length > 0 ? scopes : [scope]
  const own = entriesForDay(entries, dayKey, scope.id)
  const extra = discreteLogInstants(entries, penNameById(views), dayKey).filter(
    (entry) => !own.some((row) => row.id === entry.id),
  )
  const rows =
    extra.length === 0
      ? own
      : [...own, ...extra].sort((a, b) => a.startMin - b.startMin || a.id.localeCompare(b.id))
  return rows.map((entry) => {
    const entryScope = views.find((candidate) => candidate.id === entry.scopeId) ?? scope
    const pen = displayedPen(entryScope, entry.penId) ?? findPen([...views], entry.penId)
    const leaf = findPen([...views], entry.penId)
    const assumed = entry.precision === "estimated"
    const extraPens = assignedPenIds(entry)
      .slice(1)
      .map((id) => findPen([...views], id)?.name)
      .filter((name): name is string => Boolean(name))
    return {
      id: entry.id,
      label: `${entryDisplayName(entry, leaf?.name || pen?.name || "Tracked")}${assumed ? " ≈" : ""}`,
      startMinutes: entry.startMin,
      durationMinutes: Math.max(1, entry.endMin - entry.startMin),
      color: pen?.color,
      sublabel: `${minutesToLabel(entry.startMin)}–${minutesToLabel(entry.endMin)} · ${formatDuration(entry.endMin - entry.startMin)}${
        leaf && leaf.id !== pen?.id ? ` · ${leaf.name}` : ""
      }${extraPens.length ? ` · also ${extraPens.join(", ")}` : ""}${assumed ? " · assumed" : ""}`,
    }
  })
}
