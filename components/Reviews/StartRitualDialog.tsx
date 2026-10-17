/**
 * components/Reviews/StartRitualDialog.tsx — Start / planning ritual (week–year)
 *
 * Plans the coming period: undone from the last period, priorities, must-dos,
 * intentions, and a concrete plan. Persists on `PeriodReview.start`.
 * Day start stays on MorningReview (sun). Shell: `.hpp95`.
 */
"use client"

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { ArrowRight, Sparkles } from "lucide-react"
import { RitualSunIcon } from "@/components/Icons"
import { useTaskStore } from "@/lib/task-store"
import type { PeriodStartRitual, ReviewPeriod, Task } from "@/lib/types"
import {
  dateFromPeriodKey,
  getPeriodKey,
  periodLabel,
  previousPeriodDate,
  useReviewsStore,
} from "@/lib/reviews-store"
import { startRitualPhase } from "@/lib/rituals"
import {
  taskScheduledInMonth,
  taskScheduledInWeek,
  taskScheduledInYear,
  taskScheduledOnDay,
} from "@/lib/date-utils"
import { pushFieldsForReviewPeriod } from "@/lib/services/review-service"
import { unfinishedTasksForRitual } from "@/lib/ritual-unfinished"
import { itemTitle } from "@/lib/item-utils"
import { isClearedFromWork } from "@/lib/completion-status"
import { taskIsPrioritized, taskIsRequired, tasksWithCommitment } from "@/lib/todo-commitment"
import { CommitmentMarkList } from "@/components/Reviews/CommitmentMarkList"
import { RitualStepper, useRitualStep, type RitualStep } from "@/components/Reviews/RitualSteps"
import { LookAheadSection, type LookAheadTarget } from "@/components/Reviews/LookAheadSection"

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

function previousKeyFor(period: ReviewPeriod, periodKey: string): string {
  const ref = dateFromPeriodKey(period, periodKey)
  // Midday so DST edges do not slip the calendar day.
  const anchor = new Date(ref.getFullYear(), ref.getMonth(), ref.getDate(), 12, 0, 0)
  return getPeriodKey(period, previousPeriodDate(period, anchor))
}

