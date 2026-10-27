/**
 * components/Home/Goals/goals-phone-sheets.tsx — phone sheets for Goals
 *
 * Bottom sheets stand in for the desktop dialogs. Same fields, same store
 * writes, same unsaved-changes guard. The grabber is the only drag surface
 * so the sheet body can still scroll.
 */
"use client"

import { useEffect, useId, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent, type ReactNode } from "react"
import { createPortal } from "react-dom"
import { useGoalsStore } from "@/lib/goals-store"
import { pointsRuleValue } from "@/lib/points-rules-live"
import { useTaskStore } from "@/lib/task-store"
import {
  periodKeyFor,
  isObjectivePrioritized,
  prioritizedObjectives,
  goalProgressPercent,
  MAX_PRIORITIES_PER_PERIOD,
} from "@/lib/objectives"
import { safeDateFormat } from "@/lib/date-utils"
import { itemTitle } from "@/lib/item-utils"
import { formatCrtNumber } from "@/lib/crt-number"
import { snapshotsEqual } from "@/lib/unsaved-changes"
import { UnsavedChangesDialog, useUnsavedGuard } from "@/components/ui/unsaved-changes-guard"
import type { Goal, GoalPeriodKind, PriorityPeriod } from "@/lib/types"
import { useGoalsReducedMotion } from "./use-goals-phone"
import { GOAL_PERIOD_LABELS, PERIOD_KINDS, PERIOD_LABELS, PRIORITY_PERIODS } from "./goals-phone-shared"
import { ProgressRing } from "./goals-phone-ring"

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
  points: pointsRuleValue("goal.defaultPoints"),
})

function draftFromGoal(goal: Goal): GoalDraft {
  return {
    title: goal.title,
    description: goal.description ?? "",
    type: goal.type,
    target: goal.target,
    unit: goal.unit ?? "",
    periodKind: goal.periodKind,
    periodLabel: goal.periodLabel ?? "",
    objectiveIds: goal.objectiveIds,
    points: goal.points,
  }
}

export function PhoneSheet({
  title,
  onRequestClose,
  children,
  uiName,
}: {
  title: string
  onRequestClose: () => void
  children: ReactNode
  uiName?: string
}) {
  const reduced = useGoalsReducedMotion()
  const titleId = useId()
  const closeRef = useRef(onRequestClose)
  closeRef.current = onRequestClose
  const sheetRef = useRef<HTMLDivElement>(null)
  const [shown, setShown] = useState(reduced)

  useEffect(() => {
    if (reduced) return
    const id = requestAnimationFrame(() => setShown(true))
    return () => cancelAnimationFrame(id)
  }, [reduced])

  useEffect(() => {
    const previous = document.body.style.overflow
    document.body.style.overflow = "hidden"
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") closeRef.current()
    }
    window.addEventListener("keydown", onKey)
    return () => {
      document.body.style.overflow = previous
      window.removeEventListener("keydown", onKey)
    }
  }, [])

  const onGrabDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) return
    const start = event.clientY
    const handle = event.currentTarget
    const sheet = sheetRef.current
    sheet?.classList.add("is-drag")
    const move = (ev: PointerEvent) => {
      if (!sheet) return
      sheet.style.transform = `translateY(${Math.max(0, ev.clientY - start)}px)`
    }
    const up = (ev: PointerEvent) => {
      handle.removeEventListener("pointermove", move)
      handle.removeEventListener("pointerup", up)
      handle.removeEventListener("pointercancel", up)
      const traveled = Math.max(0, ev.clientY - start)
      if (traveled > 120) {
        closeRef.current()
        return
      }
      sheet?.classList.remove("is-drag")
      requestAnimationFrame(() => {
        if (sheet) sheet.style.transform = ""
      })
    }
    handle.setPointerCapture?.(event.pointerId)
    handle.addEventListener("pointermove", move)
    handle.addEventListener("pointerup", up)
    handle.addEventListener("pointercancel", up)
  }

  const sheet = (
    <div className={`gol-phone-overlay${shown ? " is-in" : ""}`} onClick={() => closeRef.current()}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        data-ui-name={uiName}
        data-ui-docs="components/Home/Goals/README.md"
        className={`gol-phone-sheet${shown ? " is-in" : ""}`}
        ref={sheetRef}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="gol-phone-grab" onPointerDown={onGrabDown}>
          <span />
        </div>
        <div className="gol-phone-sheet-bar">
          <button data-no95 type="button" className="gol-phone-text-btn" onClick={() => closeRef.current()}>
            Close
          </button>
          <h2 id={titleId}>{title}</h2>
          <span className="gol-phone-sheet-bar-spacer" aria-hidden />
        </div>
        <div className="gol-phone-sheet-body">{children}</div>
      </div>
    </div>
  )

  return createPortal(sheet, document.body)
}

