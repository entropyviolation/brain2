import { describe, it, expect } from "vitest"
import {
  addSidequest,
  addSubarea,
  addSubareaCheck,
  addTask,
  beginSidequestPick,
  blankHouseCleaning,
  blankSidequestEarn,
  completeTask,
  deleteArea,
  deleteSidequest,
  deleteSubareaCheck,
  deleteTask,
  endStuckMode,
  fillStuckTitle,
  filterAndSort,
  fmtClock,
  fmtMin,
  importBulk,
  insertNotFirst,
  interleaveInterstitials,
  matchLeaf,
  normalizeHouseCleaning,
  parseBulk,
  pickSidequestMinutes,
  pickStuckCount,
  pickSubareaCount,
  pickSubareaThreshold,
  planAdd,
  planContains,
  startPlan,
  resolveStuckN,
  seedHouseCleaning,
  startSidequest,
  startStuckMode,
  startSubareaSession,
  stuckComplete,
  subareaCanAdvance,
  subareaCheckProgress,
  subareaComplete,
  subareaEffectiveThreshold,
  subareaProgress,
  subareaSessionChecks,
  subareaSweepTitle,
  SUBAREA_BOX_TITLE,
  SUBAREA_SWEEP_TITLE,
  todayProgress,
  toggleDone,
  toggleSubareaCheck,
} from "./house-cleaning"

describe("normalizeHouseCleaning", () => {
  it("returns defaults for empty input", () => {
    const s = normalizeHouseCleaning(null)
    expect(s.areas.map((a) => a.id)).toEqual(["kitchen", "living", "bedroom", "bathroom", "entry", "laundry"])
    expect(s.tasks).toEqual([])
    expect(s.filters.hideDone).toBe(false)
    expect(s.sidequests).toEqual([])
    expect(s.sidequestEarn).toEqual({ tasks: 0, sessions: 0, unlocked: false })
    expect(s.sidequestSession).toBeNull()
  })

  it("keeps tasks, stuck list, and filters from persisted JSON", () => {
    const s = normalizeHouseCleaning({
      areas: [{ id: "office", name: "Office" }],
      tasks: [{ id: "t1", areaId: "office", title: "Wipe desk", importance: "crucial", estMin: 5, done: false }],
      stuckTasks: [{ id: "s1", title: "Put {n} away", kind: "repeat", nMode: "fixed", nFixed: 7 }],
      filters: { hideDone: true, imp: { crucial: false } },
    })
    expect(s.areas).toEqual([{ id: "office", name: "Office" }])
    expect(s.tasks[0].title).toBe("Wipe desk")
    expect(s.stuckTasks[0].nFixed).toBe(7)
    expect(s.filters.hideDone).toBe(true)
    expect(s.filters.imp.crucial).toBe(false)
    expect(s.filters.imp.important).toBe(true)
    expect(s.subareas).toEqual([])
    expect(s.subareaSession).toBeNull()
    expect(s.sidequests).toEqual([])
    expect(s.sidequestEarn).toEqual({ tasks: 0, sessions: 0, unlocked: false })
    expect(s.sidequestSession).toBeNull()
  })

  it("keeps subareas from persisted JSON", () => {
    const s = normalizeHouseCleaning({
      areas: [{ id: "kitchen", name: "Kitchen" }],
      subareas: [{ id: "sa1", areaId: "kitchen", name: "Sink", done: true }],
    })
    expect(s.subareas).toEqual([
      expect.objectContaining({ id: "sa1", areaId: "kitchen", name: "Sink", done: true }),
    ])
  })
})

describe("parseBulk / importBulk", () => {
  it("parses area headers and tasks", () => {
    const blocks = parseBulk("Kitchen:\ndo dishes\nclear counters\n\nLiving room:\nclean rug")
    expect(blocks).toEqual([
      { name: "Kitchen", tasks: ["do dishes", "clear counters"] },
      { name: "Living room", tasks: ["clean rug"] },
    ])
  })

  it("imports into existing areas and skips duplicates", () => {
    let s = blankHouseCleaning()
    s = addTask(s, { areaId: "kitchen", title: "Do dishes", importance: "unset" }).state
    const { state, message } = importBulk(s, "Kitchen:\nDo dishes\nWipe stove\n\nOffice:\nClear desk")
    expect(state.areas.some((a) => a.name === "Office")).toBe(true)
    expect(state.tasks.filter((t) => t.areaId === "kitchen").map((t) => t.title)).toEqual(["Do dishes", "Wipe stove"])
    expect(message).toContain("skipped 1 duplicate")
    expect(message).toContain("1 new")
  })
})

