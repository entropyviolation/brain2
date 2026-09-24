import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { msUntilLocalMidnight } from "./use-current-date"

describe("msUntilLocalMidnight", () => {
  it("returns ms until next local midnight", () => {
    const from = new Date("2026-06-20T14:30:00")
    expect(msUntilLocalMidnight(from)).toBe(9.5 * 60 * 60 * 1000)
  })

  it("returns a full day until the next local midnight when called at local midnight", () => {
    const from = new Date(2026, 5, 21, 0, 0, 0, 0)
    expect(msUntilLocalMidnight(from)).toBe(24 * 60 * 60 * 1000)
  })
})

describe("useCurrentDate", () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date("2026-06-20T23:59:00"))
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it("rolls over at local midnight", async () => {
    const { renderHook, act } = await import("@testing-library/react")
    const { useCurrentDate } = await import("./use-current-date")

    const { result } = renderHook(() => useCurrentDate())
    expect(result.current.currentDate.getDate()).toBe(20)

    await act(async () => {
      vi.advanceTimersByTime(msUntilLocalMidnight(new Date("2026-06-20T23:59:00")) + 1)
    })

    expect(result.current.currentDate.getDate()).toBe(21)
  })

  it("keeps a historical calendar day through local midnight", async () => {
    const { renderHook, act } = await import("@testing-library/react")
    const { APP_NAV_KEYS, writeStoredDate } = await import("./app-navigation")
    writeStoredDate(APP_NAV_KEYS.homeDate, new Date(2026, 5, 10))
    const { useCurrentDate } = await import("./use-current-date")

    const { result } = renderHook(() => useCurrentDate())
    expect(result.current.currentDate.getDate()).toBe(10)

    await act(async () => {
      vi.advanceTimersByTime(msUntilLocalMidnight(new Date("2026-06-20T23:59:00")) + 1)
    })

    expect(result.current.currentDate.getDate()).toBe(10)
  })
})
