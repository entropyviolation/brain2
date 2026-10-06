/**
 * lib/ingest/apply-ritual.ts — Text rituals (morning, night, start, end)
 *
 * Morning GM lives in `apply-morning-gm.ts`. This file walks end/night reviews,
 * start/planning rituals for week–year, and the rituals board. Re-exports
 * morning entry points. User-facing: Rituals; `reviews` / `review` still work.
 */
import { isClearedFromWork, withStatus } from "@/lib/completion-status"
import {
  taskScheduledInMonth,
  taskScheduledInWeek,
  taskScheduledInYear,
  taskScheduledOnDay,
} from "@/lib/date-utils"
import { itemTitleOrUntitled, pushTaskOnePeriod, resolveCompletionPoints } from "@/lib/item-utils"
import { getPendingReviews } from "@/lib/pending-reviews"
import { getStoredPlanText } from "@/lib/plan-text"
import { useRegretStore } from "@/lib/regret-store"
import {
  dateFromPeriodKey,
  getPeriodKey,
  localDayKey,
  nextPeriodDate,
  periodLabel,
  previousPeriodDate,
  useReviewsStore,
} from "@/lib/reviews-store"
import { formatRitualsBoard, listAvailableRituals } from "@/lib/rituals"
import { formatStarLordBoard, listStarLordSlots } from "@/lib/star-lord"
import { useStarLordStore } from "@/lib/star-lord-store"
import { useUserSettingsStore } from "@/lib/user-settings-store"
import { arcPrompts } from "@/lib/period-arc"
import { buildPeriodRitualStats } from "@/lib/period-ritual-stats"
import { pendingAssumedTasks } from "@/components/Reviews/AssumedTimesSection"
import { confirmAllTaskTimes, confirmTaskTimes } from "@/lib/services/completion-time-service"
import { blockedReasonToken } from "@/lib/blocked-reason"
import { useGoalsStore } from "@/lib/goals-store"
import { useHabitsStore } from "@/lib/habits-store"
import { usePointsStore } from "@/lib/points-store"
import { useTimeTrackingStore } from "@/lib/time-tracking-store"
import { useTaskStore } from "@/lib/task-store"
import { patchTodoCommitment } from "@/lib/todo-commitment"
import { isIndexListLine, parseIndexListLine } from "./index-list"
import type {
  BlockedReason,
  PeriodArcReflection,
  PeriodReview,
  PeriodStartRitual,
  ReviewPeriod,
  StoredBlockedReason,
  Task,
} from "@/lib/types"
import {
  advanceMorningGm,
  startMorningReviewGm,
  type MorningGmDraft,
  type MorningGmStep,
} from "./apply-morning-gm"
import { isRitualSkip } from "./ritual-skip"
import type { ApplyResult, PendingClarify } from "./types"

export { isRitualSkip }
export type { MorningGmDraft as RitualDraft }

const BLOCKED_REASONS = new Set<BlockedReason>([
  "no-energy",
  "missing-input",
  "procrastination",
  "no-time",
  "blocked-by-other",
  "other",
])

type PeriodStep =
  | "unfinished"
  | "assumed"
  | "stats"
  | "time-spent"
  | "arc"
  | "summary"
  | "gratitude"
  | "plan"
  | "wentWell"
  | "improve"
  | "learned"
  | "wake-reminder"
  | "matters"
  | "focus-goals"
  | "nextPlans"

type StartStep = "undone" | "priorities" | "mustDo" | "marks" | "intentions" | "plan" | "gratitude"

interface PeriodRitualDraft {
  flow: "period"
  periodKey: string
  period?: ReviewPeriod
  step: PeriodStep
  draft: {
    summary?: string
    gratitude?: string[]
    planReflection?: string
    wentWell?: string
    improve?: string
    learned?: string
    nextPlans?: string
    resolvedTaskIds?: string[]
    pushedTaskIds?: string[]
    blockedReasons?: Record<string, StoredBlockedReason>
    unfinishedIds?: string[]
    assumedIds?: string[]
    timeReflection?: string
    wakeReminder?: string
    tomorrowMatters?: string
    tomorrowFocusGoalIds?: string[]
    arc?: PeriodArcReflection
    arcIndex?: number
    arcOnReframe?: boolean
  }
}

interface StartRitualDraft {
  flow: "start"
  periodKey: string
  period: ReviewPeriod
  step: StartStep
  draft: {
    priorities?: string
    mustDo?: string
    undoneNotes?: string
    summary?: string
    nextPlans?: string
    gratitude?: string[]
    pulledTaskIds?: string[]
    unfinishedIds?: string[]
  }
}

type RitualPending = PendingClarify & {
  ritual: MorningGmDraft | PeriodRitualDraft | StartRitualDraft
}

