/**
 * lib/phone-sync/health.test.ts — All-time pages, and what one page writes
 */
import { beforeEach, describe, expect, it } from "vitest"
import { resetAllStores } from "@/tests/test-utils"
import { useSleepStore } from "@/lib/sleep-store"
import { useTimeTrackingStore } from "@/lib/time-tracking-store"
import { commitHealthPage } from "./health-apply"
import { useHealthImportStore } from "./health-store"
import {
  HEALTH_PAGE_MS,
  healthPages,
  healthRangeStart,
  mergeHealthPage,
  nightsFromSleepSamples,
  parseHealthPage,
  runHealthImport,
  type HealthMergeState,
} from "./health"

const DAY = 24 * 60 * 60 * 1000

function blankState(): HealthMergeState {
  return {
    days: {},
    ledger: {},
    sleep: {},
    entries: [],
    removedEntryIds: [],
    scopes: useTimeTrackingStore.getState().scopes,
  }
}

beforeEach(() => {
  resetAllStores()
  useHealthImportStore.setState({ days: {}, nights: {} })
})

describe("healthPages", () => {
  it("covers the whole span in order, with no gap and no page longer than the window", () => {
    const start = Date.UTC(2016, 0, 1)
    const until = start + 100 * DAY
    const pageMs = 30 * DAY
    const pages = healthPages(start, until, pageMs)
    expect(pages.length).toBe(4)
    expect(pages[0].startMs).toBe(start)
    expect(pages[pages.length - 1].endMs).toBe(until)
    for (let i = 1; i < pages.length; i++) expect(pages[i].startMs).toBe(pages[i - 1].endMs)
    for (const page of pages) expect(page.endMs - page.startMs).toBeLessThanOrEqual(pageMs)
  })

  it("does not collapse a long history into one recent window", () => {
    const start = Date.UTC(2014, 5, 1)
    const until = Date.UTC(2024, 5, 1)
    const pages = healthPages(start, until, HEALTH_PAGE_MS)
    expect(pages.length).toBeGreaterThan(100)
    expect(pages[0].startMs).toBe(start)
    expect(pages[pages.length - 1].endMs).toBe(until)
  })

  it("is empty when there is nothing to read", () => {
    expect(healthPages(10, 10)).toEqual([])
    expect(healthPages(20, 10)).toEqual([])
  })

  it("starts the first page at local midnight of the oldest sample", () => {
    const sample = new Date(2019, 3, 2, 15, 45).getTime()
    expect(healthRangeStart(sample)).toBe(new Date(2019, 3, 2).getTime())
  })
})

describe("parse and sleep", () => {
  it("drops junk rows and keeps a day, a night, and a workout", () => {
    const parsed = parseHealthPage({
      days: [{ date: "nope", steps: 3 }, { date: "2019-04-02", steps: 1200.4, heartAvg: 62 }, { date: "2019-04-03" }],
      sleeps: [
        { id: "", startMs: 1, endMs: 2, stage: "asleep" },
        { id: "s1", startMs: 2, endMs: 1, stage: "asleep" },
        { id: "s2", startMs: 1, endMs: 2, stage: "awake" },
      ],
      workouts: [{ id: "w1", activity: "Running", startMs: 5, endMs: 6 }, { id: "long", startMs: 0, endMs: 40 * 60 * 60 * 1000 }],
    })
    expect(parsed.days).toEqual([{ date: "2019-04-02", steps: 1200, heartAvg: 62 }])
    expect(parsed.sleeps.map((s) => s.id)).toEqual(["s2"])
    expect(parsed.workouts.map((w) => w.id)).toEqual(["w1"])
  })

  it("turns a night that crosses midnight into the morning's clocks", () => {
    const start = new Date(2024, 0, 16, 23, 30).getTime()
    const end = new Date(2024, 0, 17, 7, 0).getTime()
    const nights = nightsFromSleepSamples([
      { id: "a", startMs: start, endMs: new Date(2024, 0, 17, 1, 0).getTime(), stage: "asleep" },
      { id: "b", startMs: new Date(2024, 0, 17, 1, 20).getTime(), endMs: end, stage: "asleep" },
      { id: "bed", startMs: new Date(2024, 0, 16, 22, 0).getTime(), endMs: end, stage: "inBed" },
      { id: "up", startMs: new Date(2024, 0, 17, 3, 0).getTime(), endMs: new Date(2024, 0, 17, 3, 10).getTime(), stage: "awake" },
    ])
    expect(nights).toEqual([{ date: "2024-01-17", sleptMin: -30, wokeMin: 7 * 60 }])
  })
})

