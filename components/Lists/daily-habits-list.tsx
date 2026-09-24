/**
 * components/Lists/daily-habits-list.tsx — Daily habits in Lists panel
 *
 * Same `habits-store` as Home Habits (including overall Good-day settings). Climb rows log a number vs the derived
 * daily/weekly target (`lib/incremental-habits.ts`).
 */
"use client"

import { useState } from "react"
import { useHabitsStore } from "@/lib/habits-store"
import { usePersistHydrated } from "@/lib/use-persist-hydrated"
import { HabitNumberField, HabitTextField } from "@/components/Home/Habits/habit-value-field"
import { TaskType, type WeeklyTask, type TaskCompletion } from "@/lib/types"
import { formatLocalDateKey, getWeekString, getWeekStartDate } from "@/lib/date-utils"
import { isHabitGoalMet, isGoalType } from "@/lib/habit-utils"
import { isHabitPeriodExempt } from "@/lib/habit-exemption"
import { useExemptionContext } from "@/lib/sleep-store"
import {
  incrementalCompletionPayload,
  incrementalDataForTask,
  incrementalGoalOn,
  incrementalLoggedValue,
} from "@/lib/incremental-habits"
import { filterHabitsByFrequency } from "@/components/Home/Habits/period-habit-list"
import { TaskFormDialog } from "@/components/Home/Habits/daily-task-form-dialog"
import { SettingsDialog } from "@/components/Home/Habits/settings-dialog"
import { syncTrackedHabitsForTask, useHabitTrackingSync } from "@/lib/habit-tracking-sync"
import { format } from "date-fns"

