/**
 * lib/baby-game/world.ts — Mossmere Hollow: a 48×40 tile map built from rectangles
 *
 * The whole map starts as forest. Each zone and corridor is carved out, so nothing is reachable except
 * through a corridor, and the four gates sit in those corridors. A gate opens when its act is unlocked
 * (act N unlocks when N−1 Lamp parts are in the lamp). Trees, rocks, and flowers are scattered with a
 * fixed seed around anything reserved (stations, nodes, friend spots), so the map is the same every time.
 * Pure: no canvas here. `components/BabyGame/render.ts` paints it.
 */

export const TILE = 16
export const MAP_W = 48
export const MAP_H = 40

export const T = {
  GRASS: 0,
  FLOWER: 1,
  PATH: 2,
  WATER: 3,
  SAND: 4,
  TREE: 5,
  ROCK: 6,
  FENCE: 7,
  WALL: 8,
  ROOF: 9,
  DARK: 10,
  SNOW: 11,
  BRIDGE: 12,
  GATE: 13,
  HILL: 14,
  HAY: 15,
  DOOR: 16,
} as const

const SOLID = new Set<number>([T.WATER, T.TREE, T.ROCK, T.FENCE, T.WALL, T.ROOF, T.GATE])

export type ZoneId = "meadow" | "orchard" | "pond" | "cove" | "hill" | "barn" | "wood"

type Rect = { x0: number; y0: number; x1: number; y1: number }

export const ZONES: Record<ZoneId, Rect & { name: string }> = {
  meadow: { name: "Mossmere Meadow", x0: 17, y0: 14, x1: 30, y1: 25 },
  orchard: { name: "Dewdrop Orchard", x0: 3, y0: 4, x1: 15, y1: 16 },
  pond: { name: "Lilting Pond", x0: 33, y0: 11, x1: 45, y1: 24 },
  cove: { name: "Frost Cove", x0: 36, y0: 3, x1: 45, y1: 10 },
  hill: { name: "Burrow Hill", x0: 3, y0: 26, x1: 15, y1: 37 },
  barn: { name: "Hayloft Yard", x0: 32, y0: 27, x1: 44, y1: 37 },
  wood: { name: "Whispering Wood", x0: 17, y0: 3, x1: 30, y1: 12 },
}

/** The act that unlocks each zone. The meadow and orchard are open from the start. */
export const ZONE_ACT: Record<ZoneId, number> = { meadow: 1, orchard: 1, pond: 2, cove: 2, hill: 3, barn: 4, wood: 5 }

const CORRIDORS: Rect[] = [
  { x0: 9, y0: 18, x1: 16, y1: 19 },
  { x0: 10, y0: 16, x1: 11, y1: 26 },
  { x0: 31, y0: 19, x1: 32, y1: 20 },
  { x0: 23, y0: 25, x1: 24, y1: 31 },
  { x0: 25, y0: 30, x1: 31, y1: 31 },
  { x0: 23, y0: 13, x1: 24, y1: 13 },
]

export type Gate = { x: number; y: number; act: number }

export const GATES: Gate[] = [
  { x: 31, y: 19, act: 2 },
  { x: 31, y: 20, act: 2 },
  { x: 10, y: 22, act: 3 },
  { x: 11, y: 22, act: 3 },
  { x: 28, y: 30, act: 4 },
  { x: 28, y: 31, act: 4 },
  { x: 23, y: 13, act: 5 },
  { x: 24, y: 13, act: 5 },
]

export type StationId = "bed" | "bench" | "stump" | "board" | "lamp" | "fire"

export const STATIONS: Record<StationId, { x: number; y: number; label: string }> = {
  bed: { x: 21, y: 17, label: "Go to bed" },
  bench: { x: 26, y: 17, label: "Workbench" },
  stump: { x: 28, y: 21, label: "Trade Stump" },
  board: { x: 19, y: 21, label: "Notice Board" },
  lamp: { x: 24, y: 20, label: "Hollow Lamp" },
  fire: { x: 24, y: 23, label: "Campfire" },
}

/** Where friends settle around the campfire at dusk, in the order they arrive. */
export const FIRE_SLOTS: Array<[number, number]> = [
  [22, 22], [26, 22], [22, 24], [26, 24], [23, 25], [25, 25], [21, 23], [27, 23], [21, 25], [27, 25], [20, 22], [28, 22],
]

export type NodeKind = "berry" | "acorn" | "reed" | "clover" | "pebble" | "feather" | "mushroom" | "shell" | "dig" | "fish"

export type GameNode = { id: string; kind: NodeKind; x: number; y: number }

