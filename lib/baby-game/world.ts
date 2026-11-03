/**
 * lib/baby-game/world.ts — Valdivia: an 80×64 tile map built from rectangles
 *
 * The whole map starts as forest. Each zone and corridor is carved out, so nothing is reachable except
 * through a corridor, and the four gates sit in those corridors. A gate opens when its act is unlocked
 * (act N unlocks when N−1 Lamp parts are in the lamp). Trees, rocks, and flowers are scattered with a
 * fixed seed around anything reserved (stations, nodes, friend spots), so the map is the same every time.
 * Pure: no canvas here. `components/BabyGame/render.ts` paints it.
 */

import { HOMES, homeDoor } from "./homes"

export const TILE = 16
export const MAP_W = 80
export const MAP_H = 64

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
  SOIL: 17,
  STONE: 18,
  ARCH: 19,
  STAIRS: 20,
} as const

const SOLID = new Set<number>([T.WATER, T.TREE, T.ROCK, T.FENCE, T.WALL, T.ROOF, T.GATE, T.STONE, T.ARCH])

export type ZoneId = "meadow" | "farm" | "highlands" | "lake" | "orchard" | "pond" | "cove" | "hill" | "barn" | "wood" | "marsh" | "stacks" | "dunes"

type Rect = { x0: number; y0: number; x1: number; y1: number }

export const ZONES: Record<ZoneId, Rect & { name: string }> = {
  meadow: { name: "Balboa Meadow", x0: 17, y0: 14, x1: 30, y1: 25 },
  farm: { name: "Permaculture Patch", x0: 17, y0: 27, x1: 22, y1: 33 },
  orchard: { name: "Refraction Orchard", x0: 3, y0: 4, x1: 15, y1: 16 },
  pond: { name: "Moiré Pond", x0: 33, y0: 11, x1: 45, y1: 24 },
  cove: { name: "Ice Halo Cove", x0: 36, y0: 3, x1: 45, y1: 10 },
  hill: { name: "Fossil Hill", x0: 3, y0: 26, x1: 15, y1: 37 },
  barn: { name: "Swap Meet Yard", x0: 32, y0: 27, x1: 44, y1: 37 },
  wood: { name: "Thistle Wood", x0: 17, y0: 3, x1: 30, y1: 12 },
  highlands: { name: "Kauai Highlands", x0: 50, y0: 4, x1: 62, y1: 22 },
  lake: { name: "Sparkle Lake", x0: 46, y0: 26, x1: 62, y1: 48 },
  // the far reaches, added when the map grew from 64×52 to 80×64
  marsh: { name: "Cobalt Glow Marsh", x0: 3, y0: 41, x1: 29, y1: 60 },
  stacks: { name: "The Index Stacks", x0: 66, y0: 4, x1: 77, y1: 40 },
  dunes: { name: "Firework Dunes", x0: 35, y0: 51, x1: 76, y1: 61 },
}

/** The act that unlocks each zone. The meadow and orchard are open from the start. */
export const ZONE_ACT: Record<ZoneId, number> = { meadow: 1, farm: 1, highlands: 3, lake: 4, orchard: 1, pond: 2, cove: 2, hill: 3, barn: 4, wood: 5, marsh: 1, stacks: 3, dunes: 4 }

const CORRIDORS: Rect[] = [
  { x0: 9, y0: 18, x1: 16, y1: 19 },
  { x0: 10, y0: 16, x1: 11, y1: 26 },
  { x0: 31, y0: 19, x1: 32, y1: 20 },
  { x0: 23, y0: 25, x1: 24, y1: 31 },
  { x0: 25, y0: 30, x1: 31, y1: 31 },
  { x0: 23, y0: 13, x1: 24, y1: 13 },
  { x0: 46, y0: 19, x1: 49, y1: 20 },
  { x0: 56, y0: 23, x1: 57, y1: 25 },
  // farm → marsh (open), highlands → stacks (behind the highlands' own gate), lake → dunes, marsh → dunes (gated)
  { x0: 19, y0: 34, x1: 20, y1: 40 },
  { x0: 63, y0: 19, x1: 65, y1: 20 },
  { x0: 50, y0: 49, x1: 51, y1: 50 },
  { x0: 30, y0: 55, x1: 34, y1: 56 },
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
  { x: 47, y: 19, act: 3 },
  { x: 47, y: 20, act: 3 },
  { x: 56, y: 24, act: 4 },
  { x: 57, y: 24, act: 4 },
  { x: 32, y: 55, act: 4 },
  { x: 32, y: 56, act: 4 },
]

