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

  const unscheduledTaskB: Task = {
    id: "task-unscheduled-b",
    description: "Draft agenda",
    stage: "list",
    createdAt: new Date("2026-06-01"),
    completed: false,
    lists: ["work"],
    estimatedDuration: 30,
    urgency: 2,
    importance: 4,
    dependencies: [],
    rewardValue: 20,
  }

  beforeEach(() => {
    resetLocalStorage()
    useTaskStore.setState({
      tasks: [unscheduledTask, unscheduledTaskB],
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

  it("lays Always out as two columns of drop cards, including Eventually / Later", () => {
    render(<EnhancedScheduler />)

    for (const label of [
      "This Year",
      "This Month",
      "Next Month",
      "This Week",
      "Next Week",
      "Today",
      "Tomorrow",
      "Eventually / Later",
    ]) {
      expect(screen.getByText(label)).toBeInTheDocument()
    }
    const board = document.querySelector(".sch-always-cards")
    expect(board).toBeTruthy()
    const buckets = board!.querySelectorAll(".sch-bucket-card")
    expect(buckets.length).toBe(8)
    buckets.forEach((bucket) => {
      expect(bucket.querySelector(".sch-bucket-empty")?.textContent).toBe("Empty")
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

  it("pins a selected task to today's local date", async () => {
    const user = userEvent.setup()
    render(<EnhancedScheduler />)

    const taskRow = screen.getByText("Plan quarterly review").closest(".task-item")
    await user.click(within(taskRow as HTMLElement).getByRole("checkbox"))
    const todayCard = screen.getByText("Today").closest(".sch-bucket-card")
    await user.click(todayCard!)

    const updated = useTaskStore.getState().tasks.find((t) => t.id === "task-unscheduled")
    const scheduled = updated?.scheduledDate
    expect(scheduled).toBeInstanceOf(Date)
    expect(scheduled?.getFullYear()).toBe(new Date().getFullYear())
    expect(scheduled?.getMonth()).toBe(new Date().getMonth())
    expect(scheduled?.getDate()).toBe(new Date().getDate())
    expect(updated?.scheduledYear).toBeUndefined()
  })

  it("files a selected task on an autocreated eventually list without a period", async () => {
    const user = userEvent.setup()
    render(<EnhancedScheduler />)

    const taskRow = screen.getByText("Plan quarterly review").closest(".task-item")
    await user.click(within(taskRow as HTMLElement).getByRole("checkbox"))
    const later = screen.getByText("Eventually / Later").closest(".sch-bucket-card")
    await user.click(later!)

    const state = useTaskStore.getState()
    const list = state.lists.find((l) => l.name === "eventually")
    expect(list).toBeTruthy()
    const folder = state.folders.find((f) => f.name === "Next Actions")
    expect(folder?.listIds).toContain(list!.id)
    const updated = state.tasks.find((t) => t.id === "task-unscheduled")
    expect(updated?.lists).toContain(list!.id)
    expect(updated?.scheduledDate).toBeUndefined()
    expect(updated?.scheduledYear).toBeUndefined()
    expect(updated?.scheduledMonth).toBeUndefined()
    expect(updated?.scheduledWeek).toBeUndefined()
    expect(screen.getByText("Plan quarterly review").closest(".sch-bucket-card")).toHaveTextContent("Eventually / Later")
  })

  it("shows Deselect all beside Remove from Scheduler and clears selection only", async () => {
    const user = userEvent.setup()
    render(<EnhancedScheduler />)

    const taskRow = screen.getByText("Plan quarterly review").closest(".task-item")
    await user.click(within(taskRow as HTMLElement).getByRole("checkbox"))

    expect(screen.getByText("1 selected")).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Deselect all" })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Remove from Scheduler" })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Delete" })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Mark complete" })).toBeInTheDocument()

    await user.click(screen.getByRole("button", { name: "Deselect all" }))

    expect(screen.queryByText("1 selected")).not.toBeInTheDocument()
    expect(screen.queryByRole("button", { name: "Deselect all" })).not.toBeInTheDocument()
    const stillAvailable = useTaskStore.getState().tasks.find((t) => t.id === "task-unscheduled")
    expect(stillAvailable?.scheduleable).not.toBe(false)
    expect(stillAvailable?.scheduledYear).toBeUndefined()
    expect(screen.getByText("Plan quarterly review")).toBeInTheDocument()
  })

  it("awards one scheduling point when a task lands in a new period bucket", async () => {
    const user = userEvent.setup()
    const { usePointsStore } = await import("@/lib/points-store")
    usePointsStore.setState({ pointsHistory: [] })
    render(<EnhancedScheduler />)

    const taskRow = screen.getByText("Plan quarterly review").closest(".task-item")
    await user.click(within(taskRow as HTMLElement).getByRole("checkbox"))
    await user.click(screen.getByText("This Year").closest(".sch-bucket-card")!)

    const points = usePointsStore.getState().pointsHistory.filter((e) => e.taskId === "task-unscheduled")
    expect(points).toHaveLength(1)
    expect(points[0]?.points).toBe(1)
    expect(points[0]?.taskDescription).toBe("Plan quarterly review scheduled")

    // Same bucket again after re-selecting from the year card should not double-award.
    // Re-schedule via Always is cleared; click This Year on an already-year task via Year tab path:
    // place onto This Year again from available is empty. Drop the same year via store check:
    const year = new Date().getFullYear().toString()
    const before = useTaskStore.getState().tasks.find((t) => t.id === "task-unscheduled")!
    expect(before.scheduledYear).toBe(year)
    const { earnsSchedulePoint } = await import("@/lib/schedule-credit")
    expect(earnsSchedulePoint(before, "year", year)).toBe(false)
  })

  it("does not award a scheduling point for Eventually / Later", async () => {
    const user = userEvent.setup()
    const { usePointsStore } = await import("@/lib/points-store")
    usePointsStore.setState({ pointsHistory: [] })
    render(<EnhancedScheduler />)

    const taskRow = screen.getByText("Plan quarterly review").closest(".task-item")
    await user.click(within(taskRow as HTMLElement).getByRole("checkbox"))
    await user.click(screen.getByText("Eventually / Later").closest(".sch-bucket-card")!)

    expect(usePointsStore.getState().pointsHistory.filter((e) => e.taskId === "task-unscheduled")).toHaveLength(0)
  })

  it("schedules every selected task when an overview box is clicked", async () => {
    const user = userEvent.setup()
    render(<EnhancedScheduler />)

    for (const title of ["Plan quarterly review", "Draft agenda"]) {
      const row = screen.getByText(title).closest(".task-item")
      await user.click(within(row as HTMLElement).getByRole("checkbox"))
    }
    expect(screen.getByText("2 selected")).toBeInTheDocument()

    const nextMonth = screen.getByText("Next Month").closest(".sch-bucket-card")
    await user.click(nextMonth!)

    const state = useTaskStore.getState()
    const a = state.tasks.find((t) => t.id === "task-unscheduled")
    const b = state.tasks.find((t) => t.id === "task-unscheduled-b")
    expect(a?.scheduledMonth).toBeTruthy()
    expect(b?.scheduledMonth).toBe(a?.scheduledMonth)
    expect(screen.queryByText("2 selected")).not.toBeInTheDocument()
  })

  it("Mark complete finishes the selection without leaving checks", async () => {
    const user = userEvent.setup()
    render(<EnhancedScheduler />)

    const taskRow = screen.getByText("Plan quarterly review").closest(".task-item")
    await user.click(within(taskRow as HTMLElement).getByRole("checkbox"))
    await user.click(screen.getByRole("button", { name: "Mark complete" }))

    const done = useTaskStore.getState().tasks.find((t) => t.id === "task-unscheduled")
    expect(done?.completed).toBe(true)
    expect(screen.queryByText("1 selected")).not.toBeInTheDocument()
    expect(screen.queryByText("Plan quarterly review")).not.toBeInTheDocument()
  })
})
