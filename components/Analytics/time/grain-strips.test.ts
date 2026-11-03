import { describe, expect, it } from "vitest"
import type { TimeEntry } from "@/lib/time-entries"
import { buildDayGrain, buildWeekGrain, type GrainPen } from "./grain-strips"

function entry(partial: Partial<TimeEntry> & Pick<TimeEntry, "id" | "penId" | "startMin" | "endMin">): TimeEntry {
  return { scopeId: "activity", date: "2026-10-05", ...partial }
}

const pens: GrainPen[] = [
  { id: "sleep", name: "Sleep", color: "#224" },
  { id: "work", name: "Work", color: "#c60" },
  { id: "exercise", name: "Exercise", color: "#16a34a" },
  { id: "walk", name: "Walk", color: "#22c55e", parentId: "exercise", parentIds: ["exercise"] },
]

describe("buildDayGrain", () => {
  it("gives the day to the pen that owned the most minutes, counting overlap once", () => {
    const cells = buildDayGrain({
      dateKeys: ["2026-10-05"],
      entries: [
        entry({ id: "sleep", penId: "sleep", startMin: 0, endMin: 10 * 60 }),
        entry({ id: "work", penId: "work", startMin: 9 * 60, endMin: 10 * 60 }),
      ],
      pens,
      depth: null,
      scopeId: "activity",
    })
    expect(cells).toHaveLength(1)
    expect(cells[0].penId).toBe("sleep")
    expect(cells[0].minutes).toBe(9 * 60)
  })

  it("leaves an unpainted day blank and breaks ties by pen order", () => {
    const cells = buildDayGrain({
      dateKeys: ["2026-10-05", "2026-10-06"],
      entries: [
        entry({ id: "work", penId: "work", startMin: 0, endMin: 60 }),
        entry({ id: "sleep", penId: "sleep", startMin: 60, endMin: 120 }),
      ],
      pens,
      depth: null,
      scopeId: "activity",
    })
    expect(cells[0].penId).toBe("sleep")
    expect(cells[1]).toMatchObject({ penId: null, minutes: 0, penName: "Empty" })
  })

  it("rolls a child pen up to the display depth", () => {
    const cells = buildDayGrain({
      dateKeys: ["2026-10-05"],
      entries: [entry({ id: "w", penId: "walk", startMin: 0, endMin: 30 })],
      pens,
      depth: 0,
      scopeId: "activity",
    })
    expect(cells[0].penId).toBe("exercise")
    expect(cells[0].penName).toBe("Exercise")
  })

  it("ignores instants", () => {
    const cells = buildDayGrain({
      dateKeys: ["2026-10-05"],
      entries: [entry({ id: "tick", penId: "work", startMin: 100, endMin: 100, kind: "instant" })],
      pens,
      depth: null,
      scopeId: "activity",
    })
    expect(cells[0].penId).toBeNull()
  })
})

describe("buildWeekGrain", () => {
  it("colors the week by minutes, not by which day won", () => {
    const cells = buildWeekGrain({
      dateKeys: ["2026-10-05", "2026-10-06", "2026-10-12"],
      entries: [
        entry({ id: "mon", penId: "sleep", date: "2026-10-05", startMin: 0, endMin: 30 }),
        entry({ id: "tue", penId: "work", date: "2026-10-06", startMin: 0, endMin: 120 }),
        entry({ id: "next", penId: "sleep", date: "2026-10-12", startMin: 0, endMin: 10 }),
      ],
      pens,
      depth: null,
      scopeId: "activity",
    })
    expect(cells.map((cell) => cell.key)).toEqual(["2026-10-05", "2026-10-12"])
    expect(cells[0].penId).toBe("work")
    expect(cells[0].minutes).toBe(120)
    expect(cells[1].penId).toBe("sleep")
  })
})
