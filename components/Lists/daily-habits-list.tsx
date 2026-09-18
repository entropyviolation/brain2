/**
 * components/Lists/daily-habits-list.tsx — Daily habits in Lists panel
 *
 * Same `habits-store` as Home Habits. Climb rows log a number vs the derived
 * daily/weekly target (`lib/incremental-habits.ts`).
 */
"use client"

import { useState } from "react"
import { useHabitsStore } from "@/lib/habits-store"
import { TaskType, type WeeklyTask, type TaskCompletion } from "@/lib/types"
import { formatLocalDateKey, getWeekString, getWeekStartDate } from "@/lib/date-utils"
import { isHabitGoalMet, isGoalType } from "@/lib/habit-utils"
import {
  completionValueFromInput,
  incrementalCompletionPayload,
  incrementalDataForTask,
  incrementalGoalOn,
  incrementalLoggedValue,
} from "@/lib/incremental-habits"
import { filterHabitsByFrequency } from "@/components/Home/Habits/period-habit-list"
import { TaskFormDialog } from "@/components/Home/Habits/daily-task-form-dialog"
import { SettingsDialog } from "@/components/Home/Habits/settings-dialog"
import { format } from "date-fns"

export function DailyHabitsList() {
  const tasks = useHabitsStore((s) => s.tasks)
  const weeklyData = useHabitsStore((s) => s.weeklyData)
  const addTask = useHabitsStore((s) => s.addTask)
  const updateTask = useHabitsStore((s) => s.updateTask)
  const deleteTask = useHabitsStore((s) => s.deleteTask)
  const updateCompletion = useHabitsStore((s) => s.updateCompletion)
  const importData = useHabitsStore((s) => s.importData)
  const resetData = useHabitsStore((s) => s.resetData)

  const [showForm, setShowForm] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  const [editing, setEditing] = useState<WeeklyTask | null>(null)

  const today = new Date()
  const dayKey = formatLocalDateKey(today)
  const dayData = weeklyData[dayKey] || {}
  const dailyTasks = filterHabitsByFrequency(tasks, "daily")

  const setCompletion = (task: WeeklyTask, partial: TaskCompletion) => {
    updateCompletion(task.id, today, { ...dayData[task.id], ...partial })
  }

  const handleSubmit = (task: WeeklyTask) => {
    if (editing) {
      updateTask(task)
      setEditing(null)
    } else {
      addTask({ ...task, id: `task-${Date.now()}`, frequency: "daily" })
    }
    setShowForm(false)
  }

  const doneCount = dailyTasks.filter((t) => isHabitGoalMet(t, dayData[t.id], { date: today, weeklyData })).length

  return (
    <div className="fm-sunken" style={{ padding: 0 }}>
      <div className="fm-quickadd" style={{ margin: 8 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
          <strong>{format(today, "EEEE, MMMM d")}</strong>
          <span style={{ fontSize: 11 }}>
            {doneCount}/{dailyTasks.length} done today
          </span>
        </div>
        <div style={{ display: "flex", gap: 6 }}>
          <button
            className="fm-btn fm-btn-sm"
            onClick={() => {
              setEditing(null)
              setShowForm(true)
            }}
          >
            + Add Habit
          </button>
          <button className="fm-btn fm-btn-sm" onClick={() => setShowSettings(true)}>
            Settings
          </button>
        </div>
      </div>

      <div className="fm-linklist" style={{ paddingTop: 0 }}>
        {dailyTasks.length === 0 && (
          <div className="fm-empty">
            <p>No daily habits yet.</p>
          </div>
        )}

        {dailyTasks.map((task) => {
          const c = dayData[task.id] || {}
          const done = isHabitGoalMet(task, c, { date: today, weeklyData })
          return (
            <div key={task.id} className="fm-link-row" style={{ alignItems: "center", justifyContent: "space-between" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, flex: 1, minWidth: 0 }}>
                {task.type === TaskType.BOOLEAN ? (
                  <button
                    className="fm-checkbox"
                    onClick={() => setCompletion(task, { completed: !c.completed })}
                    aria-label="Toggle"
                  >
                    {c.completed ? "✓" : ""}
                  </button>
                ) : (
                  <span className="fm-checkbox" style={{ background: done ? "#16a34a" : undefined, color: done ? "#fff" : undefined }}>
                    {done ? "✓" : ""}
                  </span>
                )}
                <span style={{ color: "#000", textDecoration: done ? "line-through" : "none" }}>{task.name}</span>
              </div>

              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                {isGoalType(task.type) && (
                  <>
                    <input
                      className="fm-input"
                      style={{ width: 64 }}
                      type="number"
                      value={c.value ?? ""}
                      placeholder="0"
                      onChange={(e) =>
                        setCompletion(task, { value: e.target.value === "" ? undefined : Number(e.target.value) })
                      }
                    />
                    <span style={{ fontSize: 10 }}>
                      /{task.goal} {task.unit}
                    </span>
                  </>
                )}
                {task.type === TaskType.INCREMENTAL && (
                  <>
                    <input
                      className="fm-input"
                      style={{ width: 64 }}
                      type="number"
                      value={incrementalLoggedValue(c) ?? ""}
                      placeholder="0"
                      onChange={(e) => setCompletion(task, incrementalCompletionPayload(completionValueFromInput(e.target.value)))}
                    />
                    <span style={{ fontSize: 10 }}>
                      /{incrementalGoalOn(task, weeklyData, today)} {incrementalDataForTask(task)?.unit || task.unit}
                    </span>
                  </>
                )}
                {task.type === TaskType.TEXT && (
                  <input
                    className="fm-input"
                    style={{ width: 160 }}
                    value={c.text ?? ""}
                    placeholder="Note…"
                    onChange={(e) => setCompletion(task, { text: e.target.value || undefined })}
                  />
                )}
                <button className="fm-btn fm-btn-sm" onClick={() => { setEditing(task); setShowForm(true) }}>✎</button>
                <button
                  className="fm-btn fm-btn-sm fm-btn-danger"
                  onClick={() => { if (confirm(`Delete "${task.name}"?`)) deleteTask(task.id) }}
                >
                  ×
                </button>
              </div>
            </div>
          )
        })}
      </div>

      <TaskFormDialog open={showForm} onOpenChange={setShowForm} onSubmit={handleSubmit} initialTask={editing} defaultFrequency="daily" />
      <SettingsDialog open={showSettings} onOpenChange={setShowSettings} tasks={tasks} weeklyData={weeklyData} onImportData={importData} onResetData={resetData} />
    </div>
  )
}

/** Weekly habits list for Lists panel */
export function WeeklyHabitsList() {
  return <PeriodHabitsListPanel frequency="weekly" title="Weekly Habits" />
}

/** Monthly habits list for Lists panel */
export function MonthlyHabitsList() {
  return <PeriodHabitsListPanel frequency="monthly" title="Monthly Habits" />
}

function PeriodHabitsListPanel({ frequency, title }: { frequency: "weekly" | "monthly"; title: string }) {
  const tasks = useHabitsStore((s) => s.tasks)
  const weeklyHabitData = useHabitsStore((s) => s.weeklyHabitData)
  const monthlyHabitData = useHabitsStore((s) => s.monthlyHabitData)
  const updateWeekly = useHabitsStore((s) => s.updateWeeklyHabitCompletion)
  const updateMonthly = useHabitsStore((s) => s.updateMonthlyHabitCompletion)
  const addTask = useHabitsStore((s) => s.addTask)
  const updateTask = useHabitsStore((s) => s.updateTask)
  const deleteTask = useHabitsStore((s) => s.deleteTask)

  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<WeeklyTask | null>(null)

  const filtered = filterHabitsByFrequency(tasks, frequency)
  const now = new Date()
  const weekStart = getWeekStartDate(now)
  const periodKey = frequency === "weekly" ? getWeekString(weekStart) : format(now, "yyyy-MM")
  const data = frequency === "weekly" ? weeklyHabitData : monthlyHabitData
  const bucket = data[periodKey] || {}

  const setCompletion = (task: WeeklyTask, partial: TaskCompletion) => {
    const merged = { ...bucket[task.id], ...partial }
    if (frequency === "weekly") updateWeekly(task.id, weekStart, merged)
    else updateMonthly(task.id, now, merged)
  }

  return (
    <div className="fm-sunken" style={{ padding: 8 }}>
      <strong>{title}</strong>
      <div className="fm-linklist">
        {filtered.map((task) => {
          const c = bucket[task.id] || {}
          const done = isHabitGoalMet(task, c)
          return (
            <div key={task.id} className="fm-link-row">
              {task.type === TaskType.BOOLEAN ? (
                <button className="fm-checkbox" onClick={() => setCompletion(task, { completed: !c.completed })}>
                  {c.completed ? "✓" : ""}
                </button>
              ) : null}
              <span style={{ textDecoration: done ? "line-through" : "none" }}>{task.name}</span>
              {isGoalType(task.type) && (
                <input
                  className="fm-input"
                  type="number"
                  style={{ width: 64, marginLeft: 8 }}
                  value={c.value ?? ""}
                  onChange={(e) => setCompletion(task, { value: Number(e.target.value) || 0 })}
                />
              )}
            </div>
          )
        })}
      </div>
      <button className="fm-btn fm-btn-sm" onClick={() => { setEditing(null); setShowForm(true) }}>+ Add</button>
      <TaskFormDialog
        open={showForm}
        onOpenChange={setShowForm}
        onSubmit={(t) => {
          if (editing) updateTask(t)
          else addTask({ ...t, id: `task-${Date.now()}`, frequency })
          setShowForm(false)
        }}
        initialTask={editing}
        defaultFrequency={frequency}
      />
    </div>
  )
}
