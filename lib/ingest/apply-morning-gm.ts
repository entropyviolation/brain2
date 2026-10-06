/**
 * lib/ingest/apply-morning-gm.ts — Text morning review (GM) for BIM
 *
 * Flow: night carry (wake reminder, what matters most, focus goals) → sleep
 * (or all nighter) → 5 affirmations one-at-a-time → today's to-dos
 * (add, required indexes, 3–5 priorities) → daily habit priorities (1–3) →
 * go through each to-do (six slots; importance / resistance / excitement may
 * be decimals; SKIP ALL leaves the list) → plaintext day plan → branching
 * circumstances → best day → 10 gratitude.
 *
 * Each answer is stored immediately. Skip or next leaves that question empty.
 * A blank message waits. Live Location updates are dropped until the review
 * ends, then the same Telegram share is recorded again.
 * Send STOP in all caps to leave and turn shortcuts back on. Text gm again
 * to start over, continue, or jump — only at that menu.
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
import { sameCalendarDay } from "@/lib/date-utils"
import { itemTitleOrUntitled } from "@/lib/item-utils"
import {
  applyTodoWalkSlots,
  formatTodoWalkCurrent,
  parseTodoWalkReply,
  todoWalkGrammarHelp,
} from "@/lib/morning-todo-walk"
import { appendPlanEntry } from "@/lib/plan-text"
import { localDayKey, morningReviewPhase, useReviewsStore } from "@/lib/reviews-store"
import { removeSchedulePlacement } from "@/lib/scheduling"
import { inferNight } from "@/lib/sleep-inference"
import { offsetToClock, parseBedtime, parseWakeTime } from "@/lib/sleep-log"
import { useSleepStore } from "@/lib/sleep-store"
import { taskServesFocusGoals } from "@/lib/goal-focus"
import { useGoalsStore } from "@/lib/goals-store"
import { useHabitsStore } from "@/lib/habits-store"
import { nightCarryForMorning } from "@/lib/ritual-carry"
import { useTaskStore } from "@/lib/task-store"
import { patchTodoCommitment, taskIsRequired } from "@/lib/todo-commitment"
import { useTimeTrackingStore } from "@/lib/time-tracking-store"
import type { PeriodReview, Task } from "@/lib/types"
import { openTodoToday } from "./apply-todos"
import { isIndexListLine, parseIndexListLine } from "./index-list"
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
  | "todo-required"
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
  | "jump"

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
    /** Ids marked required during this ritual. Empty means the question was answered. */
    requiredTaskIds?: string[]
    priorityTaskIds?: string[]
    priorityHabitIds?: string[]
    unfinishedIds?: string[]
    habitIds?: string[]
    walkIds?: string[]
    walkIndex?: number
    /** Set after a six-slot parse fails. The next reply is that same item. */
    walkClarify?: boolean
    dayPlanLogged?: boolean
    circumstanceNums?: number[]
    mustDo?: string
    mustNotDo?: string
    newEvents?: string
    excitedAbout?: string
    bestDayWhy?: string
    gratitude?: string[]
    dayPlanText?: string
    /** Copied from the saved slice while the start menu is showing. */
    savedStep?: string
    /** True when the stored review was already a full submit. */
    wasCompleted?: boolean
    source?: "telegram" | "desktop"
  }
}

/** Questions the start-of-day menu can jump to. Branch prompts stay on resume only. */
export const MORNING_JUMP_QUESTIONS: { step: MorningGmStep; label: string }[] = [
  { step: "bed", label: "Bedtime" },
  { step: "wake", label: "Wake time" },
  { step: "dream", label: "Dream" },
  { step: "affirmation", label: "Affirmations" },
  { step: "todo-show", label: "Add to-dos" },
  { step: "todo-required", label: "Required tasks" },
  { step: "todo-priorities", label: "To-do priorities" },
  { step: "habit-priorities", label: "Habit priorities" },
  { step: "todo-walk", label: "Go through to-dos" },
  { step: "day-plan", label: "Day plan" },
  { step: "circumstances", label: "Circumstances" },
  { step: "best-day", label: "Best day" },
  { step: "gratitude", label: "Gratitude" },
]

const STOP_LINE = "Send STOP in all caps to quit and save. Other shortcuts stay off until then."

export function isMorningStop(text: string): boolean {
  return text.trim() === "STOP"
}

/**
 * Telegram Live Location edits arrive every few seconds as `gps:` plus a
 * lat,lon line. That is not an answer to the question on screen.
 */
export function isTelegramLocationPin(text: string): boolean {
  const raw = text.replace(/^\uFEFF/, "").trim()
  if (!raw) return false
  const lines = raw
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
  if (!lines.length || !/^(?:gps|geo)\s*[:：]/i.test(lines[0] ?? "")) return false
  return /-?\d+(?:\.\d+)?\s*,\s*-?\d+(?:\.\d+)?/.test(raw)
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
  const body = reply.includes(STOP_LINE) ? reply : `${reply}\n\n${STOP_LINE}`
  return {
    status: "needs_clarify",
    kind: "morning",
    reply: body,
    pending,
  }
}

