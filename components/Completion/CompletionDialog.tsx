/**
 * components/Completion/CompletionDialog.tsx — Per-completion contribution popup
 *
 * Shown on *every* task completion (driven by the completion event bus). Lets
 * the user record which Objectives and Goals the finished task contributed to,
 * which (a) increments the linked goal values and (b) awards stacking objective
 * point multipliers (default 1.5× per objective, or a prioritized objective's
 * custom multiplier). An optional reflection can be captured inline.
 */
"use client"

import { useMemo, useState } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { CheckCircle2, Star, Target, Trophy } from "lucide-react"
import { useTaskStore } from "@/lib/task-store"
import {
  useGoalsStore,
  objectiveMultiplierFor,
  taskObjectiveMultiplier,
  DEFAULT_OBJECTIVE_MULTIPLIER,
} from "@/lib/goals-store"
import { usePointsStore } from "@/lib/points-store"
import { isObjectivePrioritized } from "@/lib/objectives"
import type { TaskCompletionReview } from "@/lib/types"

const PRIORITY_PERIODS = ["day", "week", "month", "year"] as const

function round2(n: number): number {
  return Math.round(n * 100) / 100
}

export function CompletionDialog({
  taskId,
  basePoints,
  onClose,
}: {
  taskId: string
  basePoints: number
  onClose: () => void
}) {
  const task = useTaskStore((s) => s.tasks.find((t) => t.id === taskId))
  const updateTask = useTaskStore((s) => s.updateTask)
  const objectives = useGoalsStore((s) => s.objectives)
  const goals = useGoalsStore((s) => s.goals)
  const setGoalProgress = useGoalsStore((s) => s.setGoalProgress)
  const addPoints = usePointsStore((s) => s.addPoints)

  const [objectiveIds, setObjectiveIds] = useState<string[]>(task?.contributesToObjectiveIds ?? [])
  const [goalIds, setGoalIds] = useState<string[]>(task?.contributesToGoalIds ?? [])
  const [showReflection, setShowReflection] = useState(false)
  const [satisfaction, setSatisfaction] = useState("7")
  const [actualDuration, setActualDuration] = useState(
    task?.actualDuration?.toString() ?? task?.estimatedDuration?.toString() ?? "",
  )
  const [notes, setNotes] = useState("")

  const activeObjectives = useMemo(() => objectives.filter((o) => !o.archived), [objectives])

  // Goals serving a selected objective float to the top of the goal list.
  const sortedGoals = useMemo(() => {
    const relevant = (g: { objectiveIds: string[] }) => g.objectiveIds.some((id) => objectiveIds.includes(id))
    return [...goals].sort((a, b) => Number(relevant(b)) - Number(relevant(a)))
  }, [goals, objectiveIds])

  const multiplier = useMemo(
    () => taskObjectiveMultiplier(objectives, objectiveIds),
    [objectives, objectiveIds],
  )
  const effectiveBase = basePoints > 0 ? basePoints : objectiveIds.length ? 1 : 0
  const total = round2(effectiveBase * multiplier)
  const bonus = round2(total - basePoints)

  if (!task) return null

  const toggleObjective = (id: string) =>
    setObjectiveIds((ids) => (ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id]))
  const toggleGoal = (id: string) =>
    setGoalIds((ids) => (ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id]))

  const handleSave = () => {
    const review: TaskCompletionReview | undefined = showReflection
      ? {
          taskId: task.id,
          completedAt: new Date(),
          actualDuration: Number.parseInt(actualDuration) || task.estimatedDuration || 0,
          satisfaction: Number.parseInt(satisfaction) || 5,
          resistance: 5,
          focus: 5,
          distraction: 5,
          notes: notes.trim() || undefined,
        }
      : undefined

    updateTask({
      ...task,
      completed: true,
      contributesToObjectiveIds: objectiveIds.length ? objectiveIds : undefined,
      contributesToGoalIds: goalIds.length ? goalIds : undefined,
      ...(actualDuration ? { actualDuration: Number.parseInt(actualDuration) || task.actualDuration } : {}),
      ...(review ? { completionReview: review } : {}),
    })

    // Each contributed goal advances by one occurrence.
    for (const id of goalIds) {
      const goal = goals.find((g) => g.id === id)
      if (goal) setGoalProgress(goal.id, goal.current + 1)
    }

    // Award the stacking objective multiplier bonus on top of the base points.
    if (bonus > 0) {
      addPoints(task.id, bonus, `Objective bonus: ${task.description || "Task"}`, new Date())
    }

    onClose()
  }

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="sm:max-w-lg max-h-[88vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CheckCircle2 className="h-5 w-5 text-green-600" />
            Task completed
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-5">
          <p className="text-sm text-muted-foreground line-clamp-2">{task.description}</p>

          {/* Objective contribution */}
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Target className="h-4 w-4" />
              <Label className="text-sm font-medium">Contributes to objective(s)</Label>
              <span className="text-xs text-muted-foreground">optional</span>
            </div>
            <div className="flex flex-wrap gap-1.5 max-h-44 overflow-y-auto rounded-md border p-2">
              {activeObjectives.map((o) => {
                const on = objectiveIds.includes(o.id)
                const prioritized = PRIORITY_PERIODS.some((p) => isObjectivePrioritized(o, p))
                const mult = objectiveMultiplierFor(o)
                return (
                  <button
                    key={o.id}
                    type="button"
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
              })}
            </div>
          </div>

          {/* Goal contribution */}
          {goals.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Trophy className="h-4 w-4" />
                <Label className="text-sm font-medium">Counts toward goal(s)</Label>
                <span className="text-xs text-muted-foreground">+1 each</span>
              </div>
              <div className="space-y-1 max-h-40 overflow-y-auto rounded-md border p-2">
                {sortedGoals.map((g) => {
                  const on = goalIds.includes(g.id)
                  return (
                    <button
                      key={g.id}
                      type="button"
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
                })}
              </div>
            </div>
          )}

          {/* Points preview */}
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
              Tip: linking an objective earns at least {DEFAULT_OBJECTIVE_MULTIPLIER}× points.
            </p>
          )}

          {/* Optional reflection */}
          <div className="flex items-center justify-between">
            <Label className="text-sm">Add a quick reflection</Label>
            <Switch checked={showReflection} onCheckedChange={setShowReflection} />
          </div>
          {showReflection && (
            <div className="space-y-3 rounded-md border p-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">Satisfaction (1-10)</Label>
                  <Select value={satisfaction} onValueChange={setSatisfaction}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {Array.from({ length: 10 }, (_, i) => (
                        <SelectItem key={i + 1} value={(i + 1).toString()}>{i + 1}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Actual time (min)</Label>
                  <Input
                    type="number"
                    value={actualDuration}
                    onChange={(e) => setActualDuration(e.target.value)}
                  />
                </div>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Notes</Label>
                <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} />
              </div>
            </div>
          )}

          <div className="flex justify-end gap-2 pt-1">
            <Button variant="ghost" onClick={onClose}>Skip</Button>
            <Button onClick={handleSave} className="bg-green-600 hover:bg-green-700">
              <CheckCircle2 className="h-4 w-4 mr-2" />
              Save
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