describe("filters and progress", () => {
  it("hides done leaves and respects max minutes", () => {
    let s = blankHouseCleaning()
    s = addTask(s, { areaId: "kitchen", title: "Quick", importance: "crucial", estMin: 5 }).state
    s = addTask(s, { areaId: "kitchen", title: "Deep", importance: "crucial", estMin: 40 }).state
    const quick = s.tasks[0]
    s = completeTask(s, quick.id, Date.now())
    s = { ...s, filters: { ...s.filters, hideDone: true, maxMin: 15 } }
    const shown = filterAndSort(
      s,
      s.tasks.filter((t) => !t.parentId),
    )
    expect(shown.map((t) => t.title)).toEqual([])
    s = { ...s, filters: { ...s.filters, hideDone: false, maxMin: 15 } }
    expect(matchLeaf(s, s.tasks.find((t) => t.title === "Deep")!)).toBe(false)
    expect(matchLeaf(s, s.tasks.find((t) => t.title === "Quick")!)).toBe(true)
  })

  it("counts only today's completions toward the goal", () => {
    let s = blankHouseCleaning()
    s = addTask(s, { areaId: "kitchen", title: "A", importance: "crucial" }).state
    s = addTask(s, { areaId: "kitchen", title: "B", importance: "important" }).state
    const now = Date.parse("2026-08-25T12:00:00Z")
    s = completeTask(s, s.tasks[0].id, now)
    s = {
      ...s,
      tasks: s.tasks.map((t) => (t.title === "B" ? { ...t, done: true, completedAt: now - 86400000 * 2 } : t)),
    }
    expect(todayProgress(s, now)).toEqual({ total: 1, crucial: 1 })
  })
})

describe("stuck mode", () => {
  it("fills {n} in titles and prefers 2–3 picks", () => {
    expect(fillStuckTitle("Pick up {n} items", 12)).toBe("Pick up 12 items")
    expect(pickStuckCount(10, () => 0.5)).toBe(3)
    expect(pickStuckCount(10, () => 0.05)).toBe(1)
    const st = seedHouseCleaning().stuckTasks.find((t) => t.nMode === "fixed" || t.title.includes("{n}"))!
    expect(resolveStuckN({ ...st, nMode: "fixed", nFixed: 9, kind: "repeat" })).toBe(9)
  })

  it("starts a session and records actuals on complete", () => {
    const seeded = seedHouseCleaning()
    const started = startStuckMode(seeded, () => 0.5)
    if ("error" in started) throw new Error(started.error)
    expect(started.stuckSession?.phase).toBe("task")
    expect(started.stuckSession?.items.length).toBeGreaterThan(0)
    const done = stuckComplete(started, Date.now())
    const item = started.stuckSession!.items[0]
    const rec = done.stuckTasks.find((t) => t.id === item.taskId)
    expect(rec?.actuals.length).toBe(1)
  })
})

describe("plans and delete", () => {
  it("adds a task to a tier and scrubs it when deleted", () => {
    let s = seedHouseCleaning()
    s = { ...s, plan: { durationHr: 1, durationMin: 0, durationSec: 3600, tiers: { min: [], good: [], extra: [] }, phase: "draft", clock: null, createdAt: 1 } }
    const id = s.tasks[0].id
    s = planAdd(s, "min", id)
    expect(planContains(s, id)).toBe(true)
    s = deleteTask(s, id)
    expect(planContains(s, id)).toBe(false)
    expect(s.tasks.some((t) => t.id === id)).toBe(false)
  })

  it("add, edit, and delete tasks while a plan is running without stopping the clock", () => {
    let s = seedHouseCleaning()
    s = {
      ...s,
      plan: {
        durationHr: 1,
        durationMin: 0,
        durationSec: 3600,
        tiers: { min: [], good: [], extra: [] },
        phase: "draft",
        clock: null,
        createdAt: 1,
      },
    }
    const planned = s.tasks[0]
    s = planAdd(s, "min", planned.id)
    s = startPlan(s, 1000)
    expect(s.plan?.phase).toBe("run")
    expect(s.plan?.clock?.running).toBe(true)
    const clock = s.plan!.clock

    const { state: added, task } = addTask(s, { areaId: "kitchen", title: "New during run", importance: "important", estMin: 8 })
    s = added
    expect(s.tasks.some((t) => t.id === task.id)).toBe(true)
    expect(planContains(s, task.id)).toBe(false)
    expect(s.plan?.phase).toBe("run")
    expect(s.plan?.clock).toEqual(clock)

    s = {
      ...s,
      tasks: s.tasks.map((t) =>
        t.id === task.id ? { ...t, title: "Edited during run", estMin: 12, importance: "crucial" } : t,
      ),
    }
    expect(s.tasks.find((t) => t.id === task.id)).toMatchObject({
      title: "Edited during run",
      estMin: 12,
      importance: "crucial",
    })
    expect(s.plan?.clock).toEqual(clock)

    s = deleteTask(s, planned.id)
    expect(s.tasks.some((t) => t.id === planned.id)).toBe(false)
    expect(planContains(s, planned.id)).toBe(false)
    expect(s.plan?.phase).toBe("run")
    expect(s.plan?.clock).toEqual(clock)
  })
})

describe("fmt", () => {
  it("formats clocks and minutes like Tidy", () => {
    expect(fmtClock(75)).toBe("1:15")
    expect(fmtClock(3661)).toBe("1:01:01")
    expect(fmtMin(90)).toBe("1h 30m")
    expect(fmtMin(60)).toBe("1h")
  })
})

