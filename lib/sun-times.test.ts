import { describe, expect, it } from "vitest"
import { computeDaySun, SAN_DIEGO_COORDS, sunCacheKey } from "./sun-times"

describe("sun times", () => {
  it("keys the cache by calendar day and pin", () => {
    expect(sunCacheKey("2026-09-14", 32.7157, -117.1611)).toBe("2026-09-14|32.7157|-117.1611")
    expect(sunCacheKey("2026-09-14", 32.71571, -117.16109)).toBe("2026-09-14|32.7157|-117.1611")
    expect(sunCacheKey("2026-09-21", 32.7157, -117.1611)).not.toBe(
      sunCacheKey("2026-09-14", 32.7157, -117.1611),
    )
  })

  it("gives different clocks on two dates unless astronomy says they match", () => {
    const sep14 = computeDaySun("2026-09-14", SAN_DIEGO_COORDS.lat, SAN_DIEGO_COORDS.lng)
    const sep21 = computeDaySun("2026-09-21", SAN_DIEGO_COORDS.lat, SAN_DIEGO_COORDS.lng)
    const jun21 = computeDaySun("2026-06-21", SAN_DIEGO_COORDS.lat, SAN_DIEGO_COORDS.lng)
    expect(sep14).toBeTruthy()
    expect(sep21).toBeTruthy()
    expect(jun21).toBeTruthy()
    expect(sep14!.date).toBe("2026-09-14")
    expect(sep21!.date).toBe("2026-09-21")
    const sameSep =
      sep14!.sunriseMinutes === sep21!.sunriseMinutes && sep14!.sunsetMinutes === sep21!.sunsetMinutes
    const sameVsJune =
      sep14!.sunriseMinutes === jun21!.sunriseMinutes && sep14!.sunsetMinutes === jun21!.sunsetMinutes
    expect(sameSep && sameVsJune).toBe(false)
    expect(sep14!.sunriseMinutes).toBeGreaterThan(4 * 60)
    expect(sep14!.sunriseMinutes).toBeLessThan(8 * 60)
    expect(sep14!.sunsetMinutes).toBeGreaterThan(16 * 60)
    expect(sep14!.sunsetMinutes).toBeLessThan(21 * 60)
  })
})
