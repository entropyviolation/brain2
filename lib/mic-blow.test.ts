import { describe, expect, it } from "vitest"
import { createBlowEar, hearBlow, sandHearsBreath } from "./mic-blow"

function feed(ear: ReturnType<typeof createBlowEar>, rms: number, ms: number, step = 16) {
  let heard = false
  let left = ms
  while (left > 0) {
    const dt = Math.min(step, left)
    if (hearBlow(ear, rms, dt)) heard = true
    left -= dt
  }
  return heard
}

describe("hearBlow", () => {
  it("ignores a quiet room, speech, and a short puff", () => {
    const ear = createBlowEar()
    expect(feed(ear, 0.01, 800)).toBe(false)
    expect(feed(ear, 0.12, 600)).toBe(false)
    expect(feed(ear, 0.42, 200)).toBe(false)
    expect(ear.blown).toBe(false)
  })

  it("hears a long hard puff, and only once", () => {
    const ear = createBlowEar()
    feed(ear, 0.012, 400)
    expect(feed(ear, 0.42, 200)).toBe(false)
    expect(feed(ear, 0.42, 180)).toBe(true)
    expect(feed(ear, 0.6, 200)).toBe(false)
    expect(ear.blown).toBe(true)
  })

  it("keeps a breath that dips for a moment", () => {
    const ear = createBlowEar()
    expect(feed(ear, 0.45, 200)).toBe(false)
    expect(feed(ear, 0.02, 50)).toBe(false)
    expect(feed(ear, 0.45, 180)).toBe(true)
  })

  it("asks more of a puff when the room is already loud", () => {
    const ear = createBlowEar()
    feed(ear, 0.1, 1200)
    expect(feed(ear, 0.36, 400)).toBe(false)
    expect(feed(ear, 0.55, 400)).toBe(true)
  })
})

describe("sandHearsBreath", () => {
  it("stays off outside the iPhone shell", () => {
    expect(sandHearsBreath()).toBe(false)
  })
})