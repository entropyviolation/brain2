/**
 * Integration: the "Needs Attention" selector over live store data.
 *
 * Seeds a realistic mix of tasks through the repository (which writes to the
 * Zustand store), then runs the pure `getNeedsAttention` selector against the
 * store snapshot (`taskRepository.getAll()`) and asserts the right items surface
 * with the right machine-readable reasons. `now` is injected for determinism.
 */
import { describe, it, expect, beforeEach } from "vitest"
import { resetAllStores } from "@/tests/test-utils"
import { taskRepository } from "@/lib/data/task-repository"
import {
  getNeedsAttention,
  groupNeedsAttentionByReason,
  type NeedsAttentionReason,
} from "@/lib/needs-attention"
import type { Task } from "@/lib/types"

const NOW = new Date("2026-06-23T12:00:00")

const task = (overrides: Partial<Task>): Task => ({
  id: "t1",
  description: "Task",
  stage: "clarified",
  // Recent by default so tasks aren't incidentally "stale".
  createdAt: new Date("2026-06-22T12:00:00"),
  completed: false,
  lists: [],
  // Scheduled by default so tasks aren't incidentally "stale".
  scheduledDate: new Date("2026-06-23T00:00:00"),
  ...overrides,
})

function reasonsFor(entries: ReturnType<typeof getNeedsAttention>, id: string): NeedsAttentionReason[] {
  return entries.find((e) => e.item.id === id)?.reasons ?? []
}

describe("integration: needs-attention over the store", () => {
  beforeEach(() => resetAllStores())

  it("surfaces overdue / unclarified / blocked / stale with the right reasons", () => {
    // overdue: deadline in the past, scheduled (so not stale).
    taskRepository.add(task({ id: "overdue", deadline: new Date("2026-06-01T00:00:00") }))
    // unclarified: sits in the GTD inbox.
    taskRepository.add(task({ id: "inbox", stage: "inbox" }))
    // dependency target that is still incomplete → blocks its dependents.
    taskRepository.add(task({ id: "dep", completed: false }))
    // blocked: depends on the incomplete "dep".
    taskRepository.add(task({ id: "blocked", dependencies: ["dep"] }))
    // stale: unscheduled and created long ago.
    taskRepository.add(
      task({
        id: "stale",
        createdAt: new Date("2026-05-01T00:00:00"),
        scheduledDate: undefined,
      }),
    )
    // clean: nothing wrong with it.
    taskRepository.add(task({ id: "clean" }))
    // completed tasks are always excluded even if otherwise flaggable.
    taskRepository.add(
      task({ id: "done", stage: "inbox", completed: true, deadline: new Date("2026-06-01T00:00:00") }),
    )

    const entries = getNeedsAttention(taskRepository.getAll(), { now: NOW })
    const flagged = entries.map((e) => e.item.id).sort()

    expect(flagged).toEqual(["blocked", "inbox", "overdue", "stale"])
    expect(reasonsFor(entries, "overdue")).toEqual(["overdue"])
    expect(reasonsFor(entries, "inbox")).toEqual(["unclarified"])
    expect(reasonsFor(entries, "blocked")).toEqual(["blocked"])
    expect(reasonsFor(entries, "stale")).toEqual(["stale"])
    expect(reasonsFor(entries, "clean")).toEqual([])
    expect(reasonsFor(entries, "done")).toEqual([])
    expect(reasonsFor(entries, "dep")).toEqual([])
  })

  it("annotates a single task with multiple reasons and groups them", () => {
    // Inbox + overdue + stale all apply to one neglected task.
    taskRepository.add(
      task({
        id: "messy",
        stage: "inbox",
        deadline: new Date("2026-06-01T00:00:00"),
        createdAt: new Date("2026-05-01T00:00:00"),
        scheduledDate: undefined,
      }),
    )

    const entries = getNeedsAttention(taskRepository.getAll(), { now: NOW })
    expect(reasonsFor(entries, "messy").sort()).toEqual(["overdue", "stale", "unclarified"])

    const grouped = groupNeedsAttentionByReason(entries)
    expect(grouped.overdue.map((e) => e.item.id)).toEqual(["messy"])
    expect(grouped.unclarified.map((e) => e.item.id)).toEqual(["messy"])
    expect(grouped.stale.map((e) => e.item.id)).toEqual(["messy"])
    expect(grouped.blocked).toHaveLength(0)
  })

  it("clears the blocked reason once the dependency is completed", () => {
    taskRepository.add(task({ id: "dep" }))
    taskRepository.add(task({ id: "blocked", dependencies: ["dep"] }))

    let entries = getNeedsAttention(taskRepository.getAll(), { now: NOW })
    expect(reasonsFor(entries, "blocked")).toEqual(["blocked"])

    // Resolve the dependency through the repository and re-read the snapshot.
    taskRepository.update({ ...taskRepository.getById("dep")!, completed: true })

    entries = getNeedsAttention(taskRepository.getAll(), { now: NOW })
    expect(reasonsFor(entries, "blocked")).toEqual([])
  })

  it("honors a custom staleDays threshold", () => {
    taskRepository.add(
      task({ id: "old", createdAt: new Date("2026-06-18T12:00:00"), scheduledDate: undefined }),
    )

    // 10 days old: not stale at the default 14, but stale at a 7-day threshold.
    expect(reasonsFor(getNeedsAttention(taskRepository.getAll(), { now: NOW }), "old")).toEqual([])
    expect(
      reasonsFor(getNeedsAttention(taskRepository.getAll(), { now: NOW, staleDays: 3 }), "old"),
    ).toEqual(["stale"])
  })
})
