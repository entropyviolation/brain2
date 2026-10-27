/**
 * components/Home/Goals/goals-phone.tsx — phone Goals
 *
 * A grouped list with a sticky bar, a period pager, progress rings, and
 * bottom sheets. Mounted only when `useGoalsPhone` is true. The desktop
 * fascia stays in `goals-tracker.tsx`.
 */
"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { format } from "date-fns"
import { useGoalsStore, taskObjectiveMultiplier } from "@/lib/goals-store"
import { pointsRuleValue } from "@/lib/points-rules-live"
import { usePointsStore } from "@/lib/points-store"
import { useTaskStore } from "@/lib/task-store"
import {
  periodKeyFor,
  isObjectivePrioritized,
  prioritizedObjectives,
  goalProgressPercent,
  MAX_PRIORITIES_PER_PERIOD,
  directionReport,
  type ActionRecord,
} from "@/lib/objectives"
import { APP_NAV_KEYS } from "@/lib/app-navigation"
import { usePersistedTab } from "@/lib/use-persisted-tab"
import { formatCrtNumber } from "@/lib/crt-number"
import { parseLocalDate } from "@/lib/date-utils"
import { UnsavedChangesDialog, useUnsavedGuard } from "@/components/ui/unsaved-changes-guard"
import type { Goal, Objective, PriorityPeriod, Task } from "@/lib/types"
import { useGoalsReducedMotion } from "./use-goals-phone"
import {
  GOAL_FILTERS,
  PERIOD_LABELS,
  PRIORITY_PERIODS,
  VIEW_MODES,
  activePriorities,
  goalFilterLabel,
  type GoalFilter,
  type ViewMode,
} from "./goals-phone-shared"
import { GoalPhoneSheet, ObjectivePhoneSheet, PhoneSheet } from "./goals-phone-sheets"
import { ProgressRing } from "./goals-phone-ring"
import "./goals-phone.css"

const WINDOW_DAYS = 30
const STALE_DAYS = 14

function taskCompletionDate(task: Task): Date | undefined {
  if (task.completedDate) return new Date(task.completedDate)
  if (task.completionReview?.completedAt) return new Date(task.completionReview.completedAt)
  const chunks = task.completedChunks ?? []
  if (chunks.length) {
    const last = chunks[chunks.length - 1]
    if (last?.date) return new Date(last.date)
  }
  if (task.scheduledDate) return new Date(task.scheduledDate)
  return task.createdAt ? new Date(task.createdAt) : undefined
}

function toActionRecords(tasks: Task[]): ActionRecord[] {
  return tasks.map((task) => {
    const contributed = [...(task.contributesToObjectiveIds ?? []), ...(task.contributesToGoalIds ?? [])].map((targetId) => ({
      id: `contrib-${task.id}-${targetId}`,
      relation: "action-of",
      targetId,
    }))
    return {
      id: task.id,
      completed: !!task.completed,
      completedDate: taskCompletionDate(task),
      links: [...(task.links ?? []), ...contributed],
    }
  })
}

function formatDriftDay(key: string): string {
  const date = parseLocalDate(key)
  return date ? format(date, "MMM d") : key
}

function PriorityMarks({ objective }: { objective: Objective }) {
  const marks = activePriorities(objective).sort(
    (a, b) => PRIORITY_PERIODS.indexOf(a.period) - PRIORITY_PERIODS.indexOf(b.period),
  )
  if (marks.length === 0) return null
  return (
    <span className="gol-phone-marks">
      {marks.map((mark) => (
        <span key={`${mark.period}-${mark.periodKey}`} className="gol-phone-mark">
          {PERIOD_LABELS[mark.period]} ×{mark.multiplier}
        </span>
      ))}
    </span>
  )
}

