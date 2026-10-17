/**
 * components/Home/ToDo/TaskCard.tsx — The To Do task card (Phase 12, R7 R8 R15)
 *
 * Planning this period's work on one task. Item detail edits the whole item,
 * the lid makes one-line changes; the card holds the full step tree with a
 * column picker, mass edit, quick points, prerequisites (Needs chips, an order
 * lane, what this unlocks and any inherited due date), the notice-dot answers
 * and the period values. It writes through the same store calls as the lid
 * (`onStepsChange` = the panel's `handleSteps`, `updateTask`), so the lid,
 * the card and item detail always agree. **↗ Item** opens item detail on top
 * (`pushItemLayer`); item detail's **Card** opens this. Mounted once in
 * `todo-panel.tsx`; which task is open lives in `lib/task-card.ts`.
 */
"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import type { ReactNode } from "react"
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog"
import { StepTree, type StepRowInfo } from "@/components/steps/StepTree"
import { LevelGauge } from "@/components/steps/LevelGauge"
import { DvdTransportKey } from "@/components/dvd-transport-keys"
import { useTaskStore } from "@/lib/task-store"
import { useTimeTrackingStore } from "@/lib/time-tracking-store"
import { useSessionPlanStore } from "@/lib/session-plan-store"
import { itemTitleOrUntitled } from "@/lib/item-utils"
import { runAsAction } from "@/lib/action-history"
import { openSession } from "@/lib/session-open-store"
import { JUST_25_TEMPLATE_ID, allLines } from "@/lib/session-plan"
import { openStepItem, pushItemLayer } from "@/lib/step-item-stack"
import { useStepPointsVisible } from "@/lib/points-visibility"
import { activeTierPoints } from "@/lib/completion-tiers"
import { COMPLETION_STATUS_LABELS } from "@/lib/completion-status"
import { STEP_TIERS, STEP_TIER_LABEL, STEP_TIER_SHORT, effectiveTierMap, tierBand } from "@/lib/step-tiers"
import { formatPercent, levelProgress, levelReached } from "@/lib/step-progress"
import { effectiveDurationMinutes, flattenSteps, moveSteps } from "@/lib/todo-steps"
import { stepPrereqChoices, toggleStepPrereq } from "@/lib/prereqs"
import { inheritedDue, waitingOn } from "@/lib/unlock-value"
import { NOTICE_PROMPT, needsNotice, totalPushes, withNoticeAnswer } from "@/lib/notice-dot"
import { partsMinutes, timeTrio } from "@/lib/tracked-time"
import {
  chainNeeds,
  clearNeeds,
  closeTaskCard,
  leafStepIds,
  massDelete,
  massDone,
  massEstimate,
  massPoints,
  massSpark,
  massTier,
  needsAll,
  noticeAnswers,
  openStepIds,
  orderLane,
  periodPushes,
  remainingForLevel,
  stepPointsEarned,
  taskPointsWithSource,
  useTaskCardStore,
} from "@/lib/task-card"
import type { StepTier, Subtask, Task } from "@/lib/types"
import { attentionGiven, attentionGivenLabel } from "./attention-given"
import { pushedKeyForPeriod, todoPeriodValue, type TodoPeriod } from "./todo-utils"
import type { TodoTimeInfo } from "./TodoBreakdown"
import "./task-card.css"

/** What the panel lends the card (its handlers, so the lid and the card agree). */
export interface TaskCardHost {
  period: TodoPeriod
  periodLabel: string
  focusedDate: Date
  isRequired: (taskId: string) => boolean
  isPrioritized: (taskId: string) => boolean
  onToggleRequired: (taskId: string) => void
  onTogglePrioritized: (taskId: string) => void
  onStepsChange: (taskId: string, steps: Subtask[]) => void
  onJustStart: (taskId: string) => void
  onNeeds: (taskId: string) => void
  timeOf?: (taskId: string) => TodoTimeInfo | undefined
  clockTaskId?: string | null
  clockStepId?: string
  onClockStart?: (taskId: string, stepId?: string) => void
  onClockStop?: () => void
  defaultEstimateMin?: number
  /** Working hours left in the day (the load strip's needle). */
  hoursLeft: number
}

