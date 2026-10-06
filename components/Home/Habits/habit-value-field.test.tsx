/**
 * components/Home/Habits/habit-value-field.test.tsx — Text cells stay local while typing
 */
import { act, fireEvent, render, screen } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"
import { HabitTextField } from "./habit-value-field"

describe("HabitTextField", () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it("does not call the store on each keystroke, then commits once after the pause", () => {
    vi.useFakeTimers()
    const onValue = vi.fn()
    render(<HabitTextField value="" onValue={onValue} ariaLabel="Study note" />)
    const box = screen.getByRole("textbox", { name: "Study note" })
    fireEvent.change(box, { target: { value: "s" } })
    fireEvent.change(box, { target: { value: "st" } })
    fireEvent.change(box, { target: { value: "studied" } })
    expect(onValue).not.toHaveBeenCalled()
    act(() => {
      vi.advanceTimersByTime(449)
    })
    expect(onValue).not.toHaveBeenCalled()
    act(() => {
      vi.advanceTimersByTime(1)
    })
    expect(onValue).toHaveBeenCalledTimes(1)
    expect(onValue).toHaveBeenCalledWith("studied")
  })

  it("keeps a blank cell as the inline field", () => {
    render(<HabitTextField value="" onValue={vi.fn()} ariaLabel="Study note" />)
    expect(screen.getByRole("textbox", { name: "Study note" })).toBeInTheDocument()
    expect(screen.queryByRole("button", { name: "Edit Study note" })).not.toBeInTheDocument()
  })

  it("opens a larger editor when the cell already has text", () => {
    render(<HabitTextField value="studied the chapter" onValue={vi.fn()} ariaLabel="Study note" />)
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole("button", { name: "Edit Study note" }))
    expect(screen.getByRole("textbox", { name: "Study note" })).toHaveValue("studied the chapter")
  })
})
