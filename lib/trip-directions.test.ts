import { describe, it, expect } from "vitest"
import {
  formatDuration,
  walkingDurationSeconds,
  WALKING_SPEED_MPS,
} from "./trip-directions"

describe("walkingDurationSeconds", () => {
  it("uses ~5 km/h so 10 km is about 2 hours", () => {
    const secs = walkingDurationSeconds(10_000)
    expect(secs).toBeCloseTo(10_000 / WALKING_SPEED_MPS, 5)
    expect(formatDuration(secs)).toBe("2h")
  })

  it("does not treat road distance as car time (regression)", () => {
    // OSRM public demo returned ~15 min for ~10 km — that is car speed.
    const secs = walkingDurationSeconds(9959)
    const minutes = secs / 60
    expect(minutes).toBeGreaterThan(90)
    expect(minutes).toBeLessThan(150)
  })

  it("returns 0 for invalid distances", () => {
    expect(walkingDurationSeconds(0)).toBe(0)
    expect(walkingDurationSeconds(-1)).toBe(0)
    expect(walkingDurationSeconds(Number.NaN)).toBe(0)
  })
})
