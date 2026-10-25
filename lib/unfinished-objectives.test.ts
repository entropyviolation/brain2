import { describe, expect, it } from "vitest"
import type { NowObjective } from "./now-objective"
import {
  homeForObjective,
  mergeResumed,
  resumeParked,
  sameUnfinishedHome,
  toParked,
  type ParkedObjective,
} from "./unfinished-objectives"

const AT = new Date(2026, 9, 10, 8, 0, 0)

const row: NowObjective = {
  id: "n1",
  text: "finish the nest",
  addedAt: "2026-10-03T15:00:00.000Z",
  workedMs: 0,
  stintStartedAt: AT.toISOString(),
}

describe("unfinished objectives", () => {
  it("parks without the open stint and resumes with the original created time", () => {
    const home = homeForObjective(row, { taskId: "task-1", stepId: "step-1" })
    expect(home).toEqual({ kind: "step", taskId: "task-1", stepId: "step-1" })
    const parked = toParked(row, home!)
    expect(parked?.workedMs).toBe(0)
    expect(parked?.addedAt).toBe(row.addedAt)

    const later = new Date(AT.getTime() + 7 * 24 * 60 * 60_000)
    const resumed = resumeParked(parked!, later)
    expect(resumed.addedAt).toBe(row.addedAt)
    expect(resumed.stintStartedAt).toBe(later.toISOString())
    expect(resumed.workedMs).toBe(0)
    expect(resumed.completedAt).toBeUndefined()
  })

  it("does not resume an id already on the list", () => {
    const parked: ParkedObjective = {
      id: "n1",
      text: "finish the nest",
      addedAt: row.addedAt,
      workedMs: 3_600_000,
      home: { kind: "pen", scopeId: "activity", penId: "act-work" },
    }
    expect(mergeResumed([row], [parked], AT)).toEqual([row])
    expect(mergeResumed(undefined, [parked], AT)).toHaveLength(1)
  })

  it("treats an attached task as its own home", () => {
    const attached = homeForObjective({ ...row, taskId: "other" }, { taskId: "clock", stepId: "step" })
    const clock = homeForObjective(row, { taskId: "clock", stepId: "step" })
    expect(sameUnfinishedHome(attached!, clock!)).toBe(false)
    expect(attached).toEqual({ kind: "task", taskId: "other" })
  })
})
