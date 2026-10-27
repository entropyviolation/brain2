/**
 * components/Reviews/morning/MorningReviewDialog.tsx — Morning review shell.
 *
 * Stepper, day arrows, answered lamps, and the save epilogue. Step bodies,
 * the session draft, and the store write live in the sibling files. Speak them
 * stays a sibling of this dialog's content.
 */
"use client"

import { useEffect, useMemo, useState } from "react"
import "../ritual-steps.css"
import { AffirmationsDialog } from "@/components/Reviews/AffirmationsDialog"
import { RitualStepper, useRitualStep, type RitualStep } from "@/components/Reviews/RitualSteps"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { ChevronLeft, ChevronRight, Sun } from "lucide-react"
import { applyRitualPriority } from "@/lib/habit-priority"
import { describeAllNighterLifts, isHabitPeriodExempt } from "@/lib/habit-exemption"
import { useHabitsStore } from "@/lib/habits-store"
import { useGoalsStore } from "@/lib/goals-store"
import { taskServesFocusGoals } from "@/lib/goal-focus"
import { taskScheduledOnDay } from "@/lib/date-utils"
import { nightCarryForMorning } from "@/lib/ritual-carry"
import { useReviewsStore, localDayKey, morningReviewPhase, periodLabel } from "@/lib/reviews-store"
import { useExemptionContext, useSleepStore } from "@/lib/sleep-store"
import { useSleepSync } from "@/lib/sleep-sync"
import {
  formatSleepDuration,
  nightProblem,
  parseBedtime,
  parseWakeTime,
  sleepMinutes,
} from "@/lib/sleep-log"
import type { SleepClockSource } from "@/lib/estimated-values"
import { useTaskStore } from "@/lib/task-store"
import type { Task } from "@/lib/types"
import { AFFIRMATIONS_PER_SESSION, pickRandom } from "@/lib/affirmations"
import { useAffirmationLogStore } from "@/lib/affirmation-log-store"
import { emptyTodoWalkForm, isTodoWalkFormBlank, type TodoWalkFormFields } from "@/lib/morning-todo-walk"
import { affirmationPool, openListInLists } from "./affirmation-pool"
import { AffirmationsStep } from "./AffirmationsStep"
import { BestDayStep } from "./BestDayStep"
import { CircumstancesStep } from "./CircumstancesStep"
import { commitMorning as commitMorningWrite } from "./commit-morning"
import { GratitudeStep } from "./GratitudeStep"
import { HabitsStep } from "./HabitsStep"
import { LookAheadStep } from "./LookAheadStep"
import { NightStep } from "./NightStep"
import { usePaintedNight } from "./painted-night"
import { PlanStep } from "./PlanStep"
import { MORNING_STEPS, RESUME_TO_STEP } from "./steps"
import { TodosStep } from "./TodosStep"
import { useMorningForm } from "./use-morning-form"
import { WalkStep } from "./WalkStep"

