import { describe, expect, it } from "vitest"
import {
  SAND_LOOSE,
  SAND_SOLID,
  countState,
  createSandGrid,
  releaseSand,
  stepSand,
  type WindowSandGeom,
} from "./window-sand-sim"

const geom: WindowSandGeom = {
  left: 0,
  top: 0,
  width: 20,
  height: 16,
  originX: 18,
  originY: 2,
}

describe("window sand", () => {
  it("releases the corner at the × before the far side", () => {
    const grid = createSandGrid(geom, null, { grain: 2, frontMs: 1000, extraRatio: 0.5 })
    const near = 0 * grid.cols + (grid.cols - 1)
    const far = (grid.winRows - 1) * grid.cols + 0
    expect(grid.spawnAt[near]).toBeLessThan(grid.spawnAt[far] ?? Infinity)
    expect(grid.state[near]).toBe(SAND_SOLID)

    releaseSand(grid, grid.spawnAt[near] ?? 0)
    expect(grid.state[near]).toBe(SAND_LOOSE)
    expect(grid.state[far]).toBe(SAND_SOLID)
  })

  it("drops loose sand into a pile and leaves unreleased grains in place", () => {
    const grid = createSandGrid(geom, null, { grain: 2, frontMs: 1000, extraRatio: 1 })
    const near = grid.spawnAt[0 * grid.cols + (grid.cols - 1)] ?? 0
    releaseSand(grid, near)
    const solidBefore = countState(grid, SAND_SOLID)
    expect(countState(grid, SAND_LOOSE)).toBeGreaterThan(0)

    for (let i = 0; i < 12; i++) stepSand(grid, i % 2 === 0)

    expect(countState(grid, SAND_SOLID)).toBe(solidBefore)

    releaseSand(grid, 10_000)
    for (let i = 0; i < 80; i++) stepSand(grid, i % 2 === 0)

    let piledBelow = 0
    for (let y = grid.winRows; y < grid.rows; y++) {
      for (let x = 0; x < grid.cols; x++) {
        if (grid.state[y * grid.cols + x] === SAND_LOOSE) piledBelow++
      }
    }
    expect(piledBelow).toBeGreaterThan(0)
    expect(countState(grid, SAND_SOLID)).toBe(0)
  })
})