import { describe, expect, it } from "vitest"
import { TaskType, type HabitTrackingLink, type WeeklyTask } from "./types"
import {
  activeTrackingLink,
  applyTrackedToCompletion,
  combineTrackedValue,
  convertTrackedMinutes,
  describeTrackingLink,
  manualBaseOf,
  meetsTrackingThreshold,
  reconcileManualEntry,
  supportsTrackingLink,
} from "./habit-tracking"

const link = (patch: Partial<HabitTrackingLink> = {}): HabitTrackingLink => ({ tagIds: ["cleaning"], ...patch })

const goalHabit = (patch: Partial<WeeklyTask> = {}): WeeklyTask => ({
  id: "h1",
  name: "Clean for 15 minutes",
  type: TaskType.GOAL,
  goal: 15,
  unit: "minutes",
  frequency: "daily",
  trackingLink: link(),
  ...patch,
})

describe("tracking link eligibility", () => {
  it("accepts daily, weekly, and monthly goal and yes/no habits", () => {
    expect(supportsTrackingLink({ type: TaskType.GOAL, frequency: "daily" })).toBe(true)
    expect(supportsTrackingLink({ type: TaskType.BOOLEAN })).toBe(true)
    expect(supportsTrackingLink({ type: TaskType.TIME })).toBe(true)
    expect(supportsTrackingLink({ type: TaskType.GOAL, frequency: "weekly" })).toBe(true)
    expect(supportsTrackingLink({ type: TaskType.BOOLEAN, frequency: "monthly" })).toBe(true)
  })

  it("rejects text and climb habits", () => {
    expect(supportsTrackingLink({ type: TaskType.TEXT })).toBe(false)
    expect(supportsTrackingLink({ type: TaskType.INCREMENTAL })).toBe(false)
    expect(supportsTrackingLink({ type: TaskType.TEXT, frequency: "weekly" })).toBe(false)
  })

  it("ignores links that are empty, disabled, or on an unsupported habit", () => {
    expect(activeTrackingLink(goalHabit())).toBeTruthy()
    expect(activeTrackingLink(goalHabit({ trackingLink: link({ enabled: false }) }))).toBeUndefined()
    expect(activeTrackingLink(goalHabit({ trackingLink: link({ tagIds: [] }) }))).toBeUndefined()
    expect(activeTrackingLink(goalHabit({ type: TaskType.TEXT }))).toBeUndefined()
    expect(activeTrackingLink(goalHabit({ trackingLink: undefined }))).toBeUndefined()
  })
})

describe("unit conversion and combining", () => {
  it("converts minutes to hours with two decimals", () => {
    expect(convertTrackedMinutes(90, "hours")).toBe(1.5)
    expect(convertTrackedMinutes(50, "hours")).toBe(0.83)
    expect(convertTrackedMinutes(90, "minutes")).toBe(90)
    expect(convertTrackedMinutes(0, "hours")).toBe(0)
  })

  it("combines manual and tracked per mode", () => {
    expect(combineTrackedValue(link(), 10, 25)).toBe(35)
    expect(combineTrackedValue(link({ mode: "max" }), 40, 25)).toBe(40)
    expect(combineTrackedValue(link({ mode: "replace" }), 40, 25)).toBe(25)
  })

  it("treats a pre-link value as manual so nothing logged is lost", () => {
    expect(manualBaseOf({ value: 20 })).toBe(20)
    expect(manualBaseOf({ value: 50, manualValue: 20, trackedValue: 30 })).toBe(20)
    expect(manualBaseOf(undefined)).toBe(0)
  })
})

describe("applying tracked time to a goal habit", () => {
  it("adds tracked minutes on top of what was logged by hand", () => {
    const next = applyTrackedToCompletion(goalHabit(), link(), { value: 5 }, 25)
    expect(next).toMatchObject({ manualValue: 5, trackedValue: 25, value: 30 })
  })

  it("is idempotent — re-running does not double count", () => {
    const first = applyTrackedToCompletion(goalHabit(), link(), { value: 5 }, 25)!
    expect(applyTrackedToCompletion(goalHabit(), link(), first, 25)).toBeNull()
  })

  it("shrinks the value when tracked time is erased", () => {
    const filled = applyTrackedToCompletion(goalHabit(), link(), { value: 5 }, 25)!
    expect(applyTrackedToCompletion(goalHabit(), link(), filled, 10)).toMatchObject({ value: 15, trackedValue: 10 })
  })

  it("leaves untracked days without a record", () => {
    expect(applyTrackedToCompletion(goalHabit(), link(), undefined, 0)).toBeNull()
  })

  it("replace mode ignores the manual half", () => {
    const l = link({ mode: "replace" })
    expect(applyTrackedToCompletion(goalHabit(), l, { value: 40 }, 25)).toMatchObject({ value: 25 })
  })
})

describe("applying tracked time to a yes/no habit", () => {
  const boolHabit = goalHabit({ type: TaskType.BOOLEAN, goal: undefined })

  it("checks off once any tracked time exists", () => {
    expect(applyTrackedToCompletion(boolHabit, link(), undefined, 15)).toMatchObject({
      completed: true,
      trackedCompleted: true,
    })
  })

  it("honours a minimum threshold", () => {
    const l = link({ threshold: 30 })
    expect(meetsTrackingThreshold(l, 15)).toBe(false)
    expect(applyTrackedToCompletion(boolHabit, l, undefined, 15)).toBeNull()
    expect(applyTrackedToCompletion(boolHabit, l, undefined, 30)).toMatchObject({ completed: true })
  })

  it("unchecks only what the tracker checked", () => {
    const auto = { completed: true, trackedCompleted: true }
    expect(applyTrackedToCompletion(boolHabit, link(), auto, 0)).toMatchObject({ completed: false })
    const byHand = { completed: true }
    expect(applyTrackedToCompletion(boolHabit, link(), byHand, 0)).toBeNull()
  })
})

describe("manual edits on a linked habit", () => {
  it("treats a typed number as the total and backs out the manual half", () => {
    const previous = { value: 30, manualValue: 5, trackedValue: 25 }
    expect(reconcileManualEntry(goalHabit(), previous, { value: 45, goal: 15 })).toMatchObject({
      value: 45,
      manualValue: 20,
      trackedValue: 25,
    })
  })

  it("never drives the manual half negative", () => {
    const previous = { value: 30, manualValue: 5, trackedValue: 25 }
    expect(reconcileManualEntry(goalHabit(), previous, { value: 10 })).toMatchObject({ manualValue: 0 })
  })

  it("passes unlinked habits through untouched", () => {
    const plain = goalHabit({ trackingLink: undefined })
    expect(reconcileManualEntry(plain, { value: 1 }, { value: 9 })).toEqual({ value: 9 })
  })
})

describe("describeTrackingLink", () => {
  it("summarises the goal and yes/no cases", () => {
    expect(describeTrackingLink(link(), ["Cleaning"], { type: TaskType.GOAL })).toContain("adds tracked minutes")
    expect(describeTrackingLink(link({ threshold: 20 }), ["Cleaning"], { type: TaskType.BOOLEAN })).toContain(
      "20 minutes",
    )
  })
})
