/** Slice H2: timebox, future note, floor, breaks, templates, Hofstadter. */
import { beforeEach, describe, expect, it } from "vitest"
import type { Subtask, Task } from "@/lib/types"
import { resetAllStores } from "@/tests/test-utils"
import {
  BUILT_IN_TEMPLATES,
  JUST_25_TEMPLATE_ID,
  addLine,
  allLines,
  breakDue,
  breakMinutes,
  cannotStartReason,
  closeSession,
  emptySession,
  endSession,
  finishLine,
  floorSuggestion,
  migrateSessionPlan,
  parkSession,
  resumeParked,
  runAgain,
  sessionFit,
  sessionFromTemplate,
  settleBreak,
  startSession,
  templateFromSession,
  tierReached,
} from "./session-plan"
import { migrateSessionBlob, parkLiveSession, useSessionPlanStore } from "./session-plan-store"

const T0 = new Date(2026, 9, 16, 20, 0, 0)
const at = (min: number) => new Date(T0.getTime() + min * 60_000)
const s = (id: string, extra: Partial<Subtask> = {}): Subtask => ({ id, description: id, completed: false, ...extra })
const t = (id: string, extra: Partial<Task> = {}): Task => ({ id, description: id, stage: "scheduled", createdAt: T0, completed: false, lists: [], ...extra })
const POINTS = { bareMin: 1, goal: 2, exceptional: 3 }

const tasks = (): Task[] => [
  t("cds", {
    subtasks: [
      s("wood", { estimatedDuration: 20 }),
      s("spines", { estimatedDuration: 5, dependsOn: ["wood"] }), // locked behind wood
      s("photos", { estimatedDuration: 10 }),
    ],
  }),
  t("later", { estimatedDuration: 2, dependencies: ["cds"] }), // waits on cds
  t("inbox", { estimatedDuration: 15 }),
]

describe("future note (FN-1)", () => {
  it("round-trips through park, resume and Run again", () => {
    const ts = tasks()
    let plan = startSession(addLine(emptySession(T0, 60), "min", { taskId: "inbox" }, ts), ts, T0)
    plan = parkSession(plan, at(10), "  start with the photos  ")
    expect(plan.futureNote).toEqual({ text: "start with the photos", at: at(10).toISOString() })
    const resumed = resumeParked(plan, ts, at(60 * 30))
    expect(resumed.futureNote?.text).toBe("start with the photos")
    const closed = closeSession(endSession(resumed, ts, at(60 * 30 + 5)), ts, POINTS, "ok", "next: spines")
    expect(closed.futureNote?.text).toBe("next: spines")
    const again = runAgain(closed, at(60 * 48))
    expect(again.futureNote).toEqual(closed.futureNote) // carried, with its own date
    expect(again.phase).toBe("draft")
  })

  it("a blank note clears it, and parking without one keeps the old", () => {
    const ts = tasks()
    let plan = startSession(addLine(emptySession(T0, 60), "min", { taskId: "inbox" }, ts), ts, T0)
    plan = parkSession(plan, at(1), "x")
    const kept = parkSession(resumeParked(plan, ts, at(2)), at(3))
    expect(kept.futureNote?.text).toBe("x")
    expect(parkSession(resumeParked(kept, ts, at(4)), at(5), "  ").futureNote).toBeUndefined()
  })
})

describe("timebox (FN-3, Just 25)", () => {
  it("reaches Bare minimum by time alone", () => {
    const ts = tasks()
    const draft = sessionFromTemplate(BUILT_IN_TEMPLATES.find((x) => x.id === JUST_25_TEMPLATE_ID)!, ts, T0)
    expect(draft.shape).toBe("timebox")
    expect(draft.durationMin).toBe(25)
    expect(cannotStartReason(draft, ts)).toBeNull() // no lines needed
    const run = startSession(draft, ts, T0)
    expect(tierReached(run, ts, at(24))).toBe("none")
    expect(tierReached(run, ts, at(25))).toBe("min")
    const ended = endSession(run, ts, at(26))
    expect(ended.reachedTier).toBe("min")
    expect(closeSession(ended, ts, POINTS, undefined, undefined, at(27)).points).toBe(1)
    // Ending early is not showing up for the whole box.
    expect(endSession(run, ts, at(10)).reachedTier).toBe("none")
  })

  it("seeds Goal and finished lines can still reach Goal", () => {
    const ts = tasks()
    const draft = sessionFromTemplate(BUILT_IN_TEMPLATES[0], ts, T0, [{ taskId: "inbox" }])
    expect(draft.tiers.min).toHaveLength(0)
    expect(draft.tiers.goal.map((l) => l.taskId)).toEqual(["inbox"])
    expect(draft.title).toBe("Just 25 · inbox")
    let run = startSession(draft, ts, T0)
    run = finishLine(run, run.tiers.goal[0].id, ts, at(5))
    expect(tierReached(run, ts, at(5))).toBe("none") // time first
    expect(tierReached(run, ts, at(25))).toBe("goal")
  })
})

