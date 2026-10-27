/**
 * components/Home/ToDo/todo-mobile.tsx — Phone To Do
 *
 * A grouped list in the manner of Reminders and Things: large rows, swipe
 * actions, a bottom composer, period swipe, a compact bar, and sheets.
 * The drawer stays the drawer (this sheet). Item detail and the task card
 * stay their own doors. Desktop never mounts this tree.
 */
"use client"

import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent, type ReactNode } from "react"
import { navigateDate } from "@/components/Scheduler/scheduler-utils"
import type { CompletionStatus, StepTier, Subtask, Task, TodoItem } from "@/lib/types"
import { itemTitle, itemTitleOrUntitled } from "@/lib/item-utils"
import { compactDuration } from "@/lib/time-entries"
import { effectiveDurationMinutes, flattenSteps, taskMatchesAssignedQuery } from "@/lib/todo-steps"
import { splitPercent } from "@/lib/tree-math"
import { hasStepTiers } from "@/lib/step-tiers"
import { levelReached } from "@/lib/step-progress"
import { openTaskCard } from "@/lib/task-card"
import { openSession } from "@/lib/session-open-store"
import { JUST_25_TEMPLATE_ID } from "@/lib/session-plan"
import { NOTICE_PROMPT } from "@/lib/notice-dot"
import { isRitualTodoId } from "@/lib/ritual-todo"
import { quarterKey } from "@/lib/seasons"
import { openStepItem } from "@/lib/step-item-stack"
import { splitByCommitment, splitByTier } from "@/lib/todo-commitment"
import { bgeScore, type BgeEntry } from "@/lib/bge-score"
import { NativeSelect } from "@/components/ui/native-select"
import { WaitingLine } from "@/components/steps/WaitingLine"
import { AddTodoDialog, type ExistingTaskHit, type NewTodoDraft } from "./AddTodoDialog"
import { AddDoneDialog } from "./AddDoneDialog"
import { TodoSettingsDialog } from "./TodoSettingsDialog"
import { DoneTodoSection } from "./DoneTodoSection"
import { MissedTodoSection } from "./MissedTodoSection"
import { UndoneTodoSection } from "./UndoneTodoSection"
import { TodoFilters, TodoSortKeys } from "./todo-filters"
import { TodoBreakdown, TodoDeleteButton, type TodoTimeInfo } from "./TodoBreakdown"
import { PriorityFormulaPanel } from "./PriorityFormulaPanel"
import { SessionKey, SessionsKey } from "./SessionPlanner"
import { getScheduleLabel, isCurrentPeriod, pinPrioritizedFirst, pushedKeyForPeriod, toggleTodoActiveLamp, type TodoPeriod, type TodoSortMode, type TodoSortOrder, type TodoStatusFilter } from "./todo-utils"
import type { ConfirmedTimes } from "@/lib/services/completion-time-service"
import { waitingSinceLabel } from "./TodoTable"
import "./todo-mobile.css"

const GEM_REQUIRED = "/gems-removebackground/gem5.png"
const GEM_PRIORITIZED = "/gems-removebackground/e7a4b25a506e2ab9c20179cbc56da911.png"
const TIERS: TodoItem["tier"][] = ["A+", "A", "A/B", "B", "C", "D"]
const BGE_KEYS: { tier: StepTier; short: string; title: string }[] = [
  { tier: "min", short: "B", title: "Bare minimum on this list" },
  { tier: "goal", short: "G", title: "Goal on this list" },
  { tier: "exceptional", short: "E", title: "Exceptional on this list" },
]

const SPAN: { value: PhoneTab; word: string }[] = [
  { value: "day", word: "Day" },
  { value: "week", word: "Week" },
  { value: "month", word: "Month" },
  { value: "quarter", word: "Season" },
  { value: "other", word: "Other" },
]

export type PhoneTab = "day" | "week" | "month" | "quarter" | "other"

type Menu = null | "more" | "show" | "load" | "formula"

