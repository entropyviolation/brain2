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
    expect(getTodoPrefs()).toEqual({ availableNow: true, wipLimit: 1, lidCollapsed: { flags: false, time: false, steps: false }, ritesFollowSun: true, defaultEstimateMin: 30, paceOverrides: {}, paceGhosts: true })
    expect(JSON.parse(localStorage.getItem(TODO_PREFS_KEY) ?? "{}")).toMatchObject({
      availableNow: true,
      wipLimit: 1,
    })
  })

  it("keeps a default estimate of 30, clamps it, and lets 0 mean none", () => {
    expect(getTodoPrefs().defaultEstimateMin).toBe(30)
    setTodoPrefs({ defaultEstimateMin: 45.4 })
    expect(getTodoPrefs().defaultEstimateMin).toBe(45)
    setTodoPrefs({ defaultEstimateMin: -5 })
    expect(getTodoPrefs().defaultEstimateMin).toBe(0)
    setTodoPrefs({ defaultEstimateMin: 9999 })
    expect(getTodoPrefs().defaultEstimateMin).toBe(600)
    resetTodoPrefsForTests()
    expect(getTodoPrefs().defaultEstimateMin).toBe(600)
  })

  it("remembers which open-lid sections are collapsed", () => {
    setTodoPrefs({ lidCollapsed: { flags: true } })
    expect(getTodoPrefs().lidCollapsed).toEqual({ flags: true, time: false, steps: false })
    setTodoPrefs({ lidCollapsed: { steps: true } })
    expect(getTodoPrefs().lidCollapsed).toEqual({ flags: true, time: false, steps: true })
  })

  it("rites follow the sun by default and can be turned off", () => {
    expect(getTodoPrefs().ritesFollowSun).toBe(true)
    setTodoPrefs({ ritesFollowSun: false })
    expect(getTodoPrefs().ritesFollowSun).toBe(false)
    expect(JSON.parse(localStorage.getItem(TODO_PREFS_KEY) ?? "{}").ritesFollowSun).toBe(false)
  })

  it("pace overrides keep only sane numbers, and ghosts can be turned off", () => {
    setTodoPrefs({ paceOverrides: { overall: 2, "pen:a": -1, "pen:b": 9 } as Record<string, number> })
    expect(getTodoPrefs().paceOverrides).toEqual({ overall: 2, "pen:b": 4 })
    setTodoPrefs({ paceGhosts: false })
    expect(getTodoPrefs().paceGhosts).toBe(false)
    expect(getTodoPrefs().paceOverrides).toEqual({ overall: 2, "pen:b": 4 })
  })

  it("clampWipLimit falls back to 3 for junk", () => {
    expect(clampWipLimit("nope")).toBe(3)
    expect(clampWipLimit(12.4)).toBe(12)
    expect(clampWipLimit(400)).toBe(99)
  })
})