export function DailyHabitsList() {
  useHabitTrackingSync()
  useExemptionContext()
  const hydrated = usePersistHydrated(useHabitsStore.persist)
  const tasks = useHabitsStore((s) => s.tasks)
  const weeklyData = useHabitsStore((s) => s.weeklyData)
  const habitExemptions = useHabitsStore((s) => s.habitExemptions)
  const addTask = useHabitsStore((s) => s.addTask)
  const updateTask = useHabitsStore((s) => s.updateTask)
  const deleteTask = useHabitsStore((s) => s.deleteTask)
  const updateCompletion = useHabitsStore((s) => s.updateCompletion)
  const importData = useHabitsStore((s) => s.importData)
  const resetData = useHabitsStore((s) => s.resetData)
  const accomplishmentThreshold = useHabitsStore((s) => s.accomplishmentThreshold)
  const accomplishmentBonus = useHabitsStore((s) => s.accomplishmentBonus)
  const setAccomplishmentThreshold = useHabitsStore((s) => s.setAccomplishmentThreshold)
  const setAccomplishmentBonus = useHabitsStore((s) => s.setAccomplishmentBonus)

  const [showForm, setShowForm] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  const [editing, setEditing] = useState<WeeklyTask | null>(null)

  const today = new Date()
  const dayKey = formatLocalDateKey(today)
  const dayData = weeklyData[dayKey] || {}
  const dailyTasks = filterHabitsByFrequency(tasks, "daily")

  const setCompletion = (task: WeeklyTask, partial: TaskCompletion) => {
    updateCompletion(task.id, today, partial)
  }

  if (!hydrated) {
    return (
      <div className="fm-sunken" aria-busy="true" style={{ padding: 12 }}>
        <p>Loading habits…</p>
      </div>
    )
  }

  const handleSubmit = (task: WeeklyTask) => {
    let savedId = task.id
    if (editing) {
      updateTask(task)
      setEditing(null)
    } else {
      savedId = `task-${Date.now()}`
      addTask({ ...task, id: savedId, frequency: "daily" })
    }
    syncTrackedHabitsForTask(savedId)
    setShowForm(false)
  }

  const requiredToday = dailyTasks.filter((t) => !isHabitPeriodExempt(t, dayKey, "daily", habitExemptions))
  const doneCount = requiredToday.filter((t) => isHabitGoalMet(t, dayData[t.id], { date: today, weeklyData })).length

  return (
    <div className="fm-sunken" style={{ padding: 0 }}>
      <div className="fm-quickadd" style={{ margin: 8 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
          <strong>{format(today, "EEEE, MMMM d")}</strong>
          <span style={{ fontSize: 11 }}>
            {requiredToday.length === 0 ? "nothing required" : `${doneCount}/${requiredToday.length} done today`}
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
          const exempt = isHabitPeriodExempt(task, dayKey, "daily", habitExemptions)
          const done = !exempt && isHabitGoalMet(task, c, { date: today, weeklyData })
          return (
            <div key={task.id} className="fm-link-row" style={{ alignItems: "center", justifyContent: "space-between" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, flex: 1, minWidth: 0 }}>
                {exempt ? (
                  <span className="fm-checkbox" title="Exempt today" aria-label="Exempt today">
                    –
                  </span>
                ) : task.type === TaskType.BOOLEAN ? (
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
                <span style={{ color: exempt ? "#6b5b3a" : "#000", textDecoration: done ? "line-through" : "none" }}>
                  {task.name}
                  {exempt ? " · exempt" : ""}
                </span>
              </div>

              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                {isGoalType(task.type) && (
                  <>
                    <HabitNumberField
                      plain
                      className="fm-input"
                      style={{ width: 64 }}
                      value={c.value}
                      placeholder="0"
                      ariaLabel={`${task.name} today`}
                      onValue={(n) => setCompletion(task, { value: n })}
                    />
                    <span style={{ fontSize: 10 }}>
                      /{task.goal} {task.unit}
                    </span>
                  </>
                )}
                {task.type === TaskType.INCREMENTAL && (
                  <>
                    <HabitNumberField
                      plain
                      className="fm-input"
                      style={{ width: 64 }}
                      value={incrementalLoggedValue(c)}
                      placeholder="0"
                      ariaLabel={`${task.name} today`}
                      onValue={(n) => setCompletion(task, incrementalCompletionPayload(n))}
                    />
                    <span style={{ fontSize: 10 }}>
                      /{incrementalGoalOn(task, weeklyData, today)} {incrementalDataForTask(task)?.unit || task.unit}
                    </span>
                  </>
                )}
                {task.type === TaskType.TEXT && (
                  <HabitTextField
                    plain
                    className="fm-input"
                    style={{ width: 160 }}
                    value={c.text ?? ""}
                    placeholder="Note…"
                    onValue={(text) => setCompletion(task, { text: text || undefined })}
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
      <SettingsDialog
        open={showSettings}
        onOpenChange={setShowSettings}
        tasks={tasks}
        weeklyData={weeklyData}
        onImportData={importData}
        onResetData={resetData}
        accomplishmentThreshold={accomplishmentThreshold}
        accomplishmentBonus={accomplishmentBonus}
        onAccomplishmentThresholdChange={setAccomplishmentThreshold}
        onAccomplishmentBonusChange={setAccomplishmentBonus}
      />
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
  useHabitTrackingSync()
  useExemptionContext()
  const hydrated = usePersistHydrated(useHabitsStore.persist)
  const tasks = useHabitsStore((s) => s.tasks)
  const weeklyHabitData = useHabitsStore((s) => s.weeklyHabitData)
  const monthlyHabitData = useHabitsStore((s) => s.monthlyHabitData)
  const habitExemptions = useHabitsStore((s) => s.habitExemptions)
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
  const required = filtered.filter((t) => !isHabitPeriodExempt(t, periodKey, frequency, habitExemptions))
  const doneCount = required.filter((t) => isHabitGoalMet(t, bucket[t.id])).length

  const setCompletion = (task: WeeklyTask, partial: TaskCompletion) => {
    if (frequency === "weekly") updateWeekly(task.id, weekStart, partial)
    else updateMonthly(task.id, now, partial)
  }

  if (!hydrated) {
    return (
      <div className="fm-sunken" aria-busy="true" style={{ padding: 12 }}>
        <p>Loading habits…</p>
      </div>
    )
  }

  const handleSubmit = (task: WeeklyTask) => {
    let savedId = task.id
    if (editing) {
      updateTask(task)
      setEditing(null)
    } else {
      savedId = `task-${Date.now()}`
      addTask({ ...task, id: savedId, frequency })
    }
    syncTrackedHabitsForTask(savedId)
    setShowForm(false)
  }

  return (
    <div className="fm-sunken" style={{ padding: 8 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
        <strong>{title}</strong>
        <span style={{ fontSize: 11 }}>
          {required.length === 0 ? "nothing required" : `${doneCount}/${required.length} done`}
        </span>
      </div>
      <div className="fm-linklist">
        {filtered.map((task) => {
          const c = bucket[task.id] || {}
          const exempt = isHabitPeriodExempt(task, periodKey, frequency, habitExemptions)
          const done = !exempt && isHabitGoalMet(task, c)
          return (
            <div key={task.id} className="fm-link-row">
              {exempt ? (
                <span className="fm-checkbox" title="Exempt" aria-label="Exempt">
                  –
                </span>
              ) : task.type === TaskType.BOOLEAN ? (
                <button className="fm-checkbox" onClick={() => setCompletion(task, { completed: !c.completed })}>
                  {c.completed ? "✓" : ""}
                </button>
              ) : null}
              <span style={{ textDecoration: done ? "line-through" : "none", color: exempt ? "#6b5b3a" : undefined }}>
                {task.name}
                {exempt ? " · exempt" : ""}
              </span>
              {isGoalType(task.type) && (
                <HabitNumberField
                  plain
                  className="fm-input"
                  style={{ width: 64, marginLeft: 8 }}
                  value={c.value}
                  ariaLabel={task.name}
                  onValue={(n) => setCompletion(task, { value: n })}
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
        onSubmit={handleSubmit}
        initialTask={editing}
        defaultFrequency={frequency}
      />
    </div>
  )
}