export function GoalsPhone() {
  const reduced = useGoalsReducedMotion()
  const objectives = useGoalsStore((s) => s.objectives)
  const goals = useGoalsStore((s) => s.goals)
  const tasks = useTaskStore((s) => s.tasks)
  const addObjective = useGoalsStore((s) => s.addObjective)
  const setObjectivePriority = useGoalsStore((s) => s.setObjectivePriority)
  const clearObjectivePriority = useGoalsStore((s) => s.clearObjectivePriority)
  const setGoalProgress = useGoalsStore((s) => s.setGoalProgress)
  const addTask = useTaskStore((s) => s.addTask)
  const addPoints = usePointsStore((s) => s.addPoints)

  const [mode, setMode] = usePersistedTab(APP_NAV_KEYS.homeGoalsPeriod, VIEW_MODES, "week")
  const [filter, setFilter] = usePersistedTab(APP_NAV_KEYS.homeGoalsFilter, GOAL_FILTERS, "all")
  const [listOpen, setListOpen] = useState(false)
  const [compact, setCompact] = useState(false)
  const [openId, setOpenId] = useState<string | null>(null)
  const [goalSheet, setGoalSheet] = useState<Goal | "add" | null>(null)
  const [showAddObjective, setShowAddObjective] = useState(false)
  const [newTitle, setNewTitle] = useState("")
  const [newDesc, setNewDesc] = useState("")
  const [shift, setShift] = useState(0)
  const [dragging, setDragging] = useState(false)

  const titleRef = useRef<HTMLHeadingElement>(null)
  const pagerRef = useRef<HTMLDivElement>(null)
  const modeRef = useRef(mode)
  modeRef.current = mode
  const shiftRef = useRef(0)

  const active = useMemo(() => objectives.filter((o) => !o.archived), [objectives])
  const activeCount = active.length
  const visibleGoals = filter === "all" ? goals : goals.filter((goal) => goal.periodKind === filter)
  const objectiveTitle = (id: string) => objectives.find((o) => o.id === id)?.title ?? "?"

  const report = useMemo(
    () => directionReport(goals, objectives, toActionRecords(tasks), { days: WINDOW_DAYS, staleDays: STALE_DAYS }),
    [goals, objectives, tasks],
  )

  useEffect(() => {
    const node = titleRef.current
    if (!node || typeof IntersectionObserver === "undefined") return
    const observer = new IntersectionObserver(
      ([entry]) => setCompact(!entry.isIntersecting),
      { root: null, threshold: 0, rootMargin: "-48px 0px 0px 0px" },
    )
    observer.observe(node)
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    const el = pagerRef.current
    if (!el) return
    let pointerId: number | null = null
    let x0 = 0
    let y0 = 0
    let lock: "h" | "v" | null = null

    const down = (event: PointerEvent) => {
      if (event.button !== 0) return
      pointerId = event.pointerId
      x0 = event.clientX
      y0 = event.clientY
      lock = null
    }
    const move = (event: PointerEvent) => {
      if (pointerId !== event.pointerId) return
      const dx = event.clientX - x0
      const dy = event.clientY - y0
      if (!lock) {
        if (Math.abs(dx) < 10 && Math.abs(dy) < 10) return
        lock = Math.abs(dx) > Math.abs(dy) ? "h" : "v"
        if (lock === "v") return
        setDragging(true)
        el.setPointerCapture?.(event.pointerId)
      }
      if (lock !== "h") return
      const index = VIEW_MODES.indexOf(modeRef.current)
      let x = dx
      if ((index <= 0 && x > 0) || (index >= VIEW_MODES.length - 1 && x < 0)) x *= 0.35
      shiftRef.current = x
      setShift(x)
    }
    const up = (event: PointerEvent) => {
      if (pointerId !== event.pointerId) return
      pointerId = null
      const index = VIEW_MODES.indexOf(modeRef.current)
      const x = lock === "h" ? shiftRef.current : 0
      let next = index
      if (lock === "h" && x <= -56 && index < VIEW_MODES.length - 1) next = index + 1
      else if (lock === "h" && x >= 56 && index > 0) next = index - 1
      lock = null
      setDragging(false)
      requestAnimationFrame(() => {
        if (next !== index) setMode(VIEW_MODES[next])
        shiftRef.current = 0
        setShift(0)
      })
    }
    el.addEventListener("pointerdown", down)
    el.addEventListener("pointermove", move)
    el.addEventListener("pointerup", up)
    el.addEventListener("pointercancel", up)
    return () => {
      el.removeEventListener("pointerdown", down)
      el.removeEventListener("pointermove", move)
      el.removeEventListener("pointerup", up)
      el.removeEventListener("pointercancel", up)
    }
  }, [setMode])

  const capLabel =
    mode === "all"
      ? `${active.filter((o) => activePriorities(o).length > 0).length} prioritized`
      : `${prioritizedObjectives(active, mode).length}/${MAX_PRIORITIES_PER_PERIOD[mode]} this ${mode}`

  const quickToggle = (objective: Objective, period: PriorityPeriod) => {
    const key = periodKeyFor(period)
    if (isObjectivePrioritized(objective, period)) {
      clearObjectivePriority(objective.id, period, key)
      return
    }
    if (prioritizedObjectives(active, period).length >= MAX_PRIORITIES_PER_PERIOD[period]) {
      window.alert(`You can prioritize at most ${MAX_PRIORITIES_PER_PERIOD[period]} objectives per ${period}.`)
      return
    }
    setObjectivePriority(objective.id, {
      period,
      periodKey: key,
      multiplier: pointsRuleValue("objective.prioritySeedMultiplier"),
    })
  }

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
    const points = Math.round(pointsRuleValue("goal.actionBasePoints") * multiplier * 100) / 100
    if (points > 0) addPoints(id, points, `Goal action: ${goal.title}`, now)
  }

  const handleAddObjective = () => {
    if (!newTitle.trim()) return
    addObjective({ title: newTitle.trim(), description: newDesc.trim() || undefined })
    setNewTitle("")
    setNewDesc("")
    setShowAddObjective(false)
  }

  const addGuard = useUnsavedGuard({
    open: showAddObjective,
    onOpenChange: (next) => {
      setShowAddObjective(next)
      if (!next) {
        setNewTitle("")
        setNewDesc("")
      }
    },
    isDirty: newTitle.trim() !== "" || newDesc.trim() !== "",
    onSave: () => {
      if (!newTitle.trim()) return false
      handleAddObjective()
    },
    onDiscard: () => {
      setNewTitle("")
      setNewDesc("")
    },
  })

  const index = VIEW_MODES.indexOf(mode)
  const trackStyle = {
    width: `${VIEW_MODES.length * 100}%`,
    transform: `translate3d(calc(${-index * (100 / VIEW_MODES.length)}% + ${shift}px), 0, 0)`,
  }

  return (
    <div
      className={`gol-phone${reduced ? " is-reduced" : ""}`}
      data-ui-name="Goals"
      data-goals-layout="phone"
      data-ui-help="Objectives to prioritize, measurable goals, and a direction report."
      data-ui-docs="components/Home/Goals/README.md"
    >
      <header className="gol-phone-bar">
        <span className={`gol-phone-bar-title${compact ? " is-on" : ""}`}>Goals</span>
        <span className={`gol-phone-bar-count${compact ? "" : " is-on"}`}>
          {activeCount} objective{activeCount === 1 ? "" : "s"} · {goals.length} goal{goals.length === 1 ? "" : "s"}
        </span>
      </header>

      <div className="gol-phone-body">
        <h1 ref={titleRef} className="gol-phone-large">
          Goals
        </h1>
        <p className="gol-phone-note">Directions, then the numbers that move them.</p>

        <section className="gol-phone-block" aria-label="Objectives">
          <div className="gol-phone-block-head">
            <h2>Objectives</h2>
            <button data-no95 type="button" className="gol-phone-text-btn" onClick={() => setShowAddObjective(true)}>
              Add Objective
            </button>
          </div>
          <p className="gol-phone-note">Your all-time directions. Prioritize a few per period to multiply points.</p>
          <div className="gol-phone-seg" role="group" aria-label="Objective period">
            {VIEW_MODES.map((item) => (
              <button
                data-no95
                key={item}
                type="button"
                aria-pressed={mode === item}
                onClick={() => setMode(item)}
              >
                {item === "all" ? "All" : PERIOD_LABELS[item]}
              </button>
            ))}
          </div>
          <p className="gol-phone-cap" aria-live="polite">
            {capLabel}
          </p>

          <div
            className={`gol-phone-pager${dragging ? " is-drag" : ""}`}
            ref={pagerRef}
            data-testid="goals-phone-pager"
          >
            <div className="gol-phone-track" style={trackStyle}>
              {VIEW_MODES.map((page) => (
                <PeriodPage
                  key={page}
                  page={page}
                  width={`${100 / VIEW_MODES.length}%`}
                  active={active}
                  hidden={page !== mode}
                  listOpen={listOpen}
                  onToggleList={() => setListOpen((open) => !open)}
                  onOpen={setOpenId}
                  onToggle={quickToggle}
                  goalCount={(id) => goals.filter((goal) => goal.objectiveIds.includes(id)).length}
                />
              ))}
            </div>
          </div>
        </section>

        <section className="gol-phone-block" aria-label="Goals">
          <div className="gol-phone-block-head">
            <h2>Goals</h2>
            <button data-no95 type="button" className="gol-phone-text-btn" onClick={() => setGoalSheet("add")}>
              Add Goal
            </button>
          </div>
          <p className="gol-phone-note">Quantifiable metrics that move your objectives forward.</p>
          <div className="gol-phone-filters" role="group" aria-label="Goal period">
            {GOAL_FILTERS.map((item) => (
              <button
                data-no95
                key={item}
                type="button"
                className="gol-phone-filter"
                aria-pressed={filter === item}
                onClick={() => setFilter(item as GoalFilter)}
              >
                {goalFilterLabel(item)}
              </button>
            ))}
          </div>
          <div className="gol-phone-stack">
            {visibleGoals.map((goal) => (
              <article key={goal.id} className={`gol-phone-goal${goal.completed ? " is-done" : ""}`}>
                <div className="gol-phone-goal-main">
                  <ProgressRing percent={goalProgressPercent(goal)} done={goal.completed} />
                  <div className="gol-phone-goal-copy">
                    <h3>{goal.title}</h3>
                    <p className="gol-phone-meta">
                      {formatCrtNumber(goal.current)} / {formatCrtNumber(goal.target)}
                      {goal.unit ? ` ${goal.unit}` : ""}
                      {" · "}
                      {goalFilterLabel(goal.periodKind)}
                      {goal.periodLabel ? ` · ${goal.periodLabel}` : ""}
                    </p>
                    {goal.objectiveIds.length > 0 && (
                      <p className="gol-phone-marks">
                        {goal.objectiveIds.map((id) => (
                          <span key={id} className="gol-phone-mark">
                            {objectiveTitle(id)}
                          </span>
                        ))}
                      </p>
                    )}
                  </div>
                </div>
                <div className="gol-phone-goal-actions">
                  {goal.completed ? (
                    <span className="gol-phone-done">Completed — {formatCrtNumber(goal.points)} pts</span>
                  ) : goal.type === "boolean" ? (
                    <button data-no95 type="button" className="gol-phone-primary" onClick={() => setGoalProgress(goal.id, 1)}>
                      Mark complete (+{formatCrtNumber(goal.points)} pts)
                    </button>
                  ) : (
                    <>
                      <button
                        data-no95
                        type="button"
                        className="gol-phone-step"
                        onClick={() => setGoalProgress(goal.id, Math.max(0, goal.current - 1))}
                      >
                        -1
                      </button>
                      <button data-no95 type="button" className="gol-phone-step is-plus" onClick={() => setGoalProgress(goal.id, goal.current + 1)}>
                        +1
                      </button>
                      <button data-no95 type="button" className="gol-phone-step" onClick={() => logAction(goal)} title="Record a completed action + earn objective points">
                        Log
                      </button>
                    </>
                  )}
                  <button data-no95 type="button" className="gol-phone-step" onClick={() => setGoalSheet(goal)}>
                    Edit
                  </button>
                </div>
              </article>
            ))}
            {visibleGoals.length === 0 && <p className="gol-phone-empty">No goals here yet. Add one and link it to an objective.</p>}
          </div>
        </section>

        <DirectionBlock report={report} />
      </div>

      {showAddObjective && (
        <PhoneSheet title="New Objective" uiName="New Objective" onRequestClose={addGuard.requestClose}>
          <div className="gol-phone-form">
            <label>
              Title
              <input value={newTitle} onChange={(e) => setNewTitle(e.target.value)} placeholder="e.g., Read a lot" />
            </label>
            <label>
              Description
              <textarea value={newDesc} onChange={(e) => setNewDesc(e.target.value)} rows={3} />
            </label>
            <button data-no95 type="button" className="gol-phone-primary" onClick={handleAddObjective} disabled={!newTitle.trim()}>
              Add Objective
            </button>
          </div>
        </PhoneSheet>
      )}
      <UnsavedChangesDialog {...addGuard.prompt} />
      {openId && <ObjectivePhoneSheet objectiveId={openId} onClose={() => setOpenId(null)} />}
      {goalSheet && (
        <GoalPhoneSheet
          key={goalSheet === "add" ? "add" : goalSheet.id}
          goal={goalSheet === "add" ? null : goalSheet}
          onClose={() => setGoalSheet(null)}
        />
      )}
    </div>
  )
}