function makePeriodPending(ritual: PeriodRitualDraft, now: Date, reply: string, kind: string): ApplyResult {
  const pending: RitualPending = {
    kind: "ritual" as PendingClarify["kind"],
    query: "",
    candidates: [],
    createdAt: now.toISOString(),
    ritual,
  }
  return {
    status: "needs_clarify",
    kind: kind as ApplyResult["kind"],
    reply,
    pending,
  } as ApplyResult
}

function makeStartPending(ritual: StartRitualDraft, now: Date, reply: string): ApplyResult {
  const pending: RitualPending = {
    kind: "ritual" as PendingClarify["kind"],
    query: "",
    candidates: [],
    createdAt: now.toISOString(),
    ritual,
  }
  return {
    status: "needs_clarify",
    kind: "reviews" as ApplyResult["kind"],
    reply,
    pending,
  } as ApplyResult
}

export function startMorningReview(now = new Date()): ApplyResult {
  return startMorningReviewGm(now)
}

export function startReviewsBoard(now = new Date()): ApplyResult {
  const reviews = useReviewsStore.getState().reviews
  const star = formatStarLordBoard(
    listStarLordSlots(useStarLordStore.getState().reports, now, useUserSettingsStore.getState().birthday),
  )
  return {
    status: "ok",
    kind: "reviews" as ApplyResult["kind"],
    reply: formatRitualsBoard(reviews, now) + star,
    summary: "Rituals board",
  } as ApplyResult
}

/** Day night / moon ritual for today. */
export function startNightRitual(now = new Date()): ApplyResult {
  return beginEndRitual("day", localDayKey(now), now)
}

function tasksScheduledInPeriod(tasks: Task[], period: ReviewPeriod, key: string): Task[] {
  const ref = dateFromPeriodKey(period, key)
  return tasks.filter((t) => {
    if (t.completed) return false
    switch (period) {
      case "day":
        return taskScheduledOnDay(t, ref)
      case "week":
        return taskScheduledInWeek(t, key)
      case "month":
        return taskScheduledInMonth(t, key)
      case "quarter": {
        return [0, 1, 2].some((i) => {
          const md = new Date(ref.getFullYear(), ref.getMonth() + i, 1)
          const mkey = `${md.getFullYear()}-${String(md.getMonth() + 1).padStart(2, "0")}`
          return taskScheduledInMonth(t, mkey)
        })
      }
      case "year":
        return taskScheduledInYear(t, key)
      default:
        return false
    }
  })
}

function periodSteps(period: ReviewPeriod): PeriodStep[] {
  const steps: PeriodStep[] = ["unfinished", "assumed"]
  if (period === "day") steps.push("time-spent")
  else steps.push("stats", "arc")
  steps.push("summary", "gratitude")
  if (period === "day" || period === "week" || period === "month") steps.push("plan")
  steps.push("wentWell", "improve", "learned")
  if (period === "day") steps.push("wake-reminder", "matters", "focus-goals")
  steps.push("nextPlans")
  return steps
}

function nextPeriodStep(period: ReviewPeriod, step: PeriodStep): PeriodStep | null {
  const steps = periodSteps(period)
  const idx = steps.indexOf(step)
  if (idx < 0 || idx >= steps.length - 1) return null
  return steps[idx + 1]!
}

const START_STEPS: StartStep[] = ["undone", "priorities", "mustDo", "marks", "intentions", "plan", "gratitude"]

function nextStartStep(step: StartStep): StartStep | null {
  const idx = START_STEPS.indexOf(step)
  if (idx < 0 || idx >= START_STEPS.length - 1) return null
  return START_STEPS[idx + 1]!
}

function previousKeyFor(period: ReviewPeriod, periodKey: string): string {
  const ref = dateFromPeriodKey(period, periodKey)
  const anchor = new Date(ref.getFullYear(), ref.getMonth(), ref.getDate(), 12, 0, 0)
  return getPeriodKey(period, previousPeriodDate(period, anchor))
}

type RitualDispatch =
  | { mode: "board" }
  | { mode: "morning" }
  | { mode: "end"; period: ReviewPeriod; key: string }
  | { mode: "start"; period: ReviewPeriod; key: string }

/**
 * Parse `review` / `ritual` payload into a ritual to open.
 * Keeps legacy: bare `review` → first due end; `review week` → week end;
 * `review today` → today's night. Adds `start week`, `end week`, `morning`, `night`.
 */