/** Sixteen patches of soil, four by four, south of the meadow. */
export const PLOTS: Array<{ id: string; x: number; y: number }> = Array.from({ length: 16 }, (_, i) => ({ id: `plot-${i}`, x: 18 + (i % 4), y: 28 + Math.floor(i / 4) }))

export type StationId = "bed" | "bench" | "stump" | "board" | "lamp" | "fire" | "glade" | "falls" | "echo" | "stairs"

export const STATIONS: Record<StationId, { x: number; y: number; label: string }> = {
  bed: { x: 19, y: 17, label: "Go inside" },
  bench: { x: 26, y: 17, label: "Workbench" },
  stump: { x: 28, y: 21, label: "Swap Stump" },
  board: { x: 19, y: 21, label: "Notice Board" },
  lamp: { x: 24, y: 20, label: "Orb Lamp" },
  fire: { x: 24, y: 23, label: "Campfire" },
  glade: { x: 5, y: 11, label: "Orb Light Glade" },
  falls: { x: 37, y: 13, label: "Sine Hop" },
  echo: { x: 9, y: 32, label: "Echo Flower" },
  stairs: { x: 43, y: 33, label: "Stair Weave" },
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
  ["clover", 22, 18], ["clover", 29, 23], ["clover", 20, 24], ["clover", 27, 15],
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
  ["clover", 34, 34], ["clover", 42, 29], ["berry", 44, 32], ["dig", 33, 29], ["dig", 40, 35], ["dig", 36, 33],
  ["pebble", 44, 31], ["feather", 38, 36], ["mushroom", 35, 36],
  // aspen highlands
  ["berry", 52, 7], ["berry", 60, 9], ["clover", 53, 15], ["clover", 58, 17], ["feather", 55, 6], ["feather", 61, 14],
  ["acorn", 52, 12], ["acorn", 59, 20], ["mushroom", 54, 20], ["mushroom", 51, 17], ["dig", 57, 7], ["dig", 53, 10], ["dig", 60, 18],
  ["reed", 62, 12], ["reed", 57, 18], ["pebble", 56, 19], ["shell", 56, 16], ["fish", 57, 8], ["fish", 52, 12],
  // mirror lake
  ["fish", 55, 30], ["fish", 51, 32], ["fish", 59, 32], ["fish", 55, 46], ["reed", 48, 38], ["reed", 62, 38], ["shell", 50, 44],
  ["shell", 60, 44], ["pebble", 52, 28], ["pebble", 60, 28], ["clover", 50, 27], ["clover", 61, 46], ["dig", 49, 33], ["dig", 61, 34],
  ["dig", 52, 47], ["berry", 61, 29], ["mushroom", 49, 46], ["feather", 56, 27],
  // wood
  ["mushroom", 19, 5], ["mushroom", 28, 7], ["mushroom", 22, 10], ["mushroom", 26, 4],
  ["acorn", 18, 9], ["acorn", 29, 10], ["acorn", 21, 4], ["acorn", 27, 11],
  ["feather", 20, 7], ["feather", 25, 9], ["dig", 18, 6], ["dig", 29, 5], ["pebble", 23, 8], ["berry", 30, 8],
  // cobalt glow marsh
  ["reed", 6, 44], ["reed", 13, 48], ["reed", 24, 45], ["reed", 9, 55], ["reed", 21, 57],
  ["fish", 9, 49], ["fish", 17, 54], ["fish", 23, 49], ["mushroom", 4, 50], ["mushroom", 15, 58], ["mushroom", 27, 54],
  ["clover", 11, 42], ["clover", 22, 42], ["feather", 18, 45], ["dig", 6, 58], ["dig", 28, 59], ["shell", 13, 53], ["berry", 4, 42],
  // the index stacks
  ["feather", 68, 6], ["feather", 75, 15], ["pebble", 72, 9], ["pebble", 68, 27], ["mushroom", 76, 22], ["mushroom", 67, 34],
  ["dig", 71, 18], ["dig", 74, 37], ["acorn", 69, 13], ["acorn", 76, 31], ["berry", 72, 25], ["clover", 70, 39],
  // firework dunes
  ["shell", 38, 53], ["shell", 47, 60], ["shell", 66, 59], ["pebble", 42, 58], ["pebble", 58, 52], ["pebble", 73, 56],
  ["dig", 44, 53], ["dig", 55, 59], ["dig", 69, 53], ["dig", 75, 60], ["feather", 61, 56], ["fish", 52, 57], ["fish", 50, 54],
]

