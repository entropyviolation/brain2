import { fireEvent, render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import { GRID_STEPS } from "@/lib/time-entries"
import { CellSizeKeys } from "./cell-size-keys"

function placeKnob(knob: HTMLElement) {
  knob.getBoundingClientRect = () =>
    ({
      x: 100,
      y: 100,
      left: 100,
      top: 100,
      right: 140,
      bottom: 140,
      width: 40,
      height: 40,
      toJSON() {
        return {}
      },
    }) as DOMRect
}

/** A point on the circle, 0° straight up, clockwise positive. */
function atAngle(degrees: number, radius = 28) {
  const rad = (degrees * Math.PI) / 180
  return {
    clientX: 120 + Math.sin(rad) * radius,
    clientY: 120 - Math.cos(rad) * radius,
  }
}

describe("CellSizeKeys", () => {
  it("shows the current step on the dial and steps with the arrow keys", () => {
    const onChange = vi.fn()
    const { rerender } = render(
      <div className="trk95">
        <CellSizeKeys steps={GRID_STEPS} value={5} onChange={onChange} />
      </div>,
    )

    const knob = screen.getByRole("slider", { name: "Cell size" })
    expect(knob).toHaveAttribute("aria-valuenow", "5")
    expect(knob).toHaveAttribute("aria-valuetext", "5 minutes")
    expect(knob).toHaveAttribute("aria-roledescription", "dial")
    expect(screen.getByText("5m")).toBeInTheDocument()
    expect(knob.querySelector(".trk-cell-knob-face")).toHaveAttribute("style", expect.stringContaining("rotate(-67.5deg)"))
    expect(screen.queryByRole("button", { name: "Finer cells" })).not.toBeInTheDocument()
    expect(screen.queryByRole("button", { name: "1m" })).not.toBeInTheDocument()

    fireEvent.keyDown(knob, { key: "ArrowRight" })
    expect(onChange).toHaveBeenCalledWith(10)
    fireEvent.keyDown(knob, { key: "ArrowUp" })
    expect(onChange).toHaveBeenCalledWith(1)

    rerender(
      <div className="trk95">
        <CellSizeKeys steps={GRID_STEPS} value={10} onChange={onChange} />
      </div>,
    )
    expect(screen.getByRole("slider", { name: "Cell size" })).toHaveAttribute("aria-valuetext", "10 minutes")
    expect(screen.getByText("10m")).toBeInTheDocument()
    expect(screen.getByRole("slider", { name: "Cell size" }).querySelector(".trk-cell-knob-face")).toHaveAttribute(
      "style",
      expect.stringContaining("rotate(0deg)"),
    )
  })

  it("leaves the step alone when a wheel or trackpad scroll passes over the dial", () => {
    const onChange = vi.fn()
    render(
      <div className="trk95">
        <CellSizeKeys steps={GRID_STEPS} value={10} onChange={onChange} />
      </div>,
    )

    const knob = screen.getByRole("slider", { name: "Cell size" })
    const overKnob = new WheelEvent("wheel", { deltaY: 140, bubbles: true, cancelable: true })
    const overDial = new WheelEvent("wheel", { deltaY: -90, deltaX: 40, bubbles: true, cancelable: true })
    knob.dispatchEvent(overKnob)
    knob.parentElement?.dispatchEvent(overDial)

    expect(overKnob.defaultPrevented).toBe(false)
    expect(overDial.defaultPrevented).toBe(false)
    expect(onChange).not.toHaveBeenCalled()
    expect(knob).toHaveAttribute("aria-valuenow", "10")
  })

  it("turns coarser clockwise and stops when the pointer is released", () => {
    const onChange = vi.fn()
    render(
      <div className="trk95">
        <CellSizeKeys steps={GRID_STEPS} value={10} onChange={onChange} />
      </div>,
    )

    const knob = screen.getByRole("slider", { name: "Cell size" })
    placeKnob(knob)
    const start = atAngle(0)
    const clockwise = atAngle(70)
    fireEvent.pointerDown(knob, { button: 0, pointerId: 1, ...start })
    fireEvent.pointerMove(knob, { pointerId: 1, ...clockwise })
    expect(onChange).toHaveBeenCalledTimes(1)
    expect(onChange).toHaveBeenCalledWith(15)

    fireEvent.pointerUp(knob, { pointerId: 1, ...clockwise })
    onChange.mockClear()
    fireEvent.pointerMove(knob, { pointerId: 1, ...atAngle(160) })
    expect(onChange).not.toHaveBeenCalled()
  })

  it("turns finer counterclockwise and ignores a press that does not rotate", () => {
    const onChange = vi.fn()
    render(
      <div className="trk95">
        <CellSizeKeys steps={GRID_STEPS} value={10} onChange={onChange} />
      </div>,
    )

    const knob = screen.getByRole("slider", { name: "Cell size" })
    placeKnob(knob)
    const still = atAngle(12)
    fireEvent.pointerDown(knob, { button: 0, pointerId: 1, ...still })
    fireEvent.pointerUp(knob, { pointerId: 1, ...still })
    expect(onChange).not.toHaveBeenCalled()

    fireEvent.pointerDown(knob, { button: 0, pointerId: 1, ...atAngle(0) })
    fireEvent.pointerMove(knob, { pointerId: 1, ...atAngle(-70) })
    expect(onChange).toHaveBeenCalledTimes(1)
    expect(onChange).toHaveBeenCalledWith(5)

    fireEvent.pointerUp(knob, { pointerId: 1, ...atAngle(-70) })
    onChange.mockClear()
    fireEvent.pointerMove(knob, { pointerId: 1, ...atAngle(-160) })
    expect(onChange).not.toHaveBeenCalled()
  })
})