const nodeList: Array<[NodeKind, number, number]> = [
  // orchard
  ["berry", 5, 6], ["berry", 7, 10], ["berry", 12, 6], ["berry", 4, 13],
  ["acorn", 8, 5], ["acorn", 14, 9], ["acorn", 4, 9],
  ["reed", 8, 12], ["reed", 14, 13], ["reed", 11, 15],
  ["clover", 6, 14], ["clover", 12, 10], ["feather", 7, 8], ["dig", 5, 15],
  // meadow
  ["clover", 18, 16], ["clover", 29, 23], ["clover", 20, 24], ["clover", 27, 15],
  ["berry", 29, 15], ["pebble", 18, 23], ["pebble", 28, 24], ["dig", 22, 24],
  // pond and cove
  ["reed", 34, 15], ["reed", 35, 21], ["reed", 43, 22], ["reed", 43, 13],
  ["shell", 34, 17], ["shell", 37, 22], ["shell", 45, 18], ["fish", 37, 19], ["fish", 40, 20], ["fish", 43, 19],
  ["pebble", 34, 12], ["pebble", 40, 5], ["shell", 44, 9], ["dig", 36, 12],
  // hill
  ["dig", 5, 28], ["dig", 9, 30], ["dig", 13, 28], ["dig", 6, 34], ["dig", 12, 35], ["dig", 14, 32],
  ["mushroom", 4, 31], ["mushroom", 8, 35], ["mushroom", 13, 34], ["pebble", 5, 27], ["pebble", 11, 33],
  ["acorn", 7, 29], ["berry", 14, 36],
  // barn yard
  ["clover", 34, 34], ["clover", 42, 29], ["berry", 43, 36], ["dig", 33, 29], ["dig", 40, 35], ["dig", 36, 33],
  ["pebble", 44, 31], ["feather", 38, 36], ["mushroom", 35, 36],
  // wood
  ["mushroom", 19, 5], ["mushroom", 28, 7], ["mushroom", 22, 10], ["mushroom", 26, 4],
  ["acorn", 18, 9], ["acorn", 29, 10], ["acorn", 21, 4], ["acorn", 27, 11],
  ["feather", 20, 7], ["feather", 25, 9], ["dig", 18, 6], ["dig", 29, 5], ["pebble", 23, 8], ["berry", 30, 8],
]

export const NODES: GameNode[] = nodeList.map(([kind, x, y], i) => ({ id: `${kind}-${i}`, kind, x, y }))

export type World = {
  tiles: Uint8Array
  /** Tiles that are solid because of a station standing on them. */
  stationSolid: Set<number>
}

export const tileIndex = (x: number, y: number) => y * MAP_W + x
const inRect = (r: Rect, x: number, y: number) => x >= r.x0 && x <= r.x1 && y >= r.y0 && y <= r.y1

export function zoneAt(tx: number, ty: number): ZoneId | null {
  for (const id of Object.keys(ZONES) as ZoneId[]) if (inRect(ZONES[id], tx, ty)) return id
  return null
}

