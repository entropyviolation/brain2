import { act, renderHook } from "@testing-library/react"
import { beforeEach, describe, expect, it } from "vitest"
import { resetLocalStorage } from "@/tests/test-utils"
import {
  PLAN_GEM_MODE_STORAGE_KEY,
  readPlanGemMode,
  usePlanGemMode,
  writePlanGemMode,
} from "./plan-gem-mode"

describe("plan gem mode", () => {
  beforeEach(() => {
    resetLocalStorage()
  })

  it("defaults off so Month cells keep the current chip listing", () => {
    expect(readPlanGemMode()).toBe(false)
  })

  it("persists the latch and restores it after remount", () => {
    writePlanGemMode(true)
    expect(localStorage.getItem(PLAN_GEM_MODE_STORAGE_KEY)).toBe("1")
    expect(readPlanGemMode()).toBe(true)

    const { result, unmount } = renderHook(() => usePlanGemMode())
    expect(result.current[0]).toBe(true)

    act(() => {
      result.current[1](false)
    })
    expect(result.current[0]).toBe(false)
    expect(localStorage.getItem(PLAN_GEM_MODE_STORAGE_KEY)).toBe("0")
    unmount()

    const again = renderHook(() => usePlanGemMode())
    expect(again.result.current[0]).toBe(false)
  })
})
