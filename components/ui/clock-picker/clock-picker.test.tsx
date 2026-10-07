import { act, fireEvent, render, screen } from "@testing-library/react"
import { useState } from "react"
import { describe, expect, it, vi } from "vitest"
import { ClockPicker } from "./clock-picker"

function mount(value = "08:00") {
  const onChange = vi.fn()
  render(<ClockPicker aria-label="When" value={value} onChange={onChange} />)
  return onChange
}

function wheel(deltaY: number) {
  const event = new WheelEvent("wheel", { deltaY, bubbles: true, cancelable: true })
  act(() => {
    window.dispatchEvent(event)
  })
  return event
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

  it("types 4:02 PM into the closed field as 16:02", () => {
    const onChange = mount("08:00")
    const field = screen.getByRole("combobox", { name: "When" })
    for (const key of ["4", ":", "0", "2", " ", "P", "M"]) fireEvent.keyDown(field, { key })
    expect(onChange).toHaveBeenLastCalledWith("16:02")

    fireEvent.change(field, { target: { value: "4.02pm" } })
    expect(onChange).toHaveBeenLastCalledWith("16:02")
    fireEvent.change(field, { target: { value: "04:02" } })
    expect(onChange).toHaveBeenLastCalledWith("04:02")
    fireEvent.change(field, { target: { value: "16:02" } })
    expect(onChange).toHaveBeenLastCalledWith("16:02")
  })

  it("opens a typed time on the drums and the analog face", () => {
    function Harness() {
      const [value, setValue] = useState("08:00")
      return <ClockPicker aria-label="When" value={value} onChange={setValue} />
    }
    render(<Harness />)
    const field = screen.getByRole("combobox", { name: "When" })
    fireEvent.change(field, { target: { value: "4:02 PM" } })
    expect(field).toHaveValue("16:02")

    fireEvent.click(field)
    expect(screen.getByRole("button", { name: "Hour 04" })).toHaveClass("is-cursor")
    expect(screen.getByRole("button", { name: "Minute 02" })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "PM" })).toHaveAttribute("aria-pressed", "true")
    const face = screen.getByRole("img", { name: "04:02 PM" })
    expect(face).toHaveAttribute("data-hour", "4")
    expect(face).toHaveAttribute("data-minute", "2")
    expect(face).toHaveAttribute("data-period", "PM")
  })

  it("steps an armed minute from the wheel without scrolling the page", () => {
    const onChange = mount("16:02")
    const field = screen.getByRole("combobox", { name: "When" })
    fireEvent.click(field)
    fireEvent.click(screen.getByRole("button", { name: "Minute 02" }))
    expect(screen.getByRole("button", { name: "Minute 02" })).toHaveClass("is-caret")
    expect(document.body.style.overflow).toBe("hidden")

    const before = document.documentElement.scrollTop
    const event = wheel(100)
    expect(event.defaultPrevented).toBe(true)
    expect(onChange).toHaveBeenLastCalledWith("16:03")
    expect(document.documentElement.scrollTop).toBe(before)
    expect(screen.getByRole("img", { name: "04:03 PM" })).toHaveAttribute("data-minute", "3")

    fireEvent.keyDown(field, { key: "Escape" })
    expect(document.body.style.overflow).toBe("")
    expect(document.documentElement.style.overflow).toBe("")
  })

  it("does not lock the page when only the day column is armed", () => {
    const onChange = mount("16:02")
    fireEvent.click(screen.getByRole("combobox", { name: "When" }))
    expect(document.body.style.overflow).toBe("hidden")
    fireEvent.click(screen.getByRole("button", { name: "PM" }))
    expect(document.body.style.overflow).toBe("")
    const event = wheel(100)
    expect(event.defaultPrevented).toBe(false)
    expect(onChange).not.toHaveBeenCalled()
  })

  it("restores body scroll when an armed picker unmounts", () => {
    const { unmount } = render(<ClockPicker aria-label="When" value="08:00" onChange={() => {}} />)
    fireEvent.click(screen.getByRole("combobox", { name: "When" }))
    expect(document.body.style.overflow).toBe("hidden")
    unmount()
    expect(document.body.style.overflow).toBe("")
    expect(document.documentElement.style.overflow).toBe("")
  })

  it("double-click on the armed minute accepts a typed minute", () => {
    const onChange = mount("16:02")
    const field = screen.getByRole("combobox", { name: "When" })
    fireEvent.click(field)
    const minute = screen.getByRole("button", { name: "Minute 02" })
    fireEvent.click(minute)
    fireEvent.doubleClick(minute)
    const entry = screen.getByRole("textbox", { name: "Minute" })
    fireEvent.change(entry, { target: { value: "15" } })
    fireEvent.keyDown(entry, { key: "Enter" })
    expect(onChange).toHaveBeenLastCalledWith("16:15")
    expect(screen.getByRole("button", { name: "Minute 15" })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Hour 04" })).toBeInTheDocument()
    expect(screen.queryByRole("textbox", { name: "Minute" })).not.toBeInTheDocument()
    expect(screen.getByRole("img", { name: "04:15 PM" })).toHaveAttribute("data-minute", "15")
  })
})
