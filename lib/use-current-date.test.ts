import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { resetLocalStorage } from "@/tests/test-utils"
import { formatLocalDateKey } from "@/lib/date-utils"
import { APP_NAV_KEYS, readStoredDate } from "@/lib/app-navigation"
import { msUntilLocalMidnight, pinHomeCursor } from "./use-current-date"

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
    resetLocalStorage()
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

  it("keeps a chosen earlier day through local midnight", async () => {
    const { renderHook, act } = await import("@testing-library/react")
    pinHomeCursor(new Date(2026, 5, 10), false)
    const { useCurrentDate } = await import("./use-current-date")

    const { result } = renderHook(() => useCurrentDate())
    expect(result.current.currentDate.getDate()).toBe(10)

    await act(async () => {
      vi.advanceTimersByTime(msUntilLocalMidnight(new Date("2026-06-20T23:59:00")) + 1)
    })

    expect(result.current.currentDate.getDate()).toBe(10)
  })

  it("opens on today when the saved cursor is a previous today", async () => {
    vi.setSystemTime(new Date("2026-09-26T09:11:00"))
    const { writeStoredDate } = await import("./app-navigation")
    writeStoredDate(APP_NAV_KEYS.homeDate, new Date(2026, 8, 24))
    const { renderHook } = await import("@testing-library/react")
    const { useCurrentDate } = await import("./use-current-date")

    const { result } = renderHook(() => useCurrentDate())

    expect(formatLocalDateKey(result.current.currentDate)).toBe("2026-09-26")
    expect(formatLocalDateKey(readStoredDate(APP_NAV_KEYS.homeDate)!)).toBe("2026-09-26")
  })

  it("keeps a chosen earlier day across a relaunch days later", async () => {
    vi.setSystemTime(new Date("2026-09-26T09:11:00"))
    pinHomeCursor(new Date(2026, 8, 24), false)
    const { renderHook } = await import("@testing-library/react")
    const { useCurrentDate } = await import("./use-current-date")

    const { result } = renderHook(() => useCurrentDate())

    expect(formatLocalDateKey(result.current.currentDate)).toBe("2026-09-24")
  })

  it("follows today across a relaunch days later", async () => {
    vi.setSystemTime(new Date("2026-09-24T18:00:00"))
    const { renderHook, act } = await import("@testing-library/react")
    const { useCurrentDate } = await import("./use-current-date")
    const first = renderHook(() => useCurrentDate())
    await act(async () => {
      first.result.current.setCurrentDate(new Date(2026, 8, 24, 18))
    })
    first.unmount()

    vi.setSystemTime(new Date("2026-09-26T09:11:00"))
    const second = renderHook(() => useCurrentDate())
    expect(formatLocalDateKey(second.result.current.currentDate)).toBe("2026-09-26")
  })

  it("catches up when the window becomes visible after missed days", async () => {
    vi.setSystemTime(new Date("2026-09-24T18:00:00"))
    const { renderHook, act } = await import("@testing-library/react")
    const { useCurrentDate } = await import("./use-current-date")
    const { result } = renderHook(() => useCurrentDate())
    expect(formatLocalDateKey(result.current.currentDate)).toBe("2026-09-24")

    vi.setSystemTime(new Date("2026-09-26T09:11:00"))
    await act(async () => {
      document.dispatchEvent(new Event("visibilitychange"))
    })

    expect(formatLocalDateKey(result.current.currentDate)).toBe("2026-09-26")
  })

  it("does not catch up a chosen earlier day when the window becomes visible", async () => {
    vi.setSystemTime(new Date("2026-09-26T09:11:00"))
    pinHomeCursor(new Date(2026, 8, 24), false)
    const { renderHook, act } = await import("@testing-library/react")
    const { useCurrentDate } = await import("./use-current-date")
    const { result } = renderHook(() => useCurrentDate())

    await act(async () => {
      document.dispatchEvent(new Event("visibilitychange"))
    })

    expect(formatLocalDateKey(result.current.currentDate)).toBe("2026-09-24")
  })
})