export function StartRitualDialog({
  open,
  period,
  periodKey,
  onClose,
}: {
  open: boolean
  period: ReviewPeriod
  periodKey: string
  onClose: () => void
}) {
  const tasks = useTaskStore((s) => s.tasks)
  const updateTask = useTaskStore((s) => s.updateTask)
  const existing = useReviewsStore((s) => s.getStartRitual(period, periodKey))
  const replaceStartRitual = useReviewsStore((s) => s.replaceStartRitual)

  const [priorities, setPriorities] = useState(existing?.priorities ?? "")
  const [mustDo, setMustDo] = useState(existing?.mustDo ?? "")
  const [undoneNotes, setUndoneNotes] = useState(existing?.undoneNotes ?? "")
  const [summary, setSummary] = useState(existing?.summary ?? "")
  const [nextPlans, setNextPlans] = useState(existing?.nextPlans ?? "")
  const [gratitude, setGratitude] = useState<string[]>(
    existing?.gratitude?.length ? existing.gratitude : [""],
  )
  const [pulled, setPulled] = useState<string[]>(existing?.pulledTaskIds ?? [])
  const [requiredIds, setRequiredIds] = useState<string[]>(() =>
    openTasksNow()
      .filter((task) => taskIsRequired(task, period, periodKey))
      .map((task) => task.id),
  )
  const [prioritizedIds, setPrioritizedIds] = useState<string[]>(() =>
    openTasksNow()
      .filter((task) => taskIsPrioritized(task, period, periodKey))
      .map((task) => task.id),
  )

  function openTasksNow(): Task[] {
    return tasksScheduledInPeriod(useTaskStore.getState().tasks, period, periodKey).filter(
      (task) => !task.hiddenFromTodo && !isClearedFromWork(task),
    )
  }

  const lastPeriodKey = useMemo(() => previousKeyFor(period, periodKey), [period, periodKey])

  const undone = useMemo(
    () => unfinishedTasksForRitual(tasks, period, lastPeriodKey),
    [tasks, period, lastPeriodKey],
  )

  const periodTasks = useMemo(
    () =>
      tasksScheduledInPeriod(tasks, period, periodKey).filter(
        (task) => !task.hiddenFromTodo && !isClearedFromWork(task),
      ),
    [tasks, period, periodKey],
  )

  const stampMarks = () => {
    const list = openTasksNow()
    const changed = tasksWithCommitment(
      useTaskStore.getState().tasks,
      period,
      periodKey,
      list.map((task) => task.id),
      requiredIds,
      prioritizedIds,
    )
    for (const next of changed) updateTask(next)
  }

  const pullIntoPeriod = (task: Task) => {
    updateTask({ ...task, ...pushFieldsForReviewPeriod(task, period, lastPeriodKey) })
    setPulled((p) => [...new Set([...p, task.id])])
  }

  const buildSlice = (completed: boolean): PeriodStartRitual => ({
    completed,
    priorities: priorities.trim() || undefined,
    mustDo: mustDo.trim() || undefined,
    undoneNotes: undoneNotes.trim() || undefined,
    summary: summary.trim() || undefined,
    nextPlans: nextPlans.trim() || undefined,
    gratitude: gratitude.map((g) => g.trim()).filter(Boolean),
    pulledTaskIds: pulled.length ? pulled : undefined,
    source: "desktop",
  })

  const submittedRef = useRef(false)
  const baselineRef = useRef("")
  const snapshot = () =>
    JSON.stringify({ priorities, mustDo, undoneNotes, summary, nextPlans, gratitude, pulled, requiredIds, prioritizedIds })

  useEffect(() => {
    baselineRef.current = snapshot()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [period, periodKey])

  const handleSaveProgress = () => {
    stampMarks()
    replaceStartRitual(period, periodKey, buildSlice(existing?.completed === true))
    baselineRef.current = snapshot()
  }

  const handleSave = () => {
    submittedRef.current = true
    stampMarks()
    replaceStartRitual(period, periodKey, buildSlice(true))
    onClose()
  }

  const dismiss = () => {
    if (!submittedRef.current && snapshot() !== baselineRef.current) handleSaveProgress()
    submittedRef.current = true
    onClose()
  }

  const [visited, setVisited] = useState<string[]>([])
  const unitName = period === "quarter" ? "season" : period
  const periodStart = dateFromPeriodKey(period, periodKey)
  const monthKeyOf = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`
  const dueDays = period === "week" ? 7 : period === "month" ? 31 : period === "quarter" ? 92 : 366
  // Seasons are not a schedule slot; "this season" lands on its first month.
  const lookTarget: LookAheadTarget =
    period === "week"
      ? { period: "week", key: periodKey, label: "This week" }
      : period === "year"
        ? { period: "year", key: periodKey, label: "This year" }
        : { period: "month", key: monthKeyOf(periodStart), label: "This month" }
  const lookNow = periodStart.getTime() > Date.now() ? periodStart : new Date()
  const stepDefs: (RitualStep & { body: ReactNode })[] = [
    {
      id: "undone",
      label: `Undone from last ${period === "quarter" ? "season" : period}`,
      answered: undone.length === 0 || undone.every((t) => pulled.includes(t.id)) || !!undoneNotes.trim(),
      body: (
        <section className="space-y-2">
          <p className="mr-lede">
            Undone from last {period} ({undone.length}). Bring it in, or note what you leave behind.
          </p>
          {undone.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nothing left undone. Clean slate.</p>
          ) : (
            <div className="space-y-2">
              {undone.map((task) => (
                <div
                  key={task.id}
                  className="border rounded-md p-2 flex items-center justify-between gap-2"
                >
                  <span className="text-sm flex-1 truncate">{itemTitle(task)}</span>
                  {pulled.includes(task.id) ? (
                    <span className="text-xs text-muted-foreground">Pulled in</span>
                  ) : (
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7"
                      onClick={() => pullIntoPeriod(task)}
                    >
                      <ArrowRight className="h-3.5 w-3.5 mr-1" />
                      Bring into this {period}
                    </Button>
                  )}
                </div>
              ))}
            </div>
          )}
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">
              Notes on what you are leaving behind
            </Label>
            <Textarea
              value={undoneNotes}
              onChange={(e) => setUndoneNotes(e.target.value)}
              rows={2}
              placeholder="Anything to remember about last period’s open items…"
            />
          </div>
        </section>
      ),
    },
    ...(period === "week"
      ? [
          {
            id: "ahead",
            label: "This month",
            answered: visited.includes("ahead"),
            body: (
              <LookAheadSection
                key="ahead"
                mode="lists"
                now={lookNow}
                target={lookTarget}
                lists={[{ title: "This month", period: "month", key: monthKeyOf(periodStart) }]}
              />
            ),
          },
        ]
      : []),
    {
      id: "due",
      label: `Due this ${unitName}`,
      answered: visited.includes("due"),
      body: <LookAheadSection key="due" mode="due" now={lookNow} target={lookTarget} dueDays={dueDays} />,
    },
    {
      id: "overdue",
      label: "Overdue",
      answered: visited.includes("overdue"),
      body: <LookAheadSection key="overdue" mode="overdue" now={lookNow} target={lookTarget} />,
    },
    {
      id: "priorities",
      label: "Priorities",
      answered: !!priorities.trim(),
      body: (
        <section className="space-y-2">
          <Label className="mr-lede">What matters most this {period}?</Label>
          <Textarea
            value={priorities}
            onChange={(e) => setPriorities(e.target.value)}
            rows={3}
            placeholder="What matters most — 3 to 5 lines…"
          />
        </section>
      ),
    },
    {
      id: "must",
      label: "Required",
      answered: !!mustDo.trim() || requiredIds.length > 0 || prioritizedIds.length > 0,
      body: (
        <>
          <section className="space-y-2">
            <Label className="mr-lede">Required outcomes</Label>
            <Textarea
              value={mustDo}
              onChange={(e) => setMustDo(e.target.value)}
              rows={2}
              placeholder="Required outcomes for this period…"
            />
          </section>
          <section className="space-y-2">
            <Label className="font-semibold text-sm">Mark assigned tasks</Label>
            <p className="text-xs text-muted-foreground">
              Everything on this {period}&apos;s to-do list is assigned. Required must be done and moves to the
              Required list. Prioritized stays on Assigned and is marked.
            </p>
            {periodTasks.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nothing assigned to this {period} yet.</p>
            ) : (
              <CommitmentMarkList
                tasks={periodTasks}
                requiredIds={requiredIds}
                prioritizedIds={prioritizedIds}
                marks="both"
                onToggle={(kind, id) => {
                  if (kind === "required") {
                    setRequiredIds((ids) =>
                      ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id],
                    )
                  } else {
                    setPrioritizedIds((ids) =>
                      ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id],
                    )
                  }
                }}
              />
            )}
          </section>
        </>
      ),
    },
    {
      id: "intentions",
      label: "Intentions",
      answered: !!summary.trim(),
      body: (
        <section className="space-y-2">
          <Label className="mr-lede">What do you want from this {period}?</Label>
          <Textarea
            value={summary}
            onChange={(e) => setSummary(e.target.value)}
            rows={2}
            placeholder="Tone, focus, how you want to feel…"
          />
        </section>
      ),
    },
    {
      id: "plan",
      label: "Plan",
      answered: !!nextPlans.trim(),
      body: (
        <section className="space-y-2">
          <Label className="mr-lede">A concrete plan for the {period} ahead</Label>
          <Textarea
            value={nextPlans}
            onChange={(e) => setNextPlans(e.target.value)}
            rows={3}
            placeholder="Concrete plan for the period ahead…"
          />
        </section>
      ),
    },
    {
      id: "gratitude",
      label: "Gratitude",
      answered: gratitude.some((g) => !!g.trim()),
      body: (
        <section className="space-y-2">
          {gratitude.map((g, i) => (
            <Input
              key={i}
              value={g}
              onChange={(e) =>
                setGratitude((arr) => arr.map((x, j) => (j === i ? e.target.value : x)))
              }
              placeholder="I'm grateful for…"
            />
          ))}
          <Button variant="outline" size="sm" onClick={() => setGratitude((arr) => [...arr, ""])}>
            <Sparkles className="h-4 w-4 mr-1" />
            Add
          </Button>
        </section>
      ),
    },
  ]
  const [stepIndex, setStepIndex] = useRitualStep(
    `brain2-ritual-step:start:${period}:${periodKey}`,
    stepDefs.length,
    () => 0,
  )

  const currentStepId = stepDefs[stepIndex]?.id
  useEffect(() => {
    if (currentStepId && ["ahead", "due", "overdue"].includes(currentStepId))
      setVisited((v) => (v.includes(currentStepId) ? v : [...v, currentStepId]))
  }, [currentStepId])

  /** Moving between questions writes progress, the same as Save progress. */
  const goStep = (next: number) => {
    if (!submittedRef.current && snapshot() !== baselineRef.current) handleSaveProgress()
    setStepIndex(next)
  }

  const phase = startRitualPhase(existing)

  return (
    <Dialog open={open} onOpenChange={(next) => { if (!next) dismiss() }}>
      <DialogContent
        className="hpp95 hpp95-dialog sm:max-w-2xl max-h-[88vh] overflow-hidden flex flex-col"
        data-ui-name="Start ritual"
        data-ui-docs="components/Reviews/README.md"
      >
        <DialogHeader className="hpp-caption">
          <div className="hpp-caption-mark">
            <span className="hpp-power-lamp" aria-hidden />
            <DialogTitle className="flex items-center gap-2 capitalize">
              <RitualSunIcon className="h-5 w-5" />
              {period} Start ritual
              {phase === "partial" ? (
                <span className="text-xs font-normal text-muted-foreground">· in progress</span>
              ) : null}
            </DialogTitle>
          </div>
          <DialogDescription className="hpp-caption-lead">
            Plan {periodLabel(period, periodKey)}
          </DialogDescription>
        </DialogHeader>

        <div className="hpp-body flex-1 min-h-0">
          <RitualStepper
            tone="dawn"
            steps={stepDefs}
            index={stepIndex}
            onStep={goStep}
            finishLabel="Finish"
            onFinish={handleSave}
          >
            {stepDefs[stepIndex]?.body}
          </RitualStepper>
        </div>

        <div className="hpp-actions">
          <Button variant="outline" onClick={dismiss}>
            Close
          </Button>
          <Button variant="outline" onClick={handleSaveProgress}>
            Save progress
          </Button>
          <Button className="hpp-key-go" onClick={handleSave}>
            Save Start ritual
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
