import { describe, expect, it } from "vitest"
import { EMPTY_FRIEND_NUDGE, pickFriendTodoNudge } from "./baby-animal-nudge"
import type { Folder, Task } from "@/lib/types"

const folders: Folder[] = [{ id: "naf", name: "Next Actions", createdAt: new Date("2026-09-21"), listIds: ["na"] }]

function task(id: string, description: string, extra: Partial<Task> = {}): Task {
  return {
    id,
    description,
    stage: "scheduled",
    createdAt: new Date("2026-09-21T12:00:00"),
    completed: false,
    lists: ["na"],
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
    ...extra,
  }
}

describe("pickFriendTodoNudge", () => {
  it("returns the empty line when nothing is open", () => {
    expect(pickFriendTodoNudge([task("done", "Old", { completed: true })], folders, null, () => 0)).toEqual({
      taskId: null,
      line: EMPTY_FRIEND_NUDGE,
      source: null,
    })
  })

  it("skips completed rows and items outside Next Actions", () => {
    const nudge = pickFriendTodoNudge(
      [
        task("note", "A book", { lists: ["books"], type: "item" }),
        task("done", "Old", { completed: true }),
        task("open", "Water the plants"),
      ],
      folders,
      null,
      () => 0,
    )
    expect(nudge.taskId).toBe("open")
    expect(nudge.line).toContain("Water the plants")
  })

  it("includes unscheduled Next Actions, not only a day's To Do", () => {
    const now = new Date("2026-09-21T12:00:00")
    const later = new Date("2026-10-04T12:00:00")
    const nudge = pickFriendTodoNudge(
      [
        task("someday", "Read Technopoly"),
        task("today", "Walk around the block", { scheduledDate: now }),
        task("next-week", "Call the dentist", { scheduledDate: later }),
      ],
      folders,
      null,
      () => 0,
    )
    expect(["someday", "today", "next-week"]).toContain(nudge.taskId)
    expect(nudge.source).toBe("nextAction")
  })

  it("avoids repeating the last task when another is open", () => {
    const tasks = [task("a", "Alpha"), task("b", "Bravo")]
    const first = pickFriendTodoNudge(tasks, folders, null, () => 0)
    expect(first.taskId).toBe("a")
    const second = pickFriendTodoNudge(tasks, folders, first.taskId, () => 0)
    expect(second.taskId).toBe("b")
    expect(second.line).toContain("Bravo")
  })
})
