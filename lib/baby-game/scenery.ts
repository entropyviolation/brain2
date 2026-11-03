/**
 * lib/baby-game/scenery.ts — Designed dressing for the ground, grown by Wave Function Collapse
 *
 * `buildScenery(world)` lays small non-solid things over the built map: bloom drifts, ferns, pebble beds, reeds along a shore,
 * lily pads on still water, glowcaps in the dark wood, crystal sprouts on the hills. Each cell can only be some of them (a reed
 * needs water beside it, a lily needs water under it, nothing goes on a path, a held tile or anything solid), and the rules
 * of what may sit beside what (`RULES`, from pairs) make drifts and beds instead of scatter. Solved in 16×16 chunks, seeded by
 * chunk, so the same world gives the same scenery. `components/BabyGame/sceneryart.ts` paints it.
 */

import { adjacencyFromPairs, solveWfc } from "./wfc"
import { EXTENT_H, EXTENT_W, MAP_W, T, tileIndex, type World } from "./world"

export type SceneryKind = "bloom" | "fern" | "stones" | "reed" | "lily" | "glowcap" | "crystal"

const CODE: Record<string, SceneryKind | null> = { ".": null, "~": null, b: "bloom", f: "fern", s: "stones", r: "reed", l: "lily", g: "glowcap", c: "crystal" }
const TILES = Object.keys(CODE)
const LAND = TILES.filter((t) => t !== "~" && t !== "l")

const pairs: Array<[string, string]> = []
// every land tile may stand beside bare ground; water cells meet land and water freely (their domain keeps lilies on water)
for (const t of LAND) pairs.push([t, "."])
for (const t of LAND) for (const w of ["~", "l"]) pairs.push([t, w])
pairs.push(["~", "~"], ["~", "l"], ["l", "l"])
// drifts: like beside like, and a few friendly neighbours
pairs.push(["b", "b"], ["b", "f"], ["f", "f"], ["s", "s"], ["s", "f"], ["s", "b"], ["r", "r"], ["r", "s"], ["g", "g"], ["g", "f"], ["g", "s"], ["c", "c"], ["c", "s"], ["f", "r"])
export const RULES = adjacencyFromPairs(TILES, pairs, { ".": 9, "~": 6, b: 2.4, f: 1.6, s: 1.1, r: 2.2, l: 0.7, g: 1.8, c: 1.2 })

export type Scenery = Map<number, SceneryKind>

const CHUNK = 16

export function buildScenery(world: World): Scenery {
  const out: Scenery = new Map()
  const at = (x: number, y: number) => (x < 0 || y < 0 || x >= MAP_W ? T.TREE : world.tiles[tileIndex(x, y)] ?? T.TREE)
  const nearWater = (x: number, y: number) => at(x + 1, y) === T.WATER || at(x - 1, y) === T.WATER || at(x, y + 1) === T.WATER || at(x, y - 1) === T.WATER
  const domain = (x: number, y: number): string[] => {
    const tile = at(x, y)
    const i = tileIndex(x, y)
    if (tile === T.WATER) return ["~", "l"]
    if (world.held.has(i) || world.stationSolid.has(i)) return ["."]
    switch (tile) {
      case T.GRASS: case T.FLOWER: return nearWater(x, y) ? [".", "r", "s", "f"] : [".", "b", "f", "s"]
      case T.SAND: return nearWater(x, y) ? [".", "r", "s"] : [".", "s"]
      case T.DARK: return [".", "f", "g", "s"]
      case T.HILL: return [".", "c", "s"]
      case T.SNOW: return [".", "c", "s"]
      default: return ["."]
    }
  }
  for (let cy = 0; cy < EXTENT_H; cy += CHUNK) {
    for (let cx = 0; cx < EXTENT_W; cx += CHUNK) {
      const w = Math.min(CHUNK, EXTENT_W - cx)
      const h = Math.min(CHUNK, EXTENT_H - cy)
      const pins = new Map<number, string[]>()
      for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) pins.set(y * w + x, domain(cx + x, cy + y))
      const grid = solveWfc(RULES, w, h, { seed: 31 + cx * 7 + cy * 131, pins })
      if (!grid) continue
      grid.forEach((t, i) => {
        const kind = CODE[t]
        if (kind) out.set(tileIndex(cx + (i % w), cy + Math.floor(i / w)), kind)
      })
    }
  }
  return out
}
