import { fireEvent, render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import { ClockPicker } from "./clock-picker"

function mount(value = "08:00") {
  const onChange = vi.fn()
  render(<ClockPicker aria-label="When" value={value} onChange={onChange} />)
  return onChange
}

describe("ClockPicker", () => {
  it("opens, picks a time, and confirms that value", () => {
    const onChange = mount()
    const field = screen.getByRole("combobox", { name: "When" })
    expect(field).toHaveValue("08:00")
    expect(field).toHaveAttribute("title", "08:00 AM")
    expect(field.closest(".clock-picker")).toHaveAttribute("data-face", "08:00 AM")

    fireEvent.click(field)
    expect(screen.getByRole("group", { name: "Choose time" })).toBeInTheDocument()
    fireEvent.keyDown(field, { key: "ArrowDown" })
    fireEvent.click(screen.getByRole("button", { name: "PM" }))
    expect(onChange).toHaveBeenLastCalledWith("21:00")

    fireEvent.keyDown(field, { key: "Enter" })
    expect(screen.queryByRole("group", { name: "Choose time" })).not.toBeInTheDocument()
    expect(onChange).toHaveBeenLastCalledWith("21:00")
    expect(document.querySelector('input[type="time"]')).not.toBeInTheDocument()
  })

  it("restores the original time on Escape", () => {
    const onChange = mount()
    const field = screen.getByRole("combobox", { name: "When" })
    fireEvent.click(field)
    fireEvent.click(screen.getByRole("button", { name: "PM" }))
    expect(onChange).toHaveBeenLastCalledWith("20:00")
    fireEvent.keyDown(field, { key: "Escape" })
    expect(onChange).toHaveBeenLastCalledWith("08:00")
    expect(screen.queryByRole("group", { name: "Choose time" })).not.toBeInTheDocument()
  })

  it("types a 24-hour clock into the closed field", () => {
    const onChange = mount("")
    const field = screen.getByRole("combobox", { name: "When" })
    for (const key of ["0", "9", ":", "1", "5"]) fireEvent.keyDown(field, { key })
    expect(onChange).toHaveBeenCalledWith("09:15")
  })
})
