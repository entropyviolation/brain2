import { describe, expect, it } from "vitest"
import { penMinutesByDay, penTransitionMatrix, weekdayWeekendCut, listHerfindahl, openItemAges } from "./signal-stats"
import type { TimeEntry } from "@/lib/time-entries"
import type { TrackPen } from "@/lib/time-tracking-store"
import type { Task } from "@/lib/types"

const entry = (partial: Partial<TimeEntry> & Pick<TimeEntry, "id" | "date" | "penId" | "startMin" | "endMin">): TimeEntry => ({
  scopeId: "activity",
  ...partial,
})

describe("signal-stats", () => {
  it("entropy is 1 bit on a 50/50 two-pen day and 0 on a one-pen day", () => {
    const entries = [
      entry({ id: "a", date: "2026-09-20", penId: "work", startMin: 540, endMin: 600 }),
      entry({ id: "b", date: "2026-09-20", penId: "sleep", startMin: 600, endMin: 660 }),
      entry({ id: "c", date: "2026-09-21", penId: "work", startMin: 540, endMin: 660 }),
    ]
    const days = penMinutesByDay(entries, ["2026-09-20", "2026-09-21"], "activity")
    expect(days[0].entropy).toBeCloseTo(1)
    expect(days[1].entropy).toBe(0)
  })

  it("transition matrix skips same-pen continuation and row-normalizes", () => {
    const pens: TrackPen[] = [
      { id: "work", name: "Work", color: "#00f" },
      { id: "play", name: "Play", color: "#0f0" },
    ]
    const entries = [
      entry({ id: "a", date: "2026-09-20", penId: "work", startMin: 0, endMin: 60 }),
      entry({ id: "b", date: "2026-09-20", penId: "work", startMin: 60, endMin: 120 }),
      entry({ id: "c", date: "2026-09-20", penId: "play", startMin: 120, endMin: 180 }),
    ]
    const m = penTransitionMatrix(entries, ["2026-09-20"], "activity", pens)
    expect(m.n).toBe(1)
    expect(m.cells[0]).toMatchObject({ fromId: "work", toId: "play", p: 1, count: 1 })
  })

  it("weekday vs weekend splits Sat/Sun from the rest", () => {
    const entries = [
      entry({ id: "a", date: "2026-09-18", penId: "work", startMin: 0, endMin: 60 }), // Friday
      entry({ id: "b", date: "2026-09-19", penId: "work", startMin: 0, endMin: 120 }), // Saturday
    ]
    const cut = weekdayWeekendCut(entries, ["2026-09-18", "2026-09-19", "2026-09-20"])
    expect(cut.weekdayMinutes).toBe(60)
    expect(cut.weekendMinutes).toBe(120)
    expect(cut.weekdayDays).toBe(1)
    expect(cut.weekendDays).toBe(2)
  })

  it("list HHI is 1 when one list holds everything", () => {
    expect(listHerfindahl([12])).toBeCloseTo(1)
    expect(listHerfindahl([5, 5])).toBeCloseTo(0.5)
  })

  it("open item ages skip completed and low-importance rows", () => {
    const today = new Date(2026, 8, 21)
    const tasks = [
      { id: "1", completed: false, importance: 4, createdAt: new Date(2026, 8, 11) },
      { id: "2", completed: true, importance: 5, createdAt: new Date(2026, 8, 1) },
      { id: "3", completed: false, importance: 1, createdAt: new Date(2026, 8, 1) },
    ] as Task[]
    const { ages, curve } = openItemAges(tasks, today)
    expect(ages).toEqual([10])
    expect(curve[0]).toEqual({ age: 10, surviving: 1 })
  })
})