export type TodoMobileProps = {
  activeTab: PhoneTab
  onTab: (tab: PhoneTab) => void
  focusedDate: Date
  onFocusedDate: (date: Date) => void
  heading: string
  dateLabel: string
  periodLabel: string
  openCount: number
  undoneCount: number
  viewingPast: boolean
  headerLoad: { text: string; overCap: boolean } | null
  inProgressCount: number
  wipLimit: number
  loadPanel: ReactNode
  lens: "period" | "season" | "other"
  period: TodoPeriod
  openTodos: TodoItem[]
  tasks: Task[]
  taskFor: (id: string) => Task | undefined
  isStoredTask: (id: string) => boolean
  seasonRequired: Task[]
  seasonAssigned: Task[]
  seasonHint: string
  other: ReactNode
  stripShown: boolean
  filterCount: number
  availableNow: boolean
  onAvailableNowChange: (value: boolean) => void
  showAllTasks: boolean
  onShowAllTasksChange: (value: boolean) => void
  statusFilter: TodoStatusFilter
  onStatusFilterChange: (value: TodoStatusFilter) => void
  onShowFormula: (open: boolean) => void
  listName?: string
  onOpenList?: () => void
  sortMode: TodoSortMode
  onSortModeChange: (mode: TodoSortMode) => void
  sortOrder: TodoSortOrder
  onSortOrderChange: (order: TodoSortOrder) => void
  bgeTiers: boolean
  morningTasks: Task[]
  onComplete: (id: string, level?: StepTier) => void
  onMissed: (id: string) => void
  onPush: (id: string) => void
  onDelete: (id: string) => void
  onEstimate: (id: string, minutes: number | undefined) => void
  onSteps: (id: string, steps: Subtask[]) => void
  onTier: (id: string, tier: TodoItem["tier"]) => void
  onJustStart: (id: string) => void
  onStatus: (id: string, status: CompletionStatus) => void
  onToggleRequired: (id: string) => void
  onTogglePrioritized: (id: string) => void
  onBgeTier: (id: string, tier: StepTier) => void
  bgeTierOf: (id: string) => StepTier
  onRename: (id: string, description: string) => void
  onTaskClick: (id: string) => void
  onNeeds: (id: string) => void
  onClockStart: (id: string) => void
  onClockStop: () => void
  clockTaskId: string | null
  getStatus: (id: string) => CompletionStatus
  isRequired: (id: string) => boolean
  isPrioritized: (id: string) => boolean
  defaultEstimateMin: number
  spentOf: (id: string) => number
  timeOf: (id: string) => TodoTimeInfo | undefined
  noticeOf: (id: string) => boolean
  onNotice: (id: string, text: string) => void
  blockersOf: (id: string) => string[]
  unlockOf: (id: string) => { count: number; title: string; due?: string } | null
  flockingId: string | null
  openRowId: string | null
  onOpenRow: (id: string | null) => void
  doneTodos: TodoItem[]
  missedTodos: TodoItem[]
  undoneTodos: TodoItem[]
  doneOpen: boolean
  missedOpen: boolean
  undoneOpen: boolean
  onDoneOpen: (open: boolean) => void
  onMissedOpen: (open: boolean) => void
  onUndoneOpen: (open: boolean) => void
  doneTitle: string
  missedTitle: string
  pushTitle: string
  onAssimilate: (id: string) => void
  onUndonePush: (id: string) => void
  onDiscard: (id: string) => void
  onAddDone: (description: string) => void
  onConfirmTimes: (taskId: string, values: ConfirmedTimes) => void
  onAdd: (draft: NewTodoDraft) => void
  searchExisting: (query: string) => ExistingTaskHit[]
  onPickExisting: (taskId: string) => void
  onOpenPickList: () => void
  onOpenSession: () => void
  onOpenSessions: () => void
  paceSlot: ReactNode
  hiddenWaiting: number
  peeking: boolean
  onPeek: () => void
  onQuickAdd: (description: string, tier: TodoItem["tier"], focusFirstStep: boolean) => void
  children?: ReactNode
}

function reducedMotion(): boolean {
  return typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches
}

function pairUsesHours(a: number, b: number): boolean {
  return Math.round(a) >= 60 || Math.round(b) >= 60
}

/** Horizontal drag that does not claim a vertical scroll. */
function useHorizontalSwipe(onCommit: (dir: -1 | 1) => void, allow: (target: EventTarget | null) => boolean) {
  const origin = useRef<{ x: number; y: number; id: number; mode: "undecided" | "h" | "v" } | null>(null)
  const onPointerDown = (event: ReactPointerEvent) => {
    if (event.button !== 0 || !allow(event.target)) return
    origin.current = { x: event.clientX, y: event.clientY, id: event.pointerId, mode: "undecided" }
  }
  const onPointerMove = (event: ReactPointerEvent) => {
    const o = origin.current
    if (!o || o.id !== event.pointerId) return
    const dx = event.clientX - o.x
    const dy = event.clientY - o.y
    if (o.mode === "undecided") {
      if (Math.abs(dx) < 12 && Math.abs(dy) < 12) return
      o.mode = Math.abs(dx) > Math.abs(dy) * 1.15 ? "h" : "v"
      if (o.mode === "v") origin.current = null
    }
  }
  const onPointerUp = (event: ReactPointerEvent) => {
    const o = origin.current
    origin.current = null
    if (!o || o.mode !== "h" || o.id !== event.pointerId) return
    const dx = event.clientX - o.x
    if (Math.abs(dx) < 56) return
    onCommit(dx < 0 ? 1 : -1)
  }
  return { onPointerDown, onPointerMove, onPointerUp, onPointerCancel: () => { origin.current = null } }
}

function SwipeRow({
  name,
  canAct,
  flocking,
  onDone,
  onPush,
  onMiss,
  children,
}: {
  name: string
  canAct: boolean
  flocking: boolean
  onDone: () => void
  onPush: () => void
  onMiss: () => void
  children: ReactNode
}) {
  const [x, setX] = useState(0)
  const [live, setLive] = useState(false)
  const origin = useRef<{ x: number; y: number; id: number; mode: "undecided" | "h" | "v" } | null>(null)
  const xRef = useRef(0)
  const dragged = useRef(false)
  const setPos = (n: number) => {
    const next = Math.max(-156, Math.min(88, n))
    xRef.current = next
    setX(next)
  }
  const end = (event: ReactPointerEvent) => {
    const o = origin.current
    origin.current = null
    setLive(false)
    if (!o || o.mode !== "h") return
    const dx = event.clientX - o.x
    if (dx > 72 && canAct) {
      setPos(0)
      onDone()
      return
    }
    if (dx < -72 && canAct) setPos(-156)
    else setPos(0)
  }
  return (
    <div className={`todo-ios-swipe${flocking ? " todo-ios-flock" : ""}`} data-swipe-row={name}>
      {canAct ? (
        <div className="todo-ios-swipe-back">
          <span className="is-done">Done</span>
          <button type="button" className="is-push" data-no95 aria-label={`Push ${name}`} onClick={() => { setPos(0); onPush() }}>
            Push
          </button>
          <button type="button" className="is-miss" data-no95 aria-label={`Missed ${name}`} onClick={() => { setPos(0); onMiss() }}>
            Missed
          </button>
        </div>
      ) : null}
      <div
        className={`todo-ios-swipe-face${live ? " is-live" : ""}`}
        style={{ transform: x ? `translate3d(${x}px,0,0)` : undefined }}
        onPointerDown={(event) => {
          if (event.button !== 0 || (event.target as HTMLElement).closest(".todo-ios-circle")) return
          origin.current = { x: event.clientX, y: event.clientY, id: event.pointerId, mode: "undecided" }
          dragged.current = false
          setLive(true)
        }}
        onPointerMove={(event) => {
          const o = origin.current
          if (!o || o.id !== event.pointerId || !canAct) return
          const dx = event.clientX - o.x
          const dy = event.clientY - o.y
          if (o.mode === "undecided") {
            if (Math.abs(dx) < 10 && Math.abs(dy) < 10) return
            o.mode = Math.abs(dx) > Math.abs(dy) ? "h" : "v"
            if (o.mode === "v") {
              origin.current = null
              setLive(false)
              return
            }
            event.currentTarget.setPointerCapture(event.pointerId)
          }
          if (o.mode !== "h") return
          dragged.current = true
          setPos(dx)
        }}
        onPointerUp={end}
        onPointerCancel={() => {
          origin.current = null
          setLive(false)
          setPos(0)
        }}
        onClickCapture={(event) => {
          if (!dragged.current) return
          dragged.current = false
          event.preventDefault()
          event.stopPropagation()
        }}
      >
        {children}
      </div>
    </div>
  )
}

