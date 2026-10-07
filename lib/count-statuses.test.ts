import { beforeEach, describe, expect, it } from "vitest"
import { resetAllStores } from "@/tests/test-utils"
import { applyDiscreteLog } from "@/lib/ingest/apply-discrete-event"
import { useLogKeywordsStore } from "@/lib/log-keywords-store"
import { useTimeTrackingStore } from "@/lib/time-tracking-store"
import {
  COUNT_STATUSES_STORAGE_KEY,
  recordCountForKeyword,
  useCountStatusesStore,
} from "./count-statuses"

const SENT = new Date(2026, 9, 6, 12, 4, 0)

describe("count statuses", () => {
  beforeEach(() => {
    resetAllStores()
  })

  it("creates a count and stores one tick with a date and minute", () => {
    expect(COUNT_STATUSES_STORAGE_KEY).toBe("brain2-count-statuses")
    const id = useCountStatusesStore.getState().addCount({ name: "days happy" })
    expect(id).toBeTruthy()
    const tick = useCountStatusesStore.getState().incrementCount(id!, {
      date: "2026-06-20",
      startMin: 12 * 60 + 4,
      clockCertainty: "exact",
    })
    expect(tick).toMatchObject({ date: "2026-06-20", startMin: 12 * 60 + 4 })
    const count = useCountStatusesStore.getState().counts.find((row) => row.id === id)
    expect(count?.ticks).toHaveLength(1)
    expect(count?.ticks[0]).toMatchObject({ date: "2026-06-20", startMin: 12 * 60 + 4 })
  })

  it("records a tick when a saved keyword is bound to a count", () => {
    useCountStatusesStore.getState().addCount({ name: "joints", keyword: "joints" })
    expect(useLogKeywordsStore.getState().keywords.map((row) => (typeof row === "string" ? row : row.phrase))).toContain(
      "joints",
    )

    const logged = applyDiscreteLog("joints", SENT)
    expect(logged.status).toBe("ok")

    const count = useCountStatusesStore.getState().counts.find((row) => row.name === "joints")
    expect(count?.ticks).toHaveLength(1)
    expect(count?.ticks[0]).toMatchObject({ date: "2026-10-06", startMin: 12 * 60 + 4 })
  })

  it("leaves a phrase with no bound count untouched", () => {
    useLogKeywordsStore.getState().addKeyword("went outside")
    applyDiscreteLog("went outside", SENT)
    expect(useCountStatusesStore.getState().counts).toEqual([])
    expect(recordCountForKeyword("went outside", { date: "2026-10-06", startMin: 12 * 60 + 4 })).toBe(false)
  })

  it("paints intake.drug when the count has that class, and delete keeps the instant", () => {
    const id = useCountStatusesStore.getState().addCount({ name: "joints", intakeClass: "drug" })
    useCountStatusesStore.getState().incrementCount(id!, {
      date: "2026-10-06",
      startMin: 12 * 60 + 4,
    })
    const painted = useTimeTrackingStore.getState().entries.find((entry) => entry.title === "joints")
    expect(painted).toMatchObject({
      kind: "instant",
      intakeClass: "drug",
      eventKind: "intake.drug",
      startMin: 12 * 60 + 4,
      date: "2026-10-06",
    })

    useCountStatusesStore.getState().removeCount(id!)
    expect(useCountStatusesStore.getState().counts).toEqual([])
    expect(useTimeTrackingStore.getState().entries.some((entry) => entry.id === painted?.id)).toBe(true)
  })
})
