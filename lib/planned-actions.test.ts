import { describe, expect, it } from "vitest"
import {
  findPlacementForSource,
  hhmmToMinutes,
  minutesToHhmm,
  placementFromDragRange,
  placementFromDrop,
  plannedDurationMinutes,
  todoIdsCoveredByPlacements,
} from "./planned-actions"

describe("planned-actions", () => {
  it("builds a habit placement with time and notes without marking it an event", () => {
    const action = placementFromDrop({
      date: "2026-09-21",
      hour: 9,
      minute: 0,
      durationMinutes: 45,
      source: "habit",
      sourceId: "habit-water",
      title: "Water",
      notes: "glass by the kettle",
    })
    expect(action.source).toBe("habit")
    expect(action.sourceId).toBe("habit-water")
    expect(action.startTime).toBe("09:00")
    expect(action.endTime).toBe("09:45")
    expect(action.notes).toBe("glass by the kettle")
    expect(action).not.toHaveProperty("type", "event")
  })

  it("builds a todo placement on the same drop seam", () => {
    const action = placementFromDrop({
      date: "2026-09-21",
      hour: 14,
      minute: 15,
      durationMinutes: 30,
      source: "todo",
      sourceId: "task-1",
      title: "Call dentist",
    })
    expect(action.source).toBe("todo")
    expect(action.startTime).toBe("14:15")
    expect(action.endTime).toBe("14:45")
  })

  it("drag-create is a free planned action, not an event", () => {
    const action = placementFromDragRange({
      date: "2026-09-21",
      startMinutes: 14 * 60,
      endMinutes: 15 * 60,
      title: "Write",
    })
    expect(action.source).toBe("free")
    expect(action.sourceId).toBeUndefined()
    expect(action.startTime).toBe("14:00")
    expect(action.endTime).toBe("15:00")
    expect(plannedDurationMinutes(action)).toBe(60)
  })

  it("finds and covers a todo placement for a day", () => {
    const water = placementFromDrop({
      date: "2026-09-21",
      hour: 9,
      minute: 0,
      source: "habit",
      sourceId: "h1",
    })
    const call = placementFromDrop({
      date: "2026-09-21",
      hour: 10,
      minute: 0,
      source: "todo",
      sourceId: "t1",
    })
    expect(findPlacementForSource([water, call], "2026-09-21", "todo", "t1")?.id).toBe(call.id)
    expect([...todoIdsCoveredByPlacements([water, call], "2026-09-21")]).toEqual(["t1"])
  })

  it("round-trips clock minutes", () => {
    expect(hhmmToMinutes("09:30")).toBe(570)
    expect(minutesToHhmm(570)).toBe("09:30")
  })
})
