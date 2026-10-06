import { beforeEach, describe, expect, it } from "vitest"
import { DEFAULT_HOME_CITY, useUserSettingsStore } from "./user-settings-store"

describe("user-settings-store", () => {
  beforeEach(() => {
    localStorage.clear()
    useUserSettingsStore.getState().resetHomeLocation()
    useUserSettingsStore.getState().setBirthday("")
  })

  it("defaults home location to San Diego", () => {
    expect(useUserSettingsStore.getState().homeCity).toBe(DEFAULT_HOME_CITY)
    expect(DEFAULT_HOME_CITY).toMatch(/San Diego/i)
  })

  it("defaults ritual points and the goal-focus multiplier", () => {
    const state = useUserSettingsStore.getState()
    expect(state.ritualSectionPoints).toBe(10)
    expect(state.ritualCompletionBonus).toBe(30)
    expect(state.goalFocusMultiplier).toBe(1.5)
    state.setRitualSectionPoints(4)
    state.setRitualCompletionBonus(7)
    state.setGoalFocusMultiplier(2)
    expect(useUserSettingsStore.getState().ritualSectionPoints).toBe(4)
    expect(useUserSettingsStore.getState().ritualCompletionBonus).toBe(7)
    expect(useUserSettingsStore.getState().goalFocusMultiplier).toBe(2)
    state.setRitualSectionPoints(10)
    state.setRitualCompletionBonus(30)
    state.setGoalFocusMultiplier(1.5)
  })

  it("falls back to San Diego when cleared", () => {
    useUserSettingsStore.getState().setHomeCity("Lisbon, Portugal")
    expect(useUserSettingsStore.getState().homeCity).toBe("Lisbon, Portugal")
    useUserSettingsStore.getState().setHomeCity("   ")
    expect(useUserSettingsStore.getState().homeCity).toBe(DEFAULT_HOME_CITY)
  })

  it("stores a birthday as a date and clears it", () => {
    useUserSettingsStore.getState().setBirthday("1996-02-29")
    expect(useUserSettingsStore.getState().birthday).toBe("1996-02-29")
    useUserSettingsStore.getState().setBirthday("not-a-date")
    expect(useUserSettingsStore.getState().birthday).toBe("1996-02-29")
    useUserSettingsStore.getState().setBirthday("")
    expect(useUserSettingsStore.getState().birthday).toBe("")
  })
})
