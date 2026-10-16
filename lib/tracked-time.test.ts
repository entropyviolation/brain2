import { describe, expect, it } from "vitest"
import type { TimeEntry } from "./time-entries"
import type { TrackScope } from "./time-tracking-store"
import {
  effectiveTagIds,
  penIdsForTags,
  tagsForPen,
  trackedDateKeys,
  trackedMinutesByTag,
  trackedMinutesForTags,
  trackedMinutesForTagsInRange,
  trackedTimeForItem,
  trackedTimeForItems,
  trackedMinutesForItem,
  stepSpentMinutes,
  partsMinutes,
  timeTrio,
  stepSpentMap,
  settleSpentOnFinish,
  type TrackedTimeSource,
} from "./tracked-time"

const scopes: TrackScope[] = [
  {
    id: "activity",
    name: "Activity",
    pens: [
      { id: "dishes", name: "Do dishes", color: "#111", tags: ["cleaning"] },
      { id: "laundry", name: "Laundry", color: "#222", tags: ["cleaning", "chores"] },
      { id: "work", name: "Work", color: "#333", tags: ["deep"] },
      { id: "untagged", name: "Untagged", color: "#444" },
    ],
  },
  {
    id: "location",
    name: "Location",
    pens: [{ id: "home", name: "Home", color: "#555", tags: ["cleaning"] }],
  },
]

let seq = 0
/** Minutes, end-exclusive: `block("2026-09-17", "activity", "dishes", 480, 540)` = 8–9am. */
function block(date: string, scopeId: string, penId: string, startMin: number, endMin: number): TimeEntry {
  return { id: `e${++seq}`, date, scopeId, penId, startMin, endMin }
}

const source: TrackedTimeSource = {
  scopes,
  entries: [
    // 60 min of dishes + 30 of laundry + 60 of work, with Location home spanning
    // the first 120 minutes of that.
    block("2026-09-17", "activity", "dishes", 480, 540),
    block("2026-09-17", "activity", "laundry", 540, 570),
    block("2026-09-17", "activity", "work", 600, 660),
    block("2026-09-17", "location", "home", 480, 600),
    block("2026-09-16", "activity", "dishes", 120, 150),
  ],
}

describe("tracked-time tag rollups", () => {
  it("collects every pen carrying a tag across scopes", () => {
    expect([...penIdsForTags(scopes, ["cleaning"])].sort()).toEqual(["dishes", "home", "laundry"])
    expect(penIdsForTags(scopes, []).size).toBe(0)
  })

  it("counts a minute once even when several scopes tag it", () => {
    // Activity dishes+laundry (8:00–9:30) and Location home (8:00–10:00) all
    // carry "cleaning": the union is 8:00–10:00, i.e. two hours, not three and a half.
    expect(trackedMinutesForTags(source, "2026-09-17", ["cleaning"])).toBe(120)
  })

  it("matches a pen carrying any one of the linked tags", () => {
    expect(trackedMinutesForTags(source, "2026-09-17", ["chores"])).toBe(30)
    expect(trackedMinutesForTags(source, "2026-09-17", ["chores", "deep"])).toBe(90)
  })

  it("returns zero for untracked days and unknown tags", () => {
    expect(trackedMinutesForTags(source, "2026-01-01", ["cleaning"])).toBe(0)
    expect(trackedMinutesForTags(source, "2026-09-17", ["nope"])).toBe(0)
  })

  it("sums a date range", () => {
    expect(trackedMinutesForTagsInRange(source, ["2026-09-17", "2026-09-16"], ["cleaning"])).toBe(150)
  })

  it("breaks a day down per tag", () => {
    const totals = trackedMinutesByTag(source, "2026-09-17")
    expect(totals).toEqual({ cleaning: 120, chores: 30, deep: 60 })
  })

  it("lists tracked dates newest first", () => {
    expect(trackedDateKeys(source)).toEqual(["2026-09-17", "2026-09-16"])
  })

  it("counts a tag pinned to one block, even on a pen that carries no tags", () => {
    const zoo: TimeEntry = {
      ...block("2026-09-17", "location", "untagged", 600, 840),
      tagIds: ["exercise"],
    }
    const withZoo: TrackedTimeSource = { scopes, entries: [...source.entries, zoo] }
    expect(trackedMinutesForTags(withZoo, "2026-09-17", ["exercise"])).toBe(240)
    expect(trackedMinutesByTag(withZoo, "2026-09-17").exercise).toBe(240)
  })

  it("adds a block tag to the pen's standing tags rather than replacing them", () => {
    const dishesAlsoExercise: TimeEntry = {
      ...block("2026-09-18", "activity", "dishes", 480, 540),
      tagIds: ["exercise"],
    }
    const src: TrackedTimeSource = { scopes, entries: [dishesAlsoExercise] }
    expect(effectiveTagIds(dishesAlsoExercise, scopes).sort()).toEqual(["cleaning", "exercise"])
    expect(trackedMinutesByTag(src, "2026-09-18")).toEqual({ cleaning: 60, exercise: 60 })
  })

  it("resolves the tag objects on a pen", () => {
    const tags = [
      { id: "cleaning", name: "Cleaning", color: "#a" },
      { id: "deep", name: "Deep work", color: "#b" },
    ]
    expect(tagsForPen(tags, scopes[0].pens[0]).map((t) => t.name)).toEqual(["Cleaning"])
    expect(tagsForPen(tags, scopes[0].pens[3])).toEqual([])
  })

  it("unions tags from primary and secondary pens on the same block", () => {
    const dual: TimeEntry = {
      ...block("2026-09-19", "activity", "work", 540, 600),
      secondaryPenIds: ["dishes"],
    }
    expect(effectiveTagIds(dual, scopes).sort()).toEqual(["cleaning", "deep"])
    const src: TrackedTimeSource = { scopes, entries: [dual] }
    expect(trackedMinutesForTags(src, "2026-09-19", ["cleaning"])).toBe(60)
    expect(trackedMinutesForTags(src, "2026-09-19", ["deep"])).toBe(60)
  })
})

