/**
 * components/Home/ToDo/SessionPlanner.tsx — Plan a session, run it, review it
 *
 * One popup (`data-ui-name="Session"`) over `lib/session-plan.ts`:
 * - **Draft**: a flat pick list of every open task and step (this period, or
 *   all open), three tier wells (Bare minimum / Goal / Exceptional), a duration,
 *   and a fit gauge per tier. Bare minimum must be estimated before Start.
 *   **Break down** opens the lid's steps editor for a task in place.
 * - **Run**: the countdown, tier lamps, and the current line with its next step
 *   (Just Start's picker). Step done / Line done / Skip / Just start, and
 *   optionally the Tracking pen clock on the current step.
 * - **Review**: estimate vs actual per line, the tier reached and its points,
 *   and what to do with each unfinished line (keep for next session, push,
 *   leave). Save writes a Plan block for the session and files it in history.
 * - **Park** (slice H): the run view's Park key, or **Park** when closing a
 *   running session, puts it down with its line and time left. Starting or
 *   resuming another parks the running one. **Sessions** (caption and fascia)
 *   opens the shelves: Drafts, Parked, Done; a done one opens read-only and
 *   offers **Run again**.
 */
"use client"

import { useEffect, useMemo, useState, type ReactNode } from "react"
import { createPortal } from "react-dom"
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog"
import type { Task } from "@/lib/types"
import { useTaskStore } from "@/lib/task-store"
import { liveSession, useSessionPlanStore } from "@/lib/session-plan-store"
import {
  SESSION_DURATION_PRESETS,
  SESSION_TIERS,
  addLine,
  allLines,
  cannotStartReason,
  closeSession,
  emptySession,
  endSession,
  extendSession,
  finishLine,
  focusLine,
  keptRefs,
  lineFocusStep,
  lineIsBlocked,
  lineIsDone,
  lineLabel,
  lineMinutes,
  lineSeconds,
  lineTarget,
  lineUnestimated,
  missingPrereqs,
  moveLine,
  nextLine,
  nudgeLine,
  orderByPrereqs,
  parkSession,
  parkedLong,
  pauseSession,
  ranMinutes,
  resumeParked,
  runAgain,
  sessionTimeLogs,
  remainingSec,
  removeLine,
  resumeSession,
  sessionFit,
  setLineOutcome,
  startSession,
  tierReached,
  type SessionLine,
  type SessionPlan,
  type SessionTier,
} from "@/lib/session-plan"
import { placeSteps } from "@/lib/next-step"
import { isStepAvailable } from "@/lib/prereqs"
import { hasUnmetDependencies } from "@/lib/available-tasks"
import { isClearedFromWork } from "@/lib/completion-status"
import { itemTitleOrUntitled } from "@/lib/item-utils"
import { finishStep } from "@/lib/next-step"
import { updateNestedStep } from "@/lib/todo-steps"
import { activeTierPoints } from "@/lib/completion-tiers"
import { usePointsStore } from "@/lib/points-store"
import { usePlannedActionStore } from "@/lib/planned-action-store"
import { placementFromDrop } from "@/lib/planned-actions"
import { formatLocalDateKey } from "@/lib/date-utils"
import { completeTask } from "@/lib/services/completion-service"
import { pushTask } from "@/lib/services/scheduling-service"
import { usePenColorSessionStore } from "@/lib/pen-color-session-store"
import { togglePenColorNowObjectiveComplete } from "@/lib/pen-color-session"
import { activeNowObjectives } from "@/lib/now-objective"
import { stopTaskClock } from "@/lib/task-clock"
import { useTaskClockStarter } from "@/components/Focus/TaskClockStarter"
import JustStartMode from "@/components/Focus/JustStartMode"
import { TodoBreakdown } from "./TodoBreakdown"
import { useTodoTime } from "./use-todo-time"
import "./session-planner.css"

const TIER_LABEL: Record<SessionTier, string> = { min: "Bare minimum", goal: "Goal", exceptional: "Exceptional" }
const TIER_SHORT: Record<SessionTier, string> = { min: "Min", goal: "Goal", exceptional: "Exc" }

export function fmtMinutes(minutes: number): string {
  const m = Math.max(0, Math.round(minutes))
  if (m < 60) return `${m}m`
  const h = Math.floor(m / 60)
  const r = m % 60
  return r ? `${h}h ${r}m` : `${h}h`
}

export function fmtClock(seconds: number): string {
  const over = seconds < 0
  const abs = Math.abs(Math.round(seconds))
  const h = Math.floor(abs / 3600)
  const m = Math.floor((abs % 3600) / 60)
  const s = abs % 60
  const body = h ? `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}` : `${m}:${String(s).padStart(2, "0")}`
  return over ? `+${body}` : body
}

function useNow(active: boolean): Date {
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    if (!active) return
    const id = window.setInterval(() => setNow(new Date()), 1000)
    return () => window.clearInterval(id)
  }, [active])
  return now
}

