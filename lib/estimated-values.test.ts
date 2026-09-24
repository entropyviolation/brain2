import { describe, expect, it } from "vitest"
import type { FieldEstimate, Task } from "@/lib/types"
import {
  canRegenerate,
  clearEstimates,
  confirmEstimates,
  describeEstimates,
  formatDurationMinutes,
  formatUsualDuration,
  hasUnconfirmedEstimates,
  isConfirmed,
  isEstimated,
  makeEstimate,
  mergeEstimates,
  tasksAwaitingConfirmation,
  unconfirmedEstimates,
  usualDurationMinutes,
} from "@/lib/estimated-values"

const at = new Date(2026, 8, 17, 20, 30)

function task(id: string, completedDate: Date, estimates?: FieldEstimate[]): Task {
  return {
    id,
    description: id,
    stage: "completed",
    createdAt: completedDate,
    completed: true,
    completedDate,
    lists: [],
    estimates,
  } as Task
}

describe("estimated values", () => {
  it("flags a field as estimated until it is confirmed", () => {
    const estimates = [makeEstimate("completedDate", "now", "assumed finished just now", at)]
    expect(isEstimated(estimates, "completedDate")).toBe(true)
    expect(isConfirmed(estimates, "completedDate")).toBe(false)

    const confirmed = confirmEstimates(estimates, ["completedDate"], at)
    expect(isEstimated(confirmed, "completedDate")).toBe(false)
    expect(isConfirmed(confirmed, "completedDate")).toBe(true)
  })

  it("confirms everything unconfirmed when no fields are named", () => {
    const estimates = [
      makeEstimate("completedDate", "now", "assumed finished just now", at),
      makeEstimate("actualDuration", "rate", "4 pages × 10 min each", at),
    ]
    expect(unconfirmedEstimates(confirmEstimates(estimates, undefined, at))).toHaveLength(0)
  })

  it("refuses to regenerate a confirmed field but allows the others", () => {
    const estimates = confirmEstimates(
      [
        makeEstimate("actualDuration", "rate", "4 pages × 10 min each", at),
        makeEstimate("completedDate", "now", "assumed finished just now", at),
      ],
      ["actualDuration"],
      at,
    )
    expect(canRegenerate(estimates, "actualDuration")).toBe(false)
    expect(canRegenerate(estimates, "completedDate")).toBe(true)
  })

  it("merging replaces only the incoming fields and keeps confirmations elsewhere", () => {
    const existing = confirmEstimates(
      [
        makeEstimate("completedDate", "now", "assumed finished just now", at),
        makeEstimate("actualDuration", "rate", "3 pages × 10 min each", at),
      ],
      ["completedDate"],
      at,
    )
    const merged = mergeEstimates(existing, [makeEstimate("actualDuration", "rate", "4 pages × 10 min each", at)])
    expect(merged).toHaveLength(2)
    expect(isConfirmed(merged, "completedDate")).toBe(true)
    expect(merged.find((e) => e.field === "actualDuration")?.basis).toBe("4 pages × 10 min each")
  })

  it("clearing the last flag drops the array entirely", () => {
    const estimates = [makeEstimate("actualDuration", "flat", "20m assumed per completion", at)]
    expect(clearEstimates(estimates, ["actualDuration"])).toBeUndefined()
    expect(clearEstimates(estimates, ["completedDate"])).toHaveLength(1)
  })

  it("orders tasks awaiting confirmation oldest completion first", () => {
    const flag = [makeEstimate("completedDate", "anchor", "assumed around 9:00 PM", at)]
    const tasks = [
      task("late", new Date(2026, 8, 17, 21, 0), flag),
      task("clean", new Date(2026, 8, 16, 9, 0)),
      task("early", new Date(2026, 8, 15, 21, 0), flag),
    ]
    expect(tasksAwaitingConfirmation(tasks).map((t) => t.id)).toEqual(["early", "late"])
    expect(hasUnconfirmedEstimates(tasks[1])).toBe(false)
  })

  it("describes every pending assumption once, collapsing a shared basis", () => {
    const estimates = [
      makeEstimate("completedDate", "now", "assumed finished just now (8:30 PM)", at),
      makeEstimate("startedAt", "now", "assumed finished just now (8:30 PM)", at),
      makeEstimate("actualDuration", "rate", "4 pages × 10 min each", at),
    ]
    const text = describeEstimates(estimates)
    expect(text).toContain("finish time, start time, duration")
    expect(text).toContain("assumed finished just now (8:30 PM); 4 pages × 10 min each")
    expect(describeEstimates(confirmEstimates(estimates, undefined, at))).toBe("")
  })

  it("formats durations for the Done row", () => {
    expect(formatDurationMinutes(0)).toBe("0m")
    expect(formatDurationMinutes(40)).toBe("40m")
    expect(formatDurationMinutes(60)).toBe("1h")
    expect(formatDurationMinutes(95)).toBe("1h 35m")
  })
})

