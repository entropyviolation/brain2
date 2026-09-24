import { fireEvent, render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import { GRID_STEPS } from "@/lib/time-entries"
import { CellSizeKeys } from "./cell-size-keys"

describe("CellSizeKeys", () => {
  it("marks the active minute size as pressed and selected", () => {
    const onChange = vi.fn()
    const { rerender } = render(
      <div className="trk95">
        <CellSizeKeys steps={GRID_STEPS} value={5} onChange={onChange} />
      </div>,
    )

    const five = screen.getByRole("button", { name: "5m" })
    expect(five).toHaveAttribute("aria-pressed", "true")
    expect(five).toHaveClass("trk-cell-size-btn")
    expect(five).toHaveClass("trk-cell-size-btn-on")
    expect(screen.getByRole("button", { name: "1m" })).toHaveAttribute("aria-pressed", "false")
    expect(screen.getByRole("button", { name: "1m" })).not.toHaveClass("trk-cell-size-btn-on")

    fireEvent.click(screen.getByRole("button", { name: "10m" }))
    expect(onChange).toHaveBeenCalledWith(10)

    rerender(
      <div className="trk95">
        <CellSizeKeys steps={GRID_STEPS} value={10} onChange={onChange} />
      </div>,
    )
    const ten = screen.getByRole("button", { name: "10m" })
    expect(ten).toHaveAttribute("aria-pressed", "true")
    expect(ten).toHaveClass("trk-cell-size-btn")
    expect(ten).toHaveClass("trk-cell-size-btn-on")
    expect(five).toHaveAttribute("aria-pressed", "false")
    expect(five).not.toHaveClass("trk-cell-size-btn-on")
  })
})
