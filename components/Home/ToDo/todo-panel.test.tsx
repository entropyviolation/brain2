import { fireEvent, render, screen, within } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { resetAllStores } from "@/tests/test-utils"
import { useTaskStore } from "@/lib/task-store"
import { getScheduleableCategoryIds, isTaskScheduleable } from "@/components/Scheduler/scheduler-utils"
import { TODO_PREFS_KEY, getTodoPrefs, resetTodoPrefsForTests } from "./todo-prefs"
import { orbFor } from "@/components/Icons"
import { getWeekString } from "@/lib/date-utils"
import { readListsNavigation } from "@/lib/app-navigation"
import { periodTodoListName } from "@/lib/scheduled-lists-sync"
import { TodoPanel } from "./todo-panel"

vi.mock("@/components/ItemDetail/ItemDetailPopup", () => ({
  TaskDetailPopup: () => null,
}))

describe("TodoPanel", () => {
  const today = new Date("2026-06-20T12:00:00")

  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(today)
    resetAllStores()
    resetTodoPrefsForTests()
    useTaskStore.getState().setTasks([
      {
        id: "todo-1",
        description: "Finish slides",
        stage: "scheduled",
        createdAt: today,
        completed: false,
        scheduledDate: today,
        lists: [],
        urgency: 5,
        importance: 5,
        estimatedDuration: 60,
        cognitiveLoad: 3,
        dependencies: [],
        context: "@work",
        entropy: 0.5,
        rewardValue: 10,
        allowPartialCompletion: false,
        minimumChunkSize: 15,
      },
    ])
  })

  afterEach(() => {
    resetTodoPrefsForTests()
    vi.useRealTimers()
  })

  it("renders todo panel header and day tab", () => {
    const { container } = render(<TodoPanel />)
    expect(screen.getByText("To Do")).toBeInTheDocument()
    expect(container.querySelector(".todo95")).toHaveAttribute("data-ui-name", "To Do")
    expect(container.querySelector(".todo-fascia")).toHaveAttribute("data-ui-name", "To Do fascia")
    expect(container.querySelector(".todo-period")).toHaveAttribute("data-ui-name", "Period nameplate")
    expect(container.querySelector(".todo-view-keys")).toHaveAttribute("data-ui-name", "Period keys")
    expect(container.querySelector(".todo-filters")).toHaveAttribute("data-ui-name", "Show / Sort / Pace")
    expect(container.querySelector(".todo-sheet")).toHaveAttribute("data-ui-name", "Period sheet")
    expect(container.querySelector(".todo-load")).toHaveAttribute("data-ui-name", "Period load")
    expect(container.querySelector(".todo-band.is-required")).toHaveAttribute("data-ui-name", "Required")
    expect(container.querySelector(".todo-band.is-assigned")).toHaveAttribute("data-ui-name", "Assigned")
    expect(container.querySelector(".todo-composer")).toHaveAttribute("data-ui-name", "Assigned composer")
    expect(container.querySelector(".todo-section.is-done")).toHaveAttribute("data-ui-name", "Done")
    expect(container.querySelector(".todo-section.is-missed")).toHaveAttribute("data-ui-name", "Missed")
    expect(container.querySelector(".todo-status")).toHaveAttribute("data-ui-name", "Status bar")
    expect(container.querySelector(".todo-desk-plate")).toHaveAttribute("data-ui-name", "To Do plate")
    const plate = container.querySelector("[data-desk-plate='todo'] img")
    expect(plate).toHaveAttribute("src", orbFor("home-todo"))
    expect(screen.getByText("Today's Tasks")).toBeInTheDocument()
    expect(screen.getByText("Finish slides")).toBeInTheDocument()
    expect(screen.getByLabelText("Sort")).toBeInTheDocument()
    expect(screen.getByLabelText("Sort")).toHaveValue("priority")
    expect(screen.getByLabelText("Sort descending")).toBeInTheDocument()
    expect(screen.getByLabelText("Available now")).not.toBeChecked()
    expect(screen.queryByText("Undone")).not.toBeInTheDocument()
  })

  it("keeps a past day on Undone after Push schedules today", () => {
    const yesterday = new Date(2026, 5, 19, 12, 0, 0)
    useTaskStore.getState().setTasks([
      {
        id: "slid",
        description: "Leftover draft",
        stage: "scheduled",
        createdAt: yesterday,
        completed: false,
        scheduledWeek: getWeekString(yesterday),
        schedulePlacements: [{ period: "day", value: "2026-06-19" }],
        lists: [],
        urgency: 3,
        importance: 3,
        estimatedDuration: 30,
        cognitiveLoad: 2,
        dependencies: [],
        context: "@work",
        entropy: 0.5,
        rewardValue: 1,
        allowPartialCompletion: false,
        minimumChunkSize: 15,
      },
    ])
    render(<TodoPanel />)
    fireEvent.click(screen.getByRole("button", { name: "Previous day" }))
    expect(screen.getByText("Undone")).toBeInTheDocument()
    expect(screen.getByText("Leftover draft")).toBeInTheDocument()
    expect(screen.getByText("Now on this week")).toBeInTheDocument()
    fireEvent.click(screen.getByRole("button", { name: "Push" }))
    expect(screen.getByText("Leftover draft")).toBeInTheDocument()
    const kept = useTaskStore.getState().tasks.find((t) => t.id === "slid")
    expect(kept?.schedulePlacements).toEqual([{ period: "day", value: "2026-06-19", resolved: "pushed" }])
    expect(kept?.daysPushed).toBe(1)
    expect(kept?.scheduledWeek).toBeUndefined()
  })

  it("defaults to priority order so higher-scoring tasks appear first", () => {
    useTaskStore.getState().setTasks([
      {
        id: "low",
        description: "Low tier task",
        stage: "scheduled",
        createdAt: today,
        completed: false,
        scheduledDate: today,
        lists: [],
        urgency: 1,
        importance: 1,
        estimatedDuration: 30,
        cognitiveLoad: 2,
        dependencies: [],
        context: "@work",
        entropy: 0.5,
        rewardValue: 1,
        allowPartialCompletion: false,
        minimumChunkSize: 15,
      },
      {
        id: "high",
        description: "High tier task",
        stage: "scheduled",
        createdAt: today,
        completed: false,
        scheduledDate: today,
        lists: [],
        urgency: 5,
        importance: 5,
        estimatedDuration: 30,
        cognitiveLoad: 2,
        dependencies: [],
        context: "@work",
        entropy: 0.5,
        rewardValue: 1,
        allowPartialCompletion: false,
        minimumChunkSize: 15,
      },
    ])
    render(<TodoPanel />)
    const high = screen.getByText("High tier task")
    const low = screen.getByText("Low tier task")
    expect(high.compareDocumentPosition(low) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  })

  it("can sort by name and toggle ascending or descending", () => {
    useTaskStore.getState().setTasks([
      {
        id: "z",
        description: "Zebra",
        stage: "scheduled",
        createdAt: today,
        completed: false,
        scheduledDate: today,
        lists: [],
        urgency: 3,
        importance: 3,
        estimatedDuration: 30,
        cognitiveLoad: 2,
        dependencies: [],
        context: "@work",
        entropy: 0.5,
        rewardValue: 1,
        allowPartialCompletion: false,
        minimumChunkSize: 15,
      },
      {
        id: "a",
        description: "Apple",
        stage: "scheduled",
        createdAt: today,
        completed: false,
        scheduledDate: today,
        lists: [],
        urgency: 3,
        importance: 3,
        estimatedDuration: 30,
        cognitiveLoad: 2,
        dependencies: [],
        context: "@work",
        entropy: 0.5,
        rewardValue: 1,
        allowPartialCompletion: false,
        minimumChunkSize: 15,
      },
    ])
    render(<TodoPanel />)
    fireEvent.change(screen.getByLabelText("Sort"), { target: { value: "name" } })
    // Name mode defaults to ascending.
    const apple = screen.getByText("Apple")
    const zebra = screen.getByText("Zebra")
    expect(apple.compareDocumentPosition(zebra) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()

    fireEvent.click(screen.getByLabelText("Sort ascending"))
    expect(screen.getByLabelText("Sort descending")).toBeInTheDocument()
    expect(zebra.compareDocumentPosition(apple) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  })

  it("pins prioritized assigned tasks above the selected sort", () => {
    useTaskStore.getState().setTasks([
      {
        id: "alpha",
        description: "Alpha ordinary",
        stage: "scheduled",
        createdAt: today,
        completed: false,
        scheduledDate: today,
        lists: [],
        urgency: 3,
        importance: 3,
        estimatedDuration: 30,
        cognitiveLoad: 2,
        dependencies: [],
        context: "@work",
        entropy: 0.5,
        rewardValue: 1,
        allowPartialCompletion: false,
        minimumChunkSize: 15,
      },
      {
        id: "zeta",
        description: "Zeta prioritized",
        stage: "scheduled",
        createdAt: today,
        completed: false,
        scheduledDate: today,
        lists: [],
        urgency: 1,
        importance: 1,
        estimatedDuration: 30,
        cognitiveLoad: 2,
        dependencies: [],
        context: "@work",
        entropy: 0.5,
        rewardValue: 1,
        allowPartialCompletion: false,
        minimumChunkSize: 15,
        todoMarks: [{ period: "day", periodKey: "2026-06-20", prioritized: true }],
      },
    ])
    render(<TodoPanel />)
    fireEvent.change(screen.getByLabelText("Sort"), { target: { value: "name" } })
    const zeta = screen.getByText("Zeta prioritized")
    const alpha = screen.getByText("Alpha ordinary")
    expect(zeta.compareDocumentPosition(alpha) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  })

  it("marks a task complete when the complete action is clicked", () => {
    render(<TodoPanel />)
    screen.getByTitle("Mark complete").click()
    vi.advanceTimersByTime(500)
    const updated = useTaskStore.getState().tasks[0]
    expect(updated.completed).toBe(true)
    expect(updated.completedDate).toBeTruthy()
  })

  it("files a task as a missed opportunity instead of completing it", () => {
    render(<TodoPanel />)
    fireEvent.click(screen.getByRole("button", { name: "Finish slides" }))
    screen.getByTitle("Missed opportunity — too late").click()
    const updated = useTaskStore.getState().tasks[0]
    expect(updated.completed).toBe(false)
    expect(updated.status).toBe("missed")
    expect(updated.missedAt).toBeTruthy()
    expect(screen.getByText("Missed opportunities today")).toBeInTheDocument()
  })

  it("shows a collapsible done section for the active period", () => {
    useTaskStore.getState().setTasks([
      {
        id: "done-1",
        description: "Shipped hotfix",
        type: "task",
        stage: "completed",
        createdAt: today,
        completed: true,
        status: "done",
        scheduledDate: today,
        completedDate: today,
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
    ])
    render(<TodoPanel />)
    expect(screen.getByText("Done Today")).toBeInTheDocument()
    expect(screen.getByText("(1)")).toBeInTheDocument()
  })

  it("creates To-Do tasks that are scheduleable so they surface in the Scheduler", () => {
    useTaskStore.getState().setTasks([])
    render(<TodoPanel />)

    fireEvent.click(screen.getByRole("button", { name: /add task/i }))
    const dialog = screen.getByRole("dialog")
    fireEvent.change(within(dialog).getByLabelText("Description"), {
      target: { value: "Draft proposal" },
    })
    fireEvent.click(within(dialog).getByRole("button", { name: /add task/i }))

    const created = useTaskStore.getState().tasks.find((t) => t.description === "Draft proposal")
    expect(created).toBeTruthy()
    expect(created?.scheduleable).toBe(true)
    // The Scheduler gate now lets this task through even though it has no list.
    expect(isTaskScheduleable(created!, getScheduleableCategoryIds([]))).toBe(true)
  })

  it("hides tasks with unmet dependencies when Available now is on", () => {
    useTaskStore.getState().setTasks([
      {
        id: "ready",
        description: "Ready to start",
        stage: "scheduled",
        createdAt: today,
        completed: false,
        scheduledDate: today,
        lists: [],
        urgency: 3,
        importance: 3,
        estimatedDuration: 30,
        cognitiveLoad: 2,
        dependencies: [],
        context: "@work",
        entropy: 0.5,
        rewardValue: 1,
        allowPartialCompletion: false,
        minimumChunkSize: 15,
      },
      {
        id: "blocked",
        description: "Waiting on dep",
        stage: "scheduled",
        createdAt: today,
        completed: false,
        scheduledDate: today,
        lists: [],
        urgency: 3,
        importance: 3,
        estimatedDuration: 30,
        cognitiveLoad: 2,
        dependencies: ["dep"],
        context: "@work",
        entropy: 0.5,
        rewardValue: 1,
        allowPartialCompletion: false,
        minimumChunkSize: 15,
      },
      {
        id: "dep",
        description: "The blocker",
        stage: "scheduled",
        createdAt: today,
        completed: false,
        lists: [],
        urgency: 3,
        importance: 3,
        estimatedDuration: 30,
        cognitiveLoad: 2,
        dependencies: [],
        context: "@work",
        entropy: 0.5,
        rewardValue: 1,
        allowPartialCompletion: false,
        minimumChunkSize: 15,
      },
    ])
    render(<TodoPanel />)
    expect(screen.getByText("Ready to start")).toBeInTheDocument()
    expect(screen.getByText("Waiting on dep")).toBeInTheDocument()

    fireEvent.click(screen.getByLabelText("Available now"))
    expect(screen.getByText("Ready to start")).toBeInTheDocument()
    expect(screen.queryByText("Waiting on dep")).not.toBeInTheDocument()
    expect(JSON.parse(localStorage.getItem(TODO_PREFS_KEY) ?? "{}").availableNow).toBe(true)
  })

  it("warns in chrome when in-progress count exceeds the soft cap", () => {
    useTaskStore.getState().setTasks(
      ["one", "two", "three", "four"].map((id, index) => ({
        id,
        description: `WIP ${id}`,
        stage: "scheduled",
        createdAt: today,
        completed: false,
        status: "partial" as const,
        scheduledDate: today,
        lists: [],
        urgency: 3,
        importance: 3,
        estimatedDuration: 30,
        cognitiveLoad: 2,
        dependencies: [],
        context: "@work",
        entropy: 0.5,
        rewardValue: 1,
        allowPartialCompletion: false,
        minimumChunkSize: 15,
        daysPushed: index,
      })),
    )
    render(<TodoPanel />)
    expect(screen.getByRole("status")).toHaveTextContent("4 in progress (cap 3)")
    expect(screen.getByText("WIP one")).toBeInTheDocument()

    fireEvent.change(screen.getByLabelText("In progress cap"), { target: { value: "5" } })
    expect(screen.queryByRole("status")).not.toBeInTheDocument()
    expect(JSON.parse(localStorage.getItem(TODO_PREFS_KEY) ?? "{}").wipLimit).toBe(5)
  })

  it("opens the focused period's To do list in Lists", () => {
    render(<TodoPanel />)
    expect(screen.getByRole("button", { name: "Open To do 6/20 in Lists" })).toBeInTheDocument()
    fireEvent.click(screen.getByRole("button", { name: "Open To do 6/20 in Lists" }))
    const list = useTaskStore.getState().lists.find((item) => item.name === "To do 6/20")
    expect(list).toBeTruthy()
    expect(readListsNavigation().openTarget).toEqual({ type: "category", id: list!.id })
    expect(periodTodoListName("week", getWeekString(today))).toMatch(/^To do \d+\/\d+-\d+\/\d+$/)
  })

  it("splits required tasks out and shows the period load", () => {
    render(<TodoPanel />)
    const load = screen.getByLabelText("Period load")
    expect(within(load).queryByText("Days left")).not.toBeInTheDocument()
    expect(within(load).getByText("Est hours of work remaining")).toBeInTheDocument()
    expect(within(load).getByText(/11h/)).toBeInTheDocument()
    expect(within(load).getByTitle(/Clock hours left \(not used by comfort\): 12h/)).toBeInTheDocument()
    expect(within(load).getByText(/manageable/)).toBeInTheDocument()
    expect(within(load).getByRole("button", { name: "All assigned" })).toBeInTheDocument()
    expect(within(load).getByRole("button", { name: "Required + prioritized" })).toBeInTheDocument()
    expect(screen.getByText("Nothing required.")).toBeInTheDocument()
    expect(within(screen.getByRole("region", { name: "Assigned" })).getByText("Finish slides")).toBeInTheDocument()

    const assignedDay = screen.getByRole("region", { name: "Assigned" })
    fireEvent.click(within(assignedDay).getByRole("button", { name: "Finish slides" }))
    fireEvent.click(within(assignedDay).getByRole("button", { name: "Required" }))
    const required = screen.getByRole("region", { name: "Required" })
    expect(within(required).getByDisplayValue("Finish slides")).toBeInTheDocument()
    expect(within(screen.getByRole("region", { name: "Assigned" })).queryByText("Finish slides")).not.toBeInTheDocument()
    expect(useTaskStore.getState().tasks[0]?.todoMarks?.[0]).toMatchObject({
      period: "day",
      required: true,
    })

    if (!within(required).queryByRole("button", { name: "Prioritized" })) {
      fireEvent.click(within(required).getByRole("button", { name: "Finish slides" }))
    }
    fireEvent.click(within(required).getByRole("button", { name: "Prioritized" }))
    expect(within(required).getByRole("button", { name: "Prioritized" })).toHaveAttribute(
      "aria-pressed",
      "true",
    )
    fireEvent.click(within(load).getByRole("button", { name: "Required" }))
    expect(within(load).getByText("1h")).toBeInTheDocument()
  })

  it("searches assigned tasks, adds a step, and deletes from the row", () => {
    render(<TodoPanel />)
    const assigned = screen.getByRole("region", { name: "Assigned" })
    fireEvent.change(within(assigned).getByLabelText("Search assigned tasks"), { target: { value: "nope" } })
    expect(within(assigned).queryByText("Finish slides")).not.toBeInTheDocument()
    expect(within(assigned).getByText("Nothing matches.")).toBeInTheDocument()
    fireEvent.change(within(assigned).getByLabelText("Search assigned tasks"), { target: { value: "slides" } })
    expect(within(assigned).getByText("Finish slides")).toBeInTheDocument()

    fireEvent.click(within(assigned).getByRole("button", { name: "Finish slides" }))
    const stepName = within(assigned).getByLabelText("Add step")
    fireEvent.change(stepName, { target: { value: "Outline" } })
    fireEvent.change(within(assigned).getByLabelText("Minutes for the new step"), { target: { value: "45" } })
    fireEvent.keyDown(stepName, { key: "Enter" })
    expect(within(assigned).getByText("Outline")).toBeInTheDocument()
    expect(useTaskStore.getState().tasks[0]?.subtasks?.[0]?.description).toBe("Outline")
    expect(useTaskStore.getState().tasks[0]?.subtasks?.[0]?.estimatedDuration).toBe(45)

    const confirm = vi.spyOn(window, "confirm").mockReturnValue(true)
    fireEvent.click(within(assigned).getByRole("button", { name: "Delete" }))
    expect(confirm).toHaveBeenCalled()
    expect(useTaskStore.getState().tasks).toHaveLength(0)
    confirm.mockRestore()
  })

  it("hides days left on the day lens and names the remaining-work estimate", () => {
    render(<TodoPanel />)
    expect(screen.queryByText("Days left")).not.toBeInTheDocument()
    expect(screen.getByText("Est hours of work remaining")).toBeInTheDocument()
    fireEvent.mouseDown(screen.getByRole("tab", { name: "Week" }))
    expect(screen.getByText("Days left")).toBeInTheDocument()
    expect(screen.getByText("Est hours of work remaining")).toBeInTheDocument()
  })

  it("shows 0% complete for an unfinished task, not a fraction of the day", () => {
    useTaskStore.getState().setTasks([
      {
        id: "cds",
        description: "Finish CDs",
        stage: "scheduled",
        createdAt: today,
        completed: false,
        status: "active",
        scheduledDate: today,
        lists: [],
        urgency: 3,
        importance: 3,
        estimatedDuration: 30,
        cognitiveLoad: 2,
        dependencies: [],
        context: "@work",
        entropy: 0.5,
        rewardValue: 1,
        allowPartialCompletion: false,
        minimumChunkSize: 15,
      },
    ])
    render(<TodoPanel />)
    const row = screen.getByText("Finish CDs").closest(".todo-row")
    expect(row).toBeTruthy()
    const meter = within(row as HTMLElement).getByRole("meter")
    expect(meter).toHaveAttribute("aria-valuenow", "0")
    expect(within(meter).getByText("0%")).toBeInTheDocument()
  })

  it("keeps the row when the active lamp is toggled twice", () => {
    render(<TodoPanel />)
    const lamp = () => screen.getByRole("button", { name: "Active" })
    fireEvent.click(lamp())
    expect(screen.getByText("Finish slides")).toBeInTheDocument()
    expect(useTaskStore.getState().tasks.find((task) => task.id === "todo-1")?.status).toBe("partial")
    fireEvent.click(lamp())
    expect(screen.getByText("Finish slides")).toBeInTheDocument()
    expect(useTaskStore.getState().tasks.find((task) => task.id === "todo-1")?.status).toBe("active")
  })

  it("picks a tier from a menu and folds the open card without a second title", () => {
    render(<TodoPanel />)
    fireEvent.change(screen.getByLabelText("Tier"), { target: { value: "B" } })
    const updated = useTaskStore.getState().tasks.find((task) => task.id === "todo-1")
    expect(updated?.urgency).toBe(2)
    expect(updated?.importance).toBe(2)

    fireEvent.click(screen.getByRole("button", { name: "Finish slides" }))
    const row = screen.getByLabelText("Task name").closest(".todo-row") as HTMLElement
    expect(within(row).getByLabelText("Task name")).toHaveValue("Finish slides")
    expect(within(row).queryByText("Rename")).not.toBeInTheDocument()
    const estimate = within(row).getByRole("group", { name: "Estimate" })
    expect(estimate).not.toHaveTextContent("counts")
    expect(within(row).getByRole("group", { name: "Flags" })).toBeInTheDocument()
    expect(within(row).getByText("counts 60m")).toBeInTheDocument()

    fireEvent.click(within(row).getByRole("button", { name: "Flags" }))
    expect(within(row).queryByRole("button", { name: "Required" })).not.toBeInTheDocument()
    expect(getTodoPrefs().lidCollapsed.flags).toBe(true)
  })

  it("shows a controlled non-today day on the open list without paging", () => {
    const monday = new Date(2026, 5, 22, 12, 0, 0)
    useTaskStore.getState().setTasks([
      {
        id: "later",
        description: "Monday errand",
        stage: "scheduled",
        createdAt: monday,
        completed: false,
        scheduledDate: monday,
        lists: [],
        urgency: 3,
        importance: 3,
        estimatedDuration: 30,
        cognitiveLoad: 2,
        dependencies: [],
        context: "@work",
        entropy: 0.5,
        rewardValue: 1,
        allowPartialCompletion: false,
        minimumChunkSize: 15,
      },
    ])
    const setCurrentDate = vi.fn()
    render(<TodoPanel currentDate={monday} setCurrentDate={setCurrentDate} />)
    expect(screen.getByText("Monday errand")).toBeInTheDocument()
    expect(screen.getByText("Jun 22's Tasks")).toBeInTheDocument()
    expect(screen.getByRole("heading", { name: "Monday, Jun 22, 2026" })).toBeInTheDocument()
    expect(screen.queryByText("Undone")).not.toBeInTheDocument()
    expect(setCurrentDate).not.toHaveBeenCalled()
  })

  it("calls setCurrentDate with the previous calendar day", () => {
    const setCurrentDate = vi.fn()
    render(
      <TodoPanel currentDate={new Date(2026, 5, 20, 12, 0, 0)} setCurrentDate={setCurrentDate} />,
    )
    fireEvent.click(screen.getByRole("button", { name: "Previous day" }))
    expect(setCurrentDate).toHaveBeenCalledTimes(1)
    const next = setCurrentDate.mock.calls[0][0] as Date
    expect(next.getFullYear()).toBe(2026)
    expect(next.getMonth()).toBe(5)
    expect(next.getDate()).toBe(19)
  })

  it("pages week, month, and season without calling setCurrentDate", () => {
    const setCurrentDate = vi.fn()
    render(
      <TodoPanel currentDate={new Date(2026, 5, 20, 12, 0, 0)} setCurrentDate={setCurrentDate} />,
    )

    fireEvent.mouseDown(screen.getByRole("tab", { name: "Week" }))
    expect(document.querySelector(".todo-period h3")).toHaveTextContent("Jun 15–21")
    fireEvent.click(screen.getByRole("button", { name: "Previous week" }))
    expect(document.querySelector(".todo-period h3")).toHaveTextContent("Jun 8–14")

    fireEvent.mouseDown(screen.getByRole("tab", { name: "Month" }))
    expect(document.querySelector(".todo-period h3")).toHaveTextContent("June 2026")
    fireEvent.click(screen.getByRole("button", { name: "Previous month" }))
    expect(document.querySelector(".todo-period h3")).toHaveTextContent("May 2026")

    fireEvent.mouseDown(screen.getByRole("tab", { name: "Season" }))
    expect(document.querySelector(".todo-period-nav span")).toHaveTextContent("Quarter 2026 Q2 (Summer)")
    fireEvent.click(screen.getByRole("button", { name: "Previous season" }))
    expect(document.querySelector(".todo-period-nav span")).toHaveTextContent("Quarter 2026 Q1 (Spring)")
    expect(setCurrentDate).not.toHaveBeenCalled()
  })

  it("sends Today on the day lens to the shared date and keeps Today on week local", () => {
    const setCurrentDate = vi.fn()
    render(
      <TodoPanel currentDate={new Date(2026, 5, 10, 12, 0, 0)} setCurrentDate={setCurrentDate} />,
    )
    fireEvent.click(screen.getByRole("button", { name: "Today" }))
    expect(setCurrentDate).toHaveBeenCalledTimes(1)
    const next = setCurrentDate.mock.calls[0][0] as Date
    expect(next.getFullYear()).toBe(2026)
    expect(next.getMonth()).toBe(5)
    expect(next.getDate()).toBe(20)

    setCurrentDate.mockClear()
    fireEvent.mouseDown(screen.getByRole("tab", { name: "Week" }))
    expect(document.querySelector(".todo-period h3")).toHaveTextContent("Jun 8–14")
    fireEvent.click(screen.getByRole("button", { name: "Today" }))
    expect(setCurrentDate).not.toHaveBeenCalled()
    expect(document.querySelector(".todo-period h3")).toHaveTextContent("Jun 15–21")
  })

  it("moves the day sheet when the shared date changes", () => {
    const setCurrentDate = vi.fn()
    const { rerender } = render(
      <TodoPanel currentDate={new Date(2026, 5, 18, 12, 0, 0)} setCurrentDate={setCurrentDate} />,
    )
    expect(screen.getByText("Jun 18's Tasks")).toBeInTheDocument()
    expect(screen.getByRole("heading", { name: "Thursday, Jun 18, 2026" })).toBeInTheDocument()
    rerender(<TodoPanel currentDate={new Date(2026, 5, 12, 12, 0, 0)} setCurrentDate={setCurrentDate} />)
    expect(screen.getByText("Jun 12's Tasks")).toBeInTheDocument()
    expect(screen.getByRole("heading", { name: "Friday, Jun 12, 2026" })).toBeInTheDocument()
  })

  it("keeps a paged season when the shared day moves, and a fresh mount follows it", () => {
    const setCurrentDate = vi.fn()
    const later = new Date(2026, 8, 15, 12, 0, 0)
    const { rerender, unmount } = render(
      <TodoPanel currentDate={new Date(2026, 5, 20, 12, 0, 0)} setCurrentDate={setCurrentDate} />,
    )
    fireEvent.mouseDown(screen.getByRole("tab", { name: "Season" }))
    fireEvent.click(screen.getByRole("button", { name: "Previous season" }))
    expect(document.querySelector(".todo-period-nav span")).toHaveTextContent("Quarter 2026 Q1 (Spring)")

    rerender(<TodoPanel currentDate={later} setCurrentDate={setCurrentDate} />)
    expect(document.querySelector(".todo-period-nav span")).toHaveTextContent("Quarter 2026 Q1 (Spring)")
    expect(screen.queryByText("Quarter 2026 Q3 (Fall)")).not.toBeInTheDocument()
    expect(setCurrentDate).not.toHaveBeenCalled()

    unmount()
    render(<TodoPanel currentDate={later} setCurrentDate={setCurrentDate} />)
    const seasonTab = screen.getByRole("tab", { name: "Season" })
    if (seasonTab.getAttribute("data-state") !== "active") {
      fireEvent.mouseDown(seasonTab)
    }
    expect(document.querySelector(".todo-period-nav span")).toHaveTextContent("Quarter 2026 Q3 (Fall)")
  })
})