export const CARD_COLUMNS = ["tier", "pct", "est", "parts", "spent", "points", "needs", "lock", "unlocks", "clock"] as const
export type CardColumn = (typeof CARD_COLUMNS)[number]
const COLUMN_LABEL: Record<CardColumn, string> = {
  tier: "Tier · spark",
  pct: "B / G / E %",
  est: "Est",
  parts: "Parts",
  spent: "Spent",
  points: "Points",
  needs: "Needs",
  lock: "Lock",
  unlocks: "Unlocks",
  clock: "▶",
}
const COLS_KEY = "brain2-task-card-cols"
const DEFAULT_COLS: CardColumn[] = ["tier", "pct", "est", "spent", "needs", "lock", "clock"]

function loadCols(): CardColumn[] {
  try {
    const raw = JSON.parse(localStorage.getItem(COLS_KEY) ?? "null")
    if (Array.isArray(raw)) return raw.filter((c): c is CardColumn => (CARD_COLUMNS as readonly string[]).includes(c))
  } catch {
    /* view state only */
  }
  return DEFAULT_COLS
}

function saveCols(cols: CardColumn[]): void {
  try {
    localStorage.setItem(COLS_KEY, JSON.stringify(cols))
  } catch {
    /* view state only */
  }
}

const inOtherLayer = (event: Event) => {
  const target = ((event as CustomEvent<{ originalEvent?: Event }>).detail?.originalEvent?.target ?? event.target) as Element | null
  return !!target?.closest?.("[data-item-layer], [role='dialog']:not(.task-card)")
}

export function TaskCard({ host }: { host: TaskCardHost }) {
  const taskId = useTaskCardStore((s) => s.taskId)
  const focusStepId = useTaskCardStore((s) => s.stepId)
  const tasks = useTaskStore((s) => s.tasks)
  const task = taskId ? tasks.find((t) => t.id === taskId) : undefined
  return (
    <Dialog open={!!task} onOpenChange={(open) => (open ? null : closeTaskCard())}>
      {task ? (
        <DialogContent
          className="task-card"
          hideClose
          aria-describedby={undefined}
          data-ui-name="Task card"
          data-ui-docs="components/Home/ToDo/README.md"
          data-ui-docs-anchor="task-card"
          onPointerDownOutside={(e) => (inOtherLayer(e) ? e.preventDefault() : undefined)}
          onInteractOutside={(e) => (inOtherLayer(e) ? e.preventDefault() : undefined)}
        >
          <TaskCardBody key={task.id} task={task} tasks={tasks} host={host} focusStepId={focusStepId} />
        </DialogContent>
      ) : null}
    </Dialog>
  )
}