export function SessionPlanner({
  open,
  onClose,
  periodTasks,
  periodLabel,
  startOn = "session",
}: {
  open: boolean
  onClose: () => void
  /** Open tasks on the To Do lens right now. */
  periodTasks: Task[]
  periodLabel: string
  /** `shelves` opens on the Sessions history panel. */
  startOn?: "session" | "shelves"
}) {
  const tasks = useTaskStore((s) => s.tasks)
  const openPlans = useSessionPlanStore((s) => s.open)
  const focusId = useSessionPlanStore((s) => s.focusId)
  const history = useSessionPlanStore((s) => s.history)
  const [view, setView] = useState<"session" | "shelves">(startOn)
  const [doneId, setDoneId] = useState<string | null>(null)
  const [asking, setAsking] = useState(false)

  // Opening shows the live session, else the focused one, else a new draft
  // seeded with lines kept from last time. Only on open: a session saved while
  // the popup is still up must not spawn a new draft.
  useEffect(() => {
    if (!open || startOn === "shelves") return
    const store = useSessionPlanStore.getState()
    const live = liveSession(store.open)
    if (live) {
      store.focus(live.id)
      return
    }
    if (store.focusId && store.open.some((p) => p.id === store.focusId)) return
    newDraft()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  const plan = openPlans.find((p) => p.id === focusId) ?? null
  const done = doneId ? history.find((p) => p.id === doneId) : undefined
  const update = (next: SessionPlan) => putSession(next)

  const requestClose = () => {
    if (plan?.phase === "run") setAsking(true)
    else onClose()
  }
  const parkAndClose = () => {
    if (plan) putSession(parkSession(plan, new Date()), [plan])
    setAsking(false)
    onClose()
  }
  const showShelves = () => {
    setDoneId(null)
    if (view === "shelves" && !plan) newDraft()
    setView(view === "shelves" ? "session" : "shelves")
  }
  const openFromShelf = (id: string) => {
    useSessionPlanStore.getState().focus(id)
    setDoneId(null)
    setView("session")
  }

  const title =
    view === "shelves"
      ? done
        ? `Session · ${done.title}`
        : "Sessions"
      : plan?.phase === "run"
        ? `Session · ${plan.title}`
        : plan?.phase === "parked"
          ? `Parked · ${plan.title}`
          : plan?.phase === "review"
            ? "Session review"
            : "Plan a session"

  return (
    <Dialog open={open} onOpenChange={(next) => !next && requestClose()}>
      <DialogContent
        className="todo95-dialog todo-session"
        hideClose
        aria-describedby={undefined}
        data-ui-name="Session"
        data-ui-help="Plan a time box in three tiers, work it with a clock, and review it."
        data-ui-docs="components/Home/ToDo/README.md"
      >
        <div className="todo-dialog-caption">
          <DialogTitle>{title}</DialogTitle>
          <span className="todo-session-caption-keys">
            <button type="button" className={`todo-verb${view === "shelves" ? " is-on" : ""}`} aria-pressed={view === "shelves"} onClick={showShelves}>
              Sessions
            </button>
            <button type="button" className="todo-session-close" aria-label="Close" onClick={requestClose}>
              ×
            </button>
          </span>
        </div>
        {asking ? (
          <div className="todo-session-ask" role="alertdialog" aria-label="The session is running">
            <span>The session is still running.</span>
            <button type="button" className="todo-btn is-primary" onClick={parkAndClose}>
              Park
            </button>
            <button
              type="button"
              className="todo-btn"
              onClick={() => {
                setAsking(false)
                onClose()
              }}
            >
              Keep running
            </button>
          </div>
        ) : null}
        <div className="todo-dialog-body todo-session-body">
          {view === "shelves" ? (
            done ? (
              <DoneView plan={done} tasks={tasks} onBack={() => setDoneId(null)} onRunAgain={() => openFromShelf(putSession(runAgain(done, new Date())))} />
            ) : (
              <ShelvesView
                open={openPlans}
                history={history}
                tasks={tasks}
                onOpen={openFromShelf}
                onOpenDone={setDoneId}
                onRunAgain={(p) => openFromShelf(putSession(runAgain(p, new Date())))}
                onNew={() => {
                  newDraft()
                  setView("session")
                }}
              />
            )
          ) : !plan ? null : plan.phase === "draft" ? (
            <DraftView plan={plan} tasks={tasks} history={history} periodTasks={periodTasks} periodLabel={periodLabel} onChange={update} />
          ) : plan.phase === "run" ? (
            <RunView plan={plan} tasks={tasks} onChange={update} />
          ) : plan.phase === "parked" ? (
            <ParkedView plan={plan} tasks={tasks} onChange={update} onShelves={showShelves} />
          ) : (
            <ReviewView plan={plan} tasks={tasks} onDone={onClose} />
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}

/** A new draft, seeded with what the last review kept, and focused. */
function newDraft(): void {
  const store = useSessionPlanStore.getState()
  let plan = emptySession(new Date())
  for (const ref of store.kept) plan = addLine(plan, ref.tier, ref, useTaskStore.getState().tasks)
  store.put(plan)
  store.focus(plan.id)
  store.clearKept()
}

/**
 * Store a session. A session parked to make room (or parked by hand, passed
 * as `parking`) lets go of the Tracking pen clock if it was painting there;
 * the time so far is written as on Stop. Returns the id.
 */
function putSession(next: SessionPlan, parking: SessionPlan[] = []): string {
  const bumped = useSessionPlanStore.getState().put(next, new Date())
  const pen = usePenColorSessionStore.getState().session
  for (const p of [...parking, ...bumped]) {
    if (p.paint && pen?.taskId && allLines(p).some(({ line }) => line.taskId === pen.taskId)) stopTaskClock()
  }
  return next.id
}

// ---- Draft --------------------------------------------------------------------

function TierKeys({
  inTier,
  onPick,
  label,
}: {
  inTier?: SessionTier
  onPick: (tier: SessionTier) => void
  label: string
}) {
  return (
    <span className="todo-session-tierkeys" role="group" aria-label={`Add ${label} to`}>
      {SESSION_TIERS.map(({ id }) => (
        <button
          key={id}
          type="button"
          data-no95
          className={`todo-session-tierkey is-${id}${inTier === id ? " is-on" : ""}`}
          aria-pressed={inTier === id}
          title={`${TIER_LABEL[id]}: ${label}`}
          onClick={() => onPick(id)}
        >
          {TIER_SHORT[id]}
        </button>
      ))}
    </span>
  )
}

function DraftView({
  plan,
  tasks,
  periodTasks,
  periodLabel,
  onChange,
}: {
  plan: SessionPlan
  tasks: Task[]
  history: SessionPlan[]
  periodTasks: Task[]
  periodLabel: string
  onChange: (plan: SessionPlan) => void
}) {
  const updateTask = useTaskStore((s) => s.updateTask)
  const [scope, setScope] = useState<"period" | "all">("period")
  const [query, setQuery] = useState("")
  const [onlyBare, setOnlyBare] = useState(false)
  const [onlyReady, setOnlyReady] = useState(false)
  const [openTasks, setOpenTasks] = useState<Set<string>>(() => new Set())
  const [breakdownId, setBreakdownId] = useState<string | null>(null)

  // Your own pace (`lib/estimate-pace.ts`): finished steps and closed lines, or your override.
  const todoTime = useTodoTime(tasks)
  const pace = todoTime.pace
  const fit = sessionFit(plan, tasks, pace)
  const reason = cannotStartReason(plan, tasks)
  const missing = missingPrereqs(plan, tasks)
  const tierOf = new Map(allLines(plan).map(({ line, tier }) => [`${line.taskId}|${line.stepId ?? ""}`, tier]))

  const source = useMemo(() => {
    const base = scope === "period" ? periodTasks : tasks.filter((t) => !t.completed && !isClearedFromWork(t))
    const live = base.map((t) => tasks.find((x) => x.id === t.id) ?? t).filter((t) => !t.completed)
    const needle = query.trim().toLowerCase()
    return live.filter((t) => {
      if (onlyReady && hasUnmetDependencies(t, tasks)) return false
      if (onlyBare && lineUnestimated({ taskId: t.id }, tasks) === 0) return false
      if (!needle) return true
      if (itemTitleOrUntitled(t).toLowerCase().includes(needle)) return true
      return placeSteps(t.subtasks).some((p) => p.step.description.toLowerCase().includes(needle))
    })
  }, [scope, periodTasks, tasks, query, onlyBare, onlyReady])

  const add = (tier: SessionTier, ref: { taskId: string; stepId?: string }) => onChange(addLine(plan, tier, ref, tasks))
  const setEstimate = (line: SessionLine, minutes: number) => {
    const { task, step } = lineTarget(line, tasks)
    if (!task) return
    if (step) updateTask({ ...task, subtasks: updateNestedStep(task.subtasks, step.id, { estimatedDuration: minutes }) })
    else updateTask({ ...task, estimatedDuration: minutes })
  }
  const breakdownTask = breakdownId ? tasks.find((t) => t.id === breakdownId) : undefined

  return (
    <div className="todo-session-draft">
      <div className="todo-session-head">
        <label className="todo-session-title">
          <span>Name</span>
          <input value={plan.title} aria-label="Session name" onChange={(e) => onChange({ ...plan, title: e.target.value })} />
        </label>
        <div className="todo-session-duration" role="group" aria-label="Length">
          <span>Length</span>
          {SESSION_DURATION_PRESETS.map((m) => (
            <button
              key={m}
              type="button"
              className={`todo-verb${plan.durationMin === m ? " is-on" : ""}`}
              aria-pressed={plan.durationMin === m}
              onClick={() => onChange({ ...plan, durationMin: m })}
            >
              {fmtMinutes(m)}
            </button>
          ))}
          <input
            type="number"
            min={5}
            step={5}
            aria-label="Length in minutes"
            value={plan.durationMin}
            onChange={(e) => onChange({ ...plan, durationMin: Math.max(0, Number(e.target.value) || 0) })}
          />
          <span className="todo-session-unit">min</span>
        </div>
      </div>

      <div className="todo-session-panes">
        <section className="todo-session-pick" aria-label="Pick list">
          <div className="todo-session-pick-bar">
            <select aria-label="Which tasks" value={scope} onChange={(e) => setScope(e.target.value as "period" | "all")}>
              <option value="period">{periodLabel}</option>
              <option value="all">All open tasks</option>
            </select>
            <input type="search" placeholder="Search tasks and steps" aria-label="Search pick list" value={query} onChange={(e) => setQuery(e.target.value)} />
            <label>
              <input type="checkbox" checked={onlyReady} onChange={(e) => setOnlyReady(e.target.checked)} /> Available now
            </label>
            <label>
              <input type="checkbox" checked={onlyBare} onChange={(e) => setOnlyBare(e.target.checked)} /> Unestimated
            </label>
          </div>
          <ul className="todo-session-picklist">
            {source.length === 0 ? <li className="todo-empty">Nothing open here.</li> : null}
            {source.map((task) => {
              const expanded = openTasks.has(task.id) || !!query.trim()
              const steps = placeSteps(task.subtasks).filter((p) => !p.step.completed)
              const blocked = hasUnmetDependencies(task, tasks)
              return (
                <li key={task.id} className="todo-session-pickrow">
                  <div className="todo-session-pickline">
                    {steps.length ? (
                      <button
                        type="button"
                        data-no95
                        className="todo-step-fold"
                        aria-expanded={expanded}
                        aria-label={expanded ? `Hide steps of ${itemTitleOrUntitled(task)}` : `Show steps of ${itemTitleOrUntitled(task)}`}
                        onClick={() =>
                          setOpenTasks((prev) => {
                            const next = new Set(prev)
                            if (next.has(task.id)) next.delete(task.id)
                            else next.add(task.id)
                            return next
                          })
                        }
                      >
                        {expanded ? "▾" : "▸"}
                      </button>
                    ) : (
                      <span className="todo-session-fold-gap" />
                    )}
                    <span className="todo-session-pickname">{itemTitleOrUntitled(task)}</span>
                    {blocked ? <span className="todo-row-lock">waits</span> : null}
                    <span className="todo-session-mins">{lineMinutes({ taskId: task.id }, tasks) ? fmtMinutes(lineMinutes({ taskId: task.id }, tasks)) : "–"}</span>
                    <TierKeys inTier={tierOf.get(`${task.id}|`)} label={itemTitleOrUntitled(task)} onPick={(tier) => add(tier, { taskId: task.id })} />
                  </div>
                  {expanded && steps.length ? (
                    <ul className="todo-session-picksteps">
                      {steps
                        .filter((p) => !query.trim() || p.step.description.toLowerCase().includes(query.trim().toLowerCase()) || itemTitleOrUntitled(task).toLowerCase().includes(query.trim().toLowerCase()))
                        .map(({ step, path }) => {
                          const ref = { taskId: task.id, stepId: step.id }
                          const mins = lineMinutes(ref, tasks)
                          return (
                            <li key={step.id} className="todo-session-pickline is-step" style={{ ["--todo-depth" as string]: path.length + 1 }}>
                              <span className="todo-session-pickname">{step.description}</span>
                              {!isStepAvailable(task.subtasks, step.id) ? <span className="todo-row-lock">waits</span> : null}
                              <span className="todo-session-mins">{mins ? fmtMinutes(mins) : "–"}</span>
                              <TierKeys inTier={tierOf.get(`${task.id}|${step.id}`)} label={step.description} onPick={(tier) => add(tier, ref)} />
                            </li>
                          )
                        })}
                    </ul>
                  ) : null}
                </li>
              )
            })}
          </ul>
        </section>

        <section className="todo-session-tiers" aria-label="Tiers">
          {fit.map((f) => {
            const lines = plan.tiers[f.tier]
            return (
              <div key={f.tier} className={`todo-session-tier is-${f.tier}`} data-band={f.band}>
                <div className="todo-session-tier-head">
                  <span className="todo-session-tier-name">{TIER_LABEL[f.tier]}</span>
                  <span className="todo-session-tier-sum">
                    {fmtMinutes(f.minutes)} · {fmtMinutes(f.cumulative)} of {fmtMinutes(plan.durationMin)}
                  </span>
                  <span className={`todo-session-band is-${f.band}`}>{f.band === "fits" ? "fits" : f.band === "tight" ? "tight" : "over"}</span>
                </div>
                <div className="todo-session-gauge" aria-hidden>
                  <span style={{ width: `${Math.min(100, Math.round(f.ratio * 100))}%` }} />
                </div>
                {f.unestimated ? (
                  <p className="todo-session-warn">
                    {f.unestimated === 1 ? "1 step has no estimate." : `${f.unestimated} steps have no estimate.`}
                  </p>
                ) : null}
                <ul className="todo-session-lines">
                  {lines.length === 0 ? <li className="todo-session-empty">Add from the list.</li> : null}
                  {lines.map((line, i) => {
                    const mins = lineMinutes(line, tasks)
                    const leafBare = mins === 0
                    return (
                      <li key={line.id} className={`todo-session-line${lineIsDone(line, tasks) ? " is-done" : ""}`}>
                        <span className="todo-session-line-name" title={lineLabel(line, tasks)}>
                          {lineLabel(line, tasks)}
                        </span>
                        {leafBare ? (
                          <input
                            className="todo-session-est"
                            type="number"
                            min={1}
                            placeholder="min"
                            aria-label={`Estimate for ${lineLabel(line, tasks)}`}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") {
                                const v = Number((e.target as HTMLInputElement).value)
                                if (v > 0) setEstimate(line, v)
                              }
                            }}
                            onBlur={(e) => {
                              const v = Number(e.target.value)
                              if (v > 0) setEstimate(line, v)
                            }}
                          />
                        ) : (
                          <span className="todo-session-mins">{fmtMinutes(mins)}</span>
                        )}
                        <button type="button" data-no95 className="todo-session-mini" aria-label="Move up" disabled={i === 0} onClick={() => onChange(nudgeLine(plan, line.id, -1))}>
                          ▲
                        </button>
                        <button
                          type="button"
                          data-no95
                          className="todo-session-mini"
                          aria-label="Move down"
                          disabled={i === lines.length - 1}
                          onClick={() => onChange(nudgeLine(plan, line.id, 1))}
                        >
                          ▼
                        </button>
                        <select aria-label="Tier" value={f.tier} onChange={(e) => onChange(moveLine(plan, line.id, e.target.value as SessionTier))}>
                          {SESSION_TIERS.map(({ id }) => (
                            <option key={id} value={id}>
                              {TIER_SHORT[id]}
                            </option>
                          ))}
                        </select>
                        <button type="button" data-no95 className="todo-session-mini" title="Break down" aria-label={`Break down ${lineLabel(line, tasks)}`} onClick={() => setBreakdownId(line.taskId)}>
                          ✎
                        </button>
                        <button type="button" data-no95 className="todo-session-mini" aria-label={`Remove ${lineLabel(line, tasks)}`} onClick={() => onChange(removeLine(plan, line.id))}>
                          ×
                        </button>
                      </li>
                    )
                  })}
                </ul>
              </div>
            )
          })}
          {missing.length ? (
            <div className="todo-session-missing" role="note">
              <b>Not in this session but needed first:</b> {[...new Set(missing.map((m) => m.needs))].join(", ")}
            </div>
          ) : null}
          {pace !== 1 ? (
            <p className="todo-session-pace">
              You usually run ×{pace.toFixed(1)} your estimates. The gauge counts that in.
            </p>
          ) : null}
        </section>
      </div>

      {breakdownTask ? (
        <section className="todo-session-breakdown" aria-label={`Break down ${itemTitleOrUntitled(breakdownTask)}`}>
          <div className="todo-session-breakdown-head">
            <b>{itemTitleOrUntitled(breakdownTask)}</b>
            <button type="button" className="todo-verb" onClick={() => setBreakdownId(null)}>
              Close
            </button>
          </div>
          <TodoBreakdown
            estimate={breakdownTask.estimatedDuration}
            steps={breakdownTask.subtasks}
            onEstimateChange={(minutes) => updateTask({ ...breakdownTask, estimatedDuration: minutes })}
            onStepsChange={(subtasks) => updateTask({ ...breakdownTask, subtasks: todoTime.settle(breakdownTask, subtasks) })}
            time={todoTime.timeOf(breakdownTask.id)}
          />
        </section>
      ) : null}

      <div className="todo-dialog-actions todo-session-actions">
        <label className="todo-session-paint">
          <input type="checkbox" checked={!!plan.paint} onChange={(e) => onChange({ ...plan, paint: e.target.checked })} />
          Paint the current step on Tracking
        </label>
        <button type="button" className="todo-btn" onClick={() => onChange(orderByPrereqs(plan, tasks))} title="Put prerequisites first">
          Order by needs
        </button>
        <button type="button" className="todo-btn" onClick={() => onChange({ ...emptySession(new Date(), plan.durationMin), id: plan.id, title: plan.title })}>
          Clear
        </button>
        <button
          type="button"
          className="todo-btn is-primary"
          disabled={!!reason}
          title={reason ?? "Start the clock"}
          onClick={() => onChange(startSession(plan, tasks, new Date()))}
        >
          Start
        </button>
      </div>
      {reason ? <p className="todo-session-reason">{reason}</p> : null}
    </div>
  )
}

// ---- Run ----------------------------------------------------------------------

function RunView({ plan, tasks, onChange }: { plan: SessionPlan; tasks: Task[]; onChange: (plan: SessionPlan) => void }) {
  const updateTask = useTaskStore((s) => s.updateTask)
  const { settle } = useTodoTime(tasks)
  const now = useNow(true)
  const [skip, setSkip] = useState<string[]>([])
  const [justStart, setJustStart] = useState<{ taskId: string; stepId?: string } | null>(null)
  const taskClock = useTaskClockStarter()
  const penSession = usePenColorSessionStore((s) => s.session)

  const left = remainingSec(plan, now)
  const paused = !plan.clock?.running
  const reached = tierReached(plan, tasks)
  const reachedRank = reached === "none" ? -1 : SESSION_TIERS.findIndex((t) => t.id === reached)
  const current = allLines(plan).find(({ line }) => line.id === plan.activeLineId)?.line
  const focus = current ? lineFocusStep(current, tasks) : null
  const focusStep = focus?.kind === "step" ? focus.step : undefined

  // The current step rides the pen clock when the session paints.
  useEffect(() => {
    if (!plan.paint || !current || paused) return
    const live = usePenColorSessionStore.getState().session
    if (live?.taskId === current.taskId && live.stepId === (focusStep?.id ?? current.stepId)) return
    taskClock.start(current.taskId, focusStep?.id ?? current.stepId)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [plan.paint, current?.id, focusStep?.id, paused])

  const advanceIfDone = (next: SessionPlan) => {
    const latest = useTaskStore.getState().tasks
    const line = allLines(next).find(({ line }) => line.id === next.activeLineId)?.line
    if (line && lineIsDone(line, latest)) onChange(finishLine(next, line.id, latest, new Date()))
    else onChange(next)
  }

  const stepDone = () => {
    if (!current || !focusStep) return
    const task = tasks.find((t) => t.id === current.taskId)
    if (!task) return
    const row =
      penSession?.taskId === task.id ? activeNowObjectives(penSession.nowObjectives).find((o) => o.stepId === focusStep.id) : undefined
    if (row) togglePenColorNowObjectiveComplete(row.id)
    else updateTask({ ...task, subtasks: settle(task, finishStep(task.subtasks, focusStep.id, undefined)) })
    advanceIfDone(plan)
  }

  const lineDone = () => {
    if (!current) return
    const { task, step } = lineTarget(current, tasks)
    if (task && step && !step.completed) updateTask({ ...task, subtasks: settle(task, finishStep(task.subtasks, step.id, undefined)) })
    if (task && !step && !task.completed) completeTask(task.id)
    onChange(finishLine(plan, current.id, useTaskStore.getState().tasks, new Date()))
  }

  const skipLine = () => {
    if (!current) return
    const nextSkip = [...skip, current.id]
    setSkip(nextSkip)
    const next = nextLine(plan, tasks, nextSkip)
    onChange(focusLine(plan, next?.id, new Date()))
  }

  const park = () => {
    putSession(parkSession(plan, new Date()), [plan])
  }

  const end = () => {
    if (plan.paint && penSession?.taskId && allLines(plan).some(({ line }) => line.taskId === penSession.taskId)) stopTaskClock()
    onChange(endSession(plan, tasks, new Date()))
  }

  return (
    <div className="todo-session-run">
      <div className="todo-session-clockbar">
        <div className={`todo-session-clock${left < 0 ? " is-over" : ""}${paused ? " is-paused" : ""}`} aria-live="off">
          {fmtClock(left)}
        </div>
        <div className="todo-session-lamps" role="group" aria-label="Tiers reached">
          {SESSION_TIERS.map(({ id, label }, i) => (
            <span key={id} className={`todo-session-lamp${i <= reachedRank ? " is-lit" : ""}`} title={i <= reachedRank ? `${label} reached` : label}>
              <span className="todo-session-lamp-glass" aria-hidden />
              {label}
            </span>
          ))}
        </div>
        <div className="todo-session-transport">
          <button type="button" className="todo-verb" onClick={() => onChange(paused ? resumeSession(plan, new Date()) : pauseSession(plan, new Date()))}>
            {paused ? "Resume" : "Pause"}
          </button>
          <button type="button" className="todo-verb" onClick={() => onChange(extendSession(plan, 15, new Date()))}>
            +15
          </button>
          <button type="button" className="todo-verb" title="Put it down and take it up later" onClick={park}>
            Park
          </button>
          <button type="button" className="todo-verb is-missed" onClick={end}>
            End
          </button>
        </div>
      </div>
      {left <= 0 ? <p className="todo-session-timeup">Time is up. End and review, or add 15 minutes.</p> : null}

      {current ? (
        <div className="todo-session-current">
          <p className="todo-session-current-path">{lineLabel(current, tasks)}</p>
          <h3 className="todo-session-current-step">
            {focusStep ? focusStep.description : focus?.kind === "needs-estimates" ? "Estimate a step to start" : focus?.kind === "blocked" ? "Every open step is waiting" : "This line is ready to close"}
          </h3>
          <p className="todo-session-current-meta">
            {current.estMin ? `${fmtMinutes(current.estMin)} est` : "no estimate"} · {fmtMinutes(lineSeconds(plan, current, now) / 60)} so far
            {focusStep?.estimatedDuration ? ` · this step ${fmtMinutes(focusStep.estimatedDuration)}` : ""}
            {penSession?.taskId === current.taskId ? " · on the pen clock" : ""}
          </p>
          <div className="todo-session-current-keys">
            <button type="button" className="todo-verb is-complete is-primary" disabled={!focusStep} onClick={stepDone}>
              Step done
            </button>
            <button type="button" className="todo-verb" onClick={lineDone}>
              Line done
            </button>
            <button type="button" className="todo-verb is-quiet" onClick={skipLine}>
              Skip line
            </button>
            <button type="button" className="todo-verb is-quiet" onClick={() => setJustStart({ taskId: current.taskId, stepId: focusStep?.id })}>
              Just start
            </button>
            <label className="todo-session-paint">
              <input type="checkbox" checked={!!plan.paint} onChange={(e) => onChange({ ...plan, paint: e.target.checked })} />
              Paint on Tracking
            </label>
          </div>
        </div>
      ) : (
        <div className="todo-session-current">
          <h3 className="todo-session-current-step">Every line is done.</h3>
          <button type="button" className="todo-verb is-complete is-primary" onClick={end}>
            End and review
          </button>
        </div>
      )}

      <ol className="todo-session-runlist">
        {allLines(plan).map(({ line, tier }) => {
          const done = lineIsDone(line, tasks)
          const blocked = !done && lineIsBlocked(line, tasks)
          const isCurrent = line.id === plan.activeLineId
          return (
            <li key={line.id} className={`todo-session-runline is-${tier}${done ? " is-done" : ""}${isCurrent ? " is-current" : ""}`}>
              <span className="todo-session-mark" aria-hidden>
                {done ? "✓" : isCurrent ? "●" : blocked ? "⊘" : "○"}
              </span>
              <span className="todo-session-tiertag">{TIER_SHORT[tier]}</span>
              <button type="button" data-no95 className="todo-session-runname" disabled={done || isCurrent} onClick={() => onChange(focusLine(plan, line.id, new Date()))}>
                {lineLabel(line, tasks)}
              </button>
              <span className="todo-session-mins">
                {fmtMinutes(lineSeconds(plan, line, now) / 60)} / {line.estMin ? fmtMinutes(line.estMin) : "–"}
              </span>
            </li>
          )
        })}
      </ol>
      {taskClock.picker}
      {/* Portaled: the dialog's transform would trap Just Start's fixed overlay. */}
      {justStart && typeof document !== "undefined"
        ? createPortal(<JustStartMode taskId={justStart.taskId} stepId={justStart.stepId} onClose={() => setJustStart(null)} />, document.body)
        : null}
    </div>
  )
}

// ---- Parked -------------------------------------------------------------------

function ParkedView({
  plan,
  tasks,
  onChange,
  onShelves,
}: {
  plan: SessionPlan
  tasks: Task[]
  onChange: (plan: SessionPlan) => void
  onShelves: () => void
}) {
  const now = new Date()
  const stale = parkedLong(plan, now)
  const remembered = allLines(plan).find(({ line }) => line.id === plan.activeLineId)?.line
  const resume = (mode: "as-was" | "fresh") => onChange(resumeParked(plan, useTaskStore.getState().tasks, new Date(), mode))
  return (
    <div className="todo-session-parked">
      <p className="todo-session-parked-head">
        <span className="todo-session-clock is-paused">{fmtClock(remainingSec(plan, now))}</span>
        <span>
          left of {fmtMinutes(plan.durationMin)}
          {plan.parkedAt ? ` · parked ${new Date(plan.parkedAt).toLocaleString([], { weekday: "short", hour: "2-digit", minute: "2-digit" })}` : ""}
        </span>
      </p>
      {remembered ? <p className="todo-session-current-path">Was on: {lineLabel(remembered, tasks)}</p> : null}
      <ol className="todo-session-runlist">
        {allLines(plan).map(({ line, tier }) => {
          const gone = !tasks.some((t) => t.id === line.taskId) || (!!line.stepId && !lineTarget(line, tasks).step)
          const done = !gone && lineIsDone(line, tasks)
          return (
            <li key={line.id} className={`todo-session-runline is-${tier}${done ? " is-done" : ""}${gone ? " is-gone" : ""}${line.id === plan.activeLineId ? " is-current" : ""}`}>
              <span className="todo-session-mark" aria-hidden>
                {done ? "✓" : line.id === plan.activeLineId ? "●" : "○"}
              </span>
              <span className="todo-session-tiertag">{TIER_SHORT[tier]}</span>
              <span className="todo-session-runname">{gone ? "Deleted task" : lineLabel(line, tasks)}</span>
              {gone ? (
                <button type="button" className="todo-verb is-quiet" onClick={() => onChange(removeLine(plan, line.id))}>
                  Remove
                </button>
              ) : (
                <span className="todo-session-mins">
                  {fmtMinutes(lineSeconds(plan, line, now) / 60)} / {line.estMin ? fmtMinutes(line.estMin) : "–"}
                </span>
              )}
            </li>
          )
        })}
      </ol>
      <div className="todo-dialog-actions">
        <button type="button" className="todo-btn" onClick={onShelves}>
          Sessions
        </button>
        {stale ? (
          <>
            <span className="todo-session-reason">Parked over a day ago.</span>
            <button type="button" className="todo-btn" onClick={() => resume("fresh")}>
              Fresh clock, same lines
            </button>
            <button type="button" className="todo-btn is-primary" onClick={() => resume("as-was")}>
              Resume as was
            </button>
          </>
        ) : (
          <button type="button" className="todo-btn is-primary" onClick={() => resume("as-was")}>
            Resume
          </button>
        )}
      </div>
    </div>
  )
}

// ---- Sessions shelves ---------------------------------------------------------

function sessionStamp(plan: SessionPlan): string {
  return plan.endedAt ?? plan.parkedAt ?? plan.startedAt ?? plan.createdAt
}

function ShelfRow({ plan, tasks, children }: { plan: SessionPlan; tasks: Task[]; children: ReactNode }) {
  const lines = allLines(plan)
  const done = lines.filter(({ line }) => lineIsDone(line, tasks)).length
  const when = new Date(sessionStamp(plan)).toLocaleDateString([], { month: "short", day: "numeric" })
  return (
    <li className="todo-session-shelfrow">
      <span className="todo-session-shelfname">{plan.title || "Session"}</span>
      <span className="todo-session-mins">
        {when} · {fmtMinutes(plan.durationMin)} · {done}/{lines.length} lines
        {plan.phase === "done" && plan.reachedTier ? ` · ${plan.reachedTier === "none" ? "no tier" : TIER_LABEL[plan.reachedTier]}` : ""}
        {plan.phase === "run" ? " · running" : plan.phase === "review" ? " · in review" : ""}
      </span>
      <span className="todo-session-shelfkeys">{children}</span>
    </li>
  )
}

function ShelvesView({
  open,
  history,
  tasks,
  onOpen,
  onOpenDone,
  onRunAgain,
  onNew,
}: {
  open: SessionPlan[]
  history: SessionPlan[]
  tasks: Task[]
  onOpen: (id: string) => void
  onOpenDone: (id: string) => void
  onRunAgain: (plan: SessionPlan) => void
  onNew: () => void
}) {
  const remove = useSessionPlanStore((s) => s.remove)
  const [query, setQuery] = useState("")
  const needle = query.trim().toLowerCase()
  const match = (plan: SessionPlan) =>
    !needle ||
    plan.title.toLowerCase().includes(needle) ||
    (plan.note ?? "").toLowerCase().includes(needle) ||
    allLines(plan).some(({ line }) => lineLabel(line, tasks).toLowerCase().includes(needle))
  const newest = (a: SessionPlan, b: SessionPlan) => sessionStamp(b).localeCompare(sessionStamp(a))
  const drafts = open.filter((p) => p.phase === "draft" && match(p)).sort(newest)
  const parked = open.filter((p) => p.phase !== "draft" && match(p)).sort(newest)
  const done = history.filter(match).sort(newest)
  const shelf = (label: string, count: number, body: ReactNode) => (
    <section className="todo-session-shelf" aria-label={label}>
      <h3 className="todo-session-shelf-head">
        {label} <span className="todo-session-mins">{count}</span>
      </h3>
      <ul className="todo-session-shelflist">{count ? body : <li className="todo-session-empty">None.</li>}</ul>
    </section>
  )
  return (
    <div className="todo-session-shelves">
      <div className="todo-session-pick-bar">
        <input type="search" placeholder="Search sessions" aria-label="Search sessions" value={query} onChange={(e) => setQuery(e.target.value)} />
        <button type="button" className="todo-btn" onClick={onNew}>
          New session
        </button>
      </div>
      {shelf(
        "Drafts",
        drafts.length,
        drafts.map((p) => (
          <ShelfRow key={p.id} plan={p} tasks={tasks}>
            <button type="button" className="todo-verb" onClick={() => onOpen(p.id)}>
              Open
            </button>
            <button type="button" className="todo-verb is-quiet" aria-label={`Delete draft ${p.title}`} onClick={() => remove(p.id)}>
              Delete
            </button>
          </ShelfRow>
        )),
      )}
      {shelf(
        "Parked",
        parked.length,
        parked.map((p) => (
          <ShelfRow key={p.id} plan={p} tasks={tasks}>
            <button type="button" className="todo-verb" onClick={() => onOpen(p.id)}>
              {p.phase === "parked" ? "Open" : "Show"}
            </button>
          </ShelfRow>
        )),
      )}
      {shelf(
        "Done",
        done.length,
        done.map((p) => (
          <ShelfRow key={p.id} plan={p} tasks={tasks}>
            <button type="button" className="todo-verb" onClick={() => onOpenDone(p.id)}>
              Open
            </button>
            <button type="button" className="todo-verb" onClick={() => onRunAgain(p)}>
              Run again
            </button>
          </ShelfRow>
        )),
      )}
    </div>
  )
}

/** A done session, read-only, with its review. */
function DoneView({ plan, tasks, onBack, onRunAgain }: { plan: SessionPlan; tasks: Task[]; onBack: () => void; onRunAgain: () => void }) {
  const reached = plan.reachedTier ?? "none"
  return (
    <div className="todo-session-review is-readonly">
      <p className={`todo-session-reached is-${reached}`}>
        {reached === "none" ? "No tier reached" : `${TIER_LABEL[reached]} reached`}
        {plan.points ? ` · +${plan.points} points` : ""}
        {plan.startedAt ? ` · ran ${fmtMinutes(ranMinutes(plan))} of ${fmtMinutes(plan.durationMin)}` : ""}
      </p>
      {plan.note ? <p className="todo-session-current-path">“{plan.note}”</p> : null}
      <table className="todo-session-table">
        <thead>
          <tr>
            <th scope="col">Line</th>
            <th scope="col">Tier</th>
            <th scope="col">Est</th>
            <th scope="col">Actual</th>
            <th scope="col">Then</th>
          </tr>
        </thead>
        <tbody>
          {allLines(plan).map(({ line, tier }) => {
            const actual = (line.actualSec ?? 0) / 60
            return (
              <tr key={line.id} className={line.doneAt ? "is-done" : undefined}>
                <td>{lineLabel(line, tasks)}</td>
                <td>{TIER_SHORT[tier]}</td>
                <td>{line.estMin ? fmtMinutes(line.estMin) : "–"}</td>
                <td>{actual >= 1 ? fmtMinutes(actual) : "–"}</td>
                <td>{line.doneAt ? "done" : line.outcome === "push" ? "pushed" : line.outcome === "leave" ? "left" : "kept"}</td>
              </tr>
            )
          })}
        </tbody>
      </table>
      <div className="todo-dialog-actions">
        <button type="button" className="todo-btn" onClick={onBack}>
          Back to Sessions
        </button>
        <button type="button" className="todo-btn is-primary" onClick={onRunAgain}>
          Run again
        </button>
      </div>
    </div>
  )
}

// ---- Review -------------------------------------------------------------------

function ReviewView({ plan, tasks, onDone }: { plan: SessionPlan; tasks: Task[]; onDone: () => void }) {
  const setCurrent = (next: SessionPlan) => putSession(next)
  const archive = useSessionPlanStore((s) => s.archive)
  const [note, setNote] = useState(plan.note ?? "")
  const amounts = activeTierPoints()
  const reached = tierReached(plan, tasks)
  const preview = closeSession(plan, tasks, { bareMin: amounts.bareMin, goal: amounts.goal, exceptional: amounts.exceptional })

  const save = () => {
    // An unfinished line with no choice made reads as "Keep for next session", as the menu shows.
    let decided = plan
    for (const { line } of allLines(plan)) {
      if (!line.outcome && !lineIsDone(line, tasks)) decided = setLineOutcome(decided, line.id, "keep")
    }
    const closed = closeSession(decided, tasks, { bareMin: amounts.bareMin, goal: amounts.goal, exceptional: amounts.exceptional }, note)
    if (closed.points && closed.points > 0) {
      usePointsStore.getState().addPoints(`session:${closed.id}`, closed.points, `Session · ${closed.title} (${TIER_LABEL[reached as SessionTier] ?? "none"})`)
    }
    for (const { line } of allLines(closed)) {
      if (line.outcome === "push" && !lineIsDone(line, tasks)) pushTask(line.taskId, "day")
    }
    const ran = ranMinutes(closed)
    if (closed.startedAt && ran > 0) {
      const start = new Date(closed.startedAt)
      usePlannedActionStore.getState().addAction(
        placementFromDrop({
          date: formatLocalDateKey(start),
          hour: start.getHours(),
          minute: start.getMinutes(),
          durationMinutes: ran,
          source: "session",
          sourceId: closed.id,
          title: `Session · ${closed.title}`,
          notes: `${reached === "none" ? "No tier reached" : `${TIER_LABEL[reached as SessionTier]} reached`}${closed.note ? ` · ${closed.note}` : ""}`,
        }),
      )
    }
    writeSessionTimeLogs(closed)
    archive(closed, keptRefs(closed, tasks))
    onDone()
  }

  return (
    <div className="todo-session-review">
      <p className={`todo-session-reached is-${reached}`}>
        {reached === "none" ? "Bare minimum not reached yet." : `${TIER_LABEL[reached as SessionTier]} reached`}
        {preview.points ? ` · +${preview.points} points` : ""}
        {plan.startedAt ? ` · ran ${fmtMinutes(ranMinutes(plan))} of ${fmtMinutes(plan.durationMin)}` : ""}
      </p>
      <table className="todo-session-table">
        <thead>
          <tr>
            <th scope="col">Line</th>
            <th scope="col">Tier</th>
            <th scope="col">Est</th>
            <th scope="col">Actual</th>
            <th scope="col">Then</th>
          </tr>
        </thead>
        <tbody>
          {allLines(plan).map(({ line, tier }) => {
            const done = lineIsDone(line, tasks)
            const actual = (line.actualSec ?? 0) / 60
            const over = line.estMin && actual > line.estMin * 1.25
            return (
              <tr key={line.id} className={done ? "is-done" : undefined}>
                <td>{lineLabel(line, tasks)}</td>
                <td>{TIER_SHORT[tier]}</td>
                <td>{line.estMin ? fmtMinutes(line.estMin) : "–"}</td>
                <td className={over ? "is-over" : undefined}>{actual >= 1 ? fmtMinutes(actual) : "–"}</td>
                <td>
                  {done ? (
                    "done"
                  ) : (
                    <select
                      aria-label={`What next for ${lineLabel(line, tasks)}`}
                      value={line.outcome ?? "keep"}
                      onChange={(e) => setCurrent(setLineOutcome(plan, line.id, e.target.value as SessionLine["outcome"]))}
                    >
                      <option value="keep">Keep for next session</option>
                      {line.stepId ? null : <option value="push">Push to tomorrow</option>}
                      <option value="leave">Leave</option>
                    </select>
                  )}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
      <label className="todo-session-note">
        <span>One line on how it went</span>
        <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="What helped, what got in the way" />
      </label>
      <div className="todo-dialog-actions">
        <button type="button" className="todo-btn" onClick={() => setCurrent({ ...plan, phase: "run", clock: plan.clock ? { ...plan.clock } : null })}>
          Back to the session
        </button>
        <button type="button" className="todo-btn is-primary" onClick={save}>
          Save session
        </button>
      </div>
    </div>
  )
}

/** The fascia key: "Session", or the live countdown while one runs. Ticks on its own so the panel does not. */
/** Each line's minutes onto its task's `timeLogs`, less what the pen clock already logged. */
function writeSessionTimeLogs(plan: SessionPlan): void {
  const store = useTaskStore.getState()
  for (const { taskId, entry } of sessionTimeLogs(plan, store.tasks)) {
    const task = useTaskStore.getState().tasks.find((t) => t.id === taskId)
    if (task) store.updateTask({ ...task, timeLogs: [...(task.timeLogs ?? []), entry] })
  }
}

export function SessionKey({ onOpen }: { onOpen: () => void }) {
  const open = useSessionPlanStore((s) => s.open)
  const focusId = useSessionPlanStore((s) => s.focusId)
  const live = liveSession(open)
  const running = live?.phase === "run"
  const parked = open.filter((p) => p.phase === "parked").length
  const now = useNow(running)
  const shown = open.find((p) => p.id === focusId)
  const label = live
    ? live.phase === "run"
      ? `Session ${fmtClock(remainingSec(live, now))}`
      : "Review session"
    : shown?.phase === "draft" && allLines(shown).length
      ? "Session (draft)"
      : "Session"
  return (
    <button
      type="button"
      className={`todo-btn todo-session-key${running ? " is-running" : ""}`}
      title="Plan a time box in three tiers and work through it"
      onClick={onOpen}
    >
      {label}
      {parked ? (
        <span className="todo-session-parkcount" aria-label={`${parked} parked`}>
          {" "}⏸{parked}
        </span>
      ) : null}
    </button>
  )
}

/** The fascia key for the Sessions history panel (Drafts / Parked / Done). */
export function SessionsKey({ onOpen }: { onOpen: () => void }) {
  return (
    <button type="button" className="todo-btn todo-sessions-key" title="Drafts, parked and done sessions" onClick={onOpen}>
      Sessions
    </button>
  )
}
