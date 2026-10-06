import { beforeEach, describe, expect, it } from "vitest"
import { formatLocalDateKey, getWeekDates, getWeekStartDate, getWeekString } from "@/lib/date-utils"
import { dayPlanKey, quarterPlanKey, weekPlanKey } from "@/lib/plan-text"
import { quarterKey } from "@/lib/seasons"
import { resetLocalStorage } from "@/tests/test-utils"
import { ensureDemoVault } from "./demo-vault"
import {
  DATA_PROFILE_KEY,
  persistKey,
  readAliasedLocal,
  resetLegacyPersistCopyFlag,
  writeDataProfile,
} from "./storage-keys"

describe("demo vault", () => {
  beforeEach(() => {
    resetLocalStorage()
    resetLegacyPersistCopyFlag()
  })

  it("does not seed while Live is selected", () => {
    localStorage.setItem(persistKey("task-storage"), "LIVE_TASKS")
    ensureDemoVault({ force: true })
    expect(localStorage.getItem(persistKey("task-storage"))).toBe("LIVE_TASKS")
    expect(localStorage.getItem("brain2-demo-task-storage")).toBeNull()
  })

  it("seeds Demo keys without rewriting Live", () => {
    localStorage.setItem(persistKey("task-storage"), "LIVE_TASKS")
    localStorage.setItem("cogs-task-storage", "LIVE_TASKS")
    localStorage.setItem("points-store", "LIVE_POINTS")
    writeDataProfile("demo")
    ensureDemoVault({ force: true })
    expect(localStorage.getItem(persistKey("task-storage"))).toBe("LIVE_TASKS")
    expect(localStorage.getItem("cogs-task-storage")).toBe("LIVE_TASKS")
    expect(localStorage.getItem("points-store")).toBe("LIVE_POINTS")
    expect(localStorage.getItem(DATA_PROFILE_KEY)).toBe("demo")
    const demoTasks = readAliasedLocal(persistKey("task-storage"))
    expect(demoTasks).toMatch(/River Hale|Cedar Stacks|demo-inbox/)
    expect(demoTasks).not.toBe("LIVE_TASKS")
    expect(localStorage.getItem("brain2-demo-task-storage")).toMatch(/demo-op-kiln/)
    expect(readAliasedLocal(persistKey("timegrid-store"))).toMatch(/act-work/)
    expect(readAliasedLocal(persistKey("sleep-store"))).toMatch(/sleptMin/)
  })

  it("fills the current week and keeps the invented graph off the live vault", () => {
    writeDataProfile("demo")
    ensureDemoVault({ force: true })
    const tasks = JSON.parse(readAliasedLocal(persistKey("task-storage")) ?? "{}")
    const rows = tasks.state.tasks as Array<{
      id: string
      completed?: boolean
      completedDate?: string
      scheduledDate?: string
      links?: unknown[]
      attributes?: Record<string, unknown>
    }>
    const grid = JSON.parse(readAliasedLocal(persistKey("timegrid-store")) ?? "{}")
    const entries = grid.state.entries as Array<{ date: string; kind?: string; spanId?: string; secondaryPenIds?: string[] }>
    const actions = JSON.parse(readAliasedLocal(persistKey("planned-actions")) ?? "{}").state.actions as Array<{ date: string }>
    const today = formatLocalDateKey(new Date())
    for (const day of getWeekDates(getWeekStartDate(new Date()))) {
      const key = formatLocalDateKey(day)
      expect(readAliasedLocal(dayPlanKey(key))).toBeTruthy()
      const planned =
        actions.some((action) => action.date === key) ||
        rows.some((row) => typeof row.scheduledDate === "string" && row.scheduledDate.slice(0, 10) === key)
      expect(planned).toBe(true)
      expect(entries.some((entry) => entry.date === key)).toBe(true)
      if (key <= today) {
        expect(
          rows.some((row) => row.completed && typeof row.completedDate === "string" && row.completedDate.slice(0, 10) === key),
        ).toBe(true)
      }
    }
    expect(readAliasedLocal(weekPlanKey(getWeekString(new Date())))).toBeTruthy()
    expect(readAliasedLocal(quarterPlanKey(quarterKey(new Date())))).toBeTruthy()
    expect(entries.some((entry) => entry.kind === "instant")).toBe(true)
    expect(entries.some((entry) => entry.spanId)).toBe(true)
    expect(entries.some((entry) => entry.secondaryPenIds?.length)).toBe(true)
    expect(rows.some((row) => row.links?.length)).toBe(true)
    expect(rows.some((row) => typeof row.attributes?.partFormulas === "string")).toBe(true)
  })
})
