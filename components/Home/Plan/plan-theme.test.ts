import { act, renderHook } from "@testing-library/react"
import { beforeEach, describe, expect, it } from "vitest"
import { resetLocalStorage } from "@/tests/test-utils"
import {
  PLAN_DARK_STORAGE_KEY,
  readPlanDarkMode,
  usePlanDarkMode,
  writePlanDarkMode,
} from "./plan-theme"

describe("plan dark mode", () => {
  beforeEach(() => {
    resetLocalStorage()
  })

  it("defaults off so the gray Win95 Plan look stays the normal view", () => {
    expect(readPlanDarkMode()).toBe(false)
  })

  it("persists the latch and restores it after remount", () => {
    writePlanDarkMode(true)
    expect(localStorage.getItem(PLAN_DARK_STORAGE_KEY)).toBe("1")
    expect(readPlanDarkMode()).toBe(true)

    const { result, unmount } = renderHook(() => usePlanDarkMode())
    expect(result.current[0]).toBe(true)

    act(() => {
      result.current[1](false)
    })
    expect(result.current[0]).toBe(false)
    expect(localStorage.getItem(PLAN_DARK_STORAGE_KEY)).toBe("0")
    unmount()

    const again = renderHook(() => usePlanDarkMode())
    expect(again.result.current[0]).toBe(false)
  })
})
