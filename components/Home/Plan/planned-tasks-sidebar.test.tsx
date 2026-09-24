import { fireEvent, render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { resetAllStores } from "@/tests/test-utils"
import { useTaskStore } from "@/lib/task-store"
import { useHabitsStore } from "@/lib/habits-store"
import { useSleepStore } from "@/lib/sleep-store"
import { TaskType } from "@/lib/types"
import { getWeekString } from "@/lib/date-utils"
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
    expect(screen.getByLabelText("Add a to-do for this month")).toBeInTheDocument()
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

  it("day rail lists only daily habits that are still incomplete for that day", () => {
    useHabitsStore.getState().setTasks([
      { id: "open-daily", name: "Drink water", type: TaskType.BOOLEAN, rewardValue: 10, frequency: "daily" },
      { id: "done-daily", name: "Stretch", type: TaskType.BOOLEAN, rewardValue: 10, frequency: "daily" },
      { id: "weekly-habit", name: "Deep clean", type: TaskType.BOOLEAN, rewardValue: 10, frequency: "weekly" },
    ])
    useHabitsStore.getState().setWeeklyData({
      "2026-06-20": {
        "done-daily": { completed: true },
      },
    })

    render(<PlannedTasksSidebar mode="day" currentDate={currentDate} onTaskClick={vi.fn()} />)

    expect(screen.getByText("Drink water")).toBeInTheDocument()
    expect(screen.queryByText("Stretch")).not.toBeInTheDocument()
    expect(screen.queryByText("Deep clean")).not.toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Habits (1)" })).toBeInTheDocument()
    const habitRow = screen.getByText("Drink water").closest(".plan-rail-item")
    expect(habitRow?.querySelector("img.plan-rail-gem")).toBeTruthy()
  })

  it("keeps an empty rail without a ghost illustration", () => {
    render(<PlannedTasksSidebar mode="month" currentDate={currentDate} onTaskClick={vi.fn()} />)
    expect(screen.getByText("Planned This Month")).toBeInTheDocument()
    expect(screen.queryByText("Nothing to plan here")).not.toBeInTheDocument()
    expect(screen.getByText("0m planned · waking window unknown")).toBeInTheDocument()
    expect(document.querySelectorAll(".plan-pip")).toHaveLength(10)
    expect(document.querySelectorAll('.plan-pip[data-on="true"]')).toHaveLength(0)
  })

  it("shows planned minutes against that day's waking window", () => {
    useSleepStore.setState({
      nights: {
        "2026-06-20": { date: "2026-06-20", wokeMin: 8 * 60 },
        "2026-06-21": { date: "2026-06-21", sleptMin: 17 * 60 - 1440 },
      },
    })
    useTaskStore.getState().setTasks([
      {
        id: "long-day",
        description: "Deep work",
        stage: "scheduled",
        createdAt: currentDate,
        completed: false,
        scheduledDate: currentDate,
        lists: [],
        urgency: 3,
        importance: 3,
        estimatedDuration: 11 * 60,
        cognitiveLoad: 2,
        dependencies: [],
        context: "@work",
        entropy: 0.5,
        rewardValue: 5,
        allowPartialCompletion: false,
        minimumChunkSize: 15,
      },
    ])

    render(<PlannedTasksSidebar mode="day" currentDate={currentDate} onTaskClick={vi.fn()} />)
    expect(screen.getByText("11h into a 9h window")).toBeInTheDocument()
    expect(document.querySelectorAll('.plan-pip[data-on="true"]')).toHaveLength(10)
  })

  it("week rail lists incomplete weekly habits and week-planned todos", () => {
    useHabitsStore.getState().setTasks([
      { id: "weekly-open", name: "Deep clean", type: TaskType.BOOLEAN, rewardValue: 10, frequency: "weekly" },
      { id: "weekly-done", name: "Review notes", type: TaskType.BOOLEAN, rewardValue: 10, frequency: "weekly" },
      { id: "daily-habit", name: "Drink water", type: TaskType.BOOLEAN, rewardValue: 10, frequency: "daily" },
    ])
    const weekKey = getWeekString(currentDate)
    useHabitsStore.setState({
      weeklyHabitData: {
        [weekKey]: { "weekly-done": { completed: true } },
      },
    })
    useTaskStore.getState().setTasks([
      {
        id: "week-todo",
        description: "Write setlist",
        stage: "scheduled",
        createdAt: currentDate,
        completed: false,
        scheduledWeek: weekKey,
        lists: [],
        urgency: 3,
        importance: 3,
        estimatedDuration: 45,
        cognitiveLoad: 2,
        dependencies: [],
        context: "@tour",
        entropy: 0.5,
        rewardValue: 5,
        allowPartialCompletion: false,
        minimumChunkSize: 15,
      },
    ])

    render(<PlannedTasksSidebar mode="week" currentDate={currentDate} onTaskClick={vi.fn()} />)
    expect(screen.getByText("Deep clean")).toBeInTheDocument()
    expect(screen.queryByText("Review notes")).not.toBeInTheDocument()
    expect(screen.queryByText("Drink water")).not.toBeInTheDocument()
    expect(screen.getByText("Write setlist")).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Habits (1)" })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "To Do (1)" })).toBeInTheDocument()
    expect(screen.getByText("Write setlist").closest(".plan-rail-item")?.querySelector("img.plan-rail-gem")).toBeTruthy()
    expect(screen.getByText("Deep clean").closest(".plan-rail-item")?.querySelector("img.plan-rail-gem")).toBeTruthy()
  })

  it("month rail lists incomplete monthly habits", () => {
    useHabitsStore.getState().setTasks([
      { id: "month-open", name: "Pay rent", type: TaskType.BOOLEAN, rewardValue: 10, frequency: "monthly" },
      { id: "month-done", name: "Budget", type: TaskType.BOOLEAN, rewardValue: 10, frequency: "monthly" },
    ])
    useHabitsStore.setState({
      monthlyHabitData: {
        "2026-06": { "month-done": { completed: true } },
      },
    })

    render(<PlannedTasksSidebar mode="month" currentDate={currentDate} onTaskClick={vi.fn()} />)
    expect(screen.getByText("Pay rent")).toBeInTheDocument()
    expect(screen.queryByText("Budget")).not.toBeInTheDocument()
    expect(screen.getByLabelText("Add a to-do for this month")).toBeInTheDocument()
  })

  it("adds a week to-do that Home/To-Do lists for the same week", async () => {
    const user = userEvent.setup()
    render(<PlannedTasksSidebar mode="week" currentDate={currentDate} onTaskClick={vi.fn()} />)

    await user.type(screen.getByLabelText("Add a to-do for this week"), "pack merch")
    await user.click(screen.getByRole("button", { name: "Add to-do" }))

    expect(screen.getByText("pack merch")).toBeInTheDocument()
    const created = useTaskStore.getState().tasks.find((t) => t.description === "pack merch")
    expect(created?.scheduledWeek).toBe(getWeekString(currentDate))
    expect(created?.scheduledDate).toBeUndefined()

    const weekItems = filterAndSortTodos(
      buildTodoItems(useTaskStore.getState().tasks, false, currentDate),
      "week",
      false,
      currentDate,
    )
    expect(weekItems.map((i) => i.description)).toContain("pack merch")
  })

  it("search, sort, and filters apply on the rail", async () => {
    const user = userEvent.setup()
    const onTaskClick = vi.fn()
    useTaskStore.getState().setTasks([
      {
        id: "alpha",
        description: "Alpha packing",
        stage: "scheduled",
        createdAt: new Date("2026-06-01T12:00:00"),
        completed: false,
        scheduledMonth: "2026-06",
        lists: [],
        urgency: 3,
        importance: 3,
        estimatedDuration: 10,
        cognitiveLoad: 2,
        dependencies: [],
        context: "@work",
        entropy: 0.5,
        rewardValue: 5,
        allowPartialCompletion: false,
        minimumChunkSize: 15,
      },
      {
        id: "zeta",
        description: "Zeta merch",
        stage: "scheduled",
        createdAt: new Date("2026-06-10T12:00:00"),
        completed: false,
        scheduledMonth: "2026-06",
        lists: [],
        urgency: 3,
        importance: 3,
        estimatedDuration: 90,
        cognitiveLoad: 2,
        dependencies: [],
        context: "@tour",
        entropy: 0.5,
        rewardValue: 5,
        allowPartialCompletion: false,
        minimumChunkSize: 15,
      },
    ])
    useHabitsStore.getState().setTasks([
      { id: "month-habit", name: "Pay rent", type: TaskType.BOOLEAN, rewardValue: 10, frequency: "monthly" },
    ])

    render(<PlannedTasksSidebar mode="month" currentDate={currentDate} onTaskClick={onTaskClick} />)

    expect(screen.getByText("Alpha packing")).toBeInTheDocument()
    expect(screen.getByText("Pay rent")).toBeInTheDocument()

    await user.type(screen.getByLabelText("Search planned items"), "zeta")
    expect(screen.getByText("Zeta merch")).toBeInTheDocument()
    expect(screen.queryByText("Alpha packing")).not.toBeInTheDocument()
    expect(screen.queryByText("Pay rent")).not.toBeInTheDocument()

    await user.clear(screen.getByLabelText("Search planned items"))
    await user.selectOptions(screen.getByLabelText("Sort planned items"), "duration")
    const titles = [...document.querySelectorAll(".plan-rail-item .plan-rail-title")].map((el) =>
      el.childNodes[0]?.textContent?.trim(),
    )
    expect(titles.filter(Boolean).slice(-2)).toEqual(["Alpha packing", "Zeta merch"])

    await user.click(screen.getByRole("button", { name: "Habits (1)" }))
    expect(screen.queryByText("Pay rent")).not.toBeInTheDocument()
    expect(screen.getByText("Alpha packing")).toBeInTheDocument()

    await user.click(screen.getByText("Zeta merch"))
    expect(onTaskClick).toHaveBeenCalledWith("zeta")
  })

  it("makes undone daily habits draggable with a plan-drag payload", () => {
    useHabitsStore.getState().setTasks([
      { id: "habit-walk", name: "Walk", type: TaskType.BOOLEAN, rewardValue: 10, frequency: "daily" },
      { id: "habit-done", name: "Floss", type: TaskType.BOOLEAN, rewardValue: 10, frequency: "daily" },
    ])
    useHabitsStore.setState({
      weeklyData: {
        "2026-06-20": { "habit-done": { completed: true } },
      },
    })

    render(<PlannedTasksSidebar mode="day" currentDate={currentDate} onTaskClick={vi.fn()} />)
    const walk = screen.getByText("Walk").closest(".plan-rail-item")
    expect(walk).toHaveAttribute("draggable", "true")
    expect(walk?.querySelector(".plan-rail-handle")).toBeTruthy()
    expect(screen.queryByText("Floss")).not.toBeInTheDocument()

    const bag: Record<string, string> = {}
    fireEvent.dragStart(walk!, {
      dataTransfer: {
        setData: (type: string, value: string) => {
          bag[type] = value
        },
        getData: (type: string) => bag[type] ?? "",
        effectAllowed: "none",
      },
    })
    expect(bag["text/plain"]).toBe("brain2-plan:habit:habit-walk")
  })

  it("lists searchable Next actions from Lists membership for the period", async () => {
    const user = userEvent.setup()
    useTaskStore.getState().setFolders([
      { id: "folder-next-actions", name: "Next Actions", createdAt: currentDate, listIds: ["na"] },
    ])
    useTaskStore.getState().setTasks([
      {
        id: "na-open",
        description: "Ship liner notes",
        stage: "list",
        type: "task",
        createdAt: currentDate,
        completed: false,
        lists: ["na"],
        urgency: 3,
        importance: 3,
        estimatedDuration: 20,
        cognitiveLoad: 2,
        dependencies: [],
        context: "@tour",
        entropy: 0.5,
        rewardValue: 5,
        allowPartialCompletion: false,
        minimumChunkSize: 15,
      },
    ])

    render(<PlannedTasksSidebar mode="day" currentDate={currentDate} onTaskClick={vi.fn()} />)
    expect(screen.getByRole("button", { name: "Next actions (1)" })).toBeInTheDocument()
    expect(screen.getByText("Ship liner notes")).toBeInTheDocument()
    const row = screen.getByText("Ship liner notes").closest(".plan-rail-item")
    expect(row).toHaveAttribute("data-kind", "next-action")
    expect(row).toHaveAttribute("draggable", "true")
    const orb = row?.querySelector("img.plan-rail-gem") as HTMLImageElement | null
    expect(orb).toBeTruthy()
    expect(orb?.getAttribute("src")).toBeTruthy()

    await user.type(screen.getByLabelText("Search planned items"), "missing")
    expect(screen.queryByText("Ship liner notes")).not.toBeInTheDocument()
  })

  it("renders a Lists orb on To Do rows", () => {
    useTaskStore.getState().setTasks([
      {
        id: "day-todo",
        description: "Call dentist",
        stage: "scheduled",
        createdAt: currentDate,
        completed: false,
        scheduledDate: currentDate,
        lists: [],
        urgency: 3,
        importance: 3,
        estimatedDuration: 30,
        cognitiveLoad: 2,
        dependencies: [],
        context: "@home",
        entropy: 0.5,
        rewardValue: 5,
        allowPartialCompletion: false,
        minimumChunkSize: 15,
        icon: "/orbs-removebackground/custom-orb.png",
      },
    ])

    render(<PlannedTasksSidebar mode="day" currentDate={currentDate} onTaskClick={vi.fn()} />)
    const row = screen.getByText("Call dentist").closest(".plan-rail-item")
    expect(row).toHaveAttribute("data-kind", "todo")
    const orb = row?.querySelector("img.plan-rail-gem") as HTMLImageElement | null
    expect(orb).toBeTruthy()
    expect(orb?.getAttribute("src")).toBe("/orbs-removebackground/custom-orb.png")
  })

  it("double-clicks a daily habit to open detail without dropping drag", async () => {
    const user = userEvent.setup()
    const onTaskClick = vi.fn()
    useHabitsStore.getState().setTasks([
      { id: "habit-walk", name: "Walk", type: TaskType.BOOLEAN, rewardValue: 10, frequency: "daily" },
    ])

    render(<PlannedTasksSidebar mode="day" currentDate={currentDate} onTaskClick={onTaskClick} />)
    const walk = screen.getByText("Walk").closest(".plan-rail-item")!
    expect(walk).toHaveAttribute("draggable", "true")

    await user.dblClick(walk)
    expect(onTaskClick).toHaveBeenCalledWith("habit-walk")

    const bag: Record<string, string> = {}
    fireEvent.dragStart(walk, {
      dataTransfer: {
        setData: (type: string, value: string) => {
          bag[type] = value
        },
        getData: (type: string) => bag[type] ?? "",
        effectAllowed: "none",
      },
    })
    expect(bag["text/plain"]).toBe("brain2-plan:habit:habit-walk")
  })
})
