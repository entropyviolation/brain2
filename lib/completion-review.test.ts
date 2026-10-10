import { describe, expect, it } from "vitest"
import type { Task } from "@/lib/types"
import {
  clockDraftFromTask,
  clockWriteFromDraft,
  exactDurationMinutes,
  estimatedDurationMinutes,
  formatReviewPoints,
  quickReviewPoints,
  readStartCertainty,
  reviewWordCount,
  summarizeCompletionReviews,
} from "@/lib/completion-review"

function task(overrides: Partial<Task> & Pick<Task, "id">): Task {
  return {
    description: overrides.id,
    stage: "completed",
    createdAt: new Date("2026-06-01T12:00:00"),
    completed: true,
    completedDate: new Date("2026-06-20T12:00:00"),
    lists: [],
    ...overrides,
  }
}

describe("review words and points", () => {
  it("counts whitespace-separated tokens and ignores empty text", () => {
    expect(reviewWordCount("")).toBe(0)
    expect(reviewWordCount("   ")).toBe(0)
    expect(reviewWordCount(undefined)).toBe(0)
    expect(reviewWordCount("one   two\nthree")).toBe(3)
    expect(reviewWordCount("well-known")).toBe(1)
  })

  it("awards 3 points plus 0.1 per word", () => {
    expect(quickReviewPoints(0)).toBe(3)
    expect(quickReviewPoints(1)).toBe(3.1)
    expect(quickReviewPoints(10)).toBe(4)
    expect(quickReviewPoints(25)).toBe(5.5)
    expect(quickReviewPoints(3.9)).toBe(3.3)
    expect(formatReviewPoints(3)).toBe("3")
    expect(formatReviewPoints(3.1)).toBe("3.1")
  })
})

describe("duration certainty", () => {
  it("sums only exact minutes and keeps estimates and unknowns apart", () => {
    expect(exactDurationMinutes({ actualDuration: 30, durationCertainty: "exact" })).toBe(30)
    expect(exactDurationMinutes({ actualDuration: 30, durationCertainty: "estimated" })).toBeUndefined()
    expect(exactDurationMinutes({ durationCertainty: "unknown" })).toBeUndefined()
    expect(exactDurationMinutes({ actualDuration: 0, durationCertainty: "unknown" })).toBeUndefined()
    expect(estimatedDurationMinutes({ actualDuration: 12, durationCertainty: "estimated" })).toBe(12)
    expect(estimatedDurationMinutes({ actualDuration: 12, durationCertainty: "exact" })).toBeUndefined()
    expect(estimatedDurationMinutes({ durationCertainty: "unknown" })).toBeUndefined()
    expect(exactDurationMinutes({ actualDuration: 18 })).toBe(18)
    expect(exactDurationMinutes({ actualDuration: 18, timeRough: true })).toBeUndefined()
    expect(estimatedDurationMinutes({ actualDuration: 18, timeRough: true })).toBe(18)
  })
})

describe("start certainty", () => {
  const base = task({ id: "t" })
  const at = new Date(2026, 5, 20, 9, 15)

  it("reads a legacy known start as exact", () => {
    expect(readStartCertainty("known")).toBe("exact")
    const draft = clockDraftFromTask(
      task({
        id: "known",
        startedAt: at,
        startCertainty: "known" as Task["startCertainty"],
        completionReview: {
          taskId: "known",
          completedAt: at,
          startedAt: at,
          startCertainty: "known" as Task["startCertainty"],
        },
      }),
    )
    expect(draft.startCertainty).toBe("exact")
    expect(draft.startTime).toBe("09:15")
  })

  it("writes exact, estimated, and unknown starts, and unknown stores no time", () => {
    const exact = clockWriteFromDraft(base, {
      durationCertainty: "exact",
      durationMinutes: "30",
      startCertainty: "exact",
      startTime: "09:15",
      doneCertainty: "unspecified",
      doneDate: "",
      doneTime: "",
    })
    expect(exact.startCertainty).toBe("exact")
    expect(exact.startedAt?.getHours()).toBe(9)
    expect(exact.startedAt?.getMinutes()).toBe(15)
    expect(exact.timeRough).toBeUndefined()

    const estimated = clockWriteFromDraft(base, {
      durationCertainty: "unknown",
      durationMinutes: "",
      startCertainty: "estimated",
      startTime: "09:15",
      doneCertainty: "unspecified",
      doneDate: "",
      doneTime: "",
    })
    expect(estimated.durationCertainty).toBe("unknown")
    expect(estimated.actualDuration).toBeUndefined()
    expect(estimated.startCertainty).toBe("estimated")
    expect(estimated.startedAt?.getHours()).toBe(9)
    expect(estimated.timeRough).toBe(true)

    const unknown = clockWriteFromDraft(
      task({ id: "had", startedAt: at, startCertainty: "estimated", timeRough: true }),
      {
        durationCertainty: "unspecified",
        durationMinutes: "",
        startCertainty: "unknown",
        startTime: "09:15",
        doneCertainty: "unspecified",
        doneDate: "",
        doneTime: "",
      },
    )
    expect(unknown.writeStart).toBe(true)
    expect(unknown.startedAt).toBeUndefined()
    expect(unknown.startCertainty).toBe("unknown")
    expect(unknown.timeRough).toBeUndefined()
  })
})

