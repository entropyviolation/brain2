/**
 * components/Home/Habits/habits-phone.tsx — Phone Habits
 *
 * Phone page. Mounted only from `HabitsPhonePage` when the viewport is at
 * most 767px. The desktop console stays in `habit-tracker.tsx` and is not
 * rendered here.
 * One scrolling page: sticky header, period keys, one grade strip, a
 * one-period list with a horizontal drag between periods, and a thumb bar.
 * Sheet opens the desktop grid. Tools opens the control panel and the
 * willpower plate in a bottom sheet. Writes go through the same cells.
 */
"use client"

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type MutableRefObject,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from "react"
import { ChevronLeft, ChevronRight } from "lucide-react"
import { HabitEditGemButton } from "@/components/Home/Habits/habit-gems"
import { HabitCompletionCell } from "@/components/Home/Habits/habit-completion-cell"
import { HabitCompletionDetail } from "@/components/Home/Habits/habit-completion-detail"
import { HabitRowName } from "@/components/Home/Habits/habit-row-name"
import { HabitPercentReadout } from "@/components/Home/Habits/habit-percent-readout"
import { HabitPeriodBreakdown } from "@/components/Home/Habits/habit-period-breakdown"
import { HabitSpanBreakdownDialog } from "@/components/Home/Habits/habit-span-breakdown"
import { habitSpanBreakdown, type SpanUnit } from "@/lib/habit-span-breakdown"
import { habitStatReadingContext, loggedAmountForColumn } from "@/lib/habit-stat-pipeline"
import { listRoutingFromLink } from "@/lib/habit-completion-pipeline"
import { isGoalType, normalizeTaskType } from "@/lib/habit-utils"
import { habitHiddenWhenComplete } from "@/lib/habit-completion-source"
import { incrementalCompletionPayload } from "@/lib/incremental-habits"
import { missedOpportunityWrite } from "@/lib/habit-missed-opportunity"
import { habitWeekStreakSummary } from "@/lib/habit-week-streaks"
import {
  autoPriorityWeight,
  effectivePriorityWeight,
  priorityMarkPercent,
  priorityWash,
  priorityWashVars,
} from "@/lib/habit-priority"
import { pointerBeforeId, reorderIdList } from "@/lib/habit-order"
import { isExemptKind, type ExemptionKind } from "@/lib/habit-exemption"
import { habitContributesWillpowerStone } from "@/lib/willpower-stones"
import { useHabitsStore } from "@/lib/habits-store"
import { TaskType, type HabitFrequency, type TaskCompletion, type WeeklyData, type WeeklyTask } from "@/lib/types"
import "./habits-phone.css"

const KIND_ORDER = [TaskType.BOOLEAN, TaskType.GOAL, TaskType.INCREMENTAL, TaskType.TEXT] as const
const KIND_LABEL: Record<(typeof KIND_ORDER)[number], string> = {
  [TaskType.BOOLEAN]: "Lamps",
  [TaskType.GOAL]: "Goals",
  [TaskType.INCREMENTAL]: "Climb",
  [TaskType.TEXT]: "Text",
}

const INTERACTIVE = "button, input, textarea, select, a, [role='switch'], [role='checkbox'], [role='radio']"

export type HabitsPhonePeriod = {
  key: string
  date: Date
  label: string
  sublabel: string
  title: string
  isCurrent: boolean
}

/** One step along the phone pager. `edge` means the desktop period lens moves. */
export function stepPeriodIndex(
  index: number,
  count: number,
  dir: -1 | 1,
): { index: number; edge: boolean } {
  if (count <= 1) return { index: 0, edge: true }
  const next = index + dir
  if (next < 0 || next >= count) return { index: dir < 0 ? count - 1 : 0, edge: true }
  return { index: next, edge: false }
}

export type HabitsPhoneMeter = {
  label: string
  value: string
  sub?: string
  onClick: () => void
}

