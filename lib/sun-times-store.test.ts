import { beforeEach, describe, expect, it } from "vitest"
import { computeDaySun, SAN_DIEGO_COORDS, sunCacheKey } from "./sun-times"
import { peekOrComputeDaySun, peekStoredSun, useSunTimesStore } from "./sun-times-store"

const PIN = SAN_DIEGO_COORDS

beforeEach(() => {
  useSunTimesStore.getState().resetSunTimes()
})

describe("sun times store", () => {
  it("computes a miss and remembers it", () => {
    const computed = computeDaySun("2026-09-14", PIN.lat, PIN.lng)!
    const first = peekOrComputeDaySun("2026-09-14", PIN.lat, PIN.lng, useSunTimesStore.getState())
    expect(first).toEqual(computed)
    useSunTimesStore.getState().rememberIfAbsent(first!)
    const key = sunCacheKey("2026-09-14", PIN.lat, PIN.lng)
    expect(useSunTimesStore.getState().days[key]).toEqual(computed)
  })

  it("hits the cache on a second lookup and does not overwrite", () => {
    const a = computeDaySun("2026-09-14", PIN.lat, PIN.lng)!
    useSunTimesStore.getState().rememberIfAbsent(a)
    const forged = { ...a, sunriseMinutes: 1, sunriseLabel: "12:01 AM", sunriseHhmm: "00:01" }
    const kept = useSunTimesStore.getState().rememberIfAbsent(forged)
    expect(kept.sunriseMinutes).toBe(a.sunriseMinutes)
    const hit = peekStoredSun(
      useSunTimesStore.getState().days,
      useSunTimesStore.getState().firstKeyByDate,
      "2026-09-14",
      PIN.lat,
      PIN.lng,
    )
    expect(hit?.sunriseMinutes).toBe(a.sunriseMinutes)
  })

  it("keeps a historical day when a later pin tries to write the same date", () => {
    const home = computeDaySun("2026-09-14", PIN.lat, PIN.lng)!
    useSunTimesStore.getState().rememberIfAbsent(home)
    const tokyo = computeDaySun("2026-09-14", 35.6762, 139.6503)!
    const kept = useSunTimesStore.getState().rememberIfAbsent(tokyo)
    expect(kept.lat).toBe(home.lat)
    expect(kept.sunriseMinutes).toBe(home.sunriseMinutes)
    const peek = peekStoredSun(
      useSunTimesStore.getState().days,
      useSunTimesStore.getState().firstKeyByDate,
      "2026-09-14",
      35.6762,
      139.6503,
    )
    expect(peek?.sunriseMinutes).toBe(home.sunriseMinutes)
  })
})