function formatTodoLines(now: Date): { lines: string[]; ids: string[] } {
  const carry = nightCarryForMorning(useReviewsStore.getState().reviews, now)
  const goals = useGoalsStore.getState().goals
  const open = [...openTodoToday(now)].sort((a, b) => {
    const af = taskServesFocusGoals(a, goals, carry.focusGoalIds) ? 0 : 1
    const bf = taskServesFocusGoals(b, goals, carry.focusGoalIds) ? 0 : 1
    return af - bf
  })
  return {
    ids: open.map((t) => t.id),
    lines: open.map((t, i) => `${i + 1}. ${itemTitleOrUntitled(t)}`),
  }
}

function carryPreface(now: Date): string {
  const carry = nightCarryForMorning(useReviewsStore.getState().reviews, now)
  const lines: string[] = []
  if (carry.wakeReminder) lines.push(`Wake-up reminder:\n${carry.wakeReminder}`)
  if (carry.tomorrowMatters) lines.push(`What matters most today:\n${carry.tomorrowMatters}`)
  if (carry.focusGoalIds.length) {
    const names = useGoalsStore
      .getState()
      .goals.filter((goal) => carry.focusGoalIds.includes(goal.id))
      .map((goal) => goal.title)
    if (names.length) lines.push(`Goals in focus: ${names.join(", ")}`)
  }
  return lines.length ? `${lines.join("\n\n")}\n\n` : ""
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

/** Take a task off today's list. The task itself stays. */
function takeOffToday(task: Task, now: Date): Task {
  const dayKey = localDayKey(now)
  const next: Task = {
    ...task,
    schedulePlacements: removeSchedulePlacement(task.schedulePlacements, "day", dayKey),
  }
  if (next.scheduledDate && sameCalendarDay(next.scheduledDate, now)) {
    next.scheduledDate = undefined
    next.scheduledTime = undefined
  }
  if (next.deadline && sameCalendarDay(next.deadline, now)) {
    next.deadline = undefined
  }
  return next
}

function markRequiredToday(task: Task, now: Date): Task {
  return patchTodoCommitment(task, "day", localDayKey(now), { required: true })
}

/** `rm 1 3` (or `rm 1, 3`) on its own line. Other lines are new to-dos. */
function applyTodoListReply(text: string, now: Date): string[] {
  const listed = formatTodoLines(now)
  const addLines: string[] = []
  const removeNums: number[] = []
  for (const line of text.split("\n").map((l) => l.trim()).filter(Boolean)) {
    const rm = /^rm\s+(.+)$/i.exec(line)
    if (rm) {
      removeNums.push(...parseNumberList(rm[1] ?? "", listed.ids.length))
      continue
    }
    addLines.push(line)
  }
  const store = useTaskStore.getState()
  for (const n of [...new Set(removeNums)]) {
    const id = listed.ids[n - 1]
    const task = id ? store.tasks.find((t) => t.id === id) : undefined
    if (task) store.updateTask(takeOffToday(task, now))
  }
  return addTodosFromText(addLines, now)
}

/**
 * Numbers (one line, or several) mark today's list items required.
 * Any other line becomes a new required to-do.
 */
function applyRequiredReply(text: string, now: Date): string[] {
  const listed = formatTodoLines(now)
  const picked: string[] = []
  const fresh: string[] = []
  for (const line of text.split("\n").map((l) => l.trim()).filter(Boolean)) {
    if (isIndexListLine(line)) {
      for (const n of parseIndexListLine(line, listed.ids.length)) {
        const id = listed.ids[n - 1]
        if (id) picked.push(id)
      }
      continue
    }
    fresh.push(line)
  }
  const store = useTaskStore.getState()
  for (const id of [...new Set(picked)]) {
    const task = store.tasks.find((t) => t.id === id)
    if (task) store.updateTask(markRequiredToday(task, now))
  }
  const created = addTodosFromText(fresh, now)
  for (const id of created) {
    const task = useTaskStore.getState().tasks.find((t) => t.id === id)
    if (task) useTaskStore.getState().updateTask(markRequiredToday(task, now))
  }
  return [...new Set([...picked, ...created])]
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

function stepLabel(step: string | undefined): string {
  if (!step) return "the next open question"
  return MORNING_JUMP_QUESTIONS.find((q) => q.step === step)?.label ?? step.replace(/-/g, " ")
}

function isResumeStep(step: string | undefined): step is MorningGmStep {
  if (!step) return false
  if (MORNING_JUMP_QUESTIONS.some((q) => q.step === step)) return true
  return step === "must-do" || step === "must-not-do" || step === "new-events" || step === "excited" || step === "todo-add"
}

function savedHint(value: string | undefined): string {
  const v = value?.trim()
  return v ? ` Saved: ${v}.` : ""
}

function draftFromStored(morning: NonNullable<PeriodReview["morning"]>): MorningGmDraft["draft"] {
  return {
    source: "telegram",
    allNighter: morning.allNighter || undefined,
    bedTime: morning.bedTime,
    wakeTime: morning.wakeTime,
    dream: morning.dream,
    affirmations: morning.affirmations ? [...morning.affirmations] : undefined,
    shownAffirmations: morning.shownAffirmations ? [...morning.shownAffirmations] : undefined,
    affirmationIndex: morning.affirmationIndex,
    todosAddedIds: morning.todosAddedIds ? [...morning.todosAddedIds] : undefined,
    requiredTaskIds: morning.requiredTaskIds ? [...morning.requiredTaskIds] : undefined,
    priorityTaskIds: morning.priorityTaskIds ? [...morning.priorityTaskIds] : undefined,
    priorityHabitIds: morning.priorityHabitIds ? [...morning.priorityHabitIds] : undefined,
    walkIndex: morning.walkIndex,
    dayPlanLogged: morning.dayPlanLogged,
    dayPlanText: morning.dayPlanText,
    mustDo: morning.mustDo,
    mustNotDo: morning.mustNotDo,
    newEvents: morning.newEvents,
    excitedAbout: morning.excitedAbout,
    bestDayWhy: morning.bestDayWhy,
    gratitude: morning.gratitude ? [...morning.gratitude] : undefined,
    circumstanceNums: morning.circumstanceNums ? [...morning.circumstanceNums] : undefined,
    savedStep: morning.resumeStep,
    wasCompleted: morningReviewPhase(morning) === "done",
  }
}

function firstOpenStep(draft: MorningGmDraft["draft"]): MorningGmStep | "done" {
  if (!draft.allNighter && !draft.bedTime) return "bed"
  if (!draft.allNighter && !draft.wakeTime) return "wake"
  if (!draft.allNighter && !draft.dream) return "dream"
  const shown = draft.shownAffirmations ?? []
  const idx = draft.affirmationIndex ?? 0
  if (shown.length > 0 && idx < shown.length) return "affirmation"
  if (!draft.affirmations?.length) return "affirmation"
  if (draft.todosAddedIds === undefined && draft.requiredTaskIds === undefined && draft.priorityTaskIds === undefined) {
    return "todo-show"
  }
  if (draft.requiredTaskIds === undefined && draft.priorityTaskIds === undefined) return "todo-required"
  if (draft.priorityTaskIds === undefined) return "todo-priorities"
  if (draft.priorityHabitIds === undefined) return "habit-priorities"
  if (!draft.dayPlanText && !draft.dayPlanLogged) return "day-plan"
  const branchesOpen =
    draft.mustNotDo === undefined &&
    draft.newEvents === undefined &&
    draft.excitedAbout === undefined
  if (branchesOpen && !draft.bestDayWhy && !draft.gratitude?.length) return "circumstances"
  if (!draft.bestDayWhy) return "best-day"
  if (!draft.gratitude?.length) return "gratitude"
  return "done"
}

function ensureAffirmationSession(ritual: MorningGmDraft) {
  if (ritual.draft.shownAffirmations?.length) return
  ritual.draft.shownAffirmations = pickSessionAffirmations()
  ritual.draft.affirmationIndex = ritual.draft.affirmationIndex ?? 0
  ritual.draft.affirmations = ritual.draft.affirmations ?? []
}

function persistMorning(ritual: MorningGmDraft, now: Date, finish = false) {
  const d = ritual.draft
  const completed = finish || !!d.wasCompleted
  const morning: NonNullable<PeriodReview["morning"]> = {
    source: "telegram",
    completed,
  }
  if (!finish && ritual.step !== "again" && ritual.step !== "jump") {
    morning.resumeStep = ritual.step
  }
  if (d.allNighter) morning.allNighter = true
  if (d.bedTime) morning.bedTime = d.bedTime
  if (d.wakeTime) morning.wakeTime = d.wakeTime
  if (d.dream) morning.dream = d.dream
  if (d.affirmations?.length) morning.affirmations = [...d.affirmations]
  if (d.shownAffirmations?.length) morning.shownAffirmations = [...d.shownAffirmations]
  if (typeof d.affirmationIndex === "number") morning.affirmationIndex = d.affirmationIndex
  if (d.todosAddedIds) morning.todosAddedIds = [...d.todosAddedIds]
  if (d.requiredTaskIds) morning.requiredTaskIds = [...d.requiredTaskIds]
  if (d.priorityTaskIds) morning.priorityTaskIds = [...d.priorityTaskIds]
  if (d.priorityHabitIds?.length) morning.priorityHabitIds = [...d.priorityHabitIds]
  if (d.dayPlanLogged) morning.dayPlanLogged = true
  if (d.dayPlanText) morning.dayPlanText = d.dayPlanText
  if (d.mustDo) morning.mustDo = d.mustDo
  if (d.mustNotDo) morning.mustNotDo = d.mustNotDo
  if (d.newEvents) morning.newEvents = d.newEvents
  if (d.excitedAbout) morning.excitedAbout = d.excitedAbout
  if (d.bestDayWhy) morning.bestDayWhy = d.bestDayWhy
  if (d.gratitude?.length) morning.gratitude = [...d.gratitude]
  if (d.circumstanceNums?.length) morning.circumstanceNums = [...d.circumstanceNums]
  if (ritual.step === "todo-walk" && typeof d.walkIndex === "number") morning.walkIndex = d.walkIndex

  const dayKey = ritual.periodKey
  if (d.allNighter) {
    useSleepStore.getState().setAllNighter(dayKey, true, { at: now.toISOString(), source: "telegram" })
  } else if (d.bedTime || d.wakeTime) {
    useSleepStore.getState().setAllNighter(dayKey, false)
    if (d.bedTime) useSleepStore.getState().setBedtime(dayKey, parseBedtime(d.bedTime))
    if (d.wakeTime) useSleepStore.getState().setWakeTime(dayKey, parseWakeTime(d.wakeTime))
  }

  useReviewsStore.getState().replaceMorningReview(dayKey, morning)
  if (finish) d.wasCompleted = true
}

function ask(ritual: MorningGmDraft, now: Date, finish = false): ApplyResult {
  if (finish) {
    persistMorning(ritual, now, true)
    return morningSavedReply(ritual)
  }
  persistMorning(ritual, now, false)
  return makePending(ritual, now, morningPrompt(ritual.step, ritual, now))
}

function morningSavedReply(ritual: MorningGmDraft): ApplyResult {
  const draft = ritual.draft
  const bits: string[] = ["Morning review saved"]
  if (draft.allNighter) bits.push("all-nighter")
  else if (draft.wakeTime) bits.push(`wake ${draft.wakeTime}`)
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
    summary: `Morning review ${ritual.periodKey}`,
  }
}

function beginTodoWalkOrDayPlan(ritual: MorningGmDraft, now: Date, restart = false): ApplyResult {
  const { ids } = formatTodoLines(now)
  ritual.draft.walkIds = ids
  const idx = ritual.draft.walkIndex ?? 0
  ritual.draft.walkIndex = !restart && idx >= 0 && idx < ids.length ? idx : 0
  if (ids.length === 0) {
    ritual.step = "day-plan"
    return ask(ritual, now)
  }
  ritual.step = "todo-walk"
  return ask(ritual, now)
}

function morningPrompt(step: MorningGmStep, ritual: MorningGmDraft, now: Date): string {
  const skipHint = "Answer, or send skip or next to leave this question open and move on."
  switch (step) {
    case "again": {
      const preface = carryPreface(now)
      const phase = ritual.draft.wasCompleted ? "already saved" : "in progress"
      const where = isResumeStep(ritual.draft.savedStep)
        ? stepLabel(ritual.draft.savedStep)
        : ritual.draft.wasCompleted
          ? "the end"
          : stepLabel(firstOpenStep(ritual.draft) === "done" ? undefined : firstOpenStep(ritual.draft))
      const menu = [
        `Morning review for today is ${phase}.`,
        "1 start over",
        `2 continue — ${where}`,
        "3 jump to a question",
        "",
        "Reply 1, 2, or 3. Send skip to leave it as it is.",
      ].join("\n")
      return `${preface}${menu}`
    }
    case "jump":
      return [
        "Jump to which question? Reply a number:",
        ...MORNING_JUMP_QUESTIONS.map((q, i) => `${i + 1} ${q.label}`),
      ].join("\n")
    case "bed": {
      const saved = ritual.draft.bedTime
      const prefill = saved || bedPrefill(ritual.periodKey)
      const allHint = `Reply "all nighter" if you did not sleep — that lifts habits with an all-nighter block (bedtime the evening before, wake and dream that morning).`
      const preface = carryPreface(now)
      if (saved) return `${preface}Bedtime?${savedHint(saved)} Reply ok to keep, a clock, skip, or all nighter.\n${allHint}`
      if (prefill) return `${preface}Bedtime? Prefill ${prefill} — reply ok to keep, a clock, skip, or all nighter.\n${allHint}`
      return `${preface}Bedtime? Send a clock (e.g. 11:30), skip, or all nighter.\n${allHint}`
    }
    case "wake": {
      const saved = ritual.draft.wakeTime
      const prefill = saved || wakePrefill(ritual.periodKey)
      if (saved) return `Wake time?${savedHint(saved)} Reply ok to keep, a clock, or skip.\n${skipHint}`
      if (prefill) return `Wake time? Prefill ${prefill} — reply ok to keep, a clock, or skip.\n${skipHint}`
      return `Wake time? Send a clock (e.g. 7:00) or skip.\n${skipHint}`
    }
    case "dream":
      return `Dream?${savedHint(ritual.draft.dream)} Free text or skip.\n${skipHint}`
    case "affirmation": {
      const idx = ritual.draft.affirmationIndex ?? 0
      const shown = ritual.draft.shownAffirmations ?? []
      const line = shown[idx] ?? "I am ready for today."
      const preface = idx === 0 && ritual.draft.allNighter ? carryPreface(now) : ""
      return [
        `${preface}Affirmation ${idx + 1} of ${shown.length || AFFIRMATIONS_PER_SESSION}:`,
        "",
        line,
        "",
        "Say it (a voice note counts), type a reply, or send skip or next.",
        "Command words are just text here.",
      ].join("\n")
    }
    case "todo-show": {
      const { lines, ids } = formatTodoLines(now)
      ritual.draft.unfinishedIds = ids
      const ask = [
        "Add as many new items as you want, one per line.",
        "To take items off today's list, add a line like rm 1 3 (start or end).",
        "If you want neither, send no or skip.",
      ]
      if (lines.length === 0) {
        return ["There is nothing on your to do list for today yet.", "", ...ask].join("\n")
      }
      return ["Here is what is on your to do list for the day:", ...lines, "", ...ask].join("\n")
    }
    case "todo-add":
      return morningPrompt("todo-show", ritual, now)
    case "todo-required": {
      const { lines, ids } = formatTodoLines(now)
      ritual.draft.unfinishedIds = ids
      const dayKey = localDayKey(now)
      const tasks = useTaskStore.getState().tasks
      const already = lines.filter((_, i) => {
        const task = tasks.find((t) => t.id === ids[i])
        return !!task && taskIsRequired(task, "day", dayKey)
      })
      return [
        already.length ? "Already required today:" : "Nothing is required yet.",
        ...already,
        "",
        lines.length ? "Today's to do list:" : "Today's to do list is empty.",
        ...lines,
        "",
        "Any tasks required for the day? A line of only comma-separated numbers selects those items (1,8 or 1, 8). One number on its own line still works. Any other line is a new required to-do. Skip or next leaves this open.",
      ].join("\n")
    }
    case "todo-priorities": {
      const { lines, ids } = formatTodoLines(now)
      ritual.draft.unfinishedIds = ids
      if (lines.length === 0) {
        return `Still nothing on to do today. Reply skip to leave priorities open.\n${skipHint}`
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
        return `No daily habits yet. Reply skip to leave this open.\n${skipHint}`
      }
      return [
        "Your daily habits:",
        ...lines,
        "",
        "Optionally reply with the numbers of 1–3 habits to prioritize for the day (e.g. 1 3), or skip / no / n to leave this open.",
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
        `Plaintext day plan?${savedHint(ritual.draft.dayPlanText)} Send the plan text to append today's Plan log (stamped from text), or skip / no / n to leave it open.`,
        skipHint,
      ].join("\n")
    case "circumstances":
      return [
        "Which apply today? Reply with the numbers (e.g. 1 3), or no / skip / n to leave them open:",
        "1. is there anything you absolutely must not do for the day?",
        "2. are there any new events scheduled for the day?",
        "3. is there anything you're excited about today?",
      ].join("\n")
    case "must-do":
      return `What must you absolutely do today?${savedHint(ritual.draft.mustDo)}\n${skipHint}`
    case "must-not-do":
      return `What must you absolutely not do today?${savedHint(ritual.draft.mustNotDo)}\n${skipHint}`
    case "new-events":
      return `What new events are scheduled today?${savedHint(ritual.draft.newEvents)}\n${skipHint}`
    case "excited":
      return `What are you excited about today?${savedHint(ritual.draft.excitedAbout)}\n${skipHint}`
    case "best-day":
      return `Why is today going to be the best day ever?${savedHint(ritual.draft.bestDayWhy)}\n${skipHint}`
    case "gratitude":
      return `10 things you are grateful for today (one per line, or skip to leave this open).${
        ritual.draft.gratitude?.length ? ` Saved: ${ritual.draft.gratitude.length} so far.` : ""
      }\n${skipHint}`
  }
}

function nextAfterCircumstances(ritual: MorningGmDraft): MorningGmStep {
  const nums = new Set(ritual.draft.circumstanceNums ?? [])
  if (nums.has(1) && ritual.draft.mustNotDo === undefined) return "must-not-do"
  if (nums.has(2) && ritual.draft.newEvents === undefined) return "new-events"
  if (nums.has(3) && ritual.draft.excitedAbout === undefined) return "excited"
  return "best-day"
}

function parseStartChoice(text: string): "restart" | "continue" | "jump" | null {
  const t = text.trim().toLowerCase()
  if (["1", "start over", "startover", "restart", "redo", "over"].includes(t)) return "restart"
  if (["2", "continue", "resume", "left off", "pickup", "pick up"].includes(t)) return "continue"
  if (["3", "jump", "go to", "goto"].includes(t)) return "jump"
  return null
}

function matchJump(text: string): MorningGmStep | null {
  const t = text.trim().toLowerCase()
  const n = Number(t)
  if (Number.isInteger(n) && n >= 1 && n <= MORNING_JUMP_QUESTIONS.length) {
    return MORNING_JUMP_QUESTIONS[n - 1]!.step
  }
  const hit = MORNING_JUMP_QUESTIONS.find((q) => q.label.toLowerCase() === t || q.step === t)
  return hit?.step ?? null
}

function restartMorning(ritual: MorningGmDraft, now: Date): ApplyResult {
  useReviewsStore.getState().clearMorningReview(ritual.periodKey)
  useSleepStore.getState().setAllNighter(ritual.periodKey, false)
  ritual.draft = { source: "telegram" }
  ritual.step = "bed"
  return makePending(ritual, now, morningPrompt("bed", ritual, now))
}

function enterStep(ritual: MorningGmDraft, step: MorningGmStep, now: Date): ApplyResult {
  ritual.step = step
  if (step === "affirmation") {
    ensureAffirmationSession(ritual)
    const shown = ritual.draft.shownAffirmations ?? []
    if ((ritual.draft.affirmationIndex ?? 0) >= shown.length) ritual.draft.affirmationIndex = 0
  }
  if (step === "todo-walk") return beginTodoWalkOrDayPlan(ritual, now, false)
  return ask(ritual, now)
}

function continueMorning(ritual: MorningGmDraft, now: Date): ApplyResult {
  if (ritual.draft.wasCompleted && !isResumeStep(ritual.draft.savedStep)) {
    ritual.step = "again"
    return makePending(
      ritual,
      now,
      `Nothing left open on today's morning review. Reply 1 to start over or 3 to jump to a question.\n\n${morningPrompt("again", ritual, now)}`,
    )
  }
  if (isResumeStep(ritual.draft.savedStep)) {
    const step = ritual.draft.savedStep
    ritual.draft.savedStep = undefined
    return enterStep(ritual, step, now)
  }
  const gap = firstOpenStep(ritual.draft)
  if (gap === "done") {
    ritual.step = "again"
    return makePending(
      ritual,
      now,
      `Nothing left open on today's morning review. Reply 1 to start over or 3 to jump to a question.\n\n${morningPrompt("again", ritual, now)}`,
    )
  }
  return enterStep(ritual, gap, now)
}

export function startMorningReviewGm(now = new Date()): ApplyResult {
  const dayKey = localDayKey(now)
  const existing = useReviewsStore.getState().getMorningReview(dayKey)
  if (existing && morningReviewPhase(existing) !== "none") {
    const ritual: MorningGmDraft = {
      flow: "morning",
      periodKey: dayKey,
      step: "again",
      draft: draftFromStored(existing),
    }
    return makePending(ritual, now, morningPrompt("again", ritual, now))
  }
  const ritual: MorningGmDraft = {
    flow: "morning",
    periodKey: dayKey,
    step: "bed",
    draft: { source: "telegram" },
  }
  return makePending(ritual, now, morningPrompt("bed", ritual, now))
}

function morningFromPending(pending: PendingClarify): MorningGmDraft | null {
  const raw = pending.ritual
  if (!raw || raw.flow !== "morning") return null
  return {
    flow: "morning",
    periodKey: raw.periodKey,
    step: raw.step as MorningGmStep,
    draft: raw.draft as MorningGmDraft["draft"],
  }
}

/** Keep the morning ritual open when a photo or file arrives mid-review. */
export function holdMorningReview(pending: PendingClarify, now = new Date()): ApplyResult {
  const ritual = morningFromPending(pending)
  if (!ritual) {
    return { status: "error", kind: "morning", reply: "No morning review in progress." }
  }
  return makePending(
    ritual,
    now,
    `Photos and files wait until you send STOP. Reply to the question, or send STOP to quit and save.\n\n${morningPrompt(ritual.step, ritual, now)}`,
  )
}

/** Stay on the current question and do not send another message. */
function silentMorningHold(ritual: MorningGmDraft, now: Date): ApplyResult {
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
  return { status: "needs_clarify", kind: "morning", reply: "", pending }
}

export function advanceMorningGm(ritual: MorningGmDraft, text: string, now: Date): ApplyResult {
  if (isMorningStop(text)) return stopMorningReview(ritual, now)

  const step = ritual.step
  const trimmed = text.trim()
  const lower = trimmed.toLowerCase()

  // Live Location pins and empty updates are not replies. Wait for words.
  if (isTelegramLocationPin(text) || !trimmed) return silentMorningHold(ritual, now)

  if (step === "again") {
    if (isRitualSkip(trimmed)) {
      return {
        status: "ok",
        kind: "morning",
        reply: "Left the morning review as it is. Shortcuts are back on.",
        summary: "Morning review unchanged",
      }
    }
    const choice = parseStartChoice(trimmed)
    if (choice === "restart") return restartMorning(ritual, now)
    if (choice === "continue") return continueMorning(ritual, now)
    if (choice === "jump") {
      ritual.step = "jump"
      return makePending(ritual, now, morningPrompt("jump", ritual, now))
    }
    return makePending(
      ritual,
      now,
      `Reply 1 to start over, 2 to continue, or 3 to jump.\n\n${morningPrompt("again", ritual, now)}`,
    )
  }

  if (step === "jump") {
    const picked = matchJump(trimmed)
    if (!picked) {
      return makePending(
        ritual,
        now,
        `Reply a number from 1 to ${MORNING_JUMP_QUESTIONS.length}.\n\n${morningPrompt("jump", ritual, now)}`,
      )
    }
    return enterStep(ritual, picked, now)
  }

  if (step === "bed") {
    if (ALL_NIGHTER_RE.test(trimmed)) {
      ritual.draft.allNighter = true
      delete ritual.draft.bedTime
      delete ritual.draft.wakeTime
      delete ritual.draft.dream
      if (!ritual.draft.shownAffirmations?.length) {
        ritual.draft.shownAffirmations = pickSessionAffirmations()
        ritual.draft.affirmationIndex = 0
        ritual.draft.affirmations = ritual.draft.affirmations ?? []
      }
      ritual.step = "affirmation"
      return ask(ritual, now)
    }
    if (!isRitualSkip(trimmed)) {
      if (lower === "ok") {
        const pre = bedPrefill(ritual.periodKey)
        if (pre) ritual.draft.bedTime = pre
      } else {
        const mins = parseBedClock(trimmed)
        if (mins == null) {
          return makePending(
            ritual,
            now,
            `Could not parse bedtime. Try 11:30, ok, skip, or all nighter.\n${morningPrompt("bed", ritual, now)}`,
          )
        }
        ritual.draft.bedTime = minutesToClock(mins)
        ritual.draft.allNighter = false
      }
    }
    ritual.step = "wake"
    return ask(ritual, now)
  }

  if (step === "wake") {
    if (!isRitualSkip(trimmed)) {
      if (lower === "ok") {
        const pre = wakePrefill(ritual.periodKey)
        if (pre) ritual.draft.wakeTime = pre
      } else {
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
    }
    ritual.step = "dream"
    return ask(ritual, now)
  }

  if (step === "dream") {
    if (!isRitualSkip(trimmed)) ritual.draft.dream = trimmed
    ensureAffirmationSession(ritual)
    ritual.step = "affirmation"
    return ask(ritual, now)
  }

  if (step === "affirmation") {
    const shown = ritual.draft.shownAffirmations ?? []
    const idx = ritual.draft.affirmationIndex ?? 0
    const line = shown[idx]
    if (line) {
      const next = [...(ritual.draft.affirmations ?? [])]
      next[idx] = line
      ritual.draft.affirmations = next.filter((entry) => entry.trim())
    }
    const nextIdx = idx + 1
    ritual.draft.affirmationIndex = nextIdx
    if (nextIdx < shown.length) {
      ritual.step = "affirmation"
      return ask(ritual, now)
    }
    ritual.step = "todo-show"
    return ask(ritual, now)
  }

  if (step === "todo-show" || step === "todo-add") {
    if (!isNoSkip(trimmed)) {
      const ids = applyTodoListReply(trimmed, now)
      ritual.draft.todosAddedIds = [...(ritual.draft.todosAddedIds ?? []), ...ids]
    }
    ritual.step = "todo-required"
    return ask(ritual, now)
  }

  if (step === "todo-required") {
    if (!isNoSkip(trimmed)) {
      ritual.draft.requiredTaskIds = applyRequiredReply(trimmed, now)
    }
    ritual.step = "todo-priorities"
    return ask(ritual, now)
  }

  if (step === "todo-priorities") {
    if (!isRitualSkip(trimmed)) {
      const ids = ritual.draft.unfinishedIds ?? formatTodoLines(now).ids
      ritual.draft.unfinishedIds = ids
      ritual.draft.priorityTaskIds = parseNumberList(trimmed, ids.length)
        .slice(0, 5)
        .map((n) => ids[n - 1]!)
        .filter(Boolean)
    }
    ritual.step = "habit-priorities"
    return ask(ritual, now)
  }

  if (step === "habit-priorities") {
    if (!isNoSkip(trimmed)) {
      const ids = ritual.draft.habitIds ?? dailyHabits().ids
      ritual.draft.habitIds = ids
      ritual.draft.priorityHabitIds = parseNumberList(trimmed, ids.length)
        .slice(0, 3)
        .map((n) => ids[n - 1]!)
        .filter(Boolean)
    }
    return beginTodoWalkOrDayPlan(ritual, now, true)
  }

  if (step === "todo-walk") {
    const ids = ritual.draft.walkIds ?? []
    const idx = ritual.draft.walkIndex ?? 0
    const id = ids[idx]
    const clarifying = ritual.draft.walkClarify === true
    ritual.draft.walkClarify = false

    if (/^skip\s+all$/i.test(trimmed)) {
      ritual.draft.walkIndex = ids.length
      ritual.step = "day-plan"
      return ask(ritual, now)
    }

    // After a bad six-slot line, the next text is that same item. It is not
    // skip, not the next item, and not a command (the executor already stayed here).
    if (!clarifying && isRitualSkip(trimmed)) {
      // leave this item untouched
    } else {
      const parsed = parseTodoWalkReply(trimmed)
      if (!parsed.ok) {
        ritual.draft.walkClarify = true
        ritual.draft.walkIndex = idx
        ritual.step = "todo-walk"
        persistMorning(ritual, now, false)
        return makePending(
          ritual,
          now,
          `${parsed.error}\n\nSame item — send the six slots again.\n\n${morningPrompt("todo-walk", ritual, now)}`,
        )
      }
      if (id) {
        const store = useTaskStore.getState()
        const existing = store.tasks.find((t) => t.id === id)
        if (existing) {
          store.updateTask(applyTodoWalkSlots(existing, parsed.slots, ritual.periodKey, now, "morning-telegram"))
        }
      }
    }

    const nextIdx = idx + 1
    if (nextIdx < ids.length) {
      ritual.draft.walkIndex = nextIdx
      ritual.step = "todo-walk"
      return ask(ritual, now)
    }
    ritual.step = "day-plan"
    return ask(ritual, now)
  }

  if (step === "day-plan") {
    if (!isNoSkip(trimmed) && trimmed !== ritual.draft.dayPlanText) {
      appendPlanEntry("day", ritual.periodKey, trimmed, now, { stampSuffix: "from text" })
      ritual.draft.dayPlanLogged = true
      ritual.draft.dayPlanText = trimmed
    }
    ritual.step = "circumstances"
    return ask(ritual, now)
  }

  if (step === "circumstances") {
    if (isNoSkip(trimmed)) {
      ritual.step = "best-day"
      return ask(ritual, now)
    }
    ritual.draft.circumstanceNums = parseNumberList(trimmed, 3).filter((n) => n >= 1 && n <= 3)
    const next = nextAfterCircumstances(ritual)
    ritual.step = next
    return ask(ritual, now)
  }

  if (step === "must-do" || step === "must-not-do" || step === "new-events" || step === "excited") {
    if (!isRitualSkip(trimmed)) {
      if (step === "must-do") ritual.draft.mustDo = trimmed
      if (step === "must-not-do") ritual.draft.mustNotDo = trimmed
      if (step === "new-events") ritual.draft.newEvents = trimmed
      if (step === "excited") ritual.draft.excitedAbout = trimmed
    }
    const next = nextAfterCircumstances(ritual)
    ritual.step = next
    return ask(ritual, now)
  }

  if (step === "best-day") {
    if (!isRitualSkip(trimmed)) ritual.draft.bestDayWhy = trimmed
    ritual.step = "gratitude"
    return ask(ritual, now)
  }

  if (step === "gratitude") {
    if (!isRitualSkip(trimmed)) {
      ritual.draft.gratitude = trimmed
        .split("\n")
        .map((l) => l.trim())
        .filter(Boolean)
    }
    return ask(ritual, now, true)
  }

  return ask(ritual, now, true)
}

export function stopMorningReview(ritual: MorningGmDraft, now = new Date()): ApplyResult {
  if (ritual.step !== "again" && ritual.step !== "jump") persistMorning(ritual, now, false)
  const where = ritual.step === "again" || ritual.step === "jump" ? "the start menu" : stepLabel(ritual.step)
  return {
    status: "ok",
    kind: "morning",
    reply: `Morning review saved. Left off at ${where}. Text gm to start over, continue, or jump. Shortcuts are back on.`,
    summary: `Morning review paused ${ritual.periodKey}`,
  }
}

/** True when an attachment should count as an answer during the morning ritual. */
export function isMorningVoiceAdvance(attachments: { kind: string }[] | undefined): boolean {
  if (!attachments?.length) return false
  return attachments.some((a) => a.kind === "voice" || a.kind === "audio")
}
