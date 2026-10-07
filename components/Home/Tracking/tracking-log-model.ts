/**
 * components/Home/Tracking/tracking-log-model.ts — Tracking log rows
 *
 * Activity instants only. Food / drink / drug follow `intakeClass` (or
 * `eventKind` `intake.food` / `intake.drink` / `intake.drug`). Bare intake
 * (`eventKind` `intake`, or the Intake pen with no class) sits in a short
 * Intake group under those three. Other log-like instants — Text log pen
 * and/or a phrase `eventKind`, and no intake class — are the event list.
 * Switch rows are Activity instants on the Switch pen (`st:` / `switch:`) or
 * the Objective pen (`so:`), plus an instant on whatever other scope the
 * person picked. A note is a Text log instant (`note:`), so it stays on the
 * event list. A thought process is that same Text log instant with
 * `eventKind` `thought-process`, and the Tracking log shelves it under Thought.
 * A chosen location is a Location-scope instant at the same minute.
 *
 * Cycle marks and phase come from `lib/cycle-marks.ts` and `lib/cycle-phase.ts`.
 * `writeCycleDayMark` calls `setCycleFlag`. Spotting is stored and does not
 * change the phase.
 */
import { runAsAction } from "@/lib/action-history"
import { setCycleFlag, useCycleMarksStore, type CycleDayMark, type CycleFlag } from "@/lib/cycle-marks"
import type { CyclePhase } from "@/lib/cycle-phase"
import { applyNote } from "@/lib/ingest/apply-note"
import { applyScopeSwitch, applyThoughtProcess, ensureLocationPen, THOUGHT_PROCESS_KIND } from "@/lib/ingest/apply-discrete-event"
import { stablePenColor, useTimeTrackingStore, type TimeEntry } from "@/lib/time-tracking-store"
import {
  entryClockCertainty,
  eventKindSlug,
  minutesToLabel,
  type IntakeClass,
  type TrackingClockCertainty,
} from "@/lib/time-entries"

export { phaseForDate } from "@/lib/cycle-phase"
export { readCycleMarks } from "@/lib/cycle-marks"
export { eventKindSlug }
export { ensureLocationPen }
export { THOUGHT_PROCESS_KIND }

export const ACTIVITY_SCOPE_ID = "activity"
export const LOCATION_SCOPE_ID = "location"
export const INTAKE_PEN_NAME = "Intake"
export const TEXT_LOG_PEN_NAME = "Text log"
/** Same pen `st:` / `applySwitchTask` paints. */
export const SWITCH_PEN_NAME = "Switch"
/** Same pen `so:` / `applySwitchObjective` paints. */
export const OBJECTIVE_PEN_NAME = "Objective"
/** Placeholder minute for an unknown clock. The log hides it; it is not an observed time. */
export const UNKNOWN_CLOCK_MINUTE = 0

export type { CycleDayMark, CyclePhase, IntakeClass }
export type ClockCertainty = TrackingClockCertainty
export type LogList = IntakeClass | "intake" | "event"
/** Composer modes. Intake still stores food / drink / drug; it is not a fifth list. */
export type LogComposerMode = "event" | "switch" | "intake" | "note" | "thought"
export type LogAddTarget = IntakeClass | "event"
export type LogClockChoice = ClockCertainty
export type LogTimeEntry = TimeEntry
/** Event list plus Switch and Thought. Notes stay on `event` because they use Text log. */
export type LogBookList = LogList | "switch" | "thought"

export type ClassifiedLogEntry = LogTimeEntry & {
  list: LogList
  kindKey: string
}

export type LogBookEntry = LogTimeEntry & {
  list: LogBookList
  kindKey: string
}

type CycleMarkPatch = Partial<Pick<CycleDayMark, CycleFlag>>

/** Writes each flag in the patch through `setCycleFlag`. */
export function writeCycleDayMark(date: string, patch: CycleMarkPatch): void {
  for (const flag of ["bleeding", "spotting", "ovulation"] as const) {
    if (patch[flag] !== undefined) setCycleFlag(date, flag, Boolean(patch[flag]))
  }
}

