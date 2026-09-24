/**
 * lib/habits-store.ts — Shared daily-habits store
 *
 * Single source of truth for the weekly/daily habit tracker: habit definitions
 * (`WeeklyTask`), per-day completion data (`WeeklyData`, ISO-date keyed) and habit
 * categories. Previously this lived as local component state in
 * `habit-tracker.tsx` (localStorage keys `weekly-habits-*`); promoting it to a
 * Zustand store lets the dashboard Habit Tracker AND the Lists "Daily Habits"
 * view read/write the exact same data, so marking a habit done in one place
 * updates the other. Daily habits award 50 pts × day completion (partial counts)
 * plus per-day grade bonuses (100 if either Week grade or Perfect output is 75%+,
 * 300 if both), the user accomplishment bonus when that day's raw column
 * score meets `accomplishmentThreshold` (default 80% → 50 pts), and editable
 * lift bonuses when Week grade / Perfect output beat yesterday or weekly-habit
 * grades beat last week, via `lib/habit-points.ts` / `lib/habit-accomplishment.ts`.
 * Completing a habit also writes a
 * Done-list `loggedAction` (`lib/habit-done-log.ts`).
 *
 * A Goal / Yes-No habit may also carry a `trackingLink`: tagged time from the
 * Tracking tab lands on the day, week, or month via `applyTrackedValue`, keeping
 * the manual and tracked halves of the value apart (`lib/habit-tracking.ts`).
 *
 * Persist version 21 adds `dayGradeLiftBonus` / `weeklyGradeLiftBonus`
 * (points per grade that beats yesterday, and per weekly-habit grade that
 * beats last week). 0 turns a lift off.
 * Persist version 20 adds the exemption wand: `exemptionWand` plus
 * `habitExemptions` (explicit waive / require overrides). Periods that end
 * before the habit existed are exempt without a stored flag. The day comes
 * from `createdAt`, or from a `task-{unix ms}` id when that field was never
 * written.
 * Persist version 19 adds `contentRev`, a wall-clock stamp bumped on every
 * habit title, detail, and completion write. A late hub rehydrate or a second
 * window that still holds an older snapshot cannot roll those edits back —
 * the same failure `appearanceRev` already stops for LED / tube hues.
 * Persist version 18 resets `willpowerPhysics` to the calm default whirl so
 * leftover scatter-bomb knobs do not survive a lab rewrite. Persist version 17
 * pins `habitsControlPanelWidth` back to the compact 196px (seam resize
 * retired; Physics enlarges Willpower gems). Persist version 16 added
 * `habitsControlPanelWidth`, `willpowerPhysicsHud`, and `willpowerPhysics`
 * (editable bouncing-ball knobs for Willpower gems). Persist version 15 adds
 * `habitSmallLeds` (Daily/period Yes/No lamps stay 15px when on — default; off
 * fills the spreadsheet cell). Willpower gems satellites are
 * derived from that week's completions, not a second collected-id persist.
 * Persist version 14 adds `gradeTubeColor` / `outputGradeTubeColor` (hex
 * discharge hues for Week/Span grade and Perfect output tubes).
 * Persist version 13 stamps a random catalog `WeeklyTask.gem` on habits that
 * only had a type-slot fallback (user-picked / uploaded gems are kept).
 * Persist version 12 adds `habitDayView` (Daily sheet: today + week % only)
 * and `percentLoadingBar` (10-pip channel totals; default on).
 * `hideCompletedToday` is a control-panel rocker (same boolean on Daily /
 * Weekly / Monthly; label changes). Default false; migrate fills it like the
 * other UI prefs — no persist version bump.
 * Persist version 11 adds `percentLedTint` (hex for row/column completion lamps and Yes/No cells)
 * and keeps per-habit `WeeklyTask.gem`. Persist version 10 adds `habitSortMode`
 * (default / A–Z / created / priority / weekly completion %). The old
 * `sortHabitsByPriorityFlag` migrates: true → priority, false → default.
 * `migrateHabitsState` spreads any recent persisted blob and only fills missing
 * keys — it never replaces `tasks` or completions with `[]` / `{}` because a
 * field is new, and it never replaces a present `percentLedTint` /
 * `gradeTubeColor` / `outputGradeTubeColor` with the Home overview defaults
 * (`#7e14ff` / `#508b51` / `#25366a`).
 * `appearanceRev` is bumped on each hue pick so a late hub rehydrate cannot
 * roll tubes / LEDs back to an older snapshot. `cogs-habit-led-tint` (and the
 * tube pins) are written from a successful persist of that pick; a stale pin
 * must not paint the previous purple back onto a newer blob.
 * Zustand persist writes the merge; an empty `tasks` array would
 * wipe the vault.
 * Persist version 9 adds `habitGems` (per-slot
 * photographed gems). Persist
 * version 8 adds `willpowerImage` (user-uploaded Daily Habits orb; null
 * uses the built-in default). Persist version 7 adds habit priority flags
 * (`priorityPinned` / `priorityMuted` on each task) and optional grade / Good-day
 * blend toggles (`gradeUsePriority`, `outputUsePriority`, `goodDaysUsePriority`)
 * plus UI prefs (`habitViewMode`, `sortHabitsByPriority`).
 * Persist version 6 adds `accomplishmentThreshold` / `accomplishmentBonus` (Good day).
 * Persist version 5 adds `outputGradeTolerance` for Perfect Output (elapsed row %).
 * Persist version 4 adds `gradeTolerance` for the week-grade daily curve.
 * Version 3 migrates climb habits (`lib/incremental-habits.ts`): one metric per
 * habit, logs on `TaskCompletion.value`. Legacy `weekly-habits-*` data is
 * imported once on first load.
 *
 * Spec: §9 (Habit Tracker). Storage: localStorage today; target MongoDB
 * `habits` / `habitCompletions` collections (§3).
 */
"use client"

import { create } from "zustand"
import { persist } from "zustand/middleware"
import { createCogsJSONStorage, registerPersistRehydrator } from "@/lib/persist-storage"
import { persistKey, readAliasedLocal, writeAliasedLocal } from "@/lib/storage-keys"
import { migrateHabitSortMode, type HabitSortMode } from "@/lib/habit-sort"
import {
  clampHabitsControlPanelWidth,
  HABITS_CONTROL_PANEL_DEFAULT_WIDTH,
} from "@/lib/habits-control-panel"
import {
  DEFAULT_WILLPOWER_PHYSICS,
  sanitizeWillpowerPhysics,
  type WillpowerPhysicsParams,
} from "@/lib/willpower-physics"
import { rememberWorld } from "@/lib/action-history"
import { type WeeklyTask, TaskType, type TaskCompletion, type WeeklyData, type Category, type HabitFrequency } from "@/lib/types"
import { addCalendarDays, formatLocalDateKey, formatLocalMonthKey, getWeekString, getWeekStartDate, getWeekDates, parseLocalDate } from "@/lib/date-utils"
import { usePointsStore } from "@/lib/points-store"
import { isHabitGoalMet, completionWithGoalFlag, normalizeTaskType } from "@/lib/habit-utils"
import {
  activeTrackingLink,
  applyTrackedToCompletion,
  clearTrackedFromCompletion,
  reconcileManualEntry,
} from "@/lib/habit-tracking"
import { migrateIncrementalHabits, migrateIncrementalTask } from "@/lib/incremental-habits"
import { syncHabitDoneLog } from "@/lib/habit-done-log"
import {
  calculatePeriodGrade,
  calculatePeriodOutputGrade,
  calculateWeekToDateGrade,
  calculateWeekToDateOutputGrade,
  clampGradeTolerance,
  DEFAULT_GRADE_TOLERANCE,
  weekToDateDays,
} from "@/lib/calculations"
import {
  dailyHabitDayPoints,
  dayGradeLiftTaskId,
  DEFAULT_DAY_GRADE_LIFT_BONUS,
  DEFAULT_WEEKLY_GRADE_LIFT_BONUS,
  gradeBonusDescription,
  gradeBonusPoints,
  gradeBonusTaskId,
  gradesBeatPrior,
  habitCompletionReason,
  habitDayPointTaskId,
  isDailyHabit,
  rawDayBonusDescription,
  rawDayBonusPoints,
  rawDayBonusTaskId,
  weeklyGradeLiftTaskId,
} from "@/lib/habit-points"
import {
  clampAccomplishmentBonus,
  clampAccomplishmentThreshold,
  DEFAULT_ACCOMPLISHMENT_BONUS,
  DEFAULT_ACCOMPLISHMENT_THRESHOLD,
} from "@/lib/habit-accomplishment"
import {
  blendPriorityScore,
  prioritizedHabits,
} from "@/lib/habit-priority"
import {
  ensureTaskGem,
  sanitizeHabitGems,
  seedRng,
  stampMissingTaskGems,
  type HabitGemMap,
  type HabitGemSlot,
} from "@/lib/habit-gems"
import { nextAppearanceRev, nextContentRev } from "@/lib/appearance-rev"
import {
  emptyExemptionBooks,
  exemptionBooksEmpty,
  currentExemptionContext,
  isHabitPeriodExempt,
  onAllNighterLogged,
  sanitizeExemptionBooks,
  stripTaskExemptions,
  withExemptionOverride,
  type ExemptionBooks,
} from "@/lib/habit-exemption"
import { applyAutoFlag } from "@/lib/habit-connections"
import { DEFAULT_PERCENT_LED_TINT, sanitizePercentLedTint, readSessionPercentLedTint, readStoredPercentLedTint, writeStoredPercentLedTint } from "@/lib/habit-led"
import {
  DEFAULT_GRADE_TUBE_COLOR,
  DEFAULT_OUTPUT_TUBE_COLOR,
  GRADE_TUBE_COLOR_STORAGE_KEY,
  OUTPUT_TUBE_COLOR_STORAGE_KEY,
  sanitizeTubeColor,
  readStoredTubeColor,
  writeStoredTubeColor,
} from "@/lib/habit-tube"

