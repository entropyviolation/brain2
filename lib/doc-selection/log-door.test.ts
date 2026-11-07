import { describe, expect, it } from "vitest"
import { applyDiscreteLog } from "@/lib/ingest/apply-discrete-event"
import { useTimeTrackingStore } from "@/lib/time-tracking-store"

describe("Turn into log writes at the chosen clock", () => {
  it("puts the tick on the picked minute", () => {
    const result = applyDiscreteLog("walked outside", new Date(2026, 10, 7, 10, 30), { keywordQuery: false })
    expect(result.status).toBe("ok")
    const entry = useTimeTrackingStore.getState().entries.find((e) => e.title === "walked outside")
    expect(entry?.startMin).toBe(630)
  })
})
