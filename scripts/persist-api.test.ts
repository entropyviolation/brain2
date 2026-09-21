import { describe, expect, it } from "vitest"
import { shouldRejectVaultShrink, vaultRecordCount } from "@/scripts/persist-api.mjs"

function timegrid(n: number) {
  return JSON.stringify({
    state: { entries: Array.from({ length: n }, (_, i) => ({ id: `e${i}` })) },
    version: 7,
  })
}

function sleep(n: number) {
  const nights: Record<string, { date: string }> = {}
  for (let i = 0; i < n; i++) nights[`2026-09-${String(i + 1).padStart(2, "0")}`] = { date: `d${i}` }
  return JSON.stringify({ state: { nights }, version: 1 })
}

function habits(tasks: number, days: number) {
  const weeklyData: Record<string, object> = {}
  for (let i = 0; i < days; i++) weeklyData[`2026-09-${String(i + 1).padStart(2, "0")}`] = {}
  return JSON.stringify({
    state: { tasks: Array.from({ length: tasks }, (_, i) => ({ id: `h${i}` })), weeklyData },
    version: 14,
  })
}

function lists(n: number) {
  return JSON.stringify({
    state: { tasks: Array.from({ length: n }, (_, i) => ({ id: `t${i}` })) },
    version: 12,
  })
}

describe("persist hub vault shrink guard", () => {
  it("counts entries and nights", () => {
    expect(vaultRecordCount("cogs-timegrid-store", timegrid(12))).toBe(12)
    expect(vaultRecordCount("cogs-sleep-store", sleep(3))).toBe(3)
    expect(vaultRecordCount("cogs-task-storage", lists(12))).toBe(12)
    expect(vaultRecordCount("cogs-habits-store", habits(30, 47))).toBe(77)
  })

  it("lets ordinary edits through and rejects a much thinner vault", () => {
    expect(shouldRejectVaultShrink("cogs-timegrid-store", timegrid(168), timegrid(169))).toBe(false)
    expect(shouldRejectVaultShrink("cogs-timegrid-store", timegrid(63), timegrid(169))).toBe(true)
    expect(shouldRejectVaultShrink("cogs-sleep-store", sleep(1), sleep(5))).toBe(true)
    expect(shouldRejectVaultShrink("cogs-timegrid-store", timegrid(10), undefined)).toBe(false)
    expect(shouldRejectVaultShrink("cogs-ingest-store", timegrid(1), timegrid(100))).toBe(false)
    expect(shouldRejectVaultShrink("cogs-task-storage", lists(15), lists(2455))).toBe(true)
    expect(shouldRejectVaultShrink("cogs-habits-store", habits(15, 6), habits(30, 47))).toBe(true)
    expect(shouldRejectVaultShrink("cogs-habits-store", habits(29, 47), habits(30, 47))).toBe(false)
  })
})