function migrateTaskTypes(tasks: WeeklyTask[]): WeeklyTask[] {
  return tasks.map((t) => ({
    ...t,
    type: normalizeTaskType(t.type),
    frequency: t.frequency || "daily",
  }))
}

function migratePersistedHabits(state: HabitsState): HabitsState {
  const incoming = Array.isArray(state.tasks) ? state.tasks : null
  if (!incoming) return state
  const { tasks, weeklyData } = migrateIncrementalHabits(migrateTaskTypes(incoming), asWeeklyData(state.weeklyData))
  return {
    ...state,
    tasks,
    weeklyData,
    weeklyHabitData: asWeeklyData(state.weeklyHabitData),
    monthlyHabitData: asWeeklyData(state.monthlyHabitData),
  }
}

/** Persist bump. Zustand requires `migrate` when `version` changes or it drops the blob. */
export const HABITS_STORE_PERSIST_VERSION = 21

function unwrapPersistedHabits(persisted: unknown): Record<string, unknown> {
  if (!persisted || typeof persisted !== "object") return {}
  const obj = persisted as Record<string, unknown>
  if (
    obj.state &&
    typeof obj.state === "object" &&
    !Array.isArray(obj.state) &&
    typeof obj.version === "number"
  ) {
    return { ...(obj.state as Record<string, unknown>) }
  }
  return { ...obj }
}

function asWeeklyData(value: unknown): WeeklyData {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as WeeklyData) : {}
}

/**
 * Incoming state + defaults for new keys. Never writes `tasks: []` when the
 * blob omitted `tasks` (that would persist over a real vault on the next save).
 */
export function migrateHabitsState(persisted: unknown, version: number): HabitsState {
  const state = unwrapPersistedHabits(persisted)
  const incomingTasks = Array.isArray(state.tasks) ? (state.tasks as WeeklyTask[]) : null

  try {
    if (version < 3 && incomingTasks) {
      const migrated = migratePersistedHabits({
        ...(state as unknown as HabitsState),
        tasks: incomingTasks,
        weeklyData: asWeeklyData(state.weeklyData),
      })
      Object.assign(state, migrated)
    } else if (version < 2 && incomingTasks) {
      state.tasks = migrateTaskTypes(incomingTasks)
      state.weeklyHabitData = asWeeklyData(state.weeklyHabitData)
      state.monthlyHabitData = asWeeklyData(state.monthlyHabitData)
    }
  } catch {
    if (incomingTasks) state.tasks = incomingTasks
  }

  const tasksNow = Array.isArray(state.tasks) ? (state.tasks as WeeklyTask[]) : incomingTasks
  if (tasksNow) {
    try {
      state.tasks = stampMissingTaskGems(tasksNow)
    } catch {
      state.tasks = tasksNow
    }
  } else {
    delete state.tasks
  }

  const habitSortMode = migrateHabitSortMode(state)
  const has = (key: string) => Object.prototype.hasOwnProperty.call(state, key)
  const appearanceRevRaw =
    typeof state.appearanceRev === "number" && Number.isFinite(state.appearanceRev)
      ? state.appearanceRev
      : 0
  const blobLed = has("percentLedTint") ? sanitizePercentLedTint(state.percentLedTint) : DEFAULT_PERCENT_LED_TINT
  const blobGrade = has("gradeTubeColor") ? sanitizeTubeColor(state.gradeTubeColor, DEFAULT_GRADE_TUBE_COLOR) : DEFAULT_GRADE_TUBE_COLOR
  const blobOutput = has("outputGradeTubeColor")
    ? sanitizeTubeColor(state.outputGradeTubeColor, DEFAULT_OUTPUT_TUBE_COLOR)
    : DEFAULT_OUTPUT_TUBE_COLOR
  const appearanceRev =
    appearanceRevRaw > 0
      ? appearanceRevRaw
      : blobLed !== DEFAULT_PERCENT_LED_TINT ||
          blobGrade !== DEFAULT_GRADE_TUBE_COLOR ||
          blobOutput !== DEFAULT_OUTPUT_TUBE_COLOR
        ? 1
        : 0
  const contentRevRaw = state.contentRev
  const contentRev =
    typeof contentRevRaw === "number" && Number.isFinite(contentRevRaw) && contentRevRaw > 0
      ? contentRevRaw
      : 0
  const pickHue = (pin: string | null, fromBlob: string) =>
    appearanceRev > 0 ? fromBlob : (pin ?? fromBlob)
  const next = {
    ...state,
    weeklyData: asWeeklyData(state.weeklyData),
    weeklyHabitData: asWeeklyData(state.weeklyHabitData),
    monthlyHabitData: asWeeklyData(state.monthlyHabitData),
    gradeTolerance: clampGradeTolerance((state.gradeTolerance as number) ?? DEFAULT_GRADE_TOLERANCE),
    outputGradeTolerance: clampGradeTolerance(
      (state.outputGradeTolerance as number) ?? DEFAULT_GRADE_TOLERANCE,
    ),
    accomplishmentThreshold: clampAccomplishmentThreshold(
      (state.accomplishmentThreshold as number) ?? DEFAULT_ACCOMPLISHMENT_THRESHOLD,
    ),
    accomplishmentBonus: clampAccomplishmentBonus(
      (state.accomplishmentBonus as number) ?? DEFAULT_ACCOMPLISHMENT_BONUS,
    ),
    dayGradeLiftBonus: clampAccomplishmentBonus(
      (state.dayGradeLiftBonus as number) ?? DEFAULT_DAY_GRADE_LIFT_BONUS,
    ),
    weeklyGradeLiftBonus: clampAccomplishmentBonus(
      (state.weeklyGradeLiftBonus as number) ?? DEFAULT_WEEKLY_GRADE_LIFT_BONUS,
    ),
    gradeUsePriority: !!state.gradeUsePriority,
    outputUsePriority: !!state.outputUsePriority,
    goodDaysUsePriority: !!state.goodDaysUsePriority,
    habitViewMode: state.habitViewMode === "heatmap" ? "heatmap" : "grid",
    habitSortMode,
    habitSortDirection: state.habitSortDirection === "asc" || state.habitSortDirection === "desc" ? state.habitSortDirection : null,
    sortHabitsByPriorityFlag: habitSortMode === "priority",
    willpowerImage: typeof state.willpowerImage === "string" && state.willpowerImage ? state.willpowerImage : null,
    habitGems: sanitizeHabitGems(state.habitGems),
    // Trust a blob that already has a hue pick (`appearanceRev` > 0). A stale
    // LED pin must not replace a newer hex on refresh. Pins fill missing /
    // seed-rev snapshots only.
    percentLedTint: pickHue(
      readStoredPercentLedTint(),
      has("percentLedTint") ? sanitizePercentLedTint(state.percentLedTint) : DEFAULT_PERCENT_LED_TINT,
    ),
    gradeTubeColor: pickHue(
      readStoredTubeColor(GRADE_TUBE_COLOR_STORAGE_KEY),
      has("gradeTubeColor")
        ? sanitizeTubeColor(state.gradeTubeColor, DEFAULT_GRADE_TUBE_COLOR)
        : DEFAULT_GRADE_TUBE_COLOR,
    ),
    outputGradeTubeColor: pickHue(
      readStoredTubeColor(OUTPUT_TUBE_COLOR_STORAGE_KEY),
      has("outputGradeTubeColor")
        ? sanitizeTubeColor(state.outputGradeTubeColor, DEFAULT_OUTPUT_TUBE_COLOR)
        : DEFAULT_OUTPUT_TUBE_COLOR,
    ),
    appearanceRev,
    contentRev,
    habitDayView: !!state.habitDayView,
    percentLoadingBar: state.percentLoadingBar !== false,
    habitSmallLeds: state.habitSmallLeds !== false,
    hideCompletedToday: !!state.hideCompletedToday,
    exemptionWand: !!state.exemptionWand,
    habitExemptions: sanitizeExemptionBooks(state.habitExemptions),
    habitsControlPanelWidth: HABITS_CONTROL_PANEL_DEFAULT_WIDTH,
    willpowerPhysicsHud: !!state.willpowerPhysicsHud,
    willpowerPhysics:
      version < 18
        ? { ...DEFAULT_WILLPOWER_PHYSICS }
        : sanitizeWillpowerPhysics(state.willpowerPhysics),
  } as HabitsState

  if (!Array.isArray(next.tasks)) {
    delete (next as { tasks?: WeeklyTask[] }).tasks
  }
  return next
}