function Sheet({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose()
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [onClose])
  return (
    <div className="todo-ios-sheet-root">
      <button type="button" className="todo-ios-dim" aria-label="Dismiss" data-no95 onClick={onClose} />
      <div className="todo-ios-sheet" role="dialog" aria-modal="true" aria-label={title}>
        <div className="todo-ios-grab" aria-hidden />
        <div className="todo-ios-sheet-head">
          <button type="button" className="todo-ios-textbtn" data-no95 onClick={onClose}>
            Close
          </button>
          <h2>{title}</h2>
          <span style={{ width: 64 }} aria-hidden />
        </div>
        <div className="todo-ios-sheet-body">{children}</div>
      </div>
    </div>
  )
}

export function TodoMobile(props: TodoMobileProps) {
  const {
    activeTab,
    onTab,
    focusedDate,
    onFocusedDate,
    heading,
    dateLabel,
    periodLabel,
    openCount,
    undoneCount,
    viewingPast,
    headerLoad,
    lens,
    period,
    openTodos,
    tasks,
    taskFor,
    isStoredTask,
    seasonRequired,
    seasonAssigned,
    seasonHint,
    other,
    stripShown,
  } = props
  const [compact, setCompact] = useState(false)
  const [menu, setMenu] = useState<Menu>(null)
  const [query, setQuery] = useState("")
  const [composer, setComposer] = useState("")
  const [composerTier, setComposerTier] = useState<TodoItem["tier"]>("A")
  const [pageMotion, setPageMotion] = useState<"idle" | "leave-next" | "leave-prev" | "enter-next" | "enter-prev">("idle")
  const scrollRef = useRef<HTMLDivElement>(null)
  const pageRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const root = pageRef.current
    if (!root) return
    const tabs = document.querySelector(".home-tabs")
    const header = Number.parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--home-tabs-top")) || 0
    const tabsH = tabs?.getBoundingClientRect().height ?? 0
    const y = root.getBoundingClientRect().top + window.scrollY - header - tabsH
    window.scrollTo(0, Math.max(0, y))
  }, [])

  const navLabel = dateLabel

  const atCurrent =
    activeTab === "quarter"
      ? quarterKey(focusedDate) === quarterKey(new Date())
      : activeTab === "other"
        ? true
        : isCurrentPeriod(period, focusedDate)

  const shift = (dir: -1 | 1) => {
    if (activeTab === "other") return
    const lensKey = activeTab === "quarter" ? "quarter" : activeTab
    const next = navigateDate(focusedDate, lensKey, dir)
    const go = () => {
      onFocusedDate(next)
      props.onOpenRow(null)
      setQuery("")
    }
    if (reducedMotion()) {
      go()
      return
    }
    setPageMotion(dir > 0 ? "leave-next" : "leave-prev")
    window.setTimeout(() => {
      go()
      setPageMotion(dir > 0 ? "enter-next" : "enter-prev")
      window.setTimeout(() => setPageMotion("idle"), 420)
    }, 160)
  }

  const periodSwipe = useHorizontalSwipe(shift, (target) => {
    const el = target as HTMLElement | null
    if (!el?.closest) return false
    return !el.closest("[data-swipe-row], button, a, input, select, textarea, label")
  })

  const prevLabel = activeTab === "quarter" ? "Previous season" : activeTab === "week" ? "Previous week" : activeTab === "month" ? "Previous month" : "Previous day"
  const nextLabel = activeTab === "quarter" ? "Next season" : activeTab === "week" ? "Next week" : activeTab === "month" ? "Next month" : "Next day"

  const requiredOf = (todo: TodoItem) => props.isRequired(todo.taskId || todo.id)
  const prioritizedOf = (todo: TodoItem) => props.isPrioritized(todo.taskId || todo.id)
  const { required, assigned } = splitByCommitment(openTodos, requiredOf)
  const assignedPinned = pinPrioritizedFirst(assigned, prioritizedOf)
  const matchQuery = (todo: TodoItem) => {
    const task = taskFor(todo.taskId || todo.id)
    return taskMatchesAssignedQuery(itemTitle(todo), task?.subtasks, query)
  }
  const visibleAssigned = assignedPinned.filter(matchQuery)
  const bgeOn = props.bgeTiers && lens === "period"
  const bgeSections = bgeOn
    ? splitByTier(
        pinPrioritizedFirst([...required, ...assigned], prioritizedOf).filter(matchQuery),
        (todo) => props.bgeTierOf(todo.taskId || todo.id),
      )
    : null
  const bgeEntries: BgeEntry[] = bgeOn
    ? [...openTodos.map((todo) => ({ todo, done: false })), ...props.doneTodos.map((todo) => ({ todo, done: true })), ...props.missedTodos.map((todo) => ({ todo, done: false }))].flatMap(
        ({ todo, done }) => (isStoredTask(todo.taskId || todo.id) ? [{ tier: props.bgeTierOf(todo.taskId || todo.id), done }] : []),
      )
    : []
  const bge = bgeEntries.length ? bgeScore(bgeEntries) : null

  const composerMatch = composer.trim()
    ? [...required, ...visibleAssigned].find((todo) => itemTitle(todo).toLowerCase() === composer.trim().toLowerCase())
    : undefined

  const submitComposer = (focusFirstStep: boolean) => {
    const description = composer.trim()
    if (!description) return
    if (composerMatch) {
      props.onOpenRow(composerMatch.id)
      setComposer("")
      return
    }
    props.onQuickAdd(description, composerTier, focusFirstStep)
    setComposer("")
  }

  const openTodo = openTodos.find((todo) => todo.id === props.openRowId) ?? null
  const seasonTask =
    !openTodo && props.openRowId
      ? [...seasonRequired, ...seasonAssigned].find((task) => task.id === props.openRowId) ?? null
      : null

  useEffect(() => {
    if (!props.openRowId) return
    if (openTodo || seasonTask) return
    props.onOpenRow(null)
  }, [props.openRowId, openTodo, seasonTask, props.onOpenRow])

  const showComposer = lens === "period"

  return (
    <div
      ref={pageRef}
      className="todo-ios"
      data-todo-layout="phone"
      data-ui-name="To Do"
      data-ui-help="Phone list for day, week, month, and season tasks."
      data-ui-docs="components/Home/ToDo/README.md"
      data-ui-docs-anchor="phone"
    >
      <header className={`todo-ios-bar${compact ? " is-compact" : ""}`}>
        <div className="todo-ios-title-row">
          {compact && activeTab !== "other" ? (
            <button type="button" className="todo-ios-navbtn" data-no95 aria-label={prevLabel} onClick={() => shift(-1)}>
              ‹
            </button>
          ) : null}
          <h2 className="todo-ios-title">
            {compact ? navLabel : heading}
            <span className="todo-ios-count">{openCount}</span>
          </h2>
          <button type="button" className="todo-ios-textbtn" data-no95 aria-haspopup="dialog" aria-expanded={menu === "more"} onClick={() => setMenu(menu === "more" ? null : "more")}>
            More
          </button>
        </div>
        {activeTab !== "other" && !compact ? (
          <div
            className="todo-ios-date"
            data-ui-name="Period nameplate"
            aria-label={`${navLabel}. Swipe sideways for the next period.`}
            {...periodSwipe}
          >
            <button type="button" className="todo-ios-navbtn" data-no95 aria-label={prevLabel} onClick={() => shift(-1)}>
              ‹
            </button>
            <div className="todo-ios-date-label">{navLabel}</div>
            <button type="button" className="todo-ios-navbtn" data-no95 aria-label={nextLabel} onClick={() => shift(1)}>
              ›
            </button>
            <button type="button" className="todo-ios-navbtn is-word" data-no95 disabled={atCurrent} onClick={() => { onFocusedDate(new Date()); props.onOpenRow(null) }}>
              Today
            </button>
          </div>
        ) : null}
        <div className="todo-ios-seg" role="tablist" aria-label="Period keys" data-ui-name="Period keys">
          {SPAN.map(({ value, word }) => (
            <button
              key={value}
              type="button"
              role="tab"
              data-no95
              aria-selected={activeTab === value}
              onClick={() => {
                if (value !== activeTab) {
                  onTab(value)
                  setQuery("")
                  setMenu(null)
                }
              }}
            >
              {word}
            </button>
          ))}
        </div>
        <p className="todo-ios-load" data-ui-name="Status bar">
          <span>
            {periodLabel}
            {viewingPast ? ` · ${undoneCount} undone` : ""}
            {" · "}
            <strong>{openCount} open</strong>
          </span>
        </p>
        {headerLoad ? (
          <button
            type="button"
            className="todo-ios-load"
            data-no95
            aria-expanded={menu === "load"}
            aria-label={`Load: ${headerLoad.text}. ${menu === "load" ? "Hide" : "Show"} the load instrument`}
            onClick={() => setMenu(menu === "load" ? null : "load")}
          >
            {headerLoad.text}
            {headerLoad.overCap ? ` · ${props.inProgressCount} in progress` : ""}
          </button>
        ) : null}
      </header>

      <div
        className="todo-ios-scroll"
        ref={scrollRef}
        {...(activeTab === "other" ? {} : periodSwipe)}
        onScroll={(event) => setCompact(event.currentTarget.scrollTop > 12)}
      >
        <div className={`todo-ios-page is-${pageMotion}`}>
          {lens === "other" ? (
            other
          ) : lens === "season" ? (
            <SeasonList
              hint={seasonHint}
              required={seasonRequired}
              assigned={seasonAssigned}
              query={query}
              onQuery={setQuery}
              props={props}
            />
          ) : (
            <>
              {period === "day" && props.morningTasks.length > 0 ? (
                <section className="todo-ios-section todo-ios-morning" data-ui-name="Morning priorities">
                  <h3>Morning priorities</h3>
                  <ol className="todo-ios-group">
                    {props.morningTasks.map((task) => (
                      <li key={task.id} className={task.completed ? "is-done" : undefined}>
                        <button type="button" data-no95 onClick={() => props.onTaskClick(task.id)}>
                          {itemTitleOrUntitled(task)}
                          {task.completed ? <span className="todo-visually-hidden"> (done)</span> : null}
                        </button>
                      </li>
                    ))}
                  </ol>
                </section>
              ) : null}
              {bge ? (
                <div className="todo-ios-score" data-ui-name="B/G/E score">
                  <b>
                    {Math.round(bge.points)}
                    <small>%</small>
                  </b>
                  <span>
                    B {bge.min.done}/{bge.min.total} · G {bge.goal.done}/{bge.goal.total} · E {bge.exceptional.done}/{bge.exceptional.total}
                    {bge.bonus > 0 ? ` · +${Math.round(bge.bonus)} bonus` : ""}
                  </span>
                  <span>
                    {bgeEntries.filter((e) => e.done).length} of {bgeEntries.length} tasks done
                  </span>
                </div>
              ) : null}
              <label className="todo-visually-hidden" htmlFor="todo-ios-search">
                Search assigned tasks
              </label>
              <input
                id="todo-ios-search"
                className="todo-ios-search"
                type="search"
                value={query}
                placeholder="Search assigned tasks"
                aria-label="Search assigned tasks"
                onChange={(event) => setQuery(event.target.value)}
              />
              {bgeSections ? (
                (["min", "goal", "exceptional"] as const).map((tier) => (
                  <Section key={tier} title={tier === "min" ? "Bare minimum" : tier === "goal" ? "Goal" : "Exceptional"} count={bgeSections[tier].length}>
                    {bgeSections[tier].length === 0 ? (
                      <p className="todo-ios-empty">{query.trim() ? "Nothing matches." : "Nothing in this tier yet."}</p>
                    ) : (
                      bgeSections[tier].map((todo) => <TaskRow key={todo.id} todo={todo} period={period} props={props} />)
                    )}
                  </Section>
                ))
              ) : (
                <>
                  {required.length > 0 ? (
                    <Section title="Required" count={required.length} ui="Required">
                      {required.map((todo) => (
                        <TaskRow key={todo.id} todo={todo} period={period} props={props} />
                      ))}
                    </Section>
                  ) : null}
                  <Section title="Assigned" count={assigned.length} ui="Assigned">
                    {visibleAssigned.length === 0 ? (
                      <p className="todo-ios-empty">
                        {query.trim() ? "Nothing matches." : required.length > 0 ? "Nothing else assigned." : "Nothing scheduled here yet."}
                      </p>
                    ) : (
                      visibleAssigned.map((todo) => <TaskRow key={todo.id} todo={todo} period={period} props={props} />)
                    )}
                  </Section>
                </>
              )}
              <WaitingLine hidden={props.hiddenWaiting} peeking={props.peeking} onPeek={props.onPeek} />
              <div className="todo95 todo-ios-wells">
                {viewingPast && props.undoneTodos.length > 0 ? (
                  <UndoneTodoSection
                    todos={props.undoneTodos}
                    tasks={tasks}
                    period={period}
                    pushTitle={props.pushTitle}
                    open={props.undoneOpen}
                    onOpenChange={props.onUndoneOpen}
                    onTaskClick={props.onTaskClick}
                    onAssimilate={props.onAssimilate}
                    onPush={props.onUndonePush}
                    onDiscard={props.onDiscard}
                  />
                ) : null}
                {props.doneTodos.length > 0 ? (
                  <DoneTodoSection
                    title={props.doneTitle}
                    todos={props.doneTodos}
                    tasks={tasks}
                    period={period}
                    open={props.doneOpen}
                    onOpenChange={props.onDoneOpen}
                    onTaskClick={props.onTaskClick}
                    onAddDone={props.onAddDone}
                    onConfirmTimes={props.onConfirmTimes}
                    refDate={focusedDate}
                  />
                ) : null}
                {props.missedTodos.length > 0 ? (
                  <MissedTodoSection
                    title={props.missedTitle}
                    todos={props.missedTodos}
                    tasks={tasks}
                    period={period}
                    open={props.missedOpen}
                    onOpenChange={props.onMissedOpen}
                    onTaskClick={props.onTaskClick}
                  />
                ) : null}
              </div>
            </>
          )}
        </div>
      </div>

      {showComposer ? (
        <form
          className="todo-ios-composer"
          data-ui-name="Assigned composer"
          onSubmit={(event) => {
            event.preventDefault()
            submitComposer(false)
          }}
        >
          <input
            type="text"
            value={composer}
            placeholder="Add a task…"
            aria-label="Add a task"
            enterKeyHint="done"
            onChange={(event) => setComposer(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault()
                submitComposer(event.shiftKey)
              }
            }}
          />
          <NativeSelect aria-label="Composer tier" value={composerTier} onChange={(event) => setComposerTier(event.target.value as TodoItem["tier"])}>
            {TIERS.map((tier) => (
              <option key={tier} value={tier}>
                {tier}
              </option>
            ))}
          </NativeSelect>
          {composerMatch ? (
            <button
              type="button"
              className="todo-ios-textbtn"
              data-no95
              onClick={() => {
                props.onOpenRow(composerMatch.id)
                setComposer("")
              }}
            >
              Open existing
            </button>
          ) : (
            <button type="submit" className="todo-ios-textbtn" data-no95>
              Add
            </button>
          )}
          <AddDoneDialog onAdd={props.onAddDone} />
        </form>
      ) : lens === "season" ? (
        <div className="todo-ios-composer">
          <AddTodoDialog onAdd={props.onAdd} searchExisting={props.searchExisting} onPickExisting={props.onPickExisting} onOpenPickList={props.onOpenPickList} />
          <AddDoneDialog onAdd={props.onAddDone} />
        </div>
      ) : null}

      {menu === "more" ? (
        <Sheet title="More" onClose={() => setMenu(null)}>
          <div className="todo-ios-group todo-ios-menu">
            {stripShown ? (
              <button type="button" className="todo-ios-menu-row" data-no95 onClick={() => setMenu("show")}>
                Show and sort{props.filterCount > 0 ? ` ${props.filterCount}` : ""}
              </button>
            ) : null}
            {props.listName && props.onOpenList ? (
              <button type="button" className="todo-ios-menu-row" data-no95 onClick={() => { props.onOpenList?.(); setMenu(null) }}>
                Open list
              </button>
            ) : null}
            {activeTab !== "other" ? (
              <AddTodoDialog onAdd={props.onAdd} searchExisting={props.searchExisting} onPickExisting={props.onPickExisting} onOpenPickList={props.onOpenPickList} />
            ) : null}
            <SessionKey onOpen={() => { props.onOpenSession(); setMenu(null) }} />
            <SessionsKey onOpen={() => { props.onOpenSessions(); setMenu(null) }} />
            <TodoSettingsDialog paceSlot={props.paceSlot} />
            {stripShown ? (
              <button type="button" className="todo-ios-menu-row" data-no95 onClick={() => { props.onShowFormula(true); setMenu("formula") }}>
                Formula
              </button>
            ) : null}
          </div>
        </Sheet>
      ) : null}
      {menu === "show" && stripShown ? (
        <Sheet title="Show and sort" onClose={() => setMenu(null)}>
          <div className="todo95 todo-ios-drawer">
            <TodoFilters
              period={period}
              availableNow={props.availableNow}
              onAvailableNowChange={props.onAvailableNowChange}
              showAllTasks={props.showAllTasks}
              onShowAllTasksChange={props.onShowAllTasksChange}
              statusFilter={props.statusFilter}
              onStatusFilterChange={props.onStatusFilterChange}
              onToggleFormula={() => { props.onShowFormula(true); setMenu("formula") }}
              listName={props.listName}
              onOpenList={props.onOpenList}
            />
            <TodoSortKeys
              period={period}
              sortMode={props.sortMode}
              onSortModeChange={props.onSortModeChange}
              sortOrder={props.sortOrder}
              onSortOrderChange={props.onSortOrderChange}
            />
          </div>
        </Sheet>
      ) : null}
      {menu === "load" && props.loadPanel ? (
        <Sheet title="Load" onClose={() => setMenu(null)}>
          <div className="todo95 todo-ios-drawer">{props.loadPanel}</div>
        </Sheet>
      ) : null}
      {menu === "formula" ? (
        <Sheet title="Priority formula" onClose={() => { props.onShowFormula(false); setMenu(null) }}>
          <div className="todo95 todo-ios-drawer">
            <PriorityFormulaPanel />
          </div>
        </Sheet>
      ) : null}
      {openTodo ? <TaskSheet todo={openTodo} period={period} props={props} onClose={() => props.onOpenRow(null)} /> : null}
      {seasonTask ? <SeasonSheet task={seasonTask} props={props} onClose={() => props.onOpenRow(null)} /> : null}
      {props.children}
    </div>
  )
}

