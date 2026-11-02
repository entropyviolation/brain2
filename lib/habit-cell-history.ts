/**
 * lib/habit-cell-history.ts — Per-cell change log
 *
 * Every write to a habit cell appends one `HabitCellChange` to
 * `TaskCompletion.changes` when the cell's reading, missed mark, or missed
 * reason moved. The reading is what the cell shows: the check (Yes/No), the
 * number (Goal, Climb), or the words (Text). A write that changes none of
 * those (a repaint, a stamp) adds nothing. Only the newest 50 entries stay.
 * Old cells have no history.
 *
 * The source is decided at the write call. A person is `manual-ios` inside the
 * phone shell (`.cogs-mobile-app`, as `components/Mobile/use-in-mobile-shell.ts`
 * checks) and `manual-desktop` otherwise. Syncs pass their own source.
 */
import { normalizeTaskType, isGoalType } from "./habit-utils"
import {
  TaskType,
  type HabitCellChange,
  type HabitCellChangeSource,
  type TaskCompletion,
  type WeeklyTask,
} from "./types"

export const HABIT_CELL_HISTORY_LIMIT = 50

type Reading = number | boolean | string | null

/** What the cell shows: the check, the number, or the words. */
export function cellReading(task: Pick<WeeklyTask, "type">, cell: TaskCompletion | undefined): Reading {
  const type = normalizeTaskType(task.type)
  if (type === TaskType.BOOLEAN) return !!cell?.completed
  if (type === TaskType.TEXT) return cell?.text?.trim() ? cell.text : null
  if (isGoalType(type) || type === TaskType.INCREMENTAL) {
    return typeof cell?.value === "number" && Number.isFinite(cell.value) ? cell.value : null
  }
  return cell?.value ?? null
}

/** The phone shell is mounted. Server and tests without it read as desktop. */
export function manualCellSource(): HabitCellChangeSource {
  if (typeof document === "undefined") return "manual-desktop"
  return document.querySelector(".cogs-mobile-app") != null ? "manual-ios" : "manual-desktop"
}

/** A patch that only marks or explains a missed opportunity comes from the missed op wand. */
export function isMissedOpPatch(patch: TaskCompletion): boolean {
  const keys = Object.keys(patch).filter((key) => key !== "updatedAt" && key !== "changes")
  return keys.length > 0 && keys.every((key) => key === "missedOpportunity" || key === "missReason")
}

/** `source` when the caller named one, else the wand for missed marks, else the person. */
export function resolveCellSource(patch: TaskCompletion, source?: HabitCellChangeSource): HabitCellChangeSource {
  if (source) return source
  return isMissedOpPatch(patch) ? "wand" : manualCellSource()
}

/** The change this write made, or null when the cell reads the same. */
export function describeCellChange(
  task: Pick<WeeklyTask, "type">,
  previous: TaskCompletion | undefined,
  next: TaskCompletion,
  source: HabitCellChangeSource,
  at: Date = new Date(),
): HabitCellChange | null {
  const iso = at.toISOString()
  const from = cellReading(task, previous)
  const to = cellReading(task, next)
  if (from !== to) return { at: iso, source, from, to }
  const wasMissed = !!previous?.missedOpportunity
  const isMissed = !!next.missedOpportunity
  if (wasMissed !== isMissed) {
    const reason = next.missReason?.trim()
    return {
      at: iso,
      source,
      from: wasMissed,
      to: isMissed,
      note: isMissed ? (reason ? `missed: ${reason}` : "missed") : "missed cleared",
    }
  }
  const fromReason = previous?.missReason?.trim() || null
  const toReason = next.missReason?.trim() || null
  if (fromReason !== toReason) {
    return { at: iso, source, from: fromReason, to: toReason, note: toReason ? `missed: ${toReason}` : "missed reason cleared" }
  }
  return null
}

/** Append and keep the newest `HABIT_CELL_HISTORY_LIMIT`. */
export function appendCellChange(
  history: HabitCellChange[] | undefined,
  change: HabitCellChange,
): HabitCellChange[] {
  const list = Array.isArray(history) ? [...history, change] : [change]
  return list.length > HABIT_CELL_HISTORY_LIMIT ? list.slice(list.length - HABIT_CELL_HISTORY_LIMIT) : list
}

/** `next` with this write's change appended to the previous cell's history. */
export function withCellHistory(
  task: Pick<WeeklyTask, "type">,
  previous: TaskCompletion | undefined,
  next: TaskCompletion,
  source: HabitCellChangeSource,
  at: Date = new Date(),
): TaskCompletion {
  const change = describeCellChange(task, previous, next, source, at)
  const base = Array.isArray(previous?.changes) ? previous.changes : undefined
  if (!change) return base ? { ...next, changes: base } : next
  return { ...next, changes: appendCellChange(base, change) }
}

/** The wand waived or required this period. The cell may not exist yet. */
export function withExemptionChange(
  cell: TaskCompletion | undefined,
  wasExempt: boolean,
  exempt: boolean,
  source: HabitCellChangeSource = "wand",
  at: Date = new Date(),
): TaskCompletion | null {
  if (wasExempt === exempt) return null
  const change: HabitCellChange = {
    at: at.toISOString(),
    source,
    from: wasExempt,
    to: exempt,
    note: exempt ? "exempt" : "required",
  }
  return { ...cell, changes: appendCellChange(cell?.changes, change) }
}