function GoalFormFields({
  fields,
  onChange,
  onSubmit,
  submitLabel,
}: {
  fields: GoalDraft
  onChange: (next: GoalDraft) => void
  onSubmit: () => void
  submitLabel: string
}) {
  const objectives = useGoalsStore((s) => s.objectives)
  const activeObjectives = useMemo(() => objectives.filter((o) => !o.archived), [objectives])
  const ready = fields.title.trim() !== "" && fields.objectiveIds.length > 0

  return (
    <div className="gol-phone-form">
      <label>
        Title
        <input value={fields.title} onChange={(e) => onChange({ ...fields, title: e.target.value })} placeholder="e.g., Read 20 books this year" />
      </label>
      <label>
        Description
        <textarea value={fields.description} onChange={(e) => onChange({ ...fields, description: e.target.value })} rows={3} />
      </label>
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
      <label>
        Period
        <select value={fields.periodKind} onChange={(e) => onChange({ ...fields, periodKind: e.target.value as GoalPeriodKind })}>
          {PERIOD_KINDS.map((period) => (
            <option key={period} value={period}>
              {GOAL_PERIOD_LABELS[period]}
            </option>
          ))}
        </select>
      </label>
      <label>
        Points reward
        <input type="number" value={fields.points} onChange={(e) => onChange({ ...fields, points: Number.parseInt(e.target.value) || 0 })} />
      </label>
      {fields.periodKind === "custom" && (
        <label>
          Range label
          <input value={fields.periodLabel} onChange={(e) => onChange({ ...fields, periodLabel: e.target.value })} placeholder="while in South America" />
        </label>
      )}
      <fieldset className="gol-phone-picks">
        <legend>Serves objective(s) — required</legend>
        <p>A goal always moves you toward at least one objective.</p>
        <div className="gol-phone-pick-list">
          {activeObjectives.map((objective) => {
            const on = fields.objectiveIds.includes(objective.id)
            return (
              <button
                data-no95
                key={objective.id}
                type="button"
                className="gol-phone-pick"
                aria-pressed={on}
                onClick={() =>
                  onChange({
                    ...fields,
                    objectiveIds: on
                      ? fields.objectiveIds.filter((id) => id !== objective.id)
                      : [...fields.objectiveIds, objective.id],
                  })
                }
              >
                {objective.title}
              </button>
            )
          })}
        </div>
      </fieldset>
      <button data-no95 type="button" className="gol-phone-primary" onClick={onSubmit} disabled={!ready}>
        {submitLabel}
      </button>
    </div>
  )
}