function Section({ title, count, ui, children }: { title: string; count: number; ui?: string; children: ReactNode }) {
  return (
    <section className="todo-ios-section" data-ui-name={ui} aria-label={title}>
      <h3>
        {title} <span className="todo-ios-count">{count}</span>
      </h3>
      <div className="todo-ios-group" role="list">
        {children}
      </div>
    </section>
  )
}

function TaskRow({ todo, period, props }: { todo: TodoItem; period: TodoPeriod; props: TodoMobileProps }) {
  const id = todo.taskId || todo.id
  const walk = isRitualTodoId(todo.id)
  const name = itemTitle(todo)
  const task = props.taskFor(id)
  const steps = task?.subtasks
  const flat = flattenSteps(steps)
  const minutes = effectiveDurationMinutes(task?.estimatedDuration, steps)
  const spent = walk ? 0 : props.spentOf(id)
  const pushed = todo[pushedKeyForPeriod(period)] ?? 0
  const required = props.isRequired(id)
  const prioritized = props.isPrioritized(id)
  const status = props.getStatus(todo.id)
  const onClock = !walk && props.clockTaskId === id
  const blockers = walk ? [] : props.blockersOf(id)
  const hours = pairUsesHours(spent, minutes || props.defaultEstimateMin)
  const time =
    walk
      ? ""
      : minutes > 0
        ? `${spent > 0 ? `${compactDuration(spent, hours)}/` : ""}${compactDuration(minutes, spent > 0 && hours)}`
        : props.defaultEstimateMin > 0
          ? `~${compactDuration(props.defaultEstimateMin, spent > 0 && pairUsesHours(spent, props.defaultEstimateMin))}`
          : ""
  const meta = [
    walk ? "Rite" : todo.tier,
    time,
    flat.length ? `${flat.filter((s) => s.completed).length}/${flat.length}` : "",
    pushed > 0 ? `pushed ×${pushed}` : "",
    blockers.length ? `needs ${blockers[0]}` : "",
    todo.daysOverdue > 0 ? waitingSinceLabel(todo.daysOverdue) : "",
  ].filter(Boolean)
  return (
    <SwipeRow
      name={name}
      canAct={!walk}
      flocking={props.flockingId === todo.id}
      onDone={() => props.onComplete(todo.id)}
      onPush={() => props.onPush(todo.id)}
      onMiss={() => props.onMissed(todo.id)}
    >
      <div className="todo-ios-row" role="listitem">
        <button
          type="button"
          data-no95
          className={`todo-ios-circle${status === "partial" ? " is-partial" : ""}${onClock ? " is-clock" : ""}`}
          aria-label={walk ? `Open ${name}` : `Done, ${name}`}
          onClick={() => (walk ? props.onTaskClick(todo.id) : props.onComplete(todo.id))}
        >
          <i />
        </button>
        <button type="button" className="todo-ios-row-copy" data-no95 aria-label={name} style={{ border: 0, background: "transparent", textAlign: "left", minHeight: 44, padding: 0 }} onClick={() => (walk ? props.onTaskClick(todo.id) : props.onOpenRow(todo.id))}>
          <span className="todo-ios-name-line">
            <span className="todo-ios-name">{name}</span>
            {required ? <img className="todo-ios-gem" src={GEM_REQUIRED} alt="" title="Required" /> : null}
            {prioritized ? <img className="todo-ios-gem" src={GEM_PRIORITIZED} alt="" title="Prioritized" /> : null}
          </span>
          <span className={`todo-ios-meta${spent > minutes && minutes > 0 ? " is-over" : ""}`}>{meta.join(" · ")}</span>
        </button>
        <span className="todo-ios-chevron" aria-hidden>
          ›
        </span>
      </div>
    </SwipeRow>
  )
}

