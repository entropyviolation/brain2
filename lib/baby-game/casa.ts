/**
 * lib/baby-game/casa.ts — the inside of the cottage: three floors and three rooms off them, all furnished
 *
 * The door of the cottage (the old bed station) opens into the Hall. A grand stair climbs to the Noble Floor, another to the
 * Loft, where the bed is. Three more rooms open off those by doors: the Sunken Lounge (off the Hall's oval doors), the Glasshouse
 * (off the Noble Floor's folding doors) and the Boudoir (off the Loft's round door). The furniture is `casa-furniture.ts`; its
 * solid pieces become blocked tiles here and the ones with a look become spots. Each floor is a room of 16px tiles: a tall back wall (rows above `FLOOR_TOP`, never walkable) and a
 * floor to walk on, with columns and furniture marked solid. Pure: no canvas here. `components/BabyGame/casa-paint.ts` paints the
 * rooms and `Casa.tsx` runs them. Time stands still inside, like in every other panel.
 */

import { furnitureSolids, PLACEMENTS, type Use } from "./casa-furniture"

export const CT = 16
/** First walkable tile row on every floor; everything above is wall and ceiling. */
/** Rows of vaulted ceiling above the back wall; the floor plans below are written from the wall down and shifted by this. */
export const CEIL = 3
export const FLOOR_TOP = 8 + CEIL

export type FloorId = 0 | 1 | 2 | 3 | 4 | 5

export type SpotKind = "exit" | "up" | "down" | "door" | "bed" | "look" | "use"

export type Spot = {
  id: string
  kind: SpotKind
  /** Tile the prompt triggers on (the spot reaches one tile around it). */
  x: number
  y: number
  label: string
  /** For stairs and doors: where you arrive. */
  to?: { floor: FloorId; x: number; y: number }
  /** For looks: what you see. */
  text?: string
  /** For uses: what E does, and which piece (an index of `PLACEMENTS`). */
  use?: Use
  piece?: number
}

export type Floor = {
  id: FloorId
  name: string
  /** Tiles across and down. */
  w: number
  h: number
  /** Solid rectangles in tiles, inclusive: columns, furniture, rails. The wall rows are solid already. */
  solid: Array<[number, number, number, number]>
  spawn: [number, number]
  spots: Spot[]
}