function resolveRitualWhich(which: string, now: Date): RitualDispatch {
  const raw = which.trim().toLowerCase().replace(/\s+/g, " ")
  const pending = getPendingReviews(useReviewsStore.getState().reviews, now)

  if (!raw || raw === "board" || raw === "list" || raw === "status") return { mode: "board" }
  if (raw === "morning" || raw === "gm" || raw === "sun") return { mode: "morning" }
  if (raw === "night" || raw === "gn" || raw === "moon" || raw === "evening") {
    return { mode: "end", period: "day", key: localDayKey(now) }
  }
  if (raw === "today") {
    return { mode: "end", period: "day", key: localDayKey(now) }
  }

  const startMatch = /^(?:start|plan)\s+(week|month|quarter|year|day)$/.exec(raw)
  if (startMatch) {
    const period = startMatch[1] as ReviewPeriod
    if (period === "day") return { mode: "morning" }
    return { mode: "start", period, key: getPeriodKey(period, now) }
  }

  const endMatch = /^(?:end|review)\s+(week|month|quarter|year|day)$/.exec(raw)
  if (endMatch) {
    const period = endMatch[1] as ReviewPeriod
    return { mode: "end", period, key: pending[period].key }
  }

  if (raw === "day" || raw === "week" || raw === "month" || raw === "quarter" || raw === "year") {
    return { mode: "end", period: raw, key: pending[raw].key }
  }

  if (raw === "start" || raw === "first" || raw === "next") {
    const open = listAvailableRituals(useReviewsStore.getState().reviews, now)
    const first = open[0]
    if (!first) return { mode: "board" }
    if (first.kind === "day-morning") return { mode: "morning" }
    if (first.phase === "start" && first.period !== "day") {
      return { mode: "start", period: first.period, key: first.periodKey }
    }
    return { mode: "end", period: first.period, key: first.periodKey }
  }

  return { mode: "board" }
}

function statsBlurb(period: ReviewPeriod, key: string, now: Date): string {
  if (period === "day") return "Night does not score the longer stats."
  const tasks = useTaskStore.getState()
  const habits = useHabitsStore.getState()
  const stats = buildPeriodRitualStats({
    period,
    periodKey: key,
    now,
    tasks: tasks.tasks,
    lists: tasks.lists,
    folders: tasks.folders,
    habits: habits.tasks,
    weeklyData: habits.weeklyData,
    points: usePointsStore.getState().pointsHistory,
    entries: useTimeTrackingStore.getState().entries,
    scopes: useTimeTrackingStore.getState().scopes,
    tolerance: habits.gradeTolerance,
    pointsForTask: (task) => resolveCompletionPoints(task, tasks.lists, tasks.folders),
  })
  const lines = [
    `Points ${stats.points.current} this period, ${stats.points.previous} last period.`,
    `${stats.habitGrade.label} ${Math.round(stats.habitGrade.current)}% vs ${Math.round(stats.habitGrade.previous)}% last period.`,
  ]
  if (stats.missed.length) lines.push(`Missed: ${stats.missed.slice(0, 6).map((row) => row.title).join(", ")}`)
  if (stats.habitsNever.length) {
    lines.push(`Daily habits never done: ${stats.habitsNever.map((habit) => habit.name).join(", ")}`)
  } else {
    lines.push("Every daily habit was touched at least once.")
  }
  const tracking = stats.tracking
    .flatMap((scope) => scope.rows.slice(0, 3).map((row) => `${scope.scopeName} ${row.name}`))
    .slice(0, 6)
  if (tracking.length) lines.push(`Where the time went: ${tracking.join(", ")}`)
  return lines.join("\n")
}

function arcPromptText(ritual: PeriodRitualDraft, skipHint: string): string {
  const prompts = arcPrompts(ritual.period!)
  const index = ritual.draft.arcIndex ?? 0
  const prompt = prompts[index]
  if (!prompt) return `Longer reflection is done.\n${skipHint}`
  if (ritual.draft.arcOnReframe && prompt.reframe) {
    return `${prompt.label}\n${prompt.reframe.question}\n${skipHint}`
  }
  const photo = prompt.photos ? "\nPhotos stay in the app. A sentence here is enough." : ""
  return `${prompt.group}\n${prompt.label}\n${prompt.question}${photo}\n${skipHint}`
}

function advanceArc(ritual: PeriodRitualDraft, trimmed: string, now: Date): ApplyResult {
  const period = ritual.period!
  const prompts = arcPrompts(period)
  const index = ritual.draft.arcIndex ?? 0
  const prompt = prompts[index]
  const finish = () => {
    const next = nextPeriodStep(period, "arc")
    if (!next) return savePeriod(ritual, now)
    ritual.step = next
    return makePeriodPending(ritual, now, periodPrompt(next, ritual, now), "reviews")
  }
  if (!prompt) return finish()
  const arc = { ...(ritual.draft.arc ?? {}) } as PeriodArcReflection
  if (ritual.draft.arcOnReframe && prompt.reframe) {
    if (!isRitualSkip(trimmed)) arc.fearReframe = trimmed
    ritual.draft.arcOnReframe = false
    ritual.draft.arcIndex = index + 1
  } else if (isRitualSkip(trimmed)) {
    ritual.draft.arcOnReframe = false
    ritual.draft.arcIndex = index + 1
  } else {
    const textArc = arc as Record<string, string | undefined>
    textArc[prompt.id] = trimmed
    if (prompt.reframe) {
      ritual.draft.arc = arc
      ritual.draft.arcOnReframe = true
      ritual.step = "arc"
      return makePeriodPending(ritual, now, periodPrompt("arc", ritual, now), "reviews")
    }
    ritual.draft.arcIndex = index + 1
  }
  ritual.draft.arc = arc
  if ((ritual.draft.arcIndex ?? 0) >= prompts.length) return finish()
  ritual.step = "arc"
  return makePeriodPending(ritual, now, periodPrompt("arc", ritual, now), "reviews")
}