function TaskSheet({ todo, period, props, onClose }: { todo: TodoItem; period: TodoPeriod; props: TodoMobileProps; onClose: () => void }) {
  const id = todo.taskId || todo.id
  const name = itemTitle(todo)
  const task = props.taskFor(id)
  const steps = task?.subtasks
  const flat = flattenSteps(steps)
  const pushed = todo[pushedKeyForPeriod(period)] ?? 0
  const unlock = props.unlockOf(id)
  const blockers = props.blockersOf(id)
  const status = props.getStatus(todo.id)
  const onClock = props.clockTaskId === id
  const reached = hasStepTiers(steps) ? levelReached({ subtasks: steps }) : "none"
  const top = hasStepTiers(steps) ? levelReached({ subtasks: steps }, true) : "none"
  const showLevel = (reached === "min" || reached === "goal") && reached !== top
  const levelWord = reached === "min" ? "Bare minimum" : "Goal"
  return (
    <Sheet title={name} onClose={onClose}>
      <input
        className="todo-ios-rename"
        aria-label="Task name"
        defaultValue={name}
        onBlur={(event) => {
          const next = event.target.value.trim()
          if (next && next !== name) props.onRename(todo.id, next)
        }}
        onKeyDown={(event) => {
          if (event.key === "Enter") (event.target as HTMLInputElement).blur()
        }}
      />
      <p className="todo-ios-meta" style={{ margin: "0 4px 12px" }}>
        {getScheduleLabel(todo)}
        {todo.daysOverdue > 0 ? ` · ${waitingSinceLabel(todo.daysOverdue)}` : ""}
        {` · pushed ×${pushed}`}
        {` · ${splitPercent(steps)}%`}
        {unlock ? ` · unlocks ${unlock.count}` : ""}
        {blockers.length ? ` · needs ${blockers.join(", ")}` : ""}
      </p>
      <div className="todo-ios-actions" role="toolbar" aria-label="Drawer actions">
        <button type="button" className="todo-ios-action is-done" data-no95 onClick={() => props.onComplete(todo.id)}>
          Done
        </button>
        {showLevel ? (
          <button type="button" className="todo-ios-action" data-no95 aria-label={`Done at ${levelWord}`} onClick={() => props.onComplete(todo.id, reached === "min" ? "min" : "goal")}>
            Done at {lvl === "min" ? "B" : "G"}
          </button>
        ) : null}
        <button type="button" className="todo-ios-action" data-no95 onClick={() => { props.onJustStart(id); onClose() }}>
          Start
        </button>
        <button type="button" className="todo-ios-action" data-no95 aria-label={`Just 25 on ${name}`} onClick={() => { openSession({ startOn: "session", templateId: JUST_25_TEMPLATE_ID, seed: [{ taskId: id }] }); onClose() }}>
          Just 25
        </button>
        <button type="button" className="todo-ios-action" data-no95 onClick={() => props.onPush(todo.id)}>
          Push
        </button>
        <button type="button" className="todo-ios-action" data-no95 onClick={() => props.onMissed(todo.id)}>
          Missed
        </button>
        <button type="button" className="todo-ios-action" data-no95 onClick={() => props.onNeeds(id)}>
          Needs…
        </button>
        <button type="button" className="todo-ios-action" data-no95 onClick={() => props.onTaskClick(id)}>
          View
        </button>
        <button type="button" className="todo-ios-action" data-no95 aria-label={`Open task card for ${name}`} onClick={() => { openTaskCard(id); onClose() }}>
          Card
        </button>
        <button type="button" className="todo-ios-action" data-no95 onClick={() => (onClock ? props.onClockStop() : props.onClockStart(id))}>
          {onClock ? "Stop clock" : "Working now"}
        </button>
        <TodoDeleteButton
          prompt={flat.length ? `Delete "${name}" and its ${flat.length} steps?` : `Delete "${name}"?`}
          onDelete={() => props.onDelete(todo.id)}
        />
      </div>
      <div className="todo-ios-flags">
        <button type="button" className="todo-ios-flag" data-no95 aria-pressed={props.isRequired(id)} aria-label="Required" onClick={() => props.onToggleRequired(id)}>
          <img src={GEM_REQUIRED} alt="" />
          Required
        </button>
        <button type="button" className="todo-ios-flag" data-no95 aria-pressed={props.isPrioritized(id)} aria-label="Prioritized" onClick={() => props.onTogglePrioritized(id)}>
          <img src={GEM_PRIORITIZED} alt="" />
          Prioritized
        </button>
        <button
          type="button"
          className="todo-ios-flag"
          data-no95
          aria-pressed={status === "partial"}
          aria-label="Active"
          onClick={() => props.onStatus(todo.id, toggleTodoActiveLamp(status))}
        >
          {status === "partial" ? "In progress" : "Active"}
        </button>
        {props.bgeTiers ? (
          <div className="todo-ios-bge" role="radiogroup" aria-label="Tier on this list">
            {BGE_KEYS.map(({ tier, short, title }) => (
              <button key={tier} type="button" role="radio" data-no95 aria-checked={props.bgeTierOf(id) === tier} title={title} onClick={() => props.onBgeTier(id, tier)}>
                {short}
              </button>
            ))}
          </div>
        ) : null}
      </div>
      <label className="todo-ios-meta" style={{ display: "block", margin: "0 4px 8px" }}>
        Tier
        <NativeSelect aria-label="Tier" value={todo.tier} onChange={(event) => props.onTier(todo.id, event.target.value as TodoItem["tier"])}>
          {TIERS.map((tier) => (
            <option key={tier} value={tier}>
              {tier}
            </option>
          ))}
        </NativeSelect>
      </label>
      {props.noticeOf(todo.id) ? (
        <input
          className="todo-ios-note"
          aria-label={NOTICE_PROMPT}
          placeholder={NOTICE_PROMPT}
          onKeyDown={(event) => {
            if (event.key !== "Enter") return
            const text = (event.target as HTMLInputElement).value.trim()
            if (text) props.onNotice(todo.id, text)
            ;(event.target as HTMLInputElement).value = ""
          }}
        />
      ) : null}
      <div className="todo95 todo-ios-drawer">
        <TodoBreakdown
          estimate={task?.estimatedDuration}
          steps={steps}
          onEstimateChange={(minutes) => props.onEstimate(todo.id, minutes)}
          onStepsChange={(subtasks) => props.onSteps(todo.id, subtasks)}
          onOpenStep={(step) => openStepItem(id, step.id)}
          time={props.timeOf(id)}
        />
      </div>
    </Sheet>
  )
}

