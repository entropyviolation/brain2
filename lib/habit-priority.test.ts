import { describe, expect, it } from "vitest"
import { TaskType, type WeeklyTask } from "@/lib/types"
import { formatLocalDateKey, formatLocalMonthKey, getWeekStartDate, getWeekString } from "@/lib/date-utils"
import { quarterKey, quarterStartDate, shiftQuarter } from "./seasons"
import {
  applyPermanentPriority,
  applyPriorityPress,
  applyRitualPriority,
  autoPriorityWeight,
  blendPriorityScore,
  clampMorningRitualPointMultiplier,
  effectivePriorityWeight,
  neglectCountLabel,
  PRIORITY_GRADE_FLOOR,
  priorityMarkPercent,
  priorityStarFade,
  priorityWash,
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

  it("stops auto-priority when neglect is ignored", () => {
    expect(autoPriorityWeight({ ...stretch, priorityMuted: true }, {}, asOf, "daily")).toBe(0)
    expect(autoPriorityWeight(stretch, {}, asOf, "daily")).toBeGreaterThan(0)
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

describe("morning ritual multiplier and name wash", () => {
  it("defaults a missing multiplier to ×5 and leaves highlight off uncolored", () => {
    expect(clampMorningRitualPointMultiplier(undefined)).toBe(5)
    expect(clampMorningRitualPointMultiplier(0)).toBe(0)
    expect(priorityWash({ highlight: false, ritual: true, neglect: 4 }).className).toBe("")
    const both = priorityWash({ highlight: true, ritual: true, neglect: 4 })
    expect(both.className).toBe("is-priority-ritual is-priority-selected is-priority-neglect")
    expect(both.alpha).toBeGreaterThan(priorityWash({ highlight: true, ritual: false, neglect: 1 }).alpha)
    const faded = priorityWash({ highlight: true, ritual: false, neglect: 4, selected: 30 })
    expect(faded.alpha).toBe(both.alpha)
    expect(faded.star).toBe(0.3)
  })
})

describe("priority star fade", () => {
  const refreshed = day(2026, 9, 9)
  const key = formatLocalDateKey(refreshed)

  it("is 100 on day 0, 70 on day 3, and 0 on day 10", () => {
    expect(priorityStarFade(key, day(2026, 9, 9))).toBe(100)
    expect(priorityStarFade(key, day(2026, 9, 12))).toBe(70)
    expect(priorityStarFade(key, day(2026, 9, 19))).toBe(0)
  })

  it("stays at 100 on day 10 while permanent priority is on", () => {
    expect(priorityMarkPercent({ priorityRefreshedOn: key, priorityPermanent: true }, day(2026, 9, 19))).toBe(100)
    const held = applyPermanentPriority({ ...stretch, priorityRefreshedOn: key }, true, refreshed)
    const released = applyPermanentPriority(held, false, day(2026, 9, 12))
    expect(released.priorityLog?.at(-1)).toBe("Permanent priority removed Oct 12.")
    expect(priorityMarkPercent(released, day(2026, 9, 12))).toBe(70)
    expect(priorityMarkPercent(released, day(2026, 9, 19))).toBe(0)
  })

  it("logs Priority refreshed on a second press and keeps the first line", () => {
    const set = applyPriorityPress(stretch, refreshed)
    expect(set.priorityLog).toEqual(["Priority set Oct 9."])
    const again = applyPriorityPress(set, day(2026, 9, 10))
    expect(again.priorityLog).toEqual(["Priority set Oct 9.", "Priority refreshed Oct 10."])
    expect(again.priorityRefreshedOn).toBe(formatLocalDateKey(day(2026, 9, 10)))
  })

  it("a ritual toggle logs Selected from day ritual", () => {
    const next = applyRitualPriority(stretch, "day", refreshed)
    expect(next.priorityLog?.[0]).toContain("Selected from day ritual")
    expect(next.priorityLog?.[0]).toContain("Oct 9")
    expect(next.priorityRefreshedOn).toBe(key)
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

  it("counts empty prior seasons", () => {
    const asOf = day(2026, 8, 16)
    const season: WeeklyTask = { id: "garden", name: "Garden", type: TaskType.BOOLEAN, frequency: "quarterly" }
    const prior = shiftQuarter(quarterStartDate(asOf), -1)
    expect(autoPriorityWeight(season, {}, asOf, "quarterly")).toBe(52)
    expect(
      autoPriorityWeight(season, { [quarterKey(prior)]: { garden: { completed: true } } }, asOf, "quarterly"),
    ).toBe(0)
    expect(neglectCountLabel("daily", 3)).toBe("3 empty weeks")
    expect(neglectCountLabel("monthly", 1)).toBe("1 empty month")
    expect(neglectCountLabel("quarterly", 2)).toBe("2 empty seasons")
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
