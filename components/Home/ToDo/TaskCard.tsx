/**
 * components/Home/ToDo/TaskCard.tsx — The To Do task card (Phase 12, R7 R8 R15)
 *
 * Planning this period's work on one task. Item detail edits the whole item,
 * the lid makes one-line changes; the card holds the full step tree with a
 * column picker, mass edit, points (own and per step), prerequisites (Needs chips, an order
 * lane, what this unlocks and any inherited due date), the notice-dot answers
 * and the period values. It writes through the same store calls as the lid
 * (`onStepsChange` = the panel's `handleSteps`, `updateTask`), so the lid,
 * the card and item detail always agree. **↗ Item** opens item detail on top
 * (`pushItemLayer`); item detail's **Card** opens this. Mounted once in
 * `todo-panel.tsx`; which task is open lives in `lib/task-card.ts`.
 */
"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import type { ReactNode } from "react"
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog"
import { KeycapClose } from "@/components/keycap-close"
import { SpentBlocks } from "./SpentBlocks"
import { StepTree, type StepRowInfo } from "@/components/steps/StepTree"
import { SplitGauge } from "@/components/steps/TreeMath"
import { tierSplit } from "@/lib/tree-math"
import { externalWaits, needCount } from "@/lib/node-needs"
import { isStepLocked } from "@/components/steps/step-tree-view"
import { TaskCardPeriod } from "./TaskCardPeriod"
import { LogNotes, NeedsEditor, NodeDetail, OpenItemKey, SelectionSummary, TaskPens, TaskPoints, TaskUnlocks } from "./TaskCardSide"
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
import { STEP_TIERS, STEP_TIER_LABEL, STEP_TIER_SHORT, effectiveTierMap, stepsForTier, tierBand } from "@/lib/step-tiers"
import { formatPercent, levelReached } from "@/lib/step-progress"
import { effectiveDurationMinutes, flattenSteps, moveSteps } from "@/lib/todo-steps"
import { stepPrereqChoices, toggleStepPrereq } from "@/lib/prereqs"
import { inheritedDue, waitingOn } from "@/lib/unlock-value"
import { NOTICE_PROMPT, needsNotice, totalPushes, withNoticeAnswer } from "@/lib/notice-dot"
import { partsMinutes } from "@/lib/tracked-time"
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
  openSubCard,
  orderLane,
  replaceKids,
  setEstimate,
  stepTrail,
  periodPushes,
  remainingForLevel,
  stepPointsEarned,
  taskPointsWithSource,
  useTaskCardStore,
} from "@/lib/task-card"
import type { StepTier, Subtask, Task } from "@/lib/types"
import { EstimateCell } from "./EstimateCell"
import { CardSection } from "./CardSection"
import { PriorityStar } from "./PriorityStar"
import { CircleAlert } from "lucide-react"
import { TaskCardStats } from "./TaskCardStats"
import { attentionGiven, attentionGivenLabel } from "./attention-given"
import { pushedKeyForPeriod, todoPeriodValue, type TodoPeriod } from "./todo-utils"
import type { TodoTimeInfo } from "./TodoBreakdown"
import "./task-card.css"
import { NativeSelect } from "@/components/ui/native-select"

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
const DEFAULT_COLS: CardColumn[] = ["tier", "est", "lock", "clock"]

const inOtherLayer = (event: Event) => {
  const target = ((event as CustomEvent<{ originalEvent?: Event }>).detail?.originalEvent?.target ?? event.target) as Element | null
  return !!target?.closest?.("[data-item-layer], [role='dialog']:not(.task-card)")
}

const ORDER_KEY = "brain2-task-card-order-open"

/**
 * Esc closes the card only when nothing would be lost: not while Just Start or
 * another layer sits on top, and not over typed text (`[data-draft]`) without a yes.
 */