export interface HabitsPhoneProps {
  hydrated: boolean
  frequency: HabitFrequency
  counts: { daily: number; weekly: number; monthly: number; quarterly: number }
  onFrequency: (frequency: HabitFrequency) => void
  windowLabel: string
  currentLabel: string
  isCurrentPeriod: boolean
  previousAria: string
  nextAria: string
  onPrevious: () => void
  onNext: () => void
  onCurrent: () => void
  periods: HabitsPhonePeriod[]
  spanPeriods: HabitsPhonePeriod[]
  preferredKey: string
  /** Hide Done uses this period, matching the desktop sheet. */
  hidePeriod: HabitsPhonePeriod
  tasks: WeeklyTask[]
  data: WeeklyData
  weekDates: Date[]
  asOf: Date
  variant: "daily" | "period"
  spanUnit: SpanUnit
  exemptionNoun: "day" | "week" | "month" | "season"
  exemptionKindFor?: (task: WeeklyTask, key: string) => ExemptionKind
  onUpdate: (taskId: string, date: Date, completion: TaskCompletion) => void
  onSetExempt?: (taskId: string, periodKey: string, date: Date, exempt: boolean) => void
  onEdit: (task: WeeklyTask) => void
  taskPercent: (taskId: string) => number | null
  periodPercent: (period: HabitsPhonePeriod) => number | null
  hideCompleted: boolean
  exemptionWand: boolean
  missedOpWand: boolean
  hideCompletedAndMissed: boolean
  groupByKind: boolean
  onReorder?: (ids: string[]) => void
  detail: boolean
  highlightPriorities: boolean
  ritualIds: string[]
  ritualMultiplier: number
  showStreakMarks: boolean
  grade: HabitsPhoneMeter
  output: HabitsPhoneMeter
  good: HabitsPhoneMeter | null
  through: string | null
  wand: ReactNode
  /** Desktop grid for this tab. Mounted from the Sheet key. */
  columns: ReactNode
  /** Daily heatmap. Replaces the list while Heatmap View is on. */
  heatmap: ReactNode | null
  plan: ReactNode
  tools: ReactNode
  dialogs: ReactNode
  onSettings: () => void
  onNewHabit: () => void
  emptyLabel: string
  clearedLabel: string
}

function useReducedMotion(): boolean {
  const [reduce, setReduce] = useState(false)
  useLayoutEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)")
    const apply = () => setReduce(media.matches)
    apply()
    media.addEventListener("change", apply)
    return () => media.removeEventListener("change", apply)
  }, [])
  return reduce
}

function useStatContext() {
  const tasks = useHabitsStore((s) => s.tasks)
  const weeklyData = useHabitsStore((s) => s.weeklyData)
  const weeklyHabitData = useHabitsStore((s) => s.weeklyHabitData)
  const monthlyHabitData = useHabitsStore((s) => s.monthlyHabitData)
  const gradeTolerance = useHabitsStore((s) => s.gradeTolerance)
  const outputGradeTolerance = useHabitsStore((s) => s.outputGradeTolerance)
  const accomplishmentThreshold = useHabitsStore((s) => s.accomplishmentThreshold)
  return useMemo(
    () =>
      habitStatReadingContext({
        tasks,
        weeklyData,
        weeklyHabitData,
        monthlyHabitData,
        gradeTolerance,
        outputGradeTolerance,
        accomplishmentThreshold,
      }),
    [
      tasks,
      weeklyData,
      weeklyHabitData,
      monthlyHabitData,
      gradeTolerance,
      outputGradeTolerance,
      accomplishmentThreshold,
    ],
  )
}

function shownCompletion(
  task: WeeklyTask,
  period: HabitsPhonePeriod,
  completion: TaskCompletion | undefined,
  variant: "daily" | "period",
  statContext: ReturnType<typeof useStatContext>,
): TaskCompletion | undefined {
  if (variant !== "period") return completion
  if (!isGoalType(task.type)) return completion
  if (completion?.handCompleted !== undefined || completion?.manualValue !== undefined) return completion
  const link = task.listSentLink
  if (link?.listId && link.enabled !== false && listRoutingFromLink(link).target === "listLength") return completion
  const sum = loggedAmountForColumn(task, period, statContext)
  if (sum == null) return completion
  return { ...(completion ?? {}), value: sum, goal: completion?.goal ?? task.goal }
}

