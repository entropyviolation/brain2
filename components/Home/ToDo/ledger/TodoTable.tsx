/**
 * components/Home/ToDo/ledger/TodoTable.tsx — Period to-do ledger
 *
 * Closed rows show the name (padded), a tier menu, the active lamp, the glass
 * tube at σ (the task card's average completion), and two keys: Card (opens
 * the task card) and ▶ (the pen clock).
 * Click / Enter opens one clamshell lid: the header name is the only edit
 * field. The lid's Actions line holds every other verb (Done, Done at B/G,
 * Start, Just 25, Push, Missed, Needs…, View, Delete); Flags (the willpower
 * gems), Time, and Steps fold independently. Mutations stay on the orchestrator.
 */
"use client"

import { useEffect, useRef, useState } from "react"
import type { KeyboardEvent } from "react"
import type { CompletionStatus, StepTier, Subtask, TodoItem } from "@/lib/types"
import { COMPLETION_STATUS_LABELS } from "@/lib/completion-status"
import { PercentLedBar } from "@/components/Home/Habits/percent-led-bar"
import { compactDuration } from "@/lib/time-entries"
import { effectiveDurationMinutes, flattenSteps, formatInternalProgress } from "@/lib/todo-steps"
import { splitPercent } from "@/lib/tree-math"
import { getScheduleLabel, pushedKeyForPeriod, toggleTodoActiveLamp, type TodoPeriod } from "../todo-utils"
import { itemTitle } from "@/lib/item-utils"
import { TodoBreakdown, TodoDeleteButton, TodoLidSection, type TodoTimeInfo } from "../TodoBreakdown"
import { DvdTransportKey } from "@/components/dvd-transport-keys"
import { openSession } from "@/lib/session-open-store"
import { JUST_25_TEMPLATE_ID } from "@/lib/session-plan"
import { NOTICE_PROMPT } from "@/lib/notice-dot"
import { hasStepTiers } from "@/lib/step-tiers"
import { levelReached } from "@/lib/step-progress"
import { openStepItem } from "@/lib/step-item-stack"
import { openTaskCard } from "@/lib/task-card"
import { stopTaskSubclock } from "@/lib/task-clock"
import { usePenColorSessionStore } from "@/lib/pen-color-session-store"
import { NativeSelect } from "@/components/ui/native-select"

const COLLAPSE_THRESHOLD = 8

/** Willpower gems for the lid's Flags (same family as Habits). */
const GEM_REQUIRED = "/gems-removebackground/gem5.png"
const GEM_PRIORITIZED = "/gems-removebackground/e7a4b25a506e2ab9c20179cbc56da911.png"

const TIERS: TodoItem["tier"][] = ["A+", "A", "A/B", "B", "C", "D"]

const TIER_HINT: Record<TodoItem["tier"], string> = {
  "A+": "Highest urgency and importance",
  A: "High urgency and importance",
  "A/B": "High urgency or importance",
  B: "Solid mid priority",
  C: "Lower urgency and importance",
  D: "Lowest urgency and importance",
}

function statusLampClass(status: CompletionStatus): string {
  if (status === "partial") return "is-power"
  if (status === "deferred") return "is-cold"
  if (status === "cancelled") return "is-off"
  return "is-live"
}

/** True when a Time-cell pair must both use `xhxm`, including `0h40`. */
function pairUsesHours(a: number, b: number): boolean {
  return Math.round(a) >= 60 || Math.round(b) >= 60
}

/** "Waiting since Tue" within a week, "Waiting since Sep 3" past it. Neutral words (Phase 15 B). */
export function waitingSinceLabel(daysWaiting: number, now: Date = new Date()): string {
  const since = new Date(now.getFullYear(), now.getMonth(), now.getDate() - daysWaiting)
  const word =
    daysWaiting < 7
      ? since.toLocaleDateString("en-US", { weekday: "short" })
      : since.toLocaleDateString("en-US", { month: "short", day: "numeric" })
  return `Waiting since ${word}`
}