export function useLogCycleMarks(): {
  marksByDate: Record<string, CycleDayMark>
  writeCycleDayMark: (date: string, patch: CycleMarkPatch) => void
} {
  const marksByDate = useCycleMarksStore((s) => s.marks)
  return { marksByDate, writeCycleDayMark }
}

/** Tests: drop in-memory cycle marks. `resetAllStores` does this too. */
export function resetLogCycleMarks(): void {
  useCycleMarksStore.setState({ marks: {} })
}

export function asLogEntry(entry: TimeEntry): LogTimeEntry {
  return entry
}

function intakeListFromKind(kind: string | undefined): LogList | null {
  if (kind === "intake.food") return "food"
  if (kind === "intake.drink") return "drink"
  if (kind === "intake.drug") return "drug"
  if (kind === "intake") return "intake"
  return null
}

export function classifyLogInstant(entry: LogTimeEntry, penName?: string): ClassifiedLogEntry | null {
  if (entry.kind !== "instant" || entry.scopeId !== ACTIVITY_SCOPE_ID) return null
  const pen = (penName ?? "").trim().toLowerCase()
  const kind = entry.eventKind?.trim()
  const fromKind = intakeListFromKind(kind)
  const intake = entry.intakeClass
  if (intake === "food" || intake === "drink" || intake === "drug") {
    return { ...entry, list: intake, kindKey: kind || `intake.${intake}` }
  }
  if (fromKind === "food" || fromKind === "drink" || fromKind === "drug") {
    return { ...entry, list: fromKind, kindKey: kind || `intake.${fromKind}` }
  }
  if (kind && kind !== "intake") {
    return { ...entry, list: "event", kindKey: kind }
  }
  if (pen === TEXT_LOG_PEN_NAME.toLowerCase()) {
    return { ...entry, list: "event", kindKey: eventKindSlug(entry.title ?? "") || "event" }
  }
  if (fromKind === "intake" || pen === INTAKE_PEN_NAME.toLowerCase()) {
    return { ...entry, list: "intake", kindKey: "intake" }
  }
  return null
}

/**
 * Tracking-log shelves. Food, drink, drug, bare intake, and events stay on
 * `classifyLogInstant` (analytics uses that). Switch is one extra shelf:
 * the Switch pen, the Objective pen, and a `switchTo` instant on another scope.
 * A Text log note is already an event there, so it is not listed twice.
 * A thought process (`eventKind` `thought-process`) is its own shelf.
 */
export function classifyLogBookRow(entry: LogTimeEntry, penName?: string): LogBookEntry | null {
  if (
    entry.kind === "instant" &&
    entry.scopeId === ACTIVITY_SCOPE_ID &&
    entry.eventKind?.trim() === THOUGHT_PROCESS_KIND
  ) {
    return { ...entry, list: "thought", kindKey: THOUGHT_PROCESS_KIND }
  }
  const listed = classifyLogInstant(entry, penName)
  if (listed) return listed
  if (entry.kind !== "instant") return null
  const pen = (penName ?? "").trim().toLowerCase()
  if (entry.scopeId === ACTIVITY_SCOPE_ID && pen === SWITCH_PEN_NAME.toLowerCase()) {
    return { ...entry, list: "switch", kindKey: entry.eventKind?.trim() || "switch-task" }
  }
  if (entry.scopeId === ACTIVITY_SCOPE_ID && pen === OBJECTIVE_PEN_NAME.toLowerCase()) {
    return { ...entry, list: "switch", kindKey: entry.eventKind?.trim() || "switch-objective" }
  }
  if (entry.switchTo?.trim()) {
    return { ...entry, list: "switch", kindKey: entry.eventKind?.trim() || "switch" }
  }
  return null
}