describe("finish certainty", () => {
  const base = task({ id: "t" })

  it("writes any other day and time, and leaves an unspecified finish alone", () => {
    const exact = clockWriteFromDraft(base, {
      durationCertainty: "unspecified",
      durationMinutes: "",
      startCertainty: "exact",
      startTime: "07:00",
      doneCertainty: "exact",
      doneDate: "2026-06-18",
      doneTime: "20:00",
    })
    expect(exact.writeDone).toBe(true)
    expect(exact.completedCertainty).toBe("exact")
    expect(exact.completedDate).toEqual(new Date(2026, 5, 18, 20, 0, 0, 0))
    expect(exact.startedAt).toEqual(new Date(2026, 5, 18, 7, 0, 0, 0))
    expect(exact.timeRough).toBeUndefined()

    const untouched = clockWriteFromDraft(base, {
      durationCertainty: "unspecified",
      durationMinutes: "",
      startCertainty: "unspecified",
      startTime: "",
      doneCertainty: "unspecified",
      doneDate: "2026-06-18",
      doneTime: "20:00",
    })
    expect(untouched.writeDone).toBe(false)
    expect(untouched.completedDate).toBeUndefined()
  })

  it("marks a finish estimated and keeps that out of an exact claim", () => {
    const estimated = clockWriteFromDraft(base, {
      durationCertainty: "unspecified",
      durationMinutes: "",
      startCertainty: "unspecified",
      startTime: "",
      doneCertainty: "estimated",
      doneDate: "2026-06-19",
      doneTime: "15:40",
    })
    expect(estimated.completedCertainty).toBe("estimated")
    expect(estimated.completedDate).toEqual(new Date(2026, 5, 19, 15, 40, 0, 0))
    expect(estimated.timeRough).toBe(true)

    const roundTrip = clockDraftFromTask({
      ...base,
      completedDate: estimated.completedDate,
      completedCertainty: "estimated",
      timeRough: true,
    })
    expect(roundTrip.doneCertainty).toBe("estimated")
    expect(roundTrip.doneDate).toBe("2026-06-19")
    expect(roundTrip.doneTime).toBe("15:40")
  })
})

