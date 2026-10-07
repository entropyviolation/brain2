import { beforeEach, describe, expect, it } from "vitest"
import { DEFAULT_SKY_MOTION, sanitizeSkyMotion, SKY_MOTION_STORAGE_KEY, useSkyMotionStore } from "./sky-motion-store"

describe("sky motion store", () => {
  beforeEach(() => {
    localStorage.clear()
    useSkyMotionStore.setState({ ...DEFAULT_SKY_MOTION })
  })

  it("starts at the reference zoom and real time", () => {
    const state = useSkyMotionStore.getState()
    expect(state.viewWidthLog).toBe(3.5)
    expect(state.rateIndex).toBe(0)
  })

  it("saves view width and time rate, and reset returns only the rate", async () => {
    const state = useSkyMotionStore.getState()
    state.setViewWidthLog(4.4)
    state.setRateIndex(4)
    expect(useSkyMotionStore.getState().viewWidthLog).toBe(4.4)
    expect(useSkyMotionStore.getState().rateIndex).toBe(4)

    const raw = localStorage.getItem(SKY_MOTION_STORAGE_KEY)
    expect(raw).toContain('"viewWidthLog":4.4')
    expect(raw).toContain('"rateIndex":4')

    useSkyMotionStore.getState().resetTimeRate()
    expect(useSkyMotionStore.getState().rateIndex).toBe(0)
    expect(useSkyMotionStore.getState().viewWidthLog).toBe(4.4)

    useSkyMotionStore.setState({ viewWidthLog: 3.5, rateIndex: 0 })
    localStorage.setItem(
      SKY_MOTION_STORAGE_KEY,
      JSON.stringify({ state: { viewWidthLog: 6.2, rateIndex: 6 }, version: 1 }),
    )
    await useSkyMotionStore.persist.rehydrate()
    expect(useSkyMotionStore.getState().viewWidthLog).toBe(6.2)
    expect(useSkyMotionStore.getState().rateIndex).toBe(6)
  })

  it("drops a broken blob back to the defaults", () => {
    expect(sanitizeSkyMotion(null)).toEqual(DEFAULT_SKY_MOTION)
    expect(sanitizeSkyMotion({ viewWidthLog: 99, rateIndex: -2 })).toEqual({
      viewWidthLog: 10,
      rateIndex: 0,
    })
  })
})