describe("subareas", () => {
  it("picks 2–3 when possible", () => {
    expect(pickSubareaCount(10, () => 0.4)).toBe(2)
    expect(pickSubareaCount(10, () => 0.6)).toBe(3)
    expect(pickSubareaCount(2, () => 0.9)).toBe(2)
    expect(pickSubareaCount(1, () => 0.9)).toBe(1)
    expect(pickSubareaCount(0)).toBe(0)
  })

  it("starts a session of 2–3 perfects with independent sweep and box cadences, never first", () => {
    let s = blankHouseCleaning()
    s = addSubarea(s, "kitchen", "Sink")
    s = addSubarea(s, "kitchen", "Stove")
    s = addSubarea(s, "kitchen", "Fridge")
    s = addSubarea(s, "kitchen", "Counters")
    const started = startSubareaSession(s, "kitchen", () => 0.6)
    if ("error" in started) throw new Error(started.error)
    const items = started.subareaSession?.items ?? []
    expect(items[0].kind).toBe("perfect")
    expect(items.filter((it) => it.kind === "perfect")).toHaveLength(3)
    expect(items.filter((it) => it.kind === "sweep").length).toBeGreaterThanOrEqual(1)
    expect(items.filter((it) => it.kind === "box").length).toBeGreaterThanOrEqual(1)
    expect(items.filter((it) => it.kind === "box")).toEqual(
      expect.arrayContaining([expect.objectContaining({ kind: "box", title: SUBAREA_BOX_TITLE, checks: [] })]),
    )
    expect(items.filter((it) => it.kind === "sweep")).toEqual(
      expect.arrayContaining([expect.objectContaining({ kind: "sweep", title: "Sweep the Kitchen", checks: [] })]),
    )
    expect(items[0].title.startsWith("Perfect the ")).toBe(true)
    expect(items.every((it) => it.threshold >= 50 && it.threshold <= 80)).toBe(true)
    expect(started.subareaSession?.bank).toBe(0)
  })

  it("can place more than one sweep and more than one box in a longer pick", () => {
    let s = blankHouseCleaning()
    s = addSubarea(s, "kitchen", "Sink")
    s = addSubarea(s, "kitchen", "Stove")
    s = addSubarea(s, "kitchen", "Fridge")
    const started = startSubareaSession(s, "kitchen", () => 0)
    if ("error" in started) throw new Error(started.error)
    const items = started.subareaSession?.items ?? []
    expect(items[0].kind).toBe("perfect")
    expect(items.filter((it) => it.kind === "perfect")).toHaveLength(2)
    expect(items.filter((it) => it.kind === "sweep").length).toBeGreaterThan(1)
    expect(items.filter((it) => it.kind === "box").length).toBeGreaterThan(1)
    expect(items.map((it) => it.kind)).toEqual(["perfect", "sweep", "box", "perfect", "sweep", "box"])
  })

  it("inserts the miscellaneous box anywhere except first", () => {
    expect(insertNotFirst(["a", "b", "c"], "x", () => 0)).toEqual(["a", "x", "b", "c"])
    expect(insertNotFirst(["a", "b", "c"], "x", () => 0.99)).toEqual(["a", "b", "c", "x"])
    expect(insertNotFirst(["a"], "x", () => 0.4)).toEqual(["a", "x"])
  })

  it("interleaves sweep and box on independent 1–3 cadences, never first", () => {
    expect(interleaveInterstitials([], { sweep: "S", box: "B" }, () => 0)).toEqual([])
    expect(interleaveInterstitials(["P"], { sweep: "S", box: "B" }, () => 0)[0]).toBe("P")
    expect(interleaveInterstitials(["P"], { sweep: "S", box: "B" }, () => 0)).toEqual(["P", "S", "B"])
    expect(interleaveInterstitials(["P1", "P2"], { sweep: "S", box: "B" }, () => 0)).toEqual([
      "P1",
      "S",
      "B",
      "P2",
      "S",
      "B",
    ])
    expect(interleaveInterstitials(["P1", "P2", "P3"], { sweep: "S", box: "B" }, () => 0.99)).toEqual([
      "P1",
      "P2",
      "P3",
      "S",
      "B",
    ])
    expect(subareaSweepTitle("Kitchen")).toBe("Sweep the Kitchen")
    expect(subareaSweepTitle("")).toBe(SUBAREA_SWEEP_TITLE)
  })

  it("marks subareas done across the session including a mid-sequence box", () => {
    let s = blankHouseCleaning()
    s = addSubarea(s, "kitchen", "Sink")
    s = addSubarea(s, "kitchen", "Stove")
    const started = startSubareaSession(s, "kitchen", () => 0)
    if ("error" in started) throw new Error(started.error)
    const items = started.subareaSession!.items
    expect(items[0].kind).toBe("perfect")
    expect(items.some((it) => it.kind === "box")).toBe(true)
    let cur = started
    for (let i = 0; i < items.length; i++) {
      expect(subareaCanAdvance(cur)).toBe(true)
      cur = subareaComplete(cur, 1000 + i)
    }
    expect(cur.subareaSession?.phase).toBe("done")
    expect(cur.subareas.filter((x) => x.done).map((x) => x.name).sort()).toEqual(["Sink", "Stove"])
  })

  it("lets you add a binary checklist and advance once progress hits the threshold", () => {
    let s = blankHouseCleaning()
    s = addSubarea(s, "kitchen", "Bookshelf")
    const started = startSubareaSession(s, "kitchen", () => 0.5)
    if ("error" in started) throw new Error(started.error)
    expect(started.subareaSession!.items[0].threshold).toBe(65)
    expect(subareaCanAdvance(started)).toBe(true)
    s = addSubareaCheck(started, "Sort books")
    s = addSubareaCheck(s, "Clean shelves")
    expect(subareaSessionChecks(s).map((c) => c.title)).toEqual(["Sort books", "Clean shelves"])
    expect(subareaCanAdvance(s)).toBe(false)
    expect(subareaComplete(s, 1)).toBe(s)
    const first = subareaSessionChecks(s)[0]
    s = toggleSubareaCheck(s, first.id)
    expect(subareaCanAdvance(s)).toBe(false)
    const second = subareaSessionChecks(s)[1]
    s = toggleSubareaCheck(s, second.id)
    expect(subareaCanAdvance(s)).toBe(true)
    s = addSubareaCheck(s, "Declutter")
    expect(subareaProgress(s).percent).toBe(67)
    expect(subareaCanAdvance(s)).toBe(true)
    const extra = subareaSessionChecks(s)[2]
    s = toggleSubareaCheck(s, extra.id)
    expect(subareaCanAdvance(s)).toBe(true)
    const sa = s.subareas.find((x) => x.name === "Bookshelf")
    expect(sa?.checks.map((c) => c.title)).toEqual(["Sort books", "Clean shelves", "Declutter"])
  })

  it("nests subtasks, advances on leaves, and persists only on that subarea", () => {
    let s = blankHouseCleaning()
    s = addSubarea(s, "kitchen", "Sink")
    s = addSubarea(s, "kitchen", "Stove")
    const started = startSubareaSession(s, "kitchen", () => 0)
    if ("error" in started) throw new Error(started.error)
    const first = started.subareaSession!.items[0]
    expect(first.kind).toBe("perfect")
    const subareaId = first.subareaId!

    expect(subareaCheckProgress([])).toEqual({ done: 0, total: 0, pct: 100 })
    s = addSubareaCheck(started, "Wipe faucet")
    const parent = subareaSessionChecks(s)[0]
    s = addSubareaCheck(s, "Handle", parent.id)
    s = addSubareaCheck(s, "Base", parent.id)
    expect(subareaCanAdvance(s)).toBe(false)
    expect(subareaCheckProgress(subareaSessionChecks(s))).toEqual({ done: 0, total: 2, pct: 0 })

    const kids = subareaSessionChecks(s)[0].checks!
    s = toggleSubareaCheck(s, kids[0].id)
    expect(subareaCanAdvance(s)).toBe(true)
    expect(subareaCheckProgress(subareaSessionChecks(s))).toEqual({ done: 1, total: 2, pct: 50 })
    s = toggleSubareaCheck(s, kids[1].id)
    expect(subareaCanAdvance(s)).toBe(true)
    expect(subareaCheckProgress(subareaSessionChecks(s))).toEqual({ done: 2, total: 2, pct: 100 })
    expect(subareaSessionChecks(s)[0].done).toBe(true)

    const saved = s.subareas.find((x) => x.id === subareaId)
    expect(saved?.checks[0].title).toBe("Wipe faucet")
    expect(saved?.checks[0].checks?.map((c) => c.title)).toEqual(["Handle", "Base"])
    const other = s.subareas.find((x) => x.id !== subareaId)
    expect(other?.checks).toEqual([])
    expect(s.needed).toEqual([])
    expect(s.tasks).toEqual([])
    expect(s.stuckTasks).toEqual([])
    expect(s.sidequests).toEqual([])

    const again = startSubareaSession({ ...s, subareaSession: null }, "kitchen", () => 0)
    if ("error" in again) throw new Error(again.error)
    const round = again.subareaSession!.items.find((it) => it.subareaId === subareaId)
    expect(round?.checks[0].title).toBe("Wipe faucet")
    expect(round?.checks[0].done).toBe(false)
    expect(round?.checks[0].checks?.map((c) => c.title)).toEqual(["Handle", "Base"])
    expect(round?.checks[0].checks?.every((c) => !c.done)).toBe(true)
  })

  it("checking a parent with subtasks marks every child done; deleting the parent removes them", () => {
    let s = blankHouseCleaning()
    s = addSubarea(s, "kitchen", "Sink")
    const started = startSubareaSession(s, "kitchen", () => 0)
    if ("error" in started) throw new Error(started.error)
    s = addSubareaCheck(started, "Wipe faucet")
    const parent = subareaSessionChecks(s)[0]
    s = addSubareaCheck(s, "Handle", parent.id)
    s = addSubareaCheck(s, "Base", parent.id)
    expect(subareaCanAdvance(s)).toBe(false)
    s = toggleSubareaCheck(s, parent.id)
    expect(subareaSessionChecks(s)[0].checks?.every((c) => c.done)).toBe(true)
    expect(subareaCanAdvance(s)).toBe(true)
    s = toggleSubareaCheck(s, parent.id)
    expect(subareaSessionChecks(s)[0].checks?.every((c) => !c.done)).toBe(true)
    expect(subareaCanAdvance(s)).toBe(false)
    s = deleteSubareaCheck(s, parent.id)
    expect(subareaSessionChecks(s)).toEqual([])
    expect(s.subareas.find((x) => x.name === "Sink")?.checks).toEqual([])
    expect(subareaCanAdvance(s)).toBe(true)
  })

  it("keeps nested checks when normalizing persisted JSON", () => {
    const s = normalizeHouseCleaning({
      areas: [{ id: "kitchen", name: "Kitchen" }],
      subareas: [
        {
          id: "sa1",
          areaId: "kitchen",
          name: "Sink",
          checks: [
            {
              id: "c1",
              title: "Wipe faucet",
              done: false,
              checks: [{ id: "c2", title: "Handle", done: true }],
            },
          ],
        },
      ],
    })
    expect(s.subareas[0].checks[0].checks).toEqual([expect.objectContaining({ id: "c2", title: "Handle", done: true })])
  })

  it("drops an area's subareas when the area is deleted", () => {
    let s = blankHouseCleaning()
    s = addSubarea(s, "kitchen", "Sink")
    s = addSubarea(s, "living", "Couch")
    s = deleteArea(s, "kitchen")
    expect(s.subareas.map((x) => x.areaId)).toEqual(["living"])
    expect(s.areas.some((a) => a.id === "kitchen")).toBe(false)
  })

  it("picks a stop threshold between 50 and 80", () => {
    expect(pickSubareaThreshold(() => 0)).toBe(50)
    expect(pickSubareaThreshold(() => 1)).toBe(80)
    expect(pickSubareaThreshold(() => 0.5)).toBe(65)
  })

  it("lets an empty list advance and gates Next on the effective threshold", () => {
    let s = blankHouseCleaning()
    s = addSubarea(s, "kitchen", "Sink")
    const sa = s.subareas[0]
    const checks = Array.from({ length: 10 }, (_, i) => ({
      id: `leaf-${i}`,
      title: `Leaf ${i + 1}`,
      done: i < 4,
    }))
    s = {
      ...s,
      subareaSession: {
        areaId: "kitchen",
        bank: 0,
        index: 0,
        phase: "task",
        items: [{ kind: "perfect", subareaId: sa.id, title: "Perfect the Sink", checks: [], threshold: 50 }],
      },
    }
    expect(subareaProgress(s)).toEqual({ doneLeaves: 0, totalLeaves: 0, percent: 100 })
    expect(subareaCanAdvance(s)).toBe(true)

    s = {
      ...s,
      subareaSession: {
        ...s.subareaSession!,
        items: [{ ...s.subareaSession!.items[0], checks }],
      },
    }
    expect(subareaProgress(s)).toEqual({ doneLeaves: 4, totalLeaves: 10, percent: 40 })
    expect(subareaEffectiveThreshold(s)).toBe(50)
    expect(subareaCanAdvance(s)).toBe(false)
    expect(subareaComplete(s, 1)).toBe(s)

    s = {
      ...s,
      subareaSession: {
        ...s.subareaSession!,
        items: [
          {
            ...s.subareaSession!.items[0],
            checks: checks.map((c, i) => ({ ...c, done: i < 5 })),
          },
        ],
      },
    }
    expect(subareaProgress(s).percent).toBe(50)
    expect(subareaCanAdvance(s)).toBe(true)
  })

  it("banks extra completion into later stops in the same run", () => {
    let s = blankHouseCleaning()
    s = addSubarea(s, "kitchen", "Sink")
    s = addSubarea(s, "kitchen", "Stove")
    s = addSubarea(s, "kitchen", "Fridge")
    const [sink, stove, fridge] = s.subareas
    const leaves = (done: number) =>
      Array.from({ length: 10 }, (_, i) => ({
        id: `l${done}-${i}`,
        title: `Leaf ${i + 1}`,
        done: i < done,
      }))
    s = {
      ...s,
      subareaSession: {
        areaId: "kitchen",
        bank: 0,
        index: 0,
        phase: "task",
        items: [
          { kind: "perfect", subareaId: sink.id, title: "Perfect the Sink", checks: leaves(8), threshold: 50 },
          { kind: "perfect", subareaId: stove.id, title: "Perfect the Stove", checks: leaves(0), threshold: 60 },
          { kind: "perfect", subareaId: fridge.id, title: "Perfect the Fridge", checks: leaves(0), threshold: 70 },
        ],
      },
    }
    expect(subareaProgress(s).percent).toBe(80)
    expect(subareaEffectiveThreshold(s)).toBe(50)
    s = subareaComplete(s, 1)
    expect(s.subareaSession?.index).toBe(1)
    expect(s.subareaSession?.bank).toBe(30)
    expect(subareaEffectiveThreshold(s)).toBe(30)
    expect(s.subareas.find((x) => x.id === sink.id)?.done).toBe(true)

    s = {
      ...s,
      subareaSession: {
        ...s.subareaSession!,
        items: s.subareaSession!.items.map((it, i) => (i === 1 ? { ...it, checks: leaves(8) } : it)),
      },
    }
    expect(subareaProgress(s).percent).toBe(80)
    expect(subareaEffectiveThreshold(s)).toBe(30)
    s = subareaComplete(s, 2)
    expect(s.subareaSession?.index).toBe(2)
    expect(s.subareaSession?.bank).toBe(80)
    expect(subareaEffectiveThreshold(s)).toBe(0)
  })

  it("banks extra completion across a sweep or box stop in the same run", () => {
    let s = blankHouseCleaning()
    s = addSubarea(s, "kitchen", "Sink")
    s = addSubarea(s, "kitchen", "Stove")
    const [sink, stove] = s.subareas
    const leaves = (done: number) =>
      Array.from({ length: 10 }, (_, i) => ({
        id: `l${done}-${i}`,
        title: `Leaf ${i + 1}`,
        done: i < done,
      }))
    s = {
      ...s,
      subareaSession: {
        areaId: "kitchen",
        bank: 0,
        index: 0,
        phase: "task",
        items: [
          { kind: "perfect", subareaId: sink.id, title: "Perfect the Sink", checks: leaves(8), threshold: 50 },
          { kind: "sweep", title: "Sweep the Kitchen", checks: leaves(0), threshold: 60 },
          { kind: "box", title: SUBAREA_BOX_TITLE, checks: leaves(0), threshold: 55 },
          { kind: "perfect", subareaId: stove.id, title: "Perfect the Stove", checks: leaves(0), threshold: 70 },
        ],
      },
    }
    expect(subareaProgress(s).percent).toBe(80)
    expect(subareaEffectiveThreshold(s)).toBe(50)
    s = subareaComplete(s, 1)
    expect(s.subareaSession?.index).toBe(1)
    expect(s.subareaSession?.items[1].kind).toBe("sweep")
    expect(s.subareaSession?.bank).toBe(30)
    expect(subareaEffectiveThreshold(s)).toBe(30)
    expect(s.subareas.find((x) => x.id === sink.id)?.done).toBe(true)
    expect(s.subareas.find((x) => x.id === stove.id)?.done).toBe(false)

    s = {
      ...s,
      subareaSession: {
        ...s.subareaSession!,
        items: s.subareaSession!.items.map((it, i) => (i === 1 ? { ...it, checks: leaves(8) } : it)),
      },
    }
    expect(subareaProgress(s).percent).toBe(80)
    expect(subareaEffectiveThreshold(s)).toBe(30)
    s = subareaComplete(s, 2)
    expect(s.subareaSession?.index).toBe(2)
    expect(s.subareaSession?.items[2].kind).toBe("box")
    expect(s.subareaSession?.bank).toBe(80)
    expect(subareaEffectiveThreshold(s)).toBe(0)
    expect(s.subareas.find((x) => x.name === "Sink")?.done).toBe(true)
    expect(s.subareas.filter((x) => x.done)).toHaveLength(1)
    expect(s.subareas.find((x) => x.id === stove.id)?.done).toBe(false)
  })

  it("does not increase the bank when leaving at the threshold", () => {
    let s = blankHouseCleaning()
    s = addSubarea(s, "kitchen", "Sink")
    s = addSubarea(s, "kitchen", "Stove")
    const [sink, stove] = s.subareas
    const checks = Array.from({ length: 10 }, (_, i) => ({
      id: `t${i}`,
      title: `Leaf ${i + 1}`,
      done: i < 5,
    }))
    s = {
      ...s,
      subareaSession: {
        areaId: "kitchen",
        bank: 0,
        index: 0,
        phase: "task",
        items: [
          { kind: "perfect", subareaId: sink.id, title: "Perfect the Sink", checks, threshold: 50 },
          { kind: "perfect", subareaId: stove.id, title: "Perfect the Stove", checks: [], threshold: 60 },
        ],
      },
    }
    s = subareaComplete(s, 1)
    expect(s.subareaSession?.bank).toBe(0)
    expect(subareaEffectiveThreshold(s)).toBe(60)
  })

  it("resets the bank when a new Perfect session starts", () => {
    let s = blankHouseCleaning()
    s = addSubarea(s, "kitchen", "Sink")
    s = {
      ...s,
      subareaSession: {
        areaId: "kitchen",
        bank: 40,
        index: 0,
        phase: "task",
        items: [{ kind: "perfect", subareaId: s.subareas[0].id, title: "Perfect the Sink", checks: [], threshold: 70 }],
      },
    }
    const started = startSubareaSession(s, "kitchen", () => 0)
    if ("error" in started) throw new Error(started.error)
    expect(started.subareaSession?.bank).toBe(0)
    expect(started.subareaSession?.items.every((it) => it.threshold >= 50 && it.threshold <= 80)).toBe(true)
  })

  it("keeps a 100% gate on old in-flight sessions without threshold or bank", () => {
    const s = normalizeHouseCleaning({
      areas: [{ id: "kitchen", name: "Kitchen" }],
      subareas: [{ id: "sa1", areaId: "kitchen", name: "Sink" }],
      subareaSession: {
        areaId: "kitchen",
        index: 0,
        phase: "task",
        items: [
          {
            kind: "perfect",
            subareaId: "sa1",
            title: "Perfect the Sink",
            checks: [
              { id: "c1", title: "A", done: true },
              { id: "c2", title: "B", done: false },
            ],
          },
        ],
      },
    })
    expect(s.subareaSession?.bank).toBe(0)
    expect(s.subareaSession?.items[0].threshold).toBe(100)
    expect(subareaProgress(s).percent).toBe(50)
    expect(subareaCanAdvance(s)).toBe(false)
  })

  it("normalizes sweep stops and still loads old box-only sessions", () => {
    const withSweep = normalizeHouseCleaning({
      areas: [{ id: "kitchen", name: "Kitchen" }],
      subareas: [{ id: "sa1", areaId: "kitchen", name: "Sink" }],
      subareaSession: {
        areaId: "kitchen",
        bank: 10,
        index: 1,
        phase: "task",
        items: [
          { kind: "perfect", subareaId: "sa1", title: "Perfect the Sink", checks: [], threshold: 60 },
          { kind: "sweep", title: "Sweep the Kitchen", checks: [{ id: "c1", title: "Corners", done: false }], threshold: 55 },
          { kind: "box", title: SUBAREA_BOX_TITLE, checks: [], threshold: 70 },
        ],
      },
    })
    expect(withSweep.subareaSession?.items.map((it) => it.kind)).toEqual(["perfect", "sweep", "box"])
    expect(withSweep.subareaSession?.items[1]).toEqual(
      expect.objectContaining({ kind: "sweep", title: "Sweep the Kitchen", threshold: 55 }),
    )
    expect(withSweep.subareaSession?.items[1].subareaId).toBeUndefined()
    expect(withSweep.subareaSession?.bank).toBe(10)

    const oldBox = normalizeHouseCleaning({
      areas: [{ id: "kitchen", name: "Kitchen" }],
      subareas: [{ id: "sa1", areaId: "kitchen", name: "Sink" }],
      subareaSession: {
        areaId: "kitchen",
        index: 0,
        phase: "task",
        items: [
          { kind: "perfect", subareaId: "sa1", title: "Perfect the Sink", checks: [], threshold: 50 },
          { kind: "box", title: SUBAREA_BOX_TITLE, checks: [] },
        ],
      },
    })
    expect(oldBox.subareaSession?.items.map((it) => it.kind)).toEqual(["perfect", "box"])
    expect(oldBox.subareaSession?.items[1].threshold).toBe(100)
    expect(oldBox.subareaSession?.bank).toBe(0)
  })
})

