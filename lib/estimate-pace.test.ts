import { describe, expect, it } from "vitest"
import { paddedLabel, paceFor, paceForTask, paceGhostLabel, paceKey, paceSamples, sessionPaceFactor } from "./estimate-pace"
import { emptySession, type SessionPlan } from "./session-plan"
import type { Subtask, Task } from "./types"

const done = (id: string, est: number, actual: number): Subtask => ({
  id,
  description: id,
  completed: true,
  estimatedDuration: est,
  actualDuration: actual,
})

describe("estimate-pace", () => {
  const tasks = [
    { id: "t1", penLinks: [{ penId: "cd" }], subtasks: [done("a", 10, 20), done("b", 10, 30), { ...done("c", 10, 25), subtasks: [done("c1", 10, 10)] }] },
    { id: "t2", subtasks: [done("d", 10, 10), { id: "e", description: "e", completed: false, estimatedDuration: 10, actualDuration: 90 }] },
  ]

  it("median of finished steps, nested ones too, skipping open steps", () => {
    const samples = paceSamples(tasks)
    expect(samples).toHaveLength(5)
    expect(paceFor(samples)).toBe(2)
    expect(paceFor(samples, { kind: "pen", penId: "cd" })).toBe(2.25)
  })

  it("fewer than three samples reads 1; an override wins; clamped 0.5–4", () => {
    const samples = paceSamples([tasks[1]])
    expect(paceFor(samples)).toBe(1)
    expect(paceFor(samples, { kind: "overall" }, { overall: 1.7 })).toBe(1.7)
    const slow = paceSamples([{ id: "s", subtasks: [done("x", 1, 10), done("y", 1, 10), done("z", 1, 10)] }])
    expect(paceFor(slow)).toBe(4)
  })

  it("reads closed session lines", () => {
    const line = (id: string, estMin: number, actualSec: number) => ({ id, taskId: "t2", estMin, actualSec, doneAt: "2026-10-01T10:00:00Z" })
    const plan = { tiers: { min: [line("1", 10, 1800), line("2", 10, 1800)], goal: [line("3", 10, 1800)], exceptional: [] } } as unknown as SessionPlan
    expect(paceFor(paceSamples([], [plan]))).toBe(3)
  })

  it("a task reads its pen when the pen has enough samples, else overall", () => {
    const samples = paceSamples(tasks)
    expect(paceForTask(tasks[0], samples)).toBe(2.25)
    expect(paceForTask({ penLinks: [{ penId: "none" }] }, samples)).toBe(2)
    expect(paceForTask({ penLinks: [{ penId: "none" }] }, samples, { [paceKey({ kind: "pen", penId: "none" })]: 1.5 })).toBe(1.5)
  })

  it("ghost words show from 1.2", () => {
    expect(paceGhostLabel(1.19)).toBeNull()
    expect(paceGhostLabel(2.4)).toBe("usually ×2.4 for you")
  })

  it("Padded for you weights each line by its minutes at its own task's pace", () => {
    const samples = paceSamples(tasks)
    const plan = emptySession(new Date("2026-10-16T09:00:00Z"), 120)
    const work = [
      { id: "p", title: "pen task", penLinks: [{ penId: "cd" }], estimatedDuration: 30 },
      { id: "q", title: "plain", estimatedDuration: 10 },
    ] as unknown as Task[]
    plan.tiers.min = [{ id: "l1", taskId: "p" }]
    plan.tiers.goal = [{ id: "l2", taskId: "q" }]
    // (30 × 2.25 + 10 × 2) / 40
    expect(sessionPaceFactor(plan, work, samples)).toBeCloseTo(2.1875)
    expect(sessionPaceFactor(plan, work, [])).toBe(1)
    expect(sessionPaceFactor(emptySession(), work, samples)).toBe(1)
    expect(paddedLabel(1.6)).toBe("padded for you ×1.6")
    expect(paddedLabel(1)).toBeNull()
  })
})
