import { fireEvent, render, screen } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { resetAllStores } from "@/tests/test-utils"
import { minuteMap } from "@/lib/time-entries"
import { useTimeTrackingStore } from "@/lib/time-tracking-store"
import { ERASE, SCISSORS } from "./tracking-tool-mode"
import { PhoneDayTimeline } from "./phone-day-timeline"

const day = new Date(2026, 5, 20, 12, 0, 0)

function plotAt(clientY: number) {
  const plot = screen.getByTestId("phone-day-plot")
  plot.getBoundingClientRect = () =>
    ({
      x: 0,
      y: 0,
      top: 0,
      left: 0,
      right: 200,
      bottom: 1440,
      width: 200,
      height: 1440,
      toJSON() {
        return {}
      },
    }) as DOMRect
  return { plot, clientY }
}

function tap(clientY: number) {
  const { plot } = plotAt(clientY)
  fireEvent.pointerDown(plot, { button: 0, clientY, pointerId: 1 })
  fireEvent.pointerUp(plot, { button: 0, clientY, pointerId: 1 })
}

describe("PhoneDayTimeline", () => {
  beforeEach(() => {
    resetAllStores()
    vi.useFakeTimers()
    vi.setSystemTime(day)
    useTimeTrackingStore.getState().setSelectedPen("act-work")
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it("paints one step when the plot is tapped", () => {
    render(<PhoneDayTimeline date={day} setDate={() => {}} />)
    tap(600)
    expect(useTimeTrackingStore.getState().entries).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ date: "2026-06-20", startMin: 600, penId: "act-work" }),
      ]),
    )
  })

  it("opens the block editor from a block", () => {
    useTimeTrackingStore.getState().paintMinutes("2026-06-20", "activity", 7 * 60, 9 * 60, "act-work")
    render(<PhoneDayTimeline date={day} setDate={() => {}} />)
    const block = document.querySelector("[data-entry-id]")
    expect(block).toBeTruthy()
    fireEvent.click(block as HTMLElement)
    expect(screen.getByRole("dialog")).toBeTruthy()
  })

  it("erases the tapped step", () => {
    useTimeTrackingStore.getState().paintMinutes("2026-06-20", "activity", 600, 660, "act-work")
    useTimeTrackingStore.getState().setSelectedPen(ERASE)
    render(<PhoneDayTimeline date={day} setDate={() => {}} />)
    tap(600)
    const map = minuteMap(useTimeTrackingStore.getState().entries, "2026-06-20", "activity")
    expect(map[600]).toBeNull()
    expect(map[610]).toBeTruthy()
  })

  it("splits a block with scissors", () => {
    useTimeTrackingStore.getState().paintMinutes("2026-06-20", "activity", 0, 60, "act-work")
    useTimeTrackingStore.getState().setSelectedPen(SCISSORS)
    render(<PhoneDayTimeline date={day} setDate={() => {}} />)
    tap(30)
    const blocks = useTimeTrackingStore
      .getState()
      .entries.filter((entry) => entry.date === "2026-06-20" && entry.penId === "act-work")
    expect(blocks.length).toBeGreaterThan(1)
  })
})
