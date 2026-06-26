/**
 * components/Home/Goals/GoalsContainer.tsx — Quantifiable goals
 *
 * Goals are measurable metrics over a period that serve one or more objectives
 * (no goal without an objective). Shown together, filterable by period kind
 * (day/week/month/year/custom range/aspirational). Each goal can be advanced
 * manually, or "logged" — which records a completed contributing action and
 * awards the stacking objective point multiplier.
 */
"use client"

import { useMemo, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { Trophy, Plus, Pencil, Trash2, CheckCircle2, PlusCircle } from "lucide-react"
import { useGoalsStore, taskObjectiveMultiplier } from "@/lib/goals-store"
import { usePointsStore } from "@/lib/points-store"
import { useTaskStore } from "@/lib/task-store"
import { goalProgressPercent } from "@/lib/objectives"
import type { Goal, GoalPeriodKind, Task } from "@/lib/types"

const PERIOD_KINDS: GoalPeriodKind[] = ["day", "week", "month", "year", "custom", "aspirational"]
const PERIOD_LABELS: Record<GoalPeriodKind, string> = {
  day: "Day",
  week: "Week",
  month: "Month",
  year: "Year",
  custom: "Custom range",
  aspirational: "Aspirational",
}

type GoalDraft = {
  title: string
  description: string
  type: Goal["type"]
  target: number
  unit: string
  periodKind: GoalPeriodKind
  periodLabel: string
  objectiveIds: string[]
  points: number
}

const emptyDraft = (): GoalDraft => ({
  title: "",
  description: "",
  type: "count",
  target: 1,
  unit: "",
  periodKind: "year",
  periodLabel: "",
  objectiveIds: [],
  points: 20,
})

export function GoalsContainer() {
  const goals = useGoalsStore((s) => s.goals)
  const objectives = useGoalsStore((s) => s.objectives)
  const addGoal = useGoalsStore((s) => s.addGoal)
  const updateGoal = useGoalsStore((s) => s.updateGoal)
  const deleteGoal = useGoalsStore((s) => s.deleteGoal)
  const setGoalProgress = useGoalsStore((s) => s.setGoalProgress)
  const addTask = useTaskStore((s) => s.addTask)
  const addPoints = usePointsStore((s) => s.addPoints)

  const [filter, setFilter] = useState<GoalPeriodKind | "all">("all")
  const [showAdd, setShowAdd] = useState(false)
  const [draft, setDraft] = useState<GoalDraft>(emptyDraft())
  const [editing, setEditing] = useState<Goal | null>(null)

  const activeObjectives = useMemo(() => objectives.filter((o) => !o.archived), [objectives])
  const objectiveTitle = (id: string) => objectives.find((o) => o.id === id)?.title ?? "?"
  const visible = filter === "all" ? goals : goals.filter((g) => g.periodKind === filter)

  const handleAdd = () => {
    if (!draft.title.trim() || draft.objectiveIds.length === 0) return
    addGoal({
      title: draft.title.trim(),
      description: draft.description.trim() || undefined,
      type: draft.type,
      target: draft.target,
      unit: draft.unit.trim() || undefined,
      periodKind: draft.periodKind,
      periodLabel: draft.periodKind === "custom" ? draft.periodLabel.trim() || undefined : undefined,
      objectiveIds: draft.objectiveIds,
      points: draft.points,
    })
    setDraft(emptyDraft())
    setShowAdd(false)
  }

  // Logging a goal records a completed action that serves the goal's objectives
  // and advances the goal — the inverse of completing a task that contributes.
  const logAction = (goal: Goal) => {
    const now = new Date()
    const id = `goal-action-${Date.now()}`
    const task: Task = {
      id,
      description: goal.title,
      stage: "completed",
      createdAt: now,
      completed: true,
      status: "done",
      completedDate: now,
      lists: [],
      contributesToGoalIds: [goal.id],
      contributesToObjectiveIds: goal.objectiveIds.length ? goal.objectiveIds : undefined,
    }
    addTask(task)
    setGoalProgress(goal.id, goal.current + 1)
    const multiplier = taskObjectiveMultiplier(objectives, goal.objectiveIds, now)
    const points = Math.round(1 * multiplier * 100) / 100
    if (points > 0) addPoints(id, points, `Goal action: ${goal.title}`, now)
  }

  const goalForm = (fields: GoalDraft, onChange: (v: GoalDraft) => void, onSubmit: () => void, submitLabel: string) => (
    <div className="space-y-4">
      <div>
        <Label>Title</Label>
        <Input value={fields.title} onChange={(e) => onChange({ ...fields, title: e.target.value })} placeholder="e.g., Read 20 books this year" />
      </div>
      <div>
        <Label>Description</Label>
        <Textarea value={fields.description} onChange={(e) => onChange({ ...fields, description: e.target.value })} rows={2} />
      </div>
      <div className="grid grid-cols-3 gap-3">
        <div>
          <Label>Type</Label>
          <Select value={fields.type} onValueChange={(v) => onChange({ ...fields, type: v as Goal["type"] })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="count">Count</SelectItem>
              <SelectItem value="numerical">Numerical</SelectItem>
              <SelectItem value="boolean">Yes/No</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label>Target</Label>
          <Input type="number" value={fields.target} onChange={(e) => onChange({ ...fields, target: Number.parseInt(e.target.value) || 1 })} />
        </div>
        <div>
          <Label>Unit</Label>
          <Input value={fields.unit} onChange={(e) => onChange({ ...fields, unit: e.target.value })} placeholder="books" />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label>Period</Label>
          <Select value={fields.periodKind} onValueChange={(v) => onChange({ ...fields, periodKind: v as GoalPeriodKind })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {PERIOD_KINDS.map((p) => (
                <SelectItem key={p} value={p}>{PERIOD_LABELS[p]}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label>Points reward</Label>
          <Input type="number" value={fields.points} onChange={(e) => onChange({ ...fields, points: Number.parseInt(e.target.value) || 0 })} />
        </div>
      </div>
      {fields.periodKind === "custom" && (
        <div>
          <Label>Range label</Label>
          <Input value={fields.periodLabel} onChange={(e) => onChange({ ...fields, periodLabel: e.target.value })} placeholder="while in South America" />
        </div>
      )}
      <div>
        <Label>Serves objective(s) — required</Label>
        <p className="text-xs text-muted-foreground mb-1">A goal always moves you toward at least one objective.</p>
        <div className="flex flex-wrap gap-1.5 max-h-40 overflow-y-auto rounded-md border p-2">
          {activeObjectives.map((o) => {
            const on = fields.objectiveIds.includes(o.id)
            return (
              <button
                key={o.id}
                type="button"
                onClick={() =>
                  onChange({
                    ...fields,
                    objectiveIds: on ? fields.objectiveIds.filter((id) => id !== o.id) : [...fields.objectiveIds, o.id],
                  })
                }
                className={`text-xs rounded-full border px-2.5 py-1 ${on ? "bg-primary text-primary-foreground border-primary" : "hover:bg-muted"}`}
              >
                {o.title}
              </button>
            )
          })}
        </div>
      </div>
      <Button onClick={onSubmit} className="w-full" disabled={!fields.title.trim() || fields.objectiveIds.length === 0}>
        {submitLabel}
      </Button>
    </div>
  )

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap justify-between items-center gap-3">
        <div>
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <Trophy className="h-5 w-5" /> Goals
          </h3>
          <p className="text-sm text-muted-foreground">Quantifiable metrics that move your objectives forward.</p>
        </div>
        <Dialog open={showAdd} onOpenChange={setShowAdd}>
          <DialogTrigger asChild>
            <Button size="sm"><Plus className="h-4 w-4 mr-2" />Add Goal</Button>
          </DialogTrigger>
          <DialogContent className="max-h-[85vh] overflow-y-auto">
            <DialogHeader><DialogTitle>New Goal</DialogTitle></DialogHeader>
            {goalForm(draft, setDraft, handleAdd, "Add Goal")}
          </DialogContent>
        </Dialog>
      </div>

      <div className="flex flex-wrap gap-1">
        <Button size="sm" variant={filter === "all" ? "default" : "outline"} onClick={() => setFilter("all")}>All</Button>
        {PERIOD_KINDS.map((p) => (
          <Button key={p} size="sm" variant={filter === p ? "default" : "outline"} onClick={() => setFilter(p)}>
            {PERIOD_LABELS[p]}
          </Button>
        ))}
      </div>

      <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
        {visible.map((goal) => (
          <Card key={goal.id} className="card-hover">
            <CardHeader className="pb-2">
              <div className="flex items-start justify-between gap-2">
                <CardTitle className="text-base leading-snug">{goal.title}</CardTitle>
                <div className="flex items-center gap-1 shrink-0">
                  <Badge variant="outline" className="text-[10px]">{PERIOD_LABELS[goal.periodKind]}</Badge>
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setEditing(goal)}>
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
              {goal.periodLabel && <p className="text-xs text-muted-foreground">{goal.periodLabel}</p>}
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex justify-between items-center text-sm">
                <span className="text-muted-foreground">Progress</span>
                <span className="font-medium">
                  {goal.current} / {goal.target}{goal.unit ? ` ${goal.unit}` : ""}
                </span>
              </div>
              <Progress value={goalProgressPercent(goal)} className="h-2.5" />

              <div className="flex flex-wrap gap-1">
                {goal.objectiveIds.map((id) => (
                  <Badge key={id} variant="secondary" className="text-[10px]">{objectiveTitle(id)}</Badge>
                ))}
              </div>

              {goal.completed ? (
                <div className="flex items-center gap-2 text-green-600 text-sm">
                  <CheckCircle2 className="h-4 w-4" /> Completed — {goal.points} pts
                </div>
              ) : goal.type === "boolean" ? (
                <Button size="sm" className="w-full" onClick={() => setGoalProgress(goal.id, 1)}>
                  <CheckCircle2 className="h-4 w-4 mr-2" />Mark complete (+{goal.points} pts)
                </Button>
              ) : (
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" onClick={() => setGoalProgress(goal.id, Math.max(0, goal.current - 1))}>-1</Button>
                  <Button size="sm" variant="outline" onClick={() => setGoalProgress(goal.id, goal.current + 1)}>+1</Button>
                  <Button size="sm" className="flex-1" onClick={() => logAction(goal)} title="Record a completed action + earn objective points">
                    <PlusCircle className="h-4 w-4 mr-1" />Log
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        ))}
        {visible.length === 0 && (
          <div className="col-span-full text-center py-8 text-muted-foreground text-sm">
            No goals here yet. Add one and link it to an objective.
          </div>
        )}
      </div>

      {editing && (
        <Dialog open onOpenChange={() => setEditing(null)}>
          <DialogContent className="max-h-[85vh] overflow-y-auto">
            <DialogHeader><DialogTitle>Edit Goal</DialogTitle></DialogHeader>
            {goalForm(
              {
                title: editing.title,
                description: editing.description ?? "",
                type: editing.type,
                target: editing.target,
                unit: editing.unit ?? "",
                periodKind: editing.periodKind,
                periodLabel: editing.periodLabel ?? "",
                objectiveIds: editing.objectiveIds,
                points: editing.points,
              },
              (v) =>
                setEditing({
                  ...editing,
                  title: v.title,
                  description: v.description || undefined,
                  type: v.type,
                  target: v.target,
                  unit: v.unit || undefined,
                  periodKind: v.periodKind,
                  periodLabel: v.periodKind === "custom" ? v.periodLabel || undefined : undefined,
                  objectiveIds: v.objectiveIds,
                  points: v.points,
                }),
              () => {
                updateGoal(editing)
                setEditing(null)
              },
              "Save Changes",
            )}
            <Button variant="destructive" className="w-full mt-2" onClick={() => { deleteGoal(editing.id); setEditing(null) }}>
              <Trash2 className="h-4 w-4 mr-2" />Delete Goal
            </Button>
          </DialogContent>
        </Dialog>
      )}
    </div>
  )
}
