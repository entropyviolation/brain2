/**
 * lib/miss-reason-corpus.ts — Dated why-it-didn't notes for Analytics → Reviews
 *
 * One list: push placements, missed tasks, habit cells, missed operations,
 * and ritual blocked reasons already on period reviews. Counts are by preset
 * token and by source. No clustering and no trend math.
 */
import { BLOCKED_REASON_OPTIONS, blockedReasonToken, presetIdForText, storedReasonText } from "@/lib/blocked-reason"
import { dateKeyOf, formatLocalDateKey, parseLocalDate } from "@/lib/date-utils"
import { isMissed } from "@/lib/completion-status"
import { itemTitleOrUntitled } from "@/lib/item-utils"
import type {
  BlockedReason,
  PeriodReview,
  SchedulePlacement,
  Task,
  WeeklyData,
  WeeklyTask,
} from "@/lib/types"
import type { OperationReview } from "@/lib/reviews-store"

export type MissReasonSource = "push" | "missed-task" | "habit" | "missed-op" | "ritual"

export const MISS_SOURCE_LABEL: Record<MissReasonSource, string> = {
  push: "Push",
  "missed-task": "Missed task",
  habit: "Habit",
  "missed-op": "Missed op",
  ritual: "Ritual",
}

export interface MissReasonNote {
  id: string
  /** Period key or calendar day, as stored. */
  date: string
  sortKey: string
  source: MissReasonSource
  text: string
  subject: string
  token: BlockedReason | ""
}

export interface MissReasonCorpus {
  notes: MissReasonNote[]
  tokenCounts: { id: BlockedReason; label: string; count: number }[]
  sourceCounts: { id: MissReasonSource; label: string; count: number }[]
}

const SOURCE_ORDER: MissReasonSource[] = ["push", "missed-task", "habit", "missed-op", "ritual"]

function daySpanHits(start: Date, end: Date, keySet: ReadonlySet<string>): boolean {
  const cursor = new Date(start.getFullYear(), start.getMonth(), start.getDate())
  const last = new Date(end.getFullYear(), end.getMonth(), end.getDate())
  while (cursor <= last) {
    if (keySet.has(formatLocalDateKey(cursor))) return true
    cursor.setDate(cursor.getDate() + 1)
  }
  return false
}

/** True when a stored period key overlaps the analytics day set. */
export function periodTouchesRange(label: string, keySet: ReadonlySet<string>): boolean {
  if (!label || keySet.size === 0) return false
  if (keySet.has(label)) return true
  if (/^\d{4}-\d{2}-\d{2}$/.test(label)) return keySet.has(label)
  if (/^\d{4}-\d{2}-\d{2}_\d{4}-\d{2}-\d{2}$/.test(label)) {
    const [start, end] = label.split("_")
    const from = parseLocalDate(start)
    const to = parseLocalDate(end)
    if (!from || !to) return false
    return daySpanHits(from, to, keySet)
  }
  const quarter = /^(\d{4})-Q([1-4])$/.exec(label)
  if (quarter) {
    const year = Number(quarter[1])
    const q = Number(quarter[2])
    const start = new Date(year, (q - 1) * 3, 1)
    const end = new Date(year, q * 3, 0)
    return daySpanHits(start, end, keySet)
  }
  if (/^\d{4}-\d{2}$/.test(label)) {
    const [year, month] = label.split("-").map(Number)
    if (!year || !month) return false
    return daySpanHits(new Date(year, month - 1, 1), new Date(year, month, 0), keySet)
  }
  if (/^\d{4}$/.test(label)) {
    const year = Number(label)
    return daySpanHits(new Date(year, 0, 1), new Date(year, 11, 31), keySet)
  }
  const key = dateKeyOf(label)
  return key !== null && keySet.has(key)
}

function sortKeyFor(label: string): string {
  if (/^\d{4}-\d{2}-\d{2}$/.test(label)) return label
  if (label.includes("_")) return label.split("_")[0] || label
  if (/^\d{4}-\d{2}$/.test(label)) return `${label}-01`
  const quarter = /^(\d{4})-Q([1-4])$/.exec(label)
  if (quarter) {
    const month = String((Number(quarter[2]) - 1) * 3 + 1).padStart(2, "0")
    return `${quarter[1]}-${month}-01`
  }
  if (/^\d{4}$/.test(label)) return `${label}-01-01`
  return dateKeyOf(label) ?? label
}

function pushNote(
  notes: MissReasonNote[],
  note: Omit<MissReasonNote, "id" | "sortKey"> & { sortKey?: string },
) {
  const sortKey = note.sortKey ?? sortKeyFor(note.date)
  notes.push({
    ...note,
    sortKey,
    id: `${note.source}:${note.date}:${note.subject}:${notes.length}`,
  })
}

function habitName(habits: WeeklyTask[], id: string): string {
  return habits.find((habit) => habit.id === id)?.name ?? id
}

function walkHabits(
  book: WeeklyData | undefined,
  habits: WeeklyTask[],
  keySet: ReadonlySet<string>,
  notes: MissReasonNote[],
) {
  for (const [periodKey, cells] of Object.entries(book ?? {})) {
    if (!periodTouchesRange(periodKey, keySet)) continue
    for (const [habitId, cell] of Object.entries(cells ?? {})) {
      const text = cell?.missReason?.trim()
      if (!text) continue
      pushNote(notes, {
        date: periodKey,
        source: "habit",
        text,
        subject: habitName(habits, habitId),
        token: presetIdForText(text),
      })
    }
  }
}

function placementDate(placement: SchedulePlacement): string {
  return placement.value
}

export function collectMissReasonCorpus(input: {
  tasks: Task[]
  habits: WeeklyTask[]
  weeklyData?: WeeklyData
  weeklyHabitData?: WeeklyData
  monthlyHabitData?: WeeklyData
  quarterlyHabitData?: WeeklyData
  /** Period reviews already limited to the analytics window. */
  reviewsInRange: PeriodReview[]
  operationReviews: OperationReview[]
  keySet: ReadonlySet<string>
}): MissReasonCorpus {
  const notes: MissReasonNote[] = []
  const { tasks, habits, keySet } = input
  if (keySet.size === 0) return emptyCorpus()

  for (const task of tasks) {
    const subject = itemTitleOrUntitled(task)
    for (const placement of task.schedulePlacements ?? []) {
      if (!placement.missReason) continue
      if (!periodTouchesRange(placement.value, keySet)) continue
      pushNote(notes, {
        date: placementDate(placement),
        source: "push",
        text: storedReasonText(placement.missReason),
        subject,
        token: blockedReasonToken(placement.missReason),
      })
    }
    if (isMissed(task) && task.missReason) {
      const day = dateKeyOf(task.missedAt)
      if (day && keySet.has(day)) {
        pushNote(notes, {
          date: day,
          source: "missed-task",
          text: storedReasonText(task.missReason),
          subject,
          token: blockedReasonToken(task.missReason),
        })
      }
    }
  }

  walkHabits(input.weeklyData, habits, keySet, notes)
  walkHabits(input.weeklyHabitData, habits, keySet, notes)
  walkHabits(input.monthlyHabitData, habits, keySet, notes)
  walkHabits(input.quarterlyHabitData, habits, keySet, notes)

  for (const review of input.operationReviews) {
    const day = dateKeyOf(review.completedAt)
    if (!day || !keySet.has(day)) continue
    const subject = itemTitleOrUntitled(tasks.find((task) => task.id === review.operationId) ?? { description: review.operationId })
    for (const reason of Object.values(review.blockedReasons ?? {})) {
      const text = storedReasonText(reason)
      if (!text) continue
      pushNote(notes, {
        date: day,
        source: "missed-op",
        text,
        subject,
        token: blockedReasonToken(reason),
      })
    }
  }

  for (const review of input.reviewsInRange) {
    for (const reason of Object.values(review.blockedReasons ?? {})) {
      const text = storedReasonText(reason)
      if (!text) continue
      pushNote(notes, {
        date: review.periodKey,
        source: "ritual",
        text,
        subject: review.period === "quarter" ? "Season" : review.period,
        token: blockedReasonToken(reason),
      })
    }
  }

  notes.sort((a, b) => b.sortKey.localeCompare(a.sortKey) || a.source.localeCompare(b.source) || a.subject.localeCompare(b.subject))

  const tokenMap = new Map<BlockedReason, number>()
  const sourceMap = new Map<MissReasonSource, number>()
  for (const note of notes) {
    sourceMap.set(note.source, (sourceMap.get(note.source) ?? 0) + 1)
    if (note.token) tokenMap.set(note.token, (tokenMap.get(note.token) ?? 0) + 1)
  }

  return {
    notes,
    tokenCounts: BLOCKED_REASON_OPTIONS.filter((option) => tokenMap.has(option.id)).map((option) => ({
      id: option.id,
      label: option.label,
      count: tokenMap.get(option.id) ?? 0,
    })),
    sourceCounts: SOURCE_ORDER.filter((id) => sourceMap.has(id)).map((id) => ({
      id,
      label: MISS_SOURCE_LABEL[id],
      count: sourceMap.get(id) ?? 0,
    })),
  }
}

function emptyCorpus(): MissReasonCorpus {
  return { notes: [], tokenCounts: [], sourceCounts: [] }
}