/** Log line for a switch: `from → to`, or the destination. Objective rows keep that word. */
export function switchLogCopy(entry: Pick<LogTimeEntry, "title" | "switchFrom" | "switchTo">, penName?: string): string {
  const from = entry.switchFrom?.trim()
  const to = entry.switchTo?.trim()
  const objective = (penName ?? "").trim().toLowerCase() === OBJECTIVE_PEN_NAME.toLowerCase()
  if (objective) {
    if (from && to) return `${from} → objective ${to}`
    if (to) return `objective ${to}`
    const title = entry.title?.trim()
    if (title) return title
  }
  if (from && to) return `${from} → ${to}`
  if (to) return to
  const title = entry.title?.trim() ?? ""
  const stopped = /^stopped (.+) · started (.+)$/.exec(title)
  if (stopped) return `${stopped[1]} → ${stopped[2]}`
  const started = /^started (.+)$/.exec(title)
  if (started) return started[1]!
  const left = /^left (.+) · objective (.+)$/.exec(title)
  if (left) return `${left[1]} → objective ${left[2]}`
  const objectiveTitle = /^objective (.+)$/.exec(title)
  if (objectiveTitle) return `objective ${objectiveTitle[1]}`
  return title || "Untitled"
}

export function compareLogRows(a: LogTimeEntry, b: LogTimeEntry): number {
  const aUnknown = entryClockCertainty(a) === "unknown"
  const bUnknown = entryClockCertainty(b) === "unknown"
  if (aUnknown !== bUnknown) return aUnknown ? 1 : -1
  if (a.startMin !== b.startMin) return a.startMin - b.startMin
  return (a.title ?? "").localeCompare(b.title ?? "")
}

/** Clock when the certainty is exact or omitted; Estimated keeps its clock; Unknown hides the minute. */
export function logClockLabel(entry: Pick<LogTimeEntry, "startMin" | "clockCertainty">): {
  time?: string
  badge?: "Estimated" | "Unknown"
} {
  const certainty = entryClockCertainty(entry)
  if (certainty === "unknown") return { badge: "Unknown" }
  const time = minutesToLabel(entry.startMin)
  if (certainty === "estimated") return { time, badge: "Estimated" }
  return { time }
}

function ensureActivityPen(name: string): string {
  const store = useTimeTrackingStore.getState()
  const scope = store.scopes.find((s) => s.id === ACTIVITY_SCOPE_ID)
  if (!scope) return ""
  const existing = scope.pens.find((pen) => pen.name.toLowerCase() === name.toLowerCase())
  if (existing) return existing.id
  return store.addPen(ACTIVITY_SCOPE_ID, { name, color: stablePenColor(name) })
}

/** Paint one Activity instant, including `eventKind` / `intakeClass` / `clockCertainty`. */
export function paintLogInstant(input: {
  date: string
  title: string
  target: LogAddTarget
  clock: LogClockChoice
  minute: number
}): string | null {
  const title = input.title.trim()
  if (!title) return null
  const penId = ensureActivityPen(input.target === "event" ? TEXT_LOG_PEN_NAME : INTAKE_PEN_NAME)
  if (!penId) return null
  const minute = input.clock === "unknown" ? UNKNOWN_CLOCK_MINUTE : input.minute
  const eventKind = input.target === "event" ? eventKindSlug(title) : `intake.${input.target}`
  const before = new Set(useTimeTrackingStore.getState().entries.map((entry) => entry.id))
  useTimeTrackingStore.getState().paintMinutes(
    input.date,
    ACTIVITY_SCOPE_ID,
    minute,
    minute,
    penId,
    undefined,
    undefined,
    input.clock === "estimated" ? "estimated" : undefined,
    {
      kind: "instant",
      title,
      ...(eventKind ? { eventKind } : {}),
      ...(input.target === "event" ? {} : { intakeClass: input.target }),
      ...(input.clock === "exact" ? {} : { clockCertainty: input.clock }),
    },
  )
  const created = useTimeTrackingStore
    .getState()
    .entries.find((entry) => !before.has(entry.id) && entry.kind === "instant" && entry.date === input.date)
  return created?.id ?? null
}

function dateAtMinute(dateKey: string, minute: number): Date {
  const [year, month, day] = dateKey.split("-").map(Number)
  const at = Number.isFinite(minute) ? Math.max(0, Math.floor(minute)) : 0
  return new Date(year, (month ?? 1) - 1, day ?? 1, Math.floor(at / 60), at % 60, 0, 0)
}

