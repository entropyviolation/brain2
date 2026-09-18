/**
 * components/Home/Habits/daily-task-form.tsx — Habit form
 *
 * The form for creating/editing a habit: name, period frequency, type tiles
 * (Yes/No, Goal, Text, Climb). Climb adds cadence (Weekly + / Daily +),
 * starting value, increment, and optional unit.
 *
 * Spec: §9.4 (habit data model).
 */
"use client"

import type React from "react"

import { useState } from "react"
import { type WeeklyTask, TaskType, type HabitFrequency, type IncrementalHabitData } from "@/lib/types"
import { normalizeTaskType } from "@/lib/habit-utils"
import { formatLocalDateKey } from "@/lib/date-utils"
import { normalizeIncrementalData } from "@/lib/incremental-habits"
import { useThemeStore } from "@/lib/theme-store"
import { CheckCircle2, AlignLeft, TrendingUp, Target } from "lucide-react"

interface TaskFormProps {
  onSubmit: (task: WeeklyTask) => void
  onCancel: () => void
  initialTask?: WeeklyTask | null
  defaultFrequency?: HabitFrequency
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

function emptyClimb(): IncrementalHabitData {
  return {
    cadence: "weekly",
    startValue: 2,
    increment: 1,
    unit: "minutes",
    startedOn: formatLocalDateKey(new Date()),
  }
}

export function TaskForm({ onSubmit, onCancel, initialTask, defaultFrequency = "daily" }: TaskFormProps) {
  const colors = useThemeStore((s) => s.colors)
  const initialClimb = initialTask ? normalizeIncrementalData(initialTask.incrementalData) : undefined
  const [task, setTask] = useState<WeeklyTask>({
    id: initialTask?.id || "",
    name: initialTask?.name || "",
    type: initialTask ? normalizeTaskType(initialTask.type) : TaskType.BOOLEAN,
    goal: initialTask?.goal || 0,
    unit: initialTask?.unit || initialClimb?.unit || "",
    rewardValue: initialTask?.rewardValue || 10,
    frequency: initialTask?.frequency || defaultFrequency,
    incrementalData: initialClimb,
  })

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
    onSubmit(finalTask)
  }

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
    <form onSubmit={handleSubmit} className="habit95-form">
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
      </div>

      <div className="habit95-actions">
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
