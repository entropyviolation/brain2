import { afterEach, beforeEach, describe, expect, it } from "vitest"
import {
  DEFAULT_TODO_PREFS,
  DEFAULT_WIP_LIMIT,
  TODO_PREFS_KEY,
  clampWipLimit,
  getTodoPrefs,
  resetTodoPrefsForTests,
  setTodoPrefs,
} from "./todo-prefs"

describe("todo-prefs", () => {
  beforeEach(() => {
    localStorage.clear()
    resetTodoPrefsForTests()
  })

  afterEach(() => {
    localStorage.clear()
    resetTodoPrefsForTests()
  })

  it("defaults available-now off and WIP cap 3", () => {
    expect(getTodoPrefs()).toEqual(DEFAULT_TODO_PREFS)
    expect(DEFAULT_WIP_LIMIT).toBe(3)
  })

  it("persists available-now and clamps the WIP cap", () => {
    setTodoPrefs({ availableNow: true, wipLimit: 0 })
    expect(getTodoPrefs()).toEqual({ availableNow: true, wipLimit: 1 })
    expect(JSON.parse(localStorage.getItem(TODO_PREFS_KEY) ?? "{}")).toMatchObject({
      availableNow: true,
      wipLimit: 1,
    })
  })

  it("clampWipLimit falls back to 3 for junk", () => {
    expect(clampWipLimit("nope")).toBe(3)
    expect(clampWipLimit(12.4)).toBe(12)
    expect(clampWipLimit(400)).toBe(99)
  })
})
