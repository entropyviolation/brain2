import { describe, it, expect } from "vitest"
import {
  clarifyNeedsAttentionItem,
  getNeedsAttention,
  groupNeedsAttentionByReason,
  splitNeedsAttentionItem,
  type NeedsAttentionReason,
} from "@/lib/needs-attention"
import type { Goal, Task } from "@/lib/types"

const NOW = new Date("2026-06-23T12:00:00.000Z")

/** Minimal Task factory with sane, non-flagging defaults. */
function makeTask(overrides: Partial<Task> = {}): Task {
  return {
    id: overrides.id ?? "t1",
    description: overrides.description ?? "Task",
    // Default to a clarified + scheduled task so nothing flags unless asked.
    stage: "clarified",
    createdAt: NOW,
    completed: false,
    lists: [],
    scheduledDate: NOW,
    ...overrides,
  }
}

function daysAgo(days: number): Date {
  return new Date(NOW.getTime() - days * 24 * 60 * 60 * 1000)
}

function reasonsFor(entries: ReturnType<typeof getNeedsAttention>, id: string): NeedsAttentionReason[] {
  return entries.find((e) => e.item.id === id)?.reasons ?? []
}

describe("getNeedsAttention — reasons", () => {
  it("flags overdue: deadline in the past, not completed", () => {
    const task = makeTask({ id: "overdue", deadline: daysAgo(1) })
    const entries = getNeedsAttention([task], { now: NOW })
    expect(reasonsFor(entries, "overdue")).toEqual(["overdue"])
  })

  it("does not flag overdue when deadline is in the future", () => {
    const task = makeTask({ id: "future", deadline: new Date(NOW.getTime() + 1000) })
    const entries = getNeedsAttention([task], { now: NOW })
    expect(entries).toHaveLength(0)
  })

  it("flags unclarified: category is inbox", () => {
    const task = makeTask({ id: "inbox", stage: "inbox" })
    const entries = getNeedsAttention([task], { now: NOW })
    expect(reasonsFor(entries, "inbox")).toEqual(["unclarified"])
  })

  it("does not flag monkey brain dumps as unclarified", () => {
    const task = makeTask({ id: "mb", stage: "inbox", monkeyBrain: true })
    const entries = getNeedsAttention([task], { now: NOW })
    expect(reasonsFor(entries, "mb")).toEqual([])
  })

  it("flags blocked: a dependency is not completed", () => {
    const dep = makeTask({ id: "dep", completed: false })
    const task = makeTask({ id: "blocked", dependencies: ["dep"] })
    const entries = getNeedsAttention([dep, task], { now: NOW })
    expect(reasonsFor(entries, "blocked")).toEqual(["blocked"])
  })

  it("does not flag blocked when all dependencies are completed", () => {
    const dep = makeTask({ id: "dep", completed: true })
    const task = makeTask({ id: "unblocked", dependencies: ["dep"] })
    const entries = getNeedsAttention([dep, task], { now: NOW })
    expect(reasonsFor(entries, "unblocked")).toEqual([])
  })

  it("does not flag blocked when a dependency is a missed opportunity", () => {
    const dep = makeTask({ id: "dep", status: "missed", completed: false })
    const task = makeTask({ id: "unblocked-late", dependencies: ["dep"] })
    const entries = getNeedsAttention([dep, task], { now: NOW })
    expect(reasonsFor(entries, "unblocked-late")).toEqual([])
  })

  it("flags blocked when a dependency id cannot be resolved", () => {
    const task = makeTask({ id: "blocked-missing", dependencies: ["ghost"] })
    const entries = getNeedsAttention([task], { now: NOW })
    expect(reasonsFor(entries, "blocked-missing")).toEqual(["blocked"])
  })

  it("flags stale: unscheduled and older than the threshold", () => {
    const task = makeTask({
      id: "stale",
      createdAt: daysAgo(30),
      scheduledDate: undefined,
    })
    const entries = getNeedsAttention([task], { now: NOW })
    expect(reasonsFor(entries, "stale")).toEqual(["stale"])
  })

  it("does not flag stale when the task is scheduled", () => {
    const task = makeTask({
      id: "scheduled",
      createdAt: daysAgo(30),
      scheduledDate: NOW,
    })
    const entries = getNeedsAttention([task], { now: NOW })
    expect(entries).toHaveLength(0)
  })
})

describe("getNeedsAttention — exclusions", () => {
  it("excludes completed tasks even when they would otherwise flag", () => {
    const task = makeTask({
      id: "done",
      completed: true,
      stage: "inbox",
      deadline: daysAgo(5),
      createdAt: daysAgo(60),
      scheduledDate: undefined,
    })
    const entries = getNeedsAttention([task], { now: NOW })
    expect(entries).toHaveLength(0)
  })

  it("excludes missed-opportunity tasks even when they would otherwise flag", () => {
    const task = makeTask({
      id: "late",
      status: "missed",
      completed: false,
      stage: "inbox",
      deadline: daysAgo(5),
      createdAt: daysAgo(60),
      scheduledDate: undefined,
    })
    const entries = getNeedsAttention([task], { now: NOW })
    expect(entries).toHaveLength(0)
  })

  it("returns nothing for a healthy clarified, scheduled task", () => {
    const task = makeTask({ id: "healthy" })
    expect(getNeedsAttention([task], { now: NOW })).toEqual([])
  })
})

