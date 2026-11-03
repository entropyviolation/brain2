import { beforeEach, describe, expect, it } from "vitest"
import { getPlanEntries } from "@/lib/plan-text"
import { childPlanTargets, logStartPlans, ownPlanTarget, startPlanLabel } from "@/lib/start-plans"

describe("start plans", () => {
  beforeEach(() => localStorage.clear())

  it("labels each start ritual", () => {
    expect(startPlanLabel("week")).toBe("WEEK START PLAN")
    expect(startPlanLabel("quarter")).toBe("SEASON START PLAN")
    expect(ownPlanTarget("year", "2026")).toBeNull()
  })

  it("lists the smaller periods inside", () => {
    expect(childPlanTargets("week", "2026-11-02_2026-11-08")).toHaveLength(7)
    expect(childPlanTargets("quarter", "2026-Q4").map((t) => t.key)).toEqual(["2026-10", "2026-11", "2026-12"])
    expect(childPlanTargets("year", "2026").map((t) => t.key)).toEqual(["2026-Q1", "2026-Q2", "2026-Q3", "2026-Q4"])
  })

  it("appends own and inner plans once, labelled by the ritual", () => {
    const week = "2026-11-02_2026-11-08"
    const day = childPlanTargets("week", week)[0]
    const children = { [day.id]: "Run at six" }
    const logged = logStartPlans({ period: "week", periodKey: week, own: "Ship it", children, logged: undefined })
    const own = getPlanEntries("week", week)
    expect(own).toHaveLength(1)
    expect(own[0]).toMatchObject({ text: "Ship it", stampSuffix: "WEEK START PLAN" })
    expect(getPlanEntries("day", day.key)[0]).toMatchObject({ text: "Run at six", stampSuffix: "WEEK START PLAN" })
    logStartPlans({ period: "week", periodKey: week, own: "Ship it", children, logged })
    expect(getPlanEntries("week", week)).toHaveLength(1)
  })

  it("a month start lands in the week's own log", () => {
    const week = childPlanTargets("month", "2026-11")[0]
    logStartPlans({ period: "month", periodKey: "2026-11", own: "", children: { [week.id]: "Slow start" }, logged: undefined })
    expect(getPlanEntries("week", week.key)[0]).toMatchObject({ stampSuffix: "MONTH START PLAN" })
  })
})