const PLAN: Floor[] = [
  {
    id: 0,
    name: "The Hall",
    w: 32,
    h: 19,
    solid: [
      [0, 8, 2, 9], // the iron lift cage
      [21, 8, 31, 10], // the grand stair, standing on three rows of floor
      [4, 16, 4, 16], // fern
      [27, 16, 27, 16], // fern
    ],
    spawn: [15, 16],
    spots: [
      { id: "out", kind: "exit", x: 15, y: 18, label: "Out to the meadow" },
      { id: "up0", kind: "up", x: 21, y: 11, label: "Up the grand stair", to: { floor: 1, x: 36, y: 12 } },
      { id: "cage", kind: "look", x: 3, y: 10, label: "The iron lift", text: "A cage of white iron vines. It has not moved since before you were born. It would like you to say please." },
      { id: "ticket", kind: "look", x: 6, y: 9, label: "The little window", text: "A wooden window in a tiled nook, shut tight. Behind the glass a lamp is on and nobody is home." },
      { id: "ovals", kind: "door", x: 16, y: 9, label: "Through the oval doors", to: { floor: 3, x: 16, y: 10 } },
    ],
  },
  {
    id: 1,
    name: "The Noble Floor",
    w: 40,
    h: 19,
    solid: [
      [11, 8, 12, 9], // first bone column
      [17, 8, 18, 9], // second
      [34, 8, 39, 10], // the stair up
      [5, 11, 5, 11], // potted palm
      [19, 15, 20, 15], // round ottoman
    ],
    spawn: [20, 14],
    spots: [
      { id: "down1", kind: "down", x: 2, y: 9, label: "Down the stair", to: { floor: 0, x: 24, y: 12 } },
      { id: "up1", kind: "up", x: 34, y: 11, label: "Up to the loft", to: { floor: 2, x: 28, y: 12 } },
      { id: "bay", kind: "look", x: 14, y: 10, label: "Look out of the bay", text: "The whole window is glass discs in blues and greens, and the light that comes through lies on the floor like spilled sweets. Below it the meadow goes on being a meadow." },
      { id: "chandelier", kind: "look", x: 20, y: 13, label: "Look up", text: "A chandelier like an upturned bell, hung from the middle of a ceiling that swirls like cream stirred into tea. Every bead has a tiny window in it." },
      { id: "doors", kind: "door", x: 29, y: 10, label: "Through the folding doors", to: { floor: 4, x: 16, y: 10 } },
    ],
  },
  {
    id: 2,
    name: "The Loft",
    w: 32,
    h: 19,
    solid: [
      [1, 8, 9, 10], // the bed against the wall
      [12, 10, 12, 10], // the lamp post
      [25, 9, 26, 10], // the monstera by the round door
    ],
    spawn: [20, 14],
    spots: [
      { id: "bed", kind: "bed", x: 5, y: 11, label: "Go to bed" },
      { id: "down2", kind: "down", x: 29, y: 9, label: "Down the stair", to: { floor: 1, x: 36, y: 12 } },
      { id: "round", kind: "door", x: 20, y: 9, label: "Through the round door", to: { floor: 5, x: 16, y: 10 } },
      { id: "sky", kind: "look", x: 14, y: 13, label: "Look up", text: "Two skylights shaped like pebbles, each one a hundred small glass ovals held by lead. The sky arrives in pieces and you put it together." },
      { id: "birds", kind: "look", x: 22, y: 12, label: "The little hooks", text: "Dark iron birds on the wall, flying uphill in a line, each one holding up a coat. Not one of them has ever complained." },
    ],
  },
  {
    id: 3,
    name: "The Sunken Lounge",
    w: 32,
    h: 19,
    solid: [],
    spawn: [16, 10],
    spots: [
      { id: "lounge-out", kind: "door", x: 16, y: 9, label: "Back through the oval door", to: { floor: 0, x: 16, y: 10 } },
      { id: "pit", kind: "look", x: 16, y: 17, label: "The sunken floor", text: "The floor steps down in a ring and the bottom is soft as wool. Anything you drop in it is returned at once, with interest." },
      { id: "rounds", kind: "look", x: 4, y: 10, label: "The round windows", text: "Circles cut in the wall, no glass, only the meadow set in them like two green coins. A bee goes through one and out of the other." },
    ],
  },
  {
    id: 4,
    name: "The Glasshouse",
    w: 32,
    h: 19,
    solid: [],
    spawn: [16, 10],
    spots: [
      { id: "glass-out", kind: "door", x: 16, y: 9, label: "Back through the folding doors", to: { floor: 1, x: 29, y: 11 } },
      { id: "lattice", kind: "look", x: 8, y: 11, label: "The green lattice", text: "Iron painted the green of a pond-weed, holding up a sky. Every pane has a very small bird that has never moved in it." },
    ],
  },
  {
    id: 5,
    name: "The Boudoir",
    w: 32,
    h: 19,
    solid: [],
    spawn: [16, 10],
    spots: [
      { id: "boudoir-out", kind: "door", x: 16, y: 9, label: "Back through the round door", to: { floor: 2, x: 20, y: 10 } },
      { id: "blocks", kind: "look", x: 8, y: 9, label: "The glass-block wall", text: "Blocks of thick glass, each with a little bubble caught in it like a held breath. The meadow outside turns into a hundred soft green squares." },
    ],
  },
]

/** The pieces with something to say become looks, standing just in front of their foot line. */
function furnitureLooks(floor: FloorId): Spot[] {
  const out: Spot[] = []
  PLACEMENTS.forEach((p, i) => {
    if (p.floor !== floor || (!p.look && !p.use)) return
    out.push({ id: `${p.id}-${i}`, kind: p.use ? "use" : "look", x: Math.floor(p.x / CT), y: p.wall ? 8 : Math.min(17, Math.floor((p.y - 1) / CT) + 1), label: p.label ?? USE_LABEL[p.use ?? "look"]!.replace("{}", p.id.replace(/-/g, " ")), text: p.look, use: p.use, piece: i })
  })
  return out
}

const USE_LABEL: Record<string, string> = { look: "Look at the {}", lamp: "Switch the {}", sit: "Sit on the {}", music: "Put the music on", rummage: "Rummage in the {}" }

