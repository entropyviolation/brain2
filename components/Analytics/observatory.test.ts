/**
 * Observatory findings withhold a thin overlap.
 */
import { describe, expect, it } from "vitest"
import { findingFor, observatoryFindings, OBSERVATORY_FLOOR } from "./observatory-findings"

describe("observatory findings", () => {
  it("returns null when there is no overlap", () => {
    expect(
      findingFor({
        id: "empty",
        aLabel: "A",
        bLabel: "B",
        a: [],
        b: [],
      }),
    ).toBeNull()
  })

  it("watermarks thin overlap instead of treating it as a finding", () => {
    const a = Array.from({ length: 4 }, (_, i) => ({ date: `2026-09-0${i + 1}`, value: i }))
    const b = a.map((p) => ({ date: p.date, value: p.value * 2 }))
    const finding = findingFor({
      id: "thin",
      aLabel: "Habit %",
      bLabel: "tracked minutes",
      a,
      b,
    })
    expect(finding?.thin).toBe(true)
    expect(finding?.n).toBe(4)
    expect(finding?.sentence).toMatch(/too thin to treat as a finding/)
    expect(finding?.sentence).toContain(String(OBSERVATORY_FLOOR))
  })

  it("speaks r and n once overlap clears the floor", () => {
    const a = Array.from({ length: OBSERVATORY_FLOOR }, (_, i) => ({
      date: `2026-09-${String(i + 1).padStart(2, "0")}`,
      value: i,
    }))
    const b = a.map((p, i) => ({ date: p.date, value: i * 2 }))
    const findings = observatoryFindings([
      { id: "ok", aLabel: "Joy", bLabel: "sleep minutes", a, b },
    ])
    expect(findings[0]?.thin).toBe(false)
    expect(findings[0]?.sentence).toMatch(/r = /)
    expect(findings[0]?.sentence).not.toMatch(/too thin/)
  })
})
