/**
 * lib/ingest/apply-morning-gm.ts — Text morning review (GM) for BIM
 *
 * Flow: sleep (or all nighter) → 5 affirmations one-at-a-time → today's to-dos
 * (add + 3–5 priorities) → daily habit priorities (1–3) → go through each to-do
 * (six-slot tier/duration/points/importance/resistance/excitement) → plaintext
 * day plan → branching circumstances → best day → 10 gratitude.
 *
 * Wired from apply-ritual via startMorningReview / advanceMorningGm so the
 * period-review path stays untouched.
 */
import {
  AFFIRMATIONS_LIST_NAME,
  AFFIRMATIONS_PER_SESSION,
  DEFAULT_AFFIRMATIONS,
  affirmationText,
  findAffirmationsCategory,
  getAffirmationItems,
  pickRandom,
} from "@/lib/affirmations"
import { createScheduledTodoTask } from "@/components/Home/ToDo/todo-utils"
import { itemTitleOrUntitled } from "@/lib/item-utils"
import {
  applyTodoWalkSlots,
  formatTodoWalkCurrent,
  parseTodoWalkReply,
  todoWalkGrammarHelp,
} from "@/lib/morning-todo-walk"
import { appendPlanEntry } from "@/lib/plan-text"
import { localDayKey } from "@/lib/reviews-store"
import { useReviewsStore } from "@/lib/reviews-store"
import { inferNight } from "@/lib/sleep-inference"
import { offsetToClock, parseBedtime, parseWakeTime } from "@/lib/sleep-log"
import { useSleepStore } from "@/lib/sleep-store"
import { useHabitsStore } from "@/lib/habits-store"
import { useTaskStore } from "@/lib/task-store"
import { useTimeTrackingStore } from "@/lib/time-tracking-store"
import type { PeriodReview } from "@/lib/types"
import { openTodoToday } from "./apply-todos"
import { parseBedClock, parseWakeClock } from "./times"
import type { ApplyResult, PendingClarify } from "./types"
import { isRitualSkip } from "./ritual-skip"

const LOGGED_FROM_TEXT = "logged from text"
const ALL_NIGHTER_RE = /^all[\s-]*nighters?$/i

export type MorningGmStep =
  | "again"
  | "bed"
  | "wake"
  | "dream"
  | "affirmation"
  | "todo-show"
  | "todo-add"
  | "todo-priorities"
  | "habit-priorities"
  | "todo-walk"
  | "day-plan"
  | "circumstances"
  | "must-do"
  | "must-not-do"
  | "new-events"
  | "excited"
  | "best-day"
  | "gratitude"

export interface MorningGmDraft {
  flow: "morning"
  periodKey: string
  step: MorningGmStep
  draft: {
    bedTime?: string
    wakeTime?: string
    dream?: string
    allNighter?: boolean
    affirmations?: string[]
    shownAffirmations?: string[]
    affirmationIndex?: number
    todosAddedIds?: string[]
    priorityTaskIds?: string[]
    priorityHabitIds?: string[]
    unfinishedIds?: string[]
    habitIds?: string[]
    walkIds?: string[]
    walkIndex?: number
    dayPlanLogged?: boolean
    circumstanceNums?: number[]
    mustDo?: string
    mustNotDo?: string
    newEvents?: string
    excitedAbout?: string
    bestDayWhy?: string
    gratitude?: string[]
    source?: "telegram" | "desktop"
  }
}

function minutesToClock(min: number): string {
  return offsetToClock(min)
}

function bedPrefill(dayKey: string): string | undefined {
  const night = useSleepStore.getState().nights[dayKey]
  if (night?.sleptMin != null) return minutesToClock(night.sleptMin)
  const painted = inferNight(
    {
      scopes: useTimeTrackingStore.getState().scopes,
      entries: useTimeTrackingStore.getState().entries,
    },
    dayKey,
  )
  if (painted?.sleptMin != null) return minutesToClock(painted.sleptMin)
  return undefined
}

function wakePrefill(dayKey: string): string | undefined {
  const night = useSleepStore.getState().nights[dayKey]
  if (night?.wokeMin != null) return minutesToClock(night.wokeMin)
  const painted = inferNight(
    {
      scopes: useTimeTrackingStore.getState().scopes,
      entries: useTimeTrackingStore.getState().entries,
    },
    dayKey,
  )
  if (painted?.wokeMin != null) return minutesToClock(painted.wokeMin)
  return undefined
}

