import { beforeEach, describe, expect, it } from "vitest"
import { resetAllStores } from "@/tests/test-utils"
import { applyDiscreteLog } from "@/lib/ingest/apply-discrete-event"
import { useLogKeywordsStore } from "@/lib/log-keywords-store"
import { useTimeTrackingStore } from "@/lib/time-tracking-store"
import {
  COUNT_STATUSES_STORAGE_KEY,
  incrementCountForEntry,
  migrateCountStatuses,
  recordCountForKeyword,
  removeCountTickForEntry,
  sanitizeCountStatuses,
  syncCountTicksForEntry,
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
    expect(useCountStatusesStore.getState().counts.map((row) => row.name)).toEqual(["Shower"])
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
    expect(useCountStatusesStore.getState().counts.map((row) => row.name)).toEqual(["Shower"])
    expect(useTimeTrackingStore.getState().entries.some((entry) => entry.id === painted?.id)).toBe(true)
  })

  it("seeds Shower once and does not recreate it after delete", () => {
    const shower = useCountStatusesStore.getState().counts.find((row) => row.id === "count-shower")
    expect(shower).toMatchObject({ name: "Shower", keyword: "shower" })
    expect(shower?.intakeClass).toBeUndefined()
    useCountStatusesStore.getState().removeCount("count-shower")
    expect(useCountStatusesStore.getState().builtins.shower).toBe("removed")
    const migrated = migrateCountStatuses(
      { counts: [], builtins: { shower: "removed", showerBackfill: "done" } },
      2,
    )
    expect(migrated.counts.some((row) => row.id === "count-shower")).toBe(false)
    expect(migrated.builtins.shower).toBe("removed")
  })

  it("backfills a shower instant once per date and minute", () => {
    useTimeTrackingStore.setState({
      entries: [
        {
          id: "a",
          date: "2026-10-01",
          scopeId: "activity",
          penId: "p",
          startMin: 480,
          endMin: 480,
          kind: "instant",
          title: "Shower",
          eventKind: "shower",
        },
        {
          id: "b",
          date: "2026-10-01",
          scopeId: "activity",
          penId: "p",
          startMin: 480,
          endMin: 490,
          kind: "interval",
          title: "shower",
        },
        {
          id: "c",
          date: "2026-10-02",
          scopeId: "activity",
          penId: "p",
          startMin: 500,
          endMin: 500,
          kind: "instant",
          title: "shower time",
          eventKind: "shower",
        },
        {
          id: "d",
          date: "2026-10-03",
          scopeId: "location",
          penId: "p",
          startMin: 600,
          endMin: 600,
          kind: "instant",
          title: "shower",
          logSource: "nfc",
          generatedBy: { kind: "text", id: "nfc:shower:x" },
        },
      ],
    })
    const first = migrateCountStatuses({ counts: [] }, 1)
    const ticks = first.counts.find((row) => row.id === "count-shower")?.ticks ?? []
    expect(ticks.map((tick) => `${tick.date}|${tick.startMin}`).sort()).toEqual([
      "2026-10-01|480",
      "2026-10-02|500",
      "2026-10-03|600",
    ])
    const again = migrateCountStatuses(first, 2)
    expect(again.counts.find((row) => row.id === "count-shower")?.ticks).toHaveLength(3)
  })

  it("ticks once for log: shower and once for a 10m shower", () => {
    const point = applyDiscreteLog("shower", SENT)
    expect(point.status).toBe("ok")
    const ranged = applyDiscreteLog("shower 10m", SENT)
    expect(ranged.status).toBe("ok")
    const ticks = useCountStatusesStore.getState().counts.find((row) => row.id === "count-shower")?.ticks ?? []
    expect(ticks).toHaveLength(2)
    expect(useTimeTrackingStore.getState().entries.some((entry) => entry.title === "shower" && entry.kind === "instant")).toBe(
      true,
    )
    expect(useTimeTrackingStore.getState().entries.some((entry) => entry.title === "shower" && entry.kind !== "instant")).toBe(
      true,
    )
  })

  it("links a tick to an existing instant without painting another row", () => {
    const before = useTimeTrackingStore.getState().entries.length
    useTimeTrackingStore.setState({
      entries: [
        ...useTimeTrackingStore.getState().entries,
        {
          id: "log-1",
          date: "2026-04-02",
          scopeId: "activity",
          penId: "act-work",
          startMin: 615,
          endMin: 615,
          kind: "instant",
          title: "coffee",
          clockCertainty: "estimated",
        },
      ],
    })
    const id = useCountStatusesStore.getState().addCount({ name: "joints", intakeClass: "drug" })
    expect(incrementCountForEntry(id!, "missing")).toBe(false)
    expect(incrementCountForEntry(id!, "log-1")).toBe(true)
    expect(incrementCountForEntry(id!, "log-1")).toBe(true)
    const ticks = useCountStatusesStore.getState().counts.find((row) => row.id === id)?.ticks ?? []
    expect(ticks).toHaveLength(1)
    expect(ticks[0]).toMatchObject({
      date: "2026-04-02",
      startMin: 615,
      clockCertainty: "estimated",
      sourceEntryId: "log-1",
    })
    expect(useTimeTrackingStore.getState().entries).toHaveLength(before + 1)
    expect(useTimeTrackingStore.getState().entries.some((entry) => entry.eventKind === "intake.drug")).toBe(false)

    useTimeTrackingStore.getState().updateEntry("log-1", {
      date: "2026-04-03",
      startMin: 700,
      endMin: 700,
      clockCertainty: "exact",
    })
    syncCountTicksForEntry("missing")
    expect(useCountStatusesStore.getState().counts.find((row) => row.id === id)?.ticks[0]?.startMin).toBe(615)
    syncCountTicksForEntry("log-1")
    expect(useCountStatusesStore.getState().counts.find((row) => row.id === id)?.ticks[0]).toMatchObject({
      date: "2026-04-03",
      startMin: 700,
      sourceEntryId: "log-1",
    })
    expect(useCountStatusesStore.getState().counts.find((row) => row.id === id)?.ticks[0]?.clockCertainty).toBeUndefined()

    useCountStatusesStore.getState().incrementCount(id!, { date: "2026-01-01", startMin: 10 })
    expect(removeCountTickForEntry(id!, "other")).toBe(false)
    expect(removeCountTickForEntry(id!, "log-1")).toBe(true)
    const left = useCountStatusesStore.getState().counts.find((row) => row.id === id)?.ticks ?? []
    expect(left).toHaveLength(1)
    expect(left[0]?.sourceEntryId).toBeUndefined()
    expect(removeCountTickForEntry(id!, "log-1")).toBe(false)
  })

  it("keeps sourceEntryId on ticks that were saved before this field existed", () => {
    const counts = sanitizeCountStatuses({
      counts: [
        {
          id: "count-old",
          name: "days happy",
          ticks: [
            { id: "tick-old", date: "2026-04-02", startMin: 10 },
            { id: "tick-new", date: "2026-04-02", startMin: 11, sourceEntryId: "log-9" },
          ],
        },
      ],
    })
    expect(counts[0]?.ticks[0]?.sourceEntryId).toBeUndefined()
    expect(counts[0]?.ticks[1]?.sourceEntryId).toBe("log-9")
  })
})