function applyStartMarks(ritual: StartRitualDraft, text: string) {
  const ids = ritual.draft.unfinishedIds ?? []
  const required = new Set<number>()
  const priority = new Set<number>()
  for (const line of text.split("\n").map((row) => row.trim()).filter(Boolean)) {
    const req = /^(?:required|r)\s*:\s*(.+)$/i.exec(line)
    const pri = /^(?:priority|prioritized|p)\s*:\s*(.+)$/i.exec(line)
    if (req && isIndexListLine(req[1] ?? "")) {
      for (const n of parseIndexListLine(req[1] ?? "", ids.length)) required.add(n)
      continue
    }
    if (pri && isIndexListLine(pri[1] ?? "")) {
      for (const n of parseIndexListLine(pri[1] ?? "", ids.length)) priority.add(n)
      continue
    }
    if (isIndexListLine(line)) {
      for (const n of parseIndexListLine(line, ids.length)) required.add(n)
    }
  }
  const store = useTaskStore.getState()
  for (let i = 0; i < ids.length; i++) {
    const n = i + 1
    if (!required.has(n) && !priority.has(n)) continue
    const task = store.tasks.find((row) => row.id === ids[i])
    if (!task) continue
    store.updateTask(
      patchTodoCommitment(task, ritual.period, ritual.periodKey, {
        ...(required.has(n) ? { required: true } : {}),
        ...(priority.has(n) ? { prioritized: true } : {}),
      }),
    )
  }
}

function periodPrompt(step: PeriodStep, ritual: PeriodRitualDraft, _now: Date): string {
  const skipHint = "Answer or send skip (blank counts)."
  const period = ritual.period!
  const key = ritual.periodKey

  switch (step) {
    case "unfinished": {
      const open = tasksScheduledInPeriod(useTaskStore.getState().tasks, period, key).filter(
        (t) => !isClearedFromWork(t),
      )
      ritual.draft.unfinishedIds = open.map((t) => t.id)
      if (open.length === 0) {
        return `No unfinished tasks in this ${period}. Reply skip to continue.\n${skipHint}`
      }
      return [
        `Unfinished (${periodLabel(period, key)}). Commands: 1 done · 2 push · 3 no-time · all done · all push · skip`,
        ...open.map((t, i) => `${i + 1}. ${itemTitleOrUntitled(t)}`),
        skipHint,
      ].join("\n")
    }
    case "assumed": {
      const pending = pendingAssumedTasks(useTaskStore.getState().tasks, period, key)
      ritual.draft.assumedIds = pending.map((task) => task.id)
      if (pending.length === 0) {
        return `No assumed times to confirm for this ${period}. Reply skip to continue.\n${skipHint}`
      }
      return [
        `Assumed times (${pending.length}). Reply confirm to accept them, “1 confirm” for one row, or skip to leave them open.`,
        ...pending.map((task, i) => `${i + 1}. ${itemTitleOrUntitled(task)}`),
        skipHint,
      ].join("\n")
    }
    case "stats":
      return `${statsBlurb(period, key, _now)}\n\nReply skip to continue. These numbers are not a question.`
    case "time-spent":
      return `How the day was spent — a short note on the time grid, day log, and activity log (open them in the app if you want the picture).${
        ritual.draft.timeReflection ? ` Saved: ${ritual.draft.timeReflection}` : ""
      }\n${skipHint}`
    case "arc":
      return arcPromptText(ritual, skipHint)
    case "wake-reminder":
      return `Things you'd like to remind yourself when you wake up? Shown at the top of tomorrow's morning ritual. Skip to leave it empty.\n${skipHint}`
    case "matters":
      return `What matters most tomorrow?\n${skipHint}`
    case "focus-goals": {
      const goals = useGoalsStore.getState().goals.filter((goal) => !goal.completed)
      if (goals.length === 0) return `No open goals. Reply skip to continue.\n${skipHint}`
      return [
        "Goals to focus on tomorrow? A line of comma-separated numbers (1, 3). Tasks that serve them lead tomorrow's morning list.",
        ...goals.map((goal, i) => `${i + 1}. ${goal.title}`),
        skipHint,
      ].join("\n")
    }
    case "summary":
      return `Summary of the ${period}?\n${skipHint}`
    case "gratitude":
      return `Gratitude? One per line, or skip.\n${skipHint}`
    case "plan": {
      const plan =
        period === "day" || period === "week" || period === "month"
          ? getStoredPlanText(period, key)?.trim()
          : null
      if (plan) {
        return [`Your plan for this ${period}:`, plan, "", `How did the plan go?\n${skipHint}`].join(
          "\n",
        )
      }
      return `No stored plan. Reflect on the plan anyway, or skip.\n${skipHint}`
    }
    case "wentWell":
      return `What went well?\n${skipHint}`
    case "improve":
      return `What could improve?\n${skipHint}`
    case "learned":
      return `What did you learn?\n${skipHint}`
    case "nextPlans":
      return `Plans for next ${period}?\n${skipHint}`
  }
}