describe("summarizeCompletionReviews", () => {
  const inWindow = () => true

  it("does not treat an unknown length as zero in the minute totals", () => {
    const summary = summarizeCompletionReviews({
      tasks: [
        task({
          id: "exact",
          actualDuration: 40,
          durationCertainty: "exact",
          completionReview: {
            taskId: "exact",
            completedAt: new Date("2026-06-20T12:00:00"),
            actualDuration: 40,
            durationCertainty: "exact",
            reviewPoints: 3,
            reviewWordCount: 0,
          },
        }),
        task({
          id: "est",
          actualDuration: 15,
          durationCertainty: "estimated",
          completionReview: {
            taskId: "est",
            completedAt: new Date("2026-06-20T13:00:00"),
            actualDuration: 15,
            durationCertainty: "estimated",
            expectedDifficulty: 4,
            actualDifficulty: 8,
            enjoyment: 9,
            notes: "hard but good",
            reviewPoints: 3.3,
            reviewWordCount: 3,
          },
          contributesToGoalIds: ["g1"],
          contributesToObjectiveIds: ["o1"],
        }),
        task({
          id: "unk",
          durationCertainty: "unknown",
          completionReview: {
            taskId: "unk",
            completedAt: new Date("2026-06-20T14:00:00"),
            durationCertainty: "unknown",
            resistance: 6,
          },
          contributesToGoalIds: ["g1"],
        }),
      ],
      goals: [{ id: "g1", title: "Ship the letter" }],
      objectives: [{ id: "o1", title: "Write" }],
      inWindow,
      titleOf: (row) => row.description,
    })

    expect(summary.doneCount).toBe(3)
    expect(summary.exactMinutes).toBe(40)
    expect(summary.exactCount).toBe(1)
    expect(summary.estimatedMinutes).toBe(15)
    expect(summary.unknownCount).toBe(1)
    expect(summary.exactMinutes + summary.estimatedMinutes).toBe(55)
    expect(summary.difficultyPairs).toEqual([
      { taskId: "est", title: "est", expected: 4, actual: 8 },
    ])
    expect(summary.difficultyGap).toBe(4)
    expect(summary.reviewPoints).toBeCloseTo(6.3)
    expect(summary.wordCount).toBe(3)
    const goal = summary.goals.find((row) => row.id === "g1")
    expect(goal?.n).toBe(2)
    expect(goal?.exactMinutes).toBe(0)
    expect(goal?.estimatedMinutes).toBe(15)
    expect(goal?.meanActualDifficulty).toBe(8)
    expect(goal?.meanEnjoyment).toBe(9)
    expect(summary.objectives[0]?.title).toBe("Write")
    const resistance = summary.scoreMeans.find((row) => row.key === "resistance")
    expect(resistance).toMatchObject({ n: 1, mean: 6 })
    expect(summary.startUnspecified).toBe(3)
    expect(summary.startUnknown).toBe(0)
  })

  it("counts unknown starts on their own and treats a legacy known start as exact", () => {
    const at = new Date(2026, 5, 20, 9, 15)
    const summary = summarizeCompletionReviews({
      tasks: [
        task({
          id: "exact",
          startedAt: at,
          startCertainty: "known" as Task["startCertainty"],
          completionReview: {
            taskId: "exact",
            completedAt: at,
            startedAt: at,
            startCertainty: "known" as Task["startCertainty"],
          },
        }),
        task({
          id: "est",
          startedAt: at,
          startCertainty: "estimated",
          completionReview: {
            taskId: "est",
            completedAt: at,
            startedAt: at,
            startCertainty: "estimated",
          },
        }),
        task({
          id: "unk",
          startCertainty: "unknown",
          completionReview: {
            taskId: "unk",
            completedAt: at,
            startCertainty: "unknown",
          },
        }),
        task({ id: "blank" }),
      ],
      goals: [],
      objectives: [],
      inWindow,
      titleOf: (row) => row.description,
    })

    expect(summary.startExact).toBe(1)
    expect(summary.startEstimated).toBe(1)
    expect(summary.startUnknown).toBe(1)
    expect(summary.startUnspecified).toBe(1)
    expect(summary.startExact + summary.startEstimated).toBe(2)
  })

  it("averages satisfaction and distraction with the other feelings and keeps later notes", () => {
    const older = new Date("2026-06-20T12:00:00")
    const newer = new Date("2026-06-21T12:00:00")
    const summary = summarizeCompletionReviews({
      tasks: [
        task({
          id: "a",
          description: "Letter",
          completionReview: {
            taskId: "a",
            completedAt: older,
            satisfaction: 8,
            distraction: 3,
            enjoyment: 7,
            reflectNotes: "  ship smaller  ",
            notes: "quick review words",
            reviewPoints: 3.3,
            reviewWordCount: 3,
          },
        }),
        task({
          id: "b",
          description: "Stamp",
          completionReview: {
            taskId: "b",
            completedAt: newer,
            satisfaction: 4,
            reflectNotes: "   ",
          },
        }),
        task({
          id: "c",
          description: "Ink",
          completionReview: {
            taskId: "c",
            completedAt: newer,
            satisfaction: 0,
            distraction: 11,
            resistance: 5,
            reflectNotes: "stay with the pen",
          },
        }),
      ],
      goals: [],
      objectives: [],
      inWindow,
      titleOf: (row) => row.description,
    })

    expect(summary.scoreMeans.find((row) => row.key === "satisfaction")).toMatchObject({ n: 2, mean: 6 })
    expect(summary.scoreMeans.find((row) => row.key === "distraction")).toMatchObject({ n: 1, mean: 3 })
    expect(summary.scoreMeans.find((row) => row.key === "enjoyment")).toMatchObject({ n: 1, mean: 7 })
    expect(summary.scoreMeans.find((row) => row.key === "resistance")).toMatchObject({ n: 1, mean: 5 })
    const keys = summary.scoreMeans.map((row) => row.key)
    expect(keys.indexOf("enjoyment")).toBeLessThan(keys.indexOf("satisfaction"))
    expect(keys.indexOf("satisfaction")).toBeLessThan(keys.indexOf("distraction"))
    expect(summary.reflectNotes.map((note) => note.taskId)).toEqual(["c", "a"])
    expect(summary.reflectNotes[1]).toMatchObject({ title: "Letter", text: "ship smaller" })
    expect(summary.reflectNotes.some((note) => note.text.includes("quick review"))).toBe(false)
    expect(summary.wordCount).toBe(3)
  })
})
