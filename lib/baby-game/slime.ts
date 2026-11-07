/**
 * lib/baby-game/slime.ts — the slime mold as a creature that spreads over the map and remembers
 *
 * One body for the whole world, made of cells two tiles wide (`CELL`). Each cell holds a mass, 0 to 1. The two slime props
 * in `PROPS` are its hearts and never go out. From them it creeps over open ground: faster at night and in rain, slower
 * at dusk and dawn, and in the noon sun it draws back into its thick roads.
 *
 * Its memory is the thing real slime molds have: the tubes stay thick where good things happened. `like` is that, per
 * cell, from -1 to 1. Walking over it, a friend resting on it, and being fed all raise it; fire lowers it. A liked cell
 * keeps a floor of mass through the day and is where new patches sprout at night. A short list of `memory` lines is kept
 * for it to speak from (`slimeThought`). Pure: the caller hands in the clock, the weather, who is where, and a random.
 */

import { EXTENT_H, EXTENT_W, MAP_H, MAP_W, PROPS, STATIONS, T, TILE, tileIndex, zoneAt, ZONES, type World } from "./world"

/** A cell is this many tiles wide. */
export const CELL = 2
export const CW = MAP_W / CELL
const CX_MAX = Math.floor(EXTENT_W / CELL)
const CY_MAX = Math.floor(EXTENT_H / CELL)

export const cellOf = (tx: number, ty: number) => Math.floor(ty / CELL) * CW + Math.floor(tx / CELL)
export const cellX = (i: number) => i % CW
export const cellY = (i: number) => Math.floor(i / CW)
/** World pixel of a cell's centre. */
export const cellCentre = (i: number) => ({ x: cellX(i) * CELL * TILE + (CELL * TILE) / 2, y: cellY(i) * CELL * TILE + (CELL * TILE) / 2 })

export type SlimeMood = "curious" | "hungry" | "content" | "wary"
export type SlimeMemoryKind = "born" | "fed" | "burned" | "walked" | "friend" | "rain" | "dream"
export type SlimeMemory = { day: number; kind: SlimeMemoryKind; cell: number; text: string }

export type SlimeState = {
  v: 1
  /** Mass per cell, 0..1, only where there is any. */
  mass: Record<number, number>
  /** What it remembers about a cell, -1 (it hurt) to 1 (it was good). Fades over a week or so. */
  like: Record<number, number>
  /** The cells it can never leave: the slime props. */
  hearts: number[]
  /** 0..1: how grown it is. Sets how many cells it may hold. Rises with days and with being fed. */
  size: number
  fed: number
  fedDay: number
  hurtAt: number
  tick: number
  day: number
  /** How many cells it held when this day began, for the dream line. */
  cellsAtDawn: number
  memory: SlimeMemory[]
  thought: string
  /** Last day each friend was noted on it, by id. */
  met: Record<string, number>
  rainDay: number
  burnDay: number
}

export type SlimeWalker = { id: string; name: string; tx: number; ty: number }

export type SlimeCtx = {
  day: number
  hour: number
  weather: string
  /** The player, in tiles. Null while asleep or away. */
  player: { tx: number; ty: number } | null
  walkers: SlimeWalker[]
  fireLit: boolean
  ground: (cell: number) => boolean
  rand: () => number
}

const MEMORY_CAP = 28

/** Tiles it will cross, roots and boulders included (it creeps under them). Water, walls, gates, farm soil and anything built stay clear. */
const GROUND = new Set<number>([T.GRASS, T.FLOWER, T.PATH, T.SAND, T.DARK, T.SNOW, T.HILL, T.TREE, T.ROCK])
const grounds = new WeakMap<World, Uint8Array>()

/** Which cells it may hold: mostly open ground, inside the built world, away from stations. */
export function groundOf(world: World): (cell: number) => boolean {
  let g = grounds.get(world)
  if (!g) {
    g = new Uint8Array(CW * (MAP_H / CELL))
    for (let cy = 0; cy < CY_MAX; cy++) {
      for (let cx = 0; cx < CX_MAX; cx++) {
        let open = 0
        for (let dy = 0; dy < CELL; dy++) for (let dx = 0; dx < CELL; dx++) if (GROUND.has(world.tiles[tileIndex(cx * CELL + dx, cy * CELL + dy)]!)) open += 1
        g[cy * CW + cx] = open >= 3 ? 1 : 0
      }
    }
    for (const st of Object.values(STATIONS)) {
      const c = cellOf(st.x, st.y)
      g[c] = 0
    }
    for (const p of PROPS) if (p.kind === "slime") g[cellOf(p.x, p.y)] = 1
    grounds.set(world, g)
  }
  const gg = g
  return (cell) => gg[cell] === 1
}