function startPrompt(step: StartStep, ritual: StartRitualDraft): string {
  const skipHint = "Answer or send skip (blank counts)."
  const period = ritual.period
  const key = ritual.periodKey
  switch (step) {
    case "undone": {
      const lastKey = previousKeyFor(period, key)
      const open = tasksScheduledInPeriod(useTaskStore.getState().tasks, period, lastKey).filter(
        (t) => !isClearedFromWork(t),
      )
      ritual.draft.unfinishedIds = open.map((t) => t.id)
      if (open.length === 0) {
        return `Nothing undone from last ${period}. Reply skip, or note anything to remember.\n${skipHint}`
      }
      return [
        `Undone from last ${period} (${periodLabel(period, lastKey)}). Commands: 1 pull · all pull · skip (or free-text notes)`,
        ...open.map((t, i) => `${i + 1}. ${itemTitleOrUntitled(t)}`),
        skipHint,
      ].join("\n")
    }
    case "priorities":
      return `Priorities for this ${period}? A few lines.\n${skipHint}`
    case "mustDo":
      return `What MUST be done this ${period}?\n${skipHint}`
    case "marks": {
      const open = tasksScheduledInPeriod(useTaskStore.getState().tasks, period, key).filter(
        (task) => !isClearedFromWork(task),
      )
      ritual.draft.unfinishedIds = open.map((task) => task.id)
      if (open.length === 0) {
        return `No assigned tasks to mark required or prioritized. Reply skip.\n${skipHint}`
      }
      return [
        `Mark assigned tasks. required: 1, 8 and/or priority: 2, 3. A line that is only comma-separated numbers marks those required. Skip leaves marks unchanged.`,
        ...open.map((task, i) => `${i + 1}. ${itemTitleOrUntitled(task)}`),
        skipHint,
      ].join("\n")
    }
    case "intentions":
      return `Intentions — what do you want from this ${period}?\n${skipHint}`
    case "plan":
      return `Concrete plan for ${periodLabel(period, key)}?\n${skipHint}`
    case "gratitude":
      return `Gratitude? One per line, or skip.\n${skipHint}`
  }
}

function pushTaskForPeriod(task: Task, period: ReviewPeriod, key: string): void {
  if (period === "day" || period === "week" || period === "month") {
    const patch = pushTaskOnePeriod(task, period, dateFromPeriodKey(period, key))
    useTaskStore.getState().updateTask({ ...task, ...patch })
    return
  }
  const next = nextPeriodDate(period, dateFromPeriodKey(period, key))
  const cleared = {
    scheduledDate: undefined,
    scheduledWeek: undefined,
    scheduledMonth: undefined,
    scheduledYear: undefined,
  }
  if (period === "quarter") {
    useTaskStore.getState().updateTask({
      ...task,
      ...cleared,
      scheduledMonth: `${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, "0")}`,
      monthsPushed: (task.monthsPushed ?? 0) + 1,
    })
    return
  }
  useTaskStore.getState().updateTask({
    ...task,
    ...cleared,
    scheduledYear: String(next.getFullYear()),
  })
}