export const getDefaultHabits = (): WeeklyTask[] =>
  stampMissingTaskGems([
  { id: "task-1", name: "Work for at least 1 hour", type: TaskType.GOAL, goal: 60, unit: "minutes", rewardValue: 50, frequency: "daily" },
  { id: "task-2", name: "Exercise for at least 30 minutes", type: TaskType.GOAL, goal: 30, unit: "minutes", rewardValue: 30, frequency: "daily" },
  { id: "task-3", name: "Clean for at least 15 minutes", type: TaskType.GOAL, goal: 15, unit: "minutes", rewardValue: 15, frequency: "daily" },
  { id: "task-4", name: "Drink water", type: TaskType.BOOLEAN, rewardValue: 10 },
  { id: "task-5", name: "Practice language", type: TaskType.BOOLEAN, rewardValue: 20 },
  { id: "task-6", name: "Practice an instrument", type: TaskType.BOOLEAN, rewardValue: 25 },
  {
    id: "task-7",
    name: "Chess match score (+10/day)",
    type: TaskType.INCREMENTAL,
    rewardValue: 20,
    unit: "rating",
    frequency: "daily",
    incrementalData: { cadence: "daily", startValue: 265, increment: 10, unit: "rating" },
  },
  {
    id: "task-7-puzzle",
    name: "Chess puzzle score (+10/day)",
    type: TaskType.INCREMENTAL,
    rewardValue: 20,
    unit: "rating",
    frequency: "daily",
    incrementalData: { cadence: "daily", startValue: 850, increment: 10, unit: "rating" },
  },
  { id: "task-8", name: "Write at least 3 pages per day (⅓)", type: TaskType.GOAL, goal: 3, unit: "pages", rewardValue: 30, frequency: "daily" },
  { id: "task-9", name: "Read at least 10 pages per day (+5/week)", type: TaskType.GOAL, goal: 10, unit: "pages", rewardValue: 20, frequency: "daily" },
  { id: "task-10", name: "Plan the day", type: TaskType.BOOLEAN, rewardValue: 15 },
  { id: "task-11", name: "Stretch", type: TaskType.BOOLEAN, rewardValue: 10 },
  {
    id: "task-12",
    name: "Meditate (+1 min/week after 4+ days)",
    type: TaskType.INCREMENTAL,
    rewardValue: 25,
    incrementalData: { cadence: "weekly", startValue: 4, increment: 1, unit: "minutes" },
    unit: "minutes",
    frequency: "daily",
  },
  { id: "task-13", name: "Act of kindness", type: TaskType.BOOLEAN, rewardValue: 20 },
  { id: "task-14", name: "Do something artistic/creative", type: TaskType.TEXT, rewardValue: 30 },
  {
    id: "task-w-review",
    name: "Weekly review",
    type: TaskType.BOOLEAN,
    rewardValue: 40,
    frequency: "weekly",
    timeEstimate: { minutes: 45 },
  },
  {
    id: "task-w-deep",
    name: "Deep work hours this week",
    type: TaskType.GOAL,
    goal: 10,
    unit: "hours",
    rewardValue: 50,
    frequency: "weekly",
    trackingLink: { tagIds: ["tag-work"], unit: "hours", mode: "add", enabled: true },
  },
  {
    id: "task-w-workout",
    name: "Get one workout in this week",
    type: TaskType.BOOLEAN,
    rewardValue: 25,
    frequency: "weekly",
    trackingLink: { tagIds: ["tag-exercise"], unit: "minutes", mode: "add", threshold: 30, enabled: true },
  },
  {
    id: "task-w-lesson",
    name: "One lesson from this week",
    type: TaskType.TEXT,
    rewardValue: 20,
    frequency: "weekly",
  },
  {
    id: "task-m-bills",
    name: "Pay recurring bills",
    type: TaskType.BOOLEAN,
    rewardValue: 30,
    frequency: "monthly",
  },
  {
    id: "task-m-book",
    name: "Finish 1 book this month",
    type: TaskType.GOAL,
    goal: 1,
    unit: "books",
    rewardValue: 50,
    frequency: "monthly",
  },
  {
    id: "task-m-chores",
    name: "Chore hours this month",
    type: TaskType.GOAL,
    goal: 6,
    unit: "hours",
    rewardValue: 35,
    frequency: "monthly",
    trackingLink: { tagIds: ["tag-cleaning"], unit: "hours", mode: "add", enabled: true },
  },
  {
    id: "task-m-theme",
    name: "This month's theme",
    type: TaskType.TEXT,
    rewardValue: 15,
    frequency: "monthly",
  },
], seedRng(0x68616231))

export const getDefaultHabitCategories = (): Category[] => [
  { id: "category-1", name: "Health", color: "#8cd4a5" },
  { id: "category-2", name: "Work", color: "#8b7ecc" },
  { id: "category-3", name: "Learning", color: "#b89fbf" },
  { id: "category-4", name: "Personal", color: "#9fc2a5" },
]

