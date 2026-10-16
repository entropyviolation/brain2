import { describe, expect, it } from "vitest"
import type { Task } from "@/lib/types"
import type { TimeEntry } from "@/lib/time-entries"
import { attentionGiven, attentionGivenLabel } from "./attention-given"
import { waitingSinceLabel } from "./TodoTable"

const block = (id: string, date: string, startMin: number, endMin: number, taskId = "t1") =>
  ({ id, date, scopeId: "s", penId: "p", startMin, endMin, taskId }) as TimeEntry

describe("Done well attention-given line (Phase 15 B)", () => {
  const ref = new Date(2026, 9, 16)
  const task = {
    id: "t1",
    description: "Taxes",
    timeLogs: [
      { id: "l1", date: "2026-10-16", durationMinutes: 40 },
      { id: "l2", date: "2026-10-16", durationMinutes: 60, entryIds: ["b1"] },
      { id: "l3", date: "2026-10-15", durationMinutes: 999 },
    ],
  } as Task

  it("sums sittings and minutes inside the period, without counting a block twice", () => {
    const entries = [block("b1", "2026-10-16", 600, 660), block("b2", "2026-10-16", 900, 930), block("b3", "2026-10-14", 0, 300)]
    const got = attentionGiven([task], entries, "day", ref)
    expect(got).toEqual({ sittings: 3, minutes: 130 })
    expect(attentionGivenLabel(got)).toBe("3 sittings · 2h10 of attention given")
  })

  it("widens to the week and says nothing when nothing was logged", () => {
    expect(attentionGiven([task], [], "week", ref).minutes).toBeGreaterThan(1000)
    expect(attentionGivenLabel(attentionGiven([{ id: "x", description: "x" } as Task], [], "day", ref))).toBeNull()
  })
})

describe("neutral words (Phase 15 B)", () => {
  it("reads Waiting since a weekday, then a date", () => {
    const now = new Date(2026, 9, 16) // Fri
    expect(waitingSinceLabel(3, now)).toBe("Waiting since Tue")
    expect(waitingSinceLabel(10, now)).toBe("Waiting since Oct 6")
  })
})