export const NODES: GameNode[] = nodeList.map(([kind, x, y], i) => ({ id: `${kind}-${i}`, kind, x, y }))

export type PropKind =
  | "well" | "mailbox" | "firewood" | "signpost" | "birdbath" | "blanket" | "scarecrow" | "wheelbarrow" | "haybale" | "beehive" | "rowboat"
  | "orb" | "puddle" | "prism" | "library" | "thrift" | "collage" | "fireworks" | "clock" | "pendulum" | "ducklings" | "sprinkler"
  | "microscope" | "fossil" | "romanesco" | "slime" | "wasps" | "kitten"

/** Everyday things standing in the world, and a few drawn from what the player loves and dreads. What each one does is `lib/baby-game/props.ts`. */
export const PROPS: Array<{ kind: PropKind; x: number; y: number }> = [
  { kind: "mailbox", x: 18, y: 18 },
  { kind: "firewood", x: 20, y: 23 },
  { kind: "well", x: 17, y: 28 },
  { kind: "signpost", x: 30, y: 18 },
  { kind: "birdbath", x: 26, y: 14 },
  { kind: "blanket", x: 18, y: 25 },
  { kind: "beehive", x: 12, y: 9 },
  { kind: "scarecrow", x: 22, y: 29 },
  { kind: "wheelbarrow", x: 22, y: 32 },
  { kind: "haybale", x: 38, y: 33 },
  { kind: "haybale", x: 34, y: 36 },
  { kind: "rowboat", x: 47, y: 40 },
  { kind: "orb", x: 21, y: 21 },
  { kind: "puddle", x: 29, y: 25 },
  { kind: "prism", x: 26, y: 15 },
  { kind: "library", x: 18, y: 22 },
  { kind: "thrift", x: 27, y: 22 },
  { kind: "collage", x: 27, y: 17 },
  { kind: "fireworks", x: 41, y: 32 },
  { kind: "clock", x: 17, y: 22 },
  { kind: "pendulum", x: 33, y: 22 },
  { kind: "ducklings", x: 35, y: 23 },
  { kind: "sprinkler", x: 17, y: 30 },
  { kind: "microscope", x: 12, y: 31 },
  { kind: "fossil", x: 7, y: 32 },
  { kind: "romanesco", x: 13, y: 7 },
  { kind: "slime", x: 20, y: 10 },
  { kind: "wasps", x: 28, y: 9 },
  { kind: "kitten", x: 36, y: 32 },
  // the far reaches
  { kind: "orb", x: 12, y: 50 },
  { kind: "slime", x: 23, y: 53 },
  { kind: "library", x: 69, y: 5 },
  { kind: "prism", x: 74, y: 29 },
  { kind: "fireworks", x: 63, y: 54 },
  { kind: "puddle", x: 41, y: 55 },
]

/** Props you can walk over: they lie on the ground or are small enough to step around. */
export const FLAT_PROPS: ReadonlySet<PropKind> = new Set<PropKind>(["blanket", "puddle", "ducklings", "sprinkler", "fossil", "kitten"])