export function MorningReviewDialog({
  open,
  onClose,
  date,
}: {
  open: boolean
  onClose: () => void
  date?: Date
}) {
  useSleepSync()
  const [activeDate, setActiveDate] = useState(() => date ?? new Date())
  const dateKey = date ? localDayKey(date) : ""
  useEffect(() => {
    if (!open) return
    setActiveDate(date ?? new Date())
    // `date` objects are not stable; key the reset on the calendar day.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, dateKey])
  const dayKey = localDayKey(activeDate)
  const recitations = useAffirmationLogStore((s) => s.recitations)
  const recite = useAffirmationLogStore((s) => s.recite)
  const undoRecite = useAffirmationLogStore((s) => s.undoRecite)
  const saidToday = useMemo(() => {
    const out = new Map<string, number>()
    for (const r of recitations) if (r.date === dayKey) out.set(r.key, (out.get(r.key) ?? 0) + 1)
    return out
  }, [recitations, dayKey])
  const tasks = useTaskStore((s) => s.tasks)
  const lists = useTaskStore((s) => s.lists)
  const addList = useTaskStore((s) => s.addList)
  const addTask = useTaskStore((s) => s.addTask)
  const updateTask = useTaskStore((s) => s.updateTask)
  const habitTasks = useHabitsStore((s) => s.tasks)
  const habitExemptions = useHabitsStore((s) => s.habitExemptions)
  const replaceMorningReview = useReviewsStore((s) => s.replaceMorningReview)
  const existing = useReviewsStore((s) => s.getReview("day", dayKey)?.morning)

  const loggedNight = useSleepStore((s) => s.nights[dayKey])
  const setStoreBedtime = useSleepStore((s) => s.setBedtime)
  const setStoreWakeTime = useSleepStore((s) => s.setWakeTime)
  const setAllNighter = useSleepStore((s) => s.setAllNighter)

  const paintedNight = usePaintedNight(dayKey)

  const knownWake =
    loggedNight?.wokeMin ??
    (existing?.wakeTime ? parseWakeTime(existing.wakeTime) : undefined) ??
    paintedNight?.wokeMin
  const knownBedtime = loggedNight?.sleptMin ?? paintedNight?.sleptMin

  const bedSource: SleepClockSource | null =
    loggedNight?.sleptMin !== undefined
      ? (loggedNight.sleptPrecision ?? "estimated") === "estimated"
        ? "remembered"
        : null
      : paintedNight?.sleptMin !== undefined
        ? "painted"
        : null
  const wakeSource: SleepClockSource | null =
    loggedNight?.wokeMin !== undefined
      ? (loggedNight.wokePrecision ?? "estimated") === "estimated"
        ? "remembered"
        : null
      : paintedNight?.wokeMin !== undefined
        ? "painted"
        : null

  const {
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
  } = useMorningForm({
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
  })

  const [affirmationsOpen, setAffirmationsOpen] = useState(false)
  const reviews = useReviewsStore((s) => s.reviews)
  const goals = useGoalsStore((s) => s.goals)
  const carry = useMemo(() => nightCarryForMorning(reviews, activeDate), [reviews, activeDate])

  const todaysTasks = useMemo<Task[]>(() => {
    const openTasks = tasks.filter((t) => !t.completed && taskScheduledOnDay(t, activeDate))
    const focused = new Set(
      openTasks.filter((task) => taskServesFocusGoals(task, goals, carry.focusGoalIds)).map((task) => task.id),
    )
    if (focused.size === 0) return openTasks
    return [...openTasks.filter((task) => focused.has(task.id)), ...openTasks.filter((task) => !focused.has(task.id))]
  }, [tasks, activeDate, goals, carry.focusGoalIds])

  const storedExemption = useExemptionContext()
  const habitPickCtx = useMemo(() => {
    if (!allNighter) return storedExemption
    const mornings = new Set(storedExemption.allNighterMornings)
    mornings.add(dayKey)
    return { allNighterMornings: mornings }
  }, [allNighter, storedExemption, dayKey])
  const allNighterLifts = useMemo(() => describeAllNighterLifts(habitTasks), [habitTasks])

  const dailyHabits = useMemo(
    () =>
      habitTasks.filter(
        (h) =>
          (h.frequency || "daily") === "daily" &&
          !isHabitPeriodExempt(h, dayKey, "daily", habitExemptions, habitPickCtx),
      ),
    [habitTasks, habitExemptions, dayKey, habitPickCtx],
  )

  const draftNight = {
    date: dayKey,
    sleptMin: !allNighter && bedTime.trim() ? parseBedtime(bedTime) : undefined,
    wokeMin: !allNighter && wakeTime.trim() ? parseWakeTime(wakeTime) : undefined,
  }
  const draftMinutes = sleepMinutes(draftNight)
  const nightSummary = allNighter
    ? "All-nighter — sleep clocks are skipped. Still start the day with this morning routine."
    : nightProblem(draftNight) ??
      (draftMinutes !== null
        ? `${formatSleepDuration(draftMinutes)} asleep. Saving paints it on the Sleep pen and logs it in Done.`
        : "Both ends turn the night into tracked time, a Done row, and habit minutes.")

  const togglePriority = (id: string) =>
    setPriorityIds((p) => {
      if (p.includes(id)) return p.filter((x) => x !== id)
      if (p.length >= 5) return p
      return [...p, id]
    })

  const toggleHabitPriority = (id: string) =>
    setPriorityHabitIds((p) => {
      if (p.includes(id)) return p.filter((x) => x !== id)
      if (p.length >= 3) return p
      const task = useHabitsStore.getState().tasks.find((row) => row.id === id)
      if (task) useHabitsStore.getState().updateTask(applyRitualPriority(task, "day", activeDate))
      return [...p, id]
    })

  const patchWalk = (id: string, patch: Partial<TodoWalkFormFields>) =>
    setTodoWalkById((prev) => ({
      ...prev,
      [id]: { ...(prev[id] ?? emptyTodoWalkForm()), ...patch },
    }))

  const commitMorning = (complete: boolean) => {
    if (complete) submittedRef.current = true
    try {
      const { clearedLines, keptWalks } = commitMorningWrite({
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
        affirmationsTouched: affirmationsTouchedRef.current,
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
      })
      setNewTodoLines(clearedLines)
      setTodoWalkById(keptWalks)
      baselineRef.current = packForm({ ...currentForm(), newTodoLines: clearedLines, todoWalkById: keptWalks })
      if (complete) onClose()
      else setSavedNote("Saved. Unanswered questions stay open.")
    } catch (err) {
      console.error("[MorningReview] save failed", err)
    }
  }

  const dismiss = () => {
    if (!submittedRef.current && packForm(currentForm()) !== baselineRef.current) commitMorning(false)
    submittedRef.current = true
    onClose()
  }

  const shiftDay = (delta: number) => {
    if (packForm(currentForm()) !== baselineRef.current) commitMorning(false)
    setSavedNote("")
    setActiveDate((d) => {
      const next = new Date(d)
      next.setDate(next.getDate() + delta)
      return next
    })
  }

  const [affirmSeen, setAffirmSeen] = useState(false)
  const [step, setStep] = useRitualStep(`brain2-morning-step:${dayKey}`, MORNING_STEPS.length, () => {
    if (!existing || existing.completed) return 0
    const id = existing.resumeStep ? RESUME_TO_STEP[existing.resumeStep] : undefined
    const at = MORNING_STEPS.findIndex((s) => s.id === id)
    return at < 0 ? 0 : at
  })
  const stepId = MORNING_STEPS[step]?.id ?? "night"
  // Look-ahead steps are read-and-act; seeing them is the answer.
  const [visitedAhead, setVisitedAhead] = useState<string[]>([])
  useEffect(() => {
    if (open && (stepId === "ahead" || stepId === "due" || stepId === "overdue"))
      setVisitedAhead((v) => (v.includes(stepId) ? v : [...v, stepId]))
  }, [open, stepId])
  useEffect(() => {
    if (open && stepId === "affirmations") setAffirmSeen(true)
  }, [open, stepId])
  useEffect(() => {
    if (open) setAffirmSeen(!!existing?.affirmations?.length)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, dayKey])

  const answered: Record<(typeof MORNING_STEPS)[number]["id"], boolean> = {
    night: allNighter || !!(bedTime.trim() && wakeTime.trim()) || !!dream.trim(),
    affirmations: affirmSeen,
    todos: priorityIds.length > 0 || requiredIds.length > 0 || newTodoLines.some((l) => l.trim()),
    ahead: visitedAhead.includes("ahead"),
    due: visitedAhead.includes("due"),
    overdue: visitedAhead.includes("overdue"),
    habits: priorityHabitIds.length > 0,
    walk: Object.values(todoWalkById).some((f) => f.skipped || !isTodoWalkFormBlank(f)),
    plan: !!dayPlan.trim() || !!existing?.dayPlanLogged,
    circumstances: Object.values(circumstance).some(Boolean),
    best: !!bestDayWhy.trim(),
    gratitude: gratitude.some((g) => g.trim()),
  }
  const steps: RitualStep[] = MORNING_STEPS.map((s) => ({ id: s.id, label: s.label, answered: answered[s.id] }))

  /** Moving between questions writes progress, the same as Save progress. */
  const goStep = (next: number) => {
    if (packForm(currentForm()) !== baselineRef.current) commitMorning(false)
    setStep(next)
  }

  const shuffleAffirmations = () => {
    const { pool } = affirmationPool(lists, tasks, addList, addTask)
    const current = new Set(affirmations)
    const fresh = pool.filter((line) => !current.has(line))
    const next = pickRandom(fresh.length >= AFFIRMATIONS_PER_SESSION ? fresh : pool, AFFIRMATIONS_PER_SESSION)
    setAffirmations(next)
    setSessionAffirmations(next)
    affirmationsTouchedRef.current = true
  }

  const openAffirmationsList = () => {
    const { listId } = affirmationPool(lists, tasks, addList, addTask)
    dismiss()
    if (listId) openListInLists(listId)
  }

  const shownAffirmations = affirmations.length ? affirmations : sessionAffirmations

  const lookAheadNow = activeDate.getTime() > Date.now() ? activeDate : new Date()
  const stepBody = (() => {
    switch (stepId) {
      case "night":
        return (
          <NightStep
            carry={carry}
            goals={goals}
            allNighter={allNighter}
            setAllNighterLocal={setAllNighterLocal}
            allNighterLifts={allNighterLifts}
            bedTime={bedTime}
            bedEstSource={bedEstSource}
            setBedTime={setBedTime}
            setBedEstSource={setBedEstSource}
            wakeTime={wakeTime}
            wakeEstSource={wakeEstSource}
            setWakeTime={setWakeTime}
            setWakeEstSource={setWakeEstSource}
            dream={dream}
            setDream={setDream}
            nightSummary={nightSummary}
          />
        )
      case "affirmations":
        return (
          <AffirmationsStep
            shownAffirmations={shownAffirmations}
            saidToday={saidToday}
            dayKey={dayKey}
            recite={recite}
            undoRecite={undoRecite}
            onSpeak={() => setAffirmationsOpen(true)}
            onShuffle={shuffleAffirmations}
            onEditList={openAffirmationsList}
          />
        )
      case "ahead":
      case "due":
      case "overdue":
        return (
          <LookAheadStep stepId={stepId} now={lookAheadNow} dayKey={dayKey} activeDate={activeDate} />
        )
      case "todos":
        return (
          <TodosStep
            todaysTasks={todaysTasks}
            newTodoLines={newTodoLines}
            setNewTodoLines={setNewTodoLines}
            requiredIds={requiredIds}
            setRequiredIds={setRequiredIds}
            priorityIds={priorityIds}
            togglePriority={togglePriority}
          />
        )
      case "habits":
        return (
          <HabitsStep
            dailyHabits={dailyHabits}
            priorityHabitIds={priorityHabitIds}
            toggleHabitPriority={toggleHabitPriority}
          />
        )
      case "walk":
        return (
          <WalkStep
            todaysTasks={todaysTasks}
            dayKey={dayKey}
            todoWalkById={todoWalkById}
            patchWalk={patchWalk}
          />
        )
      case "plan":
        return <PlanStep dayPlan={dayPlan} setDayPlan={setDayPlan} />
      case "circumstances":
        return (
          <CircumstancesStep
            circumstance={circumstance}
            setCircumstance={setCircumstance}
            mustNotDo={mustNotDo}
            setMustNotDo={setMustNotDo}
            newEvents={newEvents}
            setNewEvents={setNewEvents}
            excitedAbout={excitedAbout}
            setExcitedAbout={setExcitedAbout}
          />
        )
      case "best":
        return <BestDayStep bestDayWhy={bestDayWhy} setBestDayWhy={setBestDayWhy} />
      case "gratitude":
        return <GratitudeStep gratitude={gratitude} setGratitude={setGratitude} />
    }
  })()

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) dismiss()
      }}
    >
      <DialogContent
        className="hpp95 hpp95-dialog sm:max-w-2xl h-[min(88vh,780px)] overflow-hidden flex flex-col"
        data-ui-name="Morning review"
        data-ui-docs="components/Reviews/README.md"
      >
        <DialogHeader className="hpp-caption">
          <div className="hpp-caption-mark">
            <span className="hpp-power-lamp" aria-hidden />
            <DialogTitle className="flex items-center gap-2">
              <Sun className="h-5 w-5" />
              Morning Review
            </DialogTitle>
          </div>
          <div className="flex items-center gap-1">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-8 w-8 shrink-0"
              aria-label="Previous day"
              onClick={() => shiftDay(-1)}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <DialogDescription className="hpp-caption-lead flex-1 text-center" data-morning-day={dayKey}>
              {periodLabel("day", dayKey)}
              {morningReviewPhase(existing) === "partial"
                ? " · in progress"
                : morningReviewPhase(existing) === "done"
                  ? " · saved"
                  : ""}
            </DialogDescription>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-8 w-8 shrink-0"
              aria-label="Next day"
              disabled={dayKey >= localDayKey(new Date())}
              onClick={() => shiftDay(1)}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </DialogHeader>

        <div className="hpp-body flex-1 min-h-0">
          <RitualStepper
            tone="dawn"
            steps={steps}
            index={step}
            onStep={goStep}
            finishLabel="Finish"
            onFinish={() => commitMorning(true)}
          >
            {stepBody}
          </RitualStepper>
        </div>

        <div className="hpp-actions flex-wrap">
          {savedNote ? <p className="w-full text-xs text-muted-foreground">{savedNote}</p> : null}
          <Button variant="outline" onClick={dismiss}>
            Close
          </Button>
          <Button variant="outline" onClick={() => commitMorning(false)}>
            Save progress
          </Button>
          <Button className="hpp-key-go" onClick={() => commitMorning(true)}>
            Save Morning Review
          </Button>
        </div>
      </DialogContent>

      <AffirmationsDialog
        dayKey={dayKey}
        open={affirmationsOpen}
        lines={shownAffirmations}
        onClose={() => {
          setAffirmationsOpen(false)
          if (sessionAffirmations.length) {
            setAffirmations(sessionAffirmations)
            affirmationsTouchedRef.current = true
          }
        }}
      />
    </Dialog>
  )
}
