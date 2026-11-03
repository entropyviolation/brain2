import { act, fireEvent, render } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { resetAllStores } from "@/tests/test-utils"
import { useTimeTrackingStore } from "@/lib/time-tracking-store"
import { TimeGrid } from "./time-grid"

const DAY = new Date(2026, 8, 16, 12, 0, 0)

function cell(minute: number): HTMLElement {
  return document.querySelector(`[data-minute="${minute}"]`) as HTMLElement
}

const touch = (el: HTMLElement, x = 10, y = 10) => ({ touches: [{ clientX: x, clientY: y, target: el }] })

beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(DAY)
  resetAllStores()
  localStorage.clear()
  useTimeTrackingStore.getState().setActiveScope("activity")
  useTimeTrackingStore.getState().setSelectedPen("act-work")
  useTimeTrackingStore.getState().setGridStep(5)
})

afterEach(() => vi.useRealTimers())

describe("Time Grid touch", () => {
  it("applies a tap at once and leaves no stroke behind", () => {
    render(<TimeGrid plotOnly showPalette={false} currentDate={DAY} setCurrentDate={() => {}} />)
    const target = cell(60)
    fireEvent.touchStart(target, touch(target))
    fireEvent.touchEnd(target, { touches: [] })
    const painted = useTimeTrackingStore.getState().entries.filter((e) => e.startMin === 60 && e.endMin === 65)
    expect(painted).toHaveLength(1)
    act(() => { vi.advanceTimersByTime(200) })
    expect(document.querySelector(".trk-cell-spark")).toBeNull()
  })

  it("treats a move before the hold as a scroll and paints nothing", () => {
    render(<TimeGrid plotOnly showPalette={false} currentDate={DAY} setCurrentDate={() => {}} />)
    const target = cell(120)
    fireEvent.touchStart(target, touch(target))
    fireEvent.touchMove(target, touch(target, 10, 60))
    vi.advanceTimersByTime(400)
    fireEvent.touchEnd(target, { touches: [] })
    expect(useTimeTrackingStore.getState().entries).toHaveLength(0)
  })

  it("paints one block along a held drag and applies it on release", () => {
    render(<TimeGrid plotOnly showPalette={false} currentDate={DAY} setCurrentDate={() => {}} />)
    const first = cell(180)
    const last = cell(195)
    fireEvent.touchStart(first, touch(first))
    vi.advanceTimersByTime(200)
    Object.defineProperty(document, "elementFromPoint", { configurable: true, value: () => last })
    fireEvent.touchMove(first, touch(first, 40, 10))
    fireEvent.touchEnd(first, { touches: [] })
    const block = useTimeTrackingStore.getState().entries.find((e) => e.startMin === 180)
    expect(block?.endMin).toBe(200)
  })
})