const neighbours = (i: number): number[] => {
  const cx = cellX(i)
  const cy = cellY(i)
  const out: number[] = []
  if (cx > 0) out.push(i - 1)
  if (cx < CX_MAX - 1) out.push(i + 1)
  if (cy > 0) out.push(i - CW)
  if (cy < CY_MAX - 1) out.push(i + CW)
  return out
}

const dist = (a: number, b: number) => Math.abs(cellX(a) - cellX(b)) + Math.abs(cellY(a) - cellY(b))
const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v))
const round3 = (v: number) => Math.round(v * 1000) / 1000

export function heartCells(): number[] {
  return PROPS.filter((p) => p.kind === "slime").map((p) => cellOf(p.x, p.y))
}

/** A young slime: each heart and the cells round it, remembering only that it began. */
export function newSlime(): SlimeState {
  const hearts = heartCells()
  const mass: Record<number, number> = {}
  for (const h of hearts) {
    mass[h] = 1
    for (const n of neighbours(h)) mass[n] = 0.55
  }
  return {
    v: 1, mass, like: {}, hearts, size: 0.2, fed: 0, fedDay: 0, hurtAt: -9999, tick: 0, day: 1, cellsAtDawn: Object.keys(mass).length,
    memory: [{ day: 1, kind: "born", cell: hearts[0] ?? 0, text: "I woke in a log, as one wet thought." }],
    thought: "I woke in a log, as one wet thought.", met: {}, rainDay: 0, burnDay: 0,
  }
}

/** A saved slime from before the fields below existed still loads. */
export function refreshSlime(raw: Partial<SlimeState> | undefined): SlimeState {
  const base = newSlime()
  if (!raw || raw.v !== 1) return base
  return { ...base, ...raw, mass: raw.mass ?? base.mass, like: raw.like ?? {}, hearts: heartCells(), memory: raw.memory ?? base.memory, met: raw.met ?? {} }
}

export const cellCount = (s: SlimeState) => Object.keys(s.mass).length
/** How many cells it may hold at its size. */
export const capOf = (s: SlimeState) => Math.round(36 + 640 * s.size)

export function moodOf(s: SlimeState, day: number): SlimeMood {
  if (s.tick - s.hurtAt < 160) return "wary"
  if (s.fed > 0 && day - s.fedDay <= 1) return "content"
  if (s.fedDay > 0 && day - s.fedDay > 3) return "hungry"
  if (s.fedDay === 0 && day > 4) return "hungry"
  return "curious"
}

const zoneName = (cell: number) => {
  const z = zoneAt(cellX(cell) * CELL, cellY(cell) * CELL)
  return z ? ZONES[z].name : "the wild wood"
}

function remember(s: SlimeState, day: number, kind: SlimeMemoryKind, cell: number, text: string) {
  // the same kind in the same place on the same day is one memory, not many
  if (s.memory.some((m) => m.day === day && m.kind === kind && zoneName(m.cell) === zoneName(cell) && (kind !== "friend" || m.text === text))) return
  s.memory.push({ day, kind, cell, text })
  if (s.memory.length > MEMORY_CAP) s.memory.splice(1, s.memory.length - MEMORY_CAP)
}

const bump = (like: Record<number, number>, cell: number, by: number) => {
  like[cell] = round3(clamp((like[cell] ?? 0) + by, -1, 1))
}

/** Advance one second. Returns a new state; the old one is untouched. */
export function tickSlime(prev: SlimeState, c: SlimeCtx): SlimeState {
  const s: SlimeState = { ...prev, mass: { ...prev.mass }, like: { ...prev.like }, memory: [...prev.memory], met: { ...prev.met } }
  s.tick += 1

  // a new day: it dreams through a night's growth, then counts where it stands
  if (c.day > s.day) {
    const before = cellCount(s)
    for (let i = 0; i < 30; i++) step(s, { ...c, hour: 2, player: null, walkers: [], rand: c.rand }, true)
    const grew = cellCount(s) - before
    s.size = clamp(s.size + 0.012 * (c.day - s.day), 0, 1)
    if (grew > 2) remember(s, c.day, "dream", s.hearts[0] ?? 0, `In the night of day ${s.day} I spread over ${grew} new patches.`)
    s.day = c.day
    s.cellsAtDawn = cellCount(s)
  }
  step(s, c, false)
  if (s.tick % 40 === 1) s.thought = slimeThought(s, c)
  return s
}