function PeriodPage({
  page,
  width,
  active,
  hidden,
  listOpen,
  onToggleList,
  onOpen,
  onToggle,
  goalCount,
}: {
  page: ViewMode
  width: string
  active: Objective[]
  hidden: boolean
  listOpen: boolean
  onToggleList: () => void
  onOpen: (id: string) => void
  onToggle: (objective: Objective, period: PriorityPeriod) => void
  goalCount: (id: string) => number
}) {
  const prioritized = page === "all" ? active.filter((o) => activePriorities(o).length > 0) : prioritizedObjectives(active, page)
  const heading = page === "all" ? "Prioritized (all periods)" : `Prioritized · ${PERIOD_LABELS[page]}`

  return (
    <div className="gol-phone-page" style={{ width, flexBasis: width }} aria-hidden={hidden} inert={hidden ? true : undefined}>
      <h3 className="gol-phone-kicker">{heading}</h3>
      {prioritized.length === 0 ? (
        <p className="gol-phone-empty">
          {page === "all"
            ? "No objectives prioritized for any period yet."
            : `Nothing prioritized this ${page}. Star an objective below to focus it.`}
        </p>
      ) : (
        <ul className="gol-phone-card">
          {prioritized.map((objective) => (
            <li key={objective.id} className="gol-phone-obj is-prio">
              <button data-no95 type="button" className="gol-phone-obj-name" onClick={() => onOpen(objective.id)}>
                <span>{objective.title}</span>
                <PriorityMarks objective={objective} />
              </button>
              {page !== "all" && (
                <button
                  data-no95
                  type="button"
                  className="gol-phone-star is-on"
                  aria-label="Remove priority"
                  onClick={() => onToggle(objective, page)}
                >
                  ★
                </button>
              )}
            </li>
          ))}
        </ul>
      )}

      <button data-no95 type="button" className="gol-phone-disclose" aria-expanded={listOpen} onClick={onToggleList}>
        <span aria-hidden>{listOpen ? "▾" : "▸"}</span>
        All objectives
        <span className="gol-phone-meta">({active.length})</span>
      </button>
      {listOpen && (
        <ul className="gol-phone-card">
          {active.map((objective) => {
            const isPrio = page !== "all" && isObjectivePrioritized(objective, page)
            const count = goalCount(objective.id)
            return (
              <li key={objective.id} className={`gol-phone-obj${isPrio ? " is-prio" : ""}`}>
                {page !== "all" && (
                  <button
                    data-no95
                    type="button"
                    className={`gol-phone-star${isPrio ? " is-on" : ""}`}
                    aria-label={isPrio ? "Remove priority" : `Prioritize for this ${page}`}
                    onClick={() => onToggle(objective, page)}
                  >
                    {isPrio ? "★" : "☆"}
                  </button>
                )}
                <button data-no95 type="button" className="gol-phone-obj-name" onClick={() => onOpen(objective.id)}>
                  <span>{objective.title}</span>
                  <PriorityMarks objective={objective} />
                  <span className="gol-phone-meta">
                    {count} {count === 1 ? "goal" : "goals"}
                  </span>
                </button>
              </li>
            )
          })}
          {active.length === 0 && <li className="gol-phone-empty">No objectives yet.</li>}
        </ul>
      )}
    </div>
  )
}

