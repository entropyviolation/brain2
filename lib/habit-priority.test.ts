import { describe, expect, it } from "vitest"
import { TaskType, type WeeklyTask } from "@/lib/types"
import { formatLocalDateKey, formatLocalMonthKey, getWeekStartDate, getWeekString } from "@/lib/date-utils"
import { quarterKey, quarterStartDate, shiftQuarter } from "./seasons"
import {
  applyPermanentPriority,
  applyPriorityPress,
  applyRitualPriority,
  attachPriorityReasoning,
  autoPriorityWeight,
  blendPriorityScore,
  clampMorningRitualPointMultiplier,
  effectivePriorityWeight,
  neglectCountLabel,
  neglectPrioritySentence,
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

describe("priority events", () => {
  const refreshed = day(2026, 9, 9)
  const key = formatLocalDateKey(refreshed)

  it("a manual press writes set, then refreshed, and omits blank reasoning", () => {
    const set = applyPriorityPress(stretch, refreshed)
    const first = set.priorityEvents?.at(-1)
    expect(set.priorityLog).toEqual(["Priority set Oct 9."])
    expect(first?.kind).toBe("set")
    expect(first?.source).toBe("manual")
    expect(first?.dayKey).toBe(key)
    expect(first?.at).toBe(refreshed.toISOString())
    expect(first?.id.startsWith("hp_")).toBe(true)
    expect(first).not.toHaveProperty("reasoning")
    expect(first).not.toHaveProperty("weightBefore")
    expect(set.priorityRefreshedOn).toBe(key)

    const blank = applyPriorityPress(stretch, { asOf: refreshed, reasoning: "   \n  " })
    expect(blank.priorityLog).toEqual(["Priority set Oct 9."])
    expect(blank.priorityEvents?.at(-1)).not.toHaveProperty("reasoning")
    expect(blank.priorityEvents?.at(-1)?.id).not.toBe(first?.id)

    const again = applyPriorityPress(set, day(2026, 9, 10))
    expect(again.priorityLog).toEqual(["Priority set Oct 9.", "Priority refreshed Oct 10."])
    expect(again.priorityEvents?.map((event) => event.kind)).toEqual(["set", "refreshed"])
    expect(again.priorityEvents?.at(-1)?.source).toBe("manual")
    expect(again.priorityEvents?.at(-1)?.dayKey).toBe("2026-10-10")
    expect(again.priorityEvents?.at(-1)).not.toHaveProperty("reasoning")
    expect(again.priorityRefreshedOn).toBe("2026-10-10")
  })

  it("stores trimmed reasoning on a manual press and leaves the log line unchanged", () => {
    const set = applyPriorityPress(stretch, { asOf: refreshed, reasoning: "  sleep is thin  " })
    expect(set.priorityLog).toEqual(["Priority set Oct 9."])
    expect(set.priorityEvents?.at(-1)?.reasoning).toBe("sleep is thin")
    expect(set.priorityEvents?.at(-1)?.kind).toBe("set")
    expect(effectivePriorityWeight(set, {}, refreshed, "daily")).toBe(effectivePriorityWeight(stretch, {}, refreshed, "daily"))
    expect(priorityStarFade(set.priorityRefreshedOn, refreshed)).toBe(100)
  })

  it("a one-argument press still appends the set line and a manual event", () => {
    const set = applyPriorityPress(stretch)
    expect(set.priorityLog?.[0]).toMatch(/^Priority set /)
    expect(set.priorityEvents?.at(-1)?.source).toBe("manual")
    expect(set.priorityEvents?.at(-1)?.kind).toBe("set")
    expect(set.priorityEvents?.at(-1)).not.toHaveProperty("reasoning")
  })

  it("attachPriorityReasoning sets text, and a blank note omits the field", () => {
    const set = applyPriorityPress(stretch, refreshed)
    const id = set.priorityEvents?.at(-1)?.id
    expect(id).toBeTruthy()
    const noted = attachPriorityReasoning(set, id!, "  because the week slipped ")
    expect(noted.priorityEvents?.at(-1)?.reasoning).toBe("because the week slipped")
    expect(noted.priorityLog).toEqual(["Priority set Oct 9."])
    expect(noted.priorityRefreshedOn).toBe(key)
    const cleared = attachPriorityReasoning(noted, id!, "  ")
    expect(cleared.priorityEvents?.at(-1)).not.toHaveProperty("reasoning")
    expect(cleared.priorityEvents?.at(-1)?.id).toBe(id)
    expect(attachPriorityReasoning(set, "missing", "nope")).toBe(set)
    expect(attachPriorityReasoning(stretch, id!, "late")).toBe(stretch)
  })

  it("snapshots weight and the star when context is passed", () => {
    const pinned: WeeklyTask = { ...stretch, priorityPinned: true }
    const set = applyPriorityPress(pinned, {
      asOf: refreshed,
      data: {},
      frequency: "daily",
      inRitualToday: true,
      reasoning: "keep it",
    })
    const event = set.priorityEvents?.at(-1)
    const weight = effectivePriorityWeight(pinned, {}, refreshed, "daily")
    expect(event?.starBefore).toBe(100)
    expect(event?.weightBefore).toBe(weight)
    expect(event?.weightAfter).toBe(weight)
    expect(event?.reasoning).toBe("keep it")
    expect(priorityMarkPercent(set, refreshed)).toBe(100)
  })

  it("a ritual event is source ritual and has no reasoning", () => {
    const next = applyRitualPriority(stretch, "day", refreshed)
    const event = next.priorityEvents?.at(-1)
    expect(next.priorityLog?.[0]).toContain("Selected from day ritual")
    expect(next.priorityLog?.[0]).toContain("Oct 9")
    expect(event?.kind).toBe("ritual")
    expect(event?.source).toBe("ritual")
    expect(event?.dayKey).toBe(key)
    expect(event).not.toHaveProperty("reasoning")
    expect(next.priorityRefreshedOn).toBe(key)
  })

  it("permanent on and off append events without reasoning", () => {
    const held = applyPermanentPriority(stretch, true, refreshed)
    expect(held.priorityLog?.at(-1)).toBe("Permanent priority set Oct 9.")
    expect(held.priorityEvents?.at(-1)?.kind).toBe("permanent-on")
    expect(held.priorityEvents?.at(-1)?.source).toBe("permanent")
    expect(held.priorityEvents?.at(-1)).not.toHaveProperty("reasoning")
    expect(held.priorityPermanent).toBe(true)
    const same = applyPermanentPriority(held, true, day(2026, 9, 10))
    expect(same).toBe(held)
    expect(same.priorityEvents).toHaveLength(1)
    const released = applyPermanentPriority(held, false, day(2026, 9, 12))
    expect(released.priorityLog?.at(-1)).toBe("Permanent priority removed Oct 12.")
    expect(released.priorityEvents?.map((event) => event.kind)).toEqual(["permanent-on", "permanent-off"])
    expect(released.priorityEvents?.at(-1)?.source).toBe("permanent")
    expect(released.priorityEvents?.at(-1)).not.toHaveProperty("reasoning")
    expect(released.priorityPermanent).toBeUndefined()
    expect(priorityMarkPercent(released, day(2026, 9, 12))).toBe(0)
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

describe("neglectPrioritySentence", () => {
  it("a daily habit neglected 4 days says so", () => {
    const asOf = day(2026, 9, 9)
    const monday = day(2026, 9, 5)
    const data = { [formatLocalDateKey(monday)]: { stretch: { completed: true } } }
    expect(autoPriorityWeight(stretch, data, asOf, "daily")).toBeGreaterThan(0)
    expect(neglectPrioritySentence(stretch, data, asOf, "daily")).toBe("neglected for past 4 days")
  })

  it("a weekly habit neglected 3 weeks names the real threshold", () => {
    const asOf = day(2026, 8, 16)
    const weekly: WeeklyTask = { id: "review", name: "Review", type: TaskType.BOOLEAN, frequency: "weekly" }
    const fourBack = getWeekStartDate(asOf)
    fourBack.setDate(fourBack.getDate() - 28)
    const data = { [getWeekString(fourBack)]: { review: { completed: true } } }
    expect(autoPriorityWeight(weekly, data, asOf, "weekly")).toBe(3)
    expect(neglectPrioritySentence(weekly, data, asOf, "weekly")).toBe(
      "neglected for past 3 weeks (completed less than 1 time)",
    )
  })

  it("a habit prioritized only by a pin does not get the neglect sentence", () => {
    const asOf = day(2026, 9, 9)
    const pinned: WeeklyTask = { ...stretch, priorityPinned: true }
    const prior = getWeekStartDate(asOf)
    prior.setDate(prior.getDate() - 7)
    const data = { [formatLocalDateKey(prior)]: { stretch: { completed: true } } }
    expect(effectivePriorityWeight(pinned, data, asOf, "daily")).toBe(1)
    expect(neglectPrioritySentence(pinned, data, asOf, "daily")).toBeNull()
  })
})