function guardEscape(event: KeyboardEvent): void {
  if (document.querySelector("[data-item-layer], .tcs-stat-pop")) return event.preventDefault()
  const dirty = [...document.querySelectorAll<HTMLInputElement | HTMLTextAreaElement>(".task-card [data-draft]")].some(
    (el) => el.value.trim() !== (el.dataset.draft ?? "").trim(),
  )
  if (dirty && !window.confirm("Discard what you typed and close the card?")) event.preventDefault()
}

export function TaskCard({ host }: { host: TaskCardHost }) {
  const taskId = useTaskCardStore((s) => s.taskId)
  const focusStepId = useTaskCardStore((s) => s.stepId)
  const rootStepId = useTaskCardStore((s) => s.rootStepId)
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
          onEscapeKeyDown={guardEscape}
        >
          <TaskCardBody key={`${task.id}:${rootStepId ?? ""}`} task={task} tasks={tasks} host={host} focusStepId={focusStepId} rootStepId={rootStepId} />
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
  rootStepId,
}: {
  task: Task
  tasks: Task[]
  host: TaskCardHost
  focusStepId?: string
  rootStepId?: string
}) {
  const updateTask = useTaskStore((s) => s.updateTask)
  const lists = useTaskStore((s) => s.lists)
  const folders = useTaskStore((s) => s.folders)
  const entries = useTimeTrackingStore((s) => s.entries)
  const history = useSessionPlanStore((s) => s.history)
  const pointsVisible = useStepPointsVisible()
  const steps = useMemo(() => task.subtasks ?? [], [task.subtasks])
  // A sub-card: one step is the root. Edits still go to the whole tree; only the view narrows.
  const trail = useMemo(() => (rootStepId ? stepTrail(steps, rootStepId) : []), [steps, rootStepId])
  const root = trail.length ? trail[trail.length - 1] : undefined
  const view = useMemo(() => (root ? root.subtasks ?? [] : steps), [root, steps])
  const taskName = itemTitleOrUntitled(task)
  const name = root ? root.description : taskName
  const time = host.timeOf?.(task.id)

  const [selected, setSelected] = useState<ReadonlySet<string>>(() => (focusStepId ? new Set([focusStepId]) : new Set()))
  const [visibleIds, setVisibleIds] = useState<string[]>([])
  const [spentStep, setSpentStep] = useState<string | null>(null)
  const [cols, setCols] = useState<CardColumn[]>(DEFAULT_COLS)
  const [moreBar, setMoreBar] = useState(false)
  const [tier, setTier] = useState<StepTier | undefined>()
  const [estimateTier, setEstimateTier] = useState<StepTier>("exceptional")
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

  const writeSteps = (label: string, next: Subtask[]) => runAsAction(label, () => host.onStepsChange(task.id, next))
  const sel = selected
  const ordered = visibleIds.filter((id) => sel.has(id))
  const bar = (label: string, edit: (s: Subtask[]) => Subtask[]) => () => writeSteps(label, edit(steps))

  // ── Numbers ──
  const ownEst = root ? root.estimatedDuration : task.estimatedDuration
  const est = useMemo(() => {
    if (estimateTier === "exceptional") {
      return effectiveDurationMinutes(ownEst, view)
    }
    const tierView = stepsForTier(view, estimateTier)
    const filterForTier = (list: readonly Subtask[]): Subtask[] =>
      list
        .filter((s) => tierView.ids.has(s.id) || tierView.containers.has(s.id))
        .map((s) => ({
          ...s,
          estimatedDuration: tierView.ids.has(s.id) ? s.estimatedDuration : undefined,
          subtasks: s.subtasks?.length ? filterForTier(s.subtasks) : undefined,
        }))
    const allIncluded = view.length === 0 || tierView.ids.size === flattenSteps(view).length
    return effectiveDurationMinutes(allIncluded ? ownEst : undefined, filterForTier(view))
  }, [estimateTier, ownEst, view])
  const spent = root ? (time?.stepSpent?.get(root.id) ?? 0) : (time?.spent ?? 0)
  const statsTierExtra = {
    estimateTier,
    onEstimateTierChange: setEstimateTier,
    stepSpent: time?.stepSpent,
    rootCompleted: root ? root.completed : task.completed,
  }
  const pts = taskPointsWithSource(task, lists, folders)
  const earned = stepPointsEarned(steps, task.stepPoints)
  const reached = levelReached(task, task.completed)
  const tierAmounts = activeTierPoints()
  const levelPts = reached === "min" ? tierAmounts.bareMin : reached === "goal" ? tierAmounts.goal : reached === "exceptional" ? tierAmounts.exceptional : 0
  const pushKey = pushedKeyForPeriod(host.period)
  const periodValue = todoPeriodValue(host.period, host.focusedDate)
  const pushes = periodPushes(task, host.period, periodValue)
  const attention = attentionGiven([task], entries, host.period, host.focusedDate)
  const waiting = waitingOn(task.id, tasks)
  const due = inheritedDue(task.id, tasks, host.focusedDate)
  const blockers = (task.dependencies ?? []).map((id) => tasks.find((t) => t.id === id)).filter((t): t is Task => !!t)
  const lane = orderLane(view)
  const tierOf = useMemo(() => effectiveTierMap(steps), [steps])
  const flat = useMemo(() => flattenSteps(steps), [steps])
  const viewFlat = useMemo(() => flattenSteps(view), [view])
  const levels = useMemo(() => tierSplit(view, tierOf), [view, tierOf])
  const taskById = useMemo(() => new Map(tasks.map((t) => [t.id, t])), [tasks])
  const extraLock = useCallback((step: Subtask) => externalWaits(step, (id) => taskById.get(id)).length > 0, [taskById])
  const rowLevels = useMemo(() => new Map(viewFlat.filter((s) => s.subtasks?.length).map((s) => [s.id, tierSplit(steps, tierOf, s)])), [viewFlat, steps, tierOf])
  const chosenLevel: StepTier = tier ?? "goal"
  const remaining = remainingForLevel(view, chosenLevel, host.defaultEstimateMin ?? 0)
  const dayLeftMin = Math.max(0, Math.round(host.hoursLeft * 60))
  const sessions = history.filter((plan) => allLines(plan).some(({ line }) => line.taskId === task.id))
  const answers = noticeAnswers(task)
  const oneStep = sel.size === 1 ? flat.find((s) => sel.has(s.id)) : undefined
  const onClock = !!host.clockTaskId && host.clockTaskId === task.id

  const stepColumns = (step: Subtask, info: StepRowInfo): ReactNode => {
    const needNames = (step.dependsOn ?? []).map((id) => flat.find((s) => s.id === id)?.description).filter(Boolean)
    const unlockCount = has("unlocks") ? lane.find((n) => n.id === step.id)?.unlocks ?? 0 : 0
    return (
      <span className="task-card-cols">
        {has("pct") ? <SplitGauge levels={rowLevels.get(step.id) ?? null} focus={tier} /> : null}
        {has("est") ? <EstimateCell minutes={step.estimatedDuration} label={step.description} onSet={(m) => writeSteps("Estimate", setEstimate(steps, step.id, m))} /> : null}
        {has("parts") && step.subtasks?.length ? <span className="task-card-num">={partsMinutes(step.subtasks)}m</span> : null}
        {has("spent") ? <span className="task-card-num is-quiet">
            {time?.stepSpent?.get(step.id) ? (
              <button type="button" className="task-card-spent-btn" title="See the time blocks and objectives behind this" onClick={(ev) => (ev.stopPropagation(), setSpentStep(step.id))}>
                {time.stepSpent.get(step.id)}m
              </button>
            ) : null}
          </span> : null}
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
        {has("needs") && needCount(step) ? (
          <span className="task-card-num task-card-needcount" title={`Needs ${needCount(step)}${needNames.length ? `: ${needNames.join(", ")}` : ""}. Select the step to edit its needs.`}>
            needs {needCount(step)}
          </span>
        ) : null}
        {has("lock") && info.locked ? <span className="task-card-lock" title="Waits on an open step, task or event">locked</span> : null}
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
        {root ? (
          <nav className="task-card-crumbs" aria-label="Where this card sits">
            <button type="button" title="Back to the whole task" onClick={() => openSubCard(task.id, undefined)}>
              {taskName}
            </button>
            {trail.slice(0, -1).map((t) => (
              <span key={t.id}>
                <i aria-hidden>›</i>
                <button type="button" title={`Open ${itemTitleOrUntitled(t)} as the card's root`} onClick={() => openSubCard(task.id, t.id)}>
                  {itemTitleOrUntitled(t)}
                </button>
              </span>
            ))}
          </nav>
        ) : null}
        {spentStep && flat.some((x) => x.id === spentStep) ? (
          <section className="task-card-spent-panel" aria-label="Time behind this step">
            <header>
              <b>Time on “{flat.find((x) => x.id === spentStep)?.description}”</b>
              <KeycapClose label="Close time detail" onClick={() => setSpentStep(null)} />
            </header>
            <SpentBlocks
              scope={{
                taskId: task.id,
                stepIds: new Set(flattenSteps([flat.find((x) => x.id === spentStep)!]).map((x) => x.id)),
                names: new Map(flat.map((x) => [x.id, x.description])),
                logs: task.timeLogs,
              }}
            />
          </section>
        ) : null}
        <div className="task-card-title-row">
          <DialogTitle
            className="task-card-name"
            role="button"
            tabIndex={0}
            title="Show the whole task in the side bar"
            onClick={() => setSelected(new Set())}
            onKeyDown={(e) => (e.key === "Enter" || e.key === " " ? (e.preventDefault(), setSelected(new Set())) : undefined)}
          >
            {name}
          </DialogTitle>
          <button type="button" className="task-card-key" title="Open item detail on top" onClick={() => (root ? openStepItem(task.id, root.id) : pushItemLayer(task.id))}>
            ↗ Item
          </button>
          <span className="task-card-plate">{host.periodLabel}</span>
          <button
            type="button"
            className="task-card-jewel is-required is-icon"
            title={`Required ${host.isRequired(task.id) ? "on" : "off"} for ${host.periodLabel.toLowerCase()}: must happen. Click to turn ${host.isRequired(task.id) ? "off" : "on"}.`}
            aria-label="Required"
            aria-pressed={host.isRequired(task.id)}
            onClick={() => host.onToggleRequired(task.id)}
          >
            <CircleAlert size={17} aria-hidden />
          </button>
          <PriorityStar task={task} on={host.isPrioritized(task.id)} periodLabel={host.periodLabel} onToggle={() => host.onTogglePrioritized(task.id)} />
          <span className={`task-card-lamp is-${task.completed ? "done" : (task.status ?? "active")}`} title="State">
            {COMPLETION_STATUS_LABELS[task.completed ? "done" : (task.status ?? "active")] ?? "Active"}
          </span>
          {(task[pushKey] ?? 0) > 2 ? (
            <span className="task-card-pushflag" title={`Pushed ${task[pushKey]} times this ${host.period}. Shrink it, split it, or drop it.`}>
              ↻ pushed ×{task[pushKey]}
            </span>
          ) : null}
          <KeycapClose className="task-card-close" title="Close the card (Esc)" label="Close the card" onClick={closeTaskCard} />
        </div>
        <div className="task-card-title-row">
          <TaskCardStats
            data={{
              view,
              tierOf,
              levels,
              tier,
              est,
              ownEst,
              estLog: root?.estimateLog,
              parts: partsMinutes(view),
              spent,
              periodSpent: attention.minutes,
              spentScope: {
                taskId: task.id,
                stepIds: root ? new Set(flattenSteps([root]).map((x) => x.id)) : undefined,
                names: new Map(flat.map((x) => [x.id, x.description])),
                logs: task.timeLogs,
              },
              periodLabel: host.period,
              penPool: time?.penPool,
              pts,
              earned,
              pointsVisible,
              levelName: reached === "none" ? "none" : STEP_TIER_LABEL[reached],
              levelPts,
              onPick: (id) => setSelected(new Set([id])),
              ...statsTierExtra,
            }}
          />
          <span className="task-card-spacer" />
          {host.onClockStart ? (
            <DvdTransportKey
              mark={onClock ? "stop" : "play"}
              pressed={onClock}
              label={onClock ? `Stop the clock on ${name}` : `Working on ${name} now`}
              onClick={() => (onClock ? host.onClockStop?.() : host.onClockStart?.(task.id))}
            />
          ) : null}
          <button type="button" className="task-card-key" title="Start the next open step now" onClick={() => host.onJustStart(task.id)}>
            Just Start
          </button>
          <button
            type="button"
            className="task-card-key"
            title="A 25-minute session on this task"
            onClick={() => openSession({ startOn: "session", templateId: JUST_25_TEMPLATE_ID, seed: [{ taskId: task.id }] })}
          >
            Just 25
          </button>
          <button type="button" className="task-card-key" title="Plan a session around this task" onClick={() => openSession({ startOn: "session", seed: [{ taskId: task.id }] })}>
            Session with this
          </button>
        </div>
      </header>

      <div className="task-card-main">
        <div className="task-card-tree">
          {/* ── Order ── */}
          {lane.length ? (
            <CardSection
              title="Order"
              count={lane.length}
              storageKey={ORDER_KEY}
              className="task-card-order"
              summary={`${lane.length} ${lane.length === 1 ? "step" : "steps"} · ${lane.filter((n) => n.depth > 0).length} in sequence`}
            >
              <div className="task-card-lane" aria-label="Order lane">
                {Array.from({ length: Math.max(...lane.map((n) => n.depth)) + 1 }, (_, d) => (
                  <span key={d} className="task-card-lane-col" data-arrow={d ? "→" : undefined}>
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
                        >
                          <i aria-hidden />
                          {n.name}
                          {n.unlocks ? <small> ⇢{n.unlocks}</small> : null}
                        </button>
                      ))}
                  </span>
                ))}
              </div>
            </CardSection>
          ) : null}

          <CardSection title="Steps" count={viewFlat.length} className="task-card-plan">
          {/* ── View switches ── */}
          <div className="task-card-switches" role="toolbar" aria-label="Step view">
            <span className="task-card-seg" role="group" aria-label="Level filter">
              <button type="button" aria-pressed={!tier} title="Show every level" onClick={() => setTier(undefined)}>
                All
              </button>
              {STEP_TIERS.map((t) => (
                <button key={t} type="button" aria-pressed={tier === t} title={`Show only what counts for ${STEP_TIER_LABEL[t]}`} onClick={() => setTier(t)}>
                  {STEP_TIER_SHORT[t]}
                </button>
              ))}
            </span>
            <label>
              <input type="checkbox" title="Hide steps that wait on something" checked={hideLocked} onChange={(e) => setHideLocked(e.target.checked)} /> Hide locked
            </label>
            <label>
              <input type="checkbox" title="Under each branch, show only the next step to do" checked={nextOnly} onChange={(e) => setNextOnly(e.target.checked)} /> Show next only
            </label>
            <button
              type="button"
              className="task-card-key"
              aria-pressed={columnsView}
              title={columnsView ? "Back to the step tree" : "Lay steps out in B | G | E columns; drag between them to change level"}
              onClick={() => setColumnsView((v) => !v)}
            >
              List mode
            </button>
            <button type="button" className="task-card-key" title="Select every step not yet done" onClick={() => setSelected(new Set(openStepIds(view)))}>
              Select all open
            </button>
            <button type="button" className="task-card-key" title="Select every end node (steps with nothing inside)" onClick={() => setSelected(new Set(leafStepIds(view)))}>
              Select leaves
            </button>
            <button type="button" className="task-card-key" title="Clear the selection (Esc)" disabled={!sel.size} onClick={() => setSelected(new Set())}>
              Deselect all
            </button>
          </div>

          {columnsView ? (
            <ThreeColumns steps={view} tierOf={tierOf} onSetTier={(id, t) => writeSteps("Step tier", massTier(steps, new Set([id]), t))} />
          ) : (
            <StepTree
              steps={view}
              onChange={(next) => host.onStepsChange(task.id, root ? replaceKids(steps, root.id, next) : next)}
              columns={stepColumns}
              tierTags={has("tier")}
              tier={tier}
              hideLocked={hideLocked}
              nextOnly={nextOnly}
              extraLock={extraLock}
              onOpenStep={(step) => openStepItem(task.id, step.id)}
              checkboxSelects
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
              {STEP_TIERS.map((t) => (
                <button key={t} type="button" title={`Set selected steps to ${STEP_TIER_LABEL[t]}`} onClick={bar("Tier", (s) => massTier(s, sel, t))}>
                  {STEP_TIER_SHORT[t]}
                </button>
              ))}
              <button type="button" title="Tick the selected steps" onClick={bar("Done", (s) => massDone(s, sel, true))}>Done</button>
              <button type="button" className="task-card-key" aria-expanded={moreBar} title="More edits for the selected steps" onClick={() => setMoreBar((v) => !v)}>
                {moreBar ? "Fewer" : "More…"}
              </button>
              {moreBar ? (
                <span className="task-card-bar-more">
                  <MinutesSet onSet={(m) => writeSteps("Set estimate", massEstimate(steps, sel, { set: m }))} />
              {[-15, -5, 5, 15].map((d) => (
                <button key={d} type="button" title={`${d > 0 ? "Add" : "Take"} ${Math.abs(d)} minutes on each selected step`} onClick={bar("Estimate", (s) => massEstimate(s, sel, { delta: d }))}>
                  {d > 0 ? `+${d}` : d}
                </button>
              ))}
                                          <button type="button" title="Clear their own level; they take their parent's" onClick={bar("Tier", (s) => massTier(s, sel, undefined))}>
                inherit
              </button>
              {pointsVisible ? <MinutesSet label="pts" onSet={(p) => writeSteps("Step points", massPoints(steps, sel, p))} /> : null}
              <button type="button" title="Mark these as steps that pull you" onClick={bar("Spark", (s) => massSpark(s, sel, true))}>Spark</button>
              <button type="button" title="Clear the spark mark" onClick={bar("Clear spark", (s) => massSpark(s, sel, false))}>Clear spark</button>
              <NativeSelect
                aria-label="All need one step"
                title="Make every selected step wait on one step"
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
              </NativeSelect>
              <button type="button" title="Each selected step waits on the one above it" onClick={() => writeSteps("Chain", chainNeeds(steps, ordered))} disabled={ordered.length < 2}>
                Chain
              </button>
              <button type="button" title="Drop the step needs of the selected steps" onClick={bar("Clear needs", (s) => clearNeeds(s, sel))}>Clear needs</button>
                            <button type="button" title="Untick the selected steps" onClick={bar("Not done", (s) => massDone(s, sel, false))}>Not done</button>
              <NativeSelect
                aria-label="Move under"
                title="Nest the selected steps inside another step"
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
              </NativeSelect>
              <button
                type="button"
                className="is-delete"
                title="Delete the selected steps (undo with ⌘Z)"
                onClick={() => {
                  writeSteps("Delete steps", massDelete(steps, sel))
                  setSelected(new Set())
                }}
              >
                Delete
              </button>
              <button
                type="button"
                title="Plan a session with just these steps"
                onClick={() => openSession({ startOn: "session", seed: ordered.map((stepId) => ({ taskId: task.id, stepId })) })}
              >
                Session with these
              </button>
                </span>
              ) : null}
            </div>
          ) : null}
          </CardSection>
        </div>

        {/* ── Side panel ── */}
        <aside className="task-card-side">
          {(sel.size === 1 && oneStep) || (sel.size === 0 && root) ? (
            <NodeDetail
              isRoot={sel.size === 0}
              onSelect={(id) => setSelected(new Set([id]))}
              task={task}
              step={(oneStep ?? root)!}
              steps={steps}
              write={writeSteps}
              tier={tierOf.get((oneStep ?? root)!.id) ?? "goal"}
              locked={isStepLocked(steps, (oneStep ?? root)!, extraLock)}
              spent={time?.stepSpent?.get((oneStep ?? root)!.id)}
            />
          ) : sel.size > 1 ? (
            <SelectionSummary steps={steps} ids={sel} tierOf={tierOf} isLocked={(st) => isStepLocked(steps, st, extraLock)} spentOf={(id) => time?.stepSpent?.get(id) ?? 0} />
          ) : (
          <>
          <header className="tcs-node-head is-task">
            <p className="tcs-path" title="The whole task this card is about">
              {host.periodLabel} · whole task
            </p>
            <div className="tcs-name-row">
              <h3 className="tcs-node-name">{name}</h3>
              <OpenItemKey onClick={() => pushItemLayer(task.id)} />
            </div>
            <p className="tcs-node-meta">
              <span className={`tcs-lamp is-${task.completed ? "done" : "open"}`}>{task.completed ? "done" : (task.status ?? "active")}</span>
              <span className="tcs-meta-pill">{est ? `${est}m` : "—"} est</span>
              {spent ? <span className="tcs-meta-pill">{spent}m spent</span> : null}
              {flat.length ? <span className="tcs-meta-pill" title="Steps done / steps">{flat.filter((x) => x.completed).length}/{flat.length} steps</span> : null}
            </p>
          </header>

          <TaskPoints task={task} />
          <TaskPens task={task} />

          <section aria-label="Prerequisites" className="tcs-needs tcs-control-card">
            <h3>Needs</h3>
            <NeedsEditor task={task} steps={steps} write={writeSteps} />
            <TaskUnlocks task={task} />
            {due ? (
              <p className="task-card-due" data-testid="task-card-due">
                due {due.due.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" })} for{" "}
                {itemTitleOrUntitled(due.forTask)}
              </p>
            ) : null}
          </section>

          <TaskCardPeriod
            period={host.period}
            required={host.isRequired(task.id)}
            prioritized={host.isPrioritized(task.id)}
            onToggleRequired={() => host.onToggleRequired(task.id)}
            onTogglePrioritized={() => host.onTogglePrioritized(task.id)}
            pushed={task[pushKey] ?? 0}
            pushesIn={pushes.in}
            pushesOut={pushes.out}
            periodMinutes={attention.minutes}
            allTimeMinutes={spent}
            penPool={time?.penPool}
            level={chosenLevel}
            reached={reached}
            split={Object.fromEntries(STEP_TIERS.map((t) => [t, levels[t]?.split ?? null]))}
            remaining={remaining}
            dayLeft={dayLeftMin}
            sessions={sessions.map((p) => ({ title: p.title, tier: p.reachedTier }))}
            attentionNote={attentionGivenLabel(attention) || undefined}
            aimed={tier}
            onAim={setTier}
          />

          </>
          )}

          <LogNotes task={task} nodeId={sel.size === 1 ? [...sel][0] : undefined} nodeName={(id) => flat.find((x) => x.id === id)?.description} />
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
      data-draft=""
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
