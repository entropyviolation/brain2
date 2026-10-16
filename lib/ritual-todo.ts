/**
 * lib/ritual-todo.ts — Which ritual belongs on which To Do day
 *
 * Home → To Do (the day lens) lists each calendar-anchored rite on the day it
 * belongs to. The row is derived. It is not a stored task, so Push, Delete,
 * and Missed do not move it. Opening the row opens the rite. Submitting the
 * rite is what marks the row done.
 *
 * Week boundary: Monday starts the week and Sunday ends it. That is already
 * `getWeekString` (Monday–Sunday). To Do uses that week, not an ISO week
 * number. End of week is the Sunday inside the week key. Start of week is
 * the Monday that opens it.
 *
 * The Rituals menu is a different job. It keeps the current period's start
 * available all period, the just-ended review after the period closes, and
 * one extra day for yesterday's night and an undone Star Lord report. To Do
 * does not repeat a rite on those later days.
 *
 * There is no civil 15th rite. The mid-month rite is the full-moon Star Lord
 * report, on the local day that contains the full moon. The new-moon Star
 * Lord report is the lunar month's opening, separate from Start of month on
 * the civil 1st. A birthday on a moon day is two rites. A Feb 29 birthday
 * falls on March 1 in a common year, the same rule as `isBirthday`.
 *
 * No other weekday schedule exists. Morning and Night are the daily rites.
 * Monday is Start of week. Sunday is End of week.
 *
 * Season is the calendar quarter (Q1 Spring through Q4 Winter). A day can
 * carry more than one rite: 1 January is Morning, Night, Start of month,
 * Start of season, and Start of year.
 *
 * Week, month, and season lenses stay the task lists they already are. A
 * month of mornings would bury that list. The rite lives on its day.
 */
import type { PeriodReview, ReviewPeriod, Task } from "@/lib/types"
import { getWeekString } from "@/lib/date-utils"
import { lunarOccasion } from "@/lib/lunar"
import { endRitualPhase, startRitualPhase, type RitualSlot } from "@/lib/rituals"
import { getPeriodKey, localDayKey, morningReviewPhase } from "@/lib/reviews-store"
import { quarterKey } from "@/lib/seasons"
import {
  STAR_LORD_RITUALS,
  isBirthday,
  starLordPhase,
  starLordReportId,
  type StarLordKind,
  type StarLordReport,
  type StarLordSlot,
} from "@/lib/star-lord"

export const RITUAL_TODO_PREFIX = "ritual-todo:"

export type RitualTodoKind =
  | "day-morning"
  | "day-night"
  | "week-start"
  | "week-end"
  | "month-start"
  | "month-end"
  | "quarter-start"
  | "quarter-end"
  | "year-start"
  | "year-end"
  | "star-lord"

export type RitualTodoWalk =
  | { type: "morning" }
  | { type: "end"; period: ReviewPeriod; periodKey: string }
  | { type: "start"; period: Exclude<ReviewPeriod, "day">; periodKey: string }
  | { type: "star-lord"; occasion: StarLordKind; dateKey: string }

export interface RitualTodoPlacement {
  id: string
  title: string
  kind: RitualTodoKind
  /** Local noon on the calendar day this rite belongs to. */
  date: Date
  dateKey: string
  walk: RitualTodoWalk
}

export function isRitualTodoId(id: string | null | undefined): boolean {
  return !!id && id.startsWith(RITUAL_TODO_PREFIX)
}

function noon(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate(), 12, 0, 0)
}

function lastDateOfMonth(date: Date): number {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate()
}

function placementId(kind: string, key: string): string {
  return `${RITUAL_TODO_PREFIX}${kind}:${key}`
}

function daily(
  kind: "day-morning" | "day-night",
  title: string,
  day: Date,
  dateKey: string,
): RitualTodoPlacement {
  return {
    id: placementId(kind, dateKey),
    title,
    kind,
    date: day,
    dateKey,
    walk: kind === "day-morning" ? { type: "morning" } : { type: "end", period: "day", periodKey: dateKey },
  }
}

