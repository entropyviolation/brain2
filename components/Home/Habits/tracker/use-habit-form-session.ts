/**
 * tracker/use-habit-form-session.ts — Add, edit, and delete a habit.
 *
 * Create ids stay `task-${Date.now()}`. The form closes before tracking
 * backfill. Return from Lists still opens the stored row.
 */
"use client"

import { useEffect, useState } from "react"
import type { HabitFrequency, WeeklyTask } from "@/lib/types"
import { useHabitsStore } from "@/lib/habits-store"
import { syncTrackedHabitsForTask } from "@/lib/habit-tracking-sync"
import { clearHabitSettingsReturn, habitSettingsReturnReady, peekHabitSettingsReturn, takeHabitDraft } from "@/lib/habit-list-item"
import { subscribeNavRestore } from "@/lib/screen-location"
import { APP_NAV_KEYS, HABIT_FREQ_TABS } from "@/lib/app-navigation"
import { usePersistedTab } from "@/lib/use-persisted-tab"

export function useHabitFormSession({
  addTaskToStore,
  updateTaskInStore,
}: {
  addTaskToStore: (task: WeeklyTask) => void
  updateTaskInStore: (task: WeeklyTask) => void
}) {
  const [showTaskForm, setShowTaskForm] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  const [showGradeBreakdown, setShowGradeBreakdown] = useState(false)
  const [showOutputGradeBreakdown, setShowOutputGradeBreakdown] = useState(false)
  const [showGoodDays, setShowGoodDays] = useState(false)
  const [editingTask, setEditingTask] = useState<WeeklyTask | null>(null)
  const [habitTab, setHabitTab] = usePersistedTab(APP_NAV_KEYS.homeHabitsTab, HABIT_FREQ_TABS, "daily")
  const [defaultFrequency, setDefaultFrequency] = useState<HabitFrequency>("daily")

  const handleAddTask = (task: WeeklyTask) => {
    let savedId = task.id
    if (editingTask) {
      updateTaskInStore(task)
      setEditingTask(null)
    } else {
      savedId = `task-${Date.now()}`
      addTaskToStore({ ...task, id: savedId, frequency: task.frequency || defaultFrequency })
    }
    // Close first so a tracking backfill error cannot swallow this setState.
    setShowTaskForm(false)
    try {
      syncTrackedHabitsForTask(savedId)
    } catch (error) {
      console.error("Failed to sync tracked time onto habit", savedId, error)
    }
  }

  const handleEditTask = (task: WeeklyTask) => {
    setEditingTask(task)
    setDefaultFrequency(task.frequency || "daily")
    setShowTaskForm(true)
  }

  useEffect(() => {
    return subscribeNavRestore(() => {
      if (!habitSettingsReturnReady()) return
      const id = peekHabitSettingsReturn()
      if (!id) return
      clearHabitSettingsReturn()
      const draft = takeHabitDraft(id)
      const habit = draft ?? useHabitsStore.getState().tasks.find((row) => row.id === id) ?? null
      if (!habit) return
      setEditingTask(habit)
      setDefaultFrequency(habit.frequency || "daily")
      setShowTaskForm(true)
    })
  }, [])

  return {
    showTaskForm,
    setShowTaskForm,
    showSettings,
    setShowSettings,
    showGradeBreakdown,
    setShowGradeBreakdown,
    showOutputGradeBreakdown,
    setShowOutputGradeBreakdown,
    showGoodDays,
    setShowGoodDays,
    editingTask,
    setEditingTask,
    habitTab,
    setHabitTab,
    defaultFrequency,
    setDefaultFrequency,
    handleAddTask,
    handleEditTask,
  }
}