function TaskCardBody({
  task,
  tasks,
  host,
  focusStepId,
}: {
  task: Task
  tasks: Task[]
  host: TaskCardHost
  focusStepId?: string
}) {
  const updateTask = useTaskStore((s) => s.updateTask)
  const lists = useTaskStore((s) => s.lists)
  const folders = useTaskStore((s) => s.folders)
  const entries = useTimeTrackingStore((s) => s.entries)
  const history = useSessionPlanStore((s) => s.history)
  const pointsVisible = useStepPointsVisible()
  const steps = useMemo(() => task.subtasks ?? [], [task.subtasks])
  const name = itemTitleOrUntitled(task)
  const time = host.timeOf?.(task.id)

  const [selected, setSelected] = useState<ReadonlySet<string>>(() => (focusStepId ? new Set([focusStepId]) : new Set()))
  const [visibleIds, setVisibleIds] = useState<string[]>([])
  const [cols, setCols] = useState<CardColumn[]>(loadCols)
  const [pickerOpen, setPickerOpen] = useState(false)
  const [tier, setTier] = useState<StepTier | undefined>()
  const [hideLocked, setHideLocked] = useState(false)
  const [nextOnly, setNextOnly] = useState(false)
  const [columnsView, setColumnsView] = useState(false)
  const [noticeDraft, setNoticeDraft] = useState("")
  const rootRef = useRef<HTMLDivElement>(null)

  // A step item's **Card**: scroll to that step.
  useEffect(() => {
    if (!focusStepId) return
    const id = requestAnimationFrame(() =>
      rootRef.current?.querySelector(`[data-step-id="${CSS.escape(focusStepId)}"]`)?.scrollIntoView?.({ block: "center" }),
    )
    return () => cancelAnimationFrame(id)
  }, [focusStepId])

  const shownCols = cols.filter((c) => c !== "points" || pointsVisible)
  const has = (c: CardColumn) => shownCols.includes(c)
  const toggleCol = (c: CardColumn) => {
    const next = cols.includes(c) ? cols.filter((x) => x !== c) : [...cols, c]
    setCols(next)
    saveCols(next)
  }

  const writeSteps = (label: string, next: Subtask[]) => runAsAction(label, () => host.onStepsChange(task.id, next))
  const sel = selected
  const ordered = visibleIds.filter((id) => sel.has(id))
  const bar = (label: string, edit: (s: Subtask[]) => Subtask[]) => () => writeSteps(label, edit(steps))

  // ── Numbers ──
  const est = effectiveDurationMinutes(task.estimatedDuration, steps)
  const spent = time?.spent ?? 0
  const pts = taskPointsWithSource(task, lists, folders)
  const earned = stepPointsEarned(steps)
  const reached = levelReached(task, task.completed)
  const tierAmounts = activeTierPoints()
  const levelPts = reached === "min" ? tierAmounts.bareMin : reached === "goal" ? tierAmounts.goal : reached === "exceptional" ? tierAmounts.exceptional : 0
  const percents = levelProgress(task)
  const pushKey = pushedKeyForPeriod(host.period)
  const periodValue = todoPeriodValue(host.period, host.focusedDate)
  const pushes = periodPushes(task, host.period, periodValue)
  const attention = attentionGiven([task], entries, host.period, host.focusedDate)
  const waiting = waitingOn(task.id, tasks)
  const due = inheritedDue(task.id, tasks, host.focusedDate)
  const blockers = (task.dependencies ?? []).map((id) => tasks.find((t) => t.id === id)).filter((t): t is Task => !!t)
  const lane = orderLane(steps)
  const tierOf = effectiveTierMap(steps)
  const chosenLevel: StepTier = tier ?? "goal"
  const remaining = remainingForLevel(steps, chosenLevel, host.defaultEstimateMin ?? 0)
  const dayLeftMin = Math.max(0, Math.round(host.hoursLeft * 60))
  const sessions = history.filter((plan) => allLines(plan).some(({ line }) => line.taskId === task.id))
  const answers = noticeAnswers(task)
  const onClock = !!host.clockTaskId && host.clockTaskId === task.id

  const stepColumns = (step: Subtask, info: StepRowInfo): ReactNode => {
    const choices = has("needs") ? stepPrereqChoices(steps, step.id) : null
    const needNames = (step.dependsOn ?? []).map((id) => flattenSteps(steps).find((s) => s.id === id)?.description).filter(Boolean)
    const unlockCount = has("unlocks") ? lane.find((n) => n.id === step.id)?.unlocks ?? 0 : 0
    return (
      <span className="task-card-cols">
        {has("pct") ? <LevelGauge steps={steps} stepId={step.id} counts={false} /> : null}
        {has("est") ? <span className="task-card-num">{step.estimatedDuration ? `${step.estimatedDuration}m` : "—"}</span> : null}
        {has("parts") && step.subtasks?.length ? <span className="task-card-num">={partsMinutes(step.subtasks)}m</span> : null}
        {has("spent") ? <span className="task-card-num is-quiet">{time?.stepSpent?.get(step.id) ? `${time.stepSpent.get(step.id)}m` : ""}</span> : null}
        {has("points") ? (
          <input
            className="task-card-pts"
            type="number"
            min={0}
            aria-label={`Points for ${step.description}`}
            value={step.points ?? ""}
            placeholder="pts"
            onChange={(e) => writeSteps("Step points", massPoints(steps, new Set([step.id]), Number(e.target.value) || undefined))}
          />
        ) : null}
        {choices ? (
          <select
            className="task-card-needs"
            aria-label={`Needs for ${step.description}`}
            title={needNames.length ? `Needs ${needNames.join(", ")}` : "Needs…"}
            value=""
            onChange={(e) => e.target.value && writeSteps("Needs", toggleStepPrereq(steps, step.id, e.target.value))}
          >
            <option value="">{needNames.length ? `needs ${needNames.length}` : "Needs…"}</option>
            {flattenSteps(steps)
              .filter((s) => s.id !== step.id && (choices.has(s.id) || (step.dependsOn ?? []).includes(s.id)))
              .map((s) => (
                <option key={s.id} value={s.id}>
                  {(step.dependsOn ?? []).includes(s.id) ? "✓ " : ""}
                  {s.description}
                </option>
              ))}
          </select>
        ) : null}
        {has("lock") && info.locked ? <span className="task-card-lock" title="Waits on an open step">locked</span> : null}
        {unlockCount > 0 ? <span className="task-card-num">unlocks {unlockCount}</span> : null}
        {has("clock") && host.onClockStart && !step.completed ? (
          <DvdTransportKey
            mark={onClock && host.clockStepId === step.id ? "stop" : "play"}
            pressed={onClock && host.clockStepId === step.id}
            label={`Working on ${step.description} now`}
            onClick={() =>
              onClock && host.clockStepId === step.id ? host.onClockStop?.() : host.onClockStart?.(task.id, step.id)
            }
          />
        ) : null}
      </span>
    )
  }

  return (
    <div className="task-card-body" ref={rootRef}>
      {/* ── Header ── */}
      <header className="task-card-head">
        <div className="task-card-title-row">
          <DialogTitle className="task-card-name">{name}</DialogTitle>
          <span className="task-card-plate">{host.periodLabel}</span>
          <button type="button" className="task-card-jewel is-required" aria-pressed={host.isRequired(task.id)} onClick={() => host.onToggleRequired(task.id)}>
            Required
          </button>
          <button type="button" className="task-card-jewel is-prioritized" aria-pressed={host.isPrioritized(task.id)} onClick={() => host.onTogglePrioritized(task.id)}>
            Prioritized
          </button>
          <span className={`task-card-lamp is-${task.completed ? "done" : (task.status ?? "active")}`} title="State">
            {COMPLETION_STATUS_LABELS[task.completed ? "done" : (task.status ?? "active")] ?? "Active"}
          </span>
          <span className="task-card-num" title={`Pushes this ${host.period}`}>
            pushed ×{task[pushKey] ?? 0}
          </span>
          {time?.pen ? (
            <span className="task-card-pen" title="Linked pen">
              <span className="task-card-pen-dot" style={{ background: time.pen.color }} aria-hidden />
              {time.pen.name}
            </span>
          ) : null}
          <button type="button" className="task-card-key b2-close-key" aria-label="Close the card" onClick={closeTaskCard}>
            ×
          </button>
        </div>
        <div className="task-card-title-row">
          <LevelGauge steps={steps} focus={tier} />
          <span className="task-card-num">{timeTrio(est, partsMinutes(steps), spent)}</span>
          <span className="task-card-points" data-testid="task-card-points">
            task {pts.points}
            {pointsVisible ? ` · steps ${earned}` : ""}
            {reached !== "none" ? ` · level +${levelPts}` : ""}
          </span>
          <span className="task-card-spacer" />
          {host.onClockStart ? (
            <DvdTransportKey
              mark={onClock ? "stop" : "play"}
              pressed={onClock}
              label={onClock ? `Stop the clock on ${name}` : `Working on ${name} now`}
              onClick={() => (onClock ? host.onClockStop?.() : host.onClockStart?.(task.id))}
            />
          ) : null}
          <button type="button" className="task-card-key" onClick={() => host.onJustStart(task.id)}>
            Just Start
          </button>
          <button
            type="button"
            className="task-card-key"
            onClick={() => openSession({ startOn: "session", templateId: JUST_25_TEMPLATE_ID, seed: [{ taskId: task.id }] })}
          >
            Just 25
          </button>
          <button type="button" className="task-card-key" onClick={() => openSession({ startOn: "session", seed: [{ taskId: task.id }] })}>
            Session with this
          </button>
          <button type="button" className="task-card-key" title="Open item detail on top" onClick={() => pushItemLayer(task.id)}>
            ↗ Item
          </button>
        </div>
      </header>

      <div className="task-card-main">
        <section className="task-card-tree" aria-label="Steps">
          {/* ── View switches ── */}
          <div className="task-card-switches">
            <span className="task-card-seg" role="group" aria-label="Level filter">
              <button type="button" aria-pressed={!tier} onClick={() => setTier(undefined)}>
                All
              </button>
              {STEP_TIERS.map((t) => (
                <button key={t} type="button" aria-pressed={tier === t} title={STEP_TIER_LABEL[t]} onClick={() => setTier(t)}>
                  {STEP_TIER_SHORT[t]}
                </button>
              ))}
            </span>
            <label>
              <input type="checkbox" checked={hideLocked} onChange={(e) => setHideLocked(e.target.checked)} /> Hide locked
            </label>
            <label>
              <input type="checkbox" checked={nextOnly} onChange={(e) => setNextOnly(e.target.checked)} /> Show next only
            </label>
            <button type="button" className="task-card-key" aria-pressed={columnsView} onClick={() => setColumnsView((v) => !v)}>
              B | G | E
            </button>
            <button type="button" className="task-card-key" onClick={() => setSelected(new Set(openStepIds(steps)))}>
              Select all open
            </button>
            <button type="button" className="task-card-key" onClick={() => setSelected(new Set(leafStepIds(steps)))}>
              Select leaves
            </button>
            <span className="task-card-picker">
              <button type="button" className="task-card-key" aria-expanded={pickerOpen} onClick={() => setPickerOpen((o) => !o)}>
                Columns
              </button>
              {pickerOpen ? (
                <span className="task-card-picker-menu" role="group" aria-label="Columns">
                  {CARD_COLUMNS.filter((c) => c !== "points" || pointsVisible).map((c) => (
                    <label key={c}>
                      <input type="checkbox" checked={cols.includes(c)} onChange={() => toggleCol(c)} /> {COLUMN_LABEL[c]}
                    </label>
                  ))}
                </span>
              ) : null}
            </span>
          </div>

          {/* ── Order lane ── */}
          {lane.length ? (
            <div className="task-card-lane" aria-label="Order lane">
              {Array.from({ length: Math.max(...lane.map((n) => n.depth)) + 1 }, (_, d) => (
                <span key={d} className="task-card-lane-col">
                  {lane
                    .filter((n) => n.depth === d)
                    .map((n) => (
                      <button
                        key={n.id}
                        type="button"
                        className={`task-card-lane-node${sel.has(n.id) ? " is-selected" : ""}`}
                        style={{ ["--node" as string]: `${8 + Math.min(4, n.unlocks) * 3}px` }}
                        title={`${n.name}${n.unlocks ? ` · unlocks ${n.unlocks}` : ""}`}
                        aria-label={n.name}
                        onClick={() => setSelected(new Set([n.id]))}
                      />
                    ))}
                </span>
              ))}
            </div>
          ) : null}

          {columnsView ? (
            <ThreeColumns steps={steps} tierOf={tierOf} onSetTier={(id, t) => writeSteps("Step tier", massTier(steps, new Set([id]), t))} />
          ) : (
            <StepTree
              steps={steps}
              onChange={(next) => host.onStepsChange(task.id, next)}
              columns={stepColumns}
              tierTags={has("tier")}
              tier={tier}
              hideLocked={hideLocked}
              nextOnly={nextOnly}
              onOpenStep={(step) => openStepItem(task.id, step.id)}
              onBeforeMove={(label) => runAsAction(label, () => undefined)}
              selected={selected}
              onSelectedChange={setSelected}
              onVisibleIds={setVisibleIds}
              label="Steps"
            />
          )}

          {/* ── Mass edit (R8) ── */}
          {sel.size > 0 ? (
            <div className="task-card-bar" role="toolbar" aria-label="Mass edit">
              <span className="task-card-num">{sel.size} selected</span>
              <MinutesSet onSet={(m) => writeSteps("Set estimate", massEstimate(steps, sel, { set: m }))} />
              {[-15, -5, 5, 15].map((d) => (
                <button key={d} type="button" onClick={bar("Estimate", (s) => massEstimate(s, sel, { delta: d }))}>
                  {d > 0 ? `+${d}` : d}
                </button>
              ))}
              {STEP_TIERS.map((t) => (
                <button key={t} type="button" title={STEP_TIER_LABEL[t]} onClick={bar("Tier", (s) => massTier(s, sel, t))}>
                  {STEP_TIER_SHORT[t]}
                </button>
              ))}
              <button type="button" onClick={bar("Tier", (s) => massTier(s, sel, undefined))}>
                inherit
              </button>
              {pointsVisible ? <MinutesSet label="pts" onSet={(p) => writeSteps("Step points", massPoints(steps, sel, p))} /> : null}
              <button type="button" onClick={bar("Spark", (s) => massSpark(s, sel, true))}>Spark</button>
              <button type="button" onClick={bar("Clear spark", (s) => massSpark(s, sel, false))}>Clear spark</button>
              <select
                aria-label="All need one step"
                value=""
                onChange={(e) => e.target.value && writeSteps("Needs", needsAll(steps, sel, e.target.value))}
              >
                <option value="">Needs…</option>
                {flattenSteps(steps)
                  .filter((s) => !sel.has(s.id))
                  .map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.description}
                    </option>
                  ))}
              </select>
              <button type="button" onClick={() => writeSteps("Chain", chainNeeds(steps, ordered))} disabled={ordered.length < 2}>
                Chain
              </button>
              <button type="button" onClick={bar("Clear needs", (s) => clearNeeds(s, sel))}>Clear needs</button>
              <button type="button" onClick={bar("Done", (s) => massDone(s, sel, true))}>Done</button>
              <button type="button" onClick={bar("Not done", (s) => massDone(s, sel, false))}>Not done</button>
              <select
                aria-label="Move under"
                value=""
                onChange={(e) => e.target.value && writeSteps("Move", moveSteps(steps, sel, { id: e.target.value, where: "inside" }))}
              >
                <option value="">Move under…</option>
                {flattenSteps(steps)
                  .filter((s) => !sel.has(s.id))
                  .map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.description}
                    </option>
                  ))}
              </select>
              <button
                type="button"
                className="is-delete"
                onClick={() => {
                  writeSteps("Delete steps", massDelete(steps, sel))
                  setSelected(new Set())
                }}
              >
                Delete
              </button>
              <button
                type="button"
                onClick={() => openSession({ startOn: "session", seed: ordered.map((stepId) => ({ taskId: task.id, stepId })) })}
              >
                Session with these
              </button>
            </div>
          ) : null}
        </section>

        {/* ── Side panel ── */}
        <aside className="task-card-side">
          <section aria-label="Points">
            <h3>Points</h3>
            <p>
              <span className="task-card-num">{pts.points}</span> · {pts.source}
            </p>
            <label className="task-card-field">
              Quick points
              <input
                type="number"
                min={0}
                aria-label="Quick points"
                value={task.pointsOverride ?? ""}
                placeholder={String(pts.points)}
                onChange={(e) => {
                  const raw = e.target.value
                  const next = { ...task }
                  if (raw === "") delete next.pointsOverride
                  else next.pointsOverride = Math.max(0, Number(raw) || 0)
                  updateTask(next)
                }}
              />
            </label>
            {task.pointsOverride != null ? (
              <button
                type="button"
                className="task-card-key"
                onClick={() => {
                  const next = { ...task }
                  delete next.pointsOverride
                  updateTask(next)
                }}
              >
                Back to the rule
              </button>
            ) : null}
          </section>

          <section aria-label="Prerequisites">
            <h3>Needs</h3>
            {blockers.length ? (
              <p>{blockers.map((b) => `${itemTitleOrUntitled(b)}${b.completed ? " ✓" : ""}`).join(", ")}</p>
            ) : (
              <p className="is-quiet">Nothing first.</p>
            )}
            <button type="button" className="task-card-key" onClick={() => host.onNeeds(task.id)}>
              Needs…
            </button>
            <h3>Unlocks</h3>
            {waiting.length ? (
              <ul className="task-card-list">
                {waiting.map((w) => (
                  <li key={w.task.id}>{itemTitleOrUntitled(w.task)}</li>
                ))}
              </ul>
            ) : (
              <p className="is-quiet">Nothing waits on this.</p>
            )}
            {due ? (
              <p className="task-card-due" data-testid="task-card-due">
                due {due.due.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" })} for{" "}
                {itemTitleOrUntitled(due.forTask)}
              </p>
            ) : null}
          </section>

          <section aria-label="This period">
            <h3>This {host.period}</h3>
            <dl className="task-card-dl">
              <dt>Marks</dt>
              <dd>
                {[host.isRequired(task.id) ? "Required" : null, host.isPrioritized(task.id) ? "Prioritized" : null].filter(Boolean).join(" · ") || "—"}
              </dd>
              <dt>Pushes</dt>
              <dd>
                in {pushes.in} · out {pushes.out}
              </dd>
              <dt>Spent</dt>
              <dd>
                {attention.minutes}m this {host.period} · {spent}m all time
              </dd>
              <dt>Left for {STEP_TIER_LABEL[chosenLevel]}</dt>
              <dd className={remaining > dayLeftMin ? "is-over" : undefined}>
                {remaining}m · {dayLeftMin}m left today
              </dd>
              <dt>Level</dt>
              <dd>
                {reached === "none" ? "none yet" : STEP_TIER_LABEL[reached]} ·{" "}
                {STEP_TIERS.map((t) => `${STEP_TIER_SHORT[t]} ${formatPercent(percents[t])}`).join(" · ")}
              </dd>
              <dt>Sessions</dt>
              <dd>
                {sessions.length
                  ? sessions
                      .slice(-5)
                      .map((p) => `${p.title || "Session"}${p.reachedTier && p.reachedTier !== "none" ? ` (${STEP_TIER_LABEL[p.reachedTier]})` : ""}`)
                      .join(", ")
                  : "—"}
              </dd>
            </dl>
            {attentionGivenLabel(attention) ? <p className="is-quiet">{attentionGivenLabel(attention)}</p> : null}
          </section>

          {totalPushes(task) >= 3 || answers.length ? (
            <section aria-label="Notice">
              <h3>Notice</h3>
              {answers.map((a) => (
                <p key={a.id} className="task-card-notice">
                  <span className="is-quiet">{a.date}</span> {a.text}
                </p>
              ))}
              {needsNotice(task) ? (
                <input
                  className="task-card-notice-input"
                  aria-label="Notice answer"
                  placeholder={NOTICE_PROMPT}
                  value={noticeDraft}
                  onChange={(e) => setNoticeDraft(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key !== "Enter" || !noticeDraft.trim()) return
                    updateTask(withNoticeAnswer(task, noticeDraft))
                    setNoticeDraft("")
                  }}
                />
              ) : null}
            </section>
          ) : null}

          <p className="is-quiet">Notes, Resources and Links live in item detail.</p>
        </aside>
      </div>
    </div>
  )
}

