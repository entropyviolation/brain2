/**
 * EnhancedScheduler — smoke + scheduling behavior tests.
 */
import { render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { resetLocalStorage } from "@/tests/test-utils"
import { useTaskStore } from "@/lib/task-store"
import type { Task, List } from "@/lib/types"
import { EnhancedScheduler } from "./enhanced-scheduler"

vi.mock("@/components/task-detail-popup", () => ({
  TaskDetailPopup: () => null,
}))

describe("EnhancedScheduler", () => {
  const list: List = {
    id: "work",
    name: "Work",
    color: "#2563eb",
    description: "Work list",
    createdAt: new Date("2026-06-01"),
    order: 0,
    scheduleable: true,
  }

  const unscheduledTask: Task = {
    id: "task-unscheduled",
    description: "Plan quarterly review",
    stage: "list",
    createdAt: new Date("2026-06-01"),
    completed: false,
    lists: ["work"],
    estimatedDuration: 45,
    urgency: 3,
    importance: 5,
    dependencies: [],
    rewardValue: 50,
  }

  beforeEach(() => {
    resetLocalStorage()
    useTaskStore.setState({
      tasks: [unscheduledTask],
      lists: [list],
      folders: [],
    })
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it("renders the scheduler heading and period tabs", () => {
    render(<EnhancedScheduler />)

    expect(screen.getByRole("heading", { name: "Enhanced Scheduler" })).toBeInTheDocument()
    const tabs = within(screen.getByRole("tablist")).getAllByRole("tab")
    expect(tabs.map((t) => t.textContent)).toEqual(["Always", "Year", "Month", "Week", "Day"])
    expect(screen.getByText("Available Tasks")).toBeInTheDocument()
    expect(screen.getByText("Plan quarterly review")).toBeInTheDocument()
  })

  it("schedules a selected task when an overview box is clicked", async () => {
    const user = userEvent.setup()
    render(<EnhancedScheduler />)

    const taskRow = screen.getByText("Plan quarterly review").closest(".task-item")
    expect(taskRow).toBeTruthy()
    const checkbox = within(taskRow as HTMLElement).getByRole("checkbox")
    await user.click(checkbox)

    const thisYearCard = screen.getByText("This Year").closest("[class*='cursor-pointer']")
    expect(thisYearCard).toBeTruthy()
    await user.click(thisYearCard!)

    const year = new Date().getFullYear().toString()
    const updated = useTaskStore.getState().tasks.find((t) => t.id === "task-unscheduled")
    expect(updated?.scheduledYear).toBe(year)
    expect(updated?.scheduledMonth).toBeUndefined()
    expect(updated?.scheduledWeek).toBeUndefined()
    expect(updated?.scheduledDate).toBeUndefined()
  })
})