function newestInstant(before: Set<string>, date: string): string | null {
  const created = useTimeTrackingStore
    .getState()
    .entries.filter((entry) => !before.has(entry.id) && entry.kind === "instant" && entry.date === date)
  return created[created.length - 1]?.id ?? null
}

/** Composer clock wins. Estimated also sets `precision`. Unknown stays on the placeholder minute. */
function stampComposerClock(id: string, clock: LogClockChoice, minute: number): void {
  const at = clock === "unknown" ? UNKNOWN_CLOCK_MINUTE : minute
  const entry = useTimeTrackingStore.getState().entries.find((row) => row.id === id)
  if (!entry) return
  const patch: Partial<Omit<TimeEntry, "id">> = {}
  if (entry.startMin !== at || entry.endMin !== at) {
    patch.startMin = at
    patch.endMin = at
  }
  if (clock !== "exact") patch.clockCertainty = clock
  if (patch.clockCertainty || patch.startMin !== undefined) {
    useTimeTrackingStore.getState().updateEntry(id, patch)
  }
}

/**
 * Location attached to one event: a Location-scope instant at that minute.
 * The grid already draws those ticks. It does not repaint the rest of the day.
 */
function paintPairedLocation(date: string, minute: number, penId: string, clock: LogClockChoice): void {
  const at = clock === "unknown" ? UNKNOWN_CLOCK_MINUTE : minute
  useTimeTrackingStore.getState().paintMinutes(
    date,
    LOCATION_SCOPE_ID,
    at,
    at,
    penId,
    undefined,
    undefined,
    clock === "estimated" ? "estimated" : undefined,
    {
      kind: "instant",
      ...(clock === "exact" ? {} : { clockCertainty: clock }),
    },
  )
}

/**
 * One composer submit. Event and intake stay on `paintLogInstant`.
 * Switch calls `applyScopeSwitch`: Activity is the `st:` instant; any other
 * view is an instant on that scope’s pens. Note calls `applyNote` (Text log
 * instant, not the day jot, unless the phrase is already a `day:` note).
 * Thought calls `applyThoughtProcess` on that same paint path, with
 * `eventKind` `thought-process`.
 */
export function submitTrackingLog(input: {
  date: string
  title: string
  mode: LogComposerMode
  intakeClass?: IntakeClass
  clock: LogClockChoice
  minute: number
  locationPenId?: string
  switchFrom?: string
  switchTo?: string
  /** Tracking scope id. Omitted on Switch means Activity. */
  scopeId?: string
}): string | null {
  const title = input.title.trim()
  const switchTo = (input.switchTo ?? "").trim()
  if (input.mode === "switch") {
    if (!switchTo && !title) return null
  } else if (!title) return null
  if (input.clock !== "unknown" && !Number.isFinite(input.minute)) return null
  return runAsAction("tracking log", () => {
    if (input.mode === "event" || input.mode === "intake") {
      const id = paintLogInstant({
        date: input.date,
        title,
        target: input.mode === "event" ? "event" : (input.intakeClass ?? "food"),
        clock: input.clock,
        minute: input.minute,
      })
      if (id && input.mode === "event" && input.locationPenId) {
        paintPairedLocation(input.date, input.minute, input.locationPenId, input.clock)
      }
      return id
    }
    const at = dateAtMinute(input.date, input.clock === "unknown" ? UNKNOWN_CLOCK_MINUTE : input.minute)
    const before = new Set(useTimeTrackingStore.getState().entries.map((entry) => entry.id))
    if (input.mode === "switch") {
      const to = switchTo || title
      const from = input.switchFrom?.trim()
      const payload = from ? `from: ${from} to: ${to}` : to
      const result = applyScopeSwitch(payload, input.scopeId || ACTIVITY_SCOPE_ID, at)
      if (result.status !== "ok") return null
    } else if (input.mode === "thought") {
      const result = applyThoughtProcess(title, at)
      if (result.status !== "ok") return null
    } else {
      const result = applyNote(title, at)
      if (result.status !== "ok") return null
    }
    const id = newestInstant(before, input.date)
    if (!id) return null
    stampComposerClock(id, input.clock, input.minute)
    return id
  })
}
