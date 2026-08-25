import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { resetAllStores } from "@/tests/test-utils"
import { useTaskStore } from "@/lib/task-store"
import { buildTodoItems, filterAndSortTodos } from "@/components/Home/ToDo/todo-utils"
import { PlannedTasksSidebar } from "./planned-tasks-sidebar"

describe("PlannedTasksSidebar", () => {
  const currentDate = new Date("2026-06-20T12:00:00")

  beforeEach(() => {
    resetAllStores()
  })

  it("renders month sidebar title", () => {
    render(<PlannedTasksSidebar mode="month" currentDate={currentDate} onTaskClick={vi.fn()} />)
    expect(screen.getByText("Planned This Month")).toBeInTheDocument()
  })

  it("lists month-only planned tasks", () => {
    useTaskStore.getState().setTasks([
      {
        id: "month-task",
        description: "Quarterly planning",
        stage: "scheduled",
        createdAt: currentDate,
        completed: false,
        scheduledMonth: "2026-06",
        lists: [],
        urgency: 3,
        importance: 3,
        estimatedDuration: 60,
        cognitiveLoad: 2,
        dependencies: [],
        context: "@work",
        entropy: 0.5,
        rewardValue: 5,
        allowPartialCompletion: false,
        minimumChunkSize: 15,
      },
    ])

    render(<PlannedTasksSidebar mode="month" currentDate={currentDate} onTaskClick={vi.fn()} />)
    expect(screen.getByText("Quarterly planning")).toBeInTheDocument()
  })

  it("does not show a day add field on month/week rails", () => {
    render(<PlannedTasksSidebar mode="month" currentDate={currentDate} onTaskClick={vi.fn()} />)
    expect(screen.queryByLabelText("Add a to-do for this day")).not.toBeInTheDocument()
  })

  it("adds a day to-do that Home/To-Do lists for the same date", async () => {
    const user = userEvent.setup()
    render(<PlannedTasksSidebar mode="day" currentDate={currentDate} onTaskClick={vi.fn()} />)

    const input = screen.getByLabelText("Add a to-do for this day")
    await user.type(input, "text linda")
    await user.click(screen.getByRole("button", { name: "Add to-do" }))

    expect(screen.getByText("text linda")).toBeInTheDocument()
    const created = useTaskStore.getState().tasks.find((t) => t.description === "text linda")
    expect(created).toMatchObject({
      scheduleable: true,
      context: "@general",
      estimatedDuration: 30,
      stage: "clarified",
    })
    expect(created?.scheduledDate).toBeTruthy()

    const dayItems = filterAndSortTodos(
      buildTodoItems(useTaskStore.getState().tasks, false, currentDate),
      "day",
      false,
      currentDate,
    )
    expect(dayItems.map((i) => i.description)).toContain("text linda")
  })
})
