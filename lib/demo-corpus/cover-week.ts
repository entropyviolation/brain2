/**
 * lib/demo-corpus/cover-week.ts — Fill a bare current week
 *
 * The Demo clock follows the machine's today. A Monday vault would otherwise
 * show an empty Tue–Sun. For each day of that Monday–Sunday week, any channel
 * that has nothing yet gets one or two invented rows:
 *
 *   - plan text, and a scheduled task or agenda block, when the day is unplanned
 *   - tracked activity, when the day has no time entry
 *   - a completion, when the day is today or earlier and nothing was finished
 *
 * Picks are stable for a given date (a hash, not `Math.random`) so a re-seed
 * tells the same story. Names are the Cedar Stacks fiction — never a live vault.
 */

import { serializeAppendLog } from "@/lib/append-log"
import { formatLocalDateKey, getWeekDates, getWeekStartDate } from "@/lib/date-utils"
import { dayPlanKey } from "@/lib/plan-text"
import type { PlannedAction } from "@/lib/planned-actions"
import type { Task } from "@/lib/types"
import type { TimeEntry } from "@/lib/time-entries"

export interface WeekCoverageInput {
  now: Date
  tasks: Task[]
  entries: TimeEntry[]
  actions: PlannedAction[]
  /** Days that already have a `dayPlan-*` log. */
  planDayKeys: Set<string>
}

export interface WeekCoverage {
  tasks: Task[]
  entries: TimeEntry[]
  actions: PlannedAction[]
  /** Logical `dayPlan-YYYY-MM-DD` key → append-log JSON. */
  plans: Record<string, string>
}

const PLANNED = [
  "Sketch the fall broadside margin before the ink is mixed",
  "Walk the river path and name three birds",
  "Shelve the oversize atlases that came back from bindery",
  "Center twenty bowls and keep the ten that sit true",
  "Mend the navy cardigan cuff on the porch",
  "Write the interlibrary-loan note for the kiln manuals",
  "Proof the friends-of-the-library caption",
  "Soak the grog-bag label and log the batch",
  "Practice the Spanish market dialogue out loud",
  "Oil the letterpress rollers and park the chase",
  "Photograph the test tile in north light",
  "Draft tomorrow's desk plan in one paragraph",
]

const TRACKED = [
  { penId: "act-work", title: "Catalog a returns cart", notes: "Quiet aisle. Stopped at the oversize shelf." },
  { penId: "act-exercise", title: "River-path loop", notes: "Counted crows on the wire." },
  { penId: "act-chores", title: "Sweep the wheel splash pan", notes: "Grog in the drain again." },
  { penId: "act-rest", title: "Tea and the circulation manual", notes: "Chapter on holds." },
  { penId: "act-social", title: "Porch visit about the garden plot", notes: "Brought back a basil start." },
  { penId: "act-work", title: "Letterpress lockup on the fall hours", notes: "Furniture was short one lead." },
]

const DONE = [
  "Labeled the Saturday returns cart",
  "Threw the backup mug handles",
  "Answered the garden-plot email",
  "Filed the cone-6 test-tile photo",
  "Read a chapter of the circulation manual",
  "Oiled the press rollers",
  "Walked the river path once",
  "Mended the cardigan cuff",
  "Sent the bindery slip",
  "Wiped the wheel and covered the clay",
]

