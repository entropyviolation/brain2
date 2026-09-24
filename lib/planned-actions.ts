/**
 * lib/planned-actions.ts — Timed intentions on a Plan day
 *
 * A planned action is a time block on one local calendar day: start, end,
 * title, and notes. It is not a calendar event (Add Event / paste) and it
 * does not complete a habit. Dropping a To Do or daily habit onto the day
 * agenda writes one of these, linked to that source. Click-drag on empty
 * agenda minutes writes a free-form block.
 */
import { formatLocalDateKey } from "@/lib/date-utils"

export const PLANNED_ACTION_SOURCES = ["free", "todo", "habit"] as const
export type PlannedActionSource = (typeof PLANNED_ACTION_SOURCES)[number]

export interface PlannedAction {
  id: string
  /** Local `YYYY-MM-DD`. */
  date: string
  startTime: string
  endTime: string
  title: string
  notes: string
  source: PlannedActionSource
  /** Task id (`todo`) or habit id (`habit`). */
  sourceId?: string
}

export const DEFAULT_PLANNED_MINUTES = 30
const SNAP = 15

export function hhmmToMinutes(time?: string): number {
  if (!time) return 0
  const [h, m] = time.split(":").map(Number)
  return Math.max(0, (h || 0) * 60 + (m || 0))
}

export function minutesToHhmm(total: number): string {
  const safe = Number.isFinite(total) ? total : 0
  const clamped = Math.max(0, Math.min(24 * 60, Math.round(safe)))
  const h = Math.floor(clamped / 60) % 24
  const m = clamped % 60
  return `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}`
}

export function snapMinutes(raw: number): number {
  if (!Number.isFinite(raw)) return 0
  return Math.round(raw / SNAP) * SNAP
}

export function plannedDurationMinutes(action: Pick<PlannedAction, "startTime" | "endTime">): number {
  const span = hhmmToMinutes(action.endTime) - hhmmToMinutes(action.startTime)
  return Math.max(SNAP, span)
}

export function rangeToTimes(startMinutes: number, endMinutes: number): { startTime: string; endTime: string } {
  const a = snapMinutes(Math.min(startMinutes, endMinutes))
  let b = snapMinutes(Math.max(startMinutes, endMinutes))
  if (b <= a) b = Math.min(24 * 60, a + DEFAULT_PLANNED_MINUTES)
  return { startTime: minutesToHhmm(a), endTime: minutesToHhmm(b) }
}

export function timesFromStartAndDuration(startMinutes: number, durationMinutes: number): {
  startTime: string
  endTime: string
} {
  const start = snapMinutes(Math.max(0, startMinutes))
  const duration = Math.max(SNAP, durationMinutes || DEFAULT_PLANNED_MINUTES)
  return { startTime: minutesToHhmm(start), endTime: minutesToHhmm(start + duration) }
}

export function actionsForDay(actions: PlannedAction[], date: Date | string): PlannedAction[] {
  const key = typeof date === "string" ? date : formatLocalDateKey(date)
  return actions.filter((action) => action.date === key)
}

export function findPlacementForSource(
  actions: PlannedAction[],
  date: string,
  source: Exclude<PlannedActionSource, "free">,
  sourceId: string,
): PlannedAction | undefined {
  return actions.find((action) => action.date === date && action.source === source && action.sourceId === sourceId)
}

export function makePlannedAction(partial: Omit<PlannedAction, "id" | "notes" | "title"> & {
  title?: string
  notes?: string
  id?: string
}): PlannedAction {
  return {
    id: partial.id ?? `plan-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    date: partial.date,
    startTime: partial.startTime,
    endTime: partial.endTime,
    title: (partial.title ?? "").trim() || defaultTitle(partial.source),
    notes: partial.notes ?? "",
    source: partial.source,
    sourceId: partial.sourceId,
  }
}

export function defaultTitle(source: PlannedActionSource): string {
  if (source === "habit") return "Habit"
  if (source === "todo") return "To Do"
  return "Planned action"
}

export function placementFromDrop(input: {
  date: string
  hour: number
  minute: number
  durationMinutes?: number
  source: PlannedActionSource
  sourceId?: string
  title?: string
  notes?: string
}): PlannedAction {
  const start = input.hour * 60 + input.minute
  const { startTime, endTime } = timesFromStartAndDuration(start, input.durationMinutes ?? DEFAULT_PLANNED_MINUTES)
  return makePlannedAction({
    date: input.date,
    startTime,
    endTime,
    source: input.source,
    sourceId: input.sourceId,
    title: input.title,
    notes: input.notes ?? "",
  })
}

export function placementFromDragRange(input: {
  date: string
  startMinutes: number
  endMinutes: number
  title?: string
  notes?: string
}): PlannedAction {
  const { startTime, endTime } = rangeToTimes(input.startMinutes, input.endMinutes)
  return makePlannedAction({
    date: input.date,
    startTime,
    endTime,
    source: "free",
    title: input.title,
    notes: input.notes ?? "",
  })
}

export function movePlacement(action: PlannedAction, hour: number, minute: number): PlannedAction {
  const duration = plannedDurationMinutes(action)
  const { startTime, endTime } = timesFromStartAndDuration(hour * 60 + minute, duration)
  return { ...action, startTime, endTime }
}

/** Task ids already given a planned placement on that local day. */
export function todoIdsCoveredByPlacements(actions: PlannedAction[], date: Date | string): Set<string> {
  const key = typeof date === "string" ? date : formatLocalDateKey(date)
  const ids = new Set<string>()
  for (const action of actions) {
    if (action.date === key && action.source === "todo" && action.sourceId) ids.add(action.sourceId)
  }
  return ids
}