interface HabitsState {
  tasks: WeeklyTask[]
  categories: Category[]
  weeklyData: WeeklyData
  /** Weekly-frequency habits keyed by week string */
  weeklyHabitData: WeeklyData
  /** Monthly-frequency habits keyed by YYYY-MM */
  monthlyHabitData: WeeklyData
  /** Raw daily % that counts as 100 on the week grade curve (1–100, default 100). */
  gradeTolerance: number
  setGradeTolerance: (tolerance: number) => void
  /** Raw elapsed row % that counts as 100 on the Perfect Output curve. */
  outputGradeTolerance: number
  setOutputGradeTolerance: (tolerance: number) => void
  /**
   * Raw daily % that counts as a Good day ("completion to feel accomplished").
   * Independent of Week grade / Perfect output curves. Default 80.
   */
  accomplishmentThreshold: number
  setAccomplishmentThreshold: (threshold: number) => void
  /** Points awarded on a Good day. Default 50. */
  accomplishmentBonus: number
  setAccomplishmentBonus: (bonus: number) => void
  /**
   * Points paid once for Week grade and once for Perfect output when that
   * grade is higher than yesterday. Default 25. 0 turns it off.
   */
  dayGradeLiftBonus: number
  setDayGradeLiftBonus: (bonus: number) => void
  /**
   * Points paid once for the weekly-habit grade and once for weekly output
   * when that grade is higher than last week. Default 25. 0 turns it off.
   */
  weeklyGradeLiftBonus: number
  setWeeklyGradeLiftBonus: (bonus: number) => void
  /** Blend prioritized habits into Week / Span grade (50% floor). */
  gradeUsePriority: boolean
  setGradeUsePriority: (value: boolean) => void
  /** Same blend for Perfect output. */
  outputUsePriority: boolean
  setOutputUsePriority: (value: boolean) => void
  /** Use the same blend when deciding Good days / accomplishment bonus. */
  goodDaysUsePriority: boolean
  setGoodDaysUsePriority: (value: boolean) => void
  /** Optional compact heatmap instead of the spreadsheet. */
  habitViewMode: "grid" | "heatmap"
  setHabitViewMode: (mode: "grid" | "heatmap") => void
  /** Row order for every Habits tab. Persist v10. */
  habitSortMode: HabitSortMode
  setHabitSortMode: (mode: HabitSortMode) => void
  /**
   * Explicit ascending / descending. `null` keeps each mode's usual order
   * (A→Z, newest, pin first, high %).
   */
  habitSortDirection: "asc" | "desc" | null
  setHabitSortDirection: (direction: "asc" | "desc") => void
  /** Sleep-log and next-action checks. Does not push an undo step. */
  applyAutoChecks: (
    updates: { taskId: string; dateKey: string; flag: "sleepCompleted" | "listCompleted"; met: boolean }[],
  ) => void
  /** Legacy boolean; kept in sync with `habitSortMode === "priority"`. */
  sortHabitsByPriorityFlag: boolean
  setSortHabitsByPriorityFlag: (value: boolean) => void
  /** User-uploaded central willpower crystal (data URL). Null uses the built-in default. */
  willpowerImage: string | null
  setWillpowerImage: (value: string | null) => void
  /**
   * Home Dashboard Habits Tab Control Panel width in px. Seam-drag persists.
   * Willpower gems scale with this. Persist v16.
   */
  habitsControlPanelWidth: number
  setHabitsControlPanelWidth: (value: number) => void
  /** Optional bouncing-ball lab on Willpower gems. Persist v16. */
  willpowerPhysicsHud: boolean
  setWillpowerPhysicsHud: (value: boolean) => void
  /** Editable Willpower gems physics knobs. Persist v16. */
  willpowerPhysics: WillpowerPhysicsParams
  setWillpowerPhysics: (value: Partial<WillpowerPhysicsParams> | WillpowerPhysicsParams) => void
  /** Photographed gem per Daily Habits mark. Empty slot uses catalog default. */
  habitGems: HabitGemMap
  setHabitGem: (slot: HabitGemSlot, value: string | null) => void
  /** Hex tint for row/column percent LED modules (and Yes/No cell lamps). */
  percentLedTint: string
  setPercentLedTint: (value: string) => void
  /** Discharge hue for Week / Span grade tubes. Default argon cyan. */
  gradeTubeColor: string
  setGradeTubeColor: (value: string) => void
  /** Discharge hue for Perfect output tubes. Default xenon magenta. */
  outputGradeTubeColor: string
  setOutputGradeTubeColor: (value: string) => void
  /**
   * Bumped on each LED / tube hue pick so a late hub rehydrate cannot roll
   * colors back to an older snapshot.
   */
  appearanceRev: number
  /**
   * Bumped on each habit title, detail, or completion write so a late
   * rehydrate cannot roll the vault back to an older snapshot. Persist v19.
   */
  contentRev: number
  /** Daily spreadsheet: only today's column + the week % column. Persist v12. */
  habitDayView: boolean
  setHabitDayView: (value: boolean) => void
  /** Row/column totals as a quiet 10-pip channel (default) vs numeric LED. Persist v12. */
  percentLoadingBar: boolean
  setPercentLoadingBar: (value: boolean) => void
  /**
   * Yes/No cell lamps stay 15px when true (default). False = lamp fills the
   * spreadsheet cell. Persist v15.
   */
  habitSmallLeds: boolean
  setHabitSmallLeds: (value: boolean) => void
  /**
   * Hide rows already done for the focused day / period. One flag for Daily,
   * Weekly, and Monthly (label changes). Default false so existing vaults keep
   * showing completed rows.
   */
  hideCompletedToday: boolean
  setHideCompletedToday: (value: boolean) => void
  /**
   * Exemption wand is on: every cell is a yes/no lamp for “this period is
   * waived”, not for completion. Shared across Daily / Weekly / Monthly.
   */
  exemptionWand: boolean
  setExemptionWand: (value: boolean) => void
  /** Explicit waive / require overrides. Automatic pre-creation waivers are not stored. */
  habitExemptions: ExemptionBooks
  setHabitExemption: (frequency: HabitFrequency, periodKey: string, taskId: string, exempt: boolean) => void
  addTask: (task: WeeklyTask) => void
  updateTask: (task: WeeklyTask) => void
  deleteTask: (taskId: string) => void
  setTasks: (tasks: WeeklyTask[]) => void
  setCategories: (categories: Category[]) => void
  updateCompletion: (taskId: string, date: Date, completion: TaskCompletion) => void
  /**
   * Write the tracking-link contribution (`lib/habit-tracking-sync.ts`).
   * Daily habits land on `date`; weekly/monthly habits land on the week/month
   * containing `date`. `tracked` is already converted to the link's unit.
   * No-ops when nothing changes, so repainting does not re-fire points / Done-log.
   */
  applyTrackedValue: (taskId: string, date: Date, tracked: number) => void
  updateWeeklyHabitCompletion: (taskId: string, weekStart: Date, completion: TaskCompletion) => void
  updateMonthlyHabitCompletion: (taskId: string, monthDate: Date, completion: TaskCompletion) => void
  setWeeklyData: (data: WeeklyData) => void
  importData: (data: {
    tasks: WeeklyTask[]
    weeklyData: WeeklyData
    weeklyHabitData?: WeeklyData
    monthlyHabitData?: WeeklyData
    categories?: Category[]
  }) => void
  resetData: () => void
}

function awardPointsIfNewlyMet(
  task: WeeklyTask,
  previous: TaskCompletion | undefined,
  completion: TaskCompletion,
  date: Date,
  weeklyData: WeeklyData,
) {
  const ctx = { date, weeklyData }
  const wasMet = previous ? isHabitGoalMet(task, previous, ctx) : false
  const nowMet = isHabitGoalMet(task, completion, ctx)
  if (nowMet && !wasMet) {
    usePointsStore.getState().addPoints(task.id, task.rewardValue || 0, habitCompletionReason(task.name), date)
  }
}

function stampCompletion<T extends TaskCompletion>(cell: T): T {
  return { ...cell, updatedAt: Date.now() }
}

function syncDailyHabitDayPoints(task: WeeklyTask, date: Date, weeklyData: WeeklyData) {
  const dateKey = formatLocalDateKey(date)
  const books = useHabitsStore.getState().habitExemptions ?? emptyExemptionBooks()
  const points = isHabitPeriodExempt(task, dateKey, "daily", books)
    ? 0
    : dailyHabitDayPoints(task, weeklyData[dateKey]?.[task.id], weeklyData, date)
  usePointsStore
    .getState()
    .upsertPoints(habitDayPointTaskId(task.id, dateKey), points, habitCompletionReason(task.name), date)
}

type GradeSyncState = Pick<
  HabitsState,
  | "tasks"
  | "weeklyData"
  | "weeklyHabitData"
  | "gradeTolerance"
  | "outputGradeTolerance"
  | "accomplishmentThreshold"
  | "accomplishmentBonus"
  | "dayGradeLiftBonus"
  | "weeklyGradeLiftBonus"
  | "gradeUsePriority"
  | "outputUsePriority"
  | "goodDaysUsePriority"
  | "habitExemptions"
>

function dailyShownGrades(state: GradeSyncState, day: Date): { week: number; output: number; dayScore: number } {
  const weekDates = getWeekDates(getWeekStartDate(day))
  const daily = state.tasks.filter(isDailyHabit)
  const books = state.habitExemptions ?? emptyExemptionBooks()
  const isExempt = (task: WeeklyTask, key: string) => isHabitPeriodExempt(task, key, "daily", books)
  const weekGrade = calculateWeekToDateGrade(daily, state.weeklyData, weekDates, day, state.gradeTolerance, isExempt)
  const outputGrade = calculateWeekToDateOutputGrade(
    daily,
    state.weeklyData,
    weekDates,
    day,
    state.outputGradeTolerance,
    isExempt,
  )
  const prio = prioritizedHabits(daily, state.weeklyData, day, "daily")
  const prioWeek =
    prio.length > 0
      ? calculateWeekToDateGrade(prio, state.weeklyData, weekDates, day, state.gradeTolerance, isExempt).grade
      : null
  const prioOut =
    prio.length > 0
      ? calculateWeekToDateOutputGrade(prio, state.weeklyData, weekDates, day, state.outputGradeTolerance, isExempt)
          .grade
      : null
  const dateKey = formatLocalDateKey(day)
  const rawDay = weekGrade.days.find((d) => d.dateKey === dateKey)?.raw ?? 0
  const prioRaw =
    prio.length > 0
      ? (calculateWeekToDateGrade(prio, state.weeklyData, weekDates, day, state.gradeTolerance, isExempt).days.find(
          (d) => d.dateKey === dateKey,
        )?.raw ?? 0)
      : null
  return {
    week: blendPriorityScore(weekGrade.grade, prioWeek, !!state.gradeUsePriority),
    output: blendPriorityScore(outputGrade.grade, prioOut, !!state.outputUsePriority),
    dayScore: blendPriorityScore(rawDay, prioRaw, !!state.goodDaysUsePriority),
  }
}

