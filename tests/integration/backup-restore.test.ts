/**
 * Integration: full backup → wipe → restore round-trip across multiple stores.
 *
 * Seeds data into several persisted stores (tasks, reviews, the points ledger)
 * plus free-text plans, captures a backup, wipes everything, and restores it —
 * asserting the data comes back through each store's own read surface. This
 * exercises `createBackup`/`restoreBackup` together with the live stores and the
 * repository/service layers that read them.
 */
import { describe, it, expect, beforeEach } from "vitest"
import { resetAllStores } from "@/tests/test-utils"
import { createBackup, serializeBackup, parseBackup, restoreBackup } from "@/lib/data/backup"
import { taskRepository } from "@/lib/data/task-repository"
import { completeTask } from "@/lib/services/completion-service"
import { upsertPeriodReview, getPeriodReview } from "@/lib/services/review-service"
import { saveStoredPlanText, getStoredPlanText } from "@/lib/plan-text"
import { useTaskStore } from "@/lib/task-store"
import { useReviewsStore } from "@/lib/reviews-store"
import { usePointsStore } from "@/lib/points-store"
import type { Task } from "@/lib/types"

const task = (overrides: Partial<Task>): Task => ({
  id: "t1",
  description: "Task",
  stage: "list",
  createdAt: new Date("2026-06-01T00:00:00"),
  completed: false,
  lists: [],
  ...overrides,
})

/** Seed data across several stores + plan text. Returns the captured backup. */
function seedAndBackup() {
  taskRepository.add(task({ id: "a", description: "ship the thing", tags: ["work"] }))
  taskRepository.add(task({ id: "b", description: "reward task", rewardValue: 30 }))
  taskRepository.addLink("a", "blocks", "b")

  // Points ledger: completing "b" awards its reward through the store.
  completeTask("b")

  // Reviews store.
  upsertPeriodReview("day", "2026-06-20", { summary: "solid day", gratitude: ["sun"] })

  // Free-text plans.
  saveStoredPlanText("day", "2026-06-20", "morning: focus block")
  saveStoredPlanText("week", "2026-W25", "ship feature")

  // Round-trip through serialize/parse to mimic a real exported file.
  return parseBackup(serializeBackup(createBackup()))
}

describe("integration: full backup & restore", () => {
  beforeEach(() => resetAllStores())

  it("restores tasks, links, reviews, points, and plan text after a full wipe", async () => {
    const backup = seedAndBackup()
    const pointsBefore = usePointsStore.getState().getTotalPoints()
    expect(pointsBefore).toBe(30)

    // Wipe everything.
    resetAllStores()
    expect(taskRepository.getAll()).toHaveLength(0)
    expect(useReviewsStore.getState().reviews).toHaveLength(0)
    expect(usePointsStore.getState().getTotalPoints()).toBe(0)
    expect(getStoredPlanText("day", "2026-06-20")).toBeNull()

    const result = await restoreBackup(backup)
    expect(result.stores).toBeGreaterThan(0)
    expect(result.planText).toBe(2)

    // Tasks (and their typed links) are back.
    const a = taskRepository.getById("a")
    expect(a?.description).toBe("ship the thing")
    expect(a?.tags).toEqual(["work"])
    expect(useTaskStore.getState().getLinkedItems("a").map((t) => t.id)).toEqual(["b"])

    // Reviews are back and readable through the service.
    expect(getPeriodReview("day", "2026-06-20")?.summary).toBe("solid day")

    // Points ledger restored.
    expect(usePointsStore.getState().getTotalPoints()).toBe(30)

    // Free-text plans restored.
    expect(getStoredPlanText("day", "2026-06-20")).toBe("morning: focus block")
    expect(getStoredPlanText("week", "2026-W25")).toBe("ship feature")
  })

  it("is a full replace — mutations made after backup are discarded on restore", async () => {
    const backup = seedAndBackup()

    // Mutate after capturing the backup.
    taskRepository.add(task({ id: "c", description: "added later" }))
    taskRepository.update({ ...taskRepository.getById("a")!, description: "edited later" })
    saveStoredPlanText("day", "2026-06-21", "stale plan")

    await restoreBackup(backup)

    // Post-backup additions/edits are gone; backed-up state wins.
    expect(taskRepository.getById("c")).toBeUndefined()
    expect(taskRepository.getById("a")?.description).toBe("ship the thing")
    expect(getStoredPlanText("day", "2026-06-21")).toBeNull()
  })

  it("preserves the createdAt timestamp value across the round-trip", async () => {
    const backup = seedAndBackup()
    resetAllStores()
    await restoreBackup(backup)

    const a = taskRepository.getById("a")
    // The task store's persist reviver detects ISO-8601 strings on known date
    // keys and rehydrates them as Date instances, so a restore (like a reload)
    // brings createdAt back as a real Date with its timestamp value preserved.
    expect(a?.createdAt).toBeInstanceOf(Date)
    expect((a!.createdAt as Date).toISOString()).toBe(new Date("2026-06-01T00:00:00").toISOString())
  })
})
