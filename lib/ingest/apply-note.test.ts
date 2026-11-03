import { beforeEach, describe, expect, it } from "vitest"
import { resetAllStores } from "@/tests/test-utils"
import { ACTIVITY_SCOPE_ID } from "@/components/Home/Tracking/tracking-log-model"
import { useTimeTrackingStore } from "@/lib/time-tracking-store"
import { applyNote } from "./apply-note"

describe("applyNote", () => {
  beforeEach(() => {
    resetAllStores()
  })

  it("still appends the phrase onto the block covering that minute", () => {
    useTimeTrackingStore.getState().paintMinutes(
      "2026-06-20",
      ACTIVITY_SCOPE_ID,
      8 * 60,
      10 * 60,
      "act-work",
      undefined,
      undefined,
      undefined,
      { title: "work", notes: "already" },
    )
    const result = applyNote("stuck in aisle 4", new Date(2026, 5, 20, 8, 30))
    expect(result.status).toBe("ok")
    const entries = useTimeTrackingStore.getState().entries
    const block = entries.find((entry) => entry.penId === "act-work" && entry.kind !== "instant")
    const instant = entries.find((entry) => entry.kind === "instant")
    expect(block?.notes).toBe("already\nstuck in aisle 4")
    expect(instant?.title).toBe("stuck in aisle 4")
    expect(instant?.logSource).toBe("bim")
    expect(instant?.eventKind).toBeUndefined()
  })
})