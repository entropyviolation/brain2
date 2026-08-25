import { beforeEach, describe, expect, it } from "vitest"
import { DEFAULT_HOME_CITY, useUserSettingsStore } from "./user-settings-store"

describe("user-settings-store", () => {
  beforeEach(() => {
    localStorage.clear()
    useUserSettingsStore.getState().resetHomeLocation()
  })

  it("defaults home location to San Diego", () => {
    expect(useUserSettingsStore.getState().homeCity).toBe(DEFAULT_HOME_CITY)
    expect(DEFAULT_HOME_CITY).toMatch(/San Diego/i)
  })

  it("falls back to San Diego when cleared", () => {
    useUserSettingsStore.getState().setHomeCity("Lisbon, Portugal")
    expect(useUserSettingsStore.getState().homeCity).toBe("Lisbon, Portugal")
    useUserSettingsStore.getState().setHomeCity("   ")
    expect(useUserSettingsStore.getState().homeCity).toBe(DEFAULT_HOME_CITY)
  })
})
