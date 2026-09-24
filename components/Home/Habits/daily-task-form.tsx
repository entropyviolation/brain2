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
 * (10 min per page) or a flat length per completion. That is what lets the Done
 * row it writes carry a duration and a real window instead of a bare date
 * (`lib/habit-time-estimate.ts`). Anything derived from a rate is flagged for
 * confirmation in the review unless it is marked as a known ("definite") length.
 *
 * **Lift when a log says** and **Connections** are the editable blocks for an
 * all-nighter exemption, a sleep clock (bedtime / wake at or before a threshold),
 * and a done next-action list. The to-do connection is the template for another habit.
 *
 * **Text keywords (phone)** are whole-message Telegram triggers
 * (`WeeklyTask.textTriggers` / `lib/ingest/text-triggers.ts`). Empty habits get
 * name-matched presets (hemisync, read, exercise, chess) as an editable preview.
 *
 * Spec: §9.4 (habit data model).
 */
"use client"

import type React from "react"

import { useEffect, useRef, useState } from "react"
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
  type HabitTextTrigger,
  type IncrementalHabitData,
} from "@/lib/types"
import { normalizeTaskType } from "@/lib/habit-utils"
import { describeHabitTimeEstimate, isTimeMeasuredHabit } from "@/lib/habit-time-estimate"
import { formatLocalDateKey } from "@/lib/date-utils"
import { normalizeIncrementalData } from "@/lib/incremental-habits"
import { supportsTrackingLink } from "@/lib/habit-tracking"
import { defaultTriggersForHabit, makeHabitTriggerId } from "@/lib/ingest/text-triggers"
import { useTimeTrackingStore } from "@/lib/time-tracking-store"
import { penIdsForTags } from "@/lib/tracked-time"
import { useThemeStore } from "@/lib/theme-store"
import { CheckCircle2, AlignLeft, TrendingUp, Target } from "lucide-react"
import { HabitGemChooser } from "@/components/Home/Habits/gem-picker"
import { pickRandomCatalogGem, resolveTaskGem } from "@/lib/habit-gems"
import { serializeSnapshot } from "@/lib/unsaved-changes"
import { presetLogExemptions, sanitizeLogExemptions } from "@/lib/habit-exemption"
import { presetListLink, presetSleepLink } from "@/lib/habit-connections"
import { offsetToClock, parseBedtime, parseWakeTime } from "@/lib/sleep-log"

interface TaskFormProps {
  onSubmit: (task: WeeklyTask) => void
  onCancel: () => void
  onDelete?: (taskId: string) => void
  initialTask?: WeeklyTask | null
  defaultFrequency?: HabitFrequency
  onDirtyChange?: (dirty: boolean) => void
}

