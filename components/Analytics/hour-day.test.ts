/**
 * Hour × day occupancy — missing hours stay 0; instants stay off the heat.
 */
import { describe, expect, it } from "vitest"
import type { TimeEntry } from "@/lib/time-entries"
import { buildHourDayGrid, buildHourPenRows, buildWeekdayHourCycle, switchCountsByHour } from "./hour-day"

function entry(partial: Partial<TimeEntry> & Pick<TimeEntry, "id" | "date" | "penId" | "startMin" | "endMin">): TimeEntry {
  return { scopeId: "activity", ...partial }
}

describe("hour-day occupancy", () => {
  it("keeps missing hours at 0 and does not treat them as occupancy", () => {
    const grid = buildHourDayGrid(
      [entry({ id: "a", date: "2026-09-20", penId: "work", startMin: 9 * 60, endMin: 10 * 60 })],
      ["2026-09-20", "2026-09-21"],
      "activity",
    )
    expect(grid.minutes[0][8]).toBe(0)
    expect(grid.minutes[0][9]).toBe(60)
    expect(grid.minutes[1].every((n) => n === 0)).toBe(true)
    expect(grid.observedDays).toBe(1)
    expect(grid.max).toBe(60)
  })

  it("lists instants separately and keeps them off the heatmap", () => {
    const grid = buildHourDayGrid(
      [
        entry({ id: "i", date: "2026-09-20", penId: "ping", startMin: 540, endMin: 540, kind: "instant" }),
        entry({ id: "b", date: "2026-09-20", penId: "work", startMin: 600, endMin: 630 }),
      ],
      ["2026-09-20"],
      "activity",
    )
    expect(grid.instants).toHaveLength(1)
    expect(grid.minutes[0][9]).toBe(0)
    expect(grid.minutes[0][10]).toBe(30)
  })

  it("counts switches by the incoming block hour", () => {
    const hours = switchCountsByHour(
      [
        entry({ id: "a", date: "2026-09-20", penId: "a", startMin: 8 * 60, endMin: 9 * 60 }),
        entry({ id: "b", date: "2026-09-20", penId: "b", startMin: 9 * 60, endMin: 10 * 60 }),
      ],
      ["2026-09-20"],
      "activity",
    )
    expect(hours[9]).toBe(1)
    expect(hours[8]).toBe(0)
  })

  it("hour × pen small multiples keep empty hours at 0", () => {
    const { rows, max } = buildHourPenRows(
      [entry({ id: "a", date: "2026-09-20", penId: "work", startMin: 9 * 60, endMin: 10 * 60 })],
      ["2026-09-20"],
      "activity",
      [{ id: "work", name: "Work", color: "#00f" }],
    )
    expect(rows).toHaveLength(1)
    expect(rows[0].hours[9]).toBe(60)
    expect(rows[0].hours[8]).toBe(0)
    expect(max).toBe(60)
  })

  it("weekday cycle plot averages only days with paint", () => {
    const cycle = buildWeekdayHourCycle(
      [
        entry({ id: "a", date: "2026-09-20", penId: "work", startMin: 9 * 60, endMin: 10 * 60 }),
        entry({ id: "b", date: "2026-09-27", penId: "work", startMin: 9 * 60, endMin: 11 * 60 }),
      ],
      ["2026-09-20", "2026-09-21", "2026-09-27"],
      "activity",
    )
    expect(cycle.days[0]).toBe(2) // both Sundays
    expect(cycle.mean[0][9]).toBe(60)
    expect(cycle.mean[1][9]).toBe(0)
  })
})