export function GoalPhoneSheet({ goal, onClose }: { goal: Goal | null; onClose: () => void }) {
  const addGoal = useGoalsStore((s) => s.addGoal)
  const updateGoal = useGoalsStore((s) => s.updateGoal)
  const deleteGoal = useGoalsStore((s) => s.deleteGoal)
  const [draft, setDraft] = useState<GoalDraft>(() => (goal ? draftFromGoal(goal) : emptyDraft()))
  const baseline = useRef(goal ? draftFromGoal(goal) : emptyDraft())

  const save = () => {
    if (!draft.title.trim() || draft.objectiveIds.length === 0) return false
    if (goal) {
      updateGoal({
        ...goal,
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
    } else {
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
    }
    onClose()
  }

  const guard = useUnsavedGuard({
    open: true,
    onOpenChange: (next) => {
      if (!next) onClose()
    },
    isDirty: !snapshotsEqual(draft, baseline.current),
    onSave: save,
    onDiscard: () => setDraft(baseline.current),
  })

  return (
    <>
      <PhoneSheet title={goal ? "Edit Goal" : "New Goal"} uiName={goal ? "Edit Goal" : "New Goal"} onRequestClose={guard.requestClose}>
        <GoalFormFields fields={draft} onChange={setDraft} onSubmit={save} submitLabel={goal ? "Save Changes" : "Add Goal"} />
        {goal && (
          <div className="gol-phone-danger">
            <button
              data-no95
              type="button"
              onClick={() => {
                deleteGoal(goal.id)
                onClose()
              }}
            >
              Delete Goal
            </button>
          </div>
        )}
      </PhoneSheet>
      <UnsavedChangesDialog {...guard.prompt} />
    </>
  )
}

export function ObjectivePhoneSheet({ objectiveId, onClose }: { objectiveId: string; onClose: () => void }) {
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

  const linkedGoals = useMemo(() => goals.filter((g) => g.objectiveIds.includes(objectiveId)), [goals, objectiveId])
  const contributingActions = useMemo(
    () =>
      tasks
        .filter((task) => task.completed && task.contributesToObjectiveIds?.includes(objectiveId))
        .sort((a, b) => {
          const da = a.completedDate ? new Date(a.completedDate).getTime() : 0
          const db = b.completedDate ? new Date(b.completedDate).getTime() : 0
          return db - da
        }),
    [tasks, objectiveId],
  )

  const saveBasics = () => {
    if (!objective) return
    updateObjective({
      ...objective,
      title: title.trim() || objective.title,
      description: description.trim() || undefined,
    })
  }

  const togglePriority = (period: PriorityPeriod) => {
    if (!objective) return
    const key = periodKeyFor(period)
    if (isObjectivePrioritized(objective, period)) {
      clearObjectivePriority(objective.id, period, key)
      return
    }
    const count = prioritizedObjectives(objectives, period).length
    if (count >= MAX_PRIORITIES_PER_PERIOD[period]) {
      window.alert(`You can prioritize at most ${MAX_PRIORITIES_PER_PERIOD[period]} objectives per ${period}.`)
      return
    }
    setObjectivePriority(objective.id, {
      period,
      periodKey: key,
      multiplier: pointsRuleValue("objective.prioritySeedMultiplier"),
    })
  }

  const setMultiplier = (period: PriorityPeriod, multiplier: number) => {
    if (!objective) return
    const key = periodKeyFor(period)
    setObjectivePriority(objective.id, { period, periodKey: key, multiplier: Math.max(1, multiplier) })
  }

  const currentPriority = (period: PriorityPeriod) =>
    (objective?.priorities ?? []).find((p) => p.period === period && p.periodKey === periodKeyFor(period))

  const existingReview = (objective?.reviews ?? []).find((r) => r.id === `${reviewPeriod}:${periodKeyFor(reviewPeriod)}`)

  const isDirty = Boolean(
    objective && (title !== (objective.title ?? "") || description !== (objective.description ?? "") || reviewText.trim() !== ""),
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
      <PhoneSheet title="Objective" uiName="Objective detail" onRequestClose={guard.requestClose}>
        <div className="gol-phone-form">
          <label>
            Title
            <input value={title} onChange={(e) => setTitle(e.target.value)} onBlur={saveBasics} />
          </label>
          <label>
            Description
            <textarea value={description} onChange={(e) => setDescription(e.target.value)} onBlur={saveBasics} rows={3} />
          </label>

          <section>
            <h3>Prioritize for a period</h3>
            <p>Prioritized objectives multiply points for contributing actions. Caps: 3 per day, week, and month. 4 per season. 5 per year.</p>
            <ul className="gol-phone-card">
              {PRIORITY_PERIODS.map((period) => {
                const priority = currentPriority(period)
                const on = !!priority
                return (
                  <li key={period} className="gol-phone-prio">
                    <div>
                      <strong>{PERIOD_LABELS[period]}</strong>
                      <span className="gol-phone-meta">{periodKeyFor(period)}</span>
                    </div>
                    <div className="gol-phone-prio-actions">
                      {on && (
                        <label className="gol-phone-mult">
                          ×
                          <input
                            type="number"
                            min={1}
                            step={0.5}
                            aria-label={`${PERIOD_LABELS[period]} multiplier`}
                            value={priority.multiplier}
                            onChange={(e) => setMultiplier(period, Number.parseFloat(e.target.value) || 1)}
                          />
                        </label>
                      )}
                      <button data-no95 type="button" className="gol-phone-chip-btn" aria-pressed={on} onClick={() => togglePriority(period)}>
                        {on ? "On" : "Off"}
                      </button>
                    </div>
                  </li>
                )
              })}
            </ul>
          </section>

          <section>
            <h3>Goals serving this objective ({linkedGoals.length})</h3>
            {linkedGoals.length === 0 ? (
              <p>No goals yet. Add a goal and link it to this objective.</p>
            ) : (
              <ul className="gol-phone-card">
                {linkedGoals.map((linked) => (
                  <li key={linked.id} className="gol-phone-linked">
                    <ProgressRing percent={goalProgressPercent(linked)} />
                    <span>{linked.title}</span>
                    <span className="gol-phone-meta">
                      {formatCrtNumber(linked.current)}/{formatCrtNumber(linked.target)}
                      {linked.unit ? ` ${linked.unit}` : ""}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section>
            <h3>Contributing actions ({contributingActions.length})</h3>
            {contributingActions.length === 0 ? (
              <p>No completed actions yet. Mark tasks as contributing to this objective when you finish them.</p>
            ) : (
              <ul className="gol-phone-card gol-phone-actions-list">
                {contributingActions.slice(0, 50).map((task) => (
                  <li key={task.id}>
                    <span>{itemTitle(task)}</span>
                    <span className="gol-phone-meta">{task.completedDate ? safeDateFormat(task.completedDate) : ""}</span>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section>
            <h3>Review this objective</h3>
            <div className="gol-phone-filters" role="group" aria-label="Review period">
              {PRIORITY_PERIODS.map((period) => (
                <button
                  data-no95
                  key={period}
                  type="button"
                  className="gol-phone-filter"
                  aria-pressed={reviewPeriod === period}
                  onClick={() => {
                    setReviewPeriod(period)
                    const review = (objective.reviews ?? []).find((item) => item.id === `${period}:${periodKeyFor(period)}`)
                    setReviewText(review?.summary ?? "")
                  }}
                >
                  {PERIOD_LABELS[period]}
                </button>
              ))}
            </div>
            <p>
              {PERIOD_LABELS[reviewPeriod]} {periodKeyFor(reviewPeriod)} — analyze your success furthering this objective.
            </p>
            <textarea
              value={reviewText || existingReview?.summary || ""}
              onChange={(e) => setReviewText(e.target.value)}
              rows={4}
              placeholder="What actions contributed? How successful were you? What's next?"
              aria-label="Review"
            />
            <button
              data-no95
              type="button"
              className="gol-phone-primary"
              onClick={() => saveObjectiveReview(objective.id, reviewPeriod, periodKeyFor(reviewPeriod), reviewText)}
              disabled={!reviewText.trim()}
            >
              Save review
            </button>
            {(objective.reviews ?? []).length > 0 && (
              <div className="gol-phone-past">
                <p>Past reviews</p>
                {(objective.reviews ?? [])
                  .slice()
                  .sort((a, b) => new Date(b.completedAt).getTime() - new Date(a.completedAt).getTime())
                  .map((review) => (
                    <p key={review.id}>
                      <strong>{review.id}</strong>: {review.summary}
                    </p>
                  ))}
              </div>
            )}
          </section>

          <div className="gol-phone-danger">
            <button data-no95 type="button" onClick={() => updateObjective({ ...objective, archived: !objective.archived })}>
              {objective.archived ? "Unarchive" : "Archive"}
            </button>
            <button
              data-no95
              type="button"
              onClick={() => {
                if (window.confirm(`Delete objective "${objective.title}"?`)) {
                  deleteObjective(objective.id)
                  onClose()
                }
              }}
            >
              Delete
            </button>
          </div>
        </div>
      </PhoneSheet>
      <UnsavedChangesDialog {...guard.prompt} />
    </>
  )
}