function periodRite(
  kind: RitualTodoKind,
  title: string,
  phase: "start" | "end",
  period: Exclude<ReviewPeriod, "day">,
  periodKey: string,
  day: Date,
  dateKey: string,
): RitualTodoPlacement {
  return {
    id: placementId(kind, periodKey),
    title,
    kind,
    date: day,
    dateKey,
    walk: phase === "start" ? { type: "start", period, periodKey } : { type: "end", period, periodKey },
  }
}

function starLordRite(occasion: StarLordKind, day: Date, dateKey: string): RitualTodoPlacement {
  const name = STAR_LORD_RITUALS[occasion].title
  return {
    id: placementId(`star-lord:${occasion}`, dateKey),
    title: `Star Lord ritual · ${name}`,
    kind: "star-lord",
    date: day,
    dateKey,
    walk: { type: "star-lord", occasion, dateKey },
  }
}

function dayFromKey(dateKey: string): Date {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateKey)
  return m ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]), 12, 0, 0) : noon(new Date())
}

/**
 * The walk behind a Rituals menu slot (`listAvailableRituals`), so a caller
 * can open that rite directly with `RitualWalkDialog`. Day slots carry the
 * day key; week to year slots carry their period key. The walk does not
 * read the calendar date of a period slot, so that is today.
 */
export function ritualSlotPlacement(slot: RitualSlot): RitualTodoPlacement {
  if (slot.period === "day") {
    const day = dayFromKey(slot.periodKey)
    const kind = slot.kind === "day-morning" ? "day-morning" : "day-night"
    return daily(kind, slot.title, day, slot.periodKey)
  }
  const period = slot.period
  const phase = slot.phase === "start" ? "start" : "end"
  const kind = `${period}-${phase}` as RitualTodoKind
  const day = noon(new Date())
  return periodRite(kind, `${slot.title} · ${slot.periodTitle}`, phase, period, slot.periodKey, day, localDayKey(day))
}

/** The walk behind a Star Lord slot (`listAvailableStarLordSlots`). */
export function starLordSlotPlacement(slot: StarLordSlot): RitualTodoPlacement {
  return starLordRite(slot.kind, dayFromKey(slot.dateKey), slot.dateKey)
}

/**
 * Every rite that lands on this local calendar day, in reading order:
 * Morning, Night, then the period anchors, then Star Lord.
 */
export function ritualsOnCalendarDay(date: Date, birthday?: string | null): RitualTodoPlacement[] {
  const day = noon(date)
  const dateKey = localDayKey(day)
  const dow = day.getDay()
  const month = day.getMonth()
  const dom = day.getDate()
  const rites: RitualTodoPlacement[] = [
    daily("day-morning", "Morning ritual", day, dateKey),
    daily("day-night", "Night ritual", day, dateKey),
  ]

  if (dow === 1) {
    rites.push(
      periodRite("week-start", "Start of week ritual", "start", "week", getWeekString(day), day, dateKey),
    )
  }
  if (dow === 0) {
    rites.push(periodRite("week-end", "End of week ritual", "end", "week", getWeekString(day), day, dateKey))
  }

  if (dom === 1) {
    rites.push(periodRite("month-start", "Start of month ritual", "start", "month", getPeriodKey("month", day), day, dateKey))
    if (month % 3 === 0) {
      rites.push(periodRite("quarter-start", "Start of season ritual", "start", "quarter", quarterKey(day), day, dateKey))
    }
    if (month === 0) {
      rites.push(periodRite("year-start", "Start of year ritual", "start", "year", String(day.getFullYear()), day, dateKey))
    }
  }

  if (dom === lastDateOfMonth(day)) {
    rites.push(periodRite("month-end", "End of month ritual", "end", "month", getPeriodKey("month", day), day, dateKey))
    if (month === 2 || month === 5 || month === 8 || month === 11) {
      rites.push(periodRite("quarter-end", "End of season ritual", "end", "quarter", quarterKey(day), day, dateKey))
    }
    if (month === 11) {
      rites.push(periodRite("year-end", "End of year ritual", "end", "year", String(day.getFullYear()), day, dateKey))
    }
  }

  const moon = lunarOccasion(day)
  if (moon) rites.push(starLordRite(moon, day, dateKey))
  if (isBirthday(day, birthday)) rites.push(starLordRite("birth", day, dateKey))

  return rites
}

