import { describe, expect, it } from "vitest"
import { serializeSnapshot, snapshotsEqual } from "./unsaved-changes"

describe("unsaved-changes snapshots", () => {
  it("treats identical plain objects as clean", () => {
    expect(snapshotsEqual({ title: "SHOW" }, { title: "SHOW" })).toBe(true)
  })

  it("detects a field edit as dirty", () => {
    expect(snapshotsEqual({ title: "SHOW" }, { title: "SHOW — Wilmington" })).toBe(false)
  })

  it("compares Date values by ISO instant", () => {
    const a = { date: new Date("2026-09-01T00:00:00") }
    const b = { date: new Date("2026-09-01T00:00:00") }
    const c = { date: new Date("2026-09-02T00:00:00") }
    expect(snapshotsEqual(a, b)).toBe(true)
    expect(snapshotsEqual(a, c)).toBe(false)
  })

  it("serializeSnapshot is stable for nested drafts", () => {
    const snap = serializeSnapshot({ location: "Reggie's", nested: { n: 1 } })
    expect(snap).toContain("Reggie")
    expect(serializeSnapshot({ location: "Reggie's", nested: { n: 1 } })).toBe(snap)
  })
})
