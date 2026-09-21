import { describe, expect, it } from "vitest"
import { pickPersistItem, shouldRejectVaultShrink, vaultRecordCount } from "./vault-guard.js"

function tasks(n: number) {
  return JSON.stringify({
    state: { tasks: Array.from({ length: n }, (_, i) => ({ id: `t${i}` })) },
    version: 12,
  })
}

function habits(taskCount: number, days: number) {
  const weeklyData: Record<string, object> = {}
  for (let i = 0; i < days; i++) weeklyData[`2026-09-${String(i + 1).padStart(2, "0")}`] = {}
  return JSON.stringify({
    state: { tasks: Array.from({ length: taskCount }, (_, i) => ({ id: `h${i}` })), weeklyData },
    version: 14,
  })
}

describe("vault-guard", () => {
  it("counts lists items and habit rows", () => {
    expect(vaultRecordCount("cogs-task-storage", tasks(2455))).toBe(2455)
    expect(vaultRecordCount("cogs-habits-store", habits(30, 47))).toBe(77)
  })

  it("lets a one-item edit through and rejects a seed wipe", () => {
    expect(shouldRejectVaultShrink("cogs-task-storage", tasks(2454), tasks(2455))).toBe(false)
    expect(shouldRejectVaultShrink("cogs-task-storage", tasks(15), tasks(2455))).toBe(true)
    expect(shouldRejectVaultShrink("cogs-habits-store", habits(15, 6), habits(30, 47))).toBe(true)
    expect(shouldRejectVaultShrink("cogs-habits-store", habits(29, 47), habits(30, 47))).toBe(false)
    expect(shouldRejectVaultShrink("cogs-ingest-store", tasks(1), tasks(100))).toBe(false)
  })

  it("keeps this profile's vault when the hub is thinner", () => {
    expect(pickPersistItem(tasks(2455), tasks(15), "cogs-task-storage")).toBe(tasks(2455))
  })

  it("heals a seed profile from a richer hub", () => {
    expect(pickPersistItem(tasks(15), tasks(2455), "cogs-task-storage")).toBe(tasks(2455))
  })

  it("without a store name, local still wins (legacy callers)", () => {
    expect(pickPersistItem(tasks(15), tasks(2455))).toBe(tasks(15))
    expect(pickPersistItem(null, tasks(2455))).toBe(tasks(2455))
  })
})
