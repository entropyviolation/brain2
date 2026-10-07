import { beforeEach, describe, expect, it } from "vitest"
import { useCycleMarksStore } from "@/lib/cycle-marks"
import { persistKey, readAliasedLocal, writeAliasedLocal } from "@/lib/storage-keys"
import { resetAllStores } from "@/tests/test-utils"
import {
  TIME_TRACKING_PERSIST_VERSION,
  migrateTimeTrackingState,
  useTimeTrackingStore,
} from "./time-tracking-store"

const MARKS_KEY = persistKey("cycle-marks")
const TIMEGRID_KEY = persistKey("timegrid-store")

describe("enableCycleTracking persist", () => {
  beforeEach(() => {
    localStorage.clear()
    resetAllStores()
  })

  it("starts false on a new store", () => {
    expect(TIME_TRACKING_PERSIST_VERSION).toBe(15)
    expect(useTimeTrackingStore.getInitialState().enableCycleTracking).toBe(false)
    expect(useTimeTrackingStore.getState().enableCycleTracking).toBe(false)
  })

  it("turns the flag on for a previous persist and keeps unrelated fields", () => {
    const previous = {
      gridStep: 5,
      penSort: "alphabetical" as const,
      activeScopeId: "location",
      entries: [{ id: "keep-entry", date: "2026-04-02", scopeId: "activity", penId: "act-work", startMin: 60, endMin: 90 }],
      dayNotes: { "2026-04-02": "kept note" },
    }
    const next = migrateTimeTrackingState(previous, 14)
    expect(next.enableCycleTracking).toBe(true)
    expect(next.gridStep).toBe(5)
    expect(next.penSort).toBe("alphabetical")
    expect(next.activeScopeId).toBe("location")
    expect(next.entries?.[0]?.id).toBe("keep-entry")
    expect(next.dayNotes?.["2026-04-02"]).toBe("kept note")

    const explicit = migrateTimeTrackingState({ ...previous, enableCycleTracking: false }, 14)
    expect(explicit.enableCycleTracking).toBe(false)
    expect(explicit.entries?.[0]?.id).toBe("keep-entry")

    const current = migrateTimeTrackingState({ gridStep: 1 }, 15)
    expect(current.enableCycleTracking).toBeUndefined()
    expect(current.gridStep).toBe(1)
  })

  it("rehydrates an old blob to true without clearing cycle marks", async () => {
    const marksPayload = JSON.stringify({
      state: { marks: { "2026-04-02": { date: "2026-04-02", bleeding: true, spotting: true } } },
      version: 1,
    })
    writeAliasedLocal(MARKS_KEY, marksPayload)
    useCycleMarksStore.setState({
      marks: { "2026-04-02": { date: "2026-04-02", bleeding: true, spotting: true } },
    })
    writeAliasedLocal(
      TIMEGRID_KEY,
      JSON.stringify({
        state: {
          gridStep: 5,
          penSort: "alphabetical",
          activeScopeId: "location",
          entries: [{ id: "keep-entry", date: "2026-04-02", scopeId: "activity", penId: "act-work", startMin: 60, endMin: 90 }],
        },
        version: 14,
      }),
    )

    await useTimeTrackingStore.persist.rehydrate()

    expect(useTimeTrackingStore.getState().enableCycleTracking).toBe(true)
    expect(useTimeTrackingStore.getState().gridStep).toBe(5)
    expect(useTimeTrackingStore.getState().penSort).toBe("alphabetical")
    expect(useTimeTrackingStore.getState().activeScopeId).toBe("location")
    expect(useTimeTrackingStore.getState().entries.some((entry) => entry.id === "keep-entry")).toBe(true)
    expect(readAliasedLocal(MARKS_KEY)).toBe(marksPayload)
    expect(useCycleMarksStore.getState().marks["2026-04-02"]).toMatchObject({
      bleeding: true,
      spotting: true,
    })
  })

  it("keeps cycle details closed when the blob omits the key", async () => {
    expect(TIME_TRACKING_PERSIST_VERSION).toBe(15)
    expect(useTimeTrackingStore.getInitialState().cycleDetailsOpen).toBe(false)
    const kept = migrateTimeTrackingState(
      { gridStep: 10, enableCycleTracking: true, penSort: "alphabetical" },
      15,
    )
    expect(kept.cycleDetailsOpen).toBeUndefined()
    expect(kept.enableCycleTracking).toBe(true)
    expect(kept.gridStep).toBe(10)
    expect(kept.penSort).toBe("alphabetical")

    writeAliasedLocal(
      TIMEGRID_KEY,
      JSON.stringify({
        state: { gridStep: 10, enableCycleTracking: true, penSort: "alphabetical" },
        version: 15,
      }),
    )
    await useTimeTrackingStore.persist.rehydrate()
    expect(useTimeTrackingStore.getState().cycleDetailsOpen).toBe(false)
    expect(useTimeTrackingStore.getState().enableCycleTracking).toBe(true)
    expect(useTimeTrackingStore.getState().gridStep).toBe(10)
    expect(useTimeTrackingStore.getState().penSort).toBe("alphabetical")

    useTimeTrackingStore.getState().setCycleDetailsOpen(true)
    await useTimeTrackingStore.persist.rehydrate()
    expect(useTimeTrackingStore.getState().cycleDetailsOpen).toBe(true)
    expect(useTimeTrackingStore.getState().gridStep).toBe(10)
    expect(useTimeTrackingStore.getState().enableCycleTracking).toBe(true)
  })
})