describe("floor suggestion (FN-4)", () => {
  it("offers the smallest ready step and respects locks", () => {
    const ts = tasks()
    // Draft with cds in Goal: spines (5m) is locked behind wood, so photos (10m) is offered.
    const plan = addLine(emptySession(T0), "goal", { taskId: "cds" }, ts)
    expect(floorSuggestion(plan, ts)).toMatchObject({ taskId: "cds", stepId: "photos", minutes: 10 })
  })

  it("reads the lens when the draft is empty, never a task that waits", () => {
    const ts = tasks()
    const pick = floorSuggestion(emptySession(T0), ts, [ts[1], ts[2]])
    expect(pick).toMatchObject({ taskId: "inbox", minutes: 15 }) // "later" (2m) waits on cds
  })

  it("is null once Bare minimum has a line", () => {
    const ts = tasks()
    expect(floorSuggestion(addLine(emptySession(T0), "min", { taskId: "inbox" }, ts), ts, ts)).toBeNull()
  })
})

describe("fit gauge: Hofstadter and breaks", () => {
  it("pads by ×2 and sets break minutes aside", () => {
    const ts = tasks()
    const plan = addLine(emptySession(T0, 60), "min", { taskId: "inbox" }, ts) // 15m
    const [min] = sessionFit(plan, ts)
    expect(min.ratio).toBeCloseTo(0.25)
    expect(min.padded).toBeCloseTo(0.5)
    const withBreaks = { ...plan, breakEvery: 25 } // breaks at 25 and 50: 10m
    expect(breakMinutes(withBreaks)).toBe(10)
    expect(sessionFit(withBreaks, ts)[0].ratio).toBeCloseTo(15 / 50)
  })

  it("a break comes due every N minutes; taking it lets go of the line", () => {
    const ts = tasks()
    const run = startSession(addLine({ ...emptySession(T0, 60), breakEvery: 25 }, "min", { taskId: "inbox" }, ts), ts, T0)
    expect(breakDue(run, at(24))).toBe(false)
    expect(breakDue(run, at(25))).toBe(true)
    const taken = settleBreak(run, true, at(25))
    expect(taken.activeLineId).toBeUndefined()
    expect(taken.clock?.running).toBe(true)
    expect(allLines(taken)[0].line.actualSec).toBe(25 * 60)
    expect(breakDue(taken, at(30))).toBe(false)
    expect(breakDue(taken, at(50))).toBe(true) // the second, at 50 of 60
    expect(breakDue(settleBreak(taken, false, at(50)), at(59))).toBe(false) // none at the very end
  })
})

describe("templates", () => {
  beforeEach(() => resetAllStores())

  it("saves a draft's shape and drops lines whose task is gone", () => {
    const ts = tasks()
    const plan = addLine(addLine({ ...emptySession(T0, 90), breakEvery: 45 }, "min", { taskId: "inbox" }, ts), "goal", { taskId: "cds", stepId: "photos" }, ts)
    const tpl = templateFromSession(plan, "Evening CDs")
    expect(tpl).toMatchObject({ title: "Evening CDs", durationMin: 90, breakEvery: 45 })
    useSessionPlanStore.getState().saveTemplate(tpl)
    useSessionPlanStore.getState().saveTemplate({ ...templateFromSession(plan), title: "evening cds" })
    expect(useSessionPlanStore.getState().templates).toHaveLength(1)
    const fresh = sessionFromTemplate(tpl, ts.filter((x) => x.id !== "inbox"), T0)
    expect(fresh.tiers.min).toHaveLength(0)
    expect(fresh.tiers.goal[0]).toMatchObject({ taskId: "cds", stepId: "photos" })
    expect(fresh.id).not.toBe(plan.id)
  })
})

describe("old blobs", () => {
  it("load with neither futureNote nor shape, and no templates", () => {
    const old = { ...emptySession(T0), id: "o" } as Record<string, unknown>
    const plan = migrateSessionPlan(old)!
    expect(plan.futureNote).toBeUndefined()
    expect(plan.shape).toBeUndefined()
    expect(tierReached(plan, [])).toBe("none")
    const blob = migrateSessionBlob({ open: [old], history: [], kept: [] })
    expect(blob.templates).toEqual([])
    expect(blob.open[0].shape).toBeUndefined()
  })
})

describe("park from outside the popup (focus bar)", () => {
  beforeEach(() => resetAllStores())

  it("parks the running session with a note, and is a no-op otherwise", () => {
    expect(parkLiveSession(T0)).toBeNull()
    const ts = tasks()
    const run = startSession(addLine(emptySession(T0, 60), "min", { taskId: "inbox" }, ts), ts, T0)
    useSessionPlanStore.getState().put(run, T0)
    const parked = parkLiveSession(at(5), "photos next")
    expect(parked?.phase).toBe("parked")
    expect(useSessionPlanStore.getState().open[0]).toMatchObject({ phase: "parked", futureNote: { text: "photos next" } })
  })
})
