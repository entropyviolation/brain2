import { describe, it, expect } from "vitest"
import {
  OP_REL,
  isOperation,
  loggedMinutes,
  rollupMinutes,
  rollupHours,
  minutesToHours,
  getRelatedChildren,
  getPhases,
  getParts,
  getResources,
  getOperationTaskTree,
  evaluatePhase,
  operationProgress,
  heatLevel,
  buildHeatmap,
  neglectedDays,
  selectToDoNext,
} from "@/lib/operations"
import { OPERATION_TYPE_ID } from "@/lib/operation-types"
import type { Task, TimeLogEntry } from "@/lib/types"

const NOW = new Date("2026-06-23T12:00:00.000Z")

function makeTask(overrides: Partial<Task> = {}): Task {
  return {
    id: overrides.id ?? "t1",
    description: overrides.description ?? "Task",
    stage: "clarified",
    createdAt: overrides.createdAt ?? NOW,
    completed: overrides.completed ?? false,
    lists: [],
    ...overrides,
  }
}

function log(date: string, durationMinutes: number): TimeLogEntry {
  return { id: `log_${date}_${durationMinutes}`, date, durationMinutes }
}

function daysAgo(days: number): Date {
  return new Date(NOW.getTime() - days * 24 * 60 * 60 * 1000)
}

describe("isOperation", () => {
  it("is true only for tasks typed as operation", () => {
    expect(isOperation(makeTask({ type: OPERATION_TYPE_ID }))).toBe(true)
    expect(isOperation(makeTask({ type: "task" }))).toBe(false)
    expect(isOperation(makeTask())).toBe(false)
    expect(isOperation(null)).toBe(false)
    expect(isOperation(undefined)).toBe(false)
  })
})

describe("hours rollup over timeLogs", () => {
  it("sums durationMinutes for one task, ignoring invalid/negative", () => {
    const task = makeTask({
      timeLogs: [
        log("2026-06-20", 30),
        log("2026-06-21", 45),
        { id: "bad", date: "2026-06-22", durationMinutes: -10 },
        { id: "nan", date: "2026-06-22", durationMinutes: Number.NaN },
      ],
    })
    expect(loggedMinutes(task)).toBe(75)
  })

  it("returns 0 for missing/empty logs", () => {
    expect(loggedMinutes(undefined)).toBe(0)
    expect(loggedMinutes(makeTask())).toBe(0)
    expect(loggedMinutes(makeTask({ timeLogs: [] }))).toBe(0)
  })

  it("rolls up minutes and hours across many tasks", () => {
    const a = makeTask({ id: "a", timeLogs: [log("2026-06-20", 60)] })
    const b = makeTask({ id: "b", timeLogs: [log("2026-06-20", 90)] })
    expect(rollupMinutes([a, b])).toBe(150)
    expect(rollupHours([a, b])).toBe(2.5)
  })

  it("rounds hours to one decimal", () => {
    expect(minutesToHours(75)).toBe(1.3)
    expect(minutesToHours(0)).toBe(0)
  })
})

