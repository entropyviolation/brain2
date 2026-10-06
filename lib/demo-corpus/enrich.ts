/**
 * lib/demo-corpus/enrich.ts — Fold the fiction corpus into the stock Demo seed
 *
 * Base rows (River's inbox, the kiln operation, the uniform habit grid) stay.
 * This adds the graph, the pens, the week texture, and then asks
 * `coverCurrentWeek` to patch any day of this week that is still empty.
 */

import { formatLocalDateKey } from "@/lib/date-utils"
import type { PlannedAction } from "@/lib/planned-actions"
import type { Folder, Goal, List, Objective, PeriodReview, Task } from "@/lib/types"
import type { TimeEntry } from "@/lib/time-entries"
import type { TrackScope, TrackTag } from "@/lib/time-tracking-store"
import { coverCurrentWeek } from "@/lib/demo-corpus/cover-week"
import {
  demoAgenda,
  demoEvents,
  demoPlanLogs,
  demoSleepNotes,
  deepenHabitDays,
  deepenObjectives,
  deepenReviews,
  extraGoals,
} from "@/lib/demo-corpus/periods"
import { demoTags, demoTracking, withDemoPens } from "@/lib/demo-corpus/tracking"
import { deepenBaseTasks, deepenLists, extraFolders, extraLists, extraTasks, weekCommitments } from "@/lib/demo-corpus/world"

type HabitCell = {
  completed?: boolean
  value?: number
  goal?: number
  text?: string
  incrementalValues?: Record<string, number>
  trackedValue?: number
  manualValue?: number
  trackedCompleted?: boolean
  coverageCompleted?: boolean
  updatedAt?: string
}

type SleepNight = { date: string; sleptMin: number; wokeMin: number; precision?: string; note?: string }

export interface DemoSeedInput {
  now: Date
  tasks: Task[]
  lists: List[]
  folders: Folder[]
  entries: TimeEntry[]
  scopes: TrackScope[]
  tags: TrackTag[]
  actions: PlannedAction[]
  events: Array<Record<string, unknown>>
  reviews: PeriodReview[]
  objectives: Objective[]
  goals: Goal[]
  weeklyData: Record<string, Record<string, HabitCell>>
  nights: Record<string, SleepNight>
}

export interface DemoSeed extends DemoSeedInput {
  weeklyData: Record<string, Record<string, HabitCell>>
  dayNotes: Record<string, string>
  untrackedNotes: Record<string, string>
  /** Logical plan-text keys (`dayPlan-…`, `weekPlan-…`, …). */
  plans: Record<string, string>
  extraPoints: Array<{ date: string; taskId: string; points: number; taskDescription: string }>
  extraRegrets: Array<{ date: string; taskId: string; regret: number; taskDescription: string; reason: string }>
}

export function enrichDemoSeed(input: DemoSeedInput): DemoSeed {
  const tasks = [
    ...deepenBaseTasks(input.tasks, input.now),
    ...extraTasks(input.now),
    ...weekCommitments(input.now),
  ]
  const lists = [...deepenLists(input.lists), ...extraLists(input.now)]
  const folders = [...input.folders, ...extraFolders(input.now)]
  const tracking = demoTracking(input.now)
  const entries = [...input.entries, ...tracking.entries]
  const actions = [...input.actions, ...demoAgenda(input.now, input.actions)]
  const plans = demoPlanLogs(input.now)
  const events = [...input.events, ...demoEvents(input.now)]
  const reviews = deepenReviews(input.reviews, input.now)
  const objectives = deepenObjectives(input.objectives, input.now)
  const goals = [...input.goals, ...extraGoals(input.now)]
  const weeklyData = deepenHabitDays(input.weeklyData, input.now)
  const nights = demoSleepNotes(input.nights, input.now)
  const scopes = withDemoPens(input.scopes)
  const tags = demoTags(input.tags)

  const coverage = coverCurrentWeek({
    now: input.now,
    tasks,
    entries,
    actions,
    planDayKeys: plans.dayKeys,
  })

  const dateKey = formatLocalDateKey(input.now)
  return {
    ...input,
    tasks: [...tasks, ...coverage.tasks],
    lists,
    folders,
    entries: [...entries, ...coverage.entries],
    scopes,
    tags,
    actions: [...actions, ...coverage.actions],
    events,
    reviews,
    objectives,
    goals,
    weeklyData,
    nights,
    dayNotes: tracking.dayNotes,
    untrackedNotes: tracking.untrackedNotes,
    plans: { ...plans.logs, ...coverage.plans },
    extraPoints: [
      { date: dateKey, taskId: "demo-logged-pages", points: 20, taskDescription: "Read 12 pages of Cedar Stacks Circulation Manual" },
      { date: dateKey, taskId: "demo-op-press-lock", points: 30, taskDescription: "Lock up the fall-hours chase" },
    ],
    extraRegrets: [
      {
        date: dateKey,
        taskId: "demo-missed-bird",
        regret: 3,
        taskDescription: "Dawn bird count on the river path",
        reason: "no-energy",
      },
    ],
  }
}
