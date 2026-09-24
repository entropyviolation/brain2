/**
 * components/Home/Goals/GoalsContainer.tsx — Quantifiable goals
 *
 * Packed well of measurable metrics that serve objectives. Filter, ±1, Log,
 * complete, add/edit — same verbs, mill furniture.
 */
"use client"

import { useMemo, useState } from "react"
import { Dialog, DialogContent, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { useGoalsStore, taskObjectiveMultiplier } from "@/lib/goals-store"
import { usePointsStore } from "@/lib/points-store"
import { useTaskStore } from "@/lib/task-store"
import { goalProgressPercent } from "@/lib/objectives"
import type { Goal, GoalPeriodKind, Task } from "@/lib/types"
import { APP_NAV_KEYS } from "@/lib/app-navigation"
import { usePersistedTab } from "@/lib/use-persisted-tab"
import { snapshotsEqual } from "@/lib/unsaved-changes"
import { UnsavedChangesDialog, unsavedDismissProps, useUnsavedGuard } from "@/components/ui/unsaved-changes-guard"

const PERIOD_KINDS: GoalPeriodKind[] = ["day", "week", "month", "year", "custom", "aspirational"]
const GOAL_FILTERS = ["all", ...PERIOD_KINDS] as const
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

function GoalPips({ percent }: { percent: number }) {
  const n = Math.round(Math.max(0, Math.min(100, percent)) / 10)
  return (
    <div className="gol-pips" aria-hidden>
      {Array.from({ length: 10 }, (_, i) => (
        <span key={i} className={`gol-pip${i < n ? " is-on" : ""}`} />
      ))}
    </div>
  )
}

export function GoalsContainer() {
  const goals = useGoalsStore((s) => s.goals)
  const objectives = useGoalsStore((s) => s.objectives)
  const addGoal = useGoalsStore((s) => s.addGoal)
  const updateGoal = useGoalsStore((s) => s.updateGoal)
  const deleteGoal = useGoalsStore((s) => s.deleteGoal)
  const setGoalProgress = useGoalsStore((s) => s.setGoalProgress)
  const addTask = useTaskStore((s) => s.addTask)
  const addPoints = usePointsStore((s) => s.addPoints)

  const [filter, setFilter] = usePersistedTab(APP_NAV_KEYS.homeGoalsFilter, GOAL_FILTERS, "all")
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

  const addDirty = !snapshotsEqual(draft, emptyDraft())
  const addGuard = useUnsavedGuard({
    open: showAdd,
    onOpenChange: (next) => {
      setShowAdd(next)
      if (!next) setDraft(emptyDraft())
    },
    isDirty: addDirty,
    onSave: () => {
      if (!draft.title.trim() || draft.objectiveIds.length === 0) return false
      handleAdd()
    },
    onDiscard: () => setDraft(emptyDraft()),
  })
  const [editBaseline, setEditBaseline] = useState<Goal | null>(null)
  const editDirty = Boolean(editing && editBaseline && !snapshotsEqual(
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
    {
      title: editBaseline.title,
      description: editBaseline.description ?? "",
      type: editBaseline.type,
      target: editBaseline.target,
      unit: editBaseline.unit ?? "",
      periodKind: editBaseline.periodKind,
      periodLabel: editBaseline.periodLabel ?? "",
      objectiveIds: editBaseline.objectiveIds,
      points: editBaseline.points,
    },
  ))
  const editGuard = useUnsavedGuard({
    open: !!editing,
    onOpenChange: (next) => {
      if (!next) {
        setEditing(null)
        setEditBaseline(null)
      }
    },
    isDirty: editDirty,
    onSave: () => {
      if (!editing) return false
      updateGoal(editing)
    },
    onDiscard: () => {
      setEditing(null)
      setEditBaseline(null)
    },
  })

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
    <div className="gol-dialog-body">
      <label>
        Title
        <input value={fields.title} onChange={(e) => onChange({ ...fields, title: e.target.value })} placeholder="e.g., Read 20 books this year" />
      </label>
      <label>
        Description
        <textarea value={fields.description} onChange={(e) => onChange({ ...fields, description: e.target.value })} rows={2} />
      </label>
      <div className="gol-grid-3">
        <label>
          Type
          <select value={fields.type} onChange={(e) => onChange({ ...fields, type: e.target.value as Goal["type"] })}>
            <option value="count">Count</option>
            <option value="numerical">Numerical</option>
            <option value="boolean">Yes/No</option>
          </select>
        </label>
        <label>
          Target
          <input type="number" value={fields.target} onChange={(e) => onChange({ ...fields, target: Number.parseInt(e.target.value) || 1 })} />
        </label>
        <label>
          Unit
          <input value={fields.unit} onChange={(e) => onChange({ ...fields, unit: e.target.value })} placeholder="books" />
        </label>
      </div>
      <div className="gol-grid-2">
        <label>
          Period
          <select value={fields.periodKind} onChange={(e) => onChange({ ...fields, periodKind: e.target.value as GoalPeriodKind })}>
            {PERIOD_KINDS.map((p) => (
              <option key={p} value={p}>
                {PERIOD_LABELS[p]}
              </option>
            ))}
          </select>
        </label>
        <label>
          Points reward
          <input type="number" value={fields.points} onChange={(e) => onChange({ ...fields, points: Number.parseInt(e.target.value) || 0 })} />
        </label>
      </div>
      {fields.periodKind === "custom" && (
        <label>
          Range label
          <input value={fields.periodLabel} onChange={(e) => onChange({ ...fields, periodLabel: e.target.value })} placeholder="while in South America" />
        </label>
      )}
      <div>
        <label>Serves objective(s) — required</label>
        <p>A goal always moves you toward at least one objective.</p>
        <div className="gol-obj-picks">
          {activeObjectives.map((o) => {
            const on = fields.objectiveIds.includes(o.id)
            return (
              <button
                key={o.id}
                type="button"
                className="gol-btn"
                aria-pressed={on}
                onClick={() =>
                  onChange({
                    ...fields,
                    objectiveIds: on ? fields.objectiveIds.filter((id) => id !== o.id) : [...fields.objectiveIds, o.id],
                  })
                }
              >
                {o.title}
              </button>
            )
          })}
        </div>
      </div>
      <div className="gol-dialog-actions">
        <button type="button" className="gol-btn" onClick={onSubmit} disabled={!fields.title.trim() || fields.objectiveIds.length === 0}>
          {submitLabel}
        </button>
      </div>
    </div>
  )

  return (
    <div className="gol-section">
      <div className="gol-section-head">
        <div>
          <h3 className="gol-legend">Goals</h3>
          <p className="gol-hint">Quantifiable metrics that move your objectives forward.</p>
        </div>
        <Dialog open={showAdd} onOpenChange={addGuard.handleOpenChange}>
          <DialogTrigger asChild>
            <button type="button" className="gol-btn">
              Add Goal
            </button>
          </DialogTrigger>
          <DialogContent className="gol95 gol95-dialog" hideClose aria-describedby={undefined} {...unsavedDismissProps(addGuard.requestClose)}>
            <div className="gol-dialog-caption">
              <DialogTitle>New Goal</DialogTitle>
            </div>
            {goalForm(draft, setDraft, handleAdd, "Add Goal")}
          </DialogContent>
        </Dialog>
      </div>

      <div className="gol-tabs">
        <button type="button" className="gol-btn" aria-pressed={filter === "all"} onClick={() => setFilter("all")}>
          All
        </button>
        {PERIOD_KINDS.map((p) => (
          <button key={p} type="button" className="gol-btn" aria-pressed={filter === p} onClick={() => setFilter(p)}>
            {PERIOD_LABELS[p]}
          </button>
        ))}
      </div>

      <div className="gol-goals">
        {visible.map((goal) => (
          <div key={goal.id} className="gol-goal">
            <div>
              <div className="gol-row-name" style={{ display: "block" }}>
                {goal.title}
              </div>
              <div className="gol-meta">
                {PERIOD_LABELS[goal.periodKind]}
                {goal.periodLabel ? ` · ${goal.periodLabel}` : ""}
              </div>
              <div className="gol-chips" style={{ justifyContent: "flex-start", marginTop: 4 }}>
                {goal.objectiveIds.map((id) => (
                  <span key={id} className="gol-chip">
                    {objectiveTitle(id)}
                  </span>
                ))}
              </div>
            </div>
            <div>
              <div className="gol-meta">
                {goal.current} / {goal.target}
                {goal.unit ? ` ${goal.unit}` : ""}
              </div>
              <GoalPips percent={goalProgressPercent(goal)} />
            </div>
            <div className="gol-actions">
              <button type="button" className="gol-btn" onClick={() => { setEditing(goal); setEditBaseline(goal) }}>
                Edit
              </button>
              {goal.completed ? (
                <span className="gol-ok">Completed — {goal.points} pts</span>
              ) : goal.type === "boolean" ? (
                <button type="button" className="gol-btn" onClick={() => setGoalProgress(goal.id, 1)}>
                  Mark complete (+{goal.points} pts)
                </button>
              ) : (
                <>
                  <button type="button" className="gol-btn" onClick={() => setGoalProgress(goal.id, Math.max(0, goal.current - 1))}>
                    -1
                  </button>
                  <button type="button" className="gol-btn" onClick={() => setGoalProgress(goal.id, goal.current + 1)}>
                    +1
                  </button>
                  <button type="button" className="gol-btn" onClick={() => logAction(goal)} title="Record a completed action + earn objective points">
                    Log
                  </button>
                </>
              )}
            </div>
          </div>
        ))}
        {visible.length === 0 && (
          <div className="gol-empty">No goals here yet. Add one and link it to an objective.</div>
        )}
      </div>

      {editing && (
        <Dialog open onOpenChange={editGuard.handleOpenChange}>
          <DialogContent className="gol95 gol95-dialog" hideClose aria-describedby={undefined} {...unsavedDismissProps(editGuard.requestClose)}>
            <div className="gol-dialog-caption">
              <DialogTitle>Edit Goal</DialogTitle>
            </div>
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
                setEditBaseline(null)
              },
              "Save Changes",
            )}
            <div className="gol-dialog-body">
              <div className="gol-danger">
                <button
                  type="button"
                  className="gol-btn"
                  onClick={() => {
                    deleteGoal(editing.id)
                    setEditing(null)
                    setEditBaseline(null)
                  }}
                >
                  Delete Goal
                </button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}
      <UnsavedChangesDialog {...addGuard.prompt} />
      <UnsavedChangesDialog {...editGuard.prompt} />
    </div>
  )
}