function savePeriod(ritual: PeriodRitualDraft, now: Date): ApplyResult {
  const period = ritual.period!
  const key = ritual.periodKey
  const existing = useReviewsStore.getState().getReview(period, key)
  const draft = ritual.draft
  const reflections: Record<string, string> = {}
  if (draft.wentWell) reflections.wentWell = draft.wentWell
  if (draft.improve) reflections.improve = draft.improve
  if (draft.learned) reflections.learned = draft.learned

  const review: PeriodReview = {
    id: `${period}:${key}`,
    period,
    periodKey: key,
    completedAt: now,
    endCompleted: true,
    summary: draft.summary ?? "",
    gratitude: draft.gratitude ?? [],
    nextPlans: draft.nextPlans ?? "",
    reflections,
    planReflection: draft.planReflection?.trim() || undefined,
    timeReflection: draft.timeReflection?.trim() || undefined,
    wakeReminder: draft.wakeReminder?.trim() || undefined,
    tomorrowMatters: draft.tomorrowMatters?.trim() || undefined,
    tomorrowFocusGoalIds: draft.tomorrowFocusGoalIds?.length ? draft.tomorrowFocusGoalIds : undefined,
    arc: draft.arc && Object.keys(draft.arc).length ? draft.arc : undefined,
    resolvedTaskIds: draft.resolvedTaskIds ?? [],
    pushedTaskIds: draft.pushedTaskIds ?? [],
    blockedReasons:
      draft.blockedReasons && Object.keys(draft.blockedReasons).length
        ? draft.blockedReasons
        : undefined,
    ...(existing?.morning ? { morning: existing.morning } : {}),
    ...(existing?.start ? { start: existing.start } : {}),
  }
  useReviewsStore.getState().saveReview(review)

  const resolved = new Set(draft.resolvedTaskIds ?? [])
  const incomplete = tasksScheduledInPeriod(useTaskStore.getState().tasks, period, key)
  for (const task of incomplete) {
    const reason = draft.blockedReasons?.[task.id]
    if (reason && !resolved.has(task.id)) {
      useRegretStore
        .getState()
        .addRegret(task.id, task.importance ?? 1, itemTitleOrUntitled(task), now, blockedReasonToken(reason) || undefined)
    }
  }

  const label = period === "day" ? "Night ritual" : "Review ritual"
  return {
    status: "ok",
    kind: "reviews" as ApplyResult["kind"],
    reply: `${periodLabel(period, key)} ${label.toLowerCase()} saved.`,
    summary: `Review ${period}:${key}`,
  } as ApplyResult
}

function saveStart(ritual: StartRitualDraft, now: Date): ApplyResult {
  const slice: PeriodStartRitual = {
    completed: true,
    priorities: ritual.draft.priorities,
    mustDo: ritual.draft.mustDo,
    undoneNotes: ritual.draft.undoneNotes,
    summary: ritual.draft.summary,
    nextPlans: ritual.draft.nextPlans,
    gratitude: ritual.draft.gratitude ?? [],
    pulledTaskIds: ritual.draft.pulledTaskIds,
    source: "telegram",
  }
  useReviewsStore.getState().replaceStartRitual(ritual.period, ritual.periodKey, slice)
  return {
    status: "ok",
    kind: "reviews" as ApplyResult["kind"],
    reply: `${periodLabel(ritual.period, ritual.periodKey)} start ritual saved.`,
    summary: `Start ${ritual.period}:${ritual.periodKey}`,
  } as ApplyResult
}

function beginEndRitual(period: ReviewPeriod, key: string, now: Date): ApplyResult {
  const ritual: PeriodRitualDraft = {
    flow: "period",
    period,
    periodKey: key,
    step: "unfinished",
    draft: {
      resolvedTaskIds: [],
      pushedTaskIds: [],
      blockedReasons: {},
    },
  }
  const reply = periodPrompt("unfinished", ritual, now)
  return makePeriodPending(ritual, now, reply, "reviews")
}

function beginStartRitual(period: ReviewPeriod, key: string, now: Date): ApplyResult {
  const ritual: StartRitualDraft = {
    flow: "start",
    period,
    periodKey: key,
    step: "undone",
    draft: { pulledTaskIds: [] },
  }
  return makeStartPending(ritual, now, startPrompt("undone", ritual))
}

/**
 * Open an end/review ritual, start/planning ritual, morning, night, or the board.
 * Payload examples: ``, `week`, `today`, `start week`, `end month`, `night`, `morning`.
 */
export function startPeriodReview(which: string, now = new Date()): ApplyResult {
  const resolved = resolveRitualWhich(which, now)
  if (resolved.mode === "board") return startReviewsBoard(now)
  if (resolved.mode === "morning") return startMorningReview(now)
  if (resolved.mode === "start") return beginStartRitual(resolved.period, resolved.key, now)
  return beginEndRitual(resolved.period, resolved.key, now)
}

function advancePeriod(ritual: PeriodRitualDraft, text: string, now: Date): ApplyResult {
  const step = ritual.step as PeriodStep
  const period = ritual.period!
  const trimmed = text.trim()
  const lower = trimmed.toLowerCase()

  if (step === "unfinished") {
    if (isRitualSkip(trimmed)) {
      // continue
    } else if (lower === "all done") {
      const ids = ritual.draft.unfinishedIds ?? []
      for (const id of ids) {
        const task = useTaskStore.getState().tasks.find((t) => t.id === id)
        if (!task || isClearedFromWork(task)) continue
        useTaskStore.getState().updateTask(withStatus(task, "done", now))
        ritual.draft.resolvedTaskIds = [...new Set([...(ritual.draft.resolvedTaskIds ?? []), id])]
      }
    } else if (lower === "all push") {
      const ids = ritual.draft.unfinishedIds ?? []
      for (const id of ids) {
        const task = useTaskStore.getState().tasks.find((t) => t.id === id)
        if (!task || isClearedFromWork(task)) continue
        pushTaskForPeriod(task, period, ritual.periodKey)
        ritual.draft.pushedTaskIds = [...new Set([...(ritual.draft.pushedTaskIds ?? []), id])]
      }
    } else {
      const m = trimmed.match(/^(\d+)\s+(\S+)(?:\s+([\s\S]+))?$/i)
      if (m) {
        const idx = Number(m[1]) - 1
        const cmd = m[2]!.toLowerCase()
        const extra = m[3]?.trim()
        const id = ritual.draft.unfinishedIds?.[idx]
        const task = id ? useTaskStore.getState().tasks.find((t) => t.id === id) : undefined
        if (task) {
          if (cmd === "done") {
            useTaskStore.getState().updateTask(withStatus(task, "done", now))
            ritual.draft.resolvedTaskIds = [
              ...new Set([...(ritual.draft.resolvedTaskIds ?? []), task.id]),
            ]
          } else if (cmd === "push") {
            pushTaskForPeriod(task, period, ritual.periodKey)
            ritual.draft.pushedTaskIds = [
              ...new Set([...(ritual.draft.pushedTaskIds ?? []), task.id]),
            ]
          } else if (BLOCKED_REASONS.has(cmd as BlockedReason)) {
            const stored: StoredBlockedReason =
              cmd === "other" && extra ? { reason: "other", note: extra } : (cmd as BlockedReason)
            ritual.draft.blockedReasons = {
              ...(ritual.draft.blockedReasons ?? {}),
              [task.id]: stored,
            }
          }
        }
        ritual.step = "unfinished"
        return makePeriodPending(ritual, now, periodPrompt("unfinished", ritual, now), "reviews")
      }
      return makePeriodPending(
        ritual,
        now,
        `Try “1 done”, “2 push”, “3 no-time”, all done, all push, or skip.\n${periodPrompt("unfinished", ritual, now)}`,
        "reviews",
      )
    }

    const next = nextPeriodStep(period, step)
    if (!next) return savePeriod(ritual, now)
    ritual.step = next
    return makePeriodPending(ritual, now, periodPrompt(next, ritual, now), "reviews")
  }

  if (step === "assumed") {
    const ids = ritual.draft.assumedIds ?? []
    const one = trimmed.match(/^(\d+)\s+confirm$/i)
    if (one) {
      const id = ids[Number(one[1]) - 1]
      if (id) confirmTaskTimes(id)
      return makePeriodPending(ritual, now, periodPrompt("assumed", ritual, now), "reviews")
    }
    if (/^(confirm|all confirm|looks right)$/i.test(trimmed)) confirmAllTaskTimes(ids)
  } else if (step === "stats") {
    // Numbers only. Any reply, including skip, moves on.
  } else if (step === "time-spent") {
    ritual.draft.timeReflection = isRitualSkip(trimmed) ? undefined : trimmed
  } else if (step === "arc") {
    return advanceArc(ritual, trimmed, now)
  } else if (step === "wake-reminder") {
    ritual.draft.wakeReminder = isRitualSkip(trimmed) ? undefined : trimmed
  } else if (step === "matters") {
    ritual.draft.tomorrowMatters = isRitualSkip(trimmed) ? undefined : trimmed
  } else if (step === "focus-goals") {
    if (!isRitualSkip(trimmed)) {
      const goals = useGoalsStore.getState().goals.filter((goal) => !goal.completed)
      const picked: string[] = []
      for (const line of trimmed.split("\n")) {
        if (!isIndexListLine(line)) continue
        for (const n of parseIndexListLine(line, goals.length)) {
          const goal = goals[n - 1]
          if (goal) picked.push(goal.id)
        }
      }
      ritual.draft.tomorrowFocusGoalIds = [...new Set(picked)]
    }
  } else if (step === "summary") {
    ritual.draft.summary = isRitualSkip(trimmed) ? "" : trimmed
  } else if (step === "gratitude") {
    ritual.draft.gratitude = isRitualSkip(trimmed)
      ? []
      : trimmed
          .split("\n")
          .map((l) => l.trim())
          .filter(Boolean)
  } else if (step === "plan") {
    ritual.draft.planReflection = isRitualSkip(trimmed) ? undefined : trimmed
  } else if (step === "wentWell") {
    ritual.draft.wentWell = isRitualSkip(trimmed) ? undefined : trimmed
  } else if (step === "improve") {
    ritual.draft.improve = isRitualSkip(trimmed) ? undefined : trimmed
  } else if (step === "learned") {
    ritual.draft.learned = isRitualSkip(trimmed) ? undefined : trimmed
  } else if (step === "nextPlans") {
    ritual.draft.nextPlans = isRitualSkip(trimmed) ? "" : trimmed
    return savePeriod(ritual, now)
  }

  const next = nextPeriodStep(period, step)
  if (!next) return savePeriod(ritual, now)
  ritual.step = next
  return makePeriodPending(ritual, now, periodPrompt(next, ritual, now), "reviews")
}

