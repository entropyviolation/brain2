/**
 * lib/morning-todo-walk.test.ts — Six-slot grammar + apply
 */
import { describe, expect, it } from "vitest"
import type { Task } from "@/lib/types"
import {
  applyTodoWalkSlots,
  formToTodoWalkReply,
  parseTodoWalkReply,
  emptyTodoWalkForm,
} from "./morning-todo-walk"

function task(partial: Partial<Task> = {}): Task {
  return {
    id: "t1",
    description: "take out trash",
    type: "task",
    stage: "scheduled",
    createdAt: new Date(),
    completed: false,
    lists: [],
    urgency: 3,
    importance: 3,
    estimatedDuration: 10,
    rewardValue: 30,
    ...partial,
  } as Task
}

describe("parseTodoWalkReply", () => {
  it("parses the take-out-trash example", () => {
    const r = parseTodoWalkReply("A+ - 40 - 10 0")
    expect(r).toEqual({
      ok: true,
      slots: {
        tier: "A+",
        duration: null,
        points: 40,
        importance: null,
        resistance: 10,
        excitement: 0,
      },
    })
  })

  it("rejects wrong slot counts", () => {
    const r = parseTodoWalkReply("A+ 10 40")
    expect(r.ok).toBe(false)
  })
})

describe("applyTodoWalkSlots", () => {
  it("keeps duration and does not create importance on dash", () => {
    const before = task()
    const parsed = parseTodoWalkReply("A+ - 40 - 10 0")
    expect(parsed.ok).toBe(true)
    if (!parsed.ok) return
    const after = applyTodoWalkSlots(before, parsed.slots, "2026-09-23", new Date("2026-09-23T15:00:00Z"), "morning-telegram")
    expect(after.estimatedDuration).toBe(10)
    expect(after.rewardValue).toBe(40)
    expect(after.urgency).toBe(5)
    expect(after.importance).toBe(5)
    expect(after.dayRatings?.["2026-09-23"]?.importance).toBeUndefined()
    expect(after.dayRatings?.["2026-09-23"]?.excitement).toBe(0)
    expect(after.resistanceReadings).toHaveLength(1)
    expect(after.resistanceReadings![0]).toMatchObject({ value: 10, source: "morning-telegram" })
  })

  it("appends resistance instead of overwriting", () => {
    const before = task({
      resistanceReadings: [{ at: "2026-09-01T12:00:00Z", value: 4, source: "morning-desktop" }],
    })
    const parsed = parseTodoWalkReply("- - - - 8 -")
    expect(parsed.ok).toBe(true)
    if (!parsed.ok) return
    const after = applyTodoWalkSlots(before, parsed.slots, "2026-09-23", new Date("2026-09-23T15:00:00Z"), "morning-desktop")
    expect(after.resistanceReadings).toHaveLength(2)
    expect(after.resistanceReadings!.map((r) => r.value)).toEqual([4, 8])
  })
})

describe("formToTodoWalkReply", () => {
  it("maps blanks to dashes and skip for empty forms", () => {
    expect(formToTodoWalkReply(emptyTodoWalkForm())).toBe("skip")
    expect(
      formToTodoWalkReply({
        ...emptyTodoWalkForm(),
        tier: "A+",
        points: "40",
        resistance: "10",
        excitement: "0",
      }),
    ).toBe("A+ - 40 - 10 0")
  })
})