function ensureAffirmationPool(): string[] {
  const store = useTaskStore.getState()
  let list = findAffirmationsCategory(store.lists)
  if (!list) {
    const id = store.addList(AFFIRMATIONS_LIST_NAME)
    list = store.lists.find((l) => l.id === id)
    if (list) {
      for (const line of DEFAULT_AFFIRMATIONS) {
        store.addTask({
          id: `affirm-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
          description: line,
          type: "task",
          stage: "clarified",
          createdAt: new Date(),
          completed: false,
          lists: [list.id],
          urgency: 1,
          importance: 1,
          estimatedDuration: 5,
          cognitiveLoad: 1,
          dependencies: [],
          context: "@general",
          entropy: 0.2,
          rewardValue: 1,
          allowPartialCompletion: false,
          minimumChunkSize: 5,
        })
      }
    }
  }
  if (!list) return [...DEFAULT_AFFIRMATIONS]
  const fromList = getAffirmationItems(useTaskStore.getState().tasks, list.id)
    .map((item) => affirmationText(item).trim())
    .filter(Boolean)
  return fromList.length > 0 ? fromList : [...DEFAULT_AFFIRMATIONS]
}

function pickSessionAffirmations(): string[] {
  return pickRandom(ensureAffirmationPool(), AFFIRMATIONS_PER_SESSION)
}

function makePending(ritual: MorningGmDraft, now: Date, reply: string): ApplyResult {
  const pending: PendingClarify = {
    kind: "ritual",
    query: "",
    candidates: [],
    createdAt: now.toISOString(),
    ritual: {
      flow: "morning",
      periodKey: ritual.periodKey,
      step: ritual.step,
      draft: ritual.draft as Record<string, unknown>,
    },
  }
  return {
    status: "needs_clarify",
    kind: "morning",
    reply,
    pending,
  }
}

function formatTodoLines(now: Date): { lines: string[]; ids: string[] } {
  const open = openTodoToday(now)
  return {
    ids: open.map((t) => t.id),
    lines: open.map((t, i) => `${i + 1}. ${itemTitleOrUntitled(t)}`),
  }
}

function dailyHabits(): { lines: string[]; ids: string[] } {
  const habits = useHabitsStore
    .getState()
    .tasks.filter((h) => (h.frequency || "daily") === "daily")
  return {
    ids: habits.map((h) => h.id),
    lines: habits.map((h, i) => `${i + 1}. ${h.name}`),
  }
}

function mergeNotes(existing: string | undefined, stamp: string): string {
  const cur = (existing ?? "").trim()
  if (!cur) return stamp
  if (cur.toLowerCase().includes(stamp.toLowerCase())) return cur
  return `${cur}\n${stamp}`
}

function addTodosFromText(lines: string[], now: Date): string[] {
  const ids: string[] = []
  for (const line of lines) {
    const task = createScheduledTodoTask({
      description: line,
      period: "day",
      date: now,
    })
    task.id = `todo-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
    task.notes = mergeNotes(task.notes, LOGGED_FROM_TEXT)
    useTaskStore.getState().addTask(task)
    ids.push(task.id)
  }
  return ids
}

function parseNumberList(text: string, max: number): number[] {
  const out: number[] = []
  for (const token of text.split(/[\s,]+/)) {
    const n = Number(token)
    if (Number.isInteger(n) && n >= 1 && n <= max) out.push(n)
  }
  return [...new Set(out)]
}

function isNoSkip(text: string): boolean {
  const t = text.trim().toLowerCase()
  return t === "no" || t === "n" || t === "skip" || isRitualSkip(text)
}

function beginTodoWalkOrDayPlan(ritual: MorningGmDraft, now: Date): ApplyResult {
  const { ids } = formatTodoLines(now)
  ritual.draft.walkIds = ids
  ritual.draft.walkIndex = 0
  if (ids.length === 0) {
    ritual.step = "day-plan"
    return makePending(
      ritual,
      now,
      ["Nothing on today's to-do list to walk through.", "", morningPrompt("day-plan", ritual, now)].join("\n"),
    )
  }
  ritual.step = "todo-walk"
  return makePending(ritual, now, morningPrompt("todo-walk", ritual, now))
}

function morningPrompt(step: MorningGmStep, ritual: MorningGmDraft, now: Date): string {
  const skipHint = "Answer, send skip, or leave blank to move on."
  switch (step) {
    case "again":
      return "You already saved a morning review for today. Reply redo to start over, or skip/blank to leave it."
    case "bed": {
      const prefill = bedPrefill(ritual.periodKey)
      const allHint = `Reply "all nighter" if you did not sleep — that lifts habits with an all-nighter block (bedtime the evening before, wake and dream that morning).`
      if (prefill) {
        ritual.draft.bedTime = prefill
        return `Bedtime? Prefill ${prefill} — reply ok to keep, a clock, skip, or all nighter.\n${allHint}`
      }
      return `Bedtime? Send a clock (e.g. 11:30), skip, or all nighter.\n${allHint}`
    }
    case "wake": {
      const prefill = wakePrefill(ritual.periodKey)
      if (prefill) {
        ritual.draft.wakeTime = prefill
        return `Wake time? Prefill ${prefill} — reply ok to keep, a clock, or skip.\n${skipHint}`
      }
      return `Wake time? Send a clock (e.g. 7:00) or skip.\n${skipHint}`
    }
    case "dream":
      return `Dream? Free text or skip.\n${skipHint}`
    case "affirmation": {
      const idx = ritual.draft.affirmationIndex ?? 0
      const shown = ritual.draft.shownAffirmations ?? []
      const line = shown[idx] ?? "I am ready for today."
      return [
        `Affirmation ${idx + 1} of ${shown.length || AFFIRMATIONS_PER_SESSION}:`,
        "",
        line,
        "",
        "Say it (a voice note counts), type anything, or skip — almost any reply advances.",
      ].join("\n")
    }
    case "todo-show": {
      const { lines, ids } = formatTodoLines(now)
      ritual.draft.unfinishedIds = ids
      if (lines.length === 0) {
        return [
          "There is nothing on your to do list for today yet",
          "",
          "would you like to add any new items to your to do list for the day? if not, respond with 'no' or 'skip'. Otherwise, respond with the items you'd like to add to your to do list for today, (one per line).",
        ].join("\n")
      }
      return [
        "Here is what is on your to do list for the day:",
        ...lines,
        "",
        "would you like to add any new items to your to do list for the day? if not, respond with 'no' or 'skip'. Otherwise, respond with the items you'd like to add to your to do list for today, (one per line).",
      ].join("\n")
    }
    case "todo-add":
      // Combined into todo-show answer handling; should not linger.
      return morningPrompt("todo-show", ritual, now)
    case "todo-priorities": {
      const { lines, ids } = formatTodoLines(now)
      ritual.draft.unfinishedIds = ids
      if (lines.length === 0) {
        return `Still nothing on to do today. Reply skip to continue.\n${skipHint}`
      }
      return [
        "Your to do list for today:",
        ...lines,
        "",
        "Reply with the numbers of the items that are your 3-5 highest priorities for the day (e.g. 1 3 5), or skip.",
      ].join("\n")
    }
    case "habit-priorities": {
      const { lines, ids } = dailyHabits()
      ritual.draft.habitIds = ids
      if (lines.length === 0) {
        return `No daily habits yet. Reply skip to continue.\n${skipHint}`
      }
      return [
        "Your daily habits:",
        ...lines,
        "",
        "Optionally reply with the numbers of 1–3 habits to prioritize for the day (e.g. 1 3), or skip / no / n for none.",
      ].join("\n")
    }
    case "todo-walk": {
      const ids = ritual.draft.walkIds ?? []
      const idx = ritual.draft.walkIndex ?? 0
      const id = ids[idx]
      const task = id ? useTaskStore.getState().tasks.find((t) => t.id === id) : undefined
      const title = task ? itemTitleOrUntitled(task) : "(missing item)"
      return [
        `Go through to do list — item ${idx + 1} of ${ids.length}:`,
        title,
        task ? formatTodoWalkCurrent(task) : "",
        "",
        todoWalkGrammarHelp(),
      ]
        .filter(Boolean)
        .join("\n")
    }
    case "day-plan":
      return [
        "Plaintext day plan? Send the plan text to append today's Plan log (stamped from text), or skip / no / n for none.",
        skipHint,
      ].join("\n")
    case "circumstances":
      return [
        "Which apply today? Reply with the numbers (e.g. 1 3), or no / skip / n:",
        "1. is there anything you absolutely must do for the day?",
        "2. is there anything you absolutely must not do for the day?",
        "3. are there any new events scheduled for the day?",
        "4. is there anything you're excited about today?",
      ].join("\n")
    case "must-do":
      return `What must you absolutely do today?\n${skipHint}`
    case "must-not-do":
      return `What must you absolutely not do today?\n${skipHint}`
    case "new-events":
      return `What new events are scheduled today?\n${skipHint}`
    case "excited":
      return `What are you excited about today?\n${skipHint}`
    case "best-day":
      return `Why is today going to be the best day ever?\n${skipHint}`
    case "gratitude":
      return `10 things you are grateful for today (one per line, or skip).\n${skipHint}`
  }
}

function nextAfterCircumstances(ritual: MorningGmDraft): MorningGmStep {
  const nums = new Set(ritual.draft.circumstanceNums ?? [])
  if (nums.has(1) && ritual.draft.mustDo === undefined) return "must-do"
  if (nums.has(2) && ritual.draft.mustNotDo === undefined) return "must-not-do"
  if (nums.has(3) && ritual.draft.newEvents === undefined) return "new-events"
  if (nums.has(4) && ritual.draft.excitedAbout === undefined) return "excited"
  return "best-day"
}

function markBranchAnswered(ritual: MorningGmDraft, step: MorningGmStep, value: string | undefined) {
  if (step === "must-do") ritual.draft.mustDo = value ?? ""
  if (step === "must-not-do") ritual.draft.mustNotDo = value ?? ""
  if (step === "new-events") ritual.draft.newEvents = value ?? ""
  if (step === "excited") ritual.draft.excitedAbout = value ?? ""
}

function saveMorningGm(ritual: MorningGmDraft, now: Date): ApplyResult {
  const dayKey = ritual.periodKey
  const draft = ritual.draft
  const wakeTime = draft.wakeTime?.trim() || undefined
  const bedTime = draft.bedTime?.trim() || undefined

  if (draft.allNighter) {
    useSleepStore.getState().setAllNighter(dayKey, true, {
      at: now.toISOString(),
      source: "telegram",
    })
  } else {
    useSleepStore.getState().setWakeTime(dayKey, wakeTime ? parseWakeTime(wakeTime) : undefined)
    useSleepStore.getState().setBedtime(dayKey, bedTime ? parseBedtime(bedTime) : undefined)
  }

  const morning: NonNullable<PeriodReview["morning"]> = {
    wakeTime: draft.allNighter ? undefined : wakeTime,
    dream: draft.allNighter ? undefined : draft.dream?.trim() || undefined,
    intentions: [],
    affirmations: draft.affirmations ?? [],
    postponedTaskIds: [],
    allNighter: !!draft.allNighter,
    todosAddedIds: draft.todosAddedIds ?? [],
    priorityTaskIds: draft.priorityTaskIds ?? [],
    priorityHabitIds: draft.priorityHabitIds ?? [],
    dayPlanLogged: !!draft.dayPlanLogged,
    mustDo: draft.mustDo?.trim() || undefined,
    mustNotDo: draft.mustNotDo?.trim() || undefined,
    newEvents: draft.newEvents?.trim() || undefined,
    excitedAbout: draft.excitedAbout?.trim() || undefined,
    bestDayWhy: draft.bestDayWhy?.trim() || undefined,
    gratitude: draft.gratitude ?? [],
    source: "telegram",
  }

  useReviewsStore.getState().saveMorningReview(dayKey, morning)

  const bits: string[] = ["Morning review saved"]
  if (draft.allNighter) bits.push("all-nighter")
  else if (wakeTime) bits.push(`wake ${wakeTime}`)
  if ((draft.affirmations ?? []).length) bits.push(`${draft.affirmations!.length} affirmation(s)`)
  if ((draft.todosAddedIds ?? []).length) bits.push(`${draft.todosAddedIds!.length} to-do(s) added`)
  if ((draft.priorityTaskIds ?? []).length) bits.push(`${draft.priorityTaskIds!.length} priorities`)
  if ((draft.priorityHabitIds ?? []).length) bits.push(`${draft.priorityHabitIds!.length} habit priorities`)
  if (draft.dayPlanLogged) bits.push("day plan")
  if ((draft.gratitude ?? []).length) bits.push(`${draft.gratitude!.length} grateful`)

  return {
    status: "ok",
    kind: "morning",
    reply: bits.join(" · "),
    summary: `Morning review ${dayKey}`,
  }
}

export function startMorningReviewGm(now = new Date()): ApplyResult {
  const dayKey = localDayKey(now)
  const existing = useReviewsStore.getState().getMorningReview(dayKey)
  const step: MorningGmStep = existing ? "again" : "bed"
  const ritual: MorningGmDraft = {
    flow: "morning",
    periodKey: dayKey,
    step,
    draft: { source: "telegram" },
  }
  return makePending(ritual, now, morningPrompt(step, ritual, now))
}

export function advanceMorningGm(ritual: MorningGmDraft, text: string, now: Date): ApplyResult {
  const step = ritual.step
  const trimmed = text.trim()
  const lower = trimmed.toLowerCase()

  if (step === "again") {
    if (isRitualSkip(trimmed)) {
      return {
        status: "ok",
        kind: "morning",
        reply: "Left the morning review as it is.",
        summary: "Morning review unchanged",
      }
    }
    ritual.step = "bed"
    ritual.draft = { source: "telegram" }
    return makePending(ritual, now, morningPrompt("bed", ritual, now))
  }

  if (step === "bed") {
    if (ALL_NIGHTER_RE.test(trimmed)) {
      ritual.draft.allNighter = true
      delete ritual.draft.bedTime
      delete ritual.draft.wakeTime
      delete ritual.draft.dream
      ritual.draft.shownAffirmations = pickSessionAffirmations()
      ritual.draft.affirmationIndex = 0
      ritual.draft.affirmations = []
      ritual.step = "affirmation"
      return makePending(ritual, now, morningPrompt("affirmation", ritual, now))
    }
    if (isRitualSkip(trimmed)) {
      delete ritual.draft.bedTime
    } else if (lower !== "ok") {
      const mins = parseBedClock(trimmed)
      if (mins == null) {
        return makePending(
          ritual,
          now,
          `Could not parse bedtime. Try 11:30, ok, skip, or all nighter.\n${morningPrompt("bed", ritual, now)}`,
        )
      }
      ritual.draft.bedTime = minutesToClock(mins)
    }
    ritual.step = "wake"
    return makePending(ritual, now, morningPrompt("wake", ritual, now))
  }

  if (step === "wake") {
    if (isRitualSkip(trimmed)) {
      delete ritual.draft.wakeTime
    } else if (lower !== "ok") {
      const mins = parseWakeClock(trimmed)
      if (mins == null) {
        return makePending(
          ritual,
          now,
          `Could not parse wake time. Try 7:00 or ok / skip.\n${morningPrompt("wake", ritual, now)}`,
        )
      }
      ritual.draft.wakeTime = minutesToClock(mins)
    }
    ritual.step = "dream"
    return makePending(ritual, now, morningPrompt("dream", ritual, now))
  }

  if (step === "dream") {
    ritual.draft.dream = isRitualSkip(trimmed) ? undefined : trimmed
    ritual.draft.shownAffirmations = pickSessionAffirmations()
    ritual.draft.affirmationIndex = 0
    ritual.draft.affirmations = []
    ritual.step = "affirmation"
    return makePending(ritual, now, morningPrompt("affirmation", ritual, now))
  }

  if (step === "affirmation") {
    const shown = ritual.draft.shownAffirmations ?? []
    const idx = ritual.draft.affirmationIndex ?? 0
    const line = shown[idx]
    // Any reply (including empty / voice) advances; keep the shown line.
    if (line) {
      ritual.draft.affirmations = [...(ritual.draft.affirmations ?? []), line]
    }
    const nextIdx = idx + 1
    if (nextIdx < shown.length) {
      ritual.draft.affirmationIndex = nextIdx
      ritual.step = "affirmation"
      return makePending(ritual, now, morningPrompt("affirmation", ritual, now))
    }
    ritual.step = "todo-show"
    return makePending(ritual, now, morningPrompt("todo-show", ritual, now))
  }

  if (step === "todo-show" || step === "todo-add") {
    if (!isNoSkip(trimmed)) {
      const lines = trimmed
        .split("\n")
        .map((l) => l.trim())
        .filter(Boolean)
      if (lines.length) {
        const ids = addTodosFromText(lines, now)
        ritual.draft.todosAddedIds = [...(ritual.draft.todosAddedIds ?? []), ...ids]
      }
    }
    ritual.step = "todo-priorities"
    return makePending(ritual, now, morningPrompt("todo-priorities", ritual, now))
  }

  if (step === "todo-priorities") {
    if (!isRitualSkip(trimmed)) {
      const ids = ritual.draft.unfinishedIds ?? []
      const picked = parseNumberList(trimmed, ids.length)
        .slice(0, 5)
        .map((n) => ids[n - 1]!)
        .filter(Boolean)
      ritual.draft.priorityTaskIds = picked
    } else {
      ritual.draft.priorityTaskIds = []
    }
    ritual.step = "habit-priorities"
    return makePending(ritual, now, morningPrompt("habit-priorities", ritual, now))
  }

  if (step === "habit-priorities") {
    if (isNoSkip(trimmed)) {
      ritual.draft.priorityHabitIds = []
    } else {
      const ids = ritual.draft.habitIds ?? []
      ritual.draft.priorityHabitIds = parseNumberList(trimmed, ids.length)
        .slice(0, 3)
        .map((n) => ids[n - 1]!)
        .filter(Boolean)
    }
    return beginTodoWalkOrDayPlan(ritual, now)
  }

  if (step === "todo-walk") {
    const ids = ritual.draft.walkIds ?? []
    const idx = ritual.draft.walkIndex ?? 0
    const id = ids[idx]

    if (!isRitualSkip(trimmed) && trimmed.toLowerCase() !== "skip") {
      const parsed = parseTodoWalkReply(trimmed)
      if (!parsed.ok) {
        return makePending(
          ritual,
          now,
          `${parsed.error}\n\n${morningPrompt("todo-walk", ritual, now)}`,
        )
      }
      if (id) {
        const store = useTaskStore.getState()
        const existing = store.tasks.find((t) => t.id === id)
        if (existing) {
          store.updateTask(
            applyTodoWalkSlots(existing, parsed.slots, ritual.periodKey, now, "morning-telegram"),
          )
        }
      }
    }

    const nextIdx = idx + 1
    if (nextIdx < ids.length) {
      ritual.draft.walkIndex = nextIdx
      ritual.step = "todo-walk"
      return makePending(ritual, now, morningPrompt("todo-walk", ritual, now))
    }
    ritual.step = "day-plan"
    return makePending(ritual, now, morningPrompt("day-plan", ritual, now))
  }

  if (step === "day-plan") {
    if (!isNoSkip(trimmed)) {
      appendPlanEntry("day", ritual.periodKey, trimmed, now, { stampSuffix: "from text" })
      ritual.draft.dayPlanLogged = true
    } else {
      ritual.draft.dayPlanLogged = false
    }
    ritual.step = "circumstances"
    return makePending(ritual, now, morningPrompt("circumstances", ritual, now))
  }

  if (step === "circumstances") {
    if (isNoSkip(trimmed)) {
      ritual.draft.circumstanceNums = []
      ritual.step = "best-day"
      return makePending(ritual, now, morningPrompt("best-day", ritual, now))
    }
    ritual.draft.circumstanceNums = parseNumberList(trimmed, 4).filter((n) => n >= 1 && n <= 4)
    const next = nextAfterCircumstances(ritual)
    ritual.step = next
    return makePending(ritual, now, morningPrompt(next, ritual, now))
  }

  if (step === "must-do" || step === "must-not-do" || step === "new-events" || step === "excited") {
    markBranchAnswered(ritual, step, isRitualSkip(trimmed) ? "" : trimmed)
    const next = nextAfterCircumstances(ritual)
    ritual.step = next
    return makePending(ritual, now, morningPrompt(next, ritual, now))
  }

  if (step === "best-day") {
    ritual.draft.bestDayWhy = isRitualSkip(trimmed) ? undefined : trimmed
    ritual.step = "gratitude"
    return makePending(ritual, now, morningPrompt("gratitude", ritual, now))
  }

  if (step === "gratitude") {
    ritual.draft.gratitude = isRitualSkip(trimmed)
      ? []
      : trimmed
          .split("\n")
          .map((l) => l.trim())
          .filter(Boolean)
    return saveMorningGm(ritual, now)
  }

  return saveMorningGm(ritual, now)
}

/** True when an attachment should count as an answer during the morning ritual. */
export function isMorningVoiceAdvance(attachments: { kind: string }[] | undefined): boolean {
  if (!attachments?.length) return false
  return attachments.some((a) => a.kind === "voice" || a.kind === "audio")
}