describe("getNeedsAttention — stale threshold boundary", () => {
  it("uses the default 14-day threshold (strictly greater than)", () => {
    const exactly14 = makeTask({ id: "edge", createdAt: daysAgo(14), scheduledDate: undefined })
    // Exactly 14 days old is NOT stale (boundary is exclusive).
    expect(reasonsFor(getNeedsAttention([exactly14], { now: NOW }), "edge")).toEqual([])

    const past14 = makeTask({ id: "past", createdAt: daysAgo(15), scheduledDate: undefined })
    expect(reasonsFor(getNeedsAttention([past14], { now: NOW }), "past")).toEqual(["stale"])
  })

  it("honors a custom staleDays threshold", () => {
    const task = makeTask({ id: "custom", createdAt: daysAgo(5), scheduledDate: undefined })
    expect(reasonsFor(getNeedsAttention([task], { now: NOW, staleDays: 3 }), "custom")).toEqual(["stale"])
    expect(getNeedsAttention([task], { now: NOW, staleDays: 7 })).toEqual([])
  })
})

describe("getNeedsAttention — multiple reasons", () => {
  it("collects every applicable reason on one item", () => {
    const dep = makeTask({ id: "dep", completed: false })
    const task = makeTask({
      id: "multi",
      stage: "inbox",
      deadline: daysAgo(2),
      createdAt: daysAgo(40),
      scheduledDate: undefined,
      dependencies: ["dep"],
    })
    const entries = getNeedsAttention([dep, task], { now: NOW })
    expect(reasonsFor(entries, "multi").sort()).toEqual(
      ["blocked", "overdue", "stale", "unclarified"].sort(),
    )
  })

  it("respects the opts.reasons filter", () => {
    const task = makeTask({
      id: "filtered",
      stage: "inbox",
      deadline: daysAgo(2),
    })
    const entries = getNeedsAttention([task], { now: NOW, reasons: ["overdue"] })
    expect(reasonsFor(entries, "filtered")).toEqual(["overdue"])
  })
})

describe("groupNeedsAttentionByReason", () => {
  it("places multi-reason entries under each of their reason groups", () => {
    const task = makeTask({ id: "multi", stage: "inbox", deadline: daysAgo(2) })
    const entries = getNeedsAttention([task], { now: NOW })
    const groups = groupNeedsAttentionByReason(entries)
    expect(groups.overdue.map((e) => e.item.id)).toEqual(["multi"])
    expect(groups.unclarified.map((e) => e.item.id)).toEqual(["multi"])
    expect(groups.blocked).toEqual([])
    expect(groups.stale).toEqual([])
    expect(groups.neglected).toEqual([])
    expect(groups.zombie).toEqual([])
  })
})

function makeGoal(overrides: Partial<Goal> & { id: string }): Goal {
  return {
    title: overrides.title ?? overrides.id,
    type: "count",
    target: 5,
    current: 0,
    periodKind: "year",
    objectiveIds: ["obj-1"],
    points: 1,
    completed: false,
    createdAt: daysAgo(30),
    ...overrides,
  }
}