describe("mergeHealthPage", () => {
  it("writes a day, a night, and a workout, and a second pass adds nothing", () => {
    const raw = {
      days: [{ date: "2024-01-17", steps: 4000, distanceM: 3000, flights: 4, activeKcal: 180, heartAvg: 70, heartMin: 52, heartMax: 140 }],
      sleeps: [
        {
          id: "night",
          startMs: new Date(2024, 0, 16, 23, 0).getTime(),
          endMs: new Date(2024, 0, 17, 6, 30).getTime(),
          stage: "asleep",
        },
      ],
      workouts: [
        {
          id: "run",
          activity: "Running",
          startMs: new Date(2024, 0, 17, 18, 0).getTime(),
          endMs: new Date(2024, 0, 17, 18, 40).getTime(),
        },
      ],
    }
    const first = mergeHealthPage(blankState(), raw)
    expect(first.write.written).toEqual({ days: 1, nights: 1, workouts: 1 })
    expect(first.state.days["2024-01-17"].steps).toBe(4000)
    expect(first.state.sleep["2024-01-17"]).toMatchObject({ sleptMin: -60, wokeMin: 390 })
    expect(first.state.entries.some((e) => e.title === "Running" && e.penId === "act-exercise")).toBe(true)

    const second = mergeHealthPage(first.state, raw)
    expect(second.write.written).toEqual({ days: 0, nights: 0, workouts: 0 })
    expect(second.state.entries).toHaveLength(first.state.entries.length)
  })

  it("does not replace a morning the person already logged", () => {
    const state = blankState()
    state.sleep = { "2024-01-17": { date: "2024-01-17", sleptMin: -20, wokeMin: 400 } }
    const merged = mergeHealthPage(state, {
      sleeps: [
        {
          id: "night",
          startMs: new Date(2024, 0, 16, 22, 0).getTime(),
          endMs: new Date(2024, 0, 17, 9, 0).getTime(),
          stage: "asleep",
        },
      ],
    })
    expect(merged.write.written.nights).toBe(0)
    expect(merged.state.sleep["2024-01-17"]).toMatchObject({ sleptMin: -20, wokeMin: 400 })
  })
})

describe("commitHealthPage", () => {
  it("lands the page in the sleep log, the health days, and Activity", () => {
    commitHealthPage({
      days: [{ date: "2024-01-17", steps: 10 }],
      sleeps: [
        {
          id: "night",
          startMs: new Date(2024, 0, 16, 23, 30).getTime(),
          endMs: new Date(2024, 0, 17, 7, 0).getTime(),
          stage: "asleep",
        },
      ],
      workouts: [
        {
          id: "run",
          activity: "Running",
          startMs: new Date(2024, 0, 17, 8, 0).getTime(),
          endMs: new Date(2024, 0, 17, 8, 30).getTime(),
        },
      ],
    })
    expect(useHealthImportStore.getState().days["2024-01-17"].steps).toBe(10)
    expect(useSleepStore.getState().nights["2024-01-17"]).toMatchObject({ sleptMin: -30, wokeMin: 420 })
    expect(useTimeTrackingStore.getState().entries.some((e) => e.title === "Running")).toBe(true)
  })
})

describe("runHealthImport", () => {
  it("asks for every page from the oldest day through now", async () => {
    const earliest = new Date(2018, 5, 15, 16, 0).getTime()
    const until = new Date(2018, 8, 20, 12, 0).getTime()
    const calls: { startMs: number; endMs: number }[] = []
    const result = await runHealthImport(
      {
        requestAccess: async () => ({ ok: true }),
        earliest: async () => ({ at: earliest }),
        readPage: async (startMs, endMs) => {
          calls.push({ startMs, endMs })
          return { raw: { days: [{ date: "2018-06-15", steps: calls.length }] } }
        },
      },
      {
        untilMs: until,
        pageMs: 30 * DAY,
        apply: (raw) => {
          const days = (raw as { days: unknown[] }).days.length
          return { read: { days, nights: 0, workouts: 0 }, written: { days, nights: 0, workouts: 0 } }
        },
      },
    )
    expect(calls.length).toBeGreaterThan(2)
    expect(calls[0].startMs).toBe(new Date(2018, 5, 15).getTime())
    expect(calls[calls.length - 1].endMs).toBe(until)
    for (let i = 1; i < calls.length; i++) expect(calls[i].startMs).toBe(calls[i - 1].endMs)
    expect(result.status).toBe("imported")
    expect(result.written.days).toBe(calls.length)
    expect(result.message).toMatch(/Imported \d+ days/)
  })

  it("stops on a denied permission and does not read pages", async () => {
    const readPage = async () => ({ raw: {} })
    const result = await runHealthImport(
      { requestAccess: async () => ({ denied: true }), earliest: async () => ({ at: 1 }), readPage },
      { untilMs: Date.now(), apply: () => ({ read: { days: 0, nights: 0, workouts: 0 }, written: { days: 0, nights: 0, workouts: 0 } }) },
    )
    expect(result.status).toBe("denied")
    expect(result.message).toMatch(/Health access is off/)
  })

  it("says when Health returned nothing", async () => {
    const result = await runHealthImport(
      { requestAccess: async () => ({ ok: true }), earliest: async () => ({ at: null }), readPage: async () => ({ raw: {} }) },
      { untilMs: Date.now(), apply: () => ({ read: { days: 0, nights: 0, workouts: 0 }, written: { days: 0, nights: 0, workouts: 0 } }) },
    )
    expect(result.status).toBe("empty")
    expect(result.message).toMatch(/returned nothing/)
  })

  it("keeps a page error visible", async () => {
    const result = await runHealthImport(
      {
        requestAccess: async () => ({ ok: true }),
        earliest: async () => ({ at: new Date(2020, 0, 1).getTime() }),
        readPage: async () => ({ raw: {}, error: "Health query failed." }),
      },
      { untilMs: new Date(2020, 0, 2).getTime(), apply: () => ({ read: { days: 0, nights: 0, workouts: 0 }, written: { days: 0, nights: 0, workouts: 0 } }) },
    )
    expect(result.status).toBe("failed")
    expect(result.message).toMatch(/Health query failed/)
  })
})
