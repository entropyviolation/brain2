/**
 * lib/pharmacy-math.test.ts — Which bottle a title means, what a habit is worth, runway
 */
import { describe, expect, it } from "vitest"
import { TaskType } from "@/lib/types"
import {
  dailyUse,
  daysLeft,
  habitUnits,
  itemForIntakeTitle,
  levelOf,
  sanitizePharmacyItem,
  splitDoseTitle,
  type PharmacyItem,
  type PharmacyLogRow,
} from "./pharmacy-math"

const TODAY = "2026-11-07"

function item(name: string, extra: Partial<PharmacyItem> = {}): PharmacyItem {
  const row = sanitizePharmacyItem({ name, capacity: 60, count: 60, ...extra }, TODAY)
  if (!row) throw new Error("bad item")
  return row
}

describe("splitDoseTitle", () => {
  it("reads a leading count", () => {
    expect(splitDoseTitle("2 10 mg adderall")).toEqual({ doses: 2, rest: "10 mg adderall" })
    expect(splitDoseTitle("1 vitamin D")).toEqual({ doses: 1, rest: "vitamin D" })
  })
  it("treats a number before a unit as strength", () => {
    expect(splitDoseTitle("10 mg adderall")).toEqual({ doses: 1, rest: "10 mg adderall" })
    expect(splitDoseTitle("500mg magnesium").doses).toBe(1)
  })
  it("keeps one dose for a bare name", () => {
    expect(splitDoseTitle("adderall").doses).toBe(1)
  })
})

describe("itemForIntakeTitle", () => {
  it("matches the name and takes the count", () => {
    const rx = item("Adderall", { strength: "10 mg" })
    expect(itemForIntakeTitle("2 adderall", [rx])).toMatchObject({ doses: 2 })
    expect(itemForIntakeTitle("1 10 mg adderall", [rx])?.item.id).toBe(rx.id)
  })
  it("matches an alias", () => {
    const rx = item("Adderall", { aliases: ["addy"] })
    expect(itemForIntakeTitle("addy", [rx])?.item.id).toBe(rx.id)
  })
  it("prefers the strength that appears in the title", () => {
    const ten = item("Adderall 10 mg")
    const twenty = item("Adderall 20 mg")
    expect(itemForIntakeTitle("1 Adderall 20 mg", [ten, twenty])?.item.id).toBe(twenty.id)
  })
  it("returns null for another name", () => {
    expect(itemForIntakeTitle("coffee", [item("Adderall")])).toBeNull()
  })
})

describe("habitUnits", () => {
  it("is the per-done amount for a yes/no habit", () => {
    expect(habitUnits({ type: TaskType.BOOLEAN }, { completed: true }, 2)).toBe(2)
    expect(habitUnits({ type: TaskType.BOOLEAN }, { completed: false }, 2)).toBe(0)
    expect(habitUnits({ type: TaskType.BOOLEAN }, undefined, 2)).toBe(0)
  })
  it("multiplies a count habit by its value", () => {
    expect(habitUnits({ type: TaskType.GOAL }, { value: 3, goal: 4 }, 2)).toBe(6)
  })
})

describe("runway", () => {
  const rows = (delta: number, source: PharmacyLogRow["source"], at: string): PharmacyLogRow => ({
    id: at + source,
    itemId: "a",
    at,
    delta,
    source,
  })
  it("averages recent use and ignores fixes and refills", () => {
    const now = new Date("2026-11-07T12:00:00")
    const log = [
      rows(-2, "habit", "2026-11-06T09:00:00"),
      rows(-2, "intake", "2026-11-05T09:00:00"),
      rows(30, "refill", "2026-11-04T09:00:00"),
      rows(-9, "fix", "2026-11-03T09:00:00"),
    ]
    const use = dailyUse("a", log, now, 14, "2026-10-01")
    expect(use).toBeCloseTo(4 / 14, 5)
    expect(daysLeft(28, use)).toBe(98)
  })
  it("has no runway without use", () => {
    expect(dailyUse("a", [], new Date(), 14)).toBeNull()
    expect(daysLeft(10, null)).toBeNull()
  })
  it("reads levels", () => {
    expect(levelOf({ count: 0, capacity: 60 })).toBe("empty")
    expect(levelOf({ count: 12, capacity: 60 })).toBe("low")
    expect(levelOf({ count: 13, capacity: 60 })).toBe("ok")
    expect(levelOf({ count: 5, capacity: 60, lowAt: 5 })).toBe("low")
  })
})
