import { describe, expect, it } from "vitest"
import { chop, clearStump, newGame } from "./engine"
import { growTrees, stageOf, STUMP_DAYS, syncTrees } from "./trees"
import { buildWorld, MAP_H, MAP_W, T, tileIndex } from "./world"

const world = () => buildWorld()
const firstTree = (w: ReturnType<typeof buildWorld>) => w.tiles.findIndex((t) => t === T.TREE && !w.held.has(0))

describe("tree stages", () => {
  it("a tile with no record is a mature tree", () => {
    expect(stageOf(undefined, 1)).toBe("mature")
  })
  it("a felled tree is a stump, then grows back through every stage", () => {
    const rec = { k: "cut", t: 5 } as const
    expect(stageOf(rec, 5)).toBe("stump")
    expect(stageOf(rec, 5 + STUMP_DAYS)).toBe("seedling")
    expect(stageOf(rec, 5 + STUMP_DAYS + 2)).toBe("sapling")
    expect(stageOf(rec, 5 + STUMP_DAYS + 4)).toBe("young")
    expect(stageOf(rec, 5 + STUMP_DAYS + 7)).toBe("mature")
  })
})

describe("chopping", () => {
  it("fells a tree for wood, costs energy, and the tile opens until it grows back", () => {
    const w = world()
    const idx = firstTree(w)
    const s = newGame()
    const res = chop(s, idx, () => 0)
    expect(res.ok).toBe(true)
    expect(res.s.inv.wood).toBe(3)
    expect(res.s.energy).toBeLessThan(s.energy)
    syncTrees(w, res.s)
    expect(w.tiles[idx]).not.toBe(T.TREE)
    const later = { ...res.s, day: res.s.day + STUMP_DAYS + 7 }
    syncTrees(w, later)
    expect(w.tiles[idx]).toBe(T.TREE)
  })
  it("will not chop a tree that is still growing, and clears a stump once", () => {
    const w = world()
    const idx = firstTree(w)
    const felled = chop(newGame(), idx, () => 1).s
    expect(chop(felled, idx, () => 1).ok).toBe(false)
    const cleared = clearStump(felled, idx)
    expect(cleared.ok).toBe(true)
    expect(stageOf(cleared.s.trees![idx], cleared.s.day + 99)).toBe("bare")
    expect(clearStump(cleared.s, idx).ok).toBe(false)
  })
})

describe("spreading", () => {
  it("is deterministic, never lands on held or occupied tiles, and never touches another tree", () => {
    const w = world()
    let s = newGame()
    for (let d = 1; d <= 120; d++) s = growTrees(w, { ...s, day: d })
    const again = (() => {
      let t = newGame()
      for (let d = 1; d <= 120; d++) t = growTrees(w, { ...t, day: d })
      return t
    })()
    expect(again.trees).toEqual(s.trees)
    const seeds = Object.keys(s.trees ?? {}).map(Number)
    expect(seeds.length).toBeGreaterThan(0)
    for (const i of seeds) {
      expect(w.held.has(i)).toBe(false)
      expect(w.stationSolid.has(i)).toBe(false)
      expect(w.tiles[i]).not.toBe(T.TREE)
      const tx = i % MAP_W
      const ty = Math.floor(i / MAP_W)
      for (let y = -1; y <= 1; y++) for (let x = -1; x <= 1; x++) if ((x || y) && tx + x < MAP_W && ty + y < MAP_H) expect(w.tiles[tileIndex(tx + x, ty + y)]).not.toBe(T.TREE)
    }
  }, 20000)
})

describe("rekeyTrees", () => {
  it("keeps each felled tree at the same tile when the grid gets wider", async () => {
    const { rekeyTrees } = await import("./trees")
    const old = { [5 * 80 + 12]: { k: "cut" as const, t: 3 }, [60 * 80 + 79]: { k: "bare" as const, t: 4 } }
    const out = rekeyTrees(old, 80, 160)!
    expect(out[5 * 160 + 12]).toEqual({ k: "cut", t: 3 })
    expect(out[60 * 160 + 79]).toEqual({ k: "bare", t: 4 })
    expect(Object.keys(out)).toHaveLength(2)
    expect(rekeyTrees(old, 80, 80)).toBe(old)
    expect(rekeyTrees(undefined)).toBeUndefined()
  })
})