describe("relation resolution (both directions)", () => {
  // op --has-phase--> p1 ; p2 --phase-of--> op (inverse direction)
  const op = makeTask({
    id: "op",
    type: OPERATION_TYPE_ID,
    links: [{ id: "l1", relation: OP_REL.hasPhase, targetId: "p1" }],
  })
  const p1 = makeTask({ id: "p1" })
  const p2 = makeTask({
    id: "p2",
    links: [{ id: "l2", relation: OP_REL.phaseOf, targetId: "op" }],
  })
  const all = [op, p1, p2]

  it("resolves children via forward links and inverse backlinks", () => {
    const phases = getPhases("op", all)
    expect(phases.map((t) => t.id).sort()).toEqual(["p1", "p2"])
  })

  it("excludes self-references and de-duplicates", () => {
    const selfOp = makeTask({
      id: "op",
      links: [
        { id: "a", relation: OP_REL.hasPhase, targetId: "op" },
        { id: "b", relation: OP_REL.hasPhase, targetId: "p1" },
        { id: "c", relation: OP_REL.hasPhase, targetId: "p1" },
      ],
    })
    const got = getRelatedChildren("op", [selfOp, p1], OP_REL.hasPhase, OP_REL.phaseOf)
    expect(got.map((t) => t.id)).toEqual(["p1"])
  })

  it("resolves parts and resources by their relation pairs", () => {
    const opb = makeTask({
      id: "opb",
      links: [
        { id: "r1", relation: OP_REL.hasPart, targetId: "part1" },
        { id: "r2", relation: OP_REL.hasResource, targetId: "res1" },
      ],
    })
    const part1 = makeTask({ id: "part1" })
    const res1 = makeTask({ id: "res1" })
    const tasks = [opb, part1, res1]
    expect(getParts("opb", tasks).map((t) => t.id)).toEqual(["part1"])
    expect(getResources("opb", tasks).map((t) => t.id)).toEqual(["res1"])
  })

  it("builds the operation task tree (phases + their parts + direct parts)", () => {
    const opc = makeTask({
      id: "opc",
      links: [
        { id: "a", relation: OP_REL.hasPhase, targetId: "ph" },
        { id: "b", relation: OP_REL.hasPart, targetId: "direct" },
      ],
    })
    const ph = makeTask({
      id: "ph",
      links: [{ id: "c", relation: OP_REL.hasPart, targetId: "sub" }],
    })
    const sub = makeTask({ id: "sub" })
    const direct = makeTask({ id: "direct" })
    const tree = getOperationTaskTree("opc", [opc, ph, sub, direct])
    expect(tree.map((t) => t.id).sort()).toEqual(["direct", "ph", "sub"])
  })
})

describe("phase completion", () => {
  it("uses the phase's own completed flag when it has no parts", () => {
    expect(evaluatePhase({ completed: true }, [])).toEqual({
      total: 0,
      done: 0,
      fraction: 1,
      complete: true,
    })
    expect(evaluatePhase({ completed: false }, [])).toMatchObject({ fraction: 0, complete: false })
  })

  it("computes fraction of completed parts", () => {
    const parts = [{ completed: true }, { completed: false }, { completed: true }, { completed: false }]
    expect(evaluatePhase({ completed: false }, parts)).toEqual({
      total: 4,
      done: 2,
      fraction: 0.5,
      complete: false,
    })
  })

  it("is complete when every part is done", () => {
    const parts = [{ completed: true }, { completed: true }]
    expect(evaluatePhase({ completed: false }, parts)).toMatchObject({ fraction: 1, complete: true })
  })

  it("operationProgress rolls up phase completion", () => {
    const op = makeTask({
      id: "op",
      links: [
        { id: "a", relation: OP_REL.hasPhase, targetId: "ph1" },
        { id: "b", relation: OP_REL.hasPhase, targetId: "ph2" },
      ],
    })
    // ph1 complete (its single part is done); ph2 incomplete.
    const ph1 = makeTask({
      id: "ph1",
      links: [{ id: "c", relation: OP_REL.hasPart, targetId: "s1" }],
    })
    const s1 = makeTask({ id: "s1", completed: true })
    const ph2 = makeTask({
      id: "ph2",
      links: [{ id: "d", relation: OP_REL.hasPart, targetId: "s2" }],
    })
    const s2 = makeTask({ id: "s2", completed: false })
    const progress = operationProgress("op", [op, ph1, ph2, s1, s2])
    expect(progress).toEqual({ total: 2, done: 1, fraction: 0.5, complete: false })
  })

  it("operationProgress falls back to direct parts when no phases", () => {
    const op = makeTask({
      id: "op",
      links: [
        { id: "a", relation: OP_REL.hasPart, targetId: "p1" },
        { id: "b", relation: OP_REL.hasPart, targetId: "p2" },
      ],
    })
    const p1 = makeTask({ id: "p1", completed: true })
    const p2 = makeTask({ id: "p2", completed: false })
    expect(operationProgress("op", [op, p1, p2])).toMatchObject({ total: 2, done: 1, fraction: 0.5 })
  })
})

