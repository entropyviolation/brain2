import { describe, expect, it } from "vitest"
import { cellCount, cellOf, feedSlime, groundOf, heartCells, moodOf, newSlime, nearestSlime, tickSlime, type SlimeCtx, type SlimeState } from "./slime"
import { RESIDENTS } from "./cast"
import { buildWorld, STATIONS } from "./world"

function rng(seed: number) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const world = buildWorld(RESIDENTS.map((r) => r.day))
const ground = groundOf(world)
const ctx = (over: Partial<SlimeCtx> = {}): SlimeCtx => ({ day: 1, hour: 23, weather: "clear", player: null, walkers: [], fireLit: false, ground, rand: rng(7), ...over })
const run = (s: SlimeState, n: number, c: SlimeCtx) => {
  for (let i = 0; i < n; i++) s = tickSlime(s, c)
  return s
}

describe("slime mold", () => {
  it("begins at its hearts and survives a JSON round trip", () => {
    const s = newSlime()
    expect(heartCells().length).toBeGreaterThan(1)
    for (const h of heartCells()) expect(s.mass[h]).toBe(1)
    expect(JSON.parse(JSON.stringify(s))).toEqual(s)
  })

  it("spreads over open ground at night, within its cap", () => {
    const s = run({ ...newSlime(), size: 0.6 }, 600, ctx())
    expect(cellCount(s)).toBeGreaterThan(cellCount(newSlime()) + 20)
    for (const k of Object.keys(s.mass)) expect(ground(+k)).toBe(true)
  })

  it("draws back in the noon sun and keeps its hearts", () => {
    const grown = run({ ...newSlime(), size: 0.6 }, 600, ctx())
    const noon = run(grown, 400, ctx({ hour: 12 }))
    expect(cellCount(noon)).toBeLessThan(cellCount(grown))
    for (const h of heartCells()) expect(noon.mass[h]).toBeGreaterThan(0.9)
  })

  it("remembers the road you walk and keeps it through the day", () => {
    const h = heartCells()[0]!
    const tx = (h % 80) * 2 + 8
    const ty = Math.floor(h / 80) * 2
    const player = { tx, ty }
    let s = run(newSlime(), 300, ctx({ player }))
    const cell = cellOf(tx, ty)
    expect(s.like[cell] ?? 0).toBeGreaterThan(0.5)
    s = run(s, 200, ctx({ hour: 12, player: null }))
    expect(s.mass[cell] ?? 0).toBeGreaterThan(0.1)
  })

  it("is fed, remembers it, and says so", () => {
    const h = heartCells()[0]!
    const s = feedSlime(newSlime(), h + 3, "a berry", 4)
    expect(s.fed).toBe(1)
    expect(s.like[h + 3]).toBeGreaterThan(0.5)
    expect(s.thought).toContain("fed me a berry")
    expect(moodOf(s, 4)).toBe("content")
  })

  it("is burned by a lit fire and remembers", () => {
    const fire = cellOf(STATIONS.fire.x, STATIONS.fire.y)
    const s0 = newSlime()
    s0.mass[fire] = 0.8
    const s = run(s0, 3, ctx({ fireLit: true, hour: 20 }))
    expect(s.memory.some((m) => m.kind === "burned")).toBe(true)
    expect(s.like[fire] ?? 0).toBeLessThan(0)
    expect(moodOf(s, 1)).toBe("wary")
  })

  it("dreams a night's growth when the day turns", () => {
    const s = run(newSlime(), 1, ctx({ day: 2, hour: 7 }))
    expect(s.day).toBe(2)
    expect(cellCount(s)).toBeGreaterThanOrEqual(cellCount(newSlime()))
  })

  it("finds the nearest patch for the voice bubble", () => {
    const s = newSlime()
    const h = heartCells()[0]!
    const near = nearestSlime(s, ((h % 80) * 2 + 1) * 16, (Math.floor(h / 80) * 2 + 1) * 16)
    expect(near?.cell).toBe(h)
  })
})