function SeasonList({
  hint,
  required,
  assigned,
  query,
  onQuery,
  props,
}: {
  hint: string
  required: Task[]
  assigned: Task[]
  query: string
  onQuery: (value: string) => void
  props: TodoMobileProps
}) {
  const visible = assigned.filter((task) => taskMatchesAssignedQuery(itemTitleOrUntitled(task), task.subtasks, query))
  return (
    <>
      <p className="todo-ios-empty">{hint}</p>
      <input className="todo-ios-search" type="search" value={query} placeholder="Search assigned tasks" aria-label="Search assigned tasks" onChange={(event) => onQuery(event.target.value)} />
      {required.length > 0 ? (
        <Section title="Required" count={required.length} ui="Required">
          {required.map((task) => (
            <SeasonRow key={task.id} task={task} props={props} />
          ))}
        </Section>
      ) : null}
      <Section title="Assigned" count={assigned.length} ui="Assigned">
        {visible.length === 0 ? (
          <p className="todo-ios-empty">{query.trim() ? "Nothing matches." : required.length ? "Nothing else assigned." : "Nothing scheduled in this season yet."}</p>
        ) : (
          visible.map((task) => <SeasonRow key={task.id} task={task} props={props} />)
        )}
      </Section>
    </>
  )
}

function SeasonRow({ task, props }: { task: Task; props: TodoMobileProps }) {
  const name = itemTitleOrUntitled(task)
  const steps = flattenSteps(task.subtasks).length
  return (
    <div className="todo-ios-swipe" role="listitem">
      <button type="button" className="todo-ios-row" data-no95 onClick={() => props.onOpenRow(task.id)}>
        <span className="todo-ios-row-copy">
          <span className="todo-ios-name-line">
            <span className="todo-ios-name">{name}</span>
            {props.isRequired(task.id) ? <img className="todo-ios-gem" src={GEM_REQUIRED} alt="" /> : null}
            {props.isPrioritized(task.id) ? <img className="todo-ios-gem" src={GEM_PRIORITIZED} alt="" /> : null}
          </span>
          <span className="todo-ios-meta">{steps ? `${steps} steps` : "Season"}</span>
        </span>
        <span className="todo-ios-chevron" aria-hidden>›</span>
      </button>
    </div>
  )
}

