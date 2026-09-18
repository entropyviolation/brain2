import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it, vi } from "vitest"
import { TaskType } from "@/lib/types"
import { TaskGrid } from "./task-grid"

describe("TaskGrid", () => {
  const weekDates = Array.from({ length: 7 }, (_, i) => new Date(2026, 5, 16 + i))
  const tasks = [
    { id: "h1", name: "Drink water", type: TaskType.BOOLEAN, rewardValue: 10, frequency: "daily" as const },
  ]

  it("renders habit rows and weekday headers", () => {
    render(
      <TaskGrid
        tasks={tasks}
        weeklyData={{}}
        weekDates={weekDates}
        onUpdateTaskCompletion={vi.fn()}
        onEditTask={vi.fn()}
        onDeleteTask={vi.fn()}
        calculateTaskPercentage={() => 0}
        calculateDayPercentage={() => 0}
      />,
    )
    expect(screen.getByText("Drink water")).toBeInTheDocument()
    expect(screen.getByText("Daily Completion")).toBeInTheDocument()
    expect(screen.getByText("Sun")).toBeInTheDocument()
    expect(screen.queryByText("Sun 6/21")).not.toBeInTheDocument()
    expect(screen.getByRole("columnheader", { name: "%" })).toBeInTheDocument()
  })

  it("calls onUpdateTaskCompletion when a boolean habit is toggled", async () => {
    const user = userEvent.setup()
    const onUpdateTaskCompletion = vi.fn()
    render(
      <TaskGrid
        tasks={tasks}
        weeklyData={{}}
        weekDates={weekDates}
        onUpdateTaskCompletion={onUpdateTaskCompletion}
        onEditTask={vi.fn()}
        onDeleteTask={vi.fn()}
        calculateTaskPercentage={() => 0}
        calculateDayPercentage={() => 0}
        viewMode="day"
        selectedDate={weekDates[4]}
      />,
    )

    const checkboxes = screen.getAllByRole("checkbox")
    await user.click(checkboxes[4])
    expect(onUpdateTaskCompletion).toHaveBeenCalledWith("h1", weekDates[4], { completed: true })
  })
})
