import { fireEvent, render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { resetAllStores } from "@/tests/test-utils"
import { useTaskStore } from "@/lib/task-store"
import { getScheduleableCategoryIds, isTaskScheduleable } from "@/components/Scheduler/scheduler-utils"
import { TodoPanel } from "./todo-panel"

vi.mock("@/components/task-detail-popup", () => ({
  TaskDetailPopup: () => null,
}))

describe("TodoPanel", () => {
  const today = new Date("2026-06-20T12:00:00")

  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(today)
    resetAllStores()
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
    vi.useRealTimers()
  })

  it("renders todo panel header and day tab", () => {
    render(<TodoPanel />)
    expect(screen.getByText("To Do")).toBeInTheDocument()
    expect(screen.getByText("Today's Tasks")).toBeInTheDocument()
    expect(screen.getByText("Finish slides")).toBeInTheDocument()
    expect(screen.getByLabelText("Sort")).toBeInTheDocument()
    expect(screen.getByLabelText("Sort ascending")).toBeInTheDocument()
  })

  it("defaults to tier order so higher tiers appear first", () => {
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
    fireEvent.click(screen.getByLabelText("Sort"))
    fireEvent.click(screen.getByRole("option", { name: "Name" }))
    const apple = screen.getByText("Apple")
    const zebra = screen.getByText("Zebra")
    expect(apple.compareDocumentPosition(zebra) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()

    fireEvent.click(screen.getByLabelText("Sort ascending"))
    expect(screen.getByLabelText("Sort descending")).toBeInTheDocument()
    expect(zebra.compareDocumentPosition(apple) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  })

  it("marks a task complete when the complete action is clicked", () => {
    render(<TodoPanel />)
    screen.getByTitle("Mark complete").click()
    const updated = useTaskStore.getState().tasks[0]
    expect(updated.completed).toBe(true)
    expect(updated.completedDate).toBeTruthy()
  })

  it("shows a collapsible done section for the active period", () => {
    useTaskStore.getState().setTasks([
      {
        id: "done-1",
        description: "Shipped hotfix",
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
})
