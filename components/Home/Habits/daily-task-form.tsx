/**
 * components/Home/Habits/daily-task-form.tsx — Habit form
 *
 * The form for creating/editing a habit: name, period frequency, type tiles
 * (Yes/No, Goal, Text, Climb). Climb adds cadence (Weekly + / Daily +),
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
 * Tracking tags completion source is checked. Hiding it keeps the saved tags.
 * That section is the minute source. **Tagged tasks** is a different source:
 * while it is checked, a tag field is shown and the goal is a count of Done
 * tasks (and tracked activities that file one Done line) with that tag.
 * **Daily completion average** is one checkbox for a weekly, monthly, or season
 * habit. The hint under the list is the whole setting: the raw mean of
 * daily-habit completion, and the goal is the percent that completes it. No tag.
 *
 * **Done task wording** is optional and collapsed. `{value}` is the number
 * logged. Blank keeps the habit name on the Done line (`lib/habit-done-log.ts`).
 *
 * **Lift when a log says** and **Connections** are the editable blocks for an
 * all-nighter exemption, a sleep clock (bedtime / wake at or before a threshold),
 * and a done next-action list. The to-do connection is the template for another habit.
 *
 * **Completion sources** are an ordered trust list (rows sit most trusted first).
 * **Daily habit total** picks its habit with the same Win95 menu, and you can type to filter.
 * **Text keywords (phone)** are whole-message Telegram triggers
 * (`WeeklyTask.textTriggers` / `lib/ingest/text-triggers.ts`). **Try a phrase**
 * previews the parser. Quantity adds. Empty habits get name-matched presets
 * (hemisync, read, exercise, chess) as an editable preview.
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
  type HabitCoverageLink,
  type HabitDailyFloorLink,
  type HabitTextTrigger,
  type IncrementalHabitData,
} from "@/lib/types"
import { normalizeTaskType } from "@/lib/habit-utils"
import { describeHabitTimeEstimate, isTimeMeasuredHabit } from "@/lib/habit-time-estimate"
import { formatLocalDateKey, formatLocalMonthKey, getWeekString, getWeekStartDate } from "@/lib/date-utils"
import { normalizeIncrementalData } from "@/lib/incremental-habits"
import { supportsTrackingLink } from "@/lib/habit-tracking"
import { defaultTriggersForHabit, describeHabitTriggerPreview, makeHabitTriggerId } from "@/lib/ingest/text-triggers"
import { useTimeTrackingStore } from "@/lib/time-tracking-store"
import { penIdsForTags } from "@/lib/tracked-time"
import { useThemeStore } from "@/lib/theme-store"
import { CheckCircle2, AlignLeft, TrendingUp, Target } from "lucide-react"
import { HabitGemChooser } from "@/components/Home/Habits/gem-picker"
import { pickRandomCatalogGem, resolveTaskGem } from "@/lib/habit-gems"
import { serializeSnapshot } from "@/lib/unsaved-changes"
import { presetLogExemptions, sanitizeLogExemptions } from "@/lib/habit-exemption"
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
import { HabitSourcesField } from "@/components/Home/Habits/habit-sources-field"
import { COMPLETION_SOURCE_HINTS } from "@/lib/habit-completion-trust"
import { useHabitsStore } from "@/lib/habits-store"
import { DAILY_HABIT_COMPLETION_POINTS } from "@/lib/habit-points"
import { offsetToClock, parseBedtime, parseWakeTime } from "@/lib/sleep-log"

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

export function TaskForm({ onSubmit, onCancel, onDelete, initialTask, defaultFrequency = "daily", onDirtyChange, onLeaveForItem }: TaskFormProps) {
  const colors = useThemeStore((s) => s.colors)
  const trackingTags = useTimeTrackingStore((s) => s.tags)
  const trackingScopes = useTimeTrackingStore((s) => s.scopes)
  const allHabits = useHabitsStore((s) => s.tasks)
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
  const [sourcesLocked, setSourcesLocked] = useState(Array.isArray(initialTask?.completionSources))
  const estimateHold = useRef<HabitTimeEstimate | undefined>(initialTask?.timeEstimate)
  const [phrase, setPhrase] = useState("")
  const [newTagName, setNewTagName] = useState("")
  const addTrackingTag = useTimeTrackingStore((s) => s.addTag)
  const [task, setTask] = useState<WeeklyTask>({
    id: initialTask?.id || "",
    name: initialTask?.name || "",
    type: initialTask ? normalizeTaskType(initialTask.type) : TaskType.BOOLEAN,
    goal: initialTask?.goal || 0,
    unit: initialTask?.unit || initialClimb?.unit || "",
    rewardValue: initialTask?.rewardValue ?? 10,
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
    gem: initialTask?.gem || pickRandomCatalogGem(),
    logExemptions: initialTask?.logExemptions ?? presetLogExemptions(seedName),
    sleepLink: initialTask && initialTask.sleepLink !== undefined ? initialTask.sleepLink : presetSleepLink(seedName),
    listLink: initialTask && initialTask.listLink !== undefined ? initialTask.listLink : presetListLink(seedName),
    habitValueLink: initialTask?.habitValueLink ?? null,
    showGoalBar: initialTask?.showGoalBar,
  })
  const [baseline] = useState(() => serializeSnapshot({
    name: initialTask?.name || "",
    type: initialTask ? normalizeTaskType(initialTask.type) : TaskType.BOOLEAN,
    goal: initialTask?.goal || 0,
    unit: initialTask?.unit || initialClimb?.unit || "",
    rewardValue: initialTask?.rewardValue ?? 10,
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
    logExemptions: initialTask?.logExemptions ?? presetLogExemptions(seedName),
    sleepLink: initialTask && initialTask.sleepLink !== undefined ? initialTask.sleepLink : presetSleepLink(seedName),
    listLink: initialTask && initialTask.listLink !== undefined ? initialTask.listLink : presetListLink(seedName),
    completionSources: initialTask?.completionSources,
    habitValueLink: initialTask?.habitValueLink ?? null,
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
        logExemptions: task.logExemptions ?? [],
        sleepLink: task.sleepLink ?? null,
        listLink: task.listLink ?? null,
        completionSources: task.completionSources,
        habitValueLink: task.habitValueLink ?? null,
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
      if (!sourcesLocked) next.completionSources = deriveCompletionSources(next)
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
    finalTask.completionSources =
      sourcesLocked && Array.isArray(task.completionSources)
        ? task.completionSources
        : deriveCompletionSources(finalTask)
    const tagged = normalizeTag(task.taggedTaskTag ?? "")
    finalTask.taggedTaskTag =
      finalTask.completionSources?.includes("taggedTasks") && tagged ? tagged : undefined
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
  const showTracking = supportsTrackingLink(task) && sourceOrder.includes("tags")
  const dailyValueSources = allHabits.filter(
    (habit) =>
      (habit.frequency || "daily") === "daily" &&
      habit.id !== task.id &&
      habit.type !== TaskType.TEXT,
  )

  const applySources = (order: HabitCompletionSourceId[]) => {
    setSourcesLocked(true)
    setCoverageLocked(true)
    setFloorLocked(true)
    setSleepLocked(true)
    setListLocked(true)
    setTask((current) => {
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
      return next
    })
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

  return (
    <form id="habit95-form" onSubmit={handleSubmit} className="habit95-form">
      <div className="habit95-fields">
      <div className="habit95-field">
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

      <fieldset className="habit95-group">
        <legend>Gem</legend>
        <p className="habit95-hint">Jewel on the row edit button. A random catalog stone is assigned; pick or upload to keep your own.</p>
        <HabitGemChooser
          value={task.gem}
          fallback={resolveTaskGem(task)}
          onChange={(gem) => setTask({ ...task, gem: gem || pickRandomCatalogGem() })}
          label="Habit gem"
        />
      </fieldset>

      <fieldset className="habit95-group">
        <legend>Priority</legend>
        <p className="habit95-hint">
          A pin stays until you remove it. A fully empty week (or week/month) auto-prioritizes
          the next period and compounds. Mute to drop the auto term.
        </p>
        <label className="habit95-check">
          <input
            type="checkbox"
            checked={!!task.priorityPinned}
            onChange={(e) => setTask({ ...task, priorityPinned: e.target.checked })}
          />
          Prioritize this habit
        </label>
        <label className="habit95-check">
          <input
            type="checkbox"
            checked={!!task.priorityMuted}
            onChange={(e) => setTask({ ...task, priorityMuted: e.target.checked })}
          />
          Ignore missed-period auto-priority
        </label>
      </fieldset>

      <fieldset className="habit95-group">
        <legend>Frequency</legend>
        <div className="habit95-freq" role="radiogroup" aria-label="Frequency">
          {FREQUENCIES.map(({ value, label }) => (
            <button
              key={value}
              type="button"
              className="habit95-choice"
              role="radio"
              aria-checked={task.frequency === value}
              onClick={() => setTask({ ...task, frequency: value })}
            >
              <span className="habit95-choice-name">{label}</span>
            </button>
          ))}
        </div>
      </fieldset>

      <fieldset className="habit95-group">
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

      {(task.type === TaskType.GOAL || task.type === TaskType.TIME || task.type === TaskType.COUNT) && (
        <fieldset className="habit95-group">
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
                value={task.goal || ""}
                onChange={(e) => {
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
          <p className="habit95-hint">A thin tube under the number, filled by how close the cell is to its amount.</p>
        </fieldset>
      )}

      {task.type === TaskType.INCREMENTAL && (
        <fieldset className="habit95-group">
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

      <fieldset className="habit95-group">
        <legend>Points &amp; bonus</legend>
        <p className="habit95-hint">
          Completing this habit awards the points below (full mark). Daily habits also earn a scaled ledger line of{" "}
          {DAILY_HABIT_COMPLETION_POINTS} × that day&apos;s completion ratio. Day-wide bonuses (accomplishment,
          grade 75%+, grade-lift) live in Habits → Settings.
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
              onChange={(e) =>
                setTask({
                  ...task,
                  rewardValue: Math.max(0, Number.parseInt(e.target.value, 10) || 0),
                })
              }
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
                  ? `${DAILY_HABIT_COMPLETION_POINTS} × day ratio + completion points when newly met`
                  : "Completion points when newly met"
              }
              aria-label="Bonus formula"
            />
          </div>
        </div>
      </fieldset>

      <fieldset className="habit95-group">
        <legend>Completion sources</legend>
        <p className="habit95-hint">
          A habit can listen to more than one place. The list is trust order: the first source that has something to
          say wins when they disagree. A source with no observation is skipped. What you already logged stays in the
          cell.
        </p>
        <HabitSourcesField order={sourceOrder} onChange={applySources} />
        {sourceOrder.includes("dailyCompletionAverage") && (
          <p className="habit95-hint" style={{ marginTop: 8 }}>
            {COMPLETION_SOURCE_HINTS.dailyCompletionAverage}
          </p>
        )}
        {sourceOrder.includes("taggedTasks") && (
          <div className="habit95-brick" style={{ marginTop: 8 }}>
            <p className="habit95-hint">
              Done tasks and tracked activities with this tag each count as 1. The goal is how many complete the period.
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
          </div>
        )}
        {sourceOrder.includes("habitValue") && (
          <div className="habit95-brick" style={{ marginTop: 8 }}>
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
            <span className="habit95-hint">
              Each cell of this week, month, or season is the sum of that daily habit on the days that have already
              happened.
            </span>
          </div>
        )}
        {effectiveCoverageLink(task) && (
          <div className="habit95-brick" style={{ marginTop: 8 }}>
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
            <span className="habit95-hint">
              Activity Occupancy — the same “% of the{" "}
              {task.frequency === "weekly"
                ? "week"
                : task.frequency === "monthly"
                  ? "month"
                  : task.frequency === "quarterly"
                    ? "season"
                    : "day"}” Tracking shows on the Activity Time Grid / Week
              (`activityOccupancyCoverage`). Cell label caps at the threshold; stored % stays real.
            </span>
          </div>
        )}
        {effectiveDailyFloorLink(task) && (
          <div className="habit95-brick" style={{ marginTop: 8 }}>
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
                  setTask((current) => ({
                    ...current,
                    dailyFloorLink: { floorPercent, enabled: true },
                  }))
                }}
              />
            </label>
            <span className="habit95-hint">% week completion. 0 means every daily habit was attempted at least once.</span>
          </div>
        )}
      </fieldset>

      <fieldset className="habit95-group">
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

      <details className="habit95-group habit95-details">
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
        <fieldset className="habit95-group">
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
        <fieldset className="habit95-group">
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
        <fieldset className="habit95-group">
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
                <input
                  className="habit95-input"
                  type="time"
                  aria-label="Clock threshold"
                  value={offsetToClock(task.sleepLink.beforeMinutes)}
                  onChange={(e) => {
                    setSleepLocked(true)
                    const parsed = task.sleepLink?.end === "wake" ? parseWakeTime(e.target.value) : parseBedtime(e.target.value)
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

      <fieldset className="habit95-group">
        <legend>Text keywords (phone)</legend>
        <p className="habit95-hint">
          Whole-message only — the phone line must be just the command (optional trailing note). Examples:{" "}
          <code>hemisync</code>, <code>read 30 pages</code>, <code>exercise 15 min</code>,{" "}
          <code>chess score 355</code>.
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
  )
}
