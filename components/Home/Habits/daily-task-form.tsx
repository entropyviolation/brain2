/**
 * components/Home/Habits/daily-task-form.tsx — Habit form
 *
 * The form for creating/editing a habit: name, period frequency, type tiles
 * (Yes/No, Goal, Text, Climb), then completion sources, then the target.
 * When neglect is why the habit is prioritized, that sentence is the first
 * line of the body (`neglectPrioritySentence`).
 * Climb adds cadence (Weekly + / Daily +),
 * starting value, increment, and optional unit.
 *
 * Daily Goal, Yes/No, and weekly/monthly Goal / Yes/No habits also get
 * **Auto-fill from Tracking**: pick tracking tags and the time painted on any
 * pen carrying them counts toward the habit for that day, week, or month
 * (`lib/habit-tracking.ts`).
 *
 * **Time estimate** gives the habit a clock length: minutes per unit of the goal
 * (10 min per page) or a flat length per completion. **N/A** stores no minutes
 * (`timeEstimateNA`) for a habit with no meaningful duration. That is what lets
 * the Done row it writes carry a duration and a real window instead of a bare
 * date (`lib/habit-time-estimate.ts`). Anything derived from a rate is flagged
 * for confirmation in the review unless it is marked as a known ("definite") length.
 *
 * **Auto-fill from Tracking** (tags and Create tag) is shown only while the
 * Tracking tags pipeline is on. Hiding it keeps the saved tags.
 * That row is the minute source. **Tags** is a different pipeline:
 * one tag, counted as Done tasks (a tracked block with the tag files one Done
 * line). The habit's own Done line carries that tag too.
 * **Habits stats** picks a set (daily, weekly, or monthly habits) and then
 * points. Engine points still turn on the floor, the total, and the daily
 * completion average. **Better than last week** stores a compare on that row.
 *
 * **Done task wording** is optional and collapsed. `{value}` is the number
 * logged. Blank keeps the habit name on the Done line (`lib/habit-done-log.ts`).
 *
 * **Lift when a log says** and **Connections** are the editable blocks for an
 * all-nighter exemption, a sleep clock (bedtime / wake at or before a threshold),
 * and a done next-action list. The to-do connection is the template for another habit.
 *
 * **Completion sources** are a pipeline (most trusted row first). Add source
 * asks for a broad type, then that row's config. An optional name is display-only.
 * **Daily habit total** sits inside Habits stats and picks its habit with the
 * same Win95 menu.
 * **BIM Keywords** count exact whole messages the BIM bot already stored
 * (`WeeklyTask.textTriggers` / `lib/habit-keyword-source.ts`). The source row
 * chooses true if one arrives, true after a set number, or a logged phrase
 * such as `read {n} pages of {bookname}` or `cleaned for {x} minutes`.
 * `{n}`, `{x}`, and `{minutes}` are the amount. A minutes or hours pattern
 * also paints that prior span on the habit’s tracking activity; no clock
 * ends it at the message time and marks the block estimated. The phrase list
 * stays under BIM Keywords. **Try a phrase** still previews the older `dh:`
 * parser. The stored source id stays `keywords`.
 * **Open item in Lists** uses the standing habit item and the existing item-detail Back.
 *
 * Spec: §9.4 (habit data model).
 */
"use client"

import type React from "react"

import { useEffect, useId, useRef, useState } from "react"
import {
  type WeeklyTask,
  TaskType,
  type HabitFrequency,
  type HabitTimeEstimate,
  type HabitTrackingLink,
  type HabitTrackingMode,
  type HabitTrackingUnit,
  type HabitListLink,
  type HabitLogExemption,
  type HabitSleepLink,
  type HabitCompletionSourceId,
  type HabitCompletionPipeline,
  type HabitStatSet,
  type HabitListMeasure,
  type HabitListPipelineMode,
  type HabitListTarget,
  type HabitCoverageLink,
  type HabitTextTrigger,
  type HabitKeywordSource,
  type HabitKeywordUse,
  type IncrementalHabitData,
} from "@/lib/types"
import { normalizeTaskType } from "@/lib/habit-utils"
import { describeHabitTimeEstimate, isTimeMeasuredHabit } from "@/lib/habit-time-estimate"
import { formatLocalDateKey, formatLocalMonthKey, getWeekString, getWeekStartDate } from "@/lib/date-utils"
import { normalizeIncrementalData } from "@/lib/incremental-habits"
import { supportsTrackingLink } from "@/lib/habit-tracking"
import { defaultTriggersForHabit, describeHabitTriggerPreview, makeHabitTriggerId } from "@/lib/ingest/text-triggers"
import { KEYWORD_USE_OPTIONS, keywordForSubmit } from "@/lib/habit-keyword-source"
import { useTimeTrackingStore } from "@/lib/time-tracking-store"
import { penIdsForTags } from "@/lib/tracked-time"
import { useThemeStore } from "@/lib/theme-store"
import { CheckCircle2, AlignLeft, TrendingUp, Target, Star } from "lucide-react"
import { HabitGemChooser } from "@/components/Home/Habits/gem-picker"
import { pickRandomCatalogGem, resolveTaskGem } from "@/lib/habit-gems"
import { serializeSnapshot } from "@/lib/unsaved-changes"
import { currentExemptionContext, isHabitPeriodExempt, presetLogExemptions, sanitizeLogExemptions } from "@/lib/habit-exemption"
import { effectiveListLink, effectiveSleepLink, presetListLink, presetSleepLink } from "@/lib/habit-connections"
import {
  clampCoverageThreshold,
  DEFAULT_COVERAGE_THRESHOLD,
  deriveCompletionSources,
  effectiveCoverageLink,
  effectiveDailyFloorLink,
  presetCoverageLink,
  presetDailyFloorLink,
} from "@/lib/habit-completion-source"
import { openHabitInLists } from "@/lib/habit-list-item"
import { normalizeTag } from "@/lib/links"
import { Habit95Select, HabitPipelineEditor } from "@/components/Home/Habits/habit-sources-field"
import { StatSourceBuilder, openedStatBinding } from "@/components/Home/Habits/stat-source-builder"
import { COMPLETION_SOURCE_HINTS, COMPLETION_SOURCE_LABELS } from "@/lib/habit-completion-trust"
import {
  describeListRoutingPreview,
  effectiveHabitCount,
  flattenPipelines,
  legacyModeForRouting,
  listRoutingFromLink,
  pipelinesFromSources,
  storedListSentFields,
  togglePipelineSource,
} from "@/lib/habit-completion-pipeline"
import { clampListSentGrace } from "@/lib/list-sent"
import { calculateTaskPercentage } from "@/lib/calculations"
import { datesForCompletionAverage } from "@/lib/habit-daily-completion-average"
import { periodWindowsForFrequency } from "@/lib/habit-period-windows"
import { sumHabitValuesOverDays } from "@/lib/habit-value-sync"
import { type HabitStatContext } from "@/lib/habit-stat-points"
import { HabitListPopup } from "@/components/Home/Habits/habit-list-popup"
import { useHabitsStore } from "@/lib/habits-store"
import { localDayKey, useReviewsStore } from "@/lib/reviews-store"
import {
  applyPermanentPriority,
  applyPriorityPress,
  applyRitualPriority,
  neglectPrioritySentence,
  priorityMarkPercent,
} from "@/lib/habit-priority"
import { useTaskStore } from "@/lib/task-store"
import { isFolderAllItemsCategoryId } from "@/lib/folder-all-items"
import { habitPeriodPointsKey } from "@/lib/habit-points"
import { pointsRuleValue } from "@/lib/points-rules-live"
import { useUserSettingsStore } from "@/lib/user-settings-store"
import { offsetToClock, parseBedtime, parseWakeTime } from "@/lib/sleep-log"
import { ClockPicker } from "@/components/ui/clock-picker/clock-picker"

interface TaskFormProps {
  onSubmit: (task: WeeklyTask) => void
  onCancel: () => void
  onDelete?: (taskId: string) => void
  initialTask?: WeeklyTask | null
  defaultFrequency?: HabitFrequency
  onDirtyChange?: (dirty: boolean) => void
  /** Close the window without the unsaved prompt — the draft is stashed for the return trip. */
  onLeaveForItem?: () => void
}

const FREQUENCIES: { value: HabitFrequency; label: string }[] = [
  { value: "daily", label: "Daily" },
  { value: "weekly", label: "Weekly" },
  { value: "monthly", label: "Monthly" },
  { value: "quarterly", label: "Season" },
]

const HABIT_TYPES: {
  value: TaskType
  name: string
  desc: string
  colorKey: "habitBoolean" | "habitGoal" | "habitText" | "habitIncremental"
  Icon: typeof CheckCircle2
}[] = [
  { value: TaskType.BOOLEAN, name: "Yes/No", desc: "Did it happen?", colorKey: "habitBoolean", Icon: CheckCircle2 },
  { value: TaskType.GOAL, name: "Goal", desc: "Minutes, pages, reps…", colorKey: "habitGoal", Icon: Target },
  { value: TaskType.TEXT, name: "Text", desc: "A short log each period", colorKey: "habitText", Icon: AlignLeft },
  {
    value: TaskType.INCREMENTAL,
    name: "Climb",
    desc: "Daily or weekly rising target",
    colorKey: "habitIncremental",
    Icon: TrendingUp,
  },
]

const TRACKING_MODES: { value: HabitTrackingMode; label: string; desc: string }[] = [
  { value: "add", label: "Add", desc: "Tracked time tops up what you log by hand." },
  { value: "max", label: "Higher of the two", desc: "Counts your log or tracked time, whichever is more." },
  { value: "replace", label: "Tracking only", desc: "The tracker is the only source for this habit." },
]

const LIST_MEASURES: { id: HabitListMeasure; label: string; hint: string }[] = [
  { id: "sent", label: "Sent", hint: "Items where Sent is true." },
  { id: "completed", label: "Completed", hint: "Items where Completed is true." },
  { id: "added", label: "Added this period", hint: "Items added in this period." },
]

const LIST_TARGETS: { id: HabitListTarget; label: string; hint: string }[] = [
  {
    id: "periodSet",
    label: "This period's set",
    hint: "Still on the list without that yes/no, plus items that tripped it this period.",
  },
  { id: "listLength", label: "List length", hint: "How many items are on the list." },
  { id: "one", label: "One", hint: "A fixed 1." },
]

const GRACE_SENTENCE =
  "Grace 100 leaves the raw percent. Grace 80 means a raw 80 counts as 100, and a raw 40 counts as 50 (raw / grace × 100, capped at 100)."

function sourcesForListRouting(routing: { measure: HabitListMeasure; target: HabitListTarget }): HabitCompletionSourceId[] {
  const legacy = legacyModeForRouting(routing)
  if (legacy === "oneComplete") return ["list"]
  if (legacy === "allComplete" || legacy === "oneAdded") return []
  if (legacy === "sentThisWeek" || routing.measure === "sent") return ["listSent"]
  return []
}

const TRIGGER_MODES: { value: HabitTextTrigger["mode"]; label: string }[] = [
  { value: "done", label: "Done (bare keyword)" },
  { value: "quantity", label: "Quantity" },
  { value: "score", label: "Score" },
]

function seedTextTriggers(task: Pick<WeeklyTask, "name" | "textTriggers"> | null | undefined): HabitTextTrigger[] {
  if (task?.textTriggers && task.textTriggers.length > 0) return task.textTriggers.map((t) => ({ ...t }))
  return defaultTriggersForHabit({ name: task?.name || "", textTriggers: undefined })
}

