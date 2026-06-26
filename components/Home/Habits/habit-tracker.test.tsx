import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { resetAllStores } from "@/tests/test-utils"
import { useHabitsStore } from "@/lib/habits-store"
import { TaskType } from "@/lib/types"
import { WeeklyTaskTracker } from "./habit-tracker"

vi.mock("@/components/Home/Habits/task-grid", () => ({
  TaskGrid: () => <div data-testid="task-grid">Task Grid</div>,
}))

vi.mock("@/components/Home/Habits/period-habit-list", () => ({
  PeriodHabitList: () => <div data-testid="period-habit-list">Period Habit List</div>,
  filterHabitsByFrequency: (tasks: unknown[], frequency: string) =>
    (tasks as { frequency?: string }[]).filter((t) => (t.frequency || "daily") === frequency),
}))

vi.mock("@/components/Home/Habits/daily-task-form-dialog", () => ({
  TaskFormDialog: () => null,
}))

vi.mock("@/components/Home/Habits/settings-dialog", () => ({
  SettingsDialog: () => null,
}))

vi.mock("@/components/Home/Habits/week-navigation", () => ({
  WeekNavigation: () => <div data-testid="week-navigation">Week Navigation</div>,
}))

describe("WeeklyTaskTracker", () => {
  beforeEach(() => {
    resetAllStores()
    useHabitsStore.getState().setTasks([
      { id: "d1", name: "Daily habit", type: TaskType.BOOLEAN, rewardValue: 10, frequency: "daily" },
      { id: "w1", name: "Weekly habit", type: TaskType.BOOLEAN, rewardValue: 10, frequency: "weekly" },
    ])
  })

  it("renders habit tabs and daily grid by default", () => {
    render(<WeeklyTaskTracker currentDate={new Date("2026-06-20T12:00:00")} />)
    expect(screen.getByRole("tab", { name: /Daily \(1\)/ })).toBeInTheDocument()
    expect(screen.getByTestId("task-grid")).toBeInTheDocument()
    expect(screen.getByTestId("week-navigation")).toBeInTheDocument()
  })

  it("switches to weekly tab content when clicked", async () => {
    const user = userEvent.setup()
    render(<WeeklyTaskTracker currentDate={new Date("2026-06-20T12:00:00")} />)

    await user.click(screen.getByRole("tab", { name: /Weekly \(1\)/ }))
    expect(screen.getByTestId("period-habit-list")).toBeInTheDocument()
  })
})
