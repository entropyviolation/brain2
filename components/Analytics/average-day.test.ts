import { describe, expect, it } from "vitest"
import type { TimeEntry } from "@/lib/time-entries"
import {
  SLOT_MINUTES,
  SLOTS_PER_DAY,
  allDaysCaption,
  averageSlotShares,
  buildAverageDayBoard,
  dayMinuteOwners,
  mergeDominantSections,
  slotOccupancyFromOwners,
  soleDominantPen,
  weekdayCaption,
} from "./average-day"

function entry(
  partial: Partial<TimeEntry> & Pick<TimeEntry, "id" | "date" | "penId" | "startMin" | "endMin">,
): TimeEntry {
  return {
    scopeId: "activity",
    ...partial,
  }
}

const pens = [
  { id: "work", name: "Work", color: "#2563eb" },
  { id: "sleep", name: "Sleep", color: "#64748b" },
]

describe("average-day slotting", () => {
  it("splits a day into 96 fifteen-minute slots", () => {
    expect(SLOTS_PER_DAY).toBe(96)
    expect(SLOT_MINUTES * SLOTS_PER_DAY).toBe(1440)
  })

  it("attributes minutes to the painted pen and leaves gaps empty", () => {
    const owners = dayMinuteOwners(
      [entry({ id: "e1", date: "2026-09-01", penId: "work", startMin: 540, endMin: 600 })],
      "2026-09-01",
      pens,
      null,
      "activity",
    )
    expect(owners[539]).toBeNull()
    expect(owners[540]).toBe("work")
    expect(owners[599]).toBe("work")
    expect(owners[600]).toBeNull()
  })

  it("fills untracked minutes when an untracked id is provided", () => {
    const owners = dayMinuteOwners(
      [entry({ id: "e1", date: "2026-09-01", penId: "work", startMin: 0, endMin: 60 })],
      "2026-09-01",
      pens,
      null,
      "activity",
      "Untracked",
    )
    expect(owners[0]).toBe("work")
    expect(owners[60]).toBe("Untracked")
    expect(owners[1439]).toBe("Untracked")
  })

  it("lets the later-ending block own a shared start", () => {
    const owners = dayMinuteOwners(
      [
        entry({ id: "long", date: "2026-09-01", penId: "work", startMin: 0, endMin: 60 }),
        entry({ id: "short", date: "2026-09-01", penId: "sleep", startMin: 0, endMin: 30 }),
      ],
      "2026-09-01",
      pens,
      null,
      "activity",
    )
    expect(owners[0]).toBe("work")
    expect(owners[29]).toBe("work")
    expect(owners[30]).toBe("work")
    expect(owners[59]).toBe("work")
    expect(owners[60]).toBeNull()
  })

  it("skips instants (no duration)", () => {
    const owners = dayMinuteOwners(
      [
        entry({
          id: "e1",
          date: "2026-09-01",
          penId: "work",
          startMin: 540,
          endMin: 540,
          kind: "instant",
        }),
      ],
      "2026-09-01",
      pens,
      null,
      "activity",
    )
    expect(owners.every((o) => o == null)).toBe(true)
  })

  it("averages occupancy across sample days", () => {
    const dayA = slotOccupancyFromOwners(
      dayMinuteOwners(
        [entry({ id: "a", date: "2026-09-01", penId: "work", startMin: 540, endMin: 555 })],
        "2026-09-01",
        pens,
        null,
        "activity",
      ),
    )
    const emptyB = slotOccupancyFromOwners(Array.from({ length: 1440 }, () => null))
    const shares = averageSlotShares([dayA, emptyB], ["work", "sleep"])
    const slot36 = shares[Math.floor(540 / 15)]
    expect(slot36).toEqual([{ penId: "work", meanMinutes: 7.5 }])
  })

  it("merges adjacent sole-dominant slots", () => {
    const slots = Array.from({ length: 4 }, () => [{ penId: "work", meanMinutes: 15 }])
    slots.push([{ penId: "sleep", meanMinutes: 15 }])
    const sections = mergeDominantSections(slots)
    expect(soleDominantPen(slots[0])).toBe("work")
    expect(sections[0]).toMatchObject({ penId: "work", startSlot: 0, endSlot: 4, sole: true })
    expect(sections[1]).toMatchObject({ penId: "sleep", startSlot: 4, endSlot: 5 })
  })

  it("builds All + Mon–Sun ribbons with captions", () => {
    // 2026-09-01 = Tuesday, 2026-09-02 = Wednesday
    const board = buildAverageDayBoard({
      dateKeys: ["2026-09-01", "2026-09-02"],
      entries: [
        entry({ id: "e1", date: "2026-09-01", penId: "work", startMin: 540, endMin: 600 }),
        entry({ id: "e2", date: "2026-09-02", penId: "sleep", startMin: 0, endMin: 420 }),
      ],
      pens,
      depth: null,
      scopeId: "activity",
      showUntracked: false,
      untrackedId: "Untracked",
      penOrder: ["work", "sleep"],
    })
    expect(board).toHaveLength(8)
    expect(board[0].label).toBe("All days")
    expect(board[0].caption).toBe(allDaysCaption(2))
    expect(board[0].n).toBe(2)
    expect(board[2].label).toBe("Tue")
    expect(board[2].caption).toBe(weekdayCaption(1, 1))
    expect(board[2].n).toBe(1)
    expect(board[3].n).toBe(1)
    expect(board[1].n).toBe(0)
  })
})
