import { describe, expect, it } from "vitest"
import { applyHabitAutoFlag } from "./habit-auto-flag"
import { applyAutoFlag } from "./habit-connections"
import { applyLinkedFlag } from "./habit-completion-source"
import type { TaskCompletion } from "./types"

/** Key set + values must match (absent ≠ false). */
function shape(cell: TaskCompletion | null) {
  if (!cell) return null
  return Object.fromEntries(
    Object.entries(cell).sort(([a], [b]) => a.localeCompare(b)),
  )
}

describe("applyHabitAutoFlag", () => {
  it("returns null when the log is silent and there is no cell", () => {
    expect(applyHabitAutoFlag(undefined, "sleepCompleted", false)).toBeNull()
    expect(applyHabitAutoFlag(undefined, "coverageCompleted", false)).toBeNull()
  })

  it("keeps a hand tick when auto clears", () => {
    expect(applyHabitAutoFlag({ completed: true }, "sleepCompleted", false)).toBeNull()
    expect(applyHabitAutoFlag({ completed: true }, "coverageCompleted", false)).toBeNull()
  })

  it("sets sleep without inventing sibling auto keys", () => {
    expect(shape(applyHabitAutoFlag(undefined, "sleepCompleted", true))).toEqual({
      completed: true,
      sleepCompleted: true,
    })
  })

  it("leaves unrelated auto keys present or absent (including explicit false)", () => {
    const prev: TaskCompletion = {
      completed: true,
      sleepCompleted: true,
      coverageCompleted: false,
      trackedCompleted: true,
    }
    const next = applyHabitAutoFlag(prev, "listCompleted", true)
    expect(shape(next)).toEqual({
      completed: true,
      coverageCompleted: false,
      listCompleted: true,
      sleepCompleted: true,
      trackedCompleted: true,
    })
  })

  it("coverage extras write value/goal and null when unchanged", () => {
    const next = applyHabitAutoFlag(undefined, "coverageCompleted", true, { value: 82, goal: 75 })
    expect(shape(next)).toEqual({
      completed: true,
      coverageCompleted: true,
      goal: 75,
      value: 82,
    })
    expect(applyHabitAutoFlag(next!, "coverageCompleted", true, { value: 82, goal: 75 })).toBeNull()
  })

  it("clears coverageCompleted without dropping sleepCompleted", () => {
    const prev: TaskCompletion = {
      completed: true,
      coverageCompleted: true,
      sleepCompleted: true,
      value: 80,
      goal: 75,
    }
    expect(shape(applyHabitAutoFlag(prev, "coverageCompleted", false))).toEqual({
      completed: true,
      goal: 75,
      sleepCompleted: true,
      value: 80,
    })
  })

  it("wrappers match the shared helper for every prior call shape", () => {
    const cases: Array<{
      cell: TaskCompletion | undefined
      sleep?: "sleepCompleted" | "listCompleted"
      linked?: "coverageCompleted" | "dailyFloorCompleted"
      met: boolean
      extras?: { value?: number; goal?: number }
    }> = [
      { cell: undefined, sleep: "listCompleted", met: true },
      { cell: { completed: true }, sleep: "sleepCompleted", met: false },
      { cell: { completed: true, listCompleted: true }, sleep: "listCompleted", met: false },
      { cell: undefined, linked: "coverageCompleted", met: true, extras: { value: 82, goal: 75 } },
      {
        cell: { completed: true, coverageCompleted: true, value: 82, goal: 75 },
        linked: "coverageCompleted",
        met: true,
        extras: { value: 82, goal: 75 },
      },
      { cell: { completed: true, dailyFloorCompleted: true }, linked: "dailyFloorCompleted", met: false },
      {
        cell: { completed: true, sleepCompleted: true, coverageCompleted: false },
        sleep: "sleepCompleted",
        met: false,
      },
    ]
    for (const row of cases) {
      if (row.sleep) {
        expect(shape(applyAutoFlag(row.cell, row.sleep, row.met))).toEqual(
          shape(applyHabitAutoFlag(row.cell, row.sleep, row.met)),
        )
      }
      if (row.linked) {
        expect(shape(applyLinkedFlag(row.cell, row.linked, row.met, row.extras))).toEqual(
          shape(applyHabitAutoFlag(row.cell, row.linked, row.met, row.extras)),
        )
      }
    }
  })
})