function emptyClimb(): IncrementalHabitData {
  return {
    cadence: "weekly",
    startValue: 2,
    increment: 1,
    unit: "minutes",
    startedOn: formatLocalDateKey(new Date()),
  }
}

/** Searchable daily-habit menu. Same Win95 trigger as completion sources; type-to-filter like the pen parent picker. */
function DailyHabitPicker({
  habits,
  habitId,
  onChange,
}: {
  habits: { id: string; name: string }[]
  habitId: string
  onChange: (habitId: string) => void
}) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState("")
  const rootRef = useRef<HTMLDivElement>(null)
  const menuId = useId()
  const buttonId = useId()
  const selected = habits.find((habit) => habit.id === habitId)
  const needle = query.trim().toLowerCase()
  const matches = needle ? habits.filter((habit) => habit.name.toLowerCase().includes(needle)) : habits

  const close = () => {
    setOpen(false)
    setQuery("")
  }

  useEffect(() => {
    if (!open) return
    const shut = () => {
      setOpen(false)
      setQuery("")
    }
    const onPointer = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) shut()
    }
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return
      event.stopPropagation()
      shut()
    }
    window.addEventListener("mousedown", onPointer)
    window.addEventListener("keydown", onKey)
    return () => {
      window.removeEventListener("mousedown", onPointer)
      window.removeEventListener("keydown", onKey)
    }
  }, [open])

  return (
    <div className="habit95-field">
      <label htmlFor={buttonId}>Add up this daily habit</label>
      <div className="habit95-pick" ref={rootRef}>
        <button
          id={buttonId}
          type="button"
          className="habit95-select"
          aria-label="Daily habit to add up"
          aria-expanded={open}
          aria-haspopup="listbox"
          aria-controls={menuId}
          onClick={() => (open ? close() : setOpen(true))}
        >
          <span className="habit95-select-label">{selected?.name || "Choose a daily habit"}</span>
          <span className="habit95-select-arrow" aria-hidden />
        </button>
        {open ? (
          <div className="habit95-select-menu habit95-habit-menu" id={menuId} role="listbox" aria-label="Daily habits">
            <input
              className="habit95-input"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search daily habits"
              aria-label="Search daily habits"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === "Enter") e.preventDefault()
              }}
            />
            <div className="habit95-habit-options">
              {needle ? null : (
                <button
                  type="button"
                  role="option"
                  aria-selected={!habitId}
                  data-active={!habitId ? "true" : undefined}
                  className="habit95-habit-option"
                  onClick={() => {
                    onChange("")
                    close()
                  }}
                >
                  Choose a daily habit
                </button>
              )}
              {matches.map((habit) => (
                <button
                  key={habit.id}
                  type="button"
                  role="option"
                  aria-selected={habit.id === habitId}
                  data-active={habit.id === habitId ? "true" : undefined}
                  className="habit95-habit-option"
                  onClick={() => {
                    onChange(habit.id)
                    close()
                  }}
                >
                  {habit.name}
                </button>
              ))}
              {matches.length === 0 ? <p className="habit95-hint">No daily habits match “{query.trim()}”.</p> : null}
            </div>
          </div>
        ) : null}
      </div>
    </div>
  )
}

/** Searchable list menu. Same Win95 trigger as the daily-habit picker. */
function ListSentPicker({
  lists,
  listId,
  onChange,
}: {
  lists: { id: string; name: string }[]
  listId: string
  onChange: (listId: string) => void
}) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState("")
  const rootRef = useRef<HTMLDivElement>(null)
  const menuId = useId()
  const buttonId = useId()
  const selected = lists.find((list) => list.id === listId)
  const needle = query.trim().toLowerCase()
  const matches = needle ? lists.filter((list) => list.name.toLowerCase().includes(needle)) : lists

  const close = () => {
    setOpen(false)
    setQuery("")
  }

  useEffect(() => {
    if (!open) return
    const shut = () => {
      setOpen(false)
      setQuery("")
    }
    const onPointer = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) shut()
    }
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return
      event.stopPropagation()
      shut()
    }
    window.addEventListener("mousedown", onPointer)
    window.addEventListener("keydown", onKey)
    return () => {
      window.removeEventListener("mousedown", onPointer)
      window.removeEventListener("keydown", onKey)
    }
  }, [open])

  return (
    <div className="habit95-field">
      <label htmlFor={buttonId}>List</label>
      <div className="habit95-pick" ref={rootRef}>
        <button
          id={buttonId}
          type="button"
          className="habit95-select"
          aria-label="List to read sent items from"
          aria-expanded={open}
          aria-haspopup="listbox"
          aria-controls={menuId}
          onClick={() => (open ? close() : setOpen(true))}
        >
          <span className="habit95-select-label">{selected?.name || "Choose a list"}</span>
          <span className="habit95-select-arrow" aria-hidden />
        </button>
        {open ? (
          <div className="habit95-select-menu habit95-habit-menu" id={menuId} role="listbox" aria-label="Lists">
            <input
              className="habit95-input"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search lists"
              aria-label="Search lists"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === "Enter") e.preventDefault()
              }}
            />
            <div className="habit95-habit-options">
              {needle ? null : (
                <button
                  type="button"
                  role="option"
                  aria-selected={!listId}
                  data-active={!listId ? "true" : undefined}
                  className="habit95-habit-option"
                  onClick={() => {
                    onChange("")
                    close()
                  }}
                >
                  Choose a list
                </button>
              )}
              {matches.map((list) => (
                <button
                  key={list.id}
                  type="button"
                  role="option"
                  aria-selected={list.id === listId}
                  data-active={list.id === listId ? "true" : undefined}
                  className="habit95-habit-option"
                  onClick={() => {
                    onChange(list.id)
                    close()
                  }}
                >
                  {list.name}
                </button>
              ))}
              {matches.length === 0 ? <p className="habit95-hint">No lists match “{query.trim()}”.</p> : null}
            </div>
          </div>
        ) : null}
      </div>
    </div>
  )
}

function withSourceOrder(current: WeeklyTask, order: HabitCompletionSourceId[]): WeeklyTask {
  let next: WeeklyTask = { ...current, completionSources: order }
  if (order.includes("coverage")) {
    const threshold = clampCoverageThreshold(
      (effectiveCoverageLink(current)?.threshold ?? current.goal) || DEFAULT_COVERAGE_THRESHOLD,
    )
    next = { ...next, coverageLink: { threshold, enabled: true }, goal: current.goal || threshold, unit: current.unit || "%" }
  } else {
    next = { ...next, coverageLink: null }
  }
  if (order.includes("dailyFloor")) {
    next = {
      ...next,
      frequency: "weekly",
      type: current.type === TaskType.GOAL ? current.type : TaskType.BOOLEAN,
      dailyFloorLink: effectiveDailyFloorLink({ ...current, frequency: "weekly", type: TaskType.BOOLEAN }) ?? {
        floorPercent: 0,
        enabled: true,
      },
    }
  } else {
    next = { ...next, dailyFloorLink: null }
  }
  if (order.includes("sleep")) {
    next = { ...next, sleepLink: effectiveSleepLink(current) ?? { end: "wake", beforeMinutes: 9 * 60 } }
  } else {
    next = { ...next, sleepLink: null }
  }
  if (order.includes("list")) {
    next = { ...next, listLink: effectiveListLink(current) ?? { listName: "to do", count: 1 } }
  } else {
    next = { ...next, listLink: null }
  }
  if (order.includes("tags")) {
    next = { ...next, trackingLink: { ...(current.trackingLink ?? { tagIds: [] }), enabled: true } }
  } else if (current.trackingLink) {
    next = { ...next, trackingLink: { ...current.trackingLink, enabled: false } }
  }
  if (order.includes("habitValue")) {
    const habitId = current.habitValueLink?.habitId || ""
    next = { ...next, habitValueLink: habitId ? { habitId, enabled: true } : current.habitValueLink ?? null }
  } else {
    next = { ...next, habitValueLink: null }
  }
  if (order.includes("listSent")) {
    const prev = current.listSentLink
    next = {
      ...next,
      listSentLink: {
        listId: prev?.listId ?? "",
        grace: clampListSentGrace(prev?.grace),
        ...storedListSentFields(prev),
      },
    }
  } else if (current.listSentLink?.listId && current.listSentLink.mode && current.listSentLink.mode !== "sentThisWeek") {
    next = { ...next, listSentLink: current.listSentLink }
  } else {
    next = { ...next, listSentLink: null }
  }
  return next
}

const EMPTY_RITUAL_IDS: string[] = []

function KeywordSourceFields({
  row,
  onChange,
}: {
  row: HabitCompletionPipeline
  onChange: (keyword: HabitKeywordSource) => void
}) {
  const use = row.keyword?.use ?? "received"
  const count = row.keyword?.count ?? 2
  const pattern = row.keyword?.pattern ?? ""
  const label = KEYWORD_USE_OPTIONS.find((option) => option.id === use)?.label ?? "True if received"
  const setKeyword = (next: Partial<HabitKeywordSource>) => {
    const nextUse = next.use ?? use
    const nextCount = next.count ?? count
    const nextPattern = next.pattern !== undefined ? next.pattern : pattern
    onChange({
      use: nextUse,
      ...(nextCount != null ? { count: nextCount } : {}),
      ...(nextPattern ? { pattern: nextPattern } : {}),
    })
  }
  return (
    <>
      <Habit95Select
        label="How the count is used"
        ariaLabel="How the count is used"
        valueLabel={label}
        options={KEYWORD_USE_OPTIONS.map((option) => ({ id: option.id, label: option.label }))}
        onChange={(id) => setKeyword({ use: id as HabitKeywordUse })}
      />
      {use === "after" ? (
        <label className="habit95-field">
          Times in this period
          <input
            className="habit95-input"
            type="number"
            min={1}
            step={1}
            aria-label="Times in this period"
            value={count}
            onChange={(event) => {
              const next = Number.parseInt(event.target.value, 10)
              if (!Number.isFinite(next)) return
              setKeyword({ count: Math.max(1, next) })
            }}
          />
        </label>
      ) : null}
      {use === "logged" ? (
        <label className="habit95-field">
          Pattern
          <input
            className="habit95-input"
            aria-label="Logged phrase pattern"
            value={pattern}
            placeholder="read {n} pages of {bookname}"
            onChange={(event) => setKeyword({ pattern: event.target.value })}
          />
        </label>
      ) : null}
      <p className="habit95-hint">
        {use === "logged"
          ? "The whole BIM message must match this pattern. {n}, {x}, and {minutes} are the amount written on the period. A name in braces, such as {bookname}, is kept with it. If the pattern says minutes or hours, that message also logs the prior stretch on this habit’s tracking activity. No clock ends the stretch at the message time and marks it estimated. A clock at the end, such as 1:11, is when it finished. The phrase list under BIM Keywords can still hold the words."
          : "Counts BIM messages whose whole text is the phrase. “drank water” counts. “drank water please” does not. Add the phrase under BIM Keywords."}
        {use === "after" ? " The habit is done only after this many exact messages in the period." : null}
      </p>
    </>
  )
}