const BGE_KEYS: { tier: StepTier; short: string; title: string }[] = [
  { tier: "min", short: "B", title: "Bare minimum on this list: must be done at the very least" },
  { tier: "goal", short: "G", title: "Goal on this list: what you aim for" },
  { tier: "exceptional", short: "E", title: "Exceptional on this list: above and beyond" },
]

export function TodoTable({
  todos,
  period,
  isExpanded,
  onToggleExpand,
  onComplete,
  onMissed,
  onPush,
  onDelete,
  onEstimateChange,
  onStepsChange,
  stepsOf,
  estimateOf,
  defaultEstimateMin = 0,
  spentOf,
  timeOf,
  onTaskClick,
  onTierChange,
  onJustStart,
  getStatus,
  onStatusChange,
  isRequired,
  isPrioritized,
  onToggleRequired,
  onTogglePrioritized,
  bgeTierOf,
  onBgeTierChange,
  onRename,
  openRowId,
  onOpenRowIdChange,
  selectedRowId,
  onSelectedRowIdChange,
  dense,
  emptyLabel,
  flockingId,
  isWalkRow,
  clockTaskId,
  clockStepId,
  onClockStart,
  onClockStop,
  blockersOf,
  unlockOf,
  onNeeds,
  noticeOf,
  onNotice,
}: {
  todos: TodoItem[]
  period: TodoPeriod
  isExpanded: boolean
  onToggleExpand: () => void
  /** `level`: Done at Bare minimum / Goal (Phase 10). */
  onComplete: (todoId: string, level?: StepTier) => void
  onMissed: (todoId: string) => void
  onPush: (todoId: string, period: TodoPeriod) => void
  onDelete: (todoId: string) => void
  onEstimateChange: (todoId: string, minutes: number | undefined) => void
  onStepsChange: (todoId: string, steps: Subtask[]) => void
  stepsOf: (todoId: string) => Subtask[] | undefined
  estimateOf: (todoId: string) => number | undefined
  /** Shown as a dim `~30` (or `~0h30` when the pair is in hours) on rows with no estimate and no steps. 0 or missing = a blank, as before. */
  defaultEstimateMin?: number
  /** Minutes logged on the row's task, across days (`trackedMinutesForItem`). Omit to hide. */
  spentOf?: (todoId: string) => number
  /** Spent, step spent and pace for the open lid (`TodoBreakdown` → `time`). */
  timeOf?: (todoId: string) => TodoTimeInfo | undefined
  onTaskClick: (taskId: string) => void
  onTierChange: (todoId: string, tier: TodoItem["tier"]) => void
  onJustStart: (taskId: string) => void
  getStatus: (todoId: string) => CompletionStatus
  onStatusChange: (todoId: string, status: CompletionStatus) => void
  isRequired: (todoId: string) => boolean
  isPrioritized: (todoId: string) => boolean
  onToggleRequired: (todoId: string) => void
  onTogglePrioritized: (todoId: string) => void
  /** B/G/E mode: this row's tier on this list. With `onBgeTierChange`, the Flags line gets the B · G · E keys. */
  bgeTierOf?: (todoId: string) => StepTier
  onBgeTierChange?: (todoId: string, tier: StepTier) => void
  onRename?: (todoId: string, description: string) => void
  openRowId: string | null
  onOpenRowIdChange: (id: string | null) => void
  selectedRowId: string | null
  onSelectedRowIdChange: (id: string | null) => void
  dense?: boolean
  emptyLabel?: string
  flockingId?: string | null
  /** A derived ritual row. Open the rite; do not push, delete, or retier it. */
  isWalkRow?: (todoId: string) => boolean
  /** The task (and step) on the Tracking pen clock, if any. */
  clockTaskId?: string | null
  clockStepId?: string
  /** ▶ on a row or a step. Omit to hide the clock keys. */
  onClockStart?: (taskId: string, stepId?: string) => void
  onClockStop?: () => void
  /** Names of open tasks this row still waits on (`Task.dependencies`). */
  blockersOf?: (taskId: string) => string[]
  /** What waits on this row (Phase 14, `lib/unlock-value.ts`). Null when nothing waits. */
  unlockOf?: (taskId: string) => { count: number; title: string; due?: string; overdue?: boolean } | null
  /** Open the Needs… picker for a task. */
  onNeeds?: (taskId: string) => void
  /** Pushed 3+ times and not answered since (`needsNotice`). Omit to hide the notice dot. */
  noticeOf?: (todoId: string) => boolean
  /** Save the notice answer as a dated `noteLog` entry tagged `notice`. */
  onNotice?: (todoId: string, text: string) => void
}) {
  const [noticeRowId, setNoticeRowId] = useState<string | null>(null)
  const pushedKey = pushedKeyForPeriod(period)
  const pushLabel = period === "day" ? "next day" : period === "week" ? "next week" : "next month"
  const pushPeriodNoun = period === "day" ? "days" : period === "week" ? "weeks" : "months"
  const pushLegend = `Pushes — times moved to the next open ${period}. Counts ${pushPeriodNoun}.`
  const listRef = useRef<HTMLDivElement>(null)
  const penSession = usePenColorSessionStore((s) => s.session)
  const clockSubclocks = penSession?.taskId && penSession.taskId === clockTaskId ? penSession.subclocks : undefined
  const clockStartedAt = penSession?.taskId && penSession.taskId === clockTaskId ? penSession.startedAt : undefined

  const visibleTodos = isExpanded ? todos : todos.slice(0, COLLAPSE_THRESHOLD)
  const hiddenCount = todos.length - visibleTodos.length
  // Join, not the sliced array: slice() is a new array every render and would refocus every time.
  const visibleIdKey = visibleTodos.map((todo) => todo.id).join("\0")

  useEffect(() => {
    if (!selectedRowId) return
    const visibleIds = visibleIdKey.length === 0 ? [] : visibleIdKey.split("\0")
    if (!visibleIds.includes(selectedRowId)) return
    const root = listRef.current
    if (!root) return
    const row = root.querySelector(`[data-todo-row="${selectedRowId}"]`) as HTMLElement | null
    row?.focus({ preventScroll: false })
  }, [selectedRowId, visibleIdKey])

  const handleRowKey = (event: KeyboardEvent, todo: TodoItem) => {
    const target = event.target as HTMLElement
    if (target.closest("input, textarea, select, [contenteditable='true']")) return

    const ids = visibleTodos.map((t) => t.id)
    const at = ids.indexOf(todo.id)

    if (event.key === "ArrowDown") {
      event.preventDefault()
      const next = ids[Math.min(ids.length - 1, at + 1)]
      if (next) onSelectedRowIdChange(next)
      return
    }
    if (event.key === "ArrowUp") {
      event.preventDefault()
      const prev = ids[Math.max(0, at - 1)]
      if (prev) onSelectedRowIdChange(prev)
      return
    }
    if (event.key === "Enter") {
      event.preventDefault()
      if (isWalkRow?.(todo.id)) {
        onTaskClick(todo.id)
        return
      }
      onOpenRowIdChange(openRowId === todo.id ? null : todo.id)
      onSelectedRowIdChange(todo.id)
      return
    }
    if (event.key === "Escape") {
      event.preventDefault()
      onOpenRowIdChange(null)
      return
    }
    if (isWalkRow?.(todo.id) && ["d", "D", "m", "M", "p", "P", "r", "R"].includes(event.key)) {
      event.preventDefault()
      if (event.key === "d" || event.key === "D") onTaskClick(todo.id)
      return
    }
    if (event.key === "d" || event.key === "D") {
      event.preventDefault()
      onComplete(todo.id)
      return
    }
    if (event.key === "m" || event.key === "M") {
      event.preventDefault()
      onMissed(todo.id)
      return
    }
    if (event.key === "p" || event.key === "P") {
      event.preventDefault()
      onPush(todo.id, period)
      return
    }
    if (event.key === "r" || event.key === "R") {
      event.preventDefault()
      onToggleRequired(todo.id)
      return
    }
  }

  return (
    <div
      ref={listRef}
      className={`todo-table${dense ? " is-dense" : ""}`}
      role="list"
    >
      <div className="todo-table-head" role="row">
        <span className="todo-table-head-name">Task</span>
        <span className="todo-table-head-cell" title="Tier — urgency and importance">Tier</span>
        <span className="todo-table-head-cell" title="Active or in progress">State</span>
        <span className="todo-table-head-cell" title="Share of steps finished">Done</span>
        <span className="todo-table-head-cell" title="Minutes that count — the typed estimate or the steps' sum, whichever is larger">Time</span>
        <span className="todo-table-head-cell" title="Steps finished of all steps">Steps</span>
        <span className="todo-table-head-verbs">Actions</span>
        <span className="todo-table-head-push" title={pushLegend}>
          Pushes
          <em>{pushPeriodNoun}</em>
        </span>
      </div>
      {visibleTodos.map((todo) => {
        const status = getStatus(todo.id)
        const pushed = todo[pushedKey]
        const required = isRequired(todo.id)
        const prioritized = isPrioritized(todo.id)
        const name = itemTitle(todo)
        const steps = stepsOf(todo.id)
        const flat = flattenSteps(steps)
        const stepCount = flat.length
        const doneSteps = flat.filter((s) => s.completed).length
        const estimate = estimateOf(todo.id)
        const minutes = effectiveDurationMinutes(estimate, steps)
        const progress = formatInternalProgress(steps)
        const completePct = splitPercent(steps)
        const walk = isWalkRow?.(todo.id) ?? false
        const spent = walk ? 0 : (spentOf?.(todo.id) ?? 0)
        const open = openRowId === todo.id
        const selected = selectedRowId === todo.id
        const flocking = flockingId === todo.id
        const clockId = todo.taskId || todo.id
        const onClock = !walk && clockTaskId === clockId
        const blockers = walk ? [] : (blockersOf?.(clockId) ?? [])
        const unlock = walk ? null : (unlockOf?.(clockId) ?? null)
        const toggleOpen = () => {
          onSelectedRowIdChange(todo.id)
          onOpenRowIdChange(open ? null : todo.id)
        }

        return (
          <div
            key={todo.id}
            className={`todo-row${open ? " is-open" : ""}${selected ? " is-selected" : ""}${flocking ? " is-flocking" : ""}${walk ? " is-ritual" : ""}${onClock ? " is-on-clock" : ""}`}
            data-todo-row={todo.id}
            data-ritual-todo={walk ? todo.id : undefined}
            role="listitem"
            tabIndex={0}
            aria-expanded={open}
            onClick={() => {
              onSelectedRowIdChange(todo.id)
            }}
            onKeyDown={(e) => handleRowKey(e, todo)}
          >
            <div className="todo-row-closed">
              <div className="todo-row-nameplate">
                {open ? (
                  <button
                    type="button"
                    className="todo-row-fold"
                    data-no95
                    aria-expanded
                    aria-label="Collapse task"
                    title="Collapse"
                    onClick={(e) => {
                      e.stopPropagation()
                      toggleOpen()
                    }}
                  />
                ) : null}
                {open && onRename ? (
                  <input
                    className="todo-row-name"
                    type="text"
                    defaultValue={name}
                    aria-label="Task name"
                    onClick={(e) => e.stopPropagation()}
                    onBlur={(e) => {
                      const next = e.target.value.trim()
                      if (next && next !== name) onRename(todo.id, next)
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") (e.target as HTMLInputElement).blur()
                    }}
                  />
                ) : (
                  <button
                    type="button"
                    className="todo-row-name"
                    data-no95
                    title={walk ? `Open ${name}` : name}
                    onClick={(e) => {
                      e.stopPropagation()
                      if (walk) {
                        onTaskClick(todo.id)
                        return
                      }
                      toggleOpen()
                    }}
                  >
                    {name}
                  </button>
                )}
                {blockers.length ? (
                  <button
                    type="button"
                    data-no95
                    className="todo-row-lock"
                    title={`Waiting on: ${blockers.join(", ")}. Click to change.`}
                    onClick={(e) => {
                      e.stopPropagation()
                      onNeeds?.(clockId)
                    }}
                  >
                    needs {blockers.join(", ")}
                  </button>
                ) : null}
                {unlock ? (
                  <span className="todo-row-unlocks" title={unlock.title}>
                    unlocks {unlock.count}
                  </span>
                ) : null}
                {unlock?.due ? (
                  <span className="todo-row-inherited-due" data-overdue={unlock.overdue ? "true" : undefined}>
                    {unlock.due}
                  </span>
                ) : null}
                {!walk && onNotice && noticeOf?.(todo.id) ? (
                  <button
                    type="button"
                    data-no95
                    className="todo-notice-dot"
                    aria-label="Notice"
                    title={NOTICE_PROMPT}
                    aria-expanded={noticeRowId === todo.id}
                    onClick={(e) => {
                      e.stopPropagation()
                      setNoticeRowId((id) => (id === todo.id ? null : todo.id))
                    }}
                  />
                ) : null}
                {noticeRowId === todo.id && onNotice ? (
                  <input
                    className="todo-notice-line"
                    type="text"
                    autoFocus
                    aria-label={NOTICE_PROMPT}
                    placeholder={NOTICE_PROMPT}
                    onClick={(e) => e.stopPropagation()}
                    onKeyDown={(e) => {
                      e.stopPropagation()
                      if (e.key === "Escape") setNoticeRowId(null)
                      if (e.key !== "Enter") return
                      const text = (e.target as HTMLInputElement).value.trim()
                      if (text) onNotice(todo.id, text)
                      setNoticeRowId(null)
                    }}
                  />
                ) : null}
              </div>

              <span className="todo-cell todo-cell-tier">
              {walk ? null : <NativeSelect
                className="todo-nixie"
                aria-label="Tier"
                title={`Tier ${todo.tier} — ${TIER_HINT[todo.tier]}`}
                value={todo.tier}
                onClick={(e) => e.stopPropagation()}
                onChange={(e) => onTierChange(todo.id, e.target.value as TodoItem["tier"])}
              >
                {TIERS.map((tier) => (
                  <option key={tier} value={tier}>
                    {tier}
                  </option>
                ))}
              </NativeSelect>}
              </span>

              <span className="todo-cell todo-cell-state">
              {walk ? null : <button
                type="button"
                className={`todo-status-lamp ${statusLampClass(status)}`}
                data-no95
                aria-label="Active"
                aria-pressed={status === "active"}
                data-todo-status={status}
                title={
                  status === "active"
                    ? "Active. Click to mark in progress. The task stays on this list."
                    : status === "partial"
                      ? "In progress. Click to mark active. The task stays on this list."
                      : `${COMPLETION_STATUS_LABELS[status]}. Click to mark active.`
                }
                onClick={(e) => {
                  e.stopPropagation()
                  onStatusChange(todo.id, toggleTodoActiveLamp(status))
                }}
              >
                <span className="todo-status-pip" aria-hidden />
              </button>}
              </span>

              <span className="todo-cell todo-cell-done todo-row-mins" title={walk ? undefined : `${completePct}% complete`}>
                {walk ? null : <PercentLedBar value={completePct} label="Complete" density="compact" />}
              </span>

              <span
                className="todo-cell todo-cell-time"
                title={
                  walk
                    ? undefined
                    : (spent > 0 ? `${Math.round(spent)} minutes spent. ` : "") +
                      (minutes > 0
                        ? `${Math.round(minutes)} minutes that count`
                        : defaultEstimateMin > 0
                          ? `No estimate yet. Counts as the default, ${defaultEstimateMin} minutes`
                          : "No estimate yet")
                }
              >
                {walk ? null : minutes > 0 ? (
                  <span className={`todo-mins-read${spent > minutes ? " is-over" : ""}`}>
                    {spent > 0 ? <span className="todo-mins-spent">{compactDuration(spent, pairUsesHours(spent, minutes))}/</span> : null}
                    {compactDuration(minutes, spent > 0 && pairUsesHours(spent, minutes))}
                  </span>
                ) : defaultEstimateMin > 0 ? (
                  <span className="todo-mins-read is-default">
                    {spent > 0 ? <span className="todo-mins-spent">{compactDuration(spent, pairUsesHours(spent, defaultEstimateMin))}/</span> : null}
                    ~{compactDuration(defaultEstimateMin, spent > 0 && pairUsesHours(spent, defaultEstimateMin))}
                  </span>
                ) : spent > 0 ? (
                  <span className="todo-mins-read is-default">{compactDuration(spent)}</span>
                ) : (
                  <span className="todo-cell-blank">–</span>
                )}
              </span>

              <span className="todo-cell todo-cell-steps">
                {stepCount > 0 ? (
                  <span className="todo-step-chip" title={progress ?? `${stepCount} steps`}>
                    {doneSteps}/{stepCount}
                  </span>
                ) : walk ? null : (
                  <span className="todo-cell-blank">–</span>
                )}
              </span>

              <div
                className="todo-row-verbs"
                role="toolbar"
                aria-label="Task actions"
                onClick={(e) => e.stopPropagation()}
              >
                {walk ? (
                  <button
                    type="button"
                    className="todo-verb"
                    title="Open this ritual"
                    onClick={() => onTaskClick(todo.id)}
                  >
                    Open
                  </button>
                ) : (
                  <>
                <button
                  type="button"
                  className="todo-card-key"
                  data-no95
                  title="Open task card"
                  aria-label={`Open task card for ${name}`}
                  onClick={() => openTaskCard(todo.taskId || todo.id)}
                >
                  <svg viewBox="0 0 16 16" width="13" height="13" aria-hidden="true">
                    <path
                      d="M9 2h5v5M14 2 7.5 8.5M12 9.5V13a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1h3.5"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.6"
                      strokeLinecap="square"
                    />
                  </svg>
                </button>
                {onClockStart ? (
                  <DvdTransportKey
                    className="todo-row-clock"
                    mark={onClock ? "stop" : "play"}
                    pressed={onClock}
                    label={onClock ? `Stop the clock on ${name}` : `Working on ${name} now — start its pen clock`}
                    onClick={() => (onClock ? onClockStop?.() : onClockStart(clockId))}
                  />
                ) : null}
                  </>
                )}
              </div>

              <span className="todo-cell todo-cell-push">
                {walk ? null : (
                  <span
                    className={`todo-push-tube${pushed > 0 ? " is-hot" : " is-zero"}`}
                    title={`Pushed ×${pushed} — ${pushLegend}`}
                  >
                    {pushed}
                  </span>
                )}
              </span>
            </div>

            {open && !walk ? (
              <div className="todo-lid" onClick={(e) => e.stopPropagation()}>
                <div className="todo-lid-meta">
                  {getScheduleLabel(todo)}
                  {todo.daysOverdue > 0 ? ` · ${waitingSinceLabel(todo.daysOverdue)}` : ""}
                </div>
                <div className="todo-lid-actions" role="toolbar" aria-label="Drawer actions">
                  <button
                    type="button"
                    className="todo-verb is-complete is-primary"
                    title="Mark complete"
                    onClick={() => onComplete(todo.id)}
                  >
                    Done
                  </button>
                  {(() => {
                    // Phase 10: Done at the level reached, when it is below the top level.
                    if (!hasStepTiers(steps)) return null
                    const lvl = levelReached({ subtasks: steps })
                    if (lvl === "none" || lvl === "exceptional" || lvl === levelReached({ subtasks: steps }, true)) return null
                    const word = lvl === "min" ? "Bare minimum" : "Goal"
                    return (
                      <button
                        type="button"
                        className="todo-verb is-complete"
                        title={`Mark complete at ${word}: the rest of the steps stay as they are`}
                        aria-label={`Done at ${word}`}
                        onClick={() => onComplete(todo.id, lvl)}
                      >
                        Done at {lvl === "min" ? "B" : "G"}
                      </button>
                    )
                  })()}
                  <button
                    type="button"
                    className="todo-verb"
                    title="Just start — focus on the smallest next step"
                    onClick={() => onJustStart(todo.taskId || todo.id)}
                  >
                    Start
                  </button>
                  <button
                    type="button"
                    className="todo-verb"
                    title="Just 25 minutes on this: the clock is the commitment"
                    aria-label={`Just 25 on ${name}`}
                    onClick={() => openSession({ startOn: "session", templateId: JUST_25_TEMPLATE_ID, seed: [{ taskId: todo.taskId || todo.id }] })}
                  >
                    Just 25
                  </button>
                  <button
                    type="button"
                    className="todo-verb is-push"
                    title={`Push to ${pushLabel}`}
                    onClick={() => onPush(todo.id, period)}
                  >
                    Push
                  </button>
                  <button
                    type="button"
                    className="todo-verb is-missed"
                    title="Missed opportunity — the window for it passed"
                    onClick={() => onMissed(todo.id)}
                  >
                    Missed
                  </button>
                  <span className="todo-lid-actions-rest">
                    {onNeeds ? (
                      <button
                        type="button"
                        className="todo-verb is-quiet"
                        title="Tasks that have to be done first"
                        onClick={() => onNeeds(clockId)}
                      >
                        Needs…
                      </button>
                    ) : null}
                    <button
                      type="button"
                      className="todo-verb is-quiet"
                      title="View details"
                      onClick={() => onTaskClick(todo.taskId || todo.id)}
                    >
                      View
                    </button>
                    <TodoDeleteButton
                      prompt={
                        stepCount > 0
                          ? `Delete "${name}" and its ${stepCount} steps?`
                          : `Delete "${name}"?`
                      }
                      onDelete={() => onDelete(todo.id)}
                    />
                  </span>
                </div>
                <TodoLidSection id="flags" label="Flags" layout="flags">
                  <button
                    type="button"
                    className="todo-jewel todo-gem is-required"
                    aria-pressed={required}
                    aria-label="Required"
                    title="Required — you marked this one for this period"
                    onClick={() => onToggleRequired(todo.id)}
                  >
                    <img className="todo-gem-stone" src={GEM_REQUIRED} alt="" aria-hidden />
                    <span className="todo-jewel-word">Required</span>
                  </button>
                  <button
                    type="button"
                    className="todo-jewel todo-gem is-prioritized"
                    aria-pressed={prioritized}
                    aria-label="Prioritized"
                    title="Prioritized — stays on Assigned, marked"
                    onClick={() => onTogglePrioritized(todo.id)}
                  >
                    <img className="todo-gem-stone" src={GEM_PRIORITIZED} alt="" aria-hidden />
                    <span className="todo-jewel-word">Prioritized</span>
                  </button>
                  {bgeTierOf && onBgeTierChange && !walk ? (
                    <div className="todo-segment todo-bge-keys" role="radiogroup" aria-label="Tier on this list">
                      {BGE_KEYS.map(({ tier, short, title }) => (
                        <button
                          key={tier}
                          type="button"
                          role="radio"
                          aria-checked={bgeTierOf(todo.id) === tier}
                          className={`todo-chiclet${bgeTierOf(todo.id) === tier ? " is-on" : ""}`}
                          title={title}
                          onClick={() => onBgeTierChange(todo.id, tier)}
                        >
                          {short}
                        </button>
                      ))}
                    </div>
                  ) : null}
                </TodoLidSection>
                <TodoBreakdown
                  estimate={estimate}
                  steps={steps}
                  onEstimateChange={(minutes) => onEstimateChange(todo.id, minutes)}
                  onStepsChange={(next) => onStepsChange(todo.id, next)}
                  onOpenStep={(step) => openStepItem(todo.id, step.id)}
                  time={timeOf?.(todo.id)}
                  clock={
                    onClockStart
                      ? {
                          liveStepId: onClock ? clockStepId : undefined,
                          subclocks: onClock ? clockSubclocks : undefined,
                          startedAt: onClock ? clockStartedAt : undefined,
                          onStart: (stepId) => onClockStart(clockId, stepId),
                          onStop: () => onClockStop?.(),
                          onStopStep: (stepId) => stopTaskSubclock(stepId),
                        }
                      : undefined
                  }
                />
              </div>
            ) : null}
          </div>
        )
      })}

      {todos.length === 0 && (
        <div className="todo-empty">{emptyLabel ?? `No tasks scheduled for this ${period}`}</div>
      )}

      {todos.length > COLLAPSE_THRESHOLD && (
        <button type="button" onClick={onToggleExpand} className="todo-more">
          {isExpanded ? "Show less" : `Show ${hiddenCount} more`}
        </button>
      )}
    </div>
  )
}