function mix(seed: string): number {
  let h = 2166136261
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

function pick<T>(pool: readonly T[], seed: string, i: number): T {
  return pool[mix(`${seed}:${i}`) % pool.length]
}

function countFor(seed: string): number {
  return (mix(seed) % 2) + 1
}

function localDay(value: Date | string | undefined): string {
  if (!value) return ""
  if (value instanceof Date) return formatLocalDateKey(value)
  if (typeof value === "string") {
    if (/^\d{4}-\d{2}-\d{2}/.test(value)) {
      const parsed = new Date(value)
      if (!Number.isNaN(parsed.getTime()) && value.includes("T")) return formatLocalDateKey(parsed)
      return value.slice(0, 10)
    }
  }
  return ""
}

function atClock(day: Date, minutes: number): Date {
  const next = new Date(day)
  next.setHours(0, 0, 0, 0)
  next.setMinutes(minutes)
  return next
}

function taskRow(partial: Partial<Task> & Pick<Task, "id" | "description">, now: Date): Task {
  const createdAt = partial.createdAt instanceof Date ? partial.createdAt : now
  const row: Task = {
    stage: "clarified",
    estimatedDuration: 40,
    cognitiveLoad: 2,
    urgency: 3,
    importance: 3,
    dependencies: [],
    context: "@anywhere",
    entropy: 0.15,
    rewardValue: 15,
    completed: false,
    lists: ["list-work"],
    allowPartialCompletion: false,
    minimumChunkSize: 15,
    type: "task",
    ...partial,
    createdAt,
  }
  row.title = row.title ?? row.description
  return row
}

/** One or two invented rows for every empty channel in the week that contains `now`. */
export function coverCurrentWeek(input: WeekCoverageInput): WeekCoverage {
  const today = formatLocalDateKey(input.now)
  const days = getWeekDates(getWeekStartDate(input.now))
  const tasks: Task[] = []
  const entries: TimeEntry[] = []
  const actions: PlannedAction[] = []
  const plans: Record<string, string> = {}

  const plannedDays = new Set(input.actions.map((action) => action.date))
  const trackedDays = new Set(input.entries.map((entry) => entry.date))
  const scheduledDays = new Set<string>()
  const completedDays = new Set<string>()
  for (const task of input.tasks) {
    const scheduled = localDay(task.scheduledDate)
    if (scheduled) scheduledDays.add(scheduled)
    if (task.completed) {
      const done = localDay(task.completedDate)
      if (done) completedDays.add(done)
    }
  }

  for (const day of days) {
    const key = formatLocalDateKey(day)
    const future = key > today

    if (!input.planDayKeys.has(key)) {
      const n = countFor(`plan:${key}`)
      const log = []
      for (let i = 0; i < n; i++) {
        log.push({
          id: `al-cov-${key}-${i}`,
          createdAt: atClock(day, 7 * 60 + i * 40).toISOString(),
          text: pick(PLANNED, `plan-text:${key}`, i),
        })
      }
      plans[dayPlanKey(key)] = serializeAppendLog(log, key === today ? "Draft: leave the desk before the light goes." : "")
    }

    if (!plannedDays.has(key) && !scheduledDays.has(key)) {
      const n = countFor(`agenda:${key}`)
      for (let i = 0; i < n; i++) {
        const start = 8 * 60 + 15 + i * 75
        const title = pick(PLANNED, `agenda:${key}`, i)
        actions.push({
          id: `demo-cov-plan-${key}-${i}`,
          date: key,
          startTime: `${String(Math.floor(start / 60)).padStart(2, "0")}:${String(start % 60).padStart(2, "0")}`,
          endTime: `${String(Math.floor((start + 40) / 60)).padStart(2, "0")}:${String((start + 40) % 60).padStart(2, "0")}`,
          title,
          notes: "Filled because this day of the week had no plan yet.",
          source: "free",
        })
        tasks.push(
          taskRow(
            {
              id: `demo-cov-sched-${key}-${i}`,
              description: title,
              lists: [i % 2 === 0 ? "list-work" : "list-studio"],
              scheduledDate: day,
              scheduledTime: `${String(Math.floor(start / 60)).padStart(2, "0")}:${String(start % 60).padStart(2, "0")}`,
              scheduledWeek: undefined,
              estimatedDuration: 40,
              context: i % 2 === 0 ? "@work" : "@studio",
            },
            input.now,
          ),
        )
      }
    }

    if (!trackedDays.has(key)) {
      const n = countFor(`track:${key}`)
      for (let i = 0; i < n; i++) {
        const block = pick(TRACKED, `track:${key}`, i)
        const start = future ? 10 * 60 + i * 90 : 15 * 60 + i * 50
        entries.push({
          id: `demo-cov-track-${key}-${i}`,
          date: key,
          scopeId: "activity",
          penId: block.penId,
          startMin: start,
          endMin: start + 40,
          title: future ? `Sketch: ${block.title}` : block.title,
          notes: block.notes,
          precision: future ? "estimated" : "definite",
        })
      }
    }

    if (!future && !completedDays.has(key)) {
      const n = countFor(`done:${key}`)
      for (let i = 0; i < n; i++) {
        const finished = atClock(day, 16 * 60 + i * 25)
        const description = pick(DONE, `done:${key}`, i)
        tasks.push(
          taskRow(
            {
              id: `demo-cov-done-${key}-${i}`,
              description,
              lists: ["list-work"],
              stage: "completed",
              completed: true,
              status: "done",
              completedDate: finished,
              startedAt: new Date(finished.getTime() - (25 + i * 10) * 60 * 1000),
              actualDuration: 25 + i * 10,
              context: "@work",
            },
            input.now,
          ),
        )
      }
    }
  }

  return { tasks, entries, actions, plans }
}
