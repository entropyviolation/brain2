/**
 * components/Reviews/morning/commit-morning.ts — Desktop morning save.
 *
 * Creates to-dos, applies the walk, appends the plan log, writes sleep,
 * replaces the morning slice, then stamps Required / Prioritized marks.
 * The dialog applies the React epilogue and the catch. Text `gm` stays separate.
 */
import { createScheduledTodoTask } from "@/components/Home/ToDo/todo-utils"
import type { SleepClockSource } from "@/lib/estimated-values"
import { applyTodoWalkSlots, emptyTodoWalkForm, formToTodoWalkReply, parseTodoWalkReply, type TodoWalkFormFields } from "@/lib/morning-todo-walk"
import { appendPlanEntry } from "@/lib/plan-text"
import { morningReviewPhase } from "@/lib/reviews-store"
import { parseBedtime, parseWakeTime } from "@/lib/sleep-log"
import type { SleepState } from "@/lib/sleep-store"
import { useTaskStore } from "@/lib/task-store"
import { tasksWithCommitment } from "@/lib/todo-commitment"
import type { Task } from "@/lib/types"
import { asStringList, clearMorningDraft } from "./draft"
import type { MorningSlice } from "./types"

const LOGGED_FROM_TEXT = "logged from text"

export function commitMorning(input: {
  complete: boolean
  newTodoLines: string[]
  activeDate: Date
  addTask: (task: Task) => void
  todaysTasks: Task[]
  todoWalkById: Record<string, TodoWalkFormFields>
  updateTask: (task: Task) => void
  dayKey: string
  dayPlan: string
  existing: MorningSlice | undefined
  allNighter: boolean
  setAllNighter: SleepState["setAllNighter"]
  wakeTime: string
  bedTime: string
  dream: string
  wakeEstSource: SleepClockSource | null
  bedEstSource: SleepClockSource | null
  setStoreWakeTime: SleepState["setWakeTime"]
  setStoreBedtime: SleepState["setBedtime"]
  priorityIds: string[]
  affirmations: string[]
  affirmationsTouched: boolean
  gratitude: string[]
  priorityHabitIds: string[]
  circumstance: { mustDo: boolean; mustNotDo: boolean; newEvents: boolean; excited: boolean }
  mustDo: string
  mustNotDo: string
  newEvents: string
  excitedAbout: string
  bestDayWhy: string
  replaceMorningReview: (dayKey: string, morning: MorningSlice) => void
  requiredIds: string[]
}): { clearedLines: string[]; keptWalks: Record<string, TodoWalkFormFields> } {
  const {
    complete,
    newTodoLines,
    activeDate,
    addTask,
    todaysTasks,
    todoWalkById,
    updateTask,
    dayKey,
    dayPlan,
    existing,
    allNighter,
    setAllNighter,
    wakeTime,
    bedTime,
    dream,
    wakeEstSource,
    bedEstSource,
    setStoreWakeTime,
    setStoreBedtime,
    priorityIds,
    affirmations,
    affirmationsTouched,
    gratitude,
    priorityHabitIds,
    circumstance,
    mustDo,
    mustNotDo,
    newEvents,
    excitedAbout,
    bestDayWhy,
    replaceMorningReview,
    requiredIds,
  } = input

  const addedIds: string[] = []
  for (const line of newTodoLines.map((s) => s.trim()).filter(Boolean)) {
    const task = createScheduledTodoTask({
      description: line,
      period: "day",
      date: activeDate,
    })
    task.id = `todo-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
    task.notes = LOGGED_FROM_TEXT
    addTask(task)
    addedIds.push(task.id)
  }

  const now = new Date()
  for (const t of todaysTasks) {
    const form = todoWalkById[t.id] ?? emptyTodoWalkForm()
    const reply = formToTodoWalkReply(form)
    if (reply === "skip") continue
    const parsed = parseTodoWalkReply(reply)
    if (!parsed.ok) continue
    updateTask(applyTodoWalkSlots(t, parsed.slots, dayKey, now, "morning-desktop"))
  }

  const planText = dayPlan.trim()
  let dayPlanLogged = !!existing?.dayPlanLogged
  let dayPlanText = existing?.dayPlanText
  if (planText && planText !== (existing?.dayPlanText ?? "")) {
    appendPlanEntry("day", dayKey, planText, now)
    dayPlanLogged = true
    dayPlanText = planText
  } else if (!planText) {
    dayPlanText = undefined
  }

  if (allNighter) {
    setAllNighter(dayKey, true, { at: now.toISOString(), source: "desktop" })
  } else {
    setAllNighter(dayKey, false)
    setStoreWakeTime(
      dayKey,
      wakeTime.trim() ? parseWakeTime(wakeTime) : undefined,
      wakeTime.trim() ? (wakeEstSource ? "estimated" : "definite") : undefined,
    )
    setStoreBedtime(
      dayKey,
      bedTime.trim() ? parseBedtime(bedTime) : undefined,
      bedTime.trim() ? (bedEstSource ? "estimated" : "definite") : undefined,
    )
  }

  const allPriority = priorityIds.filter((id, i, arr) => arr.indexOf(id) === i)
  const spoken = affirmations.map((s) => s.trim()).filter(Boolean)
  const grateful = gratitude.map((s) => s.trim()).filter(Boolean)
  const phase = morningReviewPhase(existing)
  const gap = (() => {
    if (!allNighter && !bedTime.trim()) return "bed"
    if (!allNighter && !wakeTime.trim()) return "wake"
    if (!allNighter && !dream.trim()) return "dream"
    if (!spoken.length) return "affirmation"
    if (!allPriority.length && existing?.priorityTaskIds === undefined && !addedIds.length && !existing?.todosAddedIds?.length)
      return "todo-show"
    if (!allPriority.length && existing?.priorityTaskIds === undefined) return "todo-priorities"
    if (!priorityHabitIds.length && existing?.priorityHabitIds === undefined) return "habit-priorities"
    if (!planText && !dayPlanLogged) return "day-plan"
    const anyBranch = circumstance.mustDo || circumstance.mustNotDo || circumstance.newEvents || circumstance.excited
    if (!anyBranch && !bestDayWhy.trim() && !grateful.length) return "circumstances"
    if (!bestDayWhy.trim()) return "best-day"
    if (!grateful.length) return "gratitude"
    return undefined
  })()
  const morning: MorningSlice = {
    source: "desktop",
    completed: complete ? true : phase === "done" ? true : false,
  }
  if (!complete) {
    const resume = existing?.resumeStep || gap
    if (resume) morning.resumeStep = resume
  }
  if (allNighter) morning.allNighter = true
  if (!allNighter && wakeTime.trim()) morning.wakeTime = wakeTime.trim()
  if (!allNighter && bedTime.trim()) morning.bedTime = bedTime.trim()
  if (!allNighter && dream.trim()) morning.dream = dream.trim()
  if (spoken.length && (complete || (existing?.affirmations?.length ?? 0) > 0 || affirmationsTouched)) {
    morning.affirmations = spoken
  }
  if (existing?.shownAffirmations?.length) morning.shownAffirmations = existing.shownAffirmations
  if (typeof existing?.affirmationIndex === "number") morning.affirmationIndex = existing.affirmationIndex
  if (typeof existing?.walkIndex === "number") morning.walkIndex = existing.walkIndex
  if (existing?.circumstanceNums?.length) morning.circumstanceNums = existing.circumstanceNums
  const keptTodos = [...asStringList(existing?.todosAddedIds), ...addedIds]
  if (keptTodos.length) morning.todosAddedIds = keptTodos
  if (allPriority.length || complete) morning.priorityTaskIds = allPriority
  if (priorityHabitIds.length || complete) morning.priorityHabitIds = priorityHabitIds
  if (dayPlanLogged) morning.dayPlanLogged = true
  if (dayPlanText) morning.dayPlanText = dayPlanText
  if (circumstance.mustDo && mustDo.trim()) morning.mustDo = mustDo.trim()
  if (circumstance.mustNotDo && mustNotDo.trim()) morning.mustNotDo = mustNotDo.trim()
  if (circumstance.newEvents && newEvents.trim()) morning.newEvents = newEvents.trim()
  if (circumstance.excited && excitedAbout.trim()) morning.excitedAbout = excitedAbout.trim()
  if (bestDayWhy.trim()) morning.bestDayWhy = bestDayWhy.trim()
  if (grateful.length || complete) morning.gratitude = grateful

  replaceMorningReview(dayKey, morning)
  const scopeIds = todaysTasks.map((task) => task.id)
  const marked = tasksWithCommitment(
    useTaskStore.getState().tasks,
    "day",
    dayKey,
    scopeIds,
    requiredIds,
    allPriority,
  )
  for (const next of marked) updateTask(next)
  clearMorningDraft(dayKey)
  const clearedLines = [""]
  const keptWalks: Record<string, TodoWalkFormFields> = {}
  for (const [id, form] of Object.entries(todoWalkById)) {
    if (form.skipped) keptWalks[id] = { ...emptyTodoWalkForm(), skipped: true }
  }
  return { clearedLines, keptWalks }
}
