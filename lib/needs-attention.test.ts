import { describe, it, expect } from "vitest"
import {
  getNeedsAttention,
  groupNeedsAttentionByReason,
  type NeedsAttentionReason,
} from "@/lib/needs-attention"
import type { Task } from "@/lib/types"

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
  })
})