describe("seedHouseCleaning", () => {
  it("seeds default rooms, chores, and stuck tasks", () => {
    const s = seedHouseCleaning(1)
    expect(s.areas).toHaveLength(6)
    expect(s.tasks.length).toBeGreaterThanOrEqual(10)
    expect(s.stuckTasks.some((t) => t.kind === "timed")).toBe(true)
    expect(s.stuckTasks.some((t) => t.title.includes("{n}"))).toBe(true)
    expect(s.subareas).toEqual([])
    expect(s.subareaSession).toBeNull()
    expect(s.sidequests).toEqual([])
    expect(s.sidequestSession).toBeNull()
  })
})

describe("sidequests", () => {
  it("adds and deletes sidequests scoped to an area", () => {
    let s = blankHouseCleaning()
    s = addSidequest(s, "kitchen", "Paint that mug")
    s = addSidequest(s, "living", "Sort CDs alphabetically")
    expect(s.sidequests.map((q) => q.title)).toEqual(["Paint that mug", "Sort CDs alphabetically"])
    const kitchen = s.sidequests.find((q) => q.areaId === "kitchen")!
    s = deleteSidequest(s, kitchen.id)
    expect(s.sidequests.map((q) => q.areaId)).toEqual(["living"])
  })

  it("drops an area's sidequests and session when the area is deleted", () => {
    let s = blankHouseCleaning()
    s = addSidequest(s, "kitchen", "Paint that mug")
    s = addSidequest(s, "living", "Sort CDs")
    s = { ...s, sidequestEarn: { tasks: 3, sessions: 0, unlocked: true } }
    const picked = beginSidequestPick(s, () => 0)
    if ("error" in picked) throw new Error(picked.error)
    s = picked
    expect(s.sidequestSession?.areaId).toBe("kitchen")
    s = deleteArea(s, "kitchen")
    expect(s.sidequests.map((q) => q.areaId)).toEqual(["living"])
    expect(s.sidequestSession).toBeNull()
  })

  it("unlocks after 3 completeTask calls and does not stack while unlocked", () => {
    let s = blankHouseCleaning()
    s = addTask(s, { areaId: "kitchen", title: "A" }).state
    s = addTask(s, { areaId: "kitchen", title: "B" }).state
    s = addTask(s, { areaId: "kitchen", title: "C" }).state
    s = addTask(s, { areaId: "kitchen", title: "D" }).state
    s = completeTask(s, s.tasks[0].id)
    s = completeTask(s, s.tasks[1].id)
    expect(s.sidequestEarn.unlocked).toBe(false)
    expect(s.sidequestEarn.tasks).toBe(2)
    s = completeTask(s, s.tasks[2].id)
    expect(s.sidequestEarn).toEqual({ tasks: 3, sessions: 0, unlocked: true })
    s = completeTask(s, s.tasks[3].id)
    expect(s.sidequestEarn.tasks).toBe(3)
    s = toggleDone(s, s.tasks[3].id)
    expect(s.sidequestEarn.tasks).toBe(3)
  })

  it("unlocks after 2 full stuck sessions, not individual items or early ends", () => {
    let s = seedHouseCleaning()
    const started = startStuckMode(s, () => 0.05)
    if ("error" in started) throw new Error(started.error)
    expect(started.stuckSession?.items.length).toBe(1)
    const mid = stuckComplete(started)
    expect(mid.stuckSession?.phase).toBe("done")
    expect(mid.sidequestEarn.sessions).toBe(1)
    expect(mid.sidequestEarn.unlocked).toBe(false)
    s = endStuckMode(mid)
    const again = startStuckMode(s, () => 0.05)
    if ("error" in again) throw new Error(again.error)
    s = stuckComplete(again)
    expect(s.stuckSession?.phase).toBe("done")
    expect(s.sidequestEarn.sessions).toBe(2)
    expect(s.sidequestEarn.unlocked).toBe(true)
  })

  it("unlocks after 2 full perfect-subarea sessions", () => {
    let s = blankHouseCleaning()
    s = addSubarea(s, "kitchen", "Sink")
    const first = startSubareaSession(s, "kitchen", () => 0)
    if ("error" in first) throw new Error(first.error)
    let cur = first
    for (const _ of first.subareaSession!.items) {
      cur = subareaComplete(cur)
    }
    expect(cur.subareaSession?.phase).toBe("done")
    expect(cur.sidequestEarn.sessions).toBe(1)
    s = { ...cur, subareaSession: null }
    const second = startSubareaSession(s, "kitchen", () => 0)
    if ("error" in second) throw new Error(second.error)
    cur = second
    for (const _ of second.subareaSession!.items) {
      cur = subareaComplete(cur)
    }
    expect(cur.subareaSession?.phase).toBe("done")
    expect(cur.sidequestEarn.unlocked).toBe(true)
  })

  it("opening the picker does not spend unlock; Start does and duration is 20–50 min", () => {
    let s = blankHouseCleaning()
    s = addSidequest(s, "kitchen", "Paint that mug")
    s = { ...s, sidequestEarn: { tasks: 3, sessions: 0, unlocked: true } }
    const picked = beginSidequestPick(s, () => 0)
    if ("error" in picked) throw new Error(picked.error)
    expect(picked.sidequestSession?.phase).toBe("pick")
    expect(picked.sidequestEarn.unlocked).toBe(true)
    const started = startSidequest(picked, 1, () => 0.5)
    if ("error" in started) throw new Error(started.error)
    expect(started.sidequestEarn).toEqual(blankSidequestEarn())
    expect(started.sidequestSession?.phase).toBe("run")
    const mins = (started.sidequestSession?.durationSec ?? 0) / 60
    expect(mins).toBeGreaterThanOrEqual(20)
    expect(mins).toBeLessThanOrEqual(50)
    expect(pickSidequestMinutes(() => 0)).toBe(20)
    expect(pickSidequestMinutes(() => 1)).toBe(50)
  })

  it("blocks stuck and perfect while a sidequest is running", () => {
    let s = seedHouseCleaning()
    s = addSidequest(s, "kitchen", "Paint that mug")
    s = {
      ...s,
      sidequestEarn: { tasks: 3, sessions: 0, unlocked: true },
      sidequestSession: {
        sidequestId: s.sidequests[0].id,
        title: "Paint that mug",
        areaId: "kitchen",
        durationSec: 1200,
        phase: "run",
        clock: { running: true, startedAt: 1, baseSec: 1200 },
        timedOut: false,
      },
    }
    expect(startStuckMode(s)).toEqual({ error: "Finish the sidequest first." })
    expect(startSubareaSession(s, "kitchen")).toEqual({ error: "Finish the sidequest first." })
    s = completeTask(s, s.tasks[0].id)
    expect(s.sidequestEarn.tasks).toBe(3)
  })
})