/** The plans with the ceiling rows added: every row moves down by `CEIL`. */
export const FLOORS: Floor[] = PLAN.map((f) => ({
  ...f,
  h: f.h + CEIL,
  solid: [...f.solid, ...furnitureSolids(f.id, CT)].map(([x0, y0, x1, y1]) => [x0, y0 + CEIL, x1, y1 + CEIL] as [number, number, number, number]),
  spawn: [f.spawn[0], f.spawn[1] + CEIL] as [number, number],
  spots: [...f.spots, ...furnitureLooks(f.id)].map((sp) => ({ ...sp, y: sp.y + CEIL, to: sp.to ? { ...sp.to, y: sp.to.y + CEIL } : undefined })),
}))

export const floorOf = (id: FloorId): Floor => FLOORS[id]!

/** Is this pixel on a tile you cannot stand on? */
export function blockedAt(f: Floor, x: number, y: number): boolean {
  const tx = Math.floor(x / CT)
  const ty = Math.floor(y / CT)
  if (tx < 1 || ty < FLOOR_TOP || tx >= f.w - 1 || ty >= f.h) return true
  return f.solid.some(([x0, y0, x1, y1]) => tx >= x0 && tx <= x1 && ty >= y0 && ty <= y1)
}

/** The feet are a small box, so you do not slip through a column's corner. */
const footBlocked = (f: Floor, x: number, y: number) => blockedAt(f, x - 4, y) || blockedAt(f, x + 4, y) || blockedAt(f, x - 4, y - 2) || blockedAt(f, x + 4, y - 2)

export type Walker = {
  floor: FloorId
  x: number
  y: number
  face: 1 | -1
  facing: "side" | "front" | "back"
  moving: boolean
  running: boolean
  /** Sitting on a piece: any step stands you up. */
  sit?: boolean
  pet: { x: number; y: number }
}

export const WALK_SPEED = 54
export const RUN_SPEED = 92

export const center = (t: number) => t * CT + CT / 2

export function newWalker(floor: FloorId = 0, at?: [number, number]): Walker {
  const f = floorOf(floor)
  const [tx, ty] = at ?? f.spawn
  return { floor, x: center(tx), y: center(ty), face: 1, facing: "back", moving: false, running: false, pet: { x: center(tx) - 12, y: center(ty) + 4 } }
}

export function stepWalker(w: Walker, input: { dx: number; dy: number; run: boolean }, dt: number) {
  const f = floorOf(w.floor)
  const wants = Math.hypot(input.dx, input.dy)
  w.moving = wants > 0
  if (w.moving) w.sit = false
  w.running = w.moving && input.run
  if (wants > 0) {
    const speed = (w.running ? RUN_SPEED : WALK_SPEED) * dt
    const vx = (input.dx / wants) * speed
    const vy = (input.dy / wants) * speed
    if (!footBlocked(f, w.x + vx, w.y)) w.x += vx
    if (!footBlocked(f, w.x, w.y + vy)) w.y += vy
    if (vx !== 0) w.face = vx > 0 ? 1 : -1
    w.facing = Math.abs(vx) >= Math.abs(vy) ? "side" : vy < 0 ? "back" : "front"
  }
  const dx = w.x - 11 * w.face - w.pet.x
  const dy = w.y + 2 - w.pet.y
  const dist = Math.hypot(dx, dy)
  if (dist > 3) {
    const step = Math.min(dist, (dist > 40 ? RUN_SPEED * 1.3 : WALK_SPEED * 0.95) * dt)
    w.pet.x += (dx / dist) * step
    w.pet.y += (dy / dist) * step
  }
}

/** The spot within reach of the walker, nearest first. Spots reach about one and a half tiles. */
export function spotNear(w: Walker): Spot | null {
  const f = floorOf(w.floor)
  let best: Spot | null = null
  let bestD = (CT * 1.9) ** 2
  for (const s of f.spots) {
    const d = (center(s.x) - w.x) ** 2 + (center(s.y) - w.y) ** 2
    if (d < bestD) {
      bestD = d
      best = s
    }
  }
  return best
}

/** Take a staircase: the walker appears on the other floor. */
export function takeStairs(w: Walker, spot: Spot) {
  if (!spot.to) return
  const n = newWalker(spot.to.floor, [spot.to.x, spot.to.y])
  w.floor = n.floor
  w.x = n.x
  w.y = n.y
  w.pet = n.pet
  w.facing = "back"
}