function DirectionBlock({ report }: { report: ReturnType<typeof directionReport> }) {
  return (
    <section className="gol-phone-block" aria-label="Direction in Life">
      <h2>Direction in Life</h2>
      <p className="gol-phone-note">Did the last {WINDOW_DAYS} days move your goals forward? Recomputed from your task links.</p>
      <div className="gol-phone-coverage">
        <div className="gol-phone-dial">
          <ProgressRing percent={report.coverageScore} size={88} stroke={7} />
          <span>{report.coverageScore === null ? "—" : `${report.coverageScore}%`}</span>
        </div>
        <div>
          <p className="gol-phone-kicker">Coverage · last {WINDOW_DAYS} days</p>
          <p className="gol-phone-coverage-line">
            {report.directedDays}/{report.activeDays} active days served a goal
          </p>
          <p className="gol-phone-meta">
            {report.driftDays.length} drift · {report.staleGoals.length} neglected
          </p>
        </div>
      </div>
      <div className="gol-phone-tape" role="img" aria-label="Last 30 days: served, drift, or idle">
        {report.days.map((day) => {
          const kind = day.servedCount > 0 ? " is-served" : day.completedCount > 0 ? " is-drift" : ""
          return <i key={day.key} className={kind} title={`${day.key}: ${day.servedCount}/${day.completedCount} served`} />
        })}
      </div>
      <p className="gol-phone-key">
        <span><i className="is-served" /> served</span>
        <span><i className="is-drift" /> drift</span>
        <span><i /> idle</span>
      </p>
      <div className="gol-phone-split">
        <div>
          <h3 className="gol-phone-kicker">Drift days ({report.driftDays.length})</h3>
          {report.driftDays.length === 0 ? (
            <p className="gol-phone-note">No drift days — all your work served a goal.</p>
          ) : (
            <ul className="gol-phone-dates">
              {report.driftDays.map((key) => (
                <li key={key} title={key}>
                  {formatDriftDay(key)}
                </li>
              ))}
            </ul>
          )}
        </div>
        <div>
          <h3 className="gol-phone-kicker">Neglected goals ({report.staleGoals.length})</h3>
          {report.staleGoals.length === 0 ? (
            <p className="gol-phone-note">Every active goal has a recent linked action.</p>
          ) : (
            <ul className="gol-phone-card">
              {report.staleGoals.map(({ goal, daysSinceLastAction, hasAnyAction }) => (
                <li key={goal.id} className="gol-phone-neglected">
                  <span>{goal.title}</span>
                  <span className="gol-phone-meta">{hasAnyAction ? `${daysSinceLastAction}d ago` : "never"}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </section>
  )
}