describe("trackedTimeForItem", () => {
  const cd = block("2026-10-01", "activity", "work", 600, 660)
  const cdSecondary: TimeEntry = { ...block("2026-10-02", "activity", "untagged", 60, 90), secondaryPenIds: ["work"] }
  const clocked: TimeEntry = { ...block("2026-10-03", "activity", "dishes", 0, 20), taskId: "t1" }
  const other = block("2026-10-03", "activity", "laundry", 100, 200)
  const instant: TimeEntry = { ...block("2026-10-03", "activity", "work", 300, 300), kind: "instant" }

  it("sums linked-pen blocks, secondary pens, and clocked blocks", () => {
    const task = { id: "t1", penLinks: [{ penId: "work" }] }
    const r = trackedTimeForItem(task, [cd, cdSecondary, clocked, other, instant])
    expect(r).toMatchObject({ total: 110, penMinutes: 90, clockMinutes: 20, logMinutes: 0 })
    expect(r.entries.map((e) => e.id)).toEqual([clocked.id, cdSecondary.id, cd.id])
  })

  it("counts a duplicate entry id once", () => {
    const task = { id: "t1", penLinks: [{ penId: "work" }] }
    expect(trackedMinutesForItem(task, [cd, cd, { ...cd, taskId: "t1" }])).toBe(60)
  })

  it("counts a taskId block with no pen link", () => {
    expect(trackedMinutesForItem({ id: "t1" }, [cd, clocked])).toBe(20)
  })

  it("adds time logs, minus the blocks they already name", () => {
    const task = {
      id: "t1",
      timeLogs: [
        { durationMinutes: 25, entryIds: [clocked.id] },
        { durationMinutes: 15 },
      ],
    }
    expect(trackedTimeForItem(task, [clocked])).toMatchObject({ total: 40, clockMinutes: 20, logMinutes: 20 })
  })

  it("is zero with nothing linked or logged", () => {
    expect(trackedMinutesForItem({ id: "t9" }, [cd, other])).toBe(0)
  })
})

