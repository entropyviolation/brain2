import { describe, expect, it } from "vitest"
import { collectMissReasonCorpus } from "./miss-reason-corpus"
import type { PeriodReview, Task, WeeklyTask } from "@/lib/types"
import type { OperationReview } from "@/lib/reviews-store"

const keys = new Set(["2026-06-18", "2026-06-19", "2026-06-20"])

function task(partial: Partial<Task> & { id: string }): Task {
  return {
    description: partial.id,
    stage: "list",
    createdAt: new Date(2026, 5, 19),
    completed: false,
    lists: [],
    ...partial,
  }
}

describe("miss reason corpus", () => {
  it("counts each note once by token and by source", () => {
    const tasks = [
      task({
        id: "pushed",
        title: "Slides",
        schedulePlacements: [{ period: "day", value: "2026-06-19", resolved: "pushed", missReason: "no-time" }],
      }),
      task({
        id: "outside",
        schedulePlacements: [{ period: "day", value: "2026-01-01", resolved: "pushed", missReason: "no-energy" }],
      }),
      task({
        id: "late",
        title: "Taxes",
        status: "missed",
        missedAt: new Date(2026, 5, 18),
        missReason: { reason: "other", note: "the rain" },
      }),
      task({
        id: "done-with-reason",
        status: "done",
        completed: true,
        missReason: "no-time",
      }),
    ]
    const habits = [{ id: "water", name: "Water" } as WeeklyTask]
    const reviews = [
      {
        id: "day:2026-06-19",
        period: "day",
        periodKey: "2026-06-19",
        completedAt: new Date(2026, 5, 19),
        summary: "",
        gratitude: [],
        nextPlans: "",
        reflections: {},
        resolvedTaskIds: [],
        pushedTaskIds: [],
        blockedReasons: { clothes: "no-time" },
      } as PeriodReview,
    ]
    const operationReviews = [
      {
        id: "operation:op1",
        operationId: "op1",
        completedAt: new Date(2026, 5, 20),
        summary: "",
        blockedReasons: { op1: { reason: "missing-input", note: "waiting on Sam" } },
      } as OperationReview,
    ]
    const corpus = collectMissReasonCorpus({
      tasks: [...tasks, task({ id: "op1", title: "Launch", type: "operation" })],
      habits,
      weeklyData: {
        "2026-06-19": {
          water: { missedOpportunity: true, missReason: "No time" },
          quiet: { missedOpportunity: true },
        },
        "2026-01-02": { water: { missReason: "old" } },
      },
      weeklyHabitData: {
        "2026-06-15_2026-06-21": { water: { missReason: "the fog" } },
      },
      reviewsInRange: reviews,
      operationReviews,
      keySet: keys,
    })

    expect(corpus.notes.map((note) => `${note.source}:${note.text}`).sort()).toEqual(
      [
        "habit:No time",
        "habit:the fog",
        "missed-op:Missing input — waiting on Sam",
        "missed-task:the rain",
        "push:No time",
        "ritual:No time",
      ].sort(),
    )
    expect(corpus.sourceCounts.map((row) => [row.id, row.count])).toEqual([
      ["push", 1],
      ["missed-task", 1],
      ["habit", 2],
      ["missed-op", 1],
      ["ritual", 1],
    ])
    expect(corpus.tokenCounts.find((row) => row.id === "no-time")?.count).toBe(3)
    expect(corpus.tokenCounts.find((row) => row.id === "other")?.count).toBe(1)
    expect(corpus.tokenCounts.find((row) => row.id === "missing-input")?.count).toBe(1)
    expect(corpus.notes.find((note) => note.text === "the fog")?.token).toBe("")
    expect(corpus.notes.some((note) => note.text === "old")).toBe(false)
    expect(corpus.notes.some((note) => note.source === "push" && note.text === "No energy")).toBe(false)
  })
})
