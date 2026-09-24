/**
 * components/Home/Goals/ObjectiveDetailDialog.tsx — Objective detail / editor
 *
 * Edit an all-time Objective, prioritize per period, see linked goals +
 * contributing actions, write a period review. Caps: 3 per day/week/month, 5/year.
 */
"use client"

import { useMemo, useState } from "react"
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog"
import { useGoalsStore } from "@/lib/goals-store"
import { useTaskStore } from "@/lib/task-store"
import {
  periodKeyFor,
  isObjectivePrioritized,
  prioritizedObjectives,
  goalProgressPercent,
  MAX_PRIORITIES_PER_PERIOD,
} from "@/lib/objectives"
import type { PriorityPeriod } from "@/lib/types"
import { safeDateFormat } from "@/lib/date-utils"
import { itemTitle } from "@/lib/item-utils"
import { UnsavedChangesDialog, unsavedDismissProps, useUnsavedGuard } from "@/components/ui/unsaved-changes-guard"

const PERIODS: PriorityPeriod[] = ["day", "week", "month", "year"]
const PERIOD_LABELS: Record<PriorityPeriod, string> = { day: "Day", week: "Week", month: "Month", year: "Year" }

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

export function ObjectiveDetailDialog({
  objectiveId,
  onClose,
}: {
  objectiveId: string
  onClose: () => void
}) {
  const objective = useGoalsStore((s) => s.objectives.find((o) => o.id === objectiveId))
  const objectives = useGoalsStore((s) => s.objectives)
  const goals = useGoalsStore((s) => s.goals)
  const updateObjective = useGoalsStore((s) => s.updateObjective)
  const deleteObjective = useGoalsStore((s) => s.deleteObjective)
  const setObjectivePriority = useGoalsStore((s) => s.setObjectivePriority)
  const clearObjectivePriority = useGoalsStore((s) => s.clearObjectivePriority)
  const saveObjectiveReview = useGoalsStore((s) => s.saveObjectiveReview)
  const tasks = useTaskStore((s) => s.tasks)

  const [title, setTitle] = useState(objective?.title ?? "")
  const [description, setDescription] = useState(objective?.description ?? "")
  const [reviewPeriod, setReviewPeriod] = useState<PriorityPeriod>("year")
  const [reviewText, setReviewText] = useState("")

  const linkedGoals = useMemo(
    () => goals.filter((g) => g.objectiveIds.includes(objectiveId)),
    [goals, objectiveId],
  )
  const contributingActions = useMemo(
    () =>
      tasks
        .filter((t) => t.completed && t.contributesToObjectiveIds?.includes(objectiveId))
        .sort((a, b) => {
          const da = a.completedDate ? new Date(a.completedDate).getTime() : 0
          const db = b.completedDate ? new Date(b.completedDate).getTime() : 0
          return db - da
        }),
    [tasks, objectiveId],
  )

  const saveBasics = () => {
    if (!objective) return
    updateObjective({ ...objective, title: title.trim() || objective.title, description: description.trim() || undefined })
  }

  const togglePriority = (period: PriorityPeriod) => {
    const key = periodKeyFor(period)
    if (isObjectivePrioritized(objective, period)) {
      clearObjectivePriority(objective.id, period, key)
      return
    }
    const count = prioritizedObjectives(objectives, period).length
    if (count >= MAX_PRIORITIES_PER_PERIOD[period]) {
      alert(`You can prioritize at most ${MAX_PRIORITIES_PER_PERIOD[period]} objectives per ${period}.`)
      return
    }
    setObjectivePriority(objective.id, { period, periodKey: key, multiplier: 2 })
  }

  const setMultiplier = (period: PriorityPeriod, multiplier: number) => {
    const key = periodKeyFor(period)
    setObjectivePriority(objective.id, { period, periodKey: key, multiplier: Math.max(1, multiplier) })
  }

  const currentPriority = (period: PriorityPeriod) =>
    (objective?.priorities ?? []).find((p) => p.period === period && p.periodKey === periodKeyFor(period))

  const existingReview = (objective?.reviews ?? []).find(
    (r) => r.id === `${reviewPeriod}:${periodKeyFor(reviewPeriod)}`,
  )

  const isDirty = Boolean(
    objective &&
      (title !== (objective.title ?? "") ||
        description !== (objective.description ?? "") ||
        reviewText.trim() !== ""),
  )
  const persistObjective = () => {
    if (!objective) return false
    saveBasics()
    if (reviewText.trim()) {
      saveObjectiveReview(objective.id, reviewPeriod, periodKeyFor(reviewPeriod), reviewText)
    }
  }
  const guard = useUnsavedGuard({
    open: true,
    onOpenChange: (next) => {
      if (!next) onClose()
    },
    isDirty,
    onSave: persistObjective,
    onDiscard: () => {
      setTitle(objective?.title ?? "")
      setDescription(objective?.description ?? "")
      setReviewText("")
    },
  })

  if (!objective) return null

  return (
    <>
      <Dialog open onOpenChange={guard.handleOpenChange}>
        <DialogContent
          className="gol95 gol95-dialog"
          hideClose
          aria-describedby={undefined}
          data-ui-name="Objective detail"
          data-ui-docs="components/Home/Goals/README.md"
          {...unsavedDismissProps(guard.requestClose)}
        >
          <div className="gol-dialog-caption">
            <DialogTitle>Objective</DialogTitle>
          </div>
          <div className="gol-dialog-body">
            <label>
              Title
              <input value={title} onChange={(e) => setTitle(e.target.value)} onBlur={saveBasics} />
            </label>
            <label>
              Description
              <textarea value={description} onChange={(e) => setDescription(e.target.value)} onBlur={saveBasics} rows={2} />
            </label>

            <div>
              <p className="gol-legend" style={{ fontWeight: "bold", color: "#000080", marginBottom: 4 }}>
                Prioritize for a period
              </p>
              <p>
                Prioritized objectives multiply points for contributing actions. Caps: 3 per day/week/month, 5 per year.
              </p>
              <div className="gol-grid-2" style={{ marginTop: 8 }}>
                {PERIODS.map((period) => {
                  const priority = currentPriority(period)
                  const on = !!priority
                  return (
                    <div key={period} className="gol-row" style={{ background: "#fff", boxShadow: "inset 1px 1px #808080, inset -1px -1px #fff" }}>
                      <div className="min-w-0">
                        <div style={{ fontWeight: "bold" }}>{PERIOD_LABELS[period]}</div>
                        <div className="gol-meta">{periodKeyFor(period)}</div>
                      </div>
                      <div className="gol-actions">
                        {on && (
                          <label style={{ display: "flex", alignItems: "center", gap: 4, margin: 0 }}>
                            ×
                            <input
                              type="number"
                              min={1}
                              step={0.5}
                              style={{ width: "4rem" }}
                              value={priority.multiplier}
                              onChange={(e) => setMultiplier(period, Number.parseFloat(e.target.value) || 1)}
                            />
                          </label>
                        )}
                        <button type="button" className="gol-btn" aria-pressed={on} onClick={() => togglePriority(period)}>
                          {on ? "On" : "Off"}
                        </button>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>

            <div>
              <p className="gol-legend" style={{ fontWeight: "bold", color: "#000080" }}>
                Goals serving this objective ({linkedGoals.length})
              </p>
              {linkedGoals.length === 0 ? (
                <p>No goals yet. Add a goal and link it to this objective.</p>
              ) : (
                linkedGoals.map((g) => (
                  <div key={g.id} className="gol-row">
                    <span className="gol-row-name" style={{ cursor: "default" }}>
                      {g.title}
                    </span>
                    <span className="gol-meta">
                      {g.current}/{g.target}
                      {g.unit ? ` ${g.unit}` : ""}
                    </span>
                    <div style={{ width: "6rem" }}>
                      <GoalPips percent={goalProgressPercent(g)} />
                    </div>
                  </div>
                ))
              )}
            </div>

            <div>
              <p className="gol-legend" style={{ fontWeight: "bold", color: "#000080" }}>
                Contributing actions ({contributingActions.length})
              </p>
              {contributingActions.length === 0 ? (
                <p>No completed actions yet. Mark tasks as contributing to this objective when you finish them.</p>
              ) : (
                <ul className="m-0 p-0 list-none" style={{ maxHeight: "10rem", overflow: "auto" }}>
                  {contributingActions.slice(0, 50).map((t) => (
                    <li key={t.id} className="gol-row" style={{ padding: "4px 0" }}>
                      <span className="gol-row-name" style={{ cursor: "default" }}>
                        {itemTitle(t)}
                      </span>
                      <span className="gol-meta">{t.completedDate ? safeDateFormat(t.completedDate) : ""}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div>
              <p className="gol-legend" style={{ fontWeight: "bold", color: "#000080" }}>
                Review this objective
              </p>
              <div className="gol-tabs" style={{ margin: "6px 0" }}>
                {PERIODS.map((p) => (
                  <button
                    key={p}
                    type="button"
                    className="gol-btn"
                    aria-pressed={reviewPeriod === p}
                    onClick={() => {
                      setReviewPeriod(p)
                      const r = (objective.reviews ?? []).find((rv) => rv.id === `${p}:${periodKeyFor(p)}`)
                      setReviewText(r?.summary ?? "")
                    }}
                  >
                    {PERIOD_LABELS[p]}
                  </button>
                ))}
              </div>
              <p>
                {PERIOD_LABELS[reviewPeriod]} {periodKeyFor(reviewPeriod)} — analyze your success furthering this
                objective.
              </p>
              <textarea
                value={reviewText || existingReview?.summary || ""}
                onChange={(e) => setReviewText(e.target.value)}
                rows={3}
                placeholder="What actions contributed? How successful were you? What's next?"
              />
              <div className="gol-dialog-actions">
                <button
                  type="button"
                  className="gol-btn"
                  onClick={() => saveObjectiveReview(objective.id, reviewPeriod, periodKeyFor(reviewPeriod), reviewText)}
                  disabled={!reviewText.trim()}
                >
                  Save review
                </button>
              </div>
              {(objective.reviews ?? []).length > 0 && (
                <div>
                  <p>Past reviews</p>
                  {(objective.reviews ?? [])
                    .slice()
                    .sort((a, b) => new Date(b.completedAt).getTime() - new Date(a.completedAt).getTime())
                    .map((r) => (
                      <p key={r.id}>
                        <strong>{r.id}</strong>: {r.summary}
                      </p>
                    ))}
                </div>
              )}
            </div>

            <div className="gol-danger">
              <button
                type="button"
                className="gol-btn"
                onClick={() => updateObjective({ ...objective, archived: !objective.archived })}
              >
                {objective.archived ? "Unarchive" : "Archive"}
              </button>
              <button
                type="button"
                className="gol-btn"
                onClick={() => {
                  if (confirm(`Delete objective "${objective.title}"?`)) {
                    deleteObjective(objective.id)
                    onClose()
                  }
                }}
              >
                Delete
              </button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
      <UnsavedChangesDialog {...guard.prompt} />
    </>
  )
}
