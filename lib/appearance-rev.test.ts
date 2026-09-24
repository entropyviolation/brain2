import { describe, expect, it } from "vitest"
import { nextAppearanceRev } from "./appearance-rev"

describe("nextAppearanceRev", () => {
  it("beats a small counter from an earlier launch", () => {
    expect(nextAppearanceRev(6)).toBeGreaterThan(6)
    expect(nextAppearanceRev(0)).toBeGreaterThanOrEqual(Date.now() - 1000)
    expect(nextAppearanceRev(undefined)).toBeGreaterThan(0)
  })

  it("keeps rising when two picks land in the same millisecond", () => {
    const first = nextAppearanceRev(0)
    const second = nextAppearanceRev(first)
    const third = nextAppearanceRev(second)
    expect(second).toBeGreaterThan(first)
    expect(third).toBeGreaterThan(second)
  })

  it("never returns a stamp below a future-dated snapshot", () => {
    const ahead = Date.now() + 60_000
    expect(nextAppearanceRev(ahead)).toBeGreaterThan(ahead)
  })
})
