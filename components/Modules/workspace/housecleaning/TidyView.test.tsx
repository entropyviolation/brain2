/**
 * TidyView — smoke test for the House Cleaning App workspace view.
 */
import { render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it, vi } from "vitest"
import { seedHouseCleaning, blankHouseCleaning, emptyPlan, planAdd, startPlan } from "@/lib/house-cleaning"
import type { ModuleInstance } from "@/lib/modules-store"
import { TidyView } from "./TidyView"

const module: ModuleInstance = {
  id: "mod-tidy-test",
  type: "workspace",
  kind: "workspace",
  title: "Tidy",
  config: { houseCleaning: seedHouseCleaning(1) },
  views: [{ id: "v1", title: "Tidy", kind: "house-cleaning", config: {} }],
}

describe("TidyView", () => {
  it("renders the Tidy home with area cards, stuck, and plan actions", () => {
    render(<TidyView module={module} />)
    expect(screen.getByRole("heading", { name: "Tidy" })).toBeInTheDocument()
    expect(screen.getByText("Kitchen")).toBeInTheDocument()
    expect(screen.getByText("Living Room")).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Stuck" })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Create a plan" })).toBeInTheDocument()
    expect(screen.getByText("Whole house")).toBeInTheDocument()
    expect(screen.getByText("Needed")).toBeInTheDocument()
    const sidequest = screen.getByRole("button", { name: "Sidequest unlocked" })
    expect(sidequest).toBeInTheDocument()
    expect(sidequest).toBeDisabled()
  })

  it("opens an area and shows seeded chores", async () => {
    const user = userEvent.setup()
    render(<TidyView module={module} />)
    await user.click(screen.getByText("Kitchen", { selector: ".name" }))
    expect(screen.getByRole("heading", { name: "Kitchen" })).toBeInTheDocument()
    expect(screen.getByText("Do dishes")).toBeInTheDocument()
    expect(screen.getByText("Clear counters")).toBeInTheDocument()
  })

  it("starts stuck mode from the home CTA", async () => {
    const user = userEvent.setup()
    render(<TidyView module={module} />)
    await user.click(screen.getByRole("button", { name: "Stuck" }))
    expect(screen.getByRole("dialog")).toBeInTheDocument()
    expect(screen.getByRole("button", { name: /Start|Resume/i })).toBeInTheDocument()
  })

  it("lets you add a subarea and start a perfect session with a checklist", async () => {
    const user = userEvent.setup()
    render(<TidyView module={module} />)
    await user.click(screen.getByText("Kitchen", { selector: ".name" }))
    expect(screen.getByRole("heading", { name: "Subareas" })).toBeInTheDocument()
    await user.type(screen.getByPlaceholderText(/Add a subarea/), "Sink")
    await user.click(screen.getByRole("button", { name: "Add subarea" }))
    expect(screen.getByText("Sink")).toBeInTheDocument()
    await user.click(screen.getByRole("button", { name: "Perfect" }))
    const dialog = screen.getByRole("dialog")
    expect(dialog).toBeInTheDocument()
    expect(screen.getByRole("heading", { name: "Perfect the Sink" })).toBeInTheDocument()
    expect(screen.getByText("Perfect", { selector: ".eyebrow" })).toBeInTheDocument()
    expect(screen.getByText(/Get through every stop at the bar/)).toBeInTheDocument()
    expect(screen.getByRole("progressbar", { name: "Checklist progress" })).toHaveAttribute("aria-valuenow", "100")
    expect(screen.getByRole("button", { name: "Next" })).toBeEnabled()
    expect(screen.getByText(/Bar \d+%/)).toBeInTheDocument()
    expect(screen.getByText(/Banked 0%/)).toBeInTheDocument()
    expect(screen.getByText(/Next at \d+%/)).toBeInTheDocument()
    expect(screen.getByText(/Now 100%/)).toBeInTheDocument()
    await user.type(screen.getByPlaceholderText(/What this spot needs/), "Clear the drain")
    await user.click(screen.getByRole("button", { name: "Add to list" }))
    expect(screen.getByText("Clear the drain")).toBeInTheDocument()
    expect(screen.getByText(/Next at \d+%/)).toBeInTheDocument()
    expect(screen.getByRole("progressbar", { name: "Checklist progress" })).toHaveAttribute("aria-valuenow", "0")
    expect(screen.getByRole("button", { name: "Next" })).toBeDisabled()
    await user.click(screen.getByRole("button", { name: "Mark Clear the drain done" }))
    expect(screen.getByRole("progressbar", { name: "Checklist progress" })).toHaveAttribute("aria-valuenow", "100")
    expect(screen.getByRole("button", { name: "Next" })).toBeEnabled()
    await user.click(screen.getByRole("button", { name: "Next" }))
    expect(screen.getByRole("dialog")).toBeInTheDocument()
    expect(screen.queryByRole("heading", { name: "Perfect the Sink" })).not.toBeInTheDocument()
  })

  it("lets you add subtasks under a perfect checklist item", async () => {
    const user = userEvent.setup()
    render(<TidyView module={module} />)
    await user.click(screen.getByText("Kitchen", { selector: ".name" }))
    await user.type(screen.getByPlaceholderText(/Add a subarea/), "Sink")
    await user.click(screen.getByRole("button", { name: "Add subarea" }))
    await user.click(screen.getByRole("button", { name: "Perfect" }))
    await user.type(screen.getByPlaceholderText(/What this spot needs/), "Clear the drain")
    await user.click(screen.getByRole("button", { name: "Add to list" }))
    await user.click(screen.getByRole("button", { name: "Add subtask under Clear the drain" }))
    const subInput = screen.getByPlaceholderText("Add a subtask…")
    await user.type(subInput, "Scrub the rim")
    await user.click(within(subInput.closest("form") as HTMLElement).getByRole("button", { name: "Add" }))
    expect(screen.getByText("Scrub the rim")).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Next" })).toBeDisabled()
    expect(screen.getByRole("progressbar", { name: "Checklist progress" })).toHaveAttribute("aria-valuenow", "0")
    await user.click(screen.getByRole("button", { name: "Mark Scrub the rim done" }))
    expect(screen.getByRole("button", { name: "Next" })).toBeEnabled()
    expect(screen.getByRole("progressbar", { name: "Checklist progress" })).toHaveAttribute("aria-valuenow", "100")
  })

  it("unlocks Next at the bar and shows banked extra, without requiring 100%", () => {
    const checks = Array.from({ length: 10 }, (_, i) => ({
      id: `c${i}`,
      title: `Item ${i + 1}`,
      done: i < 4,
    }))
    const house = {
      ...blankHouseCleaning(),
      subareas: [{ id: "sa1", areaId: "kitchen", name: "Sink", done: false, createdAt: 1, checks }],
      subareaSession: {
        areaId: "kitchen",
        bank: 30,
        index: 0,
        phase: "task" as const,
        items: [
          {
            kind: "perfect" as const,
            subareaId: "sa1",
            title: "Perfect the Sink",
            checks,
            threshold: 60,
          },
        ],
      },
    }
    render(<TidyView module={{ ...module, config: { houseCleaning: house } }} />)
    expect(screen.getByRole("heading", { name: "Perfect the Sink" })).toBeInTheDocument()
    expect(screen.getByText(/Bar 60%/)).toBeInTheDocument()
    expect(screen.getByText(/Banked 30%/)).toBeInTheDocument()
    expect(screen.getAllByText(/Next at 30%/).length).toBeGreaterThanOrEqual(1)
    expect(screen.getByText(/Now 40%/)).toBeInTheDocument()
    expect(screen.getByText("60% − 30% = Next at 30%")).toBeInTheDocument()
    expect(screen.getByRole("progressbar", { name: "Checklist progress" })).toHaveAttribute("aria-valuenow", "40")
    expect(screen.getByRole("button", { name: "Next" })).toBeEnabled()
    expect(screen.getByText(/Get through every stop at the bar/)).toBeInTheDocument()
  })

  it("shows a Sidequests section on an area and can add one", async () => {
    const user = userEvent.setup()
    render(<TidyView module={module} />)
    await user.click(screen.getByText("Kitchen", { selector: ".name" }))
    expect(screen.getByRole("heading", { name: "Sidequests" })).toBeInTheDocument()
    const input = screen.getByPlaceholderText(/Paint that mug/)
    await user.type(input, "Sort CDs alphabetically")
    await user.click(within(input.closest("form") as HTMLElement).getByRole("button", { name: "Add" }))
    expect(screen.getByText("Sort CDs alphabetically")).toBeInTheDocument()
  })

  it("hides a Perfect overlay with Esc or X without ending the session", async () => {
    const user = userEvent.setup()
    const confirm = vi.spyOn(window, "confirm").mockReturnValue(true)
    try {
      render(<TidyView module={module} />)
      await user.click(screen.getByText("Kitchen", { selector: ".name" }))
      await user.type(screen.getByPlaceholderText(/Add a subarea/), "Sink")
      await user.click(screen.getByRole("button", { name: "Add subarea" }))
      await user.click(screen.getByRole("button", { name: "Perfect" }))
      expect(screen.getByRole("dialog")).toBeInTheDocument()
      expect(screen.getByRole("heading", { name: "Perfect the Sink" })).toBeInTheDocument()

      await user.keyboard("{Escape}")
      expect(confirm).not.toHaveBeenCalled()
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
      expect(screen.getByRole("heading", { name: "Kitchen" })).toBeInTheDocument()
      expect(screen.getByRole("button", { name: "Resume" })).toBeInTheDocument()

      const taskInput = screen.getByPlaceholderText("Add a task…")
      await user.type(taskInput, "Wipe the table")
      await user.click(within(taskInput.closest("form") as HTMLElement).getByRole("button", { name: "Add" }))
      expect(screen.getByText("Wipe the table")).toBeInTheDocument()

      await user.click(screen.getByRole("button", { name: "Resume" }))
      expect(screen.getByRole("dialog")).toBeInTheDocument()
      expect(screen.getByRole("heading", { name: "Perfect the Sink" })).toBeInTheDocument()

      await user.click(screen.getByRole("button", { name: "Close" }))
      expect(confirm).not.toHaveBeenCalled()
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
      expect(screen.getByRole("button", { name: "Resume" })).toBeInTheDocument()

      await user.click(screen.getByRole("button", { name: "Resume" }))
      await user.click(screen.getByRole("button", { name: "End session" }))
      expect(confirm).toHaveBeenCalled()
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
      expect(screen.queryByRole("button", { name: "Resume" })).not.toBeInTheDocument()
      expect(screen.getByRole("heading", { name: "Kitchen" })).toBeInTheDocument()
      expect(screen.getByText("Wipe the table")).toBeInTheDocument()
    } finally {
      confirm.mockRestore()
    }
  })

  it("lets you add, edit, and delete tasks while a plan is running", async () => {
    const user = userEvent.setup()
    let house = seedHouseCleaning(1)
    const dishes = house.tasks.find((t) => t.title === "Do dishes")!
    house = { ...house, plan: emptyPlan(1) }
    house = planAdd(house, "min", dishes.id)
    house = startPlan(house, Date.now())
    render(<TidyView module={{ ...module, config: { houseCleaning: house } }} />)

    await user.click(screen.getByText("Kitchen", { selector: ".name" }))
    const addInput = screen.getByPlaceholderText("Add a task…")
    expect(addInput).toBeInTheDocument()
    const dishesRow = screen.getByText("Do dishes").closest("li") as HTMLElement
    expect(within(dishesRow).getByRole("button", { name: "Edit task" })).toBeInTheDocument()
    expect(within(dishesRow).getByRole("button", { name: "Delete" })).toBeInTheDocument()
    expect(within(dishesRow).getByRole("button", { name: "Add subtask" })).toBeInTheDocument()

    await user.type(addInput, "Wipe the fridge")
    await user.click(within(addInput.closest("form") as HTMLElement).getByRole("button", { name: "Add" }))
    expect(screen.getByText("Wipe the fridge")).toBeInTheDocument()

    const dishesAfterAdd = screen.getByText("Do dishes").closest("li") as HTMLElement
    await user.click(within(dishesAfterAdd).getByRole("button", { name: "Edit task" }))
    const titleInput = screen.getByDisplayValue("Do dishes")
    await user.clear(titleInput)
    await user.type(titleInput, "Wash dishes")
    await user.click(screen.getByRole("button", { name: "Save" }))
    expect(screen.getByText("Wash dishes")).toBeInTheDocument()

    await user.click(screen.getByRole("button", { name: "‹ Back" }))
    await user.click(screen.getByRole("button", { name: "Open plan" }))
    expect(screen.getByText("Working the plan")).toBeInTheDocument()
    expect(screen.getByRole("button", { name: /Pause/ })).toBeInTheDocument()
    expect(screen.getAllByRole("button", { name: "From lists" }).length).toBeGreaterThan(0)
    expect(screen.getAllByRole("button", { name: "New task" }).length).toBeGreaterThan(0)

    const planRow = screen.getByText("Wash dishes").closest("li") as HTMLElement
    expect(within(planRow).getByRole("button", { name: "Edit task" })).toBeInTheDocument()
    expect(within(planRow).getByRole("button", { name: "Delete" })).toBeInTheDocument()

    await user.click(screen.getAllByRole("button", { name: "New task" })[0])
    const planAddInput = screen.getByPlaceholderText("New task…")
    await user.type(planAddInput, "Spot mop")
    await user.click(within(planAddInput.closest("form") as HTMLElement).getByRole("button", { name: "Add" }))
    expect(screen.getByText("Spot mop")).toBeInTheDocument()
    expect(screen.getByRole("button", { name: /Pause/ })).toBeInTheDocument()
    expect(screen.getByText("Working the plan")).toBeInTheDocument()

    const washRow = screen.getByText("Wash dishes").closest("li") as HTMLElement
    await user.click(within(washRow).getByRole("button", { name: "Delete" }))
    expect(screen.queryByText("Wash dishes")).not.toBeInTheDocument()
    expect(screen.getByText("Spot mop")).toBeInTheDocument()
    expect(screen.getByRole("button", { name: /Pause/ })).toBeInTheDocument()
  })
})
