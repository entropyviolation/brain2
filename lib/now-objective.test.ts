import { describe, expect, it } from "vitest"
import {
  activeNowObjectives,
  addCompletedNowObjective,
  addNowObjective,
  compactNowObjectives,
  editNowObjectiveText,
  formatObjectiveWhen,
  moveNowObjectiveToNext,
  moveNowObjectiveToNow,
  objectiveWorkedMs,
  removeNowObjective,
  sameNowObjectives,
  toggleNowObjectiveComplete,
  type NowObjective,
} from "./now-objective"

const AT = new Date(2026, 9, 10, 5, 30, 0)

describe("now-objective", () => {
  it("adds multiple active objectives", () => {
    let list = addNowObjective(undefined, "ship the nest", AT)
    list = addNowObjective(list, "write the test", new Date(AT.getTime() + 1000))
    expect(list).toHaveLength(2)
    expect(activeNowObjectives(list)).toHaveLength(2)
    expect(list[0].text).toBe("ship the nest")
    expect(list[0].addedAt).toBe(AT.toISOString())
    expect(list[0].lane).toBe("next")
    expect(list[0].stintStartedAt).toBeUndefined()
    expect(list[0].completedAt).toBeUndefined()
  })

  it("ignores blank add", () => {
    expect(addNowObjective(undefined, "   ", AT)).toEqual([])
  })

  it("edits text in place; compact drops blank rows", () => {
    const list = addNowObjective(undefined, "draft", AT)
    const id = list[0].id
    expect(editNowObjectiveText(list, id, "  revise  ")[0].text).toBe("  revise  ")
    expect(compactNowObjectives(editNowObjectiveText(list, id, "   "))).toBeUndefined()
  })

  it("marks complete and reopens", () => {
    const list = addNowObjective(undefined, "done soon", AT)
    const id = list[0].id
    const doneAt = new Date(AT.getTime() + 60_000)
    const completed = toggleNowObjectiveComplete(list, id, doneAt)
    expect(completed[0].completedAt).toBe(doneAt.toISOString())
    expect(activeNowObjectives(completed)).toHaveLength(0)
    const reopened = toggleNowObjectiveComplete(completed, id, new Date(doneAt.getTime() + 1000))
    expect(reopened[0].completedAt).toBeUndefined()
    expect(activeNowObjectives(reopened)).toHaveLength(1)
  })

  it("removes by id", () => {
    let list = addNowObjective(undefined, "a", AT)
    list = addNowObjective(list, "b", AT)
    expect(removeNowObjective(list, list[0].id).map((r) => r.text)).toEqual(["b"])
  })

  it("compares and compacts lists", () => {
    const a: NowObjective[] = [{ id: "1", text: "x", addedAt: AT.toISOString() }]
    expect(sameNowObjectives(a, a)).toBe(true)
    expect(sameNowObjectives(a, [{ ...a[0], text: "y" }])).toBe(false)
    expect(sameNowObjectives(a, [{ ...a[0], lane: "next" }])).toBe(false)
    expect(compactNowObjectives([])).toBeUndefined()
    expect(compactNowObjectives(undefined)).toBeUndefined()
    expect(compactNowObjectives([{ id: "1", text: "  hi  ", addedAt: AT.toISOString() }])).toEqual([
      { id: "1", text: "hi", addedAt: AT.toISOString() },
    ])
  })

  it("banks a stint, and an unknown start has no duration", () => {
    const list = addNowObjective(undefined, "draft", AT, { lane: "now" })
    const doneAt = new Date(AT.getTime() + 60_000)
    const completed = toggleNowObjectiveComplete(list, list[0].id, doneAt)
    expect(completed[0].workedMs).toBe(60_000)
    expect(completed[0].stintStartedAt).toBe(AT.toISOString())
    expect(completed[0].lane).toBeUndefined()

    const parkedGap = {
      ...completed[0],
      workedMs: 60_000,
      addedAt: new Date(AT.getTime() - 7 * 24 * 60 * 60_000).toISOString(),
    }
    expect(objectiveWorkedMs(parkedGap)).toBe(60_000)

    const logged = addCompletedNowObjective(undefined, "already", AT, doneAt)
    expect(logged[0].startUnknown).toBe(true)
    expect(logged[0].addedAt).toBe(AT.toISOString())
    expect(logged[0].completedAt).toBe(doneAt.toISOString())
    expect(objectiveWorkedMs(logged[0])).toBeUndefined()
  })

  it("walks Delete all junk mail through Next and Now", () => {
    const clock = (iso: string) => {
      const date = new Date(iso)
      const hour24 = date.getHours()
      const hour = hour24 % 12 || 12
      const minute = String(date.getMinutes()).padStart(2, "0")
      const suffix = hour24 >= 12 ? "PM" : "AM"
      return `${hour}:${minute} ${suffix}`
    }
    const at = (hour: number, minute: number) => new Date(2026, 9, 27, hour, minute, 0, 0)
    const one = at(13, 0)
    const five = at(13, 5)
    const ten = at(13, 10)
    const thirty = at(13, 30)
    const thirtyFive = at(13, 35)

    let list = addNowObjective(undefined, "Delete all junk mail", one, { lane: "next" })
    expect(list[0]).toMatchObject({ addedAt: one.toISOString(), lane: "next" })
    expect(list[0].stintStartedAt).toBeUndefined()

    list = moveNowObjectiveToNow(list, list[0].id, five)
    expect(list[0]).toMatchObject({ lane: "now", stintStartedAt: five.toISOString() })

    list = moveNowObjectiveToNext(list, list[0].id, ten)
    expect(list[0]).toMatchObject({ lane: "next", workedMs: 5 * 60_000 })
    expect(list[0].stintStartedAt).toBeUndefined()

    list = moveNowObjectiveToNow(list, list[0].id, thirty)
    expect(list[0].stintStartedAt).toBe(thirty.toISOString())
    expect(list[0].workedMs).toBe(5 * 60_000)
    const open = formatObjectiveWhen(list[0], thirtyFive, clock)
    expect(open).toContain("past 5m")
    expect(open).toContain("working on since")
    expect(open).toBe("added 1:00 PM past 5m working on since 1:30 PM")

    const done = toggleNowObjectiveComplete(list, list[0].id, thirtyFive)
    expect(done[0].stintStartedAt).toBe(thirty.toISOString())
    expect(done[0].workedMs).toBe(10 * 60_000)
    expect(done[0].completedAt).toBe(thirtyFive.toISOString())
    expect(done[0].lane).toBeUndefined()
    expect(objectiveWorkedMs(done[0], thirtyFive)).toBe(10 * 60_000)
    expect(formatObjectiveWhen(done[0], thirtyFive, clock)).toBe("1:00 PM → 1:30 PM · 10m")

    const straight = addNowObjective(undefined, "straight", thirtyFive, { lane: "now" })
    expect(straight[0].stintStartedAt).toBe(straight[0].addedAt)

    const legacy = {
      id: "old",
      text: "old",
      addedAt: one.toISOString(),
      completedAt: thirtyFive.toISOString(),
    }
    expect(objectiveWorkedMs(legacy)).toBe(thirtyFive.getTime() - one.getTime())
    expect(formatObjectiveWhen(legacy, thirtyFive, clock)).toBe("1:00 PM → 1:35 PM · 35m")
  })
})