function advanceStart(ritual: StartRitualDraft, text: string, now: Date): ApplyResult {
  const step = ritual.step
  const trimmed = text.trim()
  const lower = trimmed.toLowerCase()

  if (step === "undone") {
    if (isRitualSkip(trimmed)) {
      // continue
    } else if (lower === "all pull") {
      const ids = ritual.draft.unfinishedIds ?? []
      const lastKey = previousKeyFor(ritual.period, ritual.periodKey)
      for (const id of ids) {
        const task = useTaskStore.getState().tasks.find((t) => t.id === id)
        if (!task || isClearedFromWork(task)) continue
        pushTaskForPeriod(task, ritual.period, lastKey)
        ritual.draft.pulledTaskIds = [...new Set([...(ritual.draft.pulledTaskIds ?? []), id])]
      }
    } else {
      const m = trimmed.match(/^(\d+)\s+pull$/i)
      if (m) {
        const idx = Number(m[1]) - 1
        const id = ritual.draft.unfinishedIds?.[idx]
        const task = id ? useTaskStore.getState().tasks.find((t) => t.id === id) : undefined
        if (task) {
          const lastKey = previousKeyFor(ritual.period, ritual.periodKey)
          pushTaskForPeriod(task, ritual.period, lastKey)
          ritual.draft.pulledTaskIds = [...new Set([...(ritual.draft.pulledTaskIds ?? []), task.id])]
        }
        return makeStartPending(ritual, now, startPrompt("undone", ritual))
      }
      ritual.draft.undoneNotes = trimmed
    }
    const next = nextStartStep(step)
    if (!next) return saveStart(ritual, now)
    ritual.step = next
    return makeStartPending(ritual, now, startPrompt(next, ritual))
  }

  if (step === "priorities") {
    ritual.draft.priorities = isRitualSkip(trimmed) ? undefined : trimmed
  } else if (step === "mustDo") {
    ritual.draft.mustDo = isRitualSkip(trimmed) ? undefined : trimmed
  } else if (step === "marks") {
    if (!isRitualSkip(trimmed)) applyStartMarks(ritual, trimmed)
  } else if (step === "intentions") {
    ritual.draft.summary = isRitualSkip(trimmed) ? undefined : trimmed
  } else if (step === "plan") {
    ritual.draft.nextPlans = isRitualSkip(trimmed) ? undefined : trimmed
  } else if (step === "gratitude") {
    ritual.draft.gratitude = isRitualSkip(trimmed)
      ? []
      : trimmed
          .split("\n")
          .map((l) => l.trim())
          .filter(Boolean)
    return saveStart(ritual, now)
  }

  const next = nextStartStep(step)
  if (!next) return saveStart(ritual, now)
  ritual.step = next
  return makeStartPending(ritual, now, startPrompt(next, ritual))
}

export function advanceRitual(pending: PendingClarify, text: string, now = new Date()): ApplyResult {
  const raw = (pending as RitualPending).ritual
  if (!raw) {
    return {
      status: "error",
      kind: "morning" as ApplyResult["kind"],
      reply: "No ritual in progress.",
    } as ApplyResult
  }

  if (raw.flow === "morning") {
    const morning: MorningGmDraft = {
      flow: "morning",
      periodKey: raw.periodKey,
      step: raw.step as MorningGmStep,
      draft: raw.draft as MorningGmDraft["draft"],
    }
    return advanceMorningGm(morning, text, now)
  }

  if (raw.flow === "start") {
    return advanceStart(raw as StartRitualDraft, text, now)
  }

  if (raw.flow === "period" || (raw as PeriodRitualDraft).period) {
    const periodRitual = raw as PeriodRitualDraft
    return advancePeriod(
      {
        flow: "period",
        periodKey: periodRitual.periodKey,
        period: periodRitual.period,
        step: periodRitual.step,
        draft: periodRitual.draft,
      },
      text,
      now,
    )
  }

  // Legacy shape: flow was the period name.
  const legacyPeriod = raw.flow as ReviewPeriod
  if (["day", "week", "month", "quarter", "year"].includes(legacyPeriod)) {
    return advancePeriod(
      {
        flow: "period",
        periodKey: raw.periodKey,
        period: legacyPeriod,
        step: raw.step as PeriodStep,
        draft: raw.draft as PeriodRitualDraft["draft"],
      },
      text,
      now,
    )
  }

  return {
    status: "error",
    kind: "reviews" as ApplyResult["kind"],
    reply: "Unknown ritual flow.",
  } as ApplyResult
}