describe("getNeedsAttention — neglected", () => {
  it("flags an operation with no recent logged work on its tree", () => {
    const op = makeTask({
      id: "op-cold",
      type: "operation",
      createdAt: daysAgo(30),
      scheduledDate: undefined,
    })
    const entries = getNeedsAttention([op], { now: NOW })
    expect(reasonsFor(entries, "op-cold")).toEqual(["stale", "neglected"])
  })

  it("does not flag an operation with a recent time log", () => {
    const op = makeTask({
      id: "op-hot",
      type: "operation",
      createdAt: daysAgo(30),
      scheduledDate: undefined,
      timeLogs: [{ id: "l1", date: "2026-06-20", durationMinutes: 40 }],
    })
    const entries = getNeedsAttention([op], { now: NOW })
    expect(reasonsFor(entries, "op-hot")).not.toContain("neglected")
  })

  it("does not flag a brand-new operation with no logs yet", () => {
    const op = makeTask({
      id: "op-new",
      type: "operation",
      createdAt: daysAgo(2),
      scheduledDate: undefined,
    })
    expect(reasonsFor(getNeedsAttention([op], { now: NOW }), "op-new")).not.toContain("neglected")
  })

  it("does not flag a done or abandoned operation", () => {
    const done = makeTask({
      id: "op-done",
      type: "operation",
      createdAt: daysAgo(40),
      scheduledDate: undefined,
      attributes: { stage: "done" },
    })
    const abandoned = makeTask({
      id: "op-abandoned",
      type: "operation",
      createdAt: daysAgo(40),
      scheduledDate: undefined,
      attributes: { stage: "abandoned" },
    })
    const entries = getNeedsAttention([done, abandoned], { now: NOW })
    expect(reasonsFor(entries, "op-done")).not.toContain("neglected")
    expect(reasonsFor(entries, "op-abandoned")).not.toContain("neglected")
  })

  it("flags a list item with no recent linked completed work", () => {
    const item = makeTask({
      id: "list-cold",
      type: "item",
      stage: "list",
      createdAt: daysAgo(40),
      scheduledDate: undefined,
    })
    const entries = getNeedsAttention([item], { now: NOW })
    expect(reasonsFor(entries, "list-cold")).toContain("neglected")
  })

  it("does not flag a list item that a completed action recently served", () => {
    const item = makeTask({
      id: "list-warm",
      type: "item",
      stage: "list",
      createdAt: daysAgo(40),
      scheduledDate: undefined,
    })
    const work = makeTask({
      id: "work",
      completed: true,
      completedDate: daysAgo(2),
      links: [{ id: "lnk", relation: "action-of", targetId: "list-warm" }],
    })
    expect(reasonsFor(getNeedsAttention([item, work], { now: NOW }), "list-warm")).not.toContain("neglected")
  })

  it("flags a neglected goal via opts.goals using goalsNeedingAttention", () => {
    const goal = makeGoal({ id: "goal-cold", title: "Read 20 books" })
    const entries = getNeedsAttention([], { now: NOW, goals: [goal] })
    expect(reasonsFor(entries, "goal-cold")).toEqual(["neglected"])
    expect(entries[0]?.item.title).toBe("Read 20 books")
  })

  it("does not flag a goal with a recent contributing completion", () => {
    const goal = makeGoal({ id: "goal-hot", title: "Write" })
    const work = makeTask({
      id: "served",
      completed: true,
      completedDate: daysAgo(1),
      contributesToGoalIds: ["goal-hot"],
    })
    expect(getNeedsAttention([work], { now: NOW, goals: [goal] }).map((e) => e.item.id)).not.toContain(
      "goal-hot",
    )
  })
})

describe("getNeedsAttention — zombie", () => {
  it("flags a task pushed many days", () => {
    const task = makeTask({ id: "pushed", daysPushed: 7 })
    expect(reasonsFor(getNeedsAttention([task], { now: NOW }), "pushed")).toEqual(["zombie"])
  })

  it("flags a task pushed many weeks", () => {
    const task = makeTask({ id: "weekly", weeksPushed: 3 })
    expect(reasonsFor(getNeedsAttention([task], { now: NOW }), "weekly")).toEqual(["zombie"])
  })

  it("flags high entropy that has lived past the resident threshold", () => {
    const task = makeTask({ id: "murky", entropy: 0.8, createdAt: daysAgo(22) })
    expect(reasonsFor(getNeedsAttention([task], { now: NOW }), "murky")).toEqual(["zombie"])
  })

  it("does not flag high entropy on a young task", () => {
    const task = makeTask({ id: "fresh-murky", entropy: 0.9, createdAt: daysAgo(3) })
    expect(getNeedsAttention([task], { now: NOW })).toHaveLength(0)
  })

  it("does not treat operations or list items as zombies", () => {
    const op = makeTask({ id: "op", type: "operation", daysPushed: 12, createdAt: daysAgo(2) })
    const item = makeTask({
      id: "item",
      type: "item",
      stage: "list",
      daysPushed: 12,
      createdAt: daysAgo(2),
    })
    const entries = getNeedsAttention([op, item], { now: NOW })
    expect(reasonsFor(entries, "op")).not.toContain("zombie")
    expect(reasonsFor(entries, "item")).not.toContain("zombie")
  })
})

describe("queue actions", () => {
  it("clarify leaves the inbox the way Inbox does", () => {
    const inbox = makeTask({ id: "in", stage: "inbox", lists: ["next"] })
    expect(clarifyNeedsAttentionItem(inbox).stage).toBe("clarified")
    const bare = makeTask({ id: "bare", stage: "inbox", lists: [] })
    expect(clarifyNeedsAttentionItem(bare).stage).toBe("list")
  })

  it("split appends parsed lines as subtasks", () => {
    const task = makeTask({ id: "z", daysPushed: 8, subtasks: [] })
    const next = splitNeedsAttentionItem(task, "1. Draft\n- Edit\n")
    expect(next?.subtasks?.map((s) => s.description)).toEqual(["Draft", "Edit"])
    expect(splitNeedsAttentionItem(task, "   \n")).toBeNull()
  })
})
