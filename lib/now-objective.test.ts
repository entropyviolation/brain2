import { describe, expect, it } from "vitest"
import {
  activeNowObjectives,
  addCompletedNowObjective,
  addNowObjective,
  compactNowObjectives,
  editNowObjectiveText,
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
    expect(compactNowObjectives([])).toBeUndefined()
    expect(compactNowObjectives(undefined)).toBeUndefined()
    expect(compactNowObjectives([{ id: "1", text: "  hi  ", addedAt: AT.toISOString() }])).toEqual([
      { id: "1", text: "hi", addedAt: AT.toISOString() },
    ])
  })

  it("banks a stint, and an unknown start has no duration", () => {
    const list = addNowObjective(undefined, "draft", AT)
    const doneAt = new Date(AT.getTime() + 60_000)
    const completed = toggleNowObjectiveComplete(list, list[0].id, doneAt)
    expect(completed[0].workedMs).toBe(60_000)
    expect(completed[0].stintStartedAt).toBeUndefined()

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
})
