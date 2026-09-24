import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it, vi } from "vitest"
import { HabitSortControl } from "./habit-sort-control"

describe("HabitSortControl", () => {
  it("labels the plate Sort Habits and lists every mode as inset keys", async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    const onDirection = vi.fn()
    render(<HabitSortControl value="default" direction={null} onChange={onChange} onDirection={onDirection} />)
    expect(screen.getByText("Sort Habits")).toBeInTheDocument()
    expect(screen.getByRole("radio", { name: "Alphabetical" })).toBeInTheDocument()
    expect(screen.getByRole("radio", { name: "Date created" })).toBeInTheDocument()
    expect(screen.getByRole("radio", { name: "Priority" })).toBeInTheDocument()
    expect(screen.getByRole("radio", { name: "Weekly completion %" })).toBeInTheDocument()
    expect(screen.getByRole("radio", { name: "Ascending" })).toBeInTheDocument()
    expect(screen.getByRole("radio", { name: "Descending" })).toBeInTheDocument()
    await user.click(screen.getByRole("radio", { name: "Priority" }))
    expect(onChange).toHaveBeenCalledWith("priority")
    await user.click(screen.getByRole("radio", { name: "Ascending" }))
    expect(onDirection).toHaveBeenCalledWith("asc")
  })
})