function ToolsSheet({
  open,
  onClose,
  reduce,
  children,
}: {
  open: boolean
  onClose: () => void
  reduce: boolean
  children: ReactNode
}) {
  const [shown, setShown] = useState(reduce)
  const [page, setPage] = useState<"controls" | "gems">("controls")
  useLayoutEffect(() => {
    if (!open) return
    if (reduce) {
      setShown(true)
      return
    }
    setShown(false)
    const id = requestAnimationFrame(() => setShown(true))
    return () => cancelAnimationFrame(id)
  }, [open, reduce])
  useEffect(() => {
    if (!open) return
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose()
    }
    const previous = document.body.style.overflow
    document.body.style.overflow = "hidden"
    window.addEventListener("keydown", onKey)
    return () => {
      document.body.style.overflow = previous
      window.removeEventListener("keydown", onKey)
    }
  }, [open, onClose])
  if (!open) return null
  return (
    <div className="hab-phone-shade" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Habits tools"
        className={`hab-phone-sheet ${shown ? "is-in" : ""} ${page === "gems" ? "is-gems" : "is-controls"}`}
        onClick={(event) => event.stopPropagation()}
      >
        <button type="button" className="hab-phone-grab" aria-label="Close tools" onClick={onClose} />
        <div className="hab-phone-sheet-pages" role="tablist" aria-label="Tools pages">
          <button type="button" role="tab" aria-selected={page === "controls"} onClick={() => setPage("controls")}>
            Controls
          </button>
          <button type="button" role="tab" aria-selected={page === "gems"} onClick={() => setPage("gems")}>
            Willpower gems
          </button>
        </div>
        <div className="hab-phone-sheet-scroll">{children}</div>
      </div>
    </div>
  )
}

export function HabitsPhone(props: HabitsPhoneProps) {
  const reduce = useReducedMotion()
  const statContext = useStatContext()
  const rootRef = useRef<HTMLDivElement>(null)
  const listRef = useRef<HTMLDivElement>(null)
  const [compact, setCompact] = useState(false)
  const [sheet, setSheet] = useState(false)
  const [tools, setTools] = useState(false)
  const [focus, setFocus] = useState(() => {
    const preferred = props.periods.findIndex((period) => period.key === props.preferredKey)
    if (preferred >= 0) return preferred
    const current = props.periods.findIndex((period) => period.isCurrent)
    return current >= 0 ? current : 0
  })
  const [spanTaskId, setSpanTaskId] = useState<string | null>(null)
  const [periodOpen, setPeriodOpen] = useState(false)
  const [pendingEdge, setPendingEdge] = useState<-1 | 1 | 0>(0)
  const tabRef = useRef(props.frequency)
  const periodsKey = props.periods.map((period) => period.key).join("\0")

  useLayoutEffect(() => {
    if (tabRef.current !== props.frequency) {
      tabRef.current = props.frequency
      const preferred = props.periods.findIndex((period) => period.key === props.preferredKey)
      const current = props.periods.findIndex((period) => period.isCurrent)
      setFocus(preferred >= 0 ? preferred : current >= 0 ? current : 0)
      setPendingEdge(0)
      return
    }
    if (pendingEdge === 1) setFocus(0)
    else if (pendingEdge === -1) setFocus(Math.max(0, props.periods.length - 1))
    else if (props.periods.length <= 1) setFocus(0)
    else {
      setFocus((index) => {
        if (props.periods[index]) return index
        const current = props.periods.findIndex((period) => period.isCurrent)
        return current >= 0 ? current : 0
      })
    }
    if (pendingEdge !== 0) setPendingEdge(0)
  }, [periodsKey, props.frequency, props.preferredKey, props.periods, pendingEdge])

  const period = props.periods[focus] ?? props.periods[0]

  const commit = useCallback(
    (dir: -1 | 1) => {
      const step = stepPeriodIndex(focus, props.periods.length, dir)
      if (!step.edge) {
        setFocus(step.index)
        return
      }
      if (props.periods.length > 1) setPendingEdge(dir)
      if (dir < 0) props.onPrevious()
      else props.onNext()
    },
    [focus, props],
  )

  const goCurrent = () => {
    props.onCurrent()
    const preferred = props.periods.findIndex((item) => item.key === props.preferredKey)
    const current = props.periods.findIndex((item) => item.isCurrent)
    if (preferred >= 0) setFocus(preferred)
    else if (current >= 0) setFocus(current)
  }

  useEffect(() => {
    const root = rootRef.current
    if (!root) return
    let node: HTMLElement | null = root.parentElement
    let scroller: HTMLElement | null = null
    while (node) {
      const overflow = getComputedStyle(node).overflowY
      if ((overflow === "auto" || overflow === "scroll") && node.scrollHeight > node.clientHeight + 8) {
        scroller = node
        break
      }
      node = node.parentElement
    }
    const target: HTMLElement | Window = scroller ?? window
    const onScroll = () => {
      const top = target === window ? window.scrollY : (target as HTMLElement).scrollTop
      setCompact(top > 12)
    }
    target.addEventListener("scroll", onScroll, { passive: true })
    onScroll()
    return () => target.removeEventListener("scroll", onScroll)
  }, [])

  useEffect(() => {
    const chip = rootRef.current?.querySelector<HTMLElement>(".hab-phone-day.is-on")
    chip?.scrollIntoView({ inline: "center", block: "nearest", behavior: reduce ? "auto" : "smooth" })
  }, [focus, periodsKey, reduce])

  const [dragX, setDragX] = useState(0)
  const [dragging, setDragging] = useState(false)
  const dragRef = useRef<{ id: number; x: number; y: number; claimed: boolean } | null>(null)
  const reorderRef = useRef<{ id: string; y: number } | null>(null)
  const commitRef = useRef(commit)
  commitRef.current = commit

  const onPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (props.heatmap || sheet || props.onReorder) return
    if ((event.target as HTMLElement).closest(INTERACTIVE)) return
    dragRef.current = { id: event.pointerId, x: event.clientX, y: event.clientY, claimed: false }
  }
  const onPointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current
    if (!drag || drag.id !== event.pointerId) return
    const dx = event.clientX - drag.x
    const dy = event.clientY - drag.y
    if (!drag.claimed) {
      if (Math.abs(dy) > 10 && Math.abs(dy) > Math.abs(dx)) {
        dragRef.current = null
        return
      }
      if (Math.abs(dx) < 12 || Math.abs(dx) <= Math.abs(dy)) return
      drag.claimed = true
      setDragging(true)
      event.currentTarget.setPointerCapture(event.pointerId)
    }
    setDragX(dx)
  }
  const onPointerUp = (event: ReactPointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current
    if (!drag || drag.id !== event.pointerId) return
    dragRef.current = null
    if (!drag.claimed) return
    const dx = event.clientX - drag.x
    if (Math.abs(dx) < 56) {
      setDragging(false)
      setDragX(0)
      return
    }
    const dir: -1 | 1 = dx < 0 ? 1 : -1
    if (reduce) {
      setDragging(false)
      setDragX(0)
      commitRef.current(dir)
      return
    }
    setDragging(false)
    setDragX(dir === 1 ? -120 : 120)
    window.setTimeout(() => {
      commitRef.current(dir)
      setDragging(true)
      setDragX(0)
      requestAnimationFrame(() => setDragging(false))
    }, 180)
  }

  const visible = useMemo(() => {
    if (!props.hideCompleted || !period) return props.tasks
    return props.tasks.filter((task) => {
      const kind = props.exemptionKindFor?.(task, props.hidePeriod.key)
      const completion = shownCompletion(
        task,
        props.hidePeriod,
        props.data[props.hidePeriod.key]?.[task.id],
        props.variant,
        statContext,
      )
      return !habitHiddenWhenComplete(task, completion, {
        date: props.hidePeriod.date,
        weeklyData: props.data,
        exempt: isExemptKind(kind),
        periodPercent: props.taskPercent(task.id),
      })
    })
  }, [props, period, statContext])

  const groups = useMemo(() => {
    if (!props.groupByKind || props.frequency !== "daily") {
      return visible.length ? [{ kind: "all", label: "", tasks: visible }] : []
    }
    const buckets = new Map<(typeof KIND_ORDER)[number], WeeklyTask[]>()
    for (const kind of KIND_ORDER) buckets.set(kind, [])
    for (const task of visible) {
      const kind = normalizeTaskType(task.type)
      const bucket = buckets.get(kind as (typeof KIND_ORDER)[number])
      if (bucket) bucket.push(task)
      else buckets.get(TaskType.BOOLEAN)!.push(task)
    }
    return KIND_ORDER.map((kind) => ({ kind, label: KIND_LABEL[kind], tasks: buckets.get(kind)! })).filter(
      (group) => group.tasks.length > 0,
    )
  }, [visible, props.groupByKind, props.frequency])

  const spanTask = spanTaskId ? props.tasks.find((task) => task.id === spanTaskId) ?? null : null
  const spanBreakdown = spanTask
    ? habitSpanBreakdown({
        task: spanTask,
        data: props.data,
        columns: props.spanPeriods.map((item) => ({
          key: item.key,
          title: item.title,
          date: item.date,
        })),
        unit: props.spanUnit,
        asOf: props.asOf,
        isExempt: props.exemptionKindFor
          ? (task, key) => isExemptKind(props.exemptionKindFor?.(task, key))
          : undefined,
      })
    : null

  const title = props.periods.length <= 1 || props.heatmap || sheet ? props.windowLabel : period?.title ?? props.windowLabel
  const showWindow = !props.heatmap && !sheet && props.periods.length > 1
  const freqLabel = (id: HabitFrequency, name: string, count: number) =>
    props.hydrated ? `${name} (${count})` : name

  const closeTools = useCallback(() => setTools(false), [])

  return (
    <div
      ref={rootRef}
      className={`hab-phone${compact ? " is-compact" : ""}`}
      data-ui-name="Habits"
      data-ui-docs="components/Home/Habits/README.md"
      data-testid="habits-phone"
      aria-busy={!props.hydrated}
    >
      <header className="hab-phone-head">
        <div className="hab-phone-head-row">
          <h3 className="hab-phone-title">Habits</h3>
          <button type="button" className="hab-phone-icon-btn" onClick={props.onSettings}>
            Settings
          </button>
        </div>
        <div className="hab-phone-nav">
          <button type="button" className="hab-phone-icon-btn" aria-label={props.previousAria} onClick={props.onPrevious}>
            <ChevronLeft aria-hidden="true" />
          </button>
          <button
            type="button"
            className="hab-phone-date"
            aria-pressed={props.isCurrentPeriod}
            onClick={goCurrent}
          >
            {title}
          </button>
          <button type="button" className="hab-phone-icon-btn" aria-label={props.nextAria} onClick={props.onNext}>
            <ChevronRight aria-hidden="true" />
          </button>
        </div>
        {showWindow ? <p className="hab-phone-window">{props.windowLabel}</p> : null}
        <div className="hab-phone-segment" role="tablist" aria-label="Habit period">
          {(
            [
              ["daily", "Daily", props.counts.daily],
              ["weekly", "Weekly", props.counts.weekly],
              ["monthly", "Monthly", props.counts.monthly],
              ["quarterly", "Season", props.counts.quarterly],
            ] as const
          ).map(([id, name, count]) => (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={props.frequency === id}
              onClick={() => props.onFrequency(id)}
            >
              {freqLabel(id, name, count)}
            </button>
          ))}
        </div>
      </header>

      <div className="hab-phone-meters" role="group" aria-label="Grades">
        <button type="button" className="hab-phone-meter" onClick={props.grade.onClick}>
          <span className="hab-phone-meter-kicker">{props.grade.label}</span>
          <strong>{props.grade.value}</strong>
        </button>
        <button type="button" className="hab-phone-meter" onClick={props.output.onClick}>
          <span className="hab-phone-meter-kicker">{props.output.label}</span>
          <strong>{props.output.value}</strong>
        </button>
        {props.good ? (
          <button type="button" className="hab-phone-meter" onClick={props.good.onClick}>
            <span className="hab-phone-meter-kicker">{props.good.label}</span>
            <strong>{props.good.value}</strong>
            {props.good.sub ? <span className="hab-phone-meter-sub">{props.good.sub}</span> : null}
          </button>
        ) : null}
      </div>
      {props.through ? <p className="hab-phone-through">{props.through}</p> : null}
      {props.wand}

      {showWindow ? (
        <div className="hab-phone-days" role="tablist" aria-label="Periods in this window">
          {props.periods.map((item, index) => (
            <button
              key={item.key}
              type="button"
              role="tab"
              className={`hab-phone-day${index === focus ? " is-on" : ""}${item.isCurrent ? " is-today" : ""}`}
              aria-selected={index === focus}
              onClick={() => setFocus(index)}
            >
              <span className="hab-phone-day-kicker">{item.label}</span>
              <span className="hab-phone-day-num">{item.sublabel}</span>
            </button>
          ))}
        </div>
      ) : null}

      <div className="hab-phone-stage">
        {!props.hydrated ? (
          <p className="hab-phone-empty">Loading habits…</p>
        ) : props.heatmap ? (
          <div className="hab-phone-heatmap">{props.heatmap}</div>
        ) : sheet ? (
          <div className="hab-phone-columns">
            {props.columns}
            {props.plan ? <div className="hab-phone-plan">{props.plan}</div> : null}
          </div>
        ) : (
          <>
            <div
              ref={listRef}
              className={`hab-phone-swipe${dragging ? " is-dragging" : ""}`}
              data-testid="habits-phone-list"
              data-period={period?.key ?? ""}
              style={{ "--swipe-x": `${dragX}px` } as CSSProperties}
              onPointerDown={onPointerDown}
              onPointerMove={onPointerMove}
              onPointerUp={onPointerUp}
              onPointerCancel={onPointerUp}
            >
              {props.tasks.length === 0 ? (
                <p className="hab-phone-empty">{props.emptyLabel}</p>
              ) : visible.length === 0 ? (
                <p className="hab-phone-empty">{props.clearedLabel}</p>
              ) : period ? (
                <>
                  {groups.map((group) => (
                    <section key={group.kind} aria-label={group.label || "Habits"}>
                      {group.label ? <h4 className="hab-phone-kind">{group.label}</h4> : null}
                      <div className="hab-phone-group" role="list">
                        {group.tasks.map((task) => (
                          <PhoneRow
                            key={task.id}
                            task={task}
                            period={period}
                            props={props}
                            statContext={statContext}
                            onSpan={() => setSpanTaskId(task.id)}
                            reorderRef={reorderRef}
                            visibleIds={visible.map((row) => row.id)}
                          />
                        ))}
                      </div>
                    </section>
                  ))}
                  <div className="hab-phone-group">
                    <button type="button" className="hab-phone-period" onClick={() => setPeriodOpen(true)}>
                      <span>{period.title}</span>
                      <HabitPercentReadout
                        value={props.periodPercent(period)}
                        label={`${period.title} completion`}
                      />
                    </button>
                  </div>
                </>
              ) : null}
            </div>
            {props.plan ? <div className="hab-phone-plan">{props.plan}</div> : null}
          </>
        )}
      </div>

      <div className="hab-phone-bar">
        <button type="button" onClick={props.onNewHabit}>
          New habit
        </button>
        <button type="button" aria-pressed={props.isCurrentPeriod} onClick={goCurrent}>
          {props.currentLabel}
        </button>
        {props.heatmap ? null : (
          <button type="button" aria-pressed={sheet} onClick={() => setSheet((on) => !on)}>
            Sheet
          </button>
        )}
        <button type="button" aria-pressed={tools} onClick={() => setTools(true)}>
          Tools
        </button>
      </div>

      <ToolsSheet open={tools} onClose={closeTools} reduce={reduce}>
        {props.tools}
      </ToolsSheet>

      {period ? (
        <HabitPeriodBreakdown
          open={periodOpen}
          onOpenChange={setPeriodOpen}
          title={period.title}
          tasks={props.tasks}
          period={{ key: period.key, date: period.date }}
          data={props.data}
          isExempt={
            props.exemptionKindFor
              ? (task, key) => isExemptKind(props.exemptionKindFor?.(task, key))
              : undefined
          }
        />
      ) : null}
      <HabitSpanBreakdownDialog
        open={Boolean(spanBreakdown)}
        onOpenChange={(next) => {
          if (!next) setSpanTaskId(null)
        }}
        breakdown={spanBreakdown}
      />
      {props.dialogs}
    </div>
  )
}

