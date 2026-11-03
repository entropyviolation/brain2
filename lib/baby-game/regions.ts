/**
 * lib/baby-game/regions.ts — The zones of Valdivia as data
 *
 * One row per zone: name, rectangle, the act that opens it, what the ground is made of, and what is scattered over it.
 * `world.ts` reads this table to carve and scatter the map, and takes `ZONES` and `ZONE_ACT` from it. Adding a zone
 * means adding a row here (plus its nodes, props and gates); it is the seam a generated world will fill too
 * (`docs/BABY_GAME_EXPANSION.md`, step 1).
 *
 * Row order is the carve order, and `scatter[].order` is the scatter order. Both feed one seeded random stream, so
 * changing either one reshuffles every tree in the world and breaks saved felled trees. Append new rows at the end
 * and give new scatters a higher `order`.
 *
 * Tiles are named here, not numbered, so this file imports nothing and `world.ts` can import it.
 */

export type Rect = { x0: number; y0: number; x1: number; y1: number }

export type GroundName = "grass" | "dark" | "snow" | "hill" | "hay" | "sand"

export type Ground =
  | { kind: "tile"; tile: GroundName }
  /** Grass with a share of flowers. */
  | { kind: "flowers"; rate: number }
  /** Shaped by hand in `world.ts` (the Moiré Pond). */
  | { kind: "custom" }

export type Scatter = {
  tile: "tree" | "rock"
  density: number
  /** Ground it may land on. */
  base: GroundName[] | "grassy"
  /** Position in the shared random stream. Never reuse or reorder a number that has shipped. */
  order: number
}

export type Region = {
  id: string
  name: string
  rect: Rect
  /** The act that opens the zone. The meadow and orchard are open from the start. */
  act: number
  ground: Ground
  scatter?: Scatter[]
}

export const REGIONS = [
  { id: "meadow", name: "Balboa Meadow", rect: { x0: 17, y0: 14, x1: 30, y1: 25 }, act: 1, ground: { kind: "flowers", rate: 0.12 }, scatter: [{ tile: "tree", density: 0.025, base: ["grass"], order: 4 }] },
  { id: "orchard", name: "Refraction Orchard", rect: { x0: 3, y0: 4, x1: 15, y1: 16 }, act: 1, ground: { kind: "flowers", rate: 0.16 }, scatter: [{ tile: "tree", density: 0.13, base: "grassy", order: 1 }] },
  { id: "farm", name: "Permaculture Patch", rect: { x0: 17, y0: 27, x1: 22, y1: 33 }, act: 1, ground: { kind: "tile", tile: "grass" } },
  { id: "wood", name: "Thistle Wood", rect: { x0: 17, y0: 3, x1: 30, y1: 12 }, act: 5, ground: { kind: "tile", tile: "dark" }, scatter: [{ tile: "tree", density: 0.22, base: ["dark"], order: 2 }] },
  { id: "cove", name: "Ice Halo Cove", rect: { x0: 36, y0: 3, x1: 45, y1: 10 }, act: 2, ground: { kind: "tile", tile: "snow" }, scatter: [{ tile: "rock", density: 0.06, base: ["snow"], order: 6 }] },
  { id: "hill", name: "Fossil Hill", rect: { x0: 3, y0: 26, x1: 15, y1: 37 }, act: 3, ground: { kind: "tile", tile: "hill" }, scatter: [{ tile: "rock", density: 0.1, base: ["hill", "grass"], order: 3 }] },
  { id: "barn", name: "Swap Meet Yard", rect: { x0: 32, y0: 27, x1: 44, y1: 37 }, act: 4, ground: { kind: "tile", tile: "hay" }, scatter: [{ tile: "rock", density: 0.025, base: ["hay", "grass"], order: 5 }] },
  { id: "pond", name: "Moiré Pond", rect: { x0: 33, y0: 11, x1: 45, y1: 24 }, act: 2, ground: { kind: "custom" }, scatter: [{ tile: "tree", density: 0.05, base: ["grass"], order: 7 }] },
  { id: "highlands", name: "Kauai Highlands", rect: { x0: 50, y0: 4, x1: 62, y1: 22 }, act: 3, ground: { kind: "flowers", rate: 0.14 }, scatter: [{ tile: "tree", density: 0.12, base: "grassy", order: 8 }] },
  { id: "lake", name: "Sparkle Lake", rect: { x0: 46, y0: 26, x1: 62, y1: 48 }, act: 4, ground: { kind: "flowers", rate: 0.1 }, scatter: [{ tile: "tree", density: 0.08, base: "grassy", order: 9 }] },
  // the far reaches, added when the map grew from 64×52 to 80×64
  { id: "marsh", name: "Cobalt Glow Marsh", rect: { x0: 3, y0: 41, x1: 29, y1: 60 }, act: 1, ground: { kind: "flowers", rate: 0.08 }, scatter: [{ tile: "tree", density: 0.07, base: "grassy", order: 10 }] },
  { id: "stacks", name: "The Index Stacks", rect: { x0: 66, y0: 4, x1: 77, y1: 40 }, act: 3, ground: { kind: "tile", tile: "hill" }, scatter: [{ tile: "tree", density: 0.04, base: ["hill"], order: 11 }] },
  { id: "dunes", name: "Firework Dunes", rect: { x0: 35, y0: 51, x1: 76, y1: 61 }, act: 4, ground: { kind: "tile", tile: "sand" }, scatter: [{ tile: "rock", density: 0.04, base: ["sand"], order: 12 }] },
  // the east band (docs/BABY_GAME_EXPANSION.md): Rhizome, a market town behind a gate past the Index Stacks
  { id: "rhizome", name: "Rhizome", rect: { x0: 84, y0: 36, x1: 108, y1: 58 }, act: 5, ground: { kind: "flowers", rate: 0.08 }, scatter: [{ tile: "tree", density: 0.05, base: "grassy", order: 13 }] },
] as const satisfies readonly Region[]

export type ZoneId = (typeof REGIONS)[number]["id"]

/**
 * The map is stored on a grid this big, so the world can grow without moving a tile index again.
 * What is built is smaller: see `EXTENT_W` / `EXTENT_H`. Everything past it is unbroken wood.
 */
export const MAP_W = 160
export const MAP_H = 128

/** The tile index stride before the map grew (2026-11-03), for migrating saved trees. */
export const OLD_MAP_W = 80

/** How far the built world reaches: the farthest zone edge plus a two tile margin. Cameras, the map screen and the painted map stop here. */
export const EXTENT_W = Math.min(MAP_W, Math.max(...REGIONS.map((r) => r.rect.x1)) + 3)
export const EXTENT_H = Math.min(MAP_H, Math.max(...REGIONS.map((r) => r.rect.y1)) + 3)
