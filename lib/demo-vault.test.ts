import { beforeEach, describe, expect, it } from "vitest"
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
})
