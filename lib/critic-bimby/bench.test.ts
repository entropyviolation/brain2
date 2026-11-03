import { describe, expect, it } from "vitest"
import { formatBench, GOLD, runBench } from "./bench"

describe("critic bench, code layer", () => {
  const report = runBench()
  console.log(`\ncritic bench (code layer)\n${formatBench(report)}`)

  it("raises nothing on the gold plans", () => {
    expect(report.falseAlarms.names).toEqual([])
    expect(report.falseFails).toBe(0)
  })
  it("fails every fault it can be certain about", () => {
    for (const k of ["change-minutes", "change-due", "bad-intake-link"]) {
      const row = report.byFault[k]
      if (row) expect(row.caught, k).toBe(row.of)
    }
  })
  it("catches an invented row and a dropped row most of the time", () => {
    expect(report.byFault["invent-row"]!.caught / report.byFault["invent-row"]!.of).toBeGreaterThanOrEqual(0.6)
    expect(report.byFault["drop-row"]!.caught / report.byFault["drop-row"]!.of).toBeGreaterThanOrEqual(0.6)
  })
  it("has gold plans and faults to test", () => {
    expect(GOLD.length).toBeGreaterThanOrEqual(5)
    expect(report.of).toBeGreaterThan(15)
  })
})