describe("work / neglect heatmap", () => {
  it("buckets minutes into levels 0-4", () => {
    expect(heatLevel(0)).toBe(0)
    expect(heatLevel(15)).toBe(1)
    expect(heatLevel(30)).toBe(1)
    expect(heatLevel(45)).toBe(2)
    expect(heatLevel(60)).toBe(2)
    expect(heatLevel(90)).toBe(3)
    expect(heatLevel(120)).toBe(3)
    expect(heatLevel(200)).toBe(4)
  })

  it("emits one cell per day in range, marking neglected days", () => {
    const task = makeTask({
      timeLogs: [log("2026-06-21", 60), log("2026-06-23", 30)],
    })
    const cells = buildHeatmap([task], { start: new Date(2026, 5, 21), end: new Date(2026, 5, 23) })
    expect(cells.map((c) => c.date)).toEqual(["2026-06-21", "2026-06-22", "2026-06-23"])
    expect(cells.map((c) => c.minutes)).toEqual([60, 0, 30])
    expect(cells.map((c) => c.worked)).toEqual([true, false, true])
    expect(neglectedDays(cells)).toBe(1)
  })

  it("aggregates minutes across tasks on the same day", () => {
    const a = makeTask({ id: "a", timeLogs: [log("2026-06-22", 30)] })
    const b = makeTask({ id: "b", timeLogs: [log("2026-06-22", 45)] })
    const cells = buildHeatmap([a, b], { start: new Date(2026, 5, 22), end: new Date(2026, 5, 22) })
    expect(cells).toHaveLength(1)
    expect(cells[0]).toMatchObject({ date: "2026-06-22", minutes: 75, level: 3 })
  })

  it("defaults to a trailing window ending at now", () => {
    const cells = buildHeatmap([], { now: NOW, days: 7 })
    expect(cells).toHaveLength(7)
    expect(cells[cells.length - 1].date).toBe("2026-06-23")
  })
})

describe("to do next selector", () => {
  it("excludes completed and hidden tasks", () => {
    const tasks = [
      makeTask({ id: "done", completed: true }),
      makeTask({ id: "hidden", hiddenFromTodo: true }),
      makeTask({ id: "open" }),
    ]
    const next = selectToDoNext(tasks, { now: NOW })
    expect(next.map((t) => t.id)).toEqual(["open"])
  })

  it("gates tasks on incomplete in-tree dependencies", () => {
    const tasks = [
      makeTask({ id: "dep", completed: false }),
      makeTask({ id: "blocked", dependencies: ["dep"] }),
    ]
    expect(selectToDoNext(tasks, { now: NOW }).map((t) => t.id)).toEqual(["dep"])

    const tasks2 = [
      makeTask({ id: "dep", completed: true }),
      makeTask({ id: "unblocked", dependencies: ["dep"] }),
    ]
    expect(selectToDoNext(tasks2, { now: NOW }).map((t) => t.id)).toContain("unblocked")
  })

  it("ignores unknown dependency ids (out of tree)", () => {
    const tasks = [makeTask({ id: "x", dependencies: ["ghost"] })]
    expect(selectToDoNext(tasks, { now: NOW }).map((t) => t.id)).toEqual(["x"])
  })

  it("ranks overdue / higher-importance tasks first and respects the limit", () => {
    const tasks = [
      makeTask({ id: "low", importance: 1, urgency: 1 }),
      makeTask({ id: "overdue", deadline: daysAgo(2), importance: 3 }),
      makeTask({ id: "important", importance: 5, urgency: 5 }),
    ]
    const next = selectToDoNext(tasks, { now: NOW, limit: 2 })
    expect(next).toHaveLength(2)
    expect(next[0].id).toBe("overdue")
    expect(next.map((t) => t.id)).not.toContain("low")
  })

  it("can ignore dependencies when respectDependencies is false", () => {
    const tasks = [
      makeTask({ id: "dep", completed: false }),
      makeTask({ id: "blocked", dependencies: ["dep"], importance: 5 }),
    ]
    const next = selectToDoNext(tasks, { now: NOW, respectDependencies: false })
    expect(next.map((t) => t.id)).toContain("blocked")
  })
})
