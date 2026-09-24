import { fireEvent, render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import { MINUTES_PER_DAY, type TimeEntry } from "@/lib/time-entries"
import { FillRangeControl } from "./fill-range-control"

function entry(startMin: number, endMin: number): TimeEntry {
  return {
    id: `e-${startMin}`,
    date: "2026-06-20",
    scopeId: "activity",
    penId: "act-work",
    startMin,
    endMin,
  }
}

function mount(dayEntries: TimeEntry[], onFill = vi.fn()) {
  render(
    <div className="trk95">
      <FillRangeControl
        dayEntries={dayEntries}
        fallbackFrom="09:00"
        fallbackTo="10:00"
        selectedPenId="act-work"
        penName="Work"
        onFill={onFill}
      />
    </div>,
  )
  return onFill
}

describe("FillRangeControl", () => {
  it("defaults to the longest empty block", () => {
    mount([entry(0, 9 * 60), entry(10 * 60, 12 * 60), entry(15 * 60, MINUTES_PER_DAY)])
    expect(screen.getByRole("button", { name: /Fill 12:00 PM–3:00 PM with Work/ })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Previous empty block" })).not.toBeDisabled()
    expect(screen.getByRole("button", { name: "Next empty block" })).toBeDisabled()
  })

  it("cycles empty blocks in chronological order", () => {
    mount([entry(0, 9 * 60), entry(10 * 60, 12 * 60), entry(15 * 60, MINUTES_PER_DAY)])
    fireEvent.click(screen.getByRole("button", { name: "Previous empty block" }))
    expect(screen.getByRole("button", { name: /Fill 9:00 AM–10:00 AM with Work/ })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Previous empty block" })).toBeDisabled()
    expect(screen.getByRole("button", { name: "Next empty block" })).not.toBeDisabled()
    fireEvent.click(screen.getByRole("button", { name: "Next empty block" }))
    expect(screen.getByRole("button", { name: /Fill 12:00 PM–3:00 PM with Work/ })).toBeInTheDocument()
  })

  it("opens a clock picker on double-click, not single click", () => {
    mount([])
    const start = screen.getByRole("button", { name: "Fill starts" })
    fireEvent.click(start)
    expect(screen.queryByLabelText("Fill starts")).toBe(start)
    fireEvent.doubleClick(start)
    const input = screen.getByLabelText("Fill starts") as HTMLInputElement
    expect(input.tagName).toBe("INPUT")
    expect(input.type).toBe("time")
  })

  it("Fill still paints the selected range", () => {
    const onFill = mount([])
    fireEvent.click(screen.getByRole("button", { name: /Fill 9:00 AM–10:00 AM with Work/ }))
    expect(onFill).toHaveBeenCalledWith(9 * 60, 10 * 60)
  })

  it("disables Fill on a fully tracked day without crashing", () => {
    expect(() => mount([entry(0, MINUTES_PER_DAY)])).not.toThrow()
    const fill = screen.getByRole("button", { name: "Nothing empty to fill" })
    expect(fill).toBeDisabled()
    expect(fill).toHaveAttribute("title", "Nothing empty to fill — this day is fully tracked")
    expect(screen.getByRole("button", { name: "Previous empty block" })).toBeDisabled()
    expect(screen.getByRole("button", { name: "Next empty block" })).toBeDisabled()
  })
})