function weeklyShownGrades(state: GradeSyncState, weekStart: Date): { week: number; output: number } {
  const weekly = state.tasks.filter((task) => task.frequency === "weekly")
  if (weekly.length === 0) return { week: 0, output: 0 }
  const period = { key: getWeekString(weekStart), date: weekStart }
  const asOf = addCalendarDays(weekStart, 6)
  const books = state.habitExemptions ?? emptyExemptionBooks()
  const isExempt = (task: WeeklyTask, key: string) => isHabitPeriodExempt(task, key, "weekly", books)
  const grade = calculatePeriodGrade(
    weekly,
    state.weeklyHabitData,
    [period],
    asOf,
    state.gradeTolerance,
    isExempt,
  )
  const output = calculatePeriodOutputGrade(
    weekly,
    state.weeklyHabitData,
    [period],
    asOf,
    state.outputGradeTolerance,
    isExempt,
  )
  const prio = prioritizedHabits(weekly, state.weeklyHabitData, asOf, "weekly")
  const prioWeek =
    prio.length > 0
      ? calculatePeriodGrade(prio, state.weeklyHabitData, [period], asOf, state.gradeTolerance, isExempt).grade
      : null
  const prioOut =
    prio.length > 0
      ? calculatePeriodOutputGrade(prio, state.weeklyHabitData, [period], asOf, state.outputGradeTolerance, isExempt)
          .grade
      : null
  return {
    week: blendPriorityScore(grade.grade, prioWeek, !!state.gradeUsePriority),
    output: blendPriorityScore(output.grade, prioOut, !!state.outputUsePriority),
  }
}

function syncGradeBonusesForWeek(
  anchor: Date,
  state: GradeSyncState,
  cache: Map<string, ReturnType<typeof dailyShownGrades>>,
) {
  const weekDates = getWeekDates(getWeekStartDate(anchor))
  const now = new Date()
  const asOf = now.getTime() > anchor.getTime() ? now : anchor
  const elapsed = weekToDateDays(weekDates, asOf)
  const upsert = usePointsStore.getState().upsertPoints
  const liftEach = state.dayGradeLiftBonus ?? DEFAULT_DAY_GRADE_LIFT_BONUS
  const shownFor = (day: Date) => {
    const key = formatLocalDateKey(day)
    const hit = cache.get(key)
    if (hit) return hit
    const next = dailyShownGrades(state, day)
    cache.set(key, next)
    return next
  }
  for (const day of elapsed) {
    const shown = shownFor(day)
    const bonus = gradeBonusPoints(shown.week, shown.output)
    const dateKey = formatLocalDateKey(day)
    upsert(gradeBonusTaskId(dateKey), bonus, gradeBonusDescription(bonus), day)
    const rawBonus = rawDayBonusPoints(
      shown.dayScore,
      state.accomplishmentThreshold ?? DEFAULT_ACCOMPLISHMENT_THRESHOLD,
      state.accomplishmentBonus ?? DEFAULT_ACCOMPLISHMENT_BONUS,
    )
    upsert(
      rawDayBonusTaskId(dateKey),
      rawBonus,
      rawDayBonusDescription(rawBonus, state.accomplishmentThreshold ?? DEFAULT_ACCOMPLISHMENT_THRESHOLD),
      day,
    )
    const prior = shownFor(addCalendarDays(day, -1))
    const lift = gradesBeatPrior(shown, prior, liftEach, "day")
    upsert(dayGradeLiftTaskId(dateKey), lift.points, lift.description, day)
  }
}

function syncWeeklyGradeLifts(state: GradeSyncState) {
  const starts = new Map<string, Date>()
  const add = (date: Date) => {
    const start = getWeekStartDate(date)
    starts.set(getWeekString(start), start)
  }
  add(new Date())
  for (const key of Object.keys(state.weeklyHabitData || {})) {
    const parsed = parseLocalDate(key.split("_")[0] ?? "")
    if (parsed) add(parsed)
  }
  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const upsert = usePointsStore.getState().upsertPoints
  const liftEach = state.weeklyGradeLiftBonus ?? DEFAULT_WEEKLY_GRADE_LIFT_BONUS
  for (const [weekKey, start] of starts) {
    if (start > today) continue
    const current = weeklyShownGrades(state, start)
    const prior = weeklyShownGrades(state, addCalendarDays(start, -7))
    const lift = gradesBeatPrior(current, prior, liftEach, "week")
    const end = addCalendarDays(start, 6)
    const dated = today >= start && today <= end ? today : end
    upsert(weeklyGradeLiftTaskId(weekKey), lift.points, lift.description, dated)
  }
}

function resyncAllNighterMornings(mornings: Iterable<string>) {
  const days: Date[] = []
  for (const key of mornings) {
    const morning = parseLocalDate(key)
    if (!morning) continue
    days.push(addCalendarDays(morning, -1), morning)
  }
  if (!days.length) return
  const state = useHabitsStore.getState()
  for (const day of days) {
    for (const task of state.tasks) {
      if (!isDailyHabit(task)) continue
      syncDailyHabitDayPoints(task, day, state.weeklyData)
    }
  }
  const seen = new Set<string>()
  for (const day of days) {
    const week = formatLocalDateKey(getWeekStartDate(day))
    if (seen.has(week)) continue
    seen.add(week)
    syncGradeBonusesFromState(useHabitsStore.getState(), day)
  }
}

function syncGradeBonusesFromState(state: HabitsState, extraAnchor?: Date) {
  const seen = new Set<string>()
  const anchors: Date[] = [new Date()]
  const cache = new Map<string, ReturnType<typeof dailyShownGrades>>()
  if (extraAnchor) anchors.push(extraAnchor)
  for (const key of Object.keys(state.weeklyData || {})) {
    const parsed = parseLocalDate(key)
    if (parsed) anchors.push(parsed)
  }
  for (const anchor of anchors) {
    const weekKey = getWeekString(anchor)
    if (seen.has(weekKey)) continue
    seen.add(weekKey)
    syncGradeBonusesForWeek(anchor, state, cache)
  }
  syncWeeklyGradeLifts(state)
}

function stripCompletionFromData(data: WeeklyData, taskId: string): WeeklyData {
  const next = { ...data }
  Object.keys(next).forEach((key) => {
    if (next[key]?.[taskId]) {
      const day = { ...next[key] }
      delete day[taskId]
      next[key] = day
    }
  })
  return next
}

/** Stock seed rows use `task-*` ids. A hollow seed must not beat a real vault. */
function looksLikeSeedHabits(tasks: WeeklyTask[] | undefined): boolean {
  if (!tasks || tasks.length === 0) return true
  return tasks.every((t) => typeof t.id === "string" && /^task-/.test(t.id))
}

/**
 * Prefer live cells (an edit that beat the disk stamp), but fill empty live maps
 * and missing buckets from disk so a gem-stamp or seed contentRev cannot blank
 * the checklist that grades read.
 */
function mergeCompletionData(live: WeeklyData, disk: WeeklyData | undefined): WeeklyData {
  const fromDisk = asWeeklyData(disk)
  if (Object.keys(live).length === 0) return fromDisk
  if (Object.keys(fromDisk).length === 0) return live
  const out: WeeklyData = { ...fromDisk }
  for (const bucketKey of Object.keys(live)) {
    out[bucketKey] = { ...(out[bucketKey] || {}), ...live[bucketKey] }
  }
  return out
}