function MinutesSet({ onSet, label = "m" }: { onSet: (n: number) => void; label?: string }) {
  const [v, setV] = useState("")
  return (
    <input
      className="task-card-pts"
      type="number"
      min={0}
      aria-label={label === "m" ? "Set estimate" : "Set points"}
      placeholder={label === "m" ? "set m" : "set pts"}
      value={v}
      onChange={(e) => setV(e.target.value)}
      onKeyDown={(e) => {
        if (e.key !== "Enter" || v === "") return
        onSet(Math.max(0, Number(v) || 0))
        setV("")
      }}
    />
  )
}

/** B | G | E side by side. Each column lists the steps of that band; dragging a step to another column sets its tier. */
function ThreeColumns({
  steps,
  tierOf,
  onSetTier,
}: {
  steps: Subtask[]
  tierOf: Map<string, StepTier>
  onSetTier: (id: string, tier: StepTier) => void
}) {
  const all = flattenSteps(steps)
  return (
    <div className="task-card-three">
      {STEP_TIERS.map((t) => {
        const band = tierBand(steps, t)
        return (
          <div
            key={t}
            className="task-card-three-col"
            data-tier={t}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault()
              const id = e.dataTransfer.getData("text/step-id")
              if (id && tierOf.get(id) !== t) onSetTier(id, t)
            }}
          >
            <h4>{STEP_TIER_LABEL[t]}</h4>
            {all.map((s) =>
              band.has(s.id) ? (
                <div
                  key={s.id}
                  className={`task-card-three-step${s.completed ? " is-done" : ""}${s.subtasks?.some((k) => !band.has(k.id)) ? " is-greyed" : ""}`}
                  draggable
                  onDragStart={(e) => e.dataTransfer.setData("text/step-id", s.id)}
                >
                  {s.description}
                </div>
              ) : null,
            )}
          </div>
        )
      })}
    </div>
  )
}
