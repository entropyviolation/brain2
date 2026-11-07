import { beforeEach, describe, expect, it } from "vitest"
import { getDefaultHabits, useHabitsStore } from "@/lib/habits-store"
import { applyStep } from "./apply"
import { checkStep, stepPasses } from "./checks"
import { acceptStep, reviseWire } from "./decide"
import { looksLikeWire, planWire, type WireDeps } from "./plan"
import { useWireStore } from "./store"
import { resolveDetailPanels } from "@/lib/habit-detail-view"
import { wireField } from "./types"

const ONE = "make it so the daily habits detail view includes pages read and attaches a Book type item that user can tell exactly how many pages of what book they read if they want"
const TWO =
  "Connect the 'speed reader' module to daily reading habit by making it so all pages read in speed reader for a book are logged with that book item (created if it doesnt exist or search for one that does) and that number of pages is passed to the habit (also speed reader module should report the time when reading occured)"

const deps = (): WireDeps => ({
  habits: useHabitsStore.getState().tasks,
  types: [{ id: "book", name: "Book", pluralName: "Books" }, { id: "task", name: "Task" }],
})

beforeEach(() => {
  useHabitsStore.setState({ tasks: getDefaultHabits() })
  useWireStore.setState({ plans: {}, order: [] })
})

describe("Wire BIMBY reads the requests", () => {
  it("recognizes both and ignores ordinary lines", () => {
    expect(looksLikeWire(ONE)).toBe(true)
    expect(looksLikeWire(TWO)).toBe(true)
    expect(looksLikeWire("read 3 pages of dune")).toBe(false)
    expect(looksLikeWire("had a coffee and took a nap today")).toBe(false)
  })

  it("request one: breakdown and entry on the daily reading habit, not the writing one", () => {
    const plan = planWire(ONE, deps(), new Date())
    expect(plan.steps.map((s) => s.kind)).toEqual(["breakdown", "entry"])
    expect(plan.steps.every((s) => wireField(s, "habit") === "task-9")).toBe(true)
    expect(plan.steps.every((s) => wireField(s, "subjectType") === "book")).toBe(true)
    expect(plan.steps.every((s) => stepPasses(checkStep(s, deps())))).toBe(true)
  })

  it("request two: connects Speed Read to the reading habit, with the time", () => {
    const plan = planWire(TWO, deps(), new Date())
    const feed = plan.steps.find((s) => s.kind === "feed")!
    expect(wireField(feed, "module")).toBe("speed-read")
    expect(wireField(feed, "habit")).toBe("task-9")
    expect(checkStep(feed, deps()).map((c) => c.text).join(" ")).toMatch(/reports when it happened/)
    expect(stepPasses(checkStep(feed, deps()))).toBe(true)
  })

  it("refuses a pairing the module cannot satisfy", () => {
    const plan = planWire(TWO, deps(), new Date())
    const feed = plan.steps.find((s) => s.kind === "feed")!
    const minutes = { ...feed, fields: feed.fields.map((f) => (f.key === "measure" ? { ...f, value: "minutes" } : f)) }
    expect(stepPasses(checkStep(minutes, deps()))).toBe(false)
    const weekly = { ...feed, fields: feed.fields.map((f) => (f.key === "habit" ? { ...f, value: "task-1791320833015" } : f)) }
    expect(stepPasses(checkStep(weekly, deps()))).toBe(false)
  })
})

describe("accept, then tweak", () => {
  it("writes the feed and the panels on one habit and nothing else", () => {
    const plan = planWire(`${ONE}\n${TWO}`, deps(), new Date())
    useWireStore.getState().put(plan)
    const others = useHabitsStore.getState().tasks.filter((t) => t.id !== "task-9")
    for (const s of plan.steps) acceptStep(plan.id, s.id)
    const stored = useWireStore.getState().plans[plan.id]!
    expect(stored.steps.map((s) => s.status)).toEqual(plan.steps.map(() => "applied"))
    const habit = useHabitsStore.getState().tasks.find((t) => t.id === "task-9")!
    expect(habit.moduleFeeds?.map((f) => f.moduleId).sort()).toEqual(["habit-entry", "speed-read"])
    expect(resolveDetailPanels(habit).map((p) => p.kind)).toEqual(["sources", "breakdown", "entry"])
    expect(useHabitsStore.getState().tasks.filter((t) => t.id !== "task-9")).toEqual(others)
  })

  it("a failed check blocks the write", () => {
    const plan = planWire(TWO, deps(), new Date())
    const feed = plan.steps.find((s) => s.kind === "feed")!
    const bad = { ...feed, fields: feed.fields.map((f) => (f.key === "habit" ? { ...f, value: "" } : f)) }
    expect(applyStep(bad).ok).toBe(false)
    expect(useHabitsStore.getState().tasks.find((t) => t.id === "task-9")?.moduleFeeds ?? null).toBeNull()
  })

  it("a tweak rebuilds the same card and keeps what was already saved", () => {
    const plan = planWire(TWO, deps(), new Date())
    useWireStore.getState().put(plan)
    const feed = plan.steps.find((s) => s.kind === "feed")!
    acceptStep(plan.id, feed.id)
    expect(reviseWire(plan.id, "also make the detail view include pages read and let me type in which book", new Date())).toBe(true)
    const next = useWireStore.getState().plans[plan.id]!
    expect(next.revisions).toBe(1)
    expect(next.steps.find((s) => s.kind === "feed")?.status).toBe("applied")
    expect(next.steps.some((s) => s.kind === "entry")).toBe(true)
  })
})
