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

  it("hatches a missed week when the rocker is on and leaves it unmarked when off", () => {
    const key = periods[0].key
    const data = { [key]: { h1: { completed: false, missedOpportunity: true } } }
    const props = {
      tasks,
      periods,
      data,
      onUpdate: vi.fn(),
      onEdit: vi.fn(),
      calculateTaskPercentage: () => 0,
      calculatePeriodPercentage: () => 0,
    }
    const { rerender } = render(<PeriodHabitList {...props} hideCompletedAndMissed />)
    expect(screen.getByRole("img", { name: "Weekly review 6/15 missed opportunity" })).toHaveClass("habit-exempt")
    rerender(<PeriodHabitList {...props} />)
    expect(screen.getByRole("checkbox", { name: "Weekly review 6/15" })).toHaveAttribute("aria-checked", "false")
    expect(screen.queryByRole("img", { name: /missed opportunity/i })).not.toBeInTheDocument()
  })

  it("keeps a partial value visible and hides a row at 100%", () => {
    const key = periods[0].key
    const partial = {
      id: "pages",
      name: "Read 30 pages",
      type: TaskType.GOAL,
      goal: 30,
      frequency: "weekly" as const,
    }
    const inProgress = {
      id: "coverage",
      name: "log 75% of the week",
      type: TaskType.GOAL,
      goal: 75,
      frequency: "weekly" as const,
    }
    const note = {
      id: "social",
      name: "Something social",
      type: TaskType.TEXT,
      frequency: "weekly" as const,
    }
    const met = {
      id: "cook",
      name: "cook at least 2 times per week",
      type: TaskType.GOAL,
      goal: 2,
      frequency: "weekly" as const,
    }
    const fullRow = {
      id: "friend",
      name: "Make a new friend",
      type: TaskType.TEXT,
      frequency: "weekly" as const,
    }
    render(
      <PeriodHabitList
        tasks={[partial, inProgress, note, met, fullRow]}
        periods={periods}
        data={{
          [key]: {
            pages: { value: 2, goal: 30 },
            coverage: { value: 30, goal: 75 },
            social: { text: "elijah comin home" },
            cook: { value: 2, goal: 2, completed: true },
            friend: { text: "Margot" },
          },
        }}
        onUpdate={vi.fn()}
        onEdit={vi.fn()}
        hideCompleted
        calculateTaskPercentage={(id) =>
          id === "pages" ? 7 : id === "coverage" ? 61 : id === "social" ? 67 : 100
        }
        calculatePeriodPercentage={() => 0}
      />,
    )
    expect(screen.getByText("Read 30 pages")).toBeInTheDocument()
    expect(screen.getByText("log 75% of the week")).toBeInTheDocument()
    expect(screen.getByText("Something social")).toBeInTheDocument()
    expect(screen.queryByText("cook at least 2 times per week")).not.toBeInTheDocument()
    expect(screen.queryByText("Make a new friend")).not.toBeInTheDocument()
  })
})
