/**
 * lib/ingest/apply-ritual.ts — Text morning review + end-of-period review
 *
 * Morning GM lives in `apply-morning-gm.ts` (all-nighter, affirmations one-by-one,
 * to-do add/priorities, circumstance branches). This file keeps period reviews
 * and re-exports the morning entry points.
 */
import { isClearedFromWork, withStatus } from "@/lib/completion-status"
import {
  taskScheduledInMonth,
  taskScheduledInWeek,
  taskScheduledInYear,
  taskScheduledOnDay,
} from "@/lib/date-utils"
import { itemTitleOrUntitled, pushTaskOnePeriod } from "@/lib/item-utils"
import { getPendingReviews } from "@/lib/pending-reviews"
import { getStoredPlanText } from "@/lib/plan-text"
import { useRegretStore } from "@/lib/regret-store"
import {
  dateFromPeriodKey,
  localDayKey,
  nextPeriodDate,
  periodLabel,
  useReviewsStore,
} from "@/lib/reviews-store"
import { useTaskStore } from "@/lib/task-store"
import type { BlockedReason, PeriodReview, ReviewPeriod, Task } from "@/lib/types"
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
  | "summary"
  | "gratitude"
  | "plan"
  | "wentWell"
  | "improve"
  | "learned"
  | "nextPlans"

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
    blockedReasons?: Record<string, BlockedReason>
    unfinishedIds?: string[]
  }
}

type RitualPending = PendingClarify & { ritual: MorningGmDraft | PeriodRitualDraft }

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

export function startMorningReview(now = new Date()): ApplyResult {
  return startMorningReviewGm(now)
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
        const start = new Date(ref.getFullYear(), ref.getMonth(), 1)
        return [0, 1, 2].some((i) => {
          const md = new Date(start.getFullYear(), start.getMonth() + i, 1)
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
  const steps: PeriodStep[] = ["unfinished", "summary", "gratitude"]
  if (period === "day" || period === "week" || period === "month") steps.push("plan")
  steps.push("wentWell", "improve", "learned", "nextPlans")
  return steps
}

function nextPeriodStep(period: ReviewPeriod, step: PeriodStep): PeriodStep | null {
  const steps = periodSteps(period)
  const idx = steps.indexOf(step)
  if (idx < 0 || idx >= steps.length - 1) return null
  return steps[idx + 1]!
}

function formatReviewsBoard(now: Date): string {
  const reviews = useReviewsStore.getState().reviews
  const pending = getPendingReviews(reviews, now)
  const dayKey = localDayKey(now)
  const morning = useReviewsStore.getState().getMorningReview(dayKey)
  const lines = ["Reviews board"]
  lines.push(`Morning today (${dayKey}): ${morning ? "done" : "not yet"}`)
  for (const period of ["day", "week", "month", "quarter", "year"] as ReviewPeriod[]) {
    const slot = pending[period]
    const label = periodLabel(period, slot.key)
    lines.push(`${period}: ${slot.needed ? `due · ${label}` : `done · ${label}`}`)
  }
  lines.push("")
  lines.push(
    "gm for morning · review to start the first due review · review today / review day / review week|month|quarter|year",
  )
  return lines.join("\n")
}

export function startReviewsBoard(now = new Date()): ApplyResult {
  return {
    status: "ok",
    kind: "reviews" as ApplyResult["kind"],
    reply: formatReviewsBoard(now),
    summary: "Reviews board",
  } as ApplyResult
}

function resolvePeriodWhich(
  which: string,
  now: Date,
): { period: ReviewPeriod; key: string } | null {
  const reviews = useReviewsStore.getState().reviews
  const pending = getPendingReviews(reviews, now)
  const raw = which.trim().toLowerCase()

  if (raw === "today") {
    return { period: "day", key: localDayKey(now) }
  }
  if (raw === "day") {
    return { period: "day", key: pending.day.key }
  }
  if (raw === "week" || raw === "month" || raw === "quarter" || raw === "year") {
    return { period: raw, key: pending[raw].key }
  }
  if (raw === "" || raw === "start") {
    for (const period of ["day", "week", "month", "quarter", "year"] as ReviewPeriod[]) {
      if (pending[period].needed) {
        return { period, key: pending[period].key }
      }
    }
    return null
  }
  return null
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
    summary: draft.summary ?? "",
    gratitude: draft.gratitude ?? [],
    nextPlans: draft.nextPlans ?? "",
    reflections,
    planReflection: draft.planReflection?.trim() || undefined,
    resolvedTaskIds: draft.resolvedTaskIds ?? [],
    pushedTaskIds: draft.pushedTaskIds ?? [],
    blockedReasons:
      draft.blockedReasons && Object.keys(draft.blockedReasons).length
        ? draft.blockedReasons
        : undefined,
    ...(existing?.morning ? { morning: existing.morning } : {}),
  }
  useReviewsStore.getState().saveReview(review)

  const resolved = new Set(draft.resolvedTaskIds ?? [])
  const incomplete = tasksScheduledInPeriod(useTaskStore.getState().tasks, period, key)
  for (const task of incomplete) {
    const reason = draft.blockedReasons?.[task.id]
    if (reason && !resolved.has(task.id)) {
      useRegretStore
        .getState()
        .addRegret(task.id, task.importance ?? 1, itemTitleOrUntitled(task), now, reason)
    }
  }

  return {
    status: "ok",
    kind: "reviews" as ApplyResult["kind"],
    reply: `${periodLabel(period, key)} review saved.`,
    summary: `Review ${period}:${key}`,
  } as ApplyResult
}

export function startPeriodReview(which: string, now = new Date()): ApplyResult {
  const resolved = resolvePeriodWhich(which, now)
  if (!resolved) return startReviewsBoard(now)

  const ritual: PeriodRitualDraft = {
    flow: "period",
    period: resolved.period,
    periodKey: resolved.key,
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
      const m = trimmed.match(/^(\d+)\s+(\S+)$/i)
      if (m) {
        const idx = Number(m[1]) - 1
        const cmd = m[2]!.toLowerCase()
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
            ritual.draft.blockedReasons = {
              ...(ritual.draft.blockedReasons ?? {}),
              [task.id]: cmd as BlockedReason,
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

  if (step === "summary") {
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
