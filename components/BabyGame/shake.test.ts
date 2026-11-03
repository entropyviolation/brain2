import { describe, expect, it } from "vitest"
import { Shake } from "./shake"

describe("Shake", () => {
  it("is still until kicked, shakes in whole pixels, and settles to zero", () => {
    const s = new Shake()
    expect(s.offset(1)).toEqual({ x: 0, y: 0 })
    s.kick(1, 3)
    let moved = false
    for (let t = 1; t < 1.3; t += 1 / 60) {
      const o = s.offset(t)
      expect(Number.isInteger(o.x) && Number.isInteger(o.y)).toBe(true)
      expect(Math.abs(o.x)).toBeLessThanOrEqual(3)
      if (o.x || o.y) moved = true
    }
    expect(moved).toBe(true)
    expect(s.offset(1.4)).toEqual({ x: 0, y: 0 })
  })

  it("holds the action for the hit-stop, then shakes after it", () => {
    const s = new Shake()
    s.kick(2, 3, 2 / 60)
    expect(s.frozen(2)).toBe(true)
    expect(s.frozen(2 + 2 / 60 + 0.001)).toBe(false)
    expect(s.offset(2)).toEqual({ x: 0, y: 0 })
  })
})