const FREQUENCIES: { value: HabitFrequency; label: string }[] = [
  { value: "daily", label: "Daily" },
  { value: "weekly", label: "Weekly" },
  { value: "monthly", label: "Monthly" },
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

export function TaskForm({ onSubmit, onCancel, onDelete, initialTask, defaultFrequency = "daily", onDirtyChange }: TaskFormProps) {
  const colors = useThemeStore((s) => s.colors)
  const trackingTags = useTimeTrackingStore((s) => s.tags)
  const trackingScopes = useTimeTrackingStore((s) => s.scopes)
  const initialClimb = initialTask ? normalizeIncrementalData(initialTask.incrementalData) : undefined
  const seededTriggers = seedTextTriggers(initialTask)
  const hadStoredTriggers = Boolean(initialTask?.textTriggers?.length)
  const [triggersLocked, setTriggersLocked] = useState(hadStoredTriggers)
  const seedName = { name: initialTask?.name || "", frequency: initialTask?.frequency || defaultFrequency, type: initialTask ? normalizeTaskType(initialTask.type) : TaskType.BOOLEAN }
  const [logsLocked, setLogsLocked] = useState(Array.isArray(initialTask?.logExemptions))
  const [sleepLocked, setSleepLocked] = useState(!!initialTask && initialTask.sleepLink !== undefined)
  const [listLocked, setListLocked] = useState(!!initialTask && initialTask.listLink !== undefined)
  const [task, setTask] = useState<WeeklyTask>({
    id: initialTask?.id || "",
    name: initialTask?.name || "",
    type: initialTask ? normalizeTaskType(initialTask.type) : TaskType.BOOLEAN,
    goal: initialTask?.goal || 0,
    unit: initialTask?.unit || initialClimb?.unit || "",
    rewardValue: initialTask?.rewardValue || 10,
    frequency: initialTask?.frequency || defaultFrequency,
    incrementalData: initialClimb,
    trackingLink: initialTask?.trackingLink,
    timeEstimate: initialTask?.timeEstimate,
    textTriggers: seededTriggers,
    priorityPinned: initialTask?.priorityPinned,
    priorityMuted: initialTask?.priorityMuted,
    gem: initialTask?.gem || pickRandomCatalogGem(),
    logExemptions: initialTask?.logExemptions ?? presetLogExemptions(seedName),
    sleepLink: initialTask && initialTask.sleepLink !== undefined ? initialTask.sleepLink : presetSleepLink(seedName),
    listLink: initialTask && initialTask.listLink !== undefined ? initialTask.listLink : presetListLink(seedName),
  })
  const [baseline] = useState(() => serializeSnapshot({
    name: initialTask?.name || "",
    type: initialTask ? normalizeTaskType(initialTask.type) : TaskType.BOOLEAN,
    goal: initialTask?.goal || 0,
    unit: initialTask?.unit || initialClimb?.unit || "",
    rewardValue: initialTask?.rewardValue || 10,
    frequency: initialTask?.frequency || defaultFrequency,
    incrementalData: initialClimb,
    trackingLink: initialTask?.trackingLink,
    timeEstimate: initialTask?.timeEstimate,
    textTriggers: seededTriggers,
    gem: task.gem,
    priorityPinned: initialTask?.priorityPinned,
    priorityMuted: initialTask?.priorityMuted,
    logExemptions: initialTask?.logExemptions ?? presetLogExemptions(seedName),
    sleepLink: initialTask && initialTask.sleepLink !== undefined ? initialTask.sleepLink : presetSleepLink(seedName),
    listLink: initialTask && initialTask.listLink !== undefined ? initialTask.listLink : presetListLink(seedName),
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
        timeEstimate: task.timeEstimate,
        textTriggers: task.textTriggers ?? [],
        gem: task.gem,
        priorityPinned: task.priorityPinned,
        priorityMuted: task.priorityMuted,
        logExemptions: task.logExemptions ?? [],
        sleepLink: task.sleepLink ?? null,
        listLink: task.listLink ?? null,
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
    setTask((current) => ({
      ...current,
      logExemptions: logsLocked ? current.logExemptions : presetLogExemptions(current),
      sleepLink: sleepLocked ? current.sleepLink : presetSleepLink(current),
      listLink: listLocked ? current.listLink : presetListLink(current),
    }))
  }, [task.name, task.frequency, task.type, logsLocked, sleepLocked, listLocked])

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
    // Drop an estimate with no numbers rather than persisting an empty object.
    const estimate = task.timeEstimate
    finalTask.timeEstimate =
      estimate && ((estimate.minutesPerUnit ?? 0) > 0 || (estimate.minutes ?? 0) > 0) ? estimate : undefined
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
  const toggleLinkTag = (id: string) =>
    setLink({ tagIds: link.tagIds.includes(id) ? link.tagIds.filter((t) => t !== id) : [...link.tagIds, id] })

  const periodWord =
    task.frequency === "weekly" ? "that week" : task.frequency === "monthly" ? "that month" : "that day"
  const showTracking = supportsTrackingLink(task)
  const linkedPenCount = penIdsForTags(trackingScopes, link.tagIds).size

  const timeEstimate: HabitTimeEstimate = task.timeEstimate ?? {}
  const setTimeEstimate = (patch: Partial<HabitTimeEstimate>) =>
    setTask((current) => ({ ...current, timeEstimate: { ...(current.timeEstimate ?? {}), ...patch } }))
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
                onChange={(e) =>
                  setTask({
                    ...task,
                    goal: Number.parseFloat(e.target.value) || 0,
                  })
                }
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
        <legend>Time estimate</legend>
        <p className="habit95-hint">
          Marking this habit done writes a row on your To&nbsp;Do list. Give it a length and that row carries a real
          time window — when you started, when you finished, how long it took — instead of a bare date.
        </p>

        {measuredInTime ? (
          <p className="habit95-hint">{describeHabitTimeEstimate(task)}</p>
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
      </fieldset>

      {showTracking && (
        <fieldset className="habit95-group">
          <legend>Auto-fill from Tracking</legend>
          <p className="habit95-hint">
            Pick tags from the Tracking tab. Every minute you paint with a pen carrying one of them counts toward this
            habit {periodWord} — no typing.
          </p>

          {trackingTags.length === 0 ? (
            <p className="habit95-hint">
              No tracking tags yet. Create them in Home → Tracking → Edit pens.
            </p>
          ) : (
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
          )}

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
