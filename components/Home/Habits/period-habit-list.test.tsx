import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it, vi } from "vitest"
import { TaskType } from "@/lib/types"
import { PeriodHabitList } from "./period-habit-list"
import { getWeekString } from "@/lib/date-utils"

describe("PeriodHabitList", () => {
  const weekStart = new Date(2026, 5, 15)
  const periods = [
    {
      key: getWeekString(weekStart),
      date: weekStart,
      label: "6/15",
      sublabel: "–6/21",
      isCurrent: true,
    },
  ]
  const tasks = [
    { id: "h1", name: "Weekly review", type: TaskType.BOOLEAN, rewardValue: 15, frequency: "weekly" as const },
  ]

  it("renders habit names, period headers, and scores", () => {
    render(
      <PeriodHabitList
        tasks={tasks}
        periods={periods}
        data={{}}
        onUpdate={vi.fn()}
        onEdit={vi.fn()}
        calculateTaskPercentage={() => 0}
        calculatePeriodPercentage={() => 0}
        completionLabel="Weekly completion"
      />,
    )
    expect(screen.getByText("Weekly review")).toBeInTheDocument()
    expect(screen.getByText("6/15")).toBeInTheDocument()
    expect(screen.getByRole("columnheader", { name: "%" })).toBeInTheDocument()
    expect(screen.getByText("Weekly completion")).toBeInTheDocument()
    expect(screen.getByRole("meter", { name: /Weekly review period 0%/ })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Edit" })).toBeInTheDocument()
    expect(screen.queryByRole("button", { name: "Delete" })).not.toBeInTheDocument()
    const act = document.querySelector("th.col-act")
    const name = document.querySelector("th.col-name")
    expect(act && name && (act.compareDocumentPosition(name) & Node.DOCUMENT_POSITION_FOLLOWING)).toBeTruthy()
    expect(document.querySelectorAll("tbody tr:first-child img.habit-gem")).toHaveLength(1)
    expect(document.querySelector(".habit-name img")).toBeNull()
    expect(document.querySelector(".habit-name-title")?.textContent).toBe("Weekly review")
    expect(document.querySelector(".habit-gem-socket")).toBeTruthy()
  })

  it("calls onUpdate when a boolean lamp is checked", async () => {
    const user = userEvent.setup()
    const onUpdate = vi.fn()
    render(
      <PeriodHabitList
        tasks={tasks}
        periods={periods}
        data={{}}
        onUpdate={onUpdate}
        onEdit={vi.fn()}
        calculateTaskPercentage={() => 0}
        calculatePeriodPercentage={() => 0}
      />,
    )

    await user.click(screen.getByRole("checkbox"))
    expect(onUpdate).toHaveBeenCalledWith("h1", weekStart, { completed: true })
  })
})
