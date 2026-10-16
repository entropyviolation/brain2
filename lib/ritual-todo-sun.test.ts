import { describe, expect, it } from "vitest"
import { FALLBACK_SUNSET_MINUTES, ritualBoardFollowingSun, ritualDayBoard, ritualHiddenAt } from "./ritual-todo"

const today = new Date(2026, 9, 16, 12, 0)
const at = (h: number, m = 0) => new Date(2026, 9, 16, h, m)
const SUNSET = 18 * 60 + 10
const morning = { kind: "day-morning" as const, dateKey: "2026-10-16" }
const night = { kind: "day-night" as const, dateKey: "2026-10-16" }

describe("ritualHiddenAt (rites follow the sun)", () => {
  it("hides Night before sunset and shows it from sunset on", () => {
    expect(ritualHiddenAt(night, at(17, 0), SUNSET, "none")).toBe(true)
    expect(ritualHiddenAt(night, at(18, 10), SUNSET, "none")).toBe(false)
  })

  it("shows Morning before sunset and hides it from sunset on while not done", () => {
    expect(ritualHiddenAt(morning, at(9), SUNSET, "none")).toBe(false)
    expect(ritualHiddenAt(morning, at(20), SUNSET, "none")).toBe(true)
  })

  it("never hides a started or done rite", () => {
    expect(ritualHiddenAt(morning, at(20), SUNSET, "partial")).toBe(false)
    expect(ritualHiddenAt(morning, at(20), SUNSET, "done")).toBe(false)
    expect(ritualHiddenAt(night, at(9), SUNSET, "partial")).toBe(false)
    expect(ritualHiddenAt(night, at(9), SUNSET, "done")).toBe(false)
  })

  it("never hides on another day", () => {
    expect(ritualHiddenAt({ ...night, dateKey: "2026-10-15" }, at(9), SUNSET, "none")).toBe(false)
    expect(ritualHiddenAt({ ...morning, dateKey: "2026-10-17" }, at(20), SUNSET, "none")).toBe(false)
  })

  it("leaves other rites alone", () => {
    expect(ritualHiddenAt({ kind: "week-end", dateKey: "2026-10-16" }, at(9), SUNSET, "none")).toBe(false)
  })

  it("falls back to 6:00 PM when the sun cannot be computed", () => {
    expect(FALLBACK_SUNSET_MINUTES).toBe(18 * 60)
    expect(ritualHiddenAt(night, at(17, 59), null, "none")).toBe(true)
    expect(ritualHiddenAt(night, at(18, 0), undefined, "none")).toBe(false)
  })
})

describe("ritualBoardFollowingSun", () => {
  it("drops the wrong-end rite from tasks but keeps byId", () => {
    const board = ritualDayBoard(today, [], [])
    const kinds = board.placements.map((p) => p.kind)
    expect(kinds).toContain("day-morning")
    expect(kinds).toContain("day-night")
    const noon = ritualBoardFollowingSun(board, at(12), SUNSET)
    expect(noon.placements.map((p) => p.kind)).not.toContain("day-night")
    expect(noon.tasks).toHaveLength(board.tasks.length - 1)
    expect(noon.byId.size).toBe(board.byId.size)
    const late = ritualBoardFollowingSun(board, at(21), SUNSET)
    expect(late.placements.map((p) => p.kind)).not.toContain("day-morning")
  })

  it("returns the same board when nothing is hidden", () => {
    const board = ritualDayBoard(new Date(2026, 9, 17, 12), [], [])
    expect(ritualBoardFollowingSun(board, at(12), SUNSET)).toBe(board)
  })
})
