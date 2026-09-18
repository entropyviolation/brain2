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
    expect(screen.getByText("Week grade")).toBeInTheDocument()
    expect(screen.getByText("Perfect output")).toBeInTheDocument()
  })

  it("switches to weekly tab content when clicked", async () => {
    const user = userEvent.setup()
    render(<WeeklyTaskTracker currentDate={new Date("2026-06-20T12:00:00")} />)

    await user.click(screen.getByRole("tab", { name: /Weekly \(1\)/ }))
    expect(screen.getByTestId("period-habit-list")).toBeInTheDocument()
  })

  it("opens a grade breakdown when Week grade is clicked", async () => {
    const user = userEvent.setup()
    render(<WeeklyTaskTracker currentDate={new Date("2026-06-20T12:00:00")} />)
    await user.click(screen.getByRole("button", { name: /Week grade/ }))
    expect(screen.getByRole("dialog", { name: /Week grade/i })).toBeInTheDocument()
    expect(screen.getByLabelText(/Daily perfect threshold/i)).toBeInTheDocument()
    expect(screen.getByText(/each daily habit is worth 50/i)).toBeInTheDocument()
    expect(screen.getByText(/\+50 if that day.s raw score is above 80%/i)).toBeInTheDocument()
    expect(screen.getByText(/\+100 if either/i)).toBeInTheDocument()
  })

  it("opens an output grade breakdown when Perfect output is clicked", async () => {
    const user = userEvent.setup()
    render(<WeeklyTaskTracker currentDate={new Date("2026-06-20T12:00:00")} />)
    await user.click(screen.getByRole("button", { name: /Perfect output/ }))
    expect(screen.getByRole("dialog", { name: /Perfect output/i })).toBeInTheDocument()
    expect(screen.getByLabelText(/Output perfect threshold/i)).toBeInTheDocument()
  })
})
