/**
 * EnhancedScheduler — chrome + scheduling behavior tests.
 */
import { render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { resetLocalStorage } from "@/tests/test-utils"
import { useTaskStore } from "@/lib/task-store"
import type { Task, List } from "@/lib/types"
import { EnhancedScheduler } from "./enhanced-scheduler"

vi.mock("@/components/ItemDetail/ItemDetailPopup", () => ({
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

  it("renders window chrome, view modes, and period tabs", () => {
    render(<EnhancedScheduler />)

    expect(screen.queryByRole("heading", { name: "Enhanced Scheduler" })).not.toBeInTheDocument()
    expect(screen.getByRole("heading", { name: "Scheduler — Funnel" })).toBeInTheDocument()

    const viewbar = screen.getByRole("toolbar", { name: "Scheduler view" })
    expect(within(viewbar).getByRole("button", { name: "Funnel" })).toHaveAttribute("aria-pressed", "true")
    expect(within(viewbar).getByRole("button", { name: "Gantt" })).toHaveAttribute("aria-pressed", "false")
    expect(within(viewbar).getByRole("button", { name: "Dependencies" })).toHaveAttribute("aria-pressed", "false")

    const tabs = within(screen.getByRole("tablist")).getAllByRole("tab")
    expect(tabs.map((t) => t.textContent)).toEqual(["Always", "Year", "Month", "Week", "Day"])
    expect(screen.getByText("Available Tasks")).toBeInTheDocument()
    expect(screen.getByText("Plan quarterly review")).toBeInTheDocument()
    expect(screen.getByText("Plan quarterly review").closest(".task-item")?.querySelector("img.sch-task-orb")).toBeTruthy()
  })

  it("keeps empty buckets as reserved one-line furniture", () => {
    render(<EnhancedScheduler />)

    for (const label of ["This Year", "This Month", "Next Month", "This Week", "Next Week", "Today", "Tomorrow"]) {
      expect(screen.getByText(label)).toBeInTheDocument()
    }
    expect(screen.queryByText("Empty")).not.toBeInTheDocument()
    expect(screen.queryByText(/0 · Empty/)).not.toBeInTheDocument()
    const buckets = document.querySelectorAll(".sch-bucket")
    expect(buckets.length).toBe(7)
    buckets.forEach((bucket) => {
      expect(bucket.querySelector(".sch-bucket-line")).toBeTruthy()
      expect(bucket.querySelector(".sch-bucket-body")).toBeNull()
    })
  })

  it("hides period tabs when a document view is selected", async () => {
    const user = userEvent.setup()
    render(<EnhancedScheduler />)

    await user.click(screen.getByRole("button", { name: "Gantt" }))
    expect(screen.getByRole("heading", { name: "Scheduler — Gantt" })).toBeInTheDocument()
    expect(screen.queryByRole("tablist")).not.toBeInTheDocument()
    expect(screen.getByRole("toolbar", { name: "Scheduler view" })).toBeInTheDocument()
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