describe("trackedTimeForItems", () => {
  it("counts a log for the same span as a block once", () => {
    const painted: TimeEntry = { ...block("2026-10-05", "activity", "work", 540, 600), taskId: "op" }
    const op = { id: "op", timeLogs: [{ date: "2026-10-05", startTime: "09:00", endTime: "10:30", durationMinutes: 90 }] }
    expect(trackedTimeForItems([op], [painted])).toMatchObject({ total: 90, clockMinutes: 60, logMinutes: 30 })
  })

  it("unions blocks across a tree and across linked views", () => {
    const a = block("2026-10-06", "activity", "work", 0, 60)
    const b = block("2026-10-06", "location", "home", 30, 90)
    const tree = [
      { id: "op", penLinks: [{ penId: "work" }] },
      { id: "part", penLinks: [{ penId: "home" }, { penId: "work" }] },
    ]
    expect(trackedTimeForItems(tree, [a, b])).toMatchObject({ total: 90, penMinutes: 90 })
  })

  it("adds untimed logs as they are", () => {
    expect(trackedTimeForItems([{ id: "x", timeLogs: [{ durationMinutes: 40 }] }, { id: "y", timeLogs: [{ durationMinutes: 5 }] }], []).total).toBe(45)
  })
})

describe("stepSpentMinutes", () => {
  const steps: { id: string; description: string; completed: boolean; actualDuration?: number; subtasks?: { id: string; description: string; completed: boolean }[] }[] = [
    { id: "a", description: "A", completed: false, subtasks: [{ id: "a1", description: "A1", completed: false }] },
    { id: "b", description: "B", completed: false },
  ]
  const onStep = (date: string, stepId: string, from: number, to: number): TimeEntry => ({
    ...block(date, "act", "cd", from, to),
    taskId: "t",
    stepId,
  })

  it("walks the subtree, adds days, and counts a log and its block once", () => {
    const day1 = onStep("2026-10-01", "a1", 60, 90)
    const day2 = onStep("2026-10-02", "a", 0, 20)
    const other = onStep("2026-10-02", "b", 30, 40)
    const task = {
      id: "t",
      subtasks: steps,
      timeLogs: [
        { date: "2026-10-01", startTime: "01:00", endTime: "01:30", durationMinutes: 30, stepId: "a1" },
        { durationMinutes: 30, stepId: "a1", entryIds: [day1.id] },
        { durationMinutes: 5, stepId: "a1" },
      ],
    }
    const entries = [day1, day1, day2, other]
    expect(stepSpentMinutes(task, "a1", entries)).toBe(35)
    expect(stepSpentMinutes(task, "a", entries)).toBe(55)
    expect(stepSpentMinutes(task, "b", entries)).toBe(10)
    expect(stepSpentMinutes(task, "missing", entries)).toBe(0)
    expect(stepSpentMap(task, entries).get("a")).toBe(55)
  })

  it("ignores blocks for another task and plain pen blocks", () => {
    const task = { id: "t", subtasks: steps, penLinks: [{ penId: "cd" }] }
    const elsewhere = { ...onStep("2026-10-01", "a", 0, 30), taskId: "u" }
    expect(stepSpentMinutes(task, "a", [elsewhere, block("2026-10-01", "act", "cd", 0, 60)])).toBe(0)
  })

  it("on finish, actualDuration takes spent when spent is larger", () => {
    const task = { id: "t", subtasks: steps }
    const entries = [onStep("2026-10-01", "b", 0, 50)]
    const ticked = steps.map((s) => (s.id === "b" ? { ...s, completed: true, actualDuration: 20 } : s))
    expect(settleSpentOnFinish(task, ticked, entries).find((s) => s.id === "b")?.actualDuration).toBe(50)
    const bigger = steps.map((s) => (s.id === "b" ? { ...s, completed: true, actualDuration: 80 } : s))
    expect(settleSpentOnFinish(task, bigger, entries).find((s) => s.id === "b")?.actualDuration).toBe(80)
    // Untouched trees come back as the same array.
    expect(settleSpentOnFinish(task, steps, entries)).toBe(steps)
  })
})

describe("timeTrio and partsMinutes", () => {
  it("parts sums the children's counting minutes, and the trio drops what is missing", () => {
    const steps = [
      { id: "a", description: "a", completed: false, estimatedDuration: 30 },
      { id: "b", description: "b", completed: false, subtasks: [{ id: "b1", description: "b1", completed: false, estimatedDuration: 15 }] },
    ]
    expect(partsMinutes(steps)).toBe(45)
    expect(partsMinutes(undefined)).toBe(0)
    expect(timeTrio(30, 45, 52)).toBe("52m · est 30 · parts 45")
    expect(timeTrio(0, 0, 0)).toBe("")
    expect(timeTrio(120, 0, 0)).toBe("est 120")
  })
})