function rng(seed: number) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** Tiles friends stand on, so scatter leaves them clear. Filled by `cast.ts` through `buildWorld(reserved)`. */
export function buildWorld(reserved: Array<[number, number]> = []): World {
  const tiles = new Uint8Array(MAP_W * MAP_H).fill(T.TREE)
  const rand = rng(7)
  const carve = (r: Rect, tile: number | ((x: number, y: number) => number)) => {
    for (let y = r.y0; y <= r.y1; y++) for (let x = r.x0; x <= r.x1; x++) tiles[tileIndex(x, y)] = typeof tile === "number" ? tile : tile(x, y)
  }
  const flowers = (rate: number) => () => (rand() < rate ? T.FLOWER : T.GRASS)

  carve(ZONES.meadow, flowers(0.12))
  carve(ZONES.orchard, flowers(0.16))
  carve(ZONES.wood, T.DARK)
  carve(ZONES.cove, T.SNOW)
  carve(ZONES.hill, (x, y) => ((x * 7 + y * 3) % 11 === 0 ? T.GRASS : T.HILL))
  carve(ZONES.barn, (x, y) => ((x + y) % 5 === 0 ? T.GRASS : T.HAY))
  carve(ZONES.pond, (x, y) => {
    const d = ((x - 39.5) / 4.8) ** 2 + ((y - 17.5) / 4.2) ** 2
    if (d <= 1) return T.WATER
    if (d <= 1.7) return T.SAND
    return rand() < 0.1 ? T.FLOWER : T.GRASS
  })
  for (const c of CORRIDORS) carve(c, T.PATH)

  // a brook-sized pond in the orchard
  for (let y = 12; y <= 14; y++) for (let x = 9; x <= 13; x++) if (((x - 11) / 2.6) ** 2 + ((y - 13) / 1.6) ** 2 <= 1) tiles[tileIndex(x, y)] = T.WATER
  for (let y = 11; y <= 15; y++) for (let x = 8; x <= 14; x++) if (tiles[tileIndex(x, y)] !== T.WATER && ((x - 11) / 3.6) ** 2 + ((y - 13) / 2.4) ** 2 <= 1) tiles[tileIndex(x, y)] = T.SAND

  // the dock: a bridge straight across the pond
  for (let x = 33; x <= 45; x++) for (const y of [19, 20]) tiles[tileIndex(x, y)] = T.BRIDGE

  // paths in the meadow and into each zone
  carve({ x0: 17, y0: 19, x1: 30, y1: 20 }, T.PATH)
  carve({ x0: 23, y0: 14, x1: 24, y1: 25 }, T.PATH)
  carve({ x0: 10, y0: 4, x1: 10, y1: 16 }, T.PATH)
  carve({ x0: 10, y0: 26, x1: 10, y1: 36 }, T.PATH)
  carve({ x0: 33, y0: 27, x1: 33, y1: 36 }, T.PATH)
  carve({ x0: 32, y0: 30, x1: 44, y1: 31 }, T.PATH)
  carve({ x0: 23, y0: 3, x1: 24, y1: 12 }, T.PATH)

  // the cottage
  for (let x = 19; x <= 23; x++) {
    tiles[tileIndex(x, 15)] = T.ROOF
    tiles[tileIndex(x, 16)] = T.WALL
    tiles[tileIndex(x, 17)] = T.WALL
  }
  tiles[tileIndex(21, 17)] = T.DOOR

  // the hayloft
  for (let x = 36; x <= 41; x++) {
    tiles[tileIndex(x, 27)] = T.ROOF
    tiles[tileIndex(x, 28)] = T.WALL
    tiles[tileIndex(x, 29)] = T.WALL
  }
  tiles[tileIndex(38, 29)] = T.DOOR

  // gates
  for (const gate of GATES) tiles[tileIndex(gate.x, gate.y)] = T.GATE

  const stationSolid = new Set<number>()
  const keep = new Set<number>()
  const hold = (x: number, y: number, radius = 1) => {
    for (let dy = -radius; dy <= radius; dy++) for (let dx = -radius; dx <= radius; dx++) keep.add(tileIndex(x + dx, y + dy))
  }
  for (const s of Object.values(STATIONS)) {
    hold(s.x, s.y)
    if (tiles[tileIndex(s.x, s.y)] !== T.DOOR) stationSolid.add(tileIndex(s.x, s.y))
  }
  for (const n of NODES) hold(n.x, n.y, 1)
  for (const [x, y] of reserved) hold(x, y, 1)
  hold(10, 22, 1)
  for (const [x, y] of FIRE_SLOTS) hold(x, y, 0)

  // scatter trees and rocks inside open ground, never on paths, water, or anything held
  const scatter = (zone: Rect, tile: number, density: number, base: number[]) => {
    for (let y = zone.y0; y <= zone.y1; y++) {
      for (let x = zone.x0; x <= zone.x1; x++) {
        const i = tileIndex(x, y)
        if (!base.includes(tiles[i]!) || keep.has(i)) continue
        if (rand() < density) tiles[i] = tile
      }
    }
  }
  scatter(ZONES.orchard, T.TREE, 0.13, [T.GRASS, T.FLOWER])
  scatter(ZONES.wood, T.TREE, 0.22, [T.DARK])
  scatter(ZONES.hill, T.ROCK, 0.1, [T.HILL, T.GRASS])
  scatter(ZONES.meadow, T.TREE, 0.025, [T.GRASS])
  scatter(ZONES.barn, T.ROCK, 0.025, [T.HAY, T.GRASS])
  scatter(ZONES.cove, T.ROCK, 0.06, [T.SNOW])
  scatter(ZONES.pond, T.TREE, 0.05, [T.GRASS])

  return { tiles, stationSolid }
}

export function unlockedAct(partsPlaced: number): number {
  return Math.min(5, partsPlaced + 1)
}

export function isSolidTile(world: World, tx: number, ty: number, act: number): boolean {
  if (tx < 0 || ty < 0 || tx >= MAP_W || ty >= MAP_H) return true
  const i = tileIndex(tx, ty)
  const tile = world.tiles[i]!
  if (tile === T.GATE) {
    const gate = GATES.find((g) => g.x === tx && g.y === ty)
    return !gate || act < gate.act
  }
  return SOLID.has(tile) || world.stationSolid.has(i)
}

/** Breadth-first walk over open tiles, for tests and for "can this friend reach the fire". */
export function reachable(world: World, from: [number, number], act: number): Set<number> {
  const seen = new Set<number>([tileIndex(from[0], from[1])])
  const queue: Array<[number, number]> = [from]
  while (queue.length) {
    const [x, y] = queue.shift()!
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
      const nx = x + dx
      const ny = y + dy
      if (isSolidTile(world, nx, ny, act) || seen.has(tileIndex(nx, ny))) continue
      seen.add(tileIndex(nx, ny))
      queue.push([nx, ny])
    }
  }
  return seen
}
