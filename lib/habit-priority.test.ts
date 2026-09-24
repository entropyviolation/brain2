import { describe, expect, it } from "vitest"
import { TaskType, type WeeklyTask } from "@/lib/types"
import { formatLocalDateKey, formatLocalMonthKey, getWeekStartDate, getWeekString } from "@/lib/date-utils"
import {
  autoPriorityWeight,
  blendPriorityScore,
  effectivePriorityWeight,
  PRIORITY_GRADE_FLOOR,
  sortHabitsByPriority,
} from "./habit-priority"

const stretch: WeeklyTask = { id: "stretch", name: "Stretch", type: TaskType.BOOLEAN, frequency: "daily" }
const water: WeeklyTask = { id: "water", name: "Water", type: TaskType.BOOLEAN, frequency: "daily" }

function day(y: number, m: number, d: number) {
  return new Date(y, m, d)
}

describe("autoPriorityWeight (daily weeks)", () => {
  const asOf = day(2026, 8, 16) // Wed in week of Sep 14
  const thisMonday = getWeekStartDate(asOf)

  it("compounds consecutive fully empty prior weeks", () => {
    expect(autoPriorityWeight(stretch, {}, asOf, "daily")).toBe(52)
    const lastMonday = new Date(thisMonday)
    lastMonday.setDate(thisMonday.getDate() - 7)
    const hit = { [formatLocalDateKey(lastMonday)]: { stretch: { completed: true } } }
    expect(autoPriorityWeight(stretch, hit, asOf, "daily")).toBe(0)

    const twoBack = new Date(thisMonday)
    twoBack.setDate(thisMonday.getDate() - 14)
    const onlyOlder = { [formatLocalDateKey(twoBack)]: { stretch: { completed: true } } }
    expect(autoPriorityWeight(stretch, onlyOlder, asOf, "daily")).toBe(1)
  })

  it("ignores auto weight when muted", () => {
    expect(autoPriorityWeight({ ...stretch, priorityMuted: true }, {}, asOf, "daily")).toBe(0)
  })
})

describe("effectivePriorityWeight", () => {
  const asOf = day(2026, 8, 16)
  it("adds a user pin on top of auto compound", () => {
    const thisMonday = getWeekStartDate(asOf)
    const twoBack = new Date(thisMonday)
    twoBack.setDate(thisMonday.getDate() - 14)
    const data = { [formatLocalDateKey(twoBack)]: { stretch: { completed: true } } }
    expect(effectivePriorityWeight({ ...stretch, priorityPinned: true }, data, asOf, "daily")).toBe(2)
  })
})

describe("sortHabitsByPriority", () => {
  it("puts heavier weights first and keeps original order on ties", () => {
    const asOf = day(2026, 8, 16)
    const pinned: WeeklyTask = { ...water, priorityPinned: true }
    const sorted = sortHabitsByPriority([stretch, pinned], {}, asOf, "daily")
    expect(sorted.map((t) => t.id)).toEqual(["water", "stretch"])
  })
})

describe("blendPriorityScore", () => {
  it("floors at 50% when prioritized habits are 100% and overall is 0", () => {
    expect(blendPriorityScore(0, 100, true, PRIORITY_GRADE_FLOOR)).toBe(50)
    expect(blendPriorityScore(20, 100, true)).toBe(60)
    expect(blendPriorityScore(100, 100, true)).toBe(100)
    expect(blendPriorityScore(40, 80, false)).toBe(40)
    expect(blendPriorityScore(40, null, true)).toBe(40)
  })
})

describe("weekly / monthly auto weight", () => {
  it("counts empty prior week keys", () => {
    const asOf = day(2026, 8, 16)
    const weekly: WeeklyTask = { id: "review", name: "Review", type: TaskType.BOOLEAN, frequency: "weekly" }
    const last = getWeekStartDate(asOf)
    last.setDate(last.getDate() - 7)
    expect(autoPriorityWeight(weekly, {}, asOf, "weekly")).toBe(52)
    expect(
      autoPriorityWeight(weekly, { [getWeekString(last)]: { review: { completed: true } } }, asOf, "weekly"),
    ).toBe(0)
  })

  it("counts empty prior months", () => {
    const asOf = day(2026, 8, 16)
    const monthly: WeeklyTask = { id: "tax", name: "Tax", type: TaskType.BOOLEAN, frequency: "monthly" }
    const august = day(2026, 7, 1)
    expect(
      autoPriorityWeight(monthly, { [formatLocalMonthKey(august)]: { tax: { completed: true } } }, asOf, "monthly"),
    ).toBe(0)
  })
})
