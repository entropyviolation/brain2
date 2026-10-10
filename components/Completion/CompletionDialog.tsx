/**
 * components/Completion/CompletionDialog.tsx — Per-completion contribution popup
 *
 * Shown on *every* task completion (driven by the completion event bus). This
 * is the done review, not a day/week/month/season ritual (`ReviewDialog`,
 * morning, or start). Lets
 * the user record which Objectives and Goals the finished task contributed to,
 * or create a new one of either without leaving the popup. An optional quick
 * review records how long the work took, when it started, and when it finished.
 * Length and start are each exact, estimated, or unknown. Unknown stores no
 * minutes and no start time. The finish is any day and time, exact or
 * estimated. A few
 * 1–10 reflections and notes follow. Agreeing to that review
 * awards 3 points plus 0.1 per word. **Undo** reopens the task; **Skip** keeps
 * the completion without a contribution.
 */
"use client"

import { useMemo, useState, type ReactNode } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { ClockPicker } from "@/components/ui/clock-picker/clock-picker"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Switch } from "@/components/ui/switch"
import { CheckCircle2, Search, Star, Target, Trophy, Undo2 } from "lucide-react"
import { useTaskStore } from "@/lib/task-store"
import { uncompleteTask, completeTask } from "@/lib/services/completion-service"
import {
  useGoalsStore,
  objectiveMultiplierFor,
  taskObjectiveMultiplier,
} from "@/lib/goals-store"
import { composePointMultiplier, taskServesFocusGoals } from "@/lib/goal-focus"
import { pointsRuleValue } from "@/lib/points-rules-live"
import { nightCarryForMorning } from "@/lib/ritual-carry"
import { useReviewsStore } from "@/lib/reviews-store"
import { useUserSettingsStore } from "@/lib/user-settings-store"
import { usePointsStore } from "@/lib/points-store"
import { isObjectivePrioritized } from "@/lib/objectives"
import type { ClockCertainty, CompletionReflections } from "@/lib/types"
import { REFLECTION_SCALES, type ReflectionScoreKey } from "@/lib/completion-review"
import {
  applyClockWrite,
  clearQuickReviewPoints,
  clockDraftFromTask,
  clockWriteFromDraft,
  composeCompletionReview,
  formatReviewPoints,
  pickReflectionScores,
  quickReviewPoints,
  recordQuickReviewPoints,
  reviewWordCount,
  type ClockDraft,
} from "@/lib/completion-review"
import { itemTitle, itemTitleOrUntitled } from "@/lib/item-utils"
import { usualDurationMinutes } from "@/lib/estimated-values"
import { snapshotsEqual } from "@/lib/unsaved-changes"
import { UnsavedChangesDialog, unsavedDismissProps, useUnsavedGuard } from "@/components/ui/unsaved-changes-guard"

const PRIORITY_PERIODS = ["day", "week", "month", "quarter", "year"] as const

function round2(n: number): number {
  return Math.round(n * 100) / 100
}

function matchesQuery(query: string, ...fields: Array<string | undefined>): boolean {
  const q = query.trim().toLowerCase()
  if (!q) return true
  return fields.some((field) => (field ?? "").toLowerCase().includes(q))
}

function ListSearch({
  value,
  onChange,
  placeholder,
  "aria-label": ariaLabel,
}: {
  value: string
  onChange: (value: string) => void
  placeholder: string
  "aria-label": string
}) {
  return (
    <div className="relative border-b p-1.5">
      <Search className="pointer-events-none absolute left-3.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
      <Input
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        aria-label={ariaLabel}
        className="h-8 pl-8"
      />
    </div>
  )
}

function ClockCertaintyField({
  legend,
  groupLabel,
  choices,
  value,
  onChange,
  unknownHint,
  estimatedHint,
  control,
}: {
  legend: string
  groupLabel: string
  choices: { id: ClockCertainty; label: string; name: string }[]
  value: ClockCertainty | "unspecified"
  onChange: (next: ClockCertainty) => void
  unknownHint: string
  estimatedHint: string
  control: ReactNode
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs">{legend}</Label>
      <div className="flex gap-1" role="group" aria-label={groupLabel}>
        {choices.map((choice) => {
          const on = value === choice.id
          return (
            <button
              key={choice.id}
              type="button"
              aria-label={choice.name}
              aria-pressed={on}
              onClick={() => onChange(choice.id)}
              className={`h-7 rounded border px-2 text-xs ${
                on ? "border-primary bg-primary text-primary-foreground" : "bg-background hover:bg-muted"
              }`}
            >
              {choice.label}
            </button>
          )
        })}
      </div>
      {value === "unknown" ? (
        <p className="text-[10px] text-muted-foreground">{unknownHint}</p>
      ) : (
        control
      )}
      {value === "estimated" && <p className="text-[10px] text-muted-foreground">{estimatedHint}</p>}
    </div>
  )
}