export function TaskForm({ onSubmit, onCancel, onDelete, initialTask, defaultFrequency = "daily", onDirtyChange, onLeaveForItem }: TaskFormProps) {
  const colors = useThemeStore((s) => s.colors)
  const trackingTags = useTimeTrackingStore((s) => s.tags)
  const trackingScopes = useTimeTrackingStore((s) => s.scopes)
  const defaultHabitPoints = useHabitsStore((s) => s.defaultHabitPoints)
  const allHabits = useHabitsStore((s) => s.tasks)
  const weeklyData = useHabitsStore((s) => s.weeklyData)
  const weeklyHabitData = useHabitsStore((s) => s.weeklyHabitData)
  const monthlyHabitData = useHabitsStore((s) => s.monthlyHabitData)
  const quarterlyHabitData = useHabitsStore((s) => s.quarterlyHabitData)
  const ritualMultiplier = useHabitsStore((s) => s.morningRitualPointMultiplier)
  const dailyFullMark = useUserSettingsStore(
    (s) => s.pointsRules?.["habit.dailyFullMark"] ?? pointsRuleValue("habit.dailyFullMark"),
  )
  const habitExemptions = useHabitsStore((s) => s.habitExemptions)
  const gradeTolerance = useHabitsStore((s) => s.gradeTolerance)
  const outputGradeTolerance = useHabitsStore((s) => s.outputGradeTolerance)
  const accomplishmentThreshold = useHabitsStore((s) => s.accomplishmentThreshold)
  const ritualDayKey = localDayKey(new Date())
  const storedRitualIds =
    useReviewsStore((s) => s.getMorningReview(ritualDayKey)?.priorityHabitIds) ?? EMPTY_RITUAL_IDS
  const [ritualOverride, setRitualOverride] = useState<boolean | null>(null)
  const ritualOn = ritualOverride ?? (initialTask ? storedRitualIds.includes(initialTask.id) : false)
  const vaultLists = useTaskStore((s) => s.lists)
  const vaultItems = useTaskStore((s) => s.tasks)
  const [openListId, setOpenListId] = useState<string | null>(null)
  const listPopupHost = useRef<HTMLElement | null>(null)
  const initialClimb = initialTask ? normalizeIncrementalData(initialTask.incrementalData) : undefined
  const seededTriggers = seedTextTriggers(initialTask)
  const hadStoredTriggers = Boolean(initialTask?.textTriggers?.length)
  const [triggersLocked, setTriggersLocked] = useState(hadStoredTriggers)
  const seedName = { name: initialTask?.name || "", frequency: initialTask?.frequency || defaultFrequency, type: initialTask ? normalizeTaskType(initialTask.type) : TaskType.BOOLEAN }
  const [logsLocked, setLogsLocked] = useState(Array.isArray(initialTask?.logExemptions))
  const [sleepLocked, setSleepLocked] = useState(!!initialTask && initialTask.sleepLink !== undefined)
  const [listLocked, setListLocked] = useState(!!initialTask && initialTask.listLink !== undefined)
  const [coverageLocked, setCoverageLocked] = useState(!!initialTask && initialTask.coverageLink !== undefined)
  const [floorLocked, setFloorLocked] = useState(!!initialTask && initialTask.dailyFloorLink !== undefined)
  const [sourcesLocked, setSourcesLocked] = useState(
    Array.isArray(initialTask?.completionSources) || Array.isArray(initialTask?.completionPipelines),
  )
  const estimateHold = useRef<HabitTimeEstimate | undefined>(initialTask?.timeEstimate)
  const creating = !initialTask
  const [rewardTouched, setRewardTouched] = useState(!creating)
  const seededReward = initialTask
    ? (initialTask.rewardValue ?? 10)
    : defaultHabitPoints[habitPeriodPointsKey(defaultFrequency)]
  const [phrase, setPhrase] = useState("")
  const [newTagName, setNewTagName] = useState("")
  const addTrackingTag = useTimeTrackingStore((s) => s.addTag)
  const [task, setTask] = useState<WeeklyTask>({
    id: initialTask?.id || "",
    name: initialTask?.name || "",
    type: initialTask ? normalizeTaskType(initialTask.type) : TaskType.BOOLEAN,
    goal: initialTask?.goal || 0,
    unit: initialTask?.unit || initialClimb?.unit || "",
    rewardValue: seededReward,
    frequency: initialTask?.frequency || defaultFrequency,
    incrementalData: initialClimb,
    trackingLink: initialTask?.trackingLink,
    completionSources: initialTask?.completionSources,
    coverageLink:
      initialTask && initialTask.coverageLink !== undefined
        ? initialTask.coverageLink
        : presetCoverageLink(seedName),
    dailyFloorLink:
      initialTask && initialTask.dailyFloorLink !== undefined
        ? initialTask.dailyFloorLink
        : presetDailyFloorLink(seedName),
    timeEstimate: initialTask?.timeEstimateNA ? undefined : initialTask?.timeEstimate,
    timeEstimateNA: initialTask?.timeEstimateNA ? true : undefined,
    doneTaskPhrase: initialTask?.doneTaskPhrase,
    doneTaskUseText: initialTask?.doneTaskUseText,
    taggedTaskTag: initialTask?.taggedTaskTag,
    textTriggers: seededTriggers,
    priorityPinned: initialTask?.priorityPinned,
    priorityMuted: initialTask?.priorityMuted,
    priorityLog: initialTask?.priorityLog,
    priorityRefreshedOn: initialTask?.priorityRefreshedOn,
    priorityPermanent: initialTask?.priorityPermanent,
    gem: initialTask?.gem || pickRandomCatalogGem(),
    logExemptions: initialTask?.logExemptions ?? presetLogExemptions(seedName),
    sleepLink: initialTask && initialTask.sleepLink !== undefined ? initialTask.sleepLink : presetSleepLink(seedName),
    listLink: initialTask && initialTask.listLink !== undefined ? initialTask.listLink : presetListLink(seedName),
    habitValueLink: initialTask?.habitValueLink ?? null,
    listSentLink: initialTask?.listSentLink ?? null,
    completionPipelines: initialTask?.completionPipelines,
    showGoalBar: initialTask?.showGoalBar,
  })
  const [baseline] = useState(() => serializeSnapshot({
    name: initialTask?.name || "",
    type: initialTask ? normalizeTaskType(initialTask.type) : TaskType.BOOLEAN,
    goal: initialTask?.goal || 0,
    unit: initialTask?.unit || initialClimb?.unit || "",
    rewardValue: seededReward,
    frequency: initialTask?.frequency || defaultFrequency,
    incrementalData: initialClimb,
    trackingLink: initialTask?.trackingLink,
    coverageLink:
      initialTask && initialTask.coverageLink !== undefined
        ? initialTask.coverageLink
        : presetCoverageLink(seedName),
    dailyFloorLink:
      initialTask && initialTask.dailyFloorLink !== undefined
        ? initialTask.dailyFloorLink
        : presetDailyFloorLink(seedName),
    timeEstimate: initialTask?.timeEstimateNA ? undefined : initialTask?.timeEstimate,
    timeEstimateNA: initialTask?.timeEstimateNA ? true : undefined,
    doneTaskPhrase: initialTask?.doneTaskPhrase ?? "",
    doneTaskUseText: initialTask?.doneTaskUseText ? true : undefined,
    taggedTaskTag: initialTask?.taggedTaskTag ?? "",
    textTriggers: seededTriggers,
    gem: task.gem,
    priorityPinned: initialTask?.priorityPinned,
    priorityMuted: initialTask?.priorityMuted,
    priorityLog: initialTask?.priorityLog,
    priorityRefreshedOn: initialTask?.priorityRefreshedOn,
    priorityPermanent: initialTask?.priorityPermanent,
    logExemptions: initialTask?.logExemptions ?? presetLogExemptions(seedName),
    sleepLink: initialTask && initialTask.sleepLink !== undefined ? initialTask.sleepLink : presetSleepLink(seedName),
    listLink: initialTask && initialTask.listLink !== undefined ? initialTask.listLink : presetListLink(seedName),
    completionSources: initialTask?.completionSources,
    completionPipelines: initialTask?.completionPipelines,
    habitValueLink: initialTask?.habitValueLink ?? null,
    listSentLink: initialTask?.listSentLink ?? null,
    showGoalBar: !!initialTask?.showGoalBar,
  }))

  useEffect(() => {
    onDirtyChange?.(
      serializeSnapshot({
        name: task.name,
        type: task.type,
        goal: task.goal || 0,
        unit: task.unit || "",
        rewardValue: task.rewardValue,
        frequency: task.frequency,
        incrementalData: task.incrementalData,
        trackingLink: task.trackingLink,
        coverageLink: task.coverageLink ?? null,
        dailyFloorLink: task.dailyFloorLink ?? null,
        timeEstimate: task.timeEstimate,
        timeEstimateNA: task.timeEstimateNA ? true : undefined,
        doneTaskPhrase: task.doneTaskPhrase ?? "",
        doneTaskUseText: task.doneTaskUseText ? true : undefined,
        taggedTaskTag: task.taggedTaskTag ?? "",
        textTriggers: task.textTriggers ?? [],
        gem: task.gem,
        priorityPinned: task.priorityPinned,
        priorityMuted: task.priorityMuted,
        priorityLog: task.priorityLog,
        priorityRefreshedOn: task.priorityRefreshedOn,
        priorityPermanent: task.priorityPermanent,
        logExemptions: task.logExemptions ?? [],
        sleepLink: task.sleepLink ?? null,
        listLink: task.listLink ?? null,
        completionSources: task.completionSources,
        completionPipelines: task.completionPipelines,
        habitValueLink: task.habitValueLink ?? null,
        listSentLink: task.listSentLink ?? null,
        showGoalBar: !!task.showGoalBar,
      }) !== baseline,
    )
  }, [task, baseline, onDirtyChange])

  // Preview preset keywords when the name matches and the user has not edited yet.
  const skipTriggerNameSync = useRef(true)
  useEffect(() => {
    if (skipTriggerNameSync.current) {
      skipTriggerNameSync.current = false
      return
    }
    if (triggersLocked) return
    setTask((current) => ({
      ...current,
      textTriggers: defaultTriggersForHabit({ name: current.name, textTriggers: undefined }),
    }))
  }, [task.name, triggersLocked])

  const skipLinkSync = useRef(true)
  useEffect(() => {
    if (skipLinkSync.current) {
      skipLinkSync.current = false
      if (task.name === (initialTask?.name || "")) return
    }
    setTask((current) => {
      const next = {
        ...current,
        logExemptions: logsLocked ? current.logExemptions : presetLogExemptions(current),
        sleepLink: sleepLocked ? current.sleepLink : presetSleepLink(current),
        listLink: listLocked ? current.listLink : presetListLink(current),
        coverageLink: coverageLocked ? current.coverageLink : presetCoverageLink(current),
        dailyFloorLink: floorLocked ? current.dailyFloorLink : presetDailyFloorLink(current),
      }
      if (!sourcesLocked) {
        next.completionSources = deriveCompletionSources(next)
        next.completionPipelines = undefined
      }
      return next
    })
  }, [task.name, task.frequency, task.type, logsLocked, sleepLocked, listLocked, coverageLocked, floorLocked, sourcesLocked])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const finalTask = { ...task }
    if (task.type === TaskType.INCREMENTAL) {
      const climb = normalizeIncrementalData(task.incrementalData) ?? emptyClimb()
      finalTask.incrementalData = {
        ...climb,
        startedOn: climb.startedOn || formatLocalDateKey(new Date()),
      }
      finalTask.unit = climb.unit || task.unit
    }
    // An empty selection is no link at all, so the sync can clean up after it.
    finalTask.trackingLink = task.trackingLink?.tagIds.length ? task.trackingLink : undefined
    finalTask.coverageLink = task.coverageLink === null ? null : task.coverageLink ?? null
    if (finalTask.coverageLink) {
      finalTask.coverageLink = {
        threshold: clampCoverageThreshold(finalTask.coverageLink.threshold),
        enabled: finalTask.coverageLink.enabled !== false,
      }
      if (finalTask.type === TaskType.GOAL) {
        finalTask.goal = finalTask.coverageLink.threshold
        finalTask.unit = finalTask.unit || "%"
      }
    }
    finalTask.dailyFloorLink =
      task.dailyFloorLink === null
        ? null
        : task.dailyFloorLink
          ? {
              floorPercent: Math.min(100, Math.max(0, Math.round(task.dailyFloorLink.floorPercent ?? 0))),
              enabled: task.dailyFloorLink.enabled !== false,
              ...((task.dailyFloorLink.allowAtZero ?? 0) > 0
                ? { allowAtZero: Math.max(0, Math.round(task.dailyFloorLink.allowAtZero ?? 0)) }
                : {}),
            }
          : null
    // N/A stores the flag and no minutes. Otherwise drop an empty estimate object.
    if (task.timeEstimateNA) {
      finalTask.timeEstimate = undefined
      finalTask.timeEstimateNA = true
    } else {
      const estimate = task.timeEstimate
      finalTask.timeEstimate =
        estimate && ((estimate.minutesPerUnit ?? 0) > 0 || (estimate.minutes ?? 0) > 0) ? estimate : undefined
      finalTask.timeEstimateNA = undefined
    }
    const donePhrase = (task.doneTaskPhrase ?? "").trim()
    finalTask.doneTaskPhrase = donePhrase || undefined
    finalTask.doneTaskUseText = task.type === TaskType.TEXT && task.doneTaskUseText ? true : undefined
    // Stamp editable triggers (including preset defaults) when present; clear when empty.
    const cleaned = (task.textTriggers ?? [])
      .map((t) => ({
        ...t,
        keyword: t.keyword.trim(),
        unitWords: t.unitWords?.map((u) => u.trim()).filter(Boolean),
        connector: t.connector?.trim() || undefined,
      }))
      .filter((t) => t.keyword.length > 0)
    finalTask.textTriggers = cleaned.length > 0 ? cleaned : undefined
    finalTask.logExemptions = sanitizeLogExemptions(task.logExemptions ?? [])
    finalTask.sleepLink = task.sleepLink ?? null
    finalTask.listLink =
      task.listLink && task.listLink.listName.trim()
        ? { listName: task.listLink.listName.trim(), count: Math.max(1, Math.round(task.listLink.count) || 1) }
        : null
    finalTask.gem = task.gem || pickRandomCatalogGem()
    finalTask.showGoalBar = task.showGoalBar ? true : undefined
    finalTask.habitValueLink = task.habitValueLink?.habitId
      ? { habitId: task.habitValueLink.habitId, enabled: task.habitValueLink.enabled !== false }
      : null
    const draftedRows =
      task.completionPipelines ??
      pipelinesFromSources(
        sourcesLocked && Array.isArray(task.completionSources)
          ? task.completionSources
          : deriveCompletionSources(finalTask),
      )
    finalTask.completionPipelines = draftedRows.map((row) => {
      if (row.kind === "habitsStats") return { ...row, statBinding: openedStatBinding(row) }
      if (row.kind === "keywords") return { ...row, keyword: keywordForSubmit(row.keyword) }
      return row
    })
    finalTask.completionSources = flattenPipelines(draftedRows)
    const listRow = draftedRows.some((row) => row.kind === "lists")
    finalTask.listSentLink =
      task.listSentLink?.listId && (listRow || finalTask.completionSources.includes("listSent"))
        ? {
            listId: task.listSentLink.listId,
            grace: clampListSentGrace(task.listSentLink.grace),
            enabled: task.listSentLink.enabled !== false,
            ...storedListSentFields(task.listSentLink),
          }
        : null
    if (!finalTask.completionSources.includes("listSent") && !listRow) finalTask.listSentLink = null
    if (!finalTask.coverageLink) {
      const measure = effectiveHabitCount(finalTask, undefined, vaultItems, new Date())
      if (measure.derived) finalTask.goal = measure.target
    }
    const tagged = normalizeTag(task.taggedTaskTag ?? "")
    finalTask.taggedTaskTag =
      finalTask.completionSources?.includes("taggedTasks") && tagged ? tagged : undefined
    if (initialTask && ritualOverride === true && !storedRitualIds.includes(initialTask.id)) {
      useReviewsStore.getState().saveMorningReview(ritualDayKey, {
        priorityHabitIds: [...storedRitualIds, initialTask.id],
      })
    }
    if (initialTask && ritualOverride === false) {
      useReviewsStore.getState().saveMorningReview(ritualDayKey, {
        priorityHabitIds: storedRitualIds.filter((id) => id !== initialTask.id),
      })
    }
    onSubmit(finalTask)
  }

  const triggers = task.textTriggers ?? []
  const patchTrigger = (id: string, patch: Partial<HabitTextTrigger>) => {
    setTriggersLocked(true)
    setTask((current) => ({
      ...current,
      textTriggers: (current.textTriggers ?? []).map((t) => (t.id === id ? { ...t, ...patch } : t)),
    }))
  }
  const addTrigger = () => {
    setTriggersLocked(true)
    setTask((current) => ({
      ...current,
      textTriggers: [
        ...(current.textTriggers ?? []),
        { id: makeHabitTriggerId(), keyword: "", mode: "done" as const },
      ],
    }))
  }
  const removeTrigger = (id: string) => {
    setTriggersLocked(true)
    setTask((current) => ({
      ...current,
      textTriggers: (current.textTriggers ?? []).filter((t) => t.id !== id),
    }))
  }

  const link: HabitTrackingLink = task.trackingLink ?? { tagIds: [] }
  const setLink = (patch: Partial<HabitTrackingLink>) =>
    setTask((current) => ({ ...current, trackingLink: { ...(current.trackingLink ?? { tagIds: [] }), ...patch } }))
  const toggleLinkTag = (id: string) => {
    const on = link.tagIds.includes(id)
    setSourcesLocked(true)
    setTask((current) => {
      const linkNow = current.trackingLink ?? { tagIds: [] }
      const tagIds = on ? linkNow.tagIds.filter((tag) => tag !== id) : [...linkNow.tagIds, id]
      const order =
        sourcesLocked && Array.isArray(current.completionSources)
          ? current.completionSources
          : deriveCompletionSources(current)
      const completionSources = tagIds.length
        ? order.includes("tags")
          ? order
          : [...order, "tags"]
        : order.filter((source) => source !== "tags")
      return {
        ...current,
        completionSources,
        trackingLink: { ...linkNow, tagIds, enabled: tagIds.length > 0 },
      }
    })
  }

  const periodWord =
    task.frequency === "weekly"
      ? "that week"
      : task.frequency === "monthly"
        ? "that month"
        : task.frequency === "quarterly"
          ? "that season"
          : "that day"
  const linkedPenCount = penIdsForTags(trackingScopes, link.tagIds).size
  const sourceOrder =
    sourcesLocked && Array.isArray(task.completionSources)
      ? task.completionSources
      : deriveCompletionSources(task)
  const displayPipelines = task.completionPipelines ?? pipelinesFromSources(sourceOrder)
  const showTracking = supportsTrackingLink(task) && sourceOrder.includes("tags")
  const listChoices = vaultLists
    .filter((list) => !isFolderAllItemsCategoryId(list.id))
    .map((list) => ({ id: list.id, name: list.name }))
    .sort((a, b) => a.name.localeCompare(b.name))
  const setRowSources = (row: HabitCompletionPipeline, sources: HabitCompletionSourceId[]) => {
    commitPipelines(
      displayPipelines.map((item) => (item.id === row.id ? { ...item, sources } : item)),
      "structure",
    )
  }
  const dailyValueSources = allHabits.filter(
    (habit) =>
      (habit.frequency || "daily") === "daily" &&
      habit.id !== task.id &&
      habit.type !== TaskType.TEXT,
  )
  const todayKey = formatLocalDateKey(new Date())
  const periodWindow = periodWindowsForFrequency(task.frequency, [todayKey])[0]
  const periodDates = periodWindow ? datesForCompletionAverage(task.frequency, periodWindow, todayKey) : []
  const dailyHabits = allHabits.filter((habit) => (habit.frequency || "daily") === "daily")
  const weeklyHabits = allHabits.filter((habit) => habit.frequency === "weekly" && habit.id !== task.id)
  const monthlyHabits = allHabits.filter((habit) => habit.frequency === "monthly" && habit.id !== task.id)
  const exemptionContext = currentExemptionContext()
  const dailyExempt = (habit: WeeklyTask, dateKey: string) =>
    isHabitPeriodExempt(habit, dateKey, "daily", habitExemptions, exemptionContext)
  const dailyPercents = dailyHabits.map((habit) => ({
    id: habit.id,
    name: habit.name || "Untitled",
    pct: periodDates.length
      ? calculateTaskPercentage(habit.id, dailyHabits, weeklyData, periodDates, dailyExempt)
      : 0,
    active: periodDates.some((date) => !dailyExempt(habit, formatLocalDateKey(date))),
  }))
  const averageRows = dailyPercents.filter((row) => row.active)
  const averageMean =
    averageRows.length > 0 ? averageRows.reduce((sum, row) => sum + row.pct, 0) / averageRows.length : null
  const sumKeys = periodDates.map((date) => formatLocalDateKey(date)).filter((key) => key <= todayKey)

  const commitPipelines = (rows: HabitCompletionPipeline[], reason: "rename" | "structure") => {
    setSourcesLocked(true)
    if (reason === "rename") {
      setTask((current) => ({ ...current, completionPipelines: rows }))
      return
    }
    setCoverageLocked(true)
    setFloorLocked(true)
    setSleepLocked(true)
    setListLocked(true)
    const order = flattenPipelines(rows)
    setTask((current) => ({ ...withSourceOrder(current, order), completionPipelines: rows }))
  }

  const patchStatsRow = (row: HabitCompletionPipeline, next: HabitCompletionPipeline) => {
    commitPipelines(
      displayPipelines.map((item) => (item.id === row.id ? next : item)),
      "structure",
    )
  }

  const statContext = (set: HabitStatSet): HabitStatContext => {
    const now = new Date()
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
    monthStart.setHours(0, 0, 0, 0)
    return {
      today: now,
      weekStart: getWeekStartDate(now),
      monthStart,
      periodDays: periodDates,
      set,
      subject: task,
      dailyTasks: dailyHabits,
      weeklyTasks: weeklyHabits,
      monthlyTasks: monthlyHabits,
      weeklyData,
      weeklyHabitData,
      monthlyHabitData,
      gradeTolerance,
      outputGradeTolerance,
      isExempt: (habit, key) =>
        isHabitPeriodExempt(habit, key, habit.frequency || "daily", habitExemptions, exemptionContext),
    }
  }

  const createTrackingTag = () => {
    const name = newTagName.trim()
    if (!name) return
    const id = addTrackingTag(name)
    if (!id) return
    setNewTagName("")
    setSourcesLocked(true)
    setTask((current) => {
      const linkNow = current.trackingLink ?? { tagIds: [] }
      const tagIds = linkNow.tagIds.includes(id) ? linkNow.tagIds : [...linkNow.tagIds, id]
      const order =
        sourcesLocked && Array.isArray(current.completionSources)
          ? current.completionSources
          : deriveCompletionSources(current)
      return {
        ...current,
        completionSources: order.includes("tags") ? order : [...order, "tags"],
        trackingLink: { ...linkNow, tagIds, enabled: true },
      }
    })
  }

  const loggedNow = (() => {
    if (!task.id) return 0
    const habits = useHabitsStore.getState()
    const today = new Date()
    if ((task.frequency || "daily") === "weekly") {
      return habits.weeklyHabitData[getWeekString(getWeekStartDate(today))]?.[task.id]?.value ?? 0
    }
    if (task.frequency === "monthly") {
      return habits.monthlyHabitData[formatLocalMonthKey(today)]?.[task.id]?.value ?? 0
    }
    if (task.frequency === "quarterly") return 0
    return habits.weeklyData[formatLocalDateKey(today)]?.[task.id]?.value ?? 0
  })()
  const phrasePreview = describeHabitTriggerPreview(phrase, task.textTriggers ?? [], loggedNow)
  const listMeasure = effectiveHabitCount(task, undefined, vaultItems, new Date())

  const timeEstimate: HabitTimeEstimate = task.timeEstimate ?? {}
  const setTimeEstimate = (patch: Partial<HabitTimeEstimate>) =>
    setTask((current) => {
      const next = { ...(current.timeEstimate ?? {}), ...patch }
      estimateHold.current = next
      return { ...current, timeEstimate: next }
    })
  const setEstimateNA = (na: boolean) => {
    setTask((current) => {
      if (na) {
        estimateHold.current = current.timeEstimate ?? estimateHold.current
        return { ...current, timeEstimateNA: true, timeEstimate: undefined }
      }
      return { ...current, timeEstimateNA: undefined, timeEstimate: estimateHold.current }
    })
  }
  // A habit logged in minutes/hours already is a duration; a rate would double-count.
  const measuredInTime = isTimeMeasuredHabit(task)
  const usesRate = !measuredInTime && (task.type === TaskType.GOAL || task.type === TaskType.INCREMENTAL)

  const setClimb = (patch: Partial<IncrementalHabitData>) => {
    const current = normalizeIncrementalData(task.incrementalData) ?? emptyClimb()
    setTask({ ...task, incrementalData: { ...current, ...patch }, unit: patch.unit ?? current.unit ?? task.unit })
  }

  const setType = (value: TaskType) => {
    setTask({
      ...task,
      type: value,
      goal: value === TaskType.GOAL ? task.goal : undefined,
      unit: value === TaskType.GOAL || value === TaskType.INCREMENTAL ? task.unit : undefined,
      incrementalData: value === TaskType.INCREMENTAL ? normalizeIncrementalData(task.incrementalData) ?? emptyClimb() : undefined,
    })
  }

  const climb = normalizeIncrementalData(task.incrementalData) ?? emptyClimb()
  const canSubmit =
    Boolean(task.name.trim()) && (task.type !== TaskType.INCREMENTAL || climb.increment > 0)

  const neglectFrequency = task.frequency || "daily"
  const neglectBook =
    neglectFrequency === "weekly"
      ? weeklyHabitData
      : neglectFrequency === "monthly"
        ? monthlyHabitData
        : neglectFrequency === "quarterly"
          ? quarterlyHabitData
          : weeklyData
  const neglectSentence = initialTask
    ? neglectPrioritySentence({ ...task, id: initialTask.id }, neglectBook, new Date(), neglectFrequency)
    : null

  return (
    <>
    <form id="habit95-form" onSubmit={handleSubmit} className="habit95-form">
      <div className="habit95-fields">
      {neglectSentence ? (
        <p className="habit95-neglect-line habit95-sec-neglect">{neglectSentence}</p>
      ) : null}
      <div className="habit95-field habit95-sec-name">
        <label htmlFor="task-name">Habit Name</label>
        <input
          id="task-name"
          className="habit95-input"
          value={task.name}
          onChange={(e) => setTask({ ...task, name: e.target.value })}
          placeholder="e.g. Stretch, 10 pages, no phone after 10"
          required
          autoFocus
        />
        {initialTask ? (
          <button
            type="button"
            className="habit95-btn"
            style={{ marginTop: 6, alignSelf: "flex-start" }}
            onClick={() => {
              const habit = { ...task, id: initialTask.id }
              openHabitInLists(habit)
              onLeaveForItem?.()
            }}
          >
            Open item in Lists
          </button>
        ) : null}
      </div>

      <fieldset className="habit95-group habit95-sec-gem">
        <legend>Gem</legend>
        <p className="habit95-hint">Jewel on the row edit button. A random catalog stone is assigned; pick or upload to keep your own.</p>
        <HabitGemChooser
          value={task.gem}
          fallback={resolveTaskGem(task)}
          onChange={(gem) => setTask({ ...task, gem: gem || pickRandomCatalogGem() })}
          label="Habit gem"
        />
      </fieldset>

      <fieldset className="habit95-group habit95-sec-priority">
        <legend>Priority</legend>
        <p className="habit95-hint">
          Prioritize habit refreshes a green star. It is bright the day it is refreshed and loses a
          tenth of its strength each calendar day after that. Permanent priority holds it at full
          strength. A fully empty week (or week/month) still auto-prioritizes the next period and compounds.
        </p>
        <div className="habit-priority-actions">
          <button
            type="button"
            className="habit95-btn"
            onClick={() => setTask((current) => applyPriorityPress(current))}
          >
            Prioritize habit
          </button>
          <Star
            className="habit-priority-star"
            aria-label={`Priority star ${priorityMarkPercent(task, new Date(), ritualOn)}%`}
            style={{ opacity: priorityMarkPercent(task, new Date(), ritualOn) / 100 }}
            fill="currentColor"
            stroke="currentColor"
          />
        </div>
        {(task.priorityLog?.length ?? 0) > 0 ? (
          <ol className="habit-priority-log">
            {[...(task.priorityLog ?? [])].reverse().map((line, index) => (
              <li key={`${task.priorityLog?.length ?? 0}-${index}`}>{line}</li>
            ))}
          </ol>
        ) : null}
        <label className="habit95-check">
          <input
            type="checkbox"
            checked={!!task.priorityPermanent}
            onChange={(e) => setTask((current) => applyPermanentPriority(current, e.target.checked))}
          />
          Permanent priority
        </label>
        {initialTask ? (
          <label className="habit95-check">
            <input
              type="checkbox"
              checked={ritualOn}
              onChange={(e) => {
                const on = e.target.checked
                setRitualOverride(on)
                if (on) setTask((current) => applyRitualPriority(current, "day"))
              }}
            />
            Morning ritual
          </label>
        ) : null}
        {ritualOn ? (
          <p className="habit-priority-mark">
            MORNING RITUAL
            <span className="habit-priority-mult">×{ritualMultiplier}</span>
          </p>
        ) : null}
        <label className="habit95-check">
          <input
            type="checkbox"
            checked={!!task.priorityMuted}
            onChange={(e) => setTask({ ...task, priorityMuted: e.target.checked || undefined })}
          />
          Ignore neglect
        </label>
      </fieldset>

      <fieldset className="habit95-group habit95-sec-freq">
        <legend>Frequency</legend>
        <div className="habit95-freq" role="radiogroup" aria-label="Frequency">
          {FREQUENCIES.map(({ value, label }) => (
            <button
              key={value}
              type="button"
              className="habit95-choice"
              role="radio"
              aria-checked={task.frequency === value}
              onClick={() =>
                setTask((current) => ({
                  ...current,
                  frequency: value,
                  rewardValue:
                    creating && !rewardTouched
                      ? defaultHabitPoints[habitPeriodPointsKey(value)]
                      : current.rewardValue,
                }))
              }
            >
              <span className="habit95-choice-name">{label}</span>
            </button>
          ))}
        </div>
      </fieldset>

      <fieldset className="habit95-group habit95-sec-type">
        <legend>Habit Type</legend>
        <p className="habit95-hint">How you will mark it done.</p>
        <div className="habit95-types" role="radiogroup" aria-label="Habit Type">
          {HABIT_TYPES.map(({ value, name, desc, colorKey, Icon }) => (
            <button
              key={value}
              type="button"
              className="habit95-choice"
              role="radio"
              aria-checked={normalizeTaskType(task.type) === value}
              onClick={() => setType(value)}
            >
              <span className="habit95-choice-name">
                <Icon className="h-4 w-4" style={{ color: colors[colorKey] }} />
                {name}
              </span>
              <span className="habit95-choice-desc">{desc}</span>
            </button>
          ))}
        </div>
      </fieldset>

      <fieldset className="habit95-group habit95-sec-sources">
        <legend>Completion sources</legend>
        <p className="habit95-hint">
          A habit can listen to more than one place. The list is trust order: the first source that has something to
          say wins when they disagree. A source with no observation is skipped. A number or tick you type still wins.
        </p>
        <HabitPipelineEditor
          pipelines={displayPipelines}
          onChange={commitPipelines}
          renderConfig={(row) => {
            if (row.kind === "tags") {
              return (
                <>
                  <p className="habit95-hint">
                    Done tasks and tracked activities with this tag each count as 1. The goal is how many complete the
                    period. The habit’s Done line carries the tag. A tracking block that already has it still files one
                    Done line.
                  </p>
                  {trackingTags.length > 0 ? (
                    <div className="habit95-tags" role="group" aria-label="Tagged tasks tag">
                      {trackingTags.map((tag) => {
                        const on = normalizeTag(tag.name) === normalizeTag(task.taggedTaskTag ?? "")
                        return (
                          <button
                            key={tag.id}
                            type="button"
                            className="habit95-tag"
                            aria-pressed={on}
                            onClick={() =>
                              setTask((current) => ({
                                ...current,
                                taggedTaskTag: on ? "" : normalizeTag(tag.name),
                              }))
                            }
                          >
                            <span className="habit95-tag-dot" style={{ background: tag.color }} />
                            {tag.name}
                          </button>
                        )
                      })}
                    </div>
                  ) : null}
                  <div className="habit95-field">
                    <label htmlFor="tagged-task-tag">Tag</label>
                    <input
                      id="tagged-task-tag"
                      className="habit95-input"
                      aria-label="Tagged task tag"
                      value={task.taggedTaskTag ?? ""}
                      placeholder="cooking"
                      onChange={(e) => setTask((current) => ({ ...current, taggedTaskTag: e.target.value }))}
                    />
                  </div>
                </>
              )
            }
            if (row.kind === "trackingStats") {
              return (
                <>
                  {(["coverage", "sleep"] as const).map((id) => (
                    <label key={id} className="habit95-check">
                      <input
                        type="checkbox"
                        checked={row.sources.includes(id)}
                        onChange={() => setRowSources(row, togglePipelineSource(row, id))}
                      />
                      {COMPLETION_SOURCE_LABELS[id]}
                    </label>
                  ))}
                  {row.sources.includes("coverage") ? (
                    <label className="habit95-field">
                      Complete at or above
                      <input
                        className="habit95-input"
                        type="number"
                        min={1}
                        max={100}
                        aria-label="Coverage threshold percent"
                        value={effectiveCoverageLink(task)?.threshold ?? DEFAULT_COVERAGE_THRESHOLD}
                        onChange={(e) => {
                          setCoverageLocked(true)
                          const threshold = clampCoverageThreshold(Number.parseFloat(e.target.value))
                          setTask((current) => ({
                            ...current,
                            goal: threshold,
                            unit: "%",
                            coverageLink: { threshold, enabled: true },
                          }))
                        }}
                      />
                    </label>
                  ) : null}
                </>
              )
            }
            if (row.kind === "habitsStats") {
              const statSet = row.stats?.set ?? "daily"
              const statBinding = openedStatBinding(row)
              return (
                <>
                  <StatSourceBuilder
                    binding={statBinding}
                    habitsForSource={(sourceId) =>
                      sourceId === "weekly" ? weeklyHabits : sourceId === "monthly" ? monthlyHabits : dailyHabits
                    }
                    context={{ ...statContext(statSet), accomplishmentThreshold }}
                    onChange={(next) => {
                      const engines = ["dailyFloor", "habitValue", "dailyCompletionAverage"] as const
                      const wanted = new Set(
                        next.pipelines
                          .map((pipeline) => pipeline.outputId)
                          .filter((id): id is (typeof engines)[number] => engines.includes(id as (typeof engines)[number])),
                      )
                      const sources = [
                        ...row.sources.filter((id) => !engines.includes(id as (typeof engines)[number])),
                        ...engines.filter((id) => wanted.has(id) && !row.sources.includes(id)),
                      ]
                      patchStatsRow(row, { ...row, sources, statBinding: next })
                    }}
                  />
                  {row.stats?.comparePrevious ? (
                    <label className="habit95-field">
                      How many must be higher
                      <input
                        className="habit95-input"
                        type="number"
                        min={1}
                        step={1}
                        aria-label="How many must be higher"
                        value={row.stats?.mustBeHigher ?? 2}
                        onChange={(event) =>
                          patchStatsRow(row, {
                            ...row,
                            stats: {
                              set: statSet,
                              points: row.stats?.points ?? [],
                              comparePrevious: true,
                              mustBeHigher: Math.max(1, Math.round(Number.parseFloat(event.target.value) || 1)),
                            },
                          })
                        }
                      />
                    </label>
                  ) : null}
                  {row.sources.includes("dailyCompletionAverage") ? (
                    <>
                      <p className="habit95-hint">
                        The uncurved mean of each active daily habit’s row percent for this period.
                      </p>
                      <ul className="habit95-stat-readout" aria-label="Daily completion average inputs">
                        {averageRows.map((rowPercent) => (
                          <li key={rowPercent.id}>
                            <span>{rowPercent.name}</span>
                            <span>{Math.round(rowPercent.pct)}%</span>
                          </li>
                        ))}
                        <li>
                          <span>Mean</span>
                          <span>{averageMean === null ? "—" : `${Math.round(averageMean)}%`}</span>
                        </li>
                      </ul>
                    </>
                  ) : null}
                  {row.sources.includes("habitValue") ? (
                    <>
                      <p className="habit95-hint">
                        Adds one daily habit’s logged numbers across the days of this week, month, or season.
                      </p>
                      <DailyHabitPicker
                        habits={dailyValueSources}
                        habitId={task.habitValueLink?.habitId || ""}
                        onChange={(habitId) => {
                          setSourcesLocked(true)
                          setTask((current) => ({
                            ...current,
                            habitValueLink: habitId ? { habitId, enabled: true } : null,
                          }))
                        }}
                      />
                      <ul className="habit95-stat-readout" aria-label="Daily habit total">
                        <li>
                          <span>
                            {dailyValueSources.find((habit) => habit.id === task.habitValueLink?.habitId)?.name ||
                              "Choose a daily habit"}
                          </span>
                          <span>
                            {task.habitValueLink?.habitId
                              ? sumHabitValuesOverDays(weeklyData, task.habitValueLink.habitId, sumKeys)
                              : "—"}
                          </span>
                        </li>
                      </ul>
                    </>
                  ) : null}
                  {row.sources.includes("dailyFloor") ? (
                    <>
                      <p className="habit95-hint">
                        Every daily habit’s completion for this period is above 0. The habit is met only when that is true.
                      </p>
                      <ul className="habit95-stat-readout" aria-label="Daily habit percents">
                        {dailyPercents.map((rowPercent) => (
                          <li key={rowPercent.id}>
                            <span>{rowPercent.name}</span>
                            <span>{Math.round(rowPercent.pct)}%</span>
                          </li>
                        ))}
                      </ul>
                      <label className="habit95-field">
                        Allow this many at 0
                        <input
                          className="habit95-input"
                          type="number"
                          min={0}
                          step={1}
                          aria-label="Allow this many at 0"
                          value={effectiveDailyFloorLink(task)?.allowAtZero ?? 0}
                          onChange={(e) => {
                            setFloorLocked(true)
                            const allowAtZero = Math.max(0, Math.round(Number.parseFloat(e.target.value) || 0))
                            const floorPercent = effectiveDailyFloorLink(task)?.floorPercent ?? 0
                            setTask((current) => ({
                              ...current,
                              dailyFloorLink: {
                                floorPercent,
                                enabled: true,
                                ...(allowAtZero > 0 ? { allowAtZero } : {}),
                              },
                            }))
                          }}
                        />
                      </label>
                      <label className="habit95-field">
                        Each daily habit above
                        <input
                          className="habit95-input"
                          type="number"
                          min={0}
                          max={100}
                          aria-label="Daily habit floor percent"
                          value={effectiveDailyFloorLink(task)?.floorPercent ?? 0}
                          onChange={(e) => {
                            setFloorLocked(true)
                            const floorPercent = Math.min(100, Math.max(0, Math.round(Number.parseFloat(e.target.value) || 0)))
                            const allowAtZero = effectiveDailyFloorLink(task)?.allowAtZero ?? 0
                            setTask((current) => ({
                              ...current,
                              dailyFloorLink: {
                                floorPercent,
                                enabled: true,
                                ...(allowAtZero > 0 ? { allowAtZero } : {}),
                              },
                            }))
                          }}
                        />
                      </label>
                    </>
                  ) : null}
                </>
              )
            }
            if (row.kind === "lists") {
              const fallback: HabitListPipelineMode = row.sources.includes("listSent")
                ? "sentThisWeek"
                : row.sources.includes("list")
                  ? "oneComplete"
                  : "sentThisWeek"
              const routing = listRoutingFromLink(task.listSentLink, fallback)
              const listId = task.listSentLink?.listId || ""
              const known = listChoices.find((list) => list.id === listId)
              const listName = known?.name || (listId ? `List ${listId}` : "")
              const pickerLists = listId && !known ? [...listChoices, { id: listId, name: listName }] : listChoices
              const preview = describeListRoutingPreview(vaultItems, listId, routing, task.frequency, new Date())
              const measureHint = LIST_MEASURES.find((option) => option.id === routing.measure)?.hint
              const targetHint = LIST_TARGETS.find((option) => option.id === routing.target)?.hint
              const applyRouting = (nextRouting: { measure: HabitListMeasure; target: HabitListTarget }) => {
                const sources = sourcesForListRouting(nextRouting)
                const rows = displayPipelines.map((item) => (item.id === row.id ? { ...item, sources } : item))
                setSourcesLocked(true)
                setListLocked(true)
                setTask((current) => {
                  const picked = pickerLists.find((list) => list.id === (current.listSentLink?.listId || ""))
                  let next: WeeklyTask = {
                    ...current,
                    listSentLink: {
                      listId: current.listSentLink?.listId ?? "",
                      grace: clampListSentGrace(current.listSentLink?.grace),
                      ...storedListSentFields(nextRouting),
                    },
                  }
                  if (legacyModeForRouting(nextRouting) === "oneComplete") {
                    next = {
                      ...next,
                      listLink: { listName: picked?.name || current.listLink?.listName || "to do", count: 1 },
                    }
                  }
                  return { ...withSourceOrder(next, flattenPipelines(rows)), completionPipelines: rows }
                })
              }
              const keepRouting = (patch: { listId?: string; grace?: number | null }) => {
                setSourcesLocked(true)
                setTask((current) => ({
                  ...current,
                  listSentLink: {
                    listId: patch.listId ?? current.listSentLink?.listId ?? "",
                    grace:
                      patch.grace === null
                        ? undefined
                        : typeof patch.grace === "number"
                          ? patch.grace
                          : clampListSentGrace(current.listSentLink?.grace),
                    ...storedListSentFields(current.listSentLink),
                  },
                }))
              }
              return (
                <>
                  <div className="habit95-list-row">
                    <ListSentPicker
                      lists={pickerLists}
                      listId={listId}
                      onChange={(nextId) => keepRouting({ listId: nextId })}
                    />
                    <button
                      type="button"
                      className="habit95-btn habit95-list-open"
                      disabled={!listId}
                      aria-label="Open list"
                      onClick={(event) => {
                        listPopupHost.current = (event.currentTarget as HTMLElement).closest(
                          "[data-ui-name='Habit form']",
                        )
                        setOpenListId(listId)
                      }}
                    >
                      Open list
                    </button>
                  </div>
                  <Habit95Select
                    label="What is counted"
                    ariaLabel="What is counted"
                    valueLabel={LIST_MEASURES.find((option) => option.id === routing.measure)?.label || "Sent"}
                    options={LIST_MEASURES.map((option) => ({ id: option.id, label: option.label }))}
                    hint={measureHint}
                    onChange={(id) => applyRouting({ measure: id as HabitListMeasure, target: routing.target })}
                  />
                  <Habit95Select
                    label="What the target is"
                    ariaLabel="What the target is"
                    valueLabel={LIST_TARGETS.find((option) => option.id === routing.target)?.label || "This period's set"}
                    options={LIST_TARGETS.map((option) => ({ id: option.id, label: option.label }))}
                    hint={targetHint}
                    onChange={(id) => applyRouting({ measure: routing.measure, target: id as HabitListTarget })}
                  />
                  <label className="habit95-field">
                    Grace
                    <input
                      className="habit95-input"
                      type="number"
                      min={1}
                      max={100}
                      aria-label="Grace"
                      value={task.listSentLink?.grace ?? ""}
                      onChange={(e) => {
                        if (e.target.value === "") {
                          keepRouting({ grace: null })
                          return
                        }
                        const grace = Number.parseFloat(e.target.value)
                        if (!Number.isFinite(grace)) return
                        keepRouting({ grace: clampListSentGrace(grace) })
                      }}
                    />
                  </label>
                  <p className="habit95-hint">{GRACE_SENTENCE}</p>
                  <p className="habit95-hint" data-testid="list-pipeline-preview">
                    {listId ? `${preview.summary}${preview.names.length ? ` — ${preview.names.slice(0, 8).join(", ")}` : ""}` : "Choose a list to see what counts."}
                  </p>
                </>
              )
            }
            if (row.kind === "keywords") {
              return (
                <KeywordSourceFields
                  row={row}
                  onChange={(keyword) =>
                    commitPipelines(
                      displayPipelines.map((item) => (item.id === row.id ? { ...item, keyword } : item)),
                      "structure",
                    )
                  }
                />
              )
            }
            if (row.kind === "trackingTags") {
              return <p className="habit95-hint">{COMPLETION_SOURCE_HINTS.tags}</p>
            }
            return <p className="habit95-hint">{COMPLETION_SOURCE_HINTS.manual}</p>
          }}
        />
      </fieldset>

      {(task.type === TaskType.GOAL || task.type === TaskType.TIME || task.type === TaskType.COUNT) && (
        <fieldset className="habit95-group habit95-sec-target">
          <legend>Target</legend>
          <div className="habit95-goal-grid">
            <div className="habit95-field">
              <label htmlFor="task-goal">Amount</label>
              <input
                id="task-goal"
                className="habit95-input"
                type="number"
                min="0"
                step="0.5"
                value={listMeasure.derived ? listMeasure.target : task.goal || ""}
                readOnly={listMeasure.derived}
                onChange={(e) => {
                  if (listMeasure.derived) return
                  const goal = Number.parseFloat(e.target.value) || 0
                  setTask((current) => {
                    const next = { ...current, goal }
                    // Amount is the same number as the coverage threshold when linked —
                    // keep coverageLink in sync so submit does not overwrite with the old %.
                    if (effectiveCoverageLink(current)) {
                      setCoverageLocked(true)
                      next.coverageLink = {
                        threshold: clampCoverageThreshold(goal),
                        enabled: true,
                      }
                      next.unit = current.unit || "%"
                    }
                    return next
                  })
                }}
                placeholder="10"
                required
              />
            </div>
            <div className="habit95-field">
              <label htmlFor="task-unit">Unit (optional)</label>
              <input
                id="task-unit"
                className="habit95-input"
                value={task.unit || ""}
                onChange={(e) => setTask({ ...task, unit: e.target.value })}
                placeholder="minutes, pages…"
              />
            </div>
          </div>
          <label className="habit95-check">
            <input
              type="checkbox"
              checked={!!task.showGoalBar}
              onChange={(e) => setTask({ ...task, showGoalBar: e.target.checked || undefined })}
            />
            Cell progress tube
          </label>
          {listMeasure.derived ? (
            <p className="habit95-hint">This amount is the list length. It follows the list.</p>
          ) : null}
          <p className="habit95-hint">A thin tube under the number, filled by how close the cell is to its amount.</p>
        </fieldset>
      )}

      {task.type === TaskType.INCREMENTAL && (
        <fieldset className="habit95-group habit95-sec-target">
          <legend>Climb</legend>
          <div className="habit95-types" role="radiogroup" aria-label="Climb cadence">
            <button
              type="button"
              className="habit95-choice"
              role="radio"
              aria-checked={climb.cadence === "weekly"}
              onClick={() => setClimb({ cadence: "weekly" })}
            >
              <span className="habit95-choice-name">Weekly +</span>
              <span className="habit95-choice-desc">Like a goal. Rises Monday after 4+ hits.</span>
            </button>
            <button
              type="button"
              className="habit95-choice"
              role="radio"
              aria-checked={climb.cadence === "daily"}
              onClick={() => setClimb({ cadence: "daily" })}
            >
              <span className="habit95-choice-name">Daily +</span>
              <span className="habit95-choice-desc">Log a score. Target = last score + increment.</span>
            </button>
          </div>
          <div className="habit95-goal-grid" style={{ marginTop: 8 }}>
            <div className="habit95-field">
              <label htmlFor="climb-start">Starting value</label>
              <input
                id="climb-start"
                className="habit95-input"
                type="number"
                value={climb.startValue}
                onChange={(e) => setClimb({ startValue: Number.parseFloat(e.target.value) || 0 })}
              />
            </div>
            <div className="habit95-field">
              <label htmlFor="climb-increment">
                {climb.cadence === "daily" ? "Daily increment" : "Weekly increment"}
              </label>
              <input
                id="climb-increment"
                className="habit95-input"
                type="number"
                min="0"
                step="0.5"
                value={climb.increment}
                onChange={(e) => setClimb({ increment: Number.parseFloat(e.target.value) || 0 })}
              />
            </div>
            <div className="habit95-field">
              <label htmlFor="climb-unit">Unit (optional)</label>
              <input
                id="climb-unit"
                className="habit95-input"
                value={climb.unit || ""}
                onChange={(e) => setClimb({ unit: e.target.value })}
                placeholder="minutes, rating…"
              />
            </div>
          </div>
          <p className="habit95-hint">
            {climb.cadence === "weekly"
              ? "Shown as a goal (e.g. 2 minutes). Next Monday the target rises only if you hit it on at least 4 days this week — overshooting a day does not count extra."
              : "Each day log your current score. That score becomes tomorrow’s base even if it dropped. Tomorrow’s target is last log + increment. A skipped day keeps the previous base. Week % is how far you climbed versus increment × 7."}
          </p>
        </fieldset>
      )}

      <fieldset className="habit95-group habit95-sec-points">
        <legend>Points &amp; bonus</legend>
        <p className="habit95-hint">
          The number below is this habit&apos;s own points. A weekly, monthly, or season habit pays that number
          the first time its goal is met. A daily habit&apos;s ledger line is {dailyFullMark} × that day&apos;s
          completion ratio (Points rules), not this field. Day-wide bonuses live in Habits → Settings and in Points rules.
        </p>
        <div className="habit95-goal-grid">
          <div className="habit95-field">
            <label htmlFor="habit-reward">Completion points</label>
            <input
              id="habit-reward"
              className="habit95-input"
              type="number"
              min={0}
              step={1}
              aria-label="Completion points"
              value={task.rewardValue ?? 0}
              onChange={(e) => {
                setRewardTouched(true)
                setTask({
                  ...task,
                  rewardValue: Math.max(0, Number.parseInt(e.target.value, 10) || 0),
                })
              }}
            />
          </div>
          <div className="habit95-field">
            <label htmlFor="habit-bonus-note">Bonus formula</label>
            <input
              id="habit-bonus-note"
              className="habit95-input"
              readOnly
              value={
                (task.frequency || "daily") === "daily"
                  ? `${dailyFullMark} × day ratio`
                  : "Completion points when newly met"
              }
              aria-label="Bonus formula"
            />
          </div>
        </div>
      </fieldset>


      <fieldset className="habit95-group habit95-sec-time">
        <legend>Time estimate</legend>
        <p className="habit95-hint">
          Marking this habit done writes a row on your To&nbsp;Do list. Give it a length and that row carries a real
          time window — when you started, when you finished, how long it took — instead of a bare date.
        </p>

        {measuredInTime ? (
          <p className="habit95-hint">{describeHabitTimeEstimate(task)}</p>
        ) : (
          <>
            <label className="habit95-check">
              <input
                type="checkbox"
                checked={!!task.timeEstimateNA}
                onChange={(e) => setEstimateNA(e.target.checked)}
              />
              N/A
            </label>
            {task.timeEstimateNA ? (
              <p className="habit95-hint">No duration is stored. Grades and the plan treat this as no time estimate.</p>
            ) : (
              <>
                <div className="habit95-goal-grid">
                  {usesRate && (
                    <div className="habit95-field">
                      <label htmlFor="time-per-unit">Minutes per {task.unit?.trim() || "unit"}</label>
                      <input
                        id="time-per-unit"
                        className="habit95-input"
                        type="number"
                        min="0"
                        step="1"
                        value={timeEstimate.minutesPerUnit ?? ""}
                        onChange={(e) =>
                          setTimeEstimate({ minutesPerUnit: Number.parseFloat(e.target.value) || undefined })
                        }
                        placeholder="10"
                      />
                    </div>
                  )}
                  <div className="habit95-field">
                    <label htmlFor="time-flat">Minutes per completion</label>
                    <input
                      id="time-flat"
                      className="habit95-input"
                      type="number"
                      min="0"
                      step="1"
                      value={timeEstimate.minutes ?? ""}
                      onChange={(e) => setTimeEstimate({ minutes: Number.parseFloat(e.target.value) || undefined })}
                      placeholder={usesRate ? "fallback when nothing is logged" : "20"}
                    />
                  </div>
                </div>

                <label className="habit95-check">
                  <input
                    type="checkbox"
                    checked={timeEstimate.precision === "definite"}
                    onChange={(e) => setTimeEstimate({ precision: e.target.checked ? "definite" : "estimated" })}
                  />
                  This length is exact, not a guess
                </label>

                <p className="habit95-hint">{describeHabitTimeEstimate(task)}</p>
              </>
            )}
          </>
        )}
      </fieldset>

      <details className="habit95-group habit95-details habit95-sec-wording">
        <summary>Done task wording</summary>
        <p className="habit95-hint">
          Optional. “read {"{value}"} pages” with 7 logged becomes “read 7 pages”, even when the goal is 3. Leave this
          blank to keep the habit name.
        </p>
        {task.type === TaskType.TEXT ? (
          <label className="habit95-check">
            <input
              type="checkbox"
              checked={!!task.doneTaskUseText}
              onChange={(e) => setTask((current) => ({ ...current, doneTaskUseText: e.target.checked || undefined }))}
            />
            Use the text entered
          </label>
        ) : null}
        <div className="habit95-field">
          <label htmlFor="done-task-phrase">Phrase</label>
          <input
            id="done-task-phrase"
            className="habit95-input"
            value={task.doneTaskPhrase ?? ""}
            placeholder="read {value} pages"
            onChange={(e) => setTask((current) => ({ ...current, doneTaskPhrase: e.target.value }))}
          />
        </div>
      </details>

      {showTracking && (
        <fieldset className="habit95-group habit95-sec-fill">
          <legend>Auto-fill from Tracking</legend>
          <p className="habit95-hint">
            Pick tags from the Tracking tab. Every minute you paint with a pen carrying one of them counts toward this
            habit {periodWord} — no typing.
          </p>

          {trackingTags.length > 0 ? (
            <div className="habit95-tags" role="group" aria-label="Tracking tags">
              {trackingTags.map((tag) => {
                const on = link.tagIds.includes(tag.id)
                return (
                  <button
                    key={tag.id}
                    type="button"
                    className="habit95-tag"
                    aria-pressed={on}
                    onClick={() => toggleLinkTag(tag.id)}
                  >
                    <span className="habit95-tag-dot" style={{ background: tag.color }} />
                    {tag.name}
                  </button>
                )
              })}
            </div>
          ) : (
            <p className="habit95-hint">No tracking tags yet. Name one here and it shows up in Tracking too.</p>
          )}
          <div className="habit95-goal-grid" style={{ marginTop: 8 }}>
            <div className="habit95-field">
              <label htmlFor="new-tracking-tag">New tag</label>
              <input
                id="new-tracking-tag"
                className="habit95-input"
                value={newTagName}
                placeholder="Deep work"
                aria-label="New tracking tag"
                onChange={(e) => setNewTagName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault()
                    createTrackingTag()
                  }
                }}
              />
            </div>
            <div className="habit95-field">
              <label htmlFor="create-tracking-tag" className="sr-only">
                Create tag
              </label>
              <button id="create-tracking-tag" type="button" className="habit95-btn" onClick={createTrackingTag} disabled={!newTagName.trim()}>
                Create tag
              </button>
            </div>
          </div>

          {link.tagIds.length > 0 && (
            <>
              {task.type === TaskType.BOOLEAN ? (
                <div className="habit95-goal-grid" style={{ marginTop: 8 }}>
                  <div className="habit95-field">
                    <label htmlFor="tracking-threshold">Minutes needed to check it off</label>
                    <input
                      id="tracking-threshold"
                      className="habit95-input"
                      type="number"
                      min="0"
                      step="5"
                      value={link.threshold ?? ""}
                      onChange={(e) => setLink({ threshold: Number.parseFloat(e.target.value) || undefined })}
                      placeholder="any tracked time"
                    />
                  </div>
                </div>
              ) : (
                <>
                  <div className="habit95-goal-grid" style={{ marginTop: 8 }}>
                    <div className="habit95-field">
                      <label htmlFor="tracking-unit">Count tracked time as</label>
                      <select
                        id="tracking-unit"
                        className="habit95-input"
                        value={link.unit ?? "minutes"}
                        onChange={(e) => setLink({ unit: e.target.value as HabitTrackingUnit })}
                      >
                        <option value="minutes">Minutes</option>
                        <option value="hours">Hours</option>
                      </select>
                    </div>
                    <div className="habit95-field">
                      <label htmlFor="tracking-mode">Combine with manual entries</label>
                      <select
                        id="tracking-mode"
                        className="habit95-input"
                        value={link.mode ?? "add"}
                        onChange={(e) => setLink({ mode: e.target.value as HabitTrackingMode })}
                      >
                        {TRACKING_MODES.map(({ value, label }) => (
                          <option key={value} value={value}>
                            {label}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <p className="habit95-hint">{TRACKING_MODES.find((m) => m.value === (link.mode ?? "add"))?.desc}</p>
                </>
              )}

              <p className="habit95-hint">
                {linkedPenCount === 0
                  ? "No pen carries these tags yet — tag one in Tracking → Edit pens or nothing will come through."
                  : `${linkedPenCount} pen${linkedPenCount === 1 ? "" : "s"} currently feed${
                      linkedPenCount === 1 ? "s" : ""
                    } this habit.`}
              </p>

              <label className="habit95-check">
                <input
                  type="checkbox"
                  checked={link.enabled !== false}
                  onChange={(e) => setLink({ enabled: e.target.checked })}
                />
                Auto-fill is on
              </label>
            </>
          )}
        </fieldset>
      )}

      {task.frequency === "daily" && (
        <fieldset className="habit95-group habit95-sec-lift">
          <legend>Lift when a log says</legend>
          <p className="habit95-hint">
            An all-nighter is the morning of the night you stayed up. The evening before is the day that led into it.
            The morning of is that next morning. Clearing every block and saving keeps the preset from coming back.
          </p>
          {(task.logExemptions ?? []).map((block, index) => (
            <div className="habit95-brick" key={`${block.when}-${block.day}-${index}`}>
              <label className="habit95-field">
                Log
                <select
                  aria-label="Log that lifts this habit"
                  value={block.when}
                  onChange={(e) => {
                    setLogsLocked(true)
                    const when = e.target.value as HabitLogExemption["when"]
                    setTask((current) => ({
                      ...current,
                      logExemptions: (current.logExemptions ?? []).map((row, i) => (i === index ? { ...row, when } : row)),
                    }))
                  }}
                >
                  <option value="all-nighter">All-nighter</option>
                </select>
              </label>
              <label className="habit95-field">
                Lifts
                <select
                  aria-label="Which day the log lifts"
                  value={block.day}
                  onChange={(e) => {
                    setLogsLocked(true)
                    const day = e.target.value as HabitLogExemption["day"]
                    setTask((current) => ({
                      ...current,
                      logExemptions: (current.logExemptions ?? []).map((row, i) => (i === index ? { ...row, day } : row)),
                    }))
                  }}
                >
                  <option value="evening-before">the evening before that night</option>
                  <option value="morning-of">the morning of that night</option>
                </select>
              </label>
              <button
                type="button"
                className="habit95-btn"
                onClick={() => {
                  setLogsLocked(true)
                  setTask((current) => ({
                    ...current,
                    logExemptions: (current.logExemptions ?? []).filter((_, i) => i !== index),
                  }))
                }}
              >
                Remove
              </button>
            </div>
          ))}
          <button
            type="button"
            className="habit95-btn"
            style={{ marginTop: 6 }}
            onClick={() => {
              setLogsLocked(true)
              setTask((current) => ({
                ...current,
                logExemptions: [...(current.logExemptions ?? []), { when: "all-nighter", day: "evening-before" }],
              }))
            }}
          >
            Add a block
          </button>
        </fieldset>
      )}

      {task.frequency === "daily" && task.type === TaskType.BOOLEAN && (
        <fieldset className="habit95-group habit95-sec-links">
          <legend>Connections</legend>
          <p className="habit95-hint">
            A connection checks this habit from something you already logged. You can still tick the cell yourself.
            The to-do block is the template: copy the count and the list name onto another habit to make the same kind of link.
          </p>
          {task.sleepLink && (
            <div className="habit95-brick">
              <label className="habit95-field">
                Clock
                <select
                  aria-label="Sleep clock"
                  value={task.sleepLink.end}
                  onChange={(e) => {
                    setSleepLocked(true)
                    const end = e.target.value as HabitSleepLink["end"]
                    setTask((current) => ({
                      ...current,
                      sleepLink: current.sleepLink ? { ...current.sleepLink, end } : { end, beforeMinutes: end === "bed" ? -60 : 540 },
                    }))
                  }}
                >
                  <option value="bed">Bedtime</option>
                  <option value="wake">Wake</option>
                </select>
              </label>
              <label className="habit95-field">
                At or before
                <ClockPicker
                  className="habit95-input"
                  aria-label="Clock threshold"
                  value={offsetToClock(task.sleepLink.beforeMinutes)}
                  onChange={(next) => {
                    setSleepLocked(true)
                    const parsed = task.sleepLink?.end === "wake" ? parseWakeTime(next) : parseBedtime(next)
                    if (parsed === undefined || !task.sleepLink) return
                    const end = task.sleepLink.end
                    setTask((current) => ({ ...current, sleepLink: { end, beforeMinutes: parsed } }))
                  }}
                />
              </label>
              <button
                type="button"
                className="habit95-btn"
                onClick={() => {
                  setSleepLocked(true)
                  setTask((current) => ({ ...current, sleepLink: null }))
                }}
              >
                Remove
              </button>
            </div>
          )}
          {task.listLink && (
            <div className="habit95-brick">
              <label className="habit95-field">
                Done
                <input
                  className="habit95-input"
                  type="number"
                  min={1}
                  aria-label="How many done items"
                  value={task.listLink.count}
                  onChange={(e) => {
                    setListLocked(true)
                    const count = Math.max(1, Number.parseInt(e.target.value, 10) || 1)
                    setTask((current) => ({
                      ...current,
                      listLink: { listName: current.listLink?.listName || "to do", count },
                    }))
                  }}
                />
              </label>
              <label className="habit95-field">
                From list
                <input
                  className="habit95-input"
                  aria-label="List name"
                  value={task.listLink.listName}
                  onChange={(e) => {
                    setListLocked(true)
                    const listName = e.target.value
                    setTask((current) => ({
                      ...current,
                      listLink: { listName, count: current.listLink?.count || 1 },
                    }))
                  }}
                />
              </label>
              <span className="habit95-hint">in Next Actions</span>
              <button
                type="button"
                className="habit95-btn"
                onClick={() => {
                  setListLocked(true)
                  setTask((current) => ({ ...current, listLink: null }))
                }}
              >
                Remove
              </button>
            </div>
          )}
          {!task.sleepLink && (
            <button
              type="button"
              className="habit95-btn"
              style={{ marginTop: 6 }}
              onClick={() => {
                setSleepLocked(true)
                setTask((current) => ({ ...current, sleepLink: { end: "bed", beforeMinutes: -60 } }))
              }}
            >
              Add a sleep clock
            </button>
          )}
          {!task.listLink && (
            <button
              type="button"
              className="habit95-btn"
              style={{ marginTop: 6 }}
              onClick={() => {
                setListLocked(true)
                setTask((current) => ({ ...current, listLink: { listName: "to do", count: 1 } satisfies HabitListLink }))
              }}
            >
              Add a to-do list connection
            </button>
          )}
        </fieldset>
      )}

      {sourceOrder.includes("keywords") && (
      <fieldset className="habit95-group habit95-sec-keywords">
        <legend>BIM Keywords</legend>
        <p className="habit95-hint">
          Each phrase is a whole BIM message. “drank water” counts only when that is the entire message, not when
          those words sit inside a longer line. The source row sets how the count is used: true if one arrives, true
          after a set number, or a logged phrase such as <code>read {"{n}"} pages of {"{bookname}"}</code> or{" "}
          <code>cleaned for {"{x}"} minutes</code>, which writes the amount on that period. A minutes or hours
          pattern also logs the prior stretch on the tracking activity. This list still holds the phrases. Examples:{" "}
          <code>hemisync</code>, <code>read 30 pages</code>, <code>exercise 15 min</code>, <code>chess score 355</code>.
          {!hadStoredTriggers && triggers.length > 0 ? " Presets for this name are shown; save to keep them editable." : null}
        </p>
        {triggers.length === 0 ? (
          <p className="habit95-hint">No keywords yet. Add one, or name the habit hemisync / read / exercise / chess for a preset.</p>
        ) : (
          triggers.map((trigger, index) => (
            <div key={trigger.id} className="habit95-goal-grid" style={{ marginTop: index === 0 ? 0 : 8, alignItems: "end" }}>
              <div className="habit95-field">
                <label htmlFor={`trigger-kw-${trigger.id}`}>Keyword</label>
                <input
                  id={`trigger-kw-${trigger.id}`}
                  className="habit95-input"
                  value={trigger.keyword}
                  onChange={(e) => patchTrigger(trigger.id, { keyword: e.target.value })}
                  placeholder="read"
                />
              </div>
              <div className="habit95-field">
                <label htmlFor={`trigger-mode-${trigger.id}`}>Mode</label>
                <select
                  id={`trigger-mode-${trigger.id}`}
                  className="habit95-input"
                  value={trigger.mode}
                  onChange={(e) =>
                    patchTrigger(trigger.id, { mode: e.target.value as HabitTextTrigger["mode"] })
                  }
                >
                  {TRIGGER_MODES.map(({ value, label }) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </div>
              {(trigger.mode === "quantity" || trigger.mode === "score") && (
                <div className="habit95-field">
                  <label htmlFor={`trigger-units-${trigger.id}`}>Unit words</label>
                  <input
                    id={`trigger-units-${trigger.id}`}
                    className="habit95-input"
                    value={(trigger.unitWords ?? []).join(", ")}
                    onChange={(e) =>
                      patchTrigger(trigger.id, {
                        unitWords: e.target.value
                          .split(",")
                          .map((u) => u.trim())
                          .filter(Boolean),
                      })
                    }
                    placeholder="pages, page"
                  />
                </div>
              )}
              {trigger.mode === "score" && (
                <div className="habit95-field">
                  <label htmlFor={`trigger-conn-${trigger.id}`}>Connector</label>
                  <input
                    id={`trigger-conn-${trigger.id}`}
                    className="habit95-input"
                    value={trigger.connector ?? ""}
                    onChange={(e) => patchTrigger(trigger.id, { connector: e.target.value })}
                    placeholder="score"
                  />
                </div>
              )}
              <div className="habit95-field">
                <label htmlFor={`trigger-rm-${trigger.id}`} className="sr-only">
                  Remove keyword
                </label>
                <button
                  id={`trigger-rm-${trigger.id}`}
                  type="button"
                  className="habit95-btn"
                  onClick={() => removeTrigger(trigger.id)}
                >
                  Remove
                </button>
              </div>
            </div>
          ))
        )}
        <button type="button" className="habit95-btn" style={{ marginTop: 8 }} onClick={addTrigger}>
          Add keyword
        </button>
        <div className="habit95-keyword-test">
          <label className="habit95-field" htmlFor="keyword-try">
            Try a phrase
            <input
              id="keyword-try"
              className="habit95-input"
              value={phrase}
              placeholder="studied for 20 min"
              aria-label="Try a phrase"
              onChange={(e) => setPhrase(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") e.preventDefault()
              }}
            />
          </label>
          <p className="habit95-hint habit95-keyword-result" role="status">
            {phrasePreview.text}
          </p>
        </div>
      </fieldset>
      )}
      </div>

      <div className="habit95-actions">
        {initialTask && onDelete ? (
          <button
            type="button"
            className="habit95-btn habit95-btn-danger"
            onClick={() => {
              if (window.confirm(`Delete “${task.name || "this habit"}”?`)) onDelete(initialTask.id)
            }}
          >
            Delete habit
          </button>
        ) : null}
        <button type="button" className="habit95-btn" onClick={onCancel}>
          Cancel
        </button>
        <button type="submit" className="habit95-btn habit95-btn-default" disabled={!canSubmit}>
          {initialTask ? "Update Habit" : "Add Habit"}
        </button>
      </div>
    </form>
    <HabitListPopup
      listId={openListId}
      link={task.listSentLink}
      frequency={task.frequency}
      container={listPopupHost.current}
      onClose={() => setOpenListId(null)}
    />
    </>
  )
}
