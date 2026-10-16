import { beforeEach, describe, expect, it } from "vitest"
import { act, renderHook } from "@testing-library/react"
import { usePointsStore } from "@/lib/points-store"
import {
  getPointsVisibility,
  resetPointsVisibilityForTests,
  setPointsVisibility,
  useStepPointsVisible,
} from "@/lib/points-visibility"

describe("Points visible (Phase 15 D)", () => {
  beforeEach(() => {
    localStorage.clear()
    resetPointsVisibilityForTests()
  })

  it("is off for step points by default", () => {
    expect(getPointsVisibility().stepPoints).toBe(false)
    const { result } = renderHook(() => useStepPointsVisible())
    expect(result.current).toBe(false)
  })

  it("turns on and persists, and never touches the points store", () => {
    usePointsStore.getState().addPoints("task-1", 10, "Taxes", new Date(2026, 9, 16))
    const before = JSON.stringify(usePointsStore.getState().pointsHistory)
    const { result } = renderHook(() => useStepPointsVisible())
    act(() => setPointsVisibility({ stepPoints: true }))
    expect(result.current).toBe(true)
    resetPointsVisibilityForTests()
    expect(getPointsVisibility().stepPoints).toBe(true)
    act(() => setPointsVisibility({ stepPoints: false }))
    expect(JSON.stringify(usePointsStore.getState().pointsHistory)).toBe(before)
  })
})