describe("usualDurationMinutes", () => {
  const like = { id: "now", title: "Invoice the week", type: "task" }

  function done(id: string, extras: Partial<Task> = {}): Task {
    return {
      id,
      title: "Invoice the week",
      description: "Invoice the week",
      type: "task",
      stage: "completed",
      createdAt: at,
      completed: true,
      completedDate: at,
      lists: [],
      ...extras,
    } as Task
  }

  it("returns the median of unflagged actualDuration on the same title", () => {
    const usual = usualDurationMinutes(
      [done("a", { actualDuration: 20 }), done("b", { actualDuration: 40 }), done("c", { actualDuration: 60 })],
      like,
    )
    expect(usual).toMatchObject({ minutes: 40, sampleCount: 3, match: "title" })
    expect(formatUsualDuration(usual!)).toBe("usually ~40m")
    expect(usual!.basis).toContain("same title")
  })

  it("needs two observed sessions before it will say usually", () => {
    expect(usualDurationMinutes([done("a", { actualDuration: 40 })], like)).toBeNull()
  })

  it("ignores assumed actualDuration and never reads estimatedDuration", () => {
    const assumed = done("a", {
      actualDuration: 99,
      estimatedDuration: 99,
      estimates: [makeEstimate("actualDuration", "rate", "4 pages × 10 min each", at)],
    })
    const peers = [done("b", { actualDuration: 30 }), done("c", { actualDuration: 50 })]
    expect(usualDurationMinutes([assumed, ...peers], like)?.minutes).toBe(40)
  })

  it("prefers timeLogs over a rolled-up actualDuration on the same record", () => {
    const op = done("op", {
      title: "Foxtide rebuild",
      type: "operation",
      actualDuration: 400,
      timeLogs: [
        { id: "1", date: "2026-09-01", durationMinutes: 20 },
        { id: "2", date: "2026-09-02", durationMinutes: 40 },
        { id: "3", date: "2026-09-03", durationMinutes: 60 },
      ],
    })
    const usual = usualDurationMinutes([op], { id: "op", title: "Foxtide rebuild", type: "operation" })
    expect(usual).toMatchObject({ minutes: 40, sampleCount: 3, match: "title" })
  })

  it("skips the probe's own actualDuration so this instance is not its own usual", () => {
    const usual = usualDurationMinutes(
      [
        done("now", { actualDuration: 999 }),
        done("a", { actualDuration: 25 }),
        done("b", { actualDuration: 35 }),
      ],
      like,
    )
    expect(usual?.minutes).toBe(30)
  })

  it("falls back to the same named item type when titles differ", () => {
    const usual = usualDurationMinutes(
      [
        done("a", { title: "Alpha", type: "operation", actualDuration: 20 }),
        done("b", { title: "Beta", type: "operation", actualDuration: 40 }),
      ],
      { id: "now", title: "Gamma", type: "operation" },
    )
    expect(usual).toMatchObject({ minutes: 30, sampleCount: 2, match: "type" })
    expect(usual!.basis).toContain("operation")
  })

  it("does not treat generic task/item types as a pool", () => {
    expect(
      usualDurationMinutes(
        [done("a", { title: "One", type: "task", actualDuration: 20 }), done("b", { title: "Two", type: "task", actualDuration: 40 })],
        { id: "now", title: "Three", type: "task" },
      ),
    ).toBeNull()
  })
})
