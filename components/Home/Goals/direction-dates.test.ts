import { describe, expect, it } from "vitest"
import { formatDriftDay, taskCompletionDate } from "./direction-dates"
import type { Task } from "@/lib/types"

function task(partial: Partial<Task>): Task {
  return { id: "t", title: "t", completed: false, createdAt: new Date("2026-01-01T00:00:00Z"), ...partial } as Task
}

describe("direction dates", () => {
  it("reads completion in the same order on both direction surfaces", () => {
    const completed = new Date("2026-10-01T15:00:00Z")
    const reviewed = new Date("2026-10-02T15:00:00Z")
    const chunk = new Date("2026-10-03T15:00:00Z")
    const scheduled = new Date("2026-10-04T15:00:00Z")
    const created = new Date("2026-10-05T15:00:00Z")
    expect(taskCompletionDate(task({ completedDate: completed, scheduledDate: scheduled }))).toEqual(completed)
    expect(
      taskCompletionDate(task({ completionReview: { taskId: "t", completedAt: reviewed }, scheduledDate: scheduled })),
    ).toEqual(reviewed)
    expect(taskCompletionDate(task({ completedChunks: [{ date: chunk, duration: 1 }], createdAt: created }))).toEqual(chunk)
    expect(taskCompletionDate(task({ scheduledDate: scheduled }))).toEqual(scheduled)
    expect(taskCompletionDate(task({ createdAt: created }))).toEqual(created)
    expect(taskCompletionDate(task({ createdAt: undefined }))).toBeUndefined()
  })

  it("prints a drift day as MMM d and leaves a bad key alone", () => {
    expect(formatDriftDay("2026-10-04")).toBe("Oct 4")
    expect(formatDriftDay("not-a-day")).toBe("not-a-day")
  })
})