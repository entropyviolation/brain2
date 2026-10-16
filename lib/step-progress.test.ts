import { describe, expect, it } from "vitest"
import type { Subtask } from "@/lib/types"
import {
  formatPercent,
  levelProgress,
  levelReached,
  nextLevel,
  taskPercent,
  tierMinutes,
  weightedPercent,
} from "./step-progress"
import {
  cycleStepTier,
  effectiveTier,
  hasStepTiers,
  nextTierInCycle,
  stepsForTier,
  tierBand,
  toggleStepSpark,
} from "./step-tiers"
import { pickStartStep, rankStartSteps } from "./next-step"

function s(id: string, extra: Partial<Subtask> = {}): Subtask {
  return { id, description: id, completed: false, ...extra }
}

const kids = (prefix: string, n: number, done = 0, extra: Partial<Subtask> = {}) =>
  Array.from({ length: n }, (_, i) => s(`${prefix}${i}`, { completed: i < done, ...extra }))

// Finish CDs: Bare minimum = Back (3, 2 done) and Inside holder (2, 0 done); Goal adds insert (4, 1 done).
function finishCds(): Subtask[] {
  return [
    s("back", { tier: "min", subtasks: kids("b", 3, 2) }),
    s("holder", { tier: "min", subtasks: kids("h", 2, 0) }),
    s("insert", { subtasks: kids("i", 4, 1) }),
  ]
}

describe("weighted percent (R16)", () => {
  it("BigTask: a step of the small branch weighs more than one of the big branch", () => {
    const one = (done1: number, done2: number) => [
      s("m1", { subtasks: kids("a", 4, done1) }),
      s("m2", { subtasks: kids("b", 2, done2) }),
    ]
    expect(weightedPercent(one(0, 1))).toBeCloseTo(0.25)
    expect(weightedPercent(one(1, 0))).toBeCloseTo(0.125)
  })

  it("a ticked parent counts done; no steps reads null; a done task is 100%", () => {
    expect(weightedPercent([s("p", { completed: true, subtasks: kids("k", 3) })])).toBe(1)
    expect(weightedPercent([])).toBeNull()
    expect(taskPercent({ subtasks: [s("a")] }, true)).toBe(1)
    expect(taskPercent({ subtasks: [] })).toBeNull()
  })
})

describe("step tiers", () => {
  it("inherits the nearest ancestor's tier; a top-level step with none is Goal", () => {
    const steps = [s("top", { subtasks: [s("x", { tier: "min", subtasks: [s("y")] })] })]
    expect(effectiveTier(steps, "top")).toBe("goal")
    expect(effectiveTier(steps, "y")).toBe("min")
    expect(hasStepTiers(steps)).toBe(true)
    expect(hasStepTiers([s("a")])).toBe(false)
  })

  it("pulls a lower tier's path in as a greyed container that does not count", () => {
    const steps = [s("goal", { subtasks: [s("bare", { tier: "min" }), s("other")] })]
    const view = stepsForTier(steps, "min")
    expect([...view.ids]).toEqual(["bare"])
    expect([...view.containers]).toEqual(["goal"])
    expect([...tierBand(steps, "goal")].sort()).toEqual(["goal", "other"])
  })

  it("cycles B → G → E → inherit and sets sparks without touching anything else", () => {
    expect([undefined, "min", "goal", "exceptional"].map((t) => nextTierInCycle(t as never))).toEqual([
      "min",
      "goal",
      "exceptional",
      undefined,
    ])
    const once = cycleStepTier([s("a")], "a", undefined)
    expect(once[0].tier).toBe("min")
    const sparked = toggleStepSpark(once, "a", new Date("2026-10-16T10:00:00Z"))
    expect(sparked[0].sparkedAt).toBe("2026-10-16T10:00:00.000Z")
    expect(weightedPercent(sparked)).toBe(weightedPercent(once))
    expect(toggleStepSpark(sparked, "a")[0].sparkedAt).toBeUndefined()
  })
})

describe("levels (R14, R15)", () => {
  it("Finish CDs: B 33%, G 31%, E —", () => {
    const p = levelProgress({ subtasks: finishCds() })
    expect(formatPercent(p.min)).toBe("33%")
    expect(formatPercent(p.goal)).toBe("31%")
    expect(p.exceptional).toBeNull()
    expect(formatPercent(p.exceptional)).toBe("—")
  })

  it("an empty level is never reached: finishing Goal is not Exceptional", () => {
    const steps = [s("a", { completed: true }), s("b", { completed: true })]
    expect(levelReached({ subtasks: steps })).toBe("goal")
    expect(levelProgress({ subtasks: steps }).exceptional).toBeNull()
    expect(levelProgress({ subtasks: steps }).min).toBeNull()
    expect(levelReached({ subtasks: [s("a")] })).toBe("none")
  })

  it("levels climb in order", () => {
    const steps = [s("bare", { tier: "min" }), s("goal", { completed: true }), s("extra", { tier: "exceptional", completed: true })]
    expect(levelReached({ subtasks: steps })).toBe("none")
    expect(nextLevel({ subtasks: steps })).toBe("min")
    steps[0] = { ...steps[0], completed: true }
    expect(levelReached({ subtasks: steps })).toBe("exceptional")
    expect(nextLevel({ subtasks: steps })).toBeNull()
  })

  it("a step's own levels read over its subtree", () => {
    const p = levelProgress({ subtasks: finishCds() }, "back")
    expect(formatPercent(p.min)).toBe("67%")
    expect(formatPercent(p.goal)).toBe("67%")
    expect(levelProgress({ subtasks: finishCds() }, "insert").min).toBeNull()
  })

  it("counts minutes for one level", () => {
    const steps = [
      s("goal", { estimatedDuration: 10, subtasks: [s("bare", { tier: "min", estimatedDuration: 15 }), s("rest", { estimatedDuration: 30 })] }),
    ]
    expect(tierMinutes(steps, "min")).toBe(15)
    expect(tierMinutes(steps, "goal")).toBe(45)
  })
})

describe("pick order with levels", () => {
  it("prefers the lowest level not yet reached, and rank agrees", () => {
    const steps = [s("goal", { estimatedDuration: 5 }), s("bare", { tier: "min", estimatedDuration: 30 })]
    const pick = pickStartStep({ subtasks: steps })
    expect(pick.kind === "step" && pick.step.id).toBe("bare")
    expect(rankStartSteps({ subtasks: steps }).map((r) => r.step.id)).toEqual(["bare", "goal"])
  })

  it("a task without tiers or sparks picks exactly as before", () => {
    const plain = [s("a", { estimatedDuration: 20 }), s("b", { estimatedDuration: 5 }), s("c", { estimatedDuration: 5, isMolecular: true })]
    expect(rankStartSteps({ subtasks: plain }).map((r) => r.step.id)).toEqual(["c", "b", "a"])
    const sparked = plain.map((st) => ({ ...st, sparkedAt: "2026-10-16T10:00:00.000Z" }))
    expect(rankStartSteps({ subtasks: sparked }).map((r) => r.step.id)).toEqual(["c", "b", "a"])
  })
})
