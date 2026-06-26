import { render, screen } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { resetAllStores } from "@/tests/test-utils"
import { useTaskStore } from "@/lib/task-store"
import { useHabitsStore } from "@/lib/habits-store"
import { TaskType } from "@/lib/types"
import { formatLocalDateKey } from "@/lib/date-utils"
import { DailyProgressQuickview } from "./daily-progress-quickview"

describe("DailyProgressQuickview", () => {
  const currentDate = new Date("2026-06-20T12:00:00")

  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(currentDate)
    resetAllStores()

    useTaskStore.getState().setTasks([
      {
        id: "todo-1",
        description: "Finish report",
        stage: "scheduled",
        createdAt: currentDate,
        completed: true,
        scheduledDate: currentDate,
        lists: [],
        urgency: 3,
        importance: 3,
        estimatedDuration: 30,
        cognitiveLoad: 2,
        dependencies: [],
        context: "@work",
        entropy: 0.5,
        rewardValue: 5,
        allowPartialCompletion: false,
        minimumChunkSize: 15,
      },
      {
        id: "todo-2",
        description: "Email team",
        stage: "scheduled",
        createdAt: currentDate,
        completed: false,
        scheduledDate: currentDate,
        lists: [],
        urgency: 3,
        importance: 3,
        estimatedDuration: 15,
        cognitiveLoad: 1,
        dependencies: [],
        context: "@work",
        entropy: 0.5,
        rewardValue: 5,
        allowPartialCompletion: false,
        minimumChunkSize: 15,
      },
    ])

    useHabitsStore.getState().setTasks([
      { id: "habit-1", name: "Meditate", type: TaskType.BOOLEAN, rewardValue: 10, frequency: "daily" },
    ])
    useHabitsStore.getState().setWeeklyData({
      [formatLocalDateKey(currentDate)]: {
        "habit-1": { completed: true },
      },
    })
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it("renders today's progress card", () => {
    render(<DailyProgressQuickview currentDate={currentDate} />)
    expect(screen.getByText("Today's Progress")).toBeInTheDocument()
    expect(screen.getByText("To Do")).toBeInTheDocument()
    expect(screen.getByText("Habits")).toBeInTheDocument()
  })

  it("shows completion counts for todos and habits", () => {
    render(<DailyProgressQuickview currentDate={currentDate} />)
    expect(screen.getByText("1 of 2 done today")).toBeInTheDocument()
    expect(screen.getByText("1 of 1 done today")).toBeInTheDocument()
    expect(screen.getByText("1 left · 50%")).toBeInTheDocument()
    expect(screen.getByText("0 left · 100%")).toBeInTheDocument()
  })
})