function ScoreRow({
  label,
  hint,
  value,
  onChange,
}: {
  label: string
  hint: string
  value: number | undefined
  onChange: (value: number | undefined) => void
}) {
  return (
    <div className="space-y-1">
      <div className="flex items-baseline justify-between gap-2">
        <Label className="text-xs" title={hint}>
          {label}
        </Label>
        <span className="text-[10px] text-muted-foreground">{value ? `${value}/10` : "optional"}</span>
      </div>
      <div className="flex gap-0.5" role="group" aria-label={label}>
        {Array.from({ length: 10 }, (_, i) => {
          const n = i + 1
          const on = value === n
          return (
            <button
              key={n}
              type="button"
              aria-label={`${label} ${n}`}
              aria-pressed={on}
              title={hint}
              onClick={() => onChange(on ? undefined : n)}
              className={`h-6 flex-1 rounded border text-[10px] tabular-nums ${
                on ? "border-primary bg-primary text-primary-foreground" : "bg-background hover:bg-muted"
              }`}
            >
              {n}
            </button>
          )
        })}
      </div>
    </div>
  )
}

export function CompletionDialog({
  taskId,
  basePoints,
  pending = false,
  onClose,
}: {
  taskId: string
  basePoints: number
  /** True when the checkbox opened this dialog before flipping `completed`. */
  pending?: boolean
  onClose: () => void
}) {
  const task = useTaskStore((s) => s.tasks.find((t) => t.id === taskId))
  const tasks = useTaskStore((s) => s.tasks)
  const updateTask = useTaskStore((s) => s.updateTask)
  const objectives = useGoalsStore((s) => s.objectives)
  const goals = useGoalsStore((s) => s.goals)
  const addObjective = useGoalsStore((s) => s.addObjective)
  const addGoal = useGoalsStore((s) => s.addGoal)
  const setGoalProgress = useGoalsStore((s) => s.setGoalProgress)
  const addPoints = usePointsStore((s) => s.addPoints)

  const initialClock = clockDraftFromTask(task)
  const initialScores = pickReflectionScores(task?.completionReview)

  const [objectiveIds, setObjectiveIds] = useState<string[]>(task?.contributesToObjectiveIds ?? [])
  const [goalIds, setGoalIds] = useState<string[]>(task?.contributesToGoalIds ?? [])
  const [objectiveQuery, setObjectiveQuery] = useState("")
  const [goalQuery, setGoalQuery] = useState("")
  const [objectiveDraft, setObjectiveDraft] = useState("")
  const [goalDraft, setGoalDraft] = useState("")
  const [showReflection, setShowReflection] = useState(false)
  const [scores, setScores] = useState<Partial<CompletionReflections>>(initialScores)
  const [durationCertainty, setDurationCertainty] = useState<ClockDraft["durationCertainty"]>(initialClock.durationCertainty)
  const [actualDuration, setActualDuration] = useState(initialClock.durationMinutes)
  const [startCertainty, setStartCertainty] = useState<ClockDraft["startCertainty"]>(initialClock.startCertainty)
  const [startTime, setStartTime] = useState(initialClock.startTime)
  const [doneCertainty, setDoneCertainty] = useState<ClockDraft["doneCertainty"]>(initialClock.doneCertainty)
  const [doneDate, setDoneDate] = useState(initialClock.doneDate)
  const [doneTime, setDoneTime] = useState(initialClock.doneTime)
  const [notes, setNotes] = useState("")

  const activeObjectives = useMemo(() => objectives.filter((o) => !o.archived), [objectives])

  const visibleObjectives = useMemo(() => {
    return activeObjectives
      .filter((o) => objectiveIds.includes(o.id) || matchesQuery(objectiveQuery, o.title, o.description))
      .sort((a, b) => Number(objectiveIds.includes(b.id)) - Number(objectiveIds.includes(a.id)))
  }, [activeObjectives, objectiveIds, objectiveQuery])

  const visibleGoals = useMemo(() => {
    const relevant = (g: { objectiveIds: string[] }) => g.objectiveIds.some((id) => objectiveIds.includes(id))
    return [...goals]
      .filter((g) => goalIds.includes(g.id) || matchesQuery(goalQuery, g.title, g.description))
      .sort((a, b) => Number(goalIds.includes(b.id)) - Number(goalIds.includes(a.id)) || Number(relevant(b)) - Number(relevant(a)))
  }, [goals, goalIds, goalQuery, objectiveIds])

  const reviews = useReviewsStore((s) => s.reviews)
  const focusMultiplier = useUserSettingsStore((s) => s.goalFocusMultiplier)
  const multiplier = useMemo(() => {
    const objectiveMultiplier = taskObjectiveMultiplier(objectives, objectiveIds)
    const carry = nightCarryForMorning(reviews, new Date())
    const focused = taskServesFocusGoals(
      {
        contributesToGoalIds: goalIds.length ? goalIds : task?.contributesToGoalIds,
        contributesToObjectiveIds: objectiveIds.length ? objectiveIds : task?.contributesToObjectiveIds,
      },
      goals,
      carry.focusGoalIds,
    )
    return composePointMultiplier(objectiveMultiplier, pointsRuleValue("goalFocus.multiplier"), focused)
  }, [objectives, objectiveIds, reviews, focusMultiplier, goalIds, goals, task])
  const focusedForBase = multiplier > 1 && objectiveIds.length === 0 && basePoints <= 0
  const fallbackBase = pointsRuleValue("list.defaultCompletionPoints")
  const effectiveBase = basePoints > 0 ? basePoints : objectiveIds.length || focusedForBase ? fallbackBase : 0
  const total = round2(effectiveBase * multiplier)
  const bonus = round2(total - basePoints)

  const usual = useMemo(() => usualDurationMinutes(tasks, task), [tasks, task])
  const words = reviewWordCount(notes)
  const reviewPoints = quickReviewPoints(words)

  const toggleObjective = (id: string) =>
    setObjectiveIds((ids) => (ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id]))
  const toggleGoal = (id: string) =>
    setGoalIds((ids) => (ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id]))

  const setScore = (key: ReflectionScoreKey, value: number | undefined) =>
    setScores((prev) => {
      const next = { ...prev }
      if (value === undefined) delete next[key]
      else next[key] = value
      return next
    })

  const createObjective = () => {
    const title = objectiveDraft.trim()
    if (!title) return
    const id = addObjective({ title })
    setObjectiveIds((ids) => (ids.includes(id) ? ids : [...ids, id]))
    setObjectiveDraft("")
  }

  const createGoal = () => {
    const title = goalDraft.trim()
    if (!title || objectiveIds.length === 0) return
    const id = addGoal({
      title,
      type: "count",
      target: 1,
      periodKind: "year",
      objectiveIds: [...objectiveIds],
      points: 0,
    })
    setGoalIds((ids) => (ids.includes(id) ? ids : [...ids, id]))
    setGoalDraft("")
  }

  const handleSave = () => {
    if (!task) return
    const draft: ClockDraft = {
      durationCertainty,
      durationMinutes: actualDuration,
      startCertainty,
      startTime,
      doneCertainty,
      doneDate,
      doneTime,
    }
    const clockTouched = !snapshotsEqual(draft, initialClock)
    const clock = clockWriteFromDraft(task, draft)
    const base = clockTouched || showReflection ? applyClockWrite(task, clock) : task
    const stamped = task.completedDate instanceof Date ? task.completedDate : task.completedDate ? new Date(task.completedDate) : new Date()
    const completedAt = clock.writeDone && clock.completedDate ? clock.completedDate : stamped
    const review = showReflection
      ? composeCompletionReview({
          taskId: task.id,
          completedAt,
          notes,
          clock,
          scores,
          awardQuickReview: true,
        })
      : undefined

    updateTask({
      ...base,
      completed: true,
      contributesToObjectiveIds: objectiveIds.length ? objectiveIds : undefined,
      contributesToGoalIds: goalIds.length ? goalIds : undefined,
      ...(review ? { completionReview: review } : {}),
    })

    for (const id of goalIds) {
      const goal = goals.find((g) => g.id === id)
      if (goal) setGoalProgress(goal.id, goal.current + 1)
    }

    if (bonus > 0) {
      addPoints(task.id, bonus, `Objective bonus: ${itemTitleOrUntitled(task, "Task")}`, completedAt)
    }

    if (review) {
      recordQuickReviewPoints(task.id, itemTitleOrUntitled(task, "Task"), notes, completedAt)
    }

    onClose()
  }

  const handleUndo = () => {
    if (!task) {
      onClose()
      return
    }
    if (!pending) {
      uncompleteTask(task.id)
      usePointsStore.getState().removePointsForTask(task.id, task.completedDate)
      clearQuickReviewPoints(task.id, task.completedDate)
    }
    onClose()
  }

  const handleSkip = () => {
    if (pending && task && !task.completed) completeTask(task.id)
    onClose()
  }

  const handleDismiss = () => {
    onClose()
  }

  const initialContribution = {
    objectiveIds: task?.contributesToObjectiveIds ?? [],
    goalIds: task?.contributesToGoalIds ?? [],
    notes: "",
    showReflection: false,
    scores: initialScores,
    durationCertainty: initialClock.durationCertainty,
    actualDuration: initialClock.durationMinutes,
    startCertainty: initialClock.startCertainty,
    startTime: initialClock.startTime,
    doneCertainty: initialClock.doneCertainty,
    doneDate: initialClock.doneDate,
    doneTime: initialClock.doneTime,
    objectiveDraft: "",
    goalDraft: "",
  }
  const isDirty = Boolean(
    task &&
      !snapshotsEqual(
        {
          objectiveIds,
          goalIds,
          notes,
          showReflection,
          scores,
          durationCertainty,
          actualDuration,
          startCertainty,
          startTime,
          doneCertainty,
          doneDate,
          doneTime,
          objectiveDraft,
          goalDraft,
        },
        initialContribution,
      ),
  )
  const guard = useUnsavedGuard({
    open: true,
    onOpenChange: (next) => {
      if (!next) handleDismiss()
    },
    isDirty,
    onSave: handleSave,
    onDiscard: handleDismiss,
  })

  if (!task) return null

  const durationChoices: { id: ClockCertainty; label: string; name: string }[] = [
    { id: "exact", label: "Exact", name: "Exact duration" },
    { id: "estimated", label: "Est.", name: "Estimated duration" },
    { id: "unknown", label: "Unknown", name: "Unknown duration" },
  ]
  const startChoices: { id: ClockCertainty; label: string; name: string }[] = [
    { id: "exact", label: "Exact", name: "Exact start" },
    { id: "estimated", label: "Est.", name: "Estimated start" },
    { id: "unknown", label: "Unknown", name: "Unknown start" },
  ]
  const doneChoices: { id: ClockCertainty; label: string; name: string }[] = [
    { id: "exact", label: "Exact", name: "Exact finish" },
    { id: "estimated", label: "Est.", name: "Estimated finish" },
  ]

  return (
    <>
    <Dialog open onOpenChange={guard.handleOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[88vh] overflow-y-auto" data-ui-name="Completion" data-ui-docs="components/Completion/README.md" {...unsavedDismissProps(guard.requestClose)}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CheckCircle2 className="h-5 w-5 text-green-600" />
            Task completed
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-5">
          <p className="text-sm text-muted-foreground line-clamp-2">{itemTitle(task)}</p>
          {usual && (
            <p
              title={usual.basis}
              className="text-xs text-amber-700 dark:text-amber-400 -mt-3"
            >
              Usually takes you ~{usual.minutes} min
              <span className="ml-1.5 inline-flex items-center rounded border border-dashed border-amber-500/60 px-1.5 py-px text-[10px] font-medium uppercase tracking-wide">
                est.
              </span>
            </p>
          )}

          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Target className="h-4 w-4" />
              <Label className="text-sm font-medium">Contributes to objective(s)</Label>
              <span className="text-xs text-muted-foreground">optional</span>
            </div>
            <div className="rounded-md border">
              {activeObjectives.length > 0 && (
                <ListSearch
                  value={objectiveQuery}
                  onChange={setObjectiveQuery}
                  placeholder="Search objectives…"
                  aria-label="Search objectives"
                />
              )}
              <div className="flex flex-wrap gap-1.5 max-h-44 overflow-y-auto p-2">
                {visibleObjectives.length === 0 ? (
                  <p className="text-xs text-muted-foreground py-1">
                    {activeObjectives.length === 0 ? "No objectives yet" : "No matching objectives"}
                  </p>
                ) : (
                  visibleObjectives.map((o) => {
                    const on = objectiveIds.includes(o.id)
                    const prioritized = PRIORITY_PERIODS.some((p) => isObjectivePrioritized(o, p))
                    const mult = objectiveMultiplierFor(o)
                    return (
                      <button
                        key={o.id}
                        type="button"
                        aria-pressed={on}
                        onClick={() => toggleObjective(o.id)}
                        className={`text-xs rounded-full border px-2.5 py-1 transition-colors ${
                          on
                            ? "bg-primary text-primary-foreground border-primary"
                            : "bg-background hover:bg-muted"
                        }`}
                      >
                        {prioritized && <Star className="inline h-3 w-3 mr-1 -mt-0.5" />}
                        {o.title}
                        {on && <span className="ml-1 opacity-80">×{mult}</span>}
                      </button>
                    )
                  })
                )}
              </div>
              <div className="flex gap-1.5 border-t p-1.5">
                <Input
                  value={objectiveDraft}
                  onChange={(e) => setObjectiveDraft(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault()
                      createObjective()
                    }
                  }}
                  placeholder="New objective"
                  aria-label="New objective"
                  className="h-8"
                />
                <Button type="button" size="sm" variant="outline" aria-label="Add objective" disabled={!objectiveDraft.trim()} onClick={createObjective}>
                  Add
                </Button>
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Trophy className="h-4 w-4" />
              <Label className="text-sm font-medium">Counts toward goal(s)</Label>
              <span className="text-xs text-muted-foreground">+1 each</span>
            </div>
            <div className="rounded-md border">
              {goals.length > 0 && (
                <ListSearch
                  value={goalQuery}
                  onChange={setGoalQuery}
                  placeholder="Search goals…"
                  aria-label="Search goals"
                />
              )}
              <div className="space-y-1 max-h-40 overflow-y-auto p-2">
                {visibleGoals.length === 0 ? (
                  <p className="text-xs text-muted-foreground py-1">
                    {goals.length === 0 ? "No goals yet" : "No matching goals"}
                  </p>
                ) : (
                  visibleGoals.map((g) => {
                    const on = goalIds.includes(g.id)
                    return (
                      <button
                        key={g.id}
                        type="button"
                        aria-pressed={on}
                        onClick={() => toggleGoal(g.id)}
                        className={`w-full flex items-center justify-between gap-2 text-xs rounded px-2 py-1.5 text-left transition-colors ${
                          on ? "bg-primary/10 ring-1 ring-primary" : "hover:bg-muted"
                        }`}
                      >
                        <span className="truncate">{g.title}</span>
                        <span className="text-muted-foreground shrink-0">
                          {on ? `${g.current + 1}` : g.current}/{g.target}
                          {g.unit ? ` ${g.unit}` : ""}
                        </span>
                      </button>
                    )
                  })
                )}
              </div>
              <div className="flex gap-1.5 border-t p-1.5">
                <Input
                  value={goalDraft}
                  onChange={(e) => setGoalDraft(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault()
                      createGoal()
                    }
                  }}
                  placeholder="New goal"
                  aria-label="New goal"
                  className="h-8"
                />
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  aria-label="Add goal"
                  disabled={!goalDraft.trim() || objectiveIds.length === 0}
                  title={objectiveIds.length === 0 ? "A goal serves an objective. Select or add one first." : "Counts once this year, toward the objectives selected above."}
                  onClick={createGoal}
                >
                  Add
                </Button>
              </div>
              <p className="px-2 pb-2 text-[10px] text-muted-foreground">
                A new goal counts once this year and serves the objectives selected above.
              </p>
            </div>
          </div>

          <div className="flex items-center justify-between rounded-md bg-muted/50 px-3 py-2 text-sm">
            <span className="text-muted-foreground">
              Points{" "}
              {objectiveIds.length > 0 && (
                <span className="text-xs">
                  ({effectiveBase} × {round2(multiplier)})
                </span>
              )}
            </span>
            <span className="font-semibold">
              {total}
              {bonus > 0 && <span className="text-green-600 ml-2">(+{bonus} bonus)</span>}
            </span>
          </div>
          {objectiveIds.length === 0 && (
            <p className="text-xs text-muted-foreground -mt-2">
              Tip: linking an objective earns at least {pointsRuleValue("objective.defaultMultiplier")}× points.
            </p>
          )}

          <div className="flex items-center justify-between">
            <Label className="text-sm" htmlFor="quick-review-switch">Add a quick reflection</Label>
            <Switch id="quick-review-switch" checked={showReflection} onCheckedChange={setShowReflection} aria-label="Add a quick reflection" />
          </div>
          <p className="text-xs text-muted-foreground -mt-3" data-testid="review-points-preview">
            {showReflection ? (
              <>
                Quick review awards <span className="font-semibold text-foreground">{formatReviewPoints(reviewPoints)}</span> points
                {" "}— 3 for agreeing, plus 0.1 × {words} {words === 1 ? "word" : "words"}.
              </>
            ) : (
              <>Agreeing to a quick review awards 3 points, plus 0.1 per word you write.</>
            )}
          </p>
          {showReflection && (
            <div className="space-y-3 rounded-md border p-3">
              <ClockCertaintyField
                legend="Done at"
                groupLabel="When this was finished"
                choices={doneChoices}
                value={doneCertainty}
                onChange={(id) => {
                  if (id === "exact" || id === "estimated") setDoneCertainty(id)
                }}
                unknownHint=""
                estimatedHint="Approximate finish. The day and the time stay editable."
                control={
                  <div className="flex flex-wrap items-center gap-2">
                    <Input
                      type="date"
                      value={doneDate}
                      aria-label="Done date"
                      className="h-8 w-[11rem]"
                      onChange={(e) => {
                        setDoneDate(e.target.value)
                        if (doneCertainty === "unspecified") setDoneCertainty("exact")
                      }}
                    />
                    <ClockPicker
                      id="completion-done"
                      value={doneTime}
                      onChange={(next) => {
                        setDoneTime(next)
                        if (doneCertainty === "unspecified") setDoneCertainty("exact")
                      }}
                      aria-label="Done time"
                      className="h-8"
                    />
                  </div>
                }
              />

              <ClockCertaintyField
                legend="How long"
                groupLabel="How long this took"
                choices={durationChoices}
                value={durationCertainty}
                onChange={(id) => {
                  setDurationCertainty(id)
                  if (id === "unknown") setActualDuration("")
                }}
                unknownHint="No length. Left out of time totals."
                estimatedHint="Estimated minutes stay out of exact totals."
                control={
                  <Input
                    type="number"
                    min={1}
                    value={actualDuration}
                    onChange={(e) => {
                      setActualDuration(e.target.value)
                      if (durationCertainty === "unspecified") setDurationCertainty("exact")
                    }}
                    placeholder="minutes"
                    aria-label="Duration minutes"
                  />
                }
              />

              <ClockCertaintyField
                legend="Started"
                groupLabel="When this started"
                choices={startChoices}
                value={startCertainty}
                onChange={(id) => {
                  setStartCertainty(id)
                  if (id === "unknown") setStartTime("")
                }}
                unknownHint="No start time."
                estimatedHint="Approximate start. The time stays editable."
                control={
                  <ClockPicker
                    id="completion-start"
                    value={startTime}
                    onChange={(next) => {
                      setStartTime(next)
                      if (startCertainty === "unspecified") setStartCertainty("exact")
                    }}
                    aria-label="Start time"
                    className="h-8"
                  />
                }
              />

              <div className="space-y-2">
                {REFLECTION_SCALES.map((scale) => (
                  <ScoreRow
                    key={scale.key}
                    label={scale.label}
                    hint={scale.hint}
                    value={scores[scale.key]}
                    onChange={(value) => setScore(scale.key, value)}
                  />
                ))}
              </div>

              <div className="space-y-1">
                <Label className="text-xs" htmlFor="completion-notes">Notes</Label>
                <Textarea
                  id="completion-notes"
                  aria-label="Notes"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={2}
                  placeholder="What worked, what to do differently…"
                />
                <p className="text-[10px] text-muted-foreground">A word is a stretch of text between spaces.</p>
              </div>
            </div>
          )}

          <div className="flex items-center justify-between gap-2 pt-1">
            <Button variant="ghost" onClick={handleUndo} aria-label="Undo completion">
              <Undo2 className="h-4 w-4 mr-2" />
              Undo
            </Button>
            <div className="flex gap-2">
              <Button variant="ghost" onClick={handleSkip}>Skip</Button>
              <Button onClick={handleSave} className="bg-green-600 hover:bg-green-700">
                <CheckCircle2 className="h-4 w-4 mr-2" />
                Save
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
    <UnsavedChangesDialog {...guard.prompt} />
    </>
  )
}