export const useHabitsStore = create<HabitsState>()(
  persist(
    (set, get) => ({
      tasks: getDefaultHabits(),
      categories: getDefaultHabitCategories(),
      weeklyData: {},
      weeklyHabitData: {},
      monthlyHabitData: {},
      gradeTolerance: DEFAULT_GRADE_TOLERANCE,
      setGradeTolerance: (tolerance) => {
        set({ gradeTolerance: clampGradeTolerance(tolerance) })
        syncGradeBonusesFromState(get())
      },
      outputGradeTolerance: DEFAULT_GRADE_TOLERANCE,
      setOutputGradeTolerance: (tolerance) => {
        set({ outputGradeTolerance: clampGradeTolerance(tolerance) })
        syncGradeBonusesFromState(get())
      },
      accomplishmentThreshold: DEFAULT_ACCOMPLISHMENT_THRESHOLD,
      setAccomplishmentThreshold: (threshold) => {
        set({ accomplishmentThreshold: clampAccomplishmentThreshold(threshold) })
        syncGradeBonusesFromState(get())
      },
      accomplishmentBonus: DEFAULT_ACCOMPLISHMENT_BONUS,
      setAccomplishmentBonus: (bonus) => {
        set({ accomplishmentBonus: clampAccomplishmentBonus(bonus) })
        syncGradeBonusesFromState(get())
      },
      dayGradeLiftBonus: DEFAULT_DAY_GRADE_LIFT_BONUS,
      setDayGradeLiftBonus: (bonus) => {
        set({ dayGradeLiftBonus: clampAccomplishmentBonus(bonus) })
        syncGradeBonusesFromState(get())
      },
      weeklyGradeLiftBonus: DEFAULT_WEEKLY_GRADE_LIFT_BONUS,
      setWeeklyGradeLiftBonus: (bonus) => {
        set({ weeklyGradeLiftBonus: clampAccomplishmentBonus(bonus) })
        syncGradeBonusesFromState(get())
      },
      gradeUsePriority: false,
      setGradeUsePriority: (value) => {
        set({ gradeUsePriority: value })
        syncGradeBonusesFromState(get())
      },
      outputUsePriority: false,
      setOutputUsePriority: (value) => {
        set({ outputUsePriority: value })
        syncGradeBonusesFromState(get())
      },
      goodDaysUsePriority: false,
      setGoodDaysUsePriority: (value) => {
        set({ goodDaysUsePriority: value })
        syncGradeBonusesFromState(get())
      },
      habitViewMode: "grid",
      setHabitViewMode: (mode) => set({ habitViewMode: mode === "heatmap" ? "heatmap" : "grid" }),
      habitSortMode: "default",
      habitSortDirection: null,
      setHabitSortMode: (mode) =>
        set({ habitSortMode: mode, sortHabitsByPriorityFlag: mode === "priority" }),
      setHabitSortDirection: (direction) => set({ habitSortDirection: direction }),
      sortHabitsByPriorityFlag: false,
      setSortHabitsByPriorityFlag: (value) =>
        set({ sortHabitsByPriorityFlag: value, habitSortMode: value ? "priority" : "default" }),
      willpowerImage: null,
      setWillpowerImage: (value) => set({ willpowerImage: value || null }),
      habitsControlPanelWidth: HABITS_CONTROL_PANEL_DEFAULT_WIDTH,
      setHabitsControlPanelWidth: (value) =>
        set({ habitsControlPanelWidth: clampHabitsControlPanelWidth(value) }),
      willpowerPhysicsHud: false,
      setWillpowerPhysicsHud: (value) => set({ willpowerPhysicsHud: !!value }),
      willpowerPhysics: { ...DEFAULT_WILLPOWER_PHYSICS },
      setWillpowerPhysics: (value) =>
        set((state) => ({
          willpowerPhysics: sanitizeWillpowerPhysics({ ...state.willpowerPhysics, ...value }),
        })),
      habitGems: {},
      setHabitGem: (slot, value) =>
        set((state) => {
          const next = { ...state.habitGems }
          if (value) next[slot] = value
          else delete next[slot]
          return { habitGems: next }
        }),
      percentLedTint: DEFAULT_PERCENT_LED_TINT,
      setPercentLedTint: (value) =>
        set((state) => ({
          percentLedTint: writeStoredPercentLedTint(value),
          appearanceRev: nextAppearanceRev(state.appearanceRev),
        })),
      gradeTubeColor: DEFAULT_GRADE_TUBE_COLOR,
      setGradeTubeColor: (value) =>
        set((state) => ({
          gradeTubeColor: writeStoredTubeColor(GRADE_TUBE_COLOR_STORAGE_KEY, value, DEFAULT_GRADE_TUBE_COLOR),
          appearanceRev: nextAppearanceRev(state.appearanceRev),
        })),
      outputGradeTubeColor: DEFAULT_OUTPUT_TUBE_COLOR,
      setOutputGradeTubeColor: (value) =>
        set((state) => ({
          outputGradeTubeColor: writeStoredTubeColor(
            OUTPUT_TUBE_COLOR_STORAGE_KEY,
            value,
            DEFAULT_OUTPUT_TUBE_COLOR,
          ),
          appearanceRev: nextAppearanceRev(state.appearanceRev),
        })),
      appearanceRev: 0,
      contentRev: 0,
      habitDayView: false,
      setHabitDayView: (value) => set({ habitDayView: !!value }),
      percentLoadingBar: true,
      setPercentLoadingBar: (value) => set({ percentLoadingBar: !!value }),
      habitSmallLeds: true,
      setHabitSmallLeds: (value) => set({ habitSmallLeds: !!value }),
      hideCompletedToday: false,
      setHideCompletedToday: (value) => set({ hideCompletedToday: !!value }),
      exemptionWand: false,
      setExemptionWand: (value) => set({ exemptionWand: !!value }),
      habitExemptions: emptyExemptionBooks(),
      setHabitExemption: (frequency, periodKey, taskId, exempt) => {
        const task = get().tasks.find((row) => row.id === taskId)
        if (!task) return
        set((state) => ({
          habitExemptions: withExemptionOverride(
            state.habitExemptions ?? emptyExemptionBooks(),
            frequency,
            periodKey,
            task,
            exempt,
          ),
          contentRev: nextContentRev(state.contentRev),
        }))
        if (frequency === "daily") {
          const date = periodKey.match(/^\d{4}-\d{2}-\d{2}$/)
            ? new Date(Number(periodKey.slice(0, 4)), Number(periodKey.slice(5, 7)) - 1, Number(periodKey.slice(8, 10)))
            : null
          if (date) {
            syncDailyHabitDayPoints(task, date, get().weeklyData)
            syncGradeBonusesFromState(get(), date)
          }
        }
      },

      addTask: (task) =>
        set((state) => ({
          contentRev: nextContentRev(state.contentRev),
          tasks: [
            ...state.tasks,
            ensureTaskGem(
              migrateIncrementalTask({
                ...task,
                type: normalizeTaskType(task.type),
                frequency: task.frequency || "daily",
                createdAt: task.createdAt || new Date().toISOString(),
              }),
            ),
          ],
        })),
      updateTask: (task) => {
        const prev = get().tasks.find((row) => row.id === task.id)
        const linksChanged = JSON.stringify(prev?.logExemptions ?? null) !== JSON.stringify(task.logExemptions ?? null)
        set((state) => ({
          contentRev: nextContentRev(state.contentRev),
          tasks: state.tasks.map((t) =>
            t.id === task.id
              ? ensureTaskGem(
                  migrateIncrementalTask({
                    ...t,
                    ...task,
                    type: normalizeTaskType(task.type ?? t.type),
                    frequency: task.frequency || t.frequency || "daily",
                    createdAt: task.createdAt || t.createdAt,
                  }),
                )
              : t,
          ),
        }))
        if (linksChanged) resyncAllNighterMornings(currentExemptionContext().allNighterMornings)
      },
      applyAutoChecks: (updates) => {
        if (!updates.length) return
        const touched: Date[] = []
        set((state) => {
          let weeklyData = state.weeklyData
          let changed = false
          for (const update of updates) {
            const task = state.tasks.find((row) => row.id === update.taskId)
            if (!task || (task.frequency && task.frequency !== "daily")) continue
            if (normalizeTaskType(task.type) !== TaskType.BOOLEAN) continue
            const date = parseLocalDate(update.dateKey)
            if (!date) continue
            const previous = weeklyData[update.dateKey]?.[update.taskId]
            const next = applyAutoFlag(previous, update.flag, update.met)
            if (!next) continue
            if (!changed) {
              weeklyData = { ...weeklyData }
              changed = true
            }
            const day = { ...(weeklyData[update.dateKey] || {}) }
            day[update.taskId] = stampCompletion(
              completionWithGoalFlag(task, next, { date, weeklyData: state.weeklyData }),
            )
            weeklyData[update.dateKey] = day
            touched.push(date)
          }
          if (!changed) return state
          return { weeklyData, contentRev: nextContentRev(state.contentRev) }
        })
        if (!touched.length) return
        const live = get()
        const seen = new Set<string>()
        for (const date of touched) {
          const key = formatLocalDateKey(date)
          if (seen.has(key)) continue
          seen.add(key)
          for (const task of live.tasks) {
            if (!isDailyHabit(task)) continue
            syncDailyHabitDayPoints(task, date, live.weeklyData)
          }
          syncGradeBonusesFromState(live, date)
        }
      },
      deleteTask: (taskId) =>
        set((state) => ({
          contentRev: nextContentRev(state.contentRev),
          tasks: state.tasks.filter((t) => t.id !== taskId),
          weeklyData: stripCompletionFromData(state.weeklyData, taskId),
          weeklyHabitData: stripCompletionFromData(state.weeklyHabitData, taskId),
          monthlyHabitData: stripCompletionFromData(state.monthlyHabitData, taskId),
          habitExemptions: stripTaskExemptions(state.habitExemptions ?? emptyExemptionBooks(), taskId),
        })),
      setTasks: (tasks) =>
        set((state) => ({
          contentRev: nextContentRev(state.contentRev),
          tasks: stampMissingTaskGems(tasks),
        })),
      setCategories: (categories) =>
        set((state) => ({
          contentRev: nextContentRev(state.contentRev),
          categories,
        })),

      updateCompletion: (taskId, date, completion) => {
        rememberWorld("habit")
        let sync:
          | { task: WeeklyTask; previous: TaskCompletion | undefined; final: TaskCompletion; priorData: WeeklyData }
          | undefined
        set((state) => {
          const task = state.tasks.find((t) => t.id === taskId)
          if (!task || (task.frequency && task.frequency !== "daily")) return state

          const dateKey = formatLocalDateKey(date)
          const weeklyData = { ...state.weeklyData }
          const day = { ...(weeklyData[dateKey] || {}) }
          const previous = day[taskId]
          const reconciled = reconcileManualEntry(task, previous, { ...previous, ...completion })
          const finalCompletion = completionWithGoalFlag(task, reconciled, { date, weeklyData: state.weeklyData })
          day[taskId] = stampCompletion(finalCompletion)
          weeklyData[dateKey] = day
          sync = { task, previous, final: day[taskId], priorData: state.weeklyData }
          return { weeklyData, contentRev: nextContentRev(state.contentRev) }
        })
        if (sync) {
          syncDailyHabitDayPoints(sync.task, date, get().weeklyData)
          syncGradeBonusesFromState(get(), date)
          syncHabitDoneLog(sync.task, date, sync.previous, sync.final, sync.priorData)
        }
      },

      applyTrackedValue: (taskId, date, tracked) => {
        let sync:
          | {
              task: WeeklyTask
              previous: TaskCompletion | undefined
              final: TaskCompletion
              priorData: WeeklyData
              frequency: "daily" | "weekly" | "monthly"
              anchor: Date
            }
          | undefined
        set((state) => {
          const task = state.tasks.find((t) => t.id === taskId)
          if (!task) return state

          const frequency = task.frequency || "daily"
          const link = activeTrackingLink(task)
          if (frequency === "weekly") {
            const weekStart = getWeekStartDate(date)
            const weekKey = getWeekString(weekStart)
            const previous = state.weeklyHabitData[weekKey]?.[taskId]
            const next = link
              ? applyTrackedToCompletion(task, link, previous, tracked)
              : clearTrackedFromCompletion(task, previous)
            if (!next) return state
            const weeklyHabitData = { ...state.weeklyHabitData }
            const bucket = { ...(weeklyHabitData[weekKey] || {}) }
            const finalCompletion = completionWithGoalFlag(task, next, {
              date: weekStart,
              weeklyData: state.weeklyHabitData,
            })
            bucket[taskId] = stampCompletion(finalCompletion)
            weeklyHabitData[weekKey] = bucket
            sync = {
              task,
              previous,
              final: finalCompletion,
              priorData: state.weeklyHabitData,
              frequency,
              anchor: weekStart,
            }
            return { weeklyHabitData, contentRev: nextContentRev(state.contentRev) }
          }
          if (frequency === "monthly") {
            const monthDate = new Date(date.getFullYear(), date.getMonth(), 1)
            const monthKey = formatLocalMonthKey(monthDate)
            const previous = state.monthlyHabitData[monthKey]?.[taskId]
            const next = link
              ? applyTrackedToCompletion(task, link, previous, tracked)
              : clearTrackedFromCompletion(task, previous)
            if (!next) return state
            const monthlyHabitData = { ...state.monthlyHabitData }
            const bucket = { ...(monthlyHabitData[monthKey] || {}) }
            const finalCompletion = completionWithGoalFlag(task, next, {
              date: monthDate,
              weeklyData: state.monthlyHabitData,
            })
            bucket[taskId] = stampCompletion(finalCompletion)
            monthlyHabitData[monthKey] = bucket
            sync = {
              task,
              previous,
              final: finalCompletion,
              priorData: state.monthlyHabitData,
              frequency,
              anchor: monthDate,
            }
            return { monthlyHabitData, contentRev: nextContentRev(state.contentRev) }
          }

          const dateKey = formatLocalDateKey(date)
          const previous = state.weeklyData[dateKey]?.[taskId]
          const next = link
            ? applyTrackedToCompletion(task, link, previous, tracked)
            : clearTrackedFromCompletion(task, previous)
          if (!next) return state

          const weeklyData = { ...state.weeklyData }
          const day = { ...(weeklyData[dateKey] || {}) }
          const finalCompletion = completionWithGoalFlag(task, next, { date, weeklyData: state.weeklyData })
          day[taskId] = stampCompletion(finalCompletion)
          weeklyData[dateKey] = day
          sync = { task, previous, final: day[taskId], priorData: state.weeklyData, frequency: "daily", anchor: date }
          return { weeklyData, contentRev: nextContentRev(state.contentRev) }
        })
        if (sync) {
          if (sync.frequency === "daily") {
            syncDailyHabitDayPoints(sync.task, sync.anchor, get().weeklyData)
            syncGradeBonusesFromState(get(), sync.anchor)
          } else {
            awardPointsIfNewlyMet(sync.task, sync.previous, sync.final, sync.anchor, sync.priorData)
            syncGradeBonusesFromState(get(), sync.anchor)
          }
          syncHabitDoneLog(sync.task, sync.anchor, sync.previous, sync.final, sync.priorData)
        }
      },

      updateWeeklyHabitCompletion: (taskId, weekStart, completion) => {
        rememberWorld("habit")
        let sync:
          | { task: WeeklyTask; previous: TaskCompletion | undefined; final: TaskCompletion; priorData: WeeklyData }
          | undefined
        set((state) => {
          const task = state.tasks.find((t) => t.id === taskId)
          if (!task) return state
          const weekKey = getWeekString(weekStart)
          const weeklyHabitData = { ...state.weeklyHabitData }
          const bucket = { ...(weeklyHabitData[weekKey] || {}) }
          const previous = bucket[taskId]
          const reconciled = reconcileManualEntry(task, previous, { ...previous, ...completion })
          const finalCompletion = completionWithGoalFlag(task, reconciled, { date: weekStart, weeklyData: state.weeklyHabitData })
          bucket[taskId] = stampCompletion(finalCompletion)
          weeklyHabitData[weekKey] = bucket
          sync = { task, previous, final: bucket[taskId], priorData: state.weeklyHabitData }
          return { weeklyHabitData, contentRev: nextContentRev(state.contentRev) }
        })
        if (sync) {
          awardPointsIfNewlyMet(sync.task, sync.previous, sync.final, weekStart, sync.priorData)
          syncHabitDoneLog(sync.task, weekStart, sync.previous, sync.final, sync.priorData)
          syncGradeBonusesFromState(get(), weekStart)
        }
      },

      updateMonthlyHabitCompletion: (taskId, monthDate, completion) => {
        rememberWorld("habit")
        let sync:
          | { task: WeeklyTask; previous: TaskCompletion | undefined; final: TaskCompletion; priorData: WeeklyData }
          | undefined
        set((state) => {
          const task = state.tasks.find((t) => t.id === taskId)
          if (!task) return state
          const monthKey = formatLocalMonthKey(monthDate)
          const monthlyHabitData = { ...state.monthlyHabitData }
          const bucket = { ...(monthlyHabitData[monthKey] || {}) }
          const previous = bucket[taskId]
          const reconciled = reconcileManualEntry(task, previous, { ...previous, ...completion })
          const finalCompletion = completionWithGoalFlag(task, reconciled, { date: monthDate, weeklyData: state.monthlyHabitData })
          bucket[taskId] = stampCompletion(finalCompletion)
          monthlyHabitData[monthKey] = bucket
          sync = { task, previous, final: bucket[taskId], priorData: state.monthlyHabitData }
          return { monthlyHabitData, contentRev: nextContentRev(state.contentRev) }
        })
        if (sync) {
          awardPointsIfNewlyMet(sync.task, sync.previous, sync.final, monthDate, sync.priorData)
          syncHabitDoneLog(sync.task, monthDate, sync.previous, sync.final, sync.priorData)
        }
      },

      setWeeklyData: (weeklyData) =>
        set((state) => ({ weeklyData, contentRev: nextContentRev(state.contentRev) })),
      importData: (data) => {
        const migrated = migrateIncrementalHabits(migrateTaskTypes(data.tasks), data.weeklyData)
        set((state) => ({
          contentRev: nextContentRev(state.contentRev),
          tasks: stampMissingTaskGems(migrated.tasks),
          weeklyData: migrated.weeklyData,
          weeklyHabitData: data.weeklyHabitData ?? {},
          monthlyHabitData: data.monthlyHabitData ?? {},
          categories: data.categories ?? getDefaultHabitCategories(),
        }))
      },
      resetData: () =>
        set((state) => ({
          tasks: [],
          weeklyData: {},
          weeklyHabitData: {},
          monthlyHabitData: {},
          categories: [],
          gradeTolerance: state.gradeTolerance,
          outputGradeTolerance: state.outputGradeTolerance,
          accomplishmentThreshold: state.accomplishmentThreshold,
          accomplishmentBonus: state.accomplishmentBonus,
          dayGradeLiftBonus: state.dayGradeLiftBonus,
          weeklyGradeLiftBonus: state.weeklyGradeLiftBonus,
          gradeUsePriority: state.gradeUsePriority,
          outputUsePriority: state.outputUsePriority,
          goodDaysUsePriority: state.goodDaysUsePriority,
          habitViewMode: state.habitViewMode,
          habitSortMode: state.habitSortMode,
          sortHabitsByPriorityFlag: state.sortHabitsByPriorityFlag,
          willpowerImage: state.willpowerImage,
          habitsControlPanelWidth: state.habitsControlPanelWidth,
          willpowerPhysicsHud: state.willpowerPhysicsHud,
          willpowerPhysics: state.willpowerPhysics,
          habitGems: state.habitGems,
          percentLedTint: state.percentLedTint,
          gradeTubeColor: state.gradeTubeColor,
          outputGradeTubeColor: state.outputGradeTubeColor,
          appearanceRev: state.appearanceRev,
          contentRev: 0,
          habitDayView: state.habitDayView,
          percentLoadingBar: state.percentLoadingBar,
          habitSmallLeds: state.habitSmallLeds,
          hideCompletedToday: state.hideCompletedToday,
          exemptionWand: state.exemptionWand,
          habitExemptions: emptyExemptionBooks(),
        })),
    }),
    {
      name: persistKey("habits-store"),
      version: HABITS_STORE_PERSIST_VERSION,
      storage: createCogsJSONStorage(),
      migrate: migrateHabitsState,
      merge: (persisted, current) => {
        const p = (persisted ?? {}) as Partial<HabitsState>
        const liveRev = typeof current.appearanceRev === "number" ? current.appearanceRev : 0
        const persistedRev = typeof p.appearanceRev === "number" ? p.appearanceRev : 0
        const keepLive = liveRev > persistedRev
        const liveContentRev = typeof current.contentRev === "number" ? current.contentRev : 0
        const persistedContentRev = typeof p.contentRev === "number" ? p.contentRev : 0
        const keepLiveContent = liveContentRev > persistedContentRev
        const diskTasks = Array.isArray(p.tasks) ? (p.tasks as WeeklyTask[]) : null
        const healSeedTasks =
          keepLiveContent && looksLikeSeedHabits(current.tasks) && diskTasks && !looksLikeSeedHabits(diskTasks)
        const sessionLed = readSessionPercentLedTint()
        const ledPin = readStoredPercentLedTint()
        const gradePin = readStoredTubeColor(GRADE_TUBE_COLOR_STORAGE_KEY)
        const outputPin = readStoredTubeColor(OUTPUT_TUBE_COLOR_STORAGE_KEY)
        const pick = (
          live: string,
          disk: string | undefined,
          pin: string | null,
        ) => {
          if (keepLive) return live
          if (persistedRev > 0) return disk ?? live
          return pin ?? disk ?? live
        }
        return {
          ...current,
          ...p,
          ...(keepLiveContent
            ? {
                // Real renames stay; a hollow seed with a bumped stamp must not
                // replace the vault grades/completions read.
                tasks: healSeedTasks ? diskTasks : current.tasks,
                categories:
                  healSeedTasks && Array.isArray(p.categories) ? (p.categories as Category[]) : current.categories,
                weeklyData: mergeCompletionData(current.weeklyData, p.weeklyData),
                weeklyHabitData: mergeCompletionData(current.weeklyHabitData, p.weeklyHabitData),
                monthlyHabitData: mergeCompletionData(current.monthlyHabitData, p.monthlyHabitData),
                habitExemptions: exemptionBooksEmpty(current.habitExemptions)
                  ? sanitizeExemptionBooks(p.habitExemptions)
                  : current.habitExemptions,
              }
            : {}),
          contentRev: Math.max(liveContentRev, persistedContentRev),
          appearanceRev: Math.max(liveRev, persistedRev),
          percentLedTint: sessionLed ?? pick(current.percentLedTint, p.percentLedTint, ledPin),
          gradeTubeColor: pick(current.gradeTubeColor, p.gradeTubeColor, gradePin),
          outputGradeTubeColor: pick(current.outputGradeTubeColor, p.outputGradeTubeColor, outputPin),
        }
      },
      onRehydrateStorage: () => (state) => {
        if (!state) return
        try {
          const sessionLed = readSessionPercentLedTint()
          const rev = typeof state.appearanceRev === "number" ? state.appearanceRev : 0
          if (sessionLed) {
            if (state.percentLedTint !== sessionLed) {
              queueMicrotask(() => useHabitsStore.setState({ percentLedTint: sessionLed }))
            }
            writeStoredPercentLedTint(sessionLed, { session: false })
          } else if (rev > 0 || state.percentLedTint !== DEFAULT_PERCENT_LED_TINT) {
            writeStoredPercentLedTint(state.percentLedTint, { session: false })
          }
          if (rev > 0 || state.gradeTubeColor !== DEFAULT_GRADE_TUBE_COLOR) {
            writeStoredTubeColor(GRADE_TUBE_COLOR_STORAGE_KEY, state.gradeTubeColor, DEFAULT_GRADE_TUBE_COLOR)
          }
          if (rev > 0 || state.outputGradeTubeColor !== DEFAULT_OUTPUT_TUBE_COLOR) {
            writeStoredTubeColor(OUTPUT_TUBE_COLOR_STORAGE_KEY, state.outputGradeTubeColor, DEFAULT_OUTPUT_TUBE_COLOR)
          }
          if (state.tasks?.length) {
            queueMicrotask(() => {
              useHabitsStore.setState((live) => {
                const next = stampMissingTaskGems(live.tasks)
                // Gems are not titles/details/completions — do not bump contentRev
                // or a late hub merge will treat this hollow-looking stamp as newer
                // and can blank Week grade / Perfect output.
                if (next === live.tasks) return live
                return { tasks: next }
              })
            })
          }
          const syncAwards = () => {
            const live = useHabitsStore.getState()
            if (!live.tasks?.length) return
            syncGradeBonusesFromState(live)
          }
          if (usePointsStore.persist.hasHydrated()) queueMicrotask(syncAwards)
          else {
            const unsub = usePointsStore.persist.onFinishHydration(() => {
              unsub()
              queueMicrotask(syncAwards)
            })
          }
        } catch {
          // Keep rehydrated rows even if gem stamp / pin sync fails.
        }
      },
    },
  ),
)

registerPersistRehydrator(persistKey("habits-store"), () => useHabitsStore.persist.rehydrate())

onAllNighterLogged((morning) => {
  resyncAllNighterMornings([morning])
})

// One-time migration of legacy localStorage data into the store.
if (typeof window !== "undefined") {
  try {
    const alreadyMigrated = readAliasedLocal(persistKey("habits-migrated"))
    const hasStore = readAliasedLocal(persistKey("habits-store"))
    if (!alreadyMigrated && !hasStore) {
      const lt = localStorage.getItem("weekly-habits-tasks")
      const lw = localStorage.getItem("weekly-habits-weeklyData")
      const lc = localStorage.getItem("weekly-habits-categories")
      if (lt || lw || lc) {
        useHabitsStore.getState().importData({
          tasks: lt && lt !== "[]" ? JSON.parse(lt) : getDefaultHabits(),
          weeklyData: lw && lw !== "{}" ? JSON.parse(lw) : {},
          categories: lc && lc !== "[]" ? JSON.parse(lc) : getDefaultHabitCategories(),
        })
      }
    }
    writeAliasedLocal(persistKey("habits-migrated"), "1")
  } catch {
    // ignore migration errors; defaults remain in place
  }
}
