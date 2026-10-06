import { describe, expect, it } from "vitest"
import {
  SAND_EMPTY,
  SAND_LOOSE,
  SAND_SETTLED,
  SAND_SOLID,
  WINDOW_SAND_WIND_AT,
  beginWind,
  countState,
  createSandWorld,
  stepSandWorld,
  type SandWorld,
  type WindowSandGeom,
} from "./window-sand-sim"

const geom: WindowSandGeom = {
  left: 0,
  top: 0,
  width: 96,
  height: 72,
  originX: 90,
  originY: 4,
}

function run(world: SandWorld, until: number) {
  let t = 0
  while (t < until) {
    const next = Math.min(until, t + 16)
    stepSandWorld(world, next, next - t)
    t = next
  }
}

function indexAt(world: SandWorld, which: "near" | "far") {
  let pick = 0
  for (let i = 1; i < world.n; i++) {
    const closer = world.releaseAt[i] < world.releaseAt[pick]
    if (which === "near" ? closer : !closer && world.releaseAt[i] >= world.releaseAt[pick]) pick = i
  }
  return pick
}

describe("window sand", () => {
  it("releases the corner at the × before the far side, and the far side stays put", () => {
    const world = createSandWorld(geom, null, { grain: 2, frontMs: 1000 })
    const near = indexAt(world, "near")
    const far = indexAt(world, "far")
    expect(world.releaseAt[near]).toBeLessThan(world.releaseAt[far])
    expect(world.state[near]).toBe(SAND_SOLID)
    expect(world.state[far]).toBe(SAND_SOLID)

    const farY = world.y[far]
    const nearY = world.y[near]
    run(world, (world.releaseAt[near] ?? 0) + 220)

    expect(world.state[near]).not.toBe(SAND_SOLID)
    expect(world.y[near]).toBeGreaterThan(nearY + 4)
    expect(world.state[far]).toBe(SAND_SOLID)
    expect(world.y[far]).toBe(farY)
  })

  it("heaps grains into a dune and does not leave a solid frame", () => {
    const world = createSandWorld(geom, null, { grain: 2, frontMs: 400, windAt: 1600 })
    run(world, 1500)

    expect(countState(world, SAND_SOLID)).toBe(0)
    expect(countState(world, SAND_SETTLED)).toBeGreaterThan(world.n * 0.45)

    let minY = Infinity
    let maxY = -Infinity
    for (let i = 0; i < world.n; i++) {
      if (world.state[i] !== SAND_SETTLED) continue
      if (world.y[i] < minY) minY = world.y[i]
      if (world.y[i] > maxY) maxY = world.y[i]
    }
    expect(maxY).toBeGreaterThan(geom.height * 0.45)
    expect(minY).toBeLessThan(maxY - world.grain * 4)
  })

  it("blows the dune to the right once the wind starts", () => {
    const world = createSandWorld(geom, null, { grain: 2, frontMs: 400, windAt: 1600 })
    run(world, 1500)
    let mean = 0
    let settled = 0
    for (let i = 0; i < world.n; i++) {
      if (world.state[i] !== SAND_SETTLED) continue
      mean += world.x[i]
      settled++
    }
    mean /= settled || 1

    run(world, 1600 + 1400)
    let gone = countState(world, SAND_EMPTY)
    let shifted = 0
    for (let i = 0; i < world.n; i++) {
      if (world.state[i] === SAND_EMPTY) continue
      if (world.x[i] > mean + 24) shifted++
    }
    expect(gone + shifted).toBeGreaterThan(world.n * 0.5)
    expect(countState(world, SAND_SOLID)).toBe(0)
  })

  it("frees any grain the wind reaches so a solid frame cannot stay behind", () => {
    const world = createSandWorld(geom, null, { grain: 2, frontMs: 5000, windAt: WINDOW_SAND_WIND_AT })
    run(world, 200)
    const far = indexAt(world, "far")
    expect(world.state[far]).toBe(SAND_SOLID)
    beginWind(world, 200)
    expect(world.windAt).toBe(200)
    run(world, 280)
    expect(world.state[far]).not.toBe(SAND_SOLID)
  })
})