function SeasonSheet({ task, props, onClose }: { task: Task; props: TodoMobileProps; onClose: () => void }) {
  const name = itemTitleOrUntitled(task)
  const steps = flattenSteps(task.subtasks)
  return (
    <Sheet title={name} onClose={onClose}>
      <div className="todo-ios-flags">
        <button type="button" className="todo-ios-flag" data-no95 aria-pressed={props.isRequired(task.id)} aria-label="Required" onClick={() => props.onToggleRequired(task.id)}>
          <img src={GEM_REQUIRED} alt="" />
          Required
        </button>
        <button type="button" className="todo-ios-flag" data-no95 aria-pressed={props.isPrioritized(task.id)} aria-label="Prioritized" onClick={() => props.onTogglePrioritized(task.id)}>
          <img src={GEM_PRIORITIZED} alt="" />
          Prioritized
        </button>
        <button type="button" className="todo-ios-action" data-no95 onClick={() => props.onTaskClick(task.id)}>
          View
        </button>
        <TodoDeleteButton prompt={steps.length ? `Delete "${name}" and its ${steps.length} steps?` : `Delete "${name}"?`} onDelete={() => props.onDelete(task.id)} />
      </div>
      <div className="todo95 todo-ios-drawer">
        <TodoBreakdown
          estimate={task.estimatedDuration}
          steps={task.subtasks}
          onEstimateChange={(minutes) => props.onEstimate(task.id, minutes)}
          onStepsChange={(subtasks) => props.onSteps(task.id, subtasks)}
          onOpenStep={(step) => openStepItem(task.id, step.id)}
          time={props.timeOf(task.id)}
        />
      </div>
    </Sheet>
  )
}