function step(s: SlimeState, c: SlimeCtx, dreaming: boolean) {
  const night = c.hour >= 19 || c.hour < 6
  const rain = c.weather === "rain"
  const sun = !night && !rain && c.hour >= 10 && c.hour < 16
  const mood = moodOf(s, c.day)
  const fireCell = cellOf(STATIONS.fire.x, STATIONS.fire.y)
  const playerCell = c.player ? cellOf(c.player.tx, c.player.ty) : -1
  const cap = capOf(s)
  let count = cellCount(s)

  // it learns from where things stand on it
  if (!dreaming) {
    if (playerCell >= 0 && c.ground(playerCell) && mood !== "wary") {
      bump(s.like, playerCell, s.mass[playerCell] ? 0.04 : 0.02)
      for (const n of neighbours(playerCell)) bump(s.like, n, 0.01)
      if ((s.like[playerCell] ?? 0) > 0.55 && (s.mass[playerCell] ?? 0) > 0.2) remember(s, c.day, "walked", playerCell, `You cross ${zoneName(playerCell)} so often that I grew a road there.`)
    }
    for (const w of c.walkers) {
      const wc = cellOf(w.tx, w.ty)
      if ((s.mass[wc] ?? 0) < 0.3 || s.met[w.id] === c.day) continue
      s.met[w.id] = c.day
      bump(s.like, wc, 0.25)
      remember(s, c.day, "friend", wc, `${w.name} walked over me in ${zoneName(wc)}. I held still and liked it.`)
    }
    if (rain && s.rainDay !== c.day && count > 0) {
      s.rainDay = c.day
      remember(s, c.day, "rain", s.hearts[0] ?? 0, `Rain on day ${c.day}. I drank and spread.`)
    }
  }

  const desire = (j: number): number => {
    let d = 0.6 + 0.8 * (s.like[j] ?? 0)
    if (night) d += 0.5
    if (rain) d += 0.5
    if (sun) d -= 0.3
    if (playerCell >= 0) {
      const pd = dist(j, playerCell)
      if (mood === "wary" && pd <= 4) d -= 0.6
      else if ((mood === "curious" || mood === "content") && pd <= 6) d += 0.35
    }
    if (c.fireLit && dist(j, fireCell) <= 2) d -= 2
    return d
  }

  // it spreads into open neighbours, and sometimes sprouts where it remembers being happy
  for (const [k, m] of Object.entries(s.mass)) {
    if (m < 0.3) continue
    const i = +k
    for (const j of neighbours(i)) {
      if (!c.ground(j)) continue
      const d = desire(j)
      if (d <= 0 || c.rand() > 0.07 * d * m) continue
      if (s.mass[j] === undefined) {
        if (count >= cap) continue
        s.mass[j] = 0.14
        count += 1
      } else s.mass[j] = round3(Math.min(1, s.mass[j]! + 0.06))
    }
  }
  if (night && count < cap && c.rand() < 0.04) {
    const liked = Object.entries(s.like).filter(([k, v]) => v > 0.5 && s.mass[+k] === undefined && c.ground(+k))
    if (liked.length) {
      const [k] = liked[Math.floor(c.rand() * liked.length)]!
      s.mass[+k] = 0.2
      count += 1
    }
  }

  // each cell leans toward what it is fed by: a heart nearby, a remembered road, the night, the rain
  const hearts = s.hearts
  for (const [k, m] of Object.entries(s.mass)) {
    const i = +k
    let near = 99
    for (const h of hearts) near = Math.min(near, dist(i, h))
    const like = Math.max(0, s.like[i] ?? 0)
    let target = near <= 7 ? 1 - 0.1 * near : 0.22 + 0.7 * like
    target = Math.max(target, 0.22 + 0.7 * like)
    if (night) target += 0.25
    if (rain) target += 0.2
    if (sun) target -= 0.3
    if (near === 0) target = 1
    target = clamp(target, -0.2, 1)
    let next = m + (target - m) * 0.03

    // fire hurts, and it does not forget
    if (c.fireLit && dist(i, fireCell) <= 2 && !dreaming) {
      next -= 0.2
      bump(s.like, i, -0.4)
      s.hurtAt = s.tick
      if (m > 0.1 && s.burnDay !== c.day) {
        s.burnDay = c.day
        remember(s, c.day, "burned", i, `Fire in ${zoneName(i)} on day ${c.day}. I pulled back, and I remember.`)
      }
    }
    if ((next < 0.04 || !c.ground(i)) && !hearts.includes(i)) {
      delete s.mass[i]
      continue
    }
    s.mass[i] = round3(Math.min(1, next))
  }

  // over the cap it gives up its thinnest, least-loved edges
  if (count > cap) {
    const edge = Object.entries(s.mass)
      .filter(([k]) => !hearts.includes(+k) && (s.like[+k] ?? 0) < 0.3)
      .sort((a, b) => a[1] - b[1])
    for (let n = 0; n < Math.min(edge.length, count - cap); n++) delete s.mass[+edge[n]![0]]
  }

  // memory fades, slowly: about a week
  if (s.tick % 10 === 0) {
    for (const [k, v] of Object.entries(s.like)) {
      const f = round3(v * 0.997)
      if (Math.abs(f) < 0.03) delete s.like[+k]
      else s.like[+k] = f
    }
  }
  s.size = clamp(s.size + 0.00004, 0, 1)
}

