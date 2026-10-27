import { describe, expect, it } from "vitest"
import type { TimeEntry } from "@/lib/time-entries"
import { buildFilmstripDayTicks, buildPeriodFilmstrip } from "./period-filmstrip"

function entry(partial: Partial<TimeEntry> & Pick<TimeEntry, "id" | "penId" | "startMin" | "endMin">): TimeEntry {
  return { scopeId: "activity", date: "2026-09-21", ...partial }
}

const pens = [
  { id: "sleep", name: "Sleep", color: "#224" },
  { id: "work", name: "Work", color: "#c60" },
]

describe("buildPeriodFilmstrip", () => {
  it("counts overlapping paint once so the day plus gaps is 1440", () => {
    const segments = buildPeriodFilmstrip({
      dateKeys: ["2026-09-21"],
      entries: [
        entry({ id: "sleep", penId: "sleep", startMin: 0, endMin: 10 * 60 }),
        entry({ id: "work", penId: "work", startMin: 9 * 60, endMin: 10 * 60 }),
      ],
      pens,
      depth: 0,
      scopeId: "activity",
      showUntracked: true,
      untrackedColor: "#eee",
      untrackedLabel: "Untracked",
    })
    expect(segments.reduce((sum, seg) => sum + seg.minutes, 0)).toBe(1440)
    const blocks = segments.filter((seg) => seg.kind === "block")
    expect(blocks.map((seg) => seg.entryId)).toEqual(["sleep", "work"])
    expect(blocks.find((seg) => seg.entryId === "work")?.minutes).toBe(60)
    expect(buildFilmstripDayTicks(["2026-09-21", "2026-09-22"]).map((tick) => tick.offsetMin)).toEqual([0, 1440])
  })

  it("keeps last-writer when two blocks share a start and the longer one is listed first", () => {
    const segments = buildPeriodFilmstrip({
      dateKeys: ["2026-09-21"],
      entries: [
        entry({ id: "long", penId: "work", startMin: 0, endMin: 60 }),
        entry({ id: "short", penId: "sleep", startMin: 0, endMin: 30 }),
      ],
      pens,
      depth: 0,
      scopeId: "activity",
      showUntracked: false,
      untrackedColor: "#eee",
      untrackedLabel: "Untracked",
    })
    const blocks = segments.filter((seg) => seg.kind === "block")
    expect(blocks).toHaveLength(1)
    expect(blocks[0].entryId).toBe("long")
    expect(blocks[0].minutes).toBe(60)
    expect(segments.reduce((sum, seg) => sum + seg.minutes, 0)).toBe(1440)
  })

  it("leaves a fully covered block out of the bar", () => {
    const segments = buildPeriodFilmstrip({
      dateKeys: ["2026-09-21"],
      entries: [
        entry({ id: "sleep", penId: "sleep", startMin: 0, endMin: 60 }),
        entry({ id: "work", penId: "work", startMin: 0, endMin: 60 }),
      ],
      pens,
      depth: 0,
      scopeId: "activity",
      showUntracked: false,
      untrackedColor: "#eee",
      untrackedLabel: "Untracked",
    })
    const blocks = segments.filter((seg) => seg.kind === "block")
    expect(blocks).toHaveLength(1)
    expect(blocks[0].entryId).toBe("work")
    expect(segments.reduce((sum, seg) => sum + seg.minutes, 0)).toBe(1440)
  })
})
