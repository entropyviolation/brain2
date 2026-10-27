/**
 * components/Reviews/morning/use-morning-form.ts — Field state for one open day.
 *
 * Seeds once per open day, reseeds when that day changes, and writes a session
 * draft only when the store has no morning slice yet. `requiredIds` is state
 * here and is not part of the draft. `packForm` key order matches `MorningDraft`.
 */
"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { AFFIRMATIONS_PER_SESSION, DEFAULT_AFFIRMATIONS } from "@/lib/affirmations"
import type { SleepClockSource } from "@/lib/estimated-values"
import type { TodoWalkFormFields } from "@/lib/morning-todo-walk"
import type { SleepNight } from "@/lib/sleep-log"
import { useTaskStore } from "@/lib/task-store"
import { taskScheduledOnDay } from "@/lib/date-utils"
import { taskIsPrioritized, taskIsRequired } from "@/lib/todo-commitment"
import type { List, Task } from "@/lib/types"
import { ensureAffirmationLines } from "./affirmation-pool"
import { readMorningDraft, seedFromMorning, writeMorningDraft, safeClock } from "./draft"
import type { MorningDraft, MorningSlice } from "./types"

export function useMorningForm({
  open,
  dayKey,
  activeDate,
  existing,
  lists,
  tasks,
  addList,
  addTask,
  knownWake,
  knownBedtime,
  loggedNight,
  bedSource,
  wakeSource,
}: {
  open: boolean
  dayKey: string
  activeDate: Date
  existing: MorningSlice | undefined
  lists: List[]
  tasks: Task[]
  addList: (list: List) => void
  addTask: (task: Task) => void
  knownWake: number | undefined
  knownBedtime: number | undefined
  loggedNight: SleepNight | undefined
  bedSource: SleepClockSource | null
  wakeSource: SleepClockSource | null
}) {
  // Finished review wins; else same-day session draft; else clean. Live sleep
  // clocks always layer on top so a stale draft cannot mask the sleep log / grid.
  const seed = useMemo(() => {
    const base = seedFromMorning(existing, readMorningDraft(dayKey))
    if (knownWake !== undefined) base.wakeTime = safeClock(knownWake)
    if (knownBedtime !== undefined) base.bedTime = safeClock(knownBedtime)
    if (loggedNight?.allNighter || existing?.allNighter) base.allNighter = true
    return base
    // Seed once per open/day — field edits must not reset from store churn.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, dayKey])

  const [allNighter, setAllNighterLocal] = useState(seed.allNighter)
  const [wakeTime, setWakeTime] = useState(seed.wakeTime)
  const [bedTime, setBedTime] = useState(seed.bedTime)
  const [bedEstSource, setBedEstSource] = useState<SleepClockSource | null>(bedSource)
  const [wakeEstSource, setWakeEstSource] = useState<SleepClockSource | null>(wakeSource)
  const [dream, setDream] = useState(seed.dream)
  const [affirmations, setAffirmations] = useState<string[]>(seed.affirmations)
  const [newTodoLines, setNewTodoLines] = useState<string[]>(seed.newTodoLines)
  const [priorityIds, setPriorityIds] = useState<string[]>(seed.priorityIds)
  const [requiredIds, setRequiredIds] = useState<string[]>([])
  const [priorityHabitIds, setPriorityHabitIds] = useState<string[]>(seed.priorityHabitIds)
  const [todoWalkById, setTodoWalkById] = useState<Record<string, TodoWalkFormFields>>(seed.todoWalkById)
  const [dayPlan, setDayPlan] = useState(seed.dayPlan)
  const [circumstance, setCircumstance] = useState(seed.circumstance)
  const [mustDo, setMustDo] = useState(seed.mustDo)
  const [mustNotDo, setMustNotDo] = useState(seed.mustNotDo)
  const [newEvents, setNewEvents] = useState(seed.newEvents)
  const [excitedAbout, setExcitedAbout] = useState(seed.excitedAbout)
  const [bestDayWhy, setBestDayWhy] = useState(seed.bestDayWhy)
  const [gratitude, setGratitude] = useState<string[]>(seed.gratitude)
  const [sessionAffirmations, setSessionAffirmations] = useState<string[]>(seed.affirmations)
  const [savedNote, setSavedNote] = useState("")
  const baselineRef = useRef("")
  const affirmationsTouchedRef = useRef(false)
  const submittedRef = useRef(false)

  const packForm = (fields: MorningDraft) => JSON.stringify(fields)

  useEffect(() => {
    if (!open) return
    let lines = seed.affirmations
    if (!lines.length) {
      try {
        lines = ensureAffirmationLines(lists, tasks, addList, addTask)
      } catch {
        lines = DEFAULT_AFFIRMATIONS.slice(0, AFFIRMATIONS_PER_SESSION)
      }
    }
    const next: MorningDraft = { ...seed, affirmations: lines }
    const dayTasks = useTaskStore
      .getState()
      .tasks.filter((task) => !task.completed && taskScheduledOnDay(task, activeDate))
    const markedPriority = dayTasks.filter((task) => taskIsPrioritized(task, "day", dayKey)).map((task) => task.id)
    const markedRequired = dayTasks.filter((task) => taskIsRequired(task, "day", dayKey)).map((task) => task.id)
    const seededPriority = [...new Set([...next.priorityIds, ...markedPriority])]
    setAllNighterLocal(next.allNighter)
    setWakeTime(next.wakeTime)
    setBedTime(next.bedTime)
    setBedEstSource(bedSource)
    setWakeEstSource(wakeSource)
    setDream(next.dream)
    setAffirmations(next.affirmations)
    setNewTodoLines(next.newTodoLines)
    setPriorityIds(seededPriority)
    setRequiredIds(markedRequired)
    setPriorityHabitIds(next.priorityHabitIds)
    setTodoWalkById(next.todoWalkById)
    setDayPlan(next.dayPlan)
    setCircumstance(next.circumstance)
    setMustDo(next.mustDo)
    setMustNotDo(next.mustNotDo)
    setNewEvents(next.newEvents)
    setExcitedAbout(next.excitedAbout)
    setBestDayWhy(next.bestDayWhy)
    setGratitude(next.gratitude)
    setSessionAffirmations(lines)
    setSavedNote("")
    affirmationsTouchedRef.current = lines.length > 0 && seed.affirmations.length > 0
    baselineRef.current = packForm({ ...next, priorityIds: seededPriority })
    // Re-seed when the open day changes. Store churn must not wipe field edits.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, dayKey, seed])

  // Persist in-progress answers for refresh / close-reopen on the same day.
  // Never overwrite a finished review in the store — only session draft.
  useEffect(() => {
    if (!open) return
    if (existing) return
    writeMorningDraft(dayKey, {
      allNighter,
      wakeTime,
      bedTime,
      dream,
      affirmations,
      newTodoLines,
      priorityIds,
      priorityHabitIds,
      todoWalkById,
      dayPlan,
      circumstance,
      mustDo,
      mustNotDo,
      newEvents,
      excitedAbout,
      bestDayWhy,
      gratitude,
    })
  }, [
    open,
    dayKey,
    existing,
    allNighter,
    wakeTime,
    bedTime,
    dream,
    affirmations,
    newTodoLines,
    priorityIds,
    priorityHabitIds,
    todoWalkById,
    dayPlan,
    circumstance,
    mustDo,
    mustNotDo,
    newEvents,
    excitedAbout,
    bestDayWhy,
    gratitude,
  ])

  const currentForm = (): MorningDraft => ({
    allNighter,
    wakeTime,
    bedTime,
    dream,
    affirmations,
    newTodoLines,
    priorityIds,
    priorityHabitIds,
    todoWalkById,
    dayPlan,
    circumstance,
    mustDo,
    mustNotDo,
    newEvents,
    excitedAbout,
    bestDayWhy,
    gratitude,
  })

  return {
    allNighter,
    setAllNighterLocal,
    wakeTime,
    setWakeTime,
    bedTime,
    setBedTime,
    bedEstSource,
    setBedEstSource,
    wakeEstSource,
    setWakeEstSource,
    dream,
    setDream,
    affirmations,
    setAffirmations,
    newTodoLines,
    setNewTodoLines,
    priorityIds,
    setPriorityIds,
    requiredIds,
    setRequiredIds,
    priorityHabitIds,
    setPriorityHabitIds,
    todoWalkById,
    setTodoWalkById,
    dayPlan,
    setDayPlan,
    circumstance,
    setCircumstance,
    mustDo,
    setMustDo,
    mustNotDo,
    setMustNotDo,
    newEvents,
    setNewEvents,
    excitedAbout,
    setExcitedAbout,
    bestDayWhy,
    setBestDayWhy,
    gratitude,
    setGratitude,
    sessionAffirmations,
    setSessionAffirmations,
    savedNote,
    setSavedNote,
    baselineRef,
    affirmationsTouchedRef,
    submittedRef,
    packForm,
    currentForm,
  }
}