/** Something edible set down at a cell: it swells there, grows, and is glad. */
export function feedSlime(prev: SlimeState, cell: number, what: string, day: number): SlimeState {
  const s: SlimeState = { ...prev, mass: { ...prev.mass }, like: { ...prev.like }, memory: [...prev.memory] }
  s.mass[cell] = 1
  for (const n of neighbours(cell)) s.mass[n] = round3(Math.max(s.mass[n] ?? 0, 0.5))
  for (let dx = -2; dx <= 2; dx++) for (let dy = -2; dy <= 2; dy++) {
    const cx = cellX(cell) + dx
    const cy = cellY(cell) + dy
    if (cx < 0 || cy < 0 || cx >= CX_MAX || cy >= CY_MAX) continue
    bump(s.like, cy * CW + cx, 0.7 - 0.15 * (Math.abs(dx) + Math.abs(dy)))
  }
  s.fed += 1
  s.fedDay = day
  s.hurtAt = -9999
  s.size = clamp(s.size + 0.06, 0, 1)
  remember(s, day, "fed", cell, `You fed me ${what} by ${zoneName(cell)} on day ${day}. That road is thick now.`)
  s.thought = s.memory[s.memory.length - 1]!.text
  return s
}

const pickOf = <T,>(rand: () => number, list: readonly T[]) => list[Math.floor(rand() * list.length)]!

/** What it would say now, from its mood, the sky and what it remembers. */
export function slimeThought(s: SlimeState, c: Pick<SlimeCtx, "day" | "hour" | "weather" | "rand">): string {
  const mood = moodOf(s, c.day)
  const night = c.hour >= 19 || c.hour < 6
  const sun = !night && c.weather !== "rain" && c.hour >= 10 && c.hour < 16
  const lines: string[] = []
  const memories = s.memory.filter((m) => m.kind !== "born")
  if (memories.length) for (let i = 0; i < 2; i++) lines.push(pickOf(c.rand, memories).text)
  if (mood === "hungry") lines.push(`Nobody has fed me in ${Math.max(1, c.day - s.fedDay)} days. I am thinning where you do not walk.`)
  if (mood === "content") lines.push("Fed, and warm. My roads are fat where you have been.")
  if (mood === "wary") lines.push("The fire taught me. I keep to the cool places now.")
  if (mood === "curious") lines.push("I have no brain. I have a map, and the map is me.", "You went that way. I will go that way too.")
  if (night) lines.push("Night is when I travel.")
  if (sun) lines.push("Too bright. I am drawing back into my roads.")
  if (c.weather === "rain") lines.push("Rain! Every drop is a door.")
  lines.push(`I am ${cellCount(s)} patches wide, and I remember ${Math.max(0, s.memory.length - 1)} things.`)
  return pickOf(c.rand, lines)
}

/** The nearest cell holding at least `min` mass to a world pixel, with its distance in pixels. */
export function nearestSlime(s: SlimeState, x: number, y: number, min = 0.35): { cell: number; d: number } | null {
  let best: { cell: number; d: number } | null = null
  const px = Math.floor(x / (CELL * TILE))
  const py = Math.floor(y / (CELL * TILE))
  for (let dy = -3; dy <= 3; dy++) {
    for (let dx = -3; dx <= 3; dx++) {
      const i = (py + dy) * CW + (px + dx)
      if ((s.mass[i] ?? 0) < min) continue
      const p = cellCentre(i)
      const d = Math.hypot(p.x - x, p.y - y)
      if (!best || d < best.d) best = { cell: i, d }
    }
  }
  return best
}
