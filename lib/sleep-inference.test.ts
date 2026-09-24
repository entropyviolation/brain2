import { describe, it, expect } from "vitest"
import { inferNight, resolveNights, sleepRunsOn, straySleep } from "@/lib/sleep-inference"
import { SLEEP_TAG_ID, sleepMinutes, type SleepNight } from "@/lib/sleep-log"
import type { TimeEntry } from "@/lib/time-entries"
import type { TrackScope } from "@/lib/time-tracking-store"

const scopes: TrackScope[] = [
  {
    id: "activity",
    name: "Activity",
    pens: [
      { id: "act-sleep", name: "Sleep", color: "#000", tags: [SLEEP_TAG_ID] },
      { id: "act-work", name: "Work", color: "#00f", tags: ["tag-work"] },
    ],
  },
  {
    id: "location",
    name: "Location",
    pens: [{ id: "loc-home", name: "Home", color: "#0f0" }],
  },
]

let seq = 0
const block = (over: Partial<TimeEntry> & Pick<TimeEntry, "date" | "startMin" | "endMin">): TimeEntry => ({
  id: `e-${++seq}`,
  scopeId: "activity",
  penId: "act-sleep",
  ...over,
})

const source = (entries: TimeEntry[]) => ({ scopes, entries })

describe("sleepRunsOn", () => {
  it("merges touching sleep blocks into one run", () => {
    const entries = [
      block({ date: "2026-09-16", startMin: 1380, endMin: 1410 }),
      block({ date: "2026-09-16", startMin: 1410, endMin: 1440 }),
    ]
    expect(sleepRunsOn(source(entries), "2026-09-16")).toEqual([{ startMin: 1380, endMin: 1440 }])
  })

  it("ignores time that is not sleep", () => {
    const entries = [block({ date: "2026-09-16", startMin: 540, endMin: 600, penId: "act-work" })]
    expect(sleepRunsOn(source(entries), "2026-09-16")).toEqual([])
  })

  it("counts a block tagged as sleep in another scope", () => {
    const entries = [
      block({ date: "2026-09-16", scopeId: "location", penId: "loc-home", startMin: 1320, endMin: 1440, tagIds: [SLEEP_TAG_ID] }),
    ]
    expect(sleepRunsOn(source(entries), "2026-09-16")).toEqual([{ startMin: 1320, endMin: 1440 }])
  })

  it("ignores blocks the sleep log itself generated", () => {
    const entries = [
      block({ date: "2026-09-16", startMin: 1320, endMin: 1440, generatedBy: { kind: "sleep", id: "2026-09-17" } }),
    ]
    expect(sleepRunsOn(source(entries), "2026-09-16")).toEqual([])
  })
})

describe("inferNight", () => {
  it("reads both ends off a night painted across midnight", () => {
    const entries = [
      block({ date: "2026-09-16", startMin: 1380, endMin: 1440 }),
      block({ date: "2026-09-17", startMin: 0, endMin: 435 }),
    ]
    const night = inferNight(source(entries), "2026-09-17")
    expect(night).toMatchObject({ sleptMin: -60, wokeMin: 435, source: "tracked" })
    expect(sleepMinutes(night)).toBe(495)
  })

  it("marks both ends estimated — painted time is weaker than a stated time", () => {
    const entries = [
      block({ date: "2026-09-16", startMin: 1380, endMin: 1440 }),
      block({ date: "2026-09-17", startMin: 0, endMin: 435 }),
    ]
    expect(inferNight(source(entries), "2026-09-17")).toMatchObject({
      sleptPrecision: "estimated",
      wokePrecision: "estimated",
    })
  })

  it("keeps one end when only one side of midnight was painted", () => {
    const entries = [block({ date: "2026-09-16", startMin: 1350, endMin: 1440 })]
    const night = inferNight(source(entries), "2026-09-17")
    expect(night).toMatchObject({ sleptMin: -90 })
    expect(night?.wokeMin).toBeUndefined()
    expect(sleepMinutes(night)).toBeNull()
  })

  it("takes a long stretch in the small hours as a night of its own", () => {
    const entries = [block({ date: "2026-09-17", startMin: 75, endMin: 465 })]
    expect(inferNight(source(entries), "2026-09-17")).toMatchObject({ sleptMin: 75, wokeMin: 465 })
  })

  it("does not read a short morning doze as a night", () => {
    const entries = [block({ date: "2026-09-17", startMin: 480, endMin: 505 })]
    expect(inferNight(source(entries), "2026-09-17")).toBeUndefined()
  })

  it("does not read an afternoon nap as a night", () => {
    const entries = [block({ date: "2026-09-17", startMin: 780, endMin: 1020 })]
    expect(inferNight(source(entries), "2026-09-17")).toBeUndefined()
  })

  it("says nothing when nothing is painted", () => {
    expect(inferNight(source([]), "2026-09-17")).toBeUndefined()
  })
})