export type World = {
  tiles: Uint8Array
  /** Tiles that are solid because of a station or a prop standing on them. */
  stationSolid: Set<number>
  /** Tiles kept clear of trees: around stations, nodes, props, homes and friend spots. New saplings never start here. */
  held: Set<number>
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
  carve(ZONES.farm, T.GRASS)
  carve({ x0: 19, y0: 26, x1: 20, y1: 26 }, T.PATH)
  for (const p of PLOTS) tiles[tileIndex(p.x, p.y)] = T.SOIL
  carve(ZONES.wood, T.DARK)
  carve(ZONES.cove, T.SNOW)
  carve(ZONES.hill, T.HILL)
  carve(ZONES.barn, T.HAY)
  carve(ZONES.pond, (x, y) => {
    const d = ((x - 39.5) / 4.8) ** 2 + ((y - 17.5) / 4.2) ** 2
    if (d <= 1) return T.WATER
    if (d <= 1.7) return T.SAND
    return rand() < 0.1 ? T.FLOWER : T.GRASS
  })
  carve(ZONES.highlands, flowers(0.14))
  carve(ZONES.lake, flowers(0.1))
  carve(ZONES.marsh, flowers(0.08))
  carve(ZONES.stacks, T.HILL)
  carve(ZONES.dunes, T.SAND)
  // the highlands' own still pond, and a great lake with a sandy rim
  for (let y = 6; y <= 18; y++) {
    for (let x = 51; x <= 63; x++) {
      const d = ((x - 57) / 4.6) ** 2 + ((y - 12) / 3.4) ** 2
      if (d <= 1) tiles[tileIndex(x, y)] = T.WATER
      else if (d <= 1.45) tiles[tileIndex(x, y)] = T.SAND
    }
  }
  for (let y = 29; y <= 47; y++) {
    for (let x = 46; x <= 62; x++) {
      const d = ((x - 55) / 6.5) ** 2 + ((y - 38) / 7) ** 2
      if (d <= 1) tiles[tileIndex(x, y)] = T.WATER
      else if (d <= 1.7) tiles[tileIndex(x, y)] = T.SAND
    }
  }
  // the marsh: still pools that glow cobalt after dark, strung on a boardwalk
  const pools: Array<[number, number, number, number]> = [[8, 47, 2.6, 1.8], [17, 51, 3.2, 2.2], [26, 48, 2.4, 2.2], [11, 56, 3, 1.8], [22, 56, 2.2, 1.6]]
  for (let y = ZONES.marsh.y0; y <= ZONES.marsh.y1; y++) {
    for (let x = ZONES.marsh.x0; x <= ZONES.marsh.x1; x++) {
      if (pools.some(([cx, cy, rx, ry]) => ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 <= 1)) tiles[tileIndex(x, y)] = T.WATER
    }
  }
  // the stacks: long shelves of stone with gaps to walk between, like the index at the back of a book
  for (let y = 8; y <= 36; y += 4) for (let x = 67; x <= 76; x++) if (x !== 71 && x !== 72 && (x + y) % 9 !== 0) tiles[tileIndex(x, y)] = T.STONE
  // the dunes: one small oasis
  for (let y = 53; y <= 57; y++) for (let x = 48; x <= 54; x++) if (((x - 51) / 2.2) ** 2 + ((y - 55) / 1.6) ** 2 <= 1) tiles[tileIndex(x, y)] = T.WATER
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
  carve({ x0: 50, y0: 19, x1: 62, y1: 20 }, T.PATH)
  carve({ x0: 56, y0: 20, x1: 57, y1: 28 }, T.PATH)
  carve({ x0: 19, y0: 41, x1: 20, y1: 44 }, T.PATH)
  carve({ x0: 4, y0: 44, x1: 29, y1: 44 }, T.PATH)
  carve({ x0: 71, y0: 4, x1: 72, y1: 40 }, T.PATH)
  carve({ x0: 35, y0: 55, x1: 47, y1: 55 }, T.PATH)
  carve({ x0: 55, y0: 55, x1: 76, y1: 55 }, T.PATH)
  carve({ x0: 50, y0: 51, x1: 51, y1: 52 }, T.PATH)
  // a boardwalk across the marsh's middle pool
  for (let x = 13; x <= 21; x++) tiles[tileIndex(x, 51)] = T.BRIDGE

  // the cottage: a tall Gaudí house, seven tiles wide and seven tall (painted by `art.ts`); its door opens into `casa.ts`
  for (let x = 16; x <= 22; x++) {
    for (let y = 11; y <= 17; y++) tiles[tileIndex(x, y)] = y <= 13 ? T.ROOF : T.WALL
  }
  tiles[tileIndex(19, 17)] = T.DOOR

  // the hayloft
  for (let x = 36; x <= 41; x++) {
    tiles[tileIndex(x, 27)] = T.ROOF
    tiles[tileIndex(x, 28)] = T.WALL
    tiles[tileIndex(x, 29)] = T.WALL
  }
  tiles[tileIndex(38, 29)] = T.DOOR

  // the Stair Court: a ruined archway whose steps climb up and arrive back where they started
  for (const x of [42, 43, 44]) {
    tiles[tileIndex(x, 34)] = T.STAIRS
    tiles[tileIndex(x, 36)] = T.STONE
  }
  tiles[tileIndex(42, 35)] = T.ARCH
  tiles[tileIndex(44, 35)] = T.ARCH
  tiles[tileIndex(43, 35)] = T.STAIRS

  // gates
  for (const gate of GATES) tiles[tileIndex(gate.x, gate.y)] = T.GATE

  const stationSolid = new Set<number>()
  const keep = new Set<number>()
  const hold = (x: number, y: number, radius = 1) => {
    for (let dy = -radius; dy <= radius; dy++) for (let dx = -radius; dx <= radius; dx++) keep.add(tileIndex(x + dx, y + dy))
  }
  for (const s of Object.values(STATIONS)) {
    hold(s.x, s.y, 2)
    if (tiles[tileIndex(s.x, s.y)] !== T.DOOR) stationSolid.add(tileIndex(s.x, s.y))
  }
  for (const p of PROPS) {
    hold(p.x, p.y, 1)
    if (!FLAT_PROPS.has(p.kind)) stationSolid.add(tileIndex(p.x, p.y))
  }
  // every friend's home is solid, with its door and a little yard kept clear
  for (const h of Object.values(HOMES)) {
    hold(h.x, h.y, 1)
    hold(...homeDoor(h), 1)
    // the house is HOME_SCALE tiles wide, so its footing is solid on both sides of the middle tile
    for (let dx = -1; dx <= 1; dx++) stationSolid.add(tileIndex(h.x + dx, h.y))
  }
  for (const n of NODES) hold(n.x, n.y, 2)
  for (const [x, y] of reserved) hold(x, y, 2)
  hold(10, 22, 1)
  for (const [x, y] of FIRE_SLOTS) hold(x, y, 0)

  // scatter trees and rocks inside open ground, never on paths, water, or anything held
  const scatter = (zone: Rect, tile: number, density: number, base: number[]) => {
    for (let y = zone.y0; y <= zone.y1; y++) {
      for (let x = zone.x0; x <= zone.x1; x++) {
        const i = tileIndex(x, y)
        // one roll per tile whether or not it is held, so moving a prop never reshuffles the trees
        const roll = rand()
        if (!base.includes(tiles[i]!) || keep.has(i)) continue
        if (tile === T.TREE && zone !== ZONES.wood) {
          // groves and clearings: a smooth noise mask scales the chance, and no two trees touch
          if (roll >= density * (0.25 + 1.5 * groveNoise(x, y))) continue
          if ([tiles[i - 1], tiles[i - MAP_W - 1], tiles[i - MAP_W], tiles[i - MAP_W + 1]].includes(T.TREE)) continue
          tiles[i] = tile
        } else if (roll < density) tiles[i] = tile
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
  scatter(ZONES.highlands, T.TREE, 0.12, [T.GRASS, T.FLOWER])
  scatter(ZONES.lake, T.TREE, 0.08, [T.GRASS, T.FLOWER])
  scatter(ZONES.marsh, T.TREE, 0.07, [T.GRASS, T.FLOWER])
  scatter(ZONES.stacks, T.TREE, 0.04, [T.HILL])
  scatter(ZONES.dunes, T.ROCK, 0.04, [T.SAND])

  return { tiles, stationSolid, held: keep }
}

/** Smooth 0..1 value noise at about 9 tiles, so trees gather in groves instead of sprinkling evenly. */
function groveNoise(x: number, y: number): number {
  const h = (a: number, b: number) => {
    let t = (a * 374761393 + b * 668265263) >>> 0
    t = (t ^ (t >>> 13)) * 1274126177
    return ((t ^ (t >>> 16)) >>> 0) / 4294967296
  }
  const gx = x / 9
  const gy = y / 9
  const x0 = Math.floor(gx)
  const y0 = Math.floor(gy)
  const fx = gx - x0
  const fy = gy - y0
  const sx = fx * fx * (3 - 2 * fx)
  const sy = fy * fy * (3 - 2 * fy)
  const top = h(x0, y0) * (1 - sx) + h(x0 + 1, y0) * sx
  const bot = h(x0, y0 + 1) * (1 - sx) + h(x0 + 1, y0 + 1) * sx
  return top * (1 - sy) + bot * sy
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
