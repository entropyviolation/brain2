import { describe, expect, it } from "vitest"
import { compareHigherThanPrevious } from "./habit-period-compare"
import { betterThanLastWeekStats } from "./habit-stat-points"

const labels = {
  avg: "Daily completion average",
  week: "Week grade",
  output: "Perfect output",
}

function points(current: [number, number, number], previous: [number, number, number]) {
  return (["avg", "week", "output"] as const).map((id, index) => ({
    id,
    label: labels[id],
    current: current[index],
    previous: previous[index],
  }))
}

describe("compareHigherThanPrevious", () => {
  it("completes when 2 of 3 are higher", () => {
    const result = compareHigherThanPrevious(points([40, 55, 60], [30, 50, 70]), 2)
    expect(result.higher).toBe(2)
    expect(result.complete).toBe(true)
    expect(result.pairs.map((pair) => pair.winner)).toEqual(["this", "this", "previous"])
  })

  it("does not complete when only 1 of 3 is higher", () => {
    const result = compareHigherThanPrevious(points([40, 40, 60], [30, 50, 70]), 2)
    expect(result.higher).toBe(1)
    expect(result.complete).toBe(false)
  })

  it("does not count a tie as higher", () => {
    const result = compareHigherThanPrevious(points([40, 50, 60], [30, 50, 70]), 2)
    const week = result.pairs.find((pair) => pair.id === "week")
    expect(week?.winner).toBe("tie")
    expect(week?.higher).toBe(false)
    expect(result.higher).toBe(1)
    expect(result.complete).toBe(false)
  })
})

describe("better than last week preset", () => {
  it("stores the three week points and 2 of 3", () => {
    expect(betterThanLastWeekStats()).toEqual({
      set: "daily",
      points: [{ kind: "dailyCompletionAverage" }, { kind: "weekGrade" }, { kind: "perfectOutput" }],
      comparePrevious: true,
      mustBeHigher: 2,
    })
  })
})