function PhoneRow({
  task,
  period,
  props,
  statContext,
  onSpan,
  reorderRef,
  visibleIds,
}: {
  task: WeeklyTask
  period: HabitsPhonePeriod
  props: HabitsPhoneProps
  statContext: ReturnType<typeof useStatContext>
  onSpan: () => void
  reorderRef: MutableRefObject<{ id: string; y: number } | null>
  visibleIds: string[]
}) {
  const completion = props.data[period.key]?.[task.id]
  const shown = shownCompletion(task, period, completion, props.variant, statContext)
  const kind = props.exemptionKindFor?.(task, period.key) ?? "required"
  const weekStart = props.weekDates[0]
  const weekStreak =
    props.frequency === "daily" && weekStart
      ? habitWeekStreakSummary(task, props.data, weekStart, props.asOf, (key) =>
          isExemptKind(props.exemptionKindFor?.(task, key)),
        )
      : null
  const prio = effectivePriorityWeight(task, props.data, props.asOf, props.frequency)
  const neglect = autoPriorityWeight(task, props.data, props.asOf, props.frequency)
  const ritual = props.ritualIds.includes(task.id)
  const wash = priorityWash({
    highlight: props.highlightPriorities,
    ritual,
    neglect,
    selected: priorityMarkPercent(task, props.asOf, ritual),
  })
  const streakTitle = weekStreak
    ? [
        `${weekStreak.thisWeekDays} day${weekStreak.thisWeekDays === 1 ? "" : "s"} done this week`,
        weekStreak.current > 0 ? `${weekStreak.current} week streak of 4+ days` : "no 4+ day week streak",
        weekStreak.longest > weekStreak.current ? `best ${weekStreak.longest}` : null,
      ]
        .filter(Boolean)
        .join(". ")
    : undefined

  return (
    <div
      role="listitem"
      className={`hab-phone-row${wash.className ? ` ${wash.className}` : ""}`}
      data-habit-id={task.id}
      style={priorityWashVars(wash) as CSSProperties | undefined}
      onPointerDown={
        props.onReorder
          ? (event) => {
              if ((event.target as HTMLElement).closest(INTERACTIVE)) return
              reorderRef.current = { id: task.id, y: event.clientY }
            }
          : undefined
      }
      onPointerUp={
        props.onReorder
          ? (event) => {
              const drag = reorderRef.current
              reorderRef.current = null
              if (!drag || drag.id !== task.id || Math.abs(event.clientY - drag.y) < 4) return
              const host = event.currentTarget.closest(".hab-phone-swipe")
              if (!host) return
              const rows = [...host.querySelectorAll<HTMLElement>("[data-habit-id]")].map((row) => {
                const box = row.getBoundingClientRect()
                return { id: row.dataset.habitId || "", top: box.top, height: box.height }
              })
              const next = reorderIdList(visibleIds, task.id, pointerBeforeId(rows, task.id, event.clientY))
              if (next.some((id, index) => id !== visibleIds[index])) props.onReorder?.(next)
            }
          : undefined
      }
    >
      <HabitEditGemButton
        task={task}
        onEdit={props.onEdit}
        inverted={
          props.frequency === "daily" && habitContributesWillpowerStone(task, props.data, props.weekDates)
        }
      />
      <div className="hab-phone-copy">
        <HabitRowName
          name={task.name}
          prio={prio}
          streakTitle={streakTitle}
          thisWeekDays={weekStreak?.thisWeekDays ?? 0}
          thisWeekHit={weekStreak?.thisWeekHit ?? false}
          currentWeeks={weekStreak?.current ?? 0}
          showMarks={props.showStreakMarks}
          ritualMultiplier={ritual ? props.ritualMultiplier : 0}
        />
        {props.detail ? <div className="hab-phone-detail"><HabitCompletionDetail task={task} completion={shown} now={period.date} /></div> : null}
      </div>
      <button type="button" className="hab-phone-pct" aria-label={`${task.name} span`} onClick={onSpan}>
        <HabitPercentReadout value={props.taskPercent(task.id)} label={`${task.name} span`} />
      </button>
      <div className="hab-phone-mark">
        <HabitCompletionCell
          task={task}
          date={period.date}
          periodKey={period.key}
          periodLabel={period.title}
          completion={shown}
          weeklyData={props.data}
          variant={props.variant}
          frequency={props.frequency}
          exemptionNoun={props.exemptionNoun}
          exemptionWand={props.exemptionWand}
          missedOpWand={props.missedOpWand}
          hideCompletedAndMissed={props.hideCompletedAndMissed}
          exemptionKind={kind}
          onSetExempt={
            props.onSetExempt ? (exempt) => props.onSetExempt?.(task.id, period.key, period.date, exempt) : undefined
          }
          onToggleMissedOpportunity={(missed, missReason) =>
            props.onUpdate(task.id, period.date, missedOpportunityWrite(missed, missReason))
          }
          onBooleanChange={(checked) => props.onUpdate(task.id, period.date, { completed: checked })}
          onGoalChange={(value) => {
            if (!isGoalType(task.type)) return
            props.onUpdate(task.id, period.date, { value, goal: task.goal || 0 })
          }}
          onTextChange={(text) => props.onUpdate(task.id, period.date, { text })}
          onIncrementalChange={(value) => {
            if (task.type !== TaskType.INCREMENTAL) return
            props.onUpdate(task.id, period.date, incrementalCompletionPayload(value))
          }}
        />
      </div>
    </div>
  )
}
