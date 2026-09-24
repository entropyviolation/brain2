import { describe, expect, it } from "vitest"
import { canWorkDuringPlanPeriod, nextActionsForPlanPeriod } from "./plan-rail-next-actions"
import type { Folder, Task } from "./types"

const date = new Date(2026, 8, 21) // Mon Sep 21, 2026
const folders: Folder[] = [
  { id: "folder-next-actions", name: "Next Actions", createdAt: date, listIds: ["na-today", "na-later"] },
]

function task(partial: Partial<Task> & { id: string; description: string }): Task {
  return {
    stage: "list",
    type: "task",
    createdAt: date,
    completed: false,
    lists: ["na-today"],
    urgency: 3,
    importance: 3,
    estimatedDuration: 30,
    cognitiveLoad: 2,
    dependencies: [],
    context: "@work",
    entropy: 0.5,
    rewardValue: 5,
    allowPartialCompletion: false,
    minimumChunkSize: 15,
    ...partial,
  }
}

describe("plan-rail-next-actions", () => {
  it("keeps Lists next-action membership, not a new meaning", () => {
    const rows = nextActionsForPlanPeriod(
      [
        task({ id: "na", description: "Ship notes" }),
        task({ id: "other", description: "Not NA", lists: ["inbox"] }),
      ],
      folders,
      "day",
      date,
    )
    expect(rows.map((t) => t.id)).toEqual(["na"])
  })

  it("hides blocked, cleared, and future-locked next actions", () => {
    const blocker = task({ id: "dep", description: "Write draft" })
    const blocked = task({ id: "blocked", description: "Edit draft", dependencies: ["dep"] })
    const done = task({ id: "done", description: "Already filed", completed: true, status: "done" })
    const tomorrow = task({
      id: "later",
      description: "Thursday only",
      scheduledDate: new Date(2026, 8, 24),
    })
    const rows = nextActionsForPlanPeriod([blocker, blocked, done, tomorrow], folders, "day", date)
    expect(rows.map((t) => t.id)).toEqual(["dep"])
  })

  it("includes overdue and unscheduled next actions for the shown period", () => {
    const overdue = task({
      id: "over",
      description: "Yesterday still open",
      scheduledDate: new Date(2026, 8, 20),
    })
    const open = task({ id: "open", description: "Whenever" })
    expect(canWorkDuringPlanPeriod(overdue, "day", date)).toBe(true)
    expect(canWorkDuringPlanPeriod(open, "week", date)).toBe(true)
    expect(
      nextActionsForPlanPeriod([overdue, open], folders, "week", date).map((t) => t.id),
    ).toEqual(["over", "open"])
  })

  it("drops a next action already timed on that day so it lives on the agenda", () => {
    const placed = task({
      id: "placed",
      description: "Call",
      scheduledDate: date,
      scheduledTime: "09:00",
    })
    expect(nextActionsForPlanPeriod([placed], folders, "day", date)).toEqual([])
  })
})
