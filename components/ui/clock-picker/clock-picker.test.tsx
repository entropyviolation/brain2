import { act, fireEvent, render, screen, within } from "@testing-library/react"
import { useState } from "react"
import { afterEach, describe, expect, it, vi } from "vitest"
import { ClockPicker } from "./clock-picker"

function mount(value = "08:00") {
  const onChange = vi.fn()
  render(<ClockPicker aria-label="When" value={value} onChange={onChange} />)
  return onChange
}

function openClock() {
  fireEvent.click(screen.getByRole("button", { name: "Open When clock" }))
}

function wheel(deltaY: number) {
  const event = new WheelEvent("wheel", { deltaY, bubbles: true, cancelable: true })
  act(() => {
    window.dispatchEvent(event)
  })
  return event
}

describe("ClockPicker", () => {
  afterEach(() => {
    document.body.style.pointerEvents = ""
    localStorage.removeItem("brain2.clock-dial")
    localStorage.removeItem("brain2.clock-dial-hidden")
  })

  it("opens from the clock mark, picks a time, and confirms that value", () => {
    const onChange = mount()
    const field = screen.getByRole("combobox", { name: "When" })
    expect(field).toHaveValue("08:00")
    expect(field).toHaveAttribute("title", "08:00 AM")
    expect(field.closest(".clock-picker")).toHaveAttribute("data-face", "08:00 AM")

    fireEvent.click(field)
    expect(screen.queryByRole("group", { name: "Choose time" })).not.toBeInTheDocument()

    openClock()
    expect(screen.getByRole("group", { name: "Choose time" })).toBeInTheDocument()
    fireEvent.keyDown(field, { key: "ArrowDown" })
    fireEvent.click(screen.getByRole("button", { name: "PM" }))
    expect(onChange).not.toHaveBeenCalled()

    fireEvent.keyDown(field, { key: "Enter" })
    expect(screen.queryByRole("group", { name: "Choose time" })).not.toBeInTheDocument()
    expect(onChange).toHaveBeenLastCalledWith("21:00")
    expect(document.querySelector('input[type="time"]')).not.toBeInTheDocument()
  })

  it("restores the original time on Escape", () => {
    const onChange = mount()
    const field = screen.getByRole("combobox", { name: "When" })
    openClock()
    fireEvent.click(screen.getByRole("button", { name: "PM" }))
    expect(onChange).not.toHaveBeenCalled()
    fireEvent.keyDown(field, { key: "Escape" })
    expect(onChange).not.toHaveBeenCalled()
    expect(field).toHaveValue("08:00")
    expect(screen.queryByRole("group", { name: "Choose time" })).not.toBeInTheDocument()
  })

  it("types a 24-hour clock into the closed field without opening", () => {
    const onChange = mount("")
    const field = screen.getByRole("combobox", { name: "When" })
    fireEvent.focus(field)
    fireEvent.keyDown(field, { key: "1" })
    expect(screen.queryByRole("group", { name: "Choose time" })).not.toBeInTheDocument()
    fireEvent.change(field, { target: { value: "09:15" } })
    fireEvent.blur(field)
    expect(onChange).toHaveBeenCalledWith("09:15")
  })

  it("commits a typed 1:00 PM as 13:00 on Enter", () => {
    const onChange = mount("08:00")
    const field = screen.getByRole("combobox", { name: "When" })
    fireEvent.focus(field)
    fireEvent.change(field, { target: { value: "1:00 PM" } })
    fireEvent.keyDown(field, { key: "Enter" })
    expect(onChange).toHaveBeenLastCalledWith("13:00")
    expect(screen.queryByRole("group", { name: "Choose time" })).not.toBeInTheDocument()
  })

  it("commits 8:00 AM, 16:02, and 1pm from the closed field", () => {
    const onChange = mount("09:30")
    const field = screen.getByRole("combobox", { name: "When" })
    fireEvent.focus(field)
    fireEvent.change(field, { target: { value: "8:00 AM" } })
    fireEvent.blur(field)
    expect(onChange).toHaveBeenLastCalledWith("08:00")

    fireEvent.focus(field)
    fireEvent.change(field, { target: { value: "16:02" } })
    fireEvent.blur(field)
    expect(onChange).toHaveBeenLastCalledWith("16:02")

    fireEvent.focus(field)
    fireEvent.change(field, { target: { value: "1pm" } })
    fireEvent.blur(field)
    expect(onChange).toHaveBeenLastCalledWith("13:00")

    fireEvent.change(field, { target: { value: "4.02pm" } })
    expect(onChange).toHaveBeenLastCalledWith("16:02")
  })

  it("opens a typed time on the drums and the ceramic face", () => {
    function Harness() {
      const [value, setValue] = useState("08:00")
      return <ClockPicker aria-label="When" value={value} onChange={setValue} />
    }
    render(<Harness />)
    const field = screen.getByRole("combobox", { name: "When" })
    fireEvent.change(field, { target: { value: "4:02 PM" } })
    expect(field).toHaveValue("16:02")

    openClock()
    expect(screen.getByRole("button", { name: "Hour 04" })).toHaveClass("is-cursor")
    expect(screen.getByRole("button", { name: "Minute 02" })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "PM" })).toHaveAttribute("aria-pressed", "true")
    const face = screen.getByRole("img", { name: "04:02 PM" })
    expect(face).toHaveAttribute("data-hour", "4")
    expect(face).toHaveAttribute("data-minute", "2")
    expect(face).toHaveAttribute("data-period", "PM")
    expect(face.querySelector(".clock-picker-face")).toBeTruthy()
    expect(face.querySelector(".clock-picker-hands")).toBeTruthy()
  })

  it("keeps Now inside the popup", () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date("2026-06-20T15:47:00"))
    const onChange = mount("08:00")
    const root = screen.getByRole("combobox", { name: "When" }).closest(".clock-picker")!
    expect(within(root as HTMLElement).queryByRole("button", { name: "Now" })).not.toBeInTheDocument()

    openClock()
    const panel = screen.getByRole("group", { name: "Choose time" })
    fireEvent.click(within(panel).getByRole("button", { name: "Now" }))
    expect(onChange).toHaveBeenLastCalledWith("15:47")
    expect(screen.getByRole("img", { name: "03:47 PM" })).toHaveAttribute("data-minute", "47")
    vi.useRealTimers()
  })

  it("stacks the popup above a dialog and keeps the hit on the panel", () => {
    document.body.style.pointerEvents = "none"
    mount("12:00")
    render(<div className="trk-entry" style={{ zIndex: 51 }} />)
    openClock()
    const layer = screen.getByTestId("clock-picker-layer")
    const panel = screen.getByRole("group", { name: "Choose time" })
    const dialog = document.querySelector(".trk-entry") as HTMLElement
    expect(layer.style.pointerEvents).not.toBe("none")
    expect(panel.style.pointerEvents).not.toBe("none")
    expect(Number(layer.style.zIndex)).toBeGreaterThan(Number(dialog.style.zIndex))
    expect(Number(panel.style.zIndex)).toBeGreaterThan(Number(dialog.style.zIndex))

    fireEvent.click(screen.getByRole("button", { name: "Minute 01" }))
    expect(screen.getByRole("img", { name: "12:01 PM" })).toHaveAttribute("data-minute", "1")
  })

  it("steps an armed minute from the wheel without scrolling the page", () => {
    const onChange = mount("16:02")
    const field = screen.getByRole("combobox", { name: "When" })
    openClock()
    fireEvent.click(screen.getByRole("button", { name: "Minute 02" }))
    expect(screen.getByRole("button", { name: "Minute 02" })).toHaveClass("is-caret")
    expect(document.body.style.overflow).toBe("hidden")

    const before = document.documentElement.scrollTop
    const event = wheel(100)
    expect(event.defaultPrevented).toBe(true)
    expect(onChange).not.toHaveBeenCalled()
    expect(document.documentElement.scrollTop).toBe(before)
    expect(screen.getByRole("img", { name: "04:03 PM" })).toHaveAttribute("data-minute", "3")

    fireEvent.keyDown(field, { key: "Escape" })
    expect(document.body.style.overflow).toBe("")
    expect(document.documentElement.style.overflow).toBe("")
  })

  it("does not lock the page when only the day column is armed", () => {
    const onChange = mount("16:02")
    openClock()
    expect(document.body.style.overflow).toBe("hidden")
    fireEvent.click(screen.getByRole("button", { name: "PM" }))
    expect(document.body.style.overflow).toBe("")
    const event = wheel(100)
    expect(event.defaultPrevented).toBe(false)
    expect(onChange).not.toHaveBeenCalled()
  })

  it("restores body scroll when an armed picker unmounts", () => {
    const { unmount } = render(<ClockPicker aria-label="When" value="08:00" onChange={() => {}} />)
    openClock()
    expect(document.body.style.overflow).toBe("hidden")
    unmount()
    expect(document.body.style.overflow).toBe("")
    expect(document.documentElement.style.overflow).toBe("")
  })

  it("double-click on the armed minute accepts a typed minute", () => {
    const onChange = mount("16:02")
    openClock()
    const minute = screen.getByRole("button", { name: "Minute 02" })
    fireEvent.click(minute)
    fireEvent.doubleClick(minute)
    const entry = screen.getByRole("textbox", { name: "Minute" })
    fireEvent.change(entry, { target: { value: "15" } })
    fireEvent.keyDown(entry, { key: "Enter" })
    expect(onChange).not.toHaveBeenCalled()
    expect(screen.getByRole("button", { name: "Minute 15" })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Hour 04" })).toBeInTheDocument()
    expect(screen.queryByRole("textbox", { name: "Minute" })).not.toBeInTheDocument()
    expect(screen.getByRole("img", { name: "04:15 PM" })).toHaveAttribute("data-minute", "15")
    fireEvent.click(screen.getByRole("button", { name: "Confirm" }))
    expect(onChange).toHaveBeenLastCalledWith("16:15")
    expect(screen.queryByRole("group", { name: "Choose time" })).not.toBeInTheDocument()
  })

  it("points the ornate hands for 1:00 and 6:30", () => {
    const { unmount } = render(<ClockPicker aria-label="When" value="01:00" onChange={() => {}} />)
    openClock()
    const one = screen.getByRole("img", { name: "01:00 AM" })
    expect(one.querySelector("[data-hand=hour]")).toHaveAttribute("data-angle", "30")
    expect(one.querySelector("[data-hand=minute]")).toHaveAttribute("data-angle", "0")
    unmount()

    render(<ClockPicker aria-label="When" value="06:30" onChange={() => {}} />)
    openClock()
    const six = screen.getByRole("img", { name: "06:30 AM" })
    expect(six.querySelector("[data-hand=hour]")).toHaveAttribute("data-angle", "195")
    expect(six.querySelector("[data-hand=minute]")).toHaveAttribute("data-angle", "180")
  })

  it("Confirm writes the new minute and Cancel does not call onChange", () => {
    const onChange = mount("08:00")
    const field = screen.getByRole("combobox", { name: "When" })
    openClock()
    fireEvent.click(screen.getByRole("button", { name: "Minute 01" }))
    expect(onChange).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole("button", { name: "Confirm" }))
    expect(onChange).toHaveBeenLastCalledWith("08:01")
    expect(field).toHaveValue("08:00")
    expect(screen.queryByRole("group", { name: "Choose time" })).not.toBeInTheDocument()

    onChange.mockClear()
    openClock()
    fireEvent.click(screen.getByRole("button", { name: "Minute 01" }))
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }))
    expect(onChange).not.toHaveBeenCalled()
    expect(field).toHaveValue("08:00")
    expect(screen.queryByRole("group", { name: "Choose time" })).not.toBeInTheDocument()
  })

  it("Escape and Cancel drop a half-edited minute", () => {
    const onChange = mount("16:02")
    const field = screen.getByRole("combobox", { name: "When" })
    openClock()
    const minute = screen.getByRole("button", { name: "Minute 02" })
    fireEvent.click(minute)
    fireEvent.doubleClick(minute)
    fireEvent.change(screen.getByRole("textbox", { name: "Minute" }), { target: { value: "15" } })
    fireEvent.keyDown(screen.getByRole("textbox", { name: "Minute" }), { key: "Escape" })
    expect(onChange).not.toHaveBeenCalled()
    expect(field).toHaveValue("16:02")
    expect(screen.queryByRole("group", { name: "Choose time" })).not.toBeInTheDocument()

    openClock()
    fireEvent.click(screen.getByRole("button", { name: "Minute 03" }))
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }))
    expect(onChange).not.toHaveBeenCalled()
    expect(field).toHaveValue("16:02")
  })

  it("closes on a click outside without committing", () => {
    const onChange = mount("08:00")
    openClock()
    fireEvent.click(screen.getByRole("button", { name: "Minute 01" }))
    fireEvent.pointerDown(screen.getByTestId("clock-picker-backdrop"))
    expect(screen.queryByRole("group", { name: "Choose time" })).not.toBeInTheDocument()
    expect(onChange).not.toHaveBeenCalled()
    expect(screen.getByRole("combobox", { name: "When" })).toHaveValue("08:00")
  })

  it("defaults the dial to ceramic", () => {
    mount("08:00")
    openClock()
    expect(screen.getByRole("img", { name: "08:00 AM" })).toHaveAttribute("data-dial", "ceramic")
    expect(screen.getByLabelText("Dial")).toHaveValue("ceramic")
  })
})
