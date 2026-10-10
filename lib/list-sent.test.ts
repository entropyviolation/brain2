/**
 * lib/list-sent.test.ts — One sent/total ratio, grace, and the weekly clear.
 */
import { describe, expect, it } from "vitest"
import { readingsFromCell, trustedOutcome } from "./habit-completion-trust"
import {
  applyListLengthCount,
  applyListSentPercent,
  currentPeriodRange,
  listSentCompletion,
  membershipAfterWeeklySentClear,
  reportedListSentPercent,
} from "./list-sent"
import { TaskType, type WeeklyTask } from "./types"

/** Tuesday 6 Oct 2026. The week is Monday 5 Oct through Monday 12 Oct. */
const NOW = new Date(2026, 9, 6, 15, 0, 0)

function at(year: number, month: number, day: number, hour = 15): string {
  return new Date(year, month, day, hour, 0, 0).toISOString()
}

const onList = (sentAt?: string) => ({
  lists: ["texts"],
  sentAtByList: sentAt ? { texts: sentAt } : undefined,
})

describe("list sent completion", () => {
  const range = currentPeriodRange("weekly", NOW)

  it("counts 8 sent and 5 still unsent as 8/13", () => {
    const items = [
      ...Array.from({ length: 8 }, () => onList(at(2026, 9, 6))),
      ...Array.from({ length: 5 }, () => onList()),
    ]
    const counts = listSentCompletion(items, "texts", range)
    expect(counts.sent).toBe(8)
    expect(counts.unsent).toBe(5)
    expect(counts.total).toBe(13)
    expect(counts.rawPercent).toBeCloseTo((8 / 13) * 100)
  })

  it("leaves a sent item from last week out of this week's total", () => {
    const items = [
      ...Array.from({ length: 8 }, () => onList(at(2026, 9, 6))),
      ...Array.from({ length: 5 }, () => onList()),
      onList(at(2026, 8, 30)),
    ]
    const counts = listSentCompletion(items, "texts", range)
    expect(counts.sent).toBe(8)
    expect(counts.total).toBe(13)

    const onlyLastWeek = listSentCompletion([onList(at(2026, 8, 30))], "texts", range)
    expect(onlyLastWeek.sent).toBe(0)
    expect(onlyLastWeek.unsent).toBe(0)
    expect(onlyLastWeek.total).toBe(0)
    expect(onlyLastWeek.rawPercent).toBe(0)
  })

  it("turns grace 80 into 100 at raw 80 and 50 at raw 40", () => {
    expect(reportedListSentPercent(80, 80)).toBe(100)
    expect(reportedListSentPercent(40, 80)).toBe(50)
    expect(reportedListSentPercent(80, 100)).toBe(80)
    expect(reportedListSentPercent(0, 100)).toBe(0)
  })

  it("uses the same ratio for a month range", () => {
    const month = currentPeriodRange("monthly", NOW)
    const items = [onList(at(2026, 9, 2)), onList(at(2026, 9, 6)), onList()]
    const counts = listSentCompletion(items, "texts", month)
    expect(counts.sent).toBe(2)
    expect(counts.unsent).toBe(1)
    expect(counts.total).toBe(3)
  })
})

describe("weekly sent clear", () => {
  const lists = new Set(["texts"])

  it("takes last week's sent item off the list and leaves unsent and this week's send", () => {
    const people = [
      { id: "ruggles", lists: ["texts"] },
      { id: "sent-now", lists: ["texts"], sentAtByList: { texts: at(2026, 9, 6) } },
      { id: "sent-then", lists: ["texts", "other"], sentAtByList: { texts: at(2026, 8, 30) } },
    ]
    const next = membershipAfterWeeklySentClear(people, lists, NOW)
    expect(next.find((item) => item.id === "ruggles")?.lists).toEqual(["texts"])
    expect(next.find((item) => item.id === "sent-now")?.lists).toEqual(["texts"])
    const cleared = next.find((item) => item.id === "sent-then")
    expect(cleared?.lists).toEqual(["other"])
    expect(cleared?.sentAtByList?.texts).toBe(at(2026, 8, 30))
    expect(next.map((item) => item.id)).toEqual(["ruggles", "sent-now", "sent-then"])
  })
})

describe("applyListSentPercent", () => {
  const habit: WeeklyTask = {
    id: "texts-habit",
    name: "respond to all missing texts ",
    type: TaskType.GOAL,
    goal: 100,
    frequency: "weekly",
    completionSources: ["manual", "listSent"],
    listSentLink: { listId: "texts", grace: 100 },
  }

  it("stores the reported percent, and a hand-typed cell keeps its number", () => {
    const written = applyListSentPercent(habit, undefined, reportedListSentPercent((8 / 13) * 100, 100))
    expect(written?.value).toBeCloseTo((8 / 13) * 100)
    expect(written?.listSentPercent).toBeCloseTo((8 / 13) * 100)
    expect(written?.goal).toBe(100)

    const handed = applyListSentPercent(
      habit,
      { value: 10, manualValue: 10, handCompleted: false },
      100,
    )
    expect(handed?.value).toBe(10)
    expect(handed?.manualValue).toBe(10)
    expect(handed?.listSentPercent).toBe(100)

    const readings = readingsFromCell(habit.completionSources!, handed!, 100)
    expect(trustedOutcome(habit.completionSources!, readings).winner).toBe("manual")
  })

  it("stores the list count and the list length, and grace stays a percent", () => {
    const written = applyListLengthCount(undefined, 1, 5, reportedListSentPercent(20, 100))
    expect(written).toEqual({ value: 1, goal: 5, listSentPercent: 20 })
    const kept = applyListLengthCount(
      { value: 3, manualValue: 3, handCompleted: false },
      1,
      5,
      20,
    )
    expect(kept?.value).toBe(3)
    expect(kept?.manualValue).toBe(3)
    expect(kept?.goal).toBe(5)
    expect(kept?.listSentPercent).toBe(20)
    const readings = readingsFromCell(habit.completionSources!, written!, habit.goal, 100)
    expect(readings.listSent?.state).toBe("unmet")
  })
})
