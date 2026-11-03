import { describe, expect, it } from "vitest"
import { adjacencyFromSample, solveWfc } from "./wfc"
import { RULES, buildScenery } from "./scenery"
import { buildWorld, T, tileIndex } from "./world"

describe("wfc", () => {
  const rules = adjacencyFromSample(["~~~~", "~ss~", "ssgg", "gggg"])
  it("is repeatable and obeys the learned adjacency", () => {
    const a = solveWfc(rules, 10, 8, { seed: 3 })!
    expect(a).toEqual(solveWfc(rules, 10, 8, { seed: 3 }))
    for (let y = 0; y < 8; y++) for (let x = 0; x < 10; x++) {
      if (x < 9) expect(rules.allow[1]!.get(a[y * 10 + x]!)!.has(a[y * 10 + x + 1]!)).toBe(true)
      if (y < 7) expect(rules.allow[2]!.get(a[y * 10 + x]!)!.has(a[(y + 1) * 10 + x]!)).toBe(true)
    }
  })
  it("keeps pins", () => {
    const g = solveWfc(rules, 6, 6, { seed: 1, pins: new Map([[0, ["g"]]]) })!
    expect(g[0]).toBe("g")
  })
})

describe("scenery", () => {
  const world = buildWorld()
  const sc = buildScenery(world)
  it("is deterministic and not empty", () => {
    expect(sc.size).toBeGreaterThan(40)
    expect([...buildScenery(world)]).toEqual([...sc])
  })
  it("never lands on solid, held or path tiles, and lilies sit on water", () => {
    for (const [i, kind] of sc) {
      const tile = world.tiles[i]!
      if (kind === "lily") expect(tile).toBe(T.WATER)
      else {
        expect(world.held.has(i) || world.stationSolid.has(i)).toBe(false)
        expect([T.PATH, T.TREE, T.WALL, T.ROOF, T.WATER, T.BRIDGE]).not.toContain(tile)
      }
    }
    expect(RULES.tiles.length).toBeGreaterThan(5)
    expect(tileIndex(0, 0)).toBe(0)
  })
})