export function ritualTodoPhase(
  placement: RitualTodoPlacement,
  reviews: readonly PeriodReview[],
  reports: readonly StarLordReport[],
): "none" | "partial" | "done" {
  const walk = placement.walk
  if (walk.type === "morning") {
    const review = reviews.find((row) => row.period === "day" && row.periodKey === placement.dateKey)
    return morningReviewPhase(review?.morning)
  }
  if (walk.type === "star-lord") {
    const report = reports.find((row) => row.id === starLordReportId(walk.occasion, walk.dateKey))
    return starLordPhase(report)
  }
  const review = reviews.find((row) => row.period === walk.period && row.periodKey === walk.periodKey)
  return walk.type === "start" ? startRitualPhase(review?.start) : endRitualPhase(review)
}

/** A display task for the day lens. Not written to the task store. */
export function ritualTodoTask(
  placement: RitualTodoPlacement,
  phase: "none" | "partial" | "done",
): Task {
  const done = phase === "done"
  return {
    id: placement.id,
    title: placement.title,
    description: placement.title,
    type: "task",
    stage: done ? "completed" : "scheduled",
    createdAt: placement.date,
    completed: done,
    completedDate: done ? placement.date : undefined,
    status: done ? "done" : phase === "partial" ? "partial" : "active",
    scheduledDate: placement.date,
    lists: [],
    urgency: 4,
    importance: 4,
    dependencies: [],
    hiddenFromTodo: false,
  }
}

export interface RitualDayBoard {
  placements: RitualTodoPlacement[]
  tasks: Task[]
  byId: Map<string, RitualTodoPlacement>
}

export function ritualDayBoard(
  date: Date,
  reviews: readonly PeriodReview[],
  reports: readonly StarLordReport[] = [],
  birthday?: string | null,
): RitualDayBoard {
  const placements = ritualsOnCalendarDay(date, birthday)
  const tasks = placements.map((placement) =>
    ritualTodoTask(placement, ritualTodoPhase(placement, reviews, reports)),
  )
  return {
    placements,
    tasks,
    byId: new Map(placements.map((placement) => [placement.id, placement])),
  }
}

/** Stand-in sunset (6:00 PM, minutes after midnight) when the sun cannot be computed. */
export const FALLBACK_SUNSET_MINUTES = 18 * 60

/**
 * Rites follow the sun (To Do Phase 8). On today's day lens only:
 * - **Night ritual** waits until sunset;
 * - **Morning ritual** goes at sunset while it is not done.
 * A started or done rite, and any other day, is never hidden.
 */
export function ritualHiddenAt(
  placement: Pick<RitualTodoPlacement, "kind" | "dateKey">,
  now: Date,
  sunsetMinutes: number | null | undefined,
  phase: "none" | "partial" | "done",
): boolean {
  if (placement.kind !== "day-morning" && placement.kind !== "day-night") return false
  if (phase !== "none") return false
  if (placement.dateKey !== localDayKey(now)) return false
  const sunset = sunsetMinutes != null && Number.isFinite(sunsetMinutes) ? sunsetMinutes : FALLBACK_SUNSET_MINUTES
  const afterSunset = now.getHours() * 60 + now.getMinutes() >= sunset
  return placement.kind === "day-night" ? !afterSunset : afterSunset
}

/** The board without the rites `ritualHiddenAt` hides. `byId` keeps every rite, so an open walk still resolves. */
export function ritualBoardFollowingSun(
  board: RitualDayBoard,
  now: Date,
  sunsetMinutes: number | null | undefined,
): RitualDayBoard {
  const hidden = new Set(
    board.placements
      .filter((placement, i) => {
        const task = board.tasks[i]
        const phase = task?.completed ? "done" : task?.status === "partial" ? "partial" : "none"
        return ritualHiddenAt(placement, now, sunsetMinutes, phase)
      })
      .map((placement) => placement.id),
  )
  if (hidden.size === 0) return board
  return {
    placements: board.placements.filter((p) => !hidden.has(p.id)),
    tasks: board.tasks.filter((t) => !hidden.has(t.id)),
    byId: board.byId,
  }
}