describe("resolveNights", () => {
  const painted = [
    block({ date: "2026-09-16", startMin: 1380, endMin: 1440 }),
    block({ date: "2026-09-17", startMin: 0, endMin: 435 }),
  ]

  it("prefers what the user said over what they painted", () => {
    const logged: Record<string, SleepNight> = {
      "2026-09-17": { date: "2026-09-17", sleptMin: -30, wokeMin: 420, sleptPrecision: "definite" },
    }
    const resolved = resolveNights(logged, source(painted), ["2026-09-17"])
    expect(resolved["2026-09-17"]).toMatchObject({ sleptMin: -30, wokeMin: 420 })
    expect(resolved["2026-09-17"].source).toBeUndefined()
  })

  it("fills a night the user never logged", () => {
    const resolved = resolveNights({}, source(painted), ["2026-09-17"])
    expect(resolved["2026-09-17"]).toMatchObject({ sleptMin: -60, wokeMin: 435, source: "tracked" })
  })

  it("borrows only the end that is missing", () => {
    const logged: Record<string, SleepNight> = {
      "2026-09-17": { date: "2026-09-17", wokeMin: 400, wokePrecision: "definite" },
    }
    const resolved = resolveNights(logged, source(painted), ["2026-09-17"])
    expect(resolved["2026-09-17"]).toMatchObject({
      sleptMin: -60,
      wokeMin: 400,
      sleptPrecision: "estimated",
      wokePrecision: "definite",
      source: "mixed",
    })
  })

  it("leaves a night blank when neither the log nor the grid knows", () => {
    expect(resolveNights({}, source([]), ["2026-09-17"])["2026-09-17"]).toBeUndefined()
  })

  it("keeps a logged night that the grid cannot complete", () => {
    const logged: Record<string, SleepNight> = { "2026-09-17": { date: "2026-09-17", wokeMin: 400 } }
    const resolved = resolveNights(logged, source([]), ["2026-09-17"])
    expect(resolved["2026-09-17"]).toMatchObject({ wokeMin: 400 })
  })
})

describe("straySleep", () => {
  const nights: Record<string, SleepNight> = {
    "2026-09-17": { date: "2026-09-17", sleptMin: -30, wokeMin: 420 },
  }

  it("counts an afternoon nap the nightly view has no room for", () => {
    const entries = [
      block({ date: "2026-09-17", startMin: 0, endMin: 420 }),
      block({ date: "2026-09-17", startMin: 840, endMin: 900 }),
    ]
    const stray = straySleep(source(entries), nights, ["2026-09-16", "2026-09-17"])
    expect(stray.minutes).toBe(60)
    expect(stray.days).toEqual([{ date: "2026-09-17", minutes: 60 }])
  })

  it("does not count the night itself twice", () => {
    const entries = [
      block({ date: "2026-09-16", startMin: 1410, endMin: 1440 }),
      block({ date: "2026-09-17", startMin: 0, endMin: 420 }),
    ]
    expect(straySleep(source(entries), nights, ["2026-09-16", "2026-09-17"]).minutes).toBe(0)
  })

  it("ignores the blocks the log painted itself", () => {
    const entries = [
      block({ date: "2026-09-17", startMin: 0, endMin: 420, generatedBy: { kind: "sleep", id: "2026-09-17" } }),
    ]
    expect(straySleep(source(entries), {}, ["2026-09-17"]).minutes).toBe(0)
  })

  it("reports nothing when no sleep was painted at all", () => {
    expect(straySleep(source([]), nights, ["2026-09-17"])).toEqual({ minutes: 0, days: [] })
  })
})
