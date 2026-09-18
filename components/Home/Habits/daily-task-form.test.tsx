import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it, vi } from "vitest"
import { TaskForm } from "./daily-task-form"

describe("TaskForm", () => {
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
})
