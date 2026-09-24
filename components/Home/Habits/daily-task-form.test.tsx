import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, describe, expect, it, vi } from "vitest"
import { GEM_PATHS } from "@/lib/gems-manifest"
import { defaultHabitGem } from "@/lib/habit-gems"
import { TaskType } from "@/lib/types"
import { TaskForm } from "./daily-task-form"

describe("TaskForm", () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it("renders the habit form fields", () => {
    render(<TaskForm onSubmit={vi.fn()} onCancel={vi.fn()} />)
    expect(screen.getByLabelText("Habit Name")).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Add Habit" })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Add Habit" })).toBeDisabled()
  })

  it("keeps the submit label readable as a default Win95 button", () => {
    render(<TaskForm onSubmit={vi.fn()} onCancel={vi.fn()} />)
    const submit = screen.getByRole("button", { name: "Add Habit" })
    expect(submit).toHaveClass("habit95-btn", "habit95-btn-default")
    expect(submit.className).not.toMatch(/gradient-primary|text-primary-foreground/)
  })

  it("submits a new habit when name is provided", async () => {
    const user = userEvent.setup()
    const onSubmit = vi.fn()
    render(<TaskForm onSubmit={onSubmit} onCancel={vi.fn()} />)

    await user.type(screen.getByLabelText("Habit Name"), "Stretch daily")
    await user.click(screen.getByRole("button", { name: "Add Habit" }))

    expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ name: "Stretch daily" }))
  })

  it("persists a random catalog gem on create without a user pick", async () => {
    vi.spyOn(Math, "random").mockReturnValue(0.01)
    const user = userEvent.setup()
    const onSubmit = vi.fn()
    render(<TaskForm onSubmit={onSubmit} onCancel={vi.fn()} />)
    await user.type(screen.getByLabelText("Habit Name"), "Language A")
    await user.click(screen.getByRole("button", { name: "Add Habit" }))
    const submitted = onSubmit.mock.calls[0][0]
    expect(GEM_PATHS).toContain(submitted.gem)
    expect(submitted.gem).not.toBe(defaultHabitGem("boolean"))
    expect(submitted.gem).toBe(GEM_PATHS[Math.floor(0.01 * GEM_PATHS.length)])
  })

  it("keeps the assigned gem when the habit type changes", async () => {
    const user = userEvent.setup()
    const onSubmit = vi.fn()
    render(<TaskForm onSubmit={onSubmit} onCancel={vi.fn()} />)
    await user.type(screen.getByLabelText("Habit Name"), "Language B")
    const before = document.querySelector(".hab-gem-slot-swatch")?.getAttribute("src")
    await user.click(screen.getByRole("radio", { name: /Goal/ }))
    expect(document.querySelector(".hab-gem-slot-swatch")?.getAttribute("src")).toBe(before)
    await user.type(screen.getByLabelText("Amount"), "10")
    await user.click(screen.getByRole("button", { name: "Add Habit" }))
    expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ name: "Language B", gem: before, type: TaskType.GOAL }))
  })

  it("can pin a habit as prioritized", async () => {
    const user = userEvent.setup()
    const onSubmit = vi.fn()
    render(<TaskForm onSubmit={onSubmit} onCancel={vi.fn()} />)

    await user.type(screen.getByLabelText("Habit Name"), "Water")
    await user.click(screen.getByLabelText("Prioritize this habit"))
    await user.click(screen.getByRole("button", { name: "Add Habit" }))

    expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ name: "Water", priorityPinned: true }))
  })

  it("reveals a numeric target when Goal type is selected", async () => {
    const user = userEvent.setup()
    render(<TaskForm onSubmit={vi.fn()} onCancel={vi.fn()} />)

    await user.click(screen.getByRole("radio", { name: /Goal/ }))
    expect(screen.getByLabelText("Amount")).toBeInTheDocument()
    expect(screen.getByLabelText("Unit (optional)")).toBeInTheDocument()
  })

  it("reveals climb cadence fields when Climb type is selected", async () => {
    const user = userEvent.setup()
    render(<TaskForm onSubmit={vi.fn()} onCancel={vi.fn()} />)

    await user.click(screen.getByRole("radio", { name: /Climb/ }))
    expect(screen.getByRole("radio", { name: /Weekly \+/ })).toBeInTheDocument()
    expect(screen.getByRole("radio", { name: /Daily \+/ })).toBeInTheDocument()
    expect(screen.getByLabelText("Starting value")).toBeInTheDocument()
    expect(screen.getByLabelText("Weekly increment")).toBeInTheDocument()
  })

  it("submits a weekly climb habit", async () => {
    const user = userEvent.setup()
    const onSubmit = vi.fn()
    render(<TaskForm onSubmit={onSubmit} onCancel={vi.fn()} />)

    await user.type(screen.getByLabelText("Habit Name"), "Meditate")
    await user.click(screen.getByRole("radio", { name: /Climb/ }))
    await user.click(screen.getByRole("button", { name: "Add Habit" }))

    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({
        name: "Meditate",
        incrementalData: expect.objectContaining({ cadence: "weekly", startValue: 2, increment: 1 }),
      }),
    )
  })

  it("persists a catalog gem on submit", async () => {
    const user = userEvent.setup()
    const onSubmit = vi.fn()
    render(<TaskForm onSubmit={onSubmit} onCancel={vi.fn()} />)
    await user.type(screen.getByLabelText("Habit Name"), "Jewel walk")
    await user.click(screen.getAllByRole("button", { name: /Change gem/i })[0])
    const option = screen.getAllByRole("option")[0]
    const src = option.querySelector("img")?.getAttribute("src")
    await user.click(option)
    await user.click(screen.getByRole("button", { name: "Add Habit" }))
    expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ name: "Jewel walk", gem: src }))
  })

  it("offers delete only while editing", async () => {
    const user = userEvent.setup()
    const onDelete = vi.fn()
    vi.spyOn(window, "confirm").mockReturnValue(true)
    const { rerender } = render(<TaskForm onSubmit={vi.fn()} onCancel={vi.fn()} />)
    expect(screen.queryByRole("button", { name: "Delete habit" })).not.toBeInTheDocument()
    rerender(
      <TaskForm
        onSubmit={vi.fn()}
        onCancel={vi.fn()}
        onDelete={onDelete}
        initialTask={{ id: "h1", name: "Stretch", type: TaskType.BOOLEAN, rewardValue: 10 }}
      />,
    )
    await user.click(screen.getByRole("button", { name: "Delete habit" }))
    expect(onDelete).toHaveBeenCalledWith("h1")
  })

  it("shows tracking auto-fill for a weekly goal habit", async () => {
    const user = userEvent.setup()
    render(<TaskForm onSubmit={vi.fn()} onCancel={vi.fn()} defaultFrequency="weekly" />)

    await user.click(screen.getByRole("radio", { name: /Goal/ }))
    expect(screen.getByText("Auto-fill from Tracking")).toBeInTheDocument()
    expect(screen.getByText(/counts toward this habit that week/)).toBeInTheDocument()
  })
})
