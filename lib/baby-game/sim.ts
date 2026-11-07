/**
 * lib/baby-game/sim.ts — The realtime half: walking, where friends stand, who is close
 *
 * Mutable on purpose: the canvas loop calls `stepSim` every frame and reads the same object. Nothing here
 * decides a rule; it only moves bodies. A friend's day is a spot and a wander radius; at dusk the social
 * ones walk to the campfire (BFS through open tiles, so gates matter); in the hour before bed everyone walks home
 * (`homes.ts`) and sleeps on their doorstep; in rain the ones who do not love it stop wandering and hold a leaf over their head.
 * The rest of the day follows each friend's schedule (`mind.ts` `blockAt`): their spot, home, the bookshelf, the fire, a zone,
 * or another friend's spot. Two awake friends who come within reach stop and face each other; `stepSim` queues the pair in
 * `sim.met` and the UI has them talk (`chatter.ts`). A friend `reading` stays at their bookshelf until the UI lets them go.
 */

import { RESIDENTS, inValley, isShy, type Resident } from "./cast"
import { CROPS } from "./farm"
import { act as actOf, isAsleep, nodeReady, type GameState } from "./engine"
import { homeDoor, homeOf, HOME_NOUN, HOMES } from "./homes"
import { propLabel } from "./props"
import { stageOf } from "./trees"
import { blockAt, ZONE_ACT, type Place } from "./mind"
import { EXTENT_H, EXTENT_W, FIRE_SLOTS, isSolidTile, MAP_H, MAP_W, NODES, PLOTS, PROPS, STATIONS, T, TILE, tileIndex, ZONES, type GameNode, type PropKind, type StationId, type World } from "./world"

export const WALK = 54
export const RUN = 92
const NPC_SPEED = 15
const TALK_REACH = 22
const SPOOK_REACH = 44
/** How close two friends must come to stop and talk, and how long before the same pair, or either of them, talks again (sim seconds). */
const MEET_REACH = TILE * 1.6
const PAIR_COOLDOWN = 120
const SOLO_COOLDOWN = 35
/** Seeking: how far (tiles) a free friend looks for company, how often they decide to, and how long they keep at it (sim seconds). */
const SEEK_RANGE = 26
const SEEK_GIVE_UP = 40
const SEEK_REPATH = 2.5

export type Npc = {
  id: string
  x: number
  y: number
  goal: string
  path: Array<[number, number]>
  wait: number
  face: 1 | -1
  asleep: boolean
  gathering: boolean
  /** What their schedule says they are doing, for the Village panel. */
  doing: string
  /** Stopped to talk until this `sim.clock`. */
  talkUntil: number
  /** Who they are talking to. */
  with: string
  /** At the bookshelf; set and cleared by the UI. */
  reading: boolean
  /** What they do there when it is not reading ("studying at the bookshelf"); cleared with `reading`. */
  shelfDoing?: string
  /** Who they are walking over to for a chat; empty when not seeking. */
  seek: string
  /** `sim.clock` at which they stop looking for that friend. */
  seekUntil: number
  /** `sim.clock` when the path to the sought friend was last drawn. */
  seekPathAt: number
}

export type Sim = {
  px: number
  py: number
  face: 1 | -1
  /** Which way the player is walking, for choosing a side or front sprite. */
  facing: "side" | "front" | "back"
  moving: boolean
  running: boolean
  clock: number
  npcs: Record<string, Npc>
  pet: { x: number; y: number }
  /** Pairs who just met and should talk; the UI drains it. */
  met: Array<[string, string]>
  /** `sim.clock` when a pair (`a|b`) or a friend last started a talk. */
  lastTalk: Record<string, number>
}

export const center = (t: number) => t * TILE + TILE / 2

export function newSim(spawn: [number, number], s: GameState, world?: World): Sim {
  const npcs: Record<string, Npc> = {}
  let gather = 0
  // Friends start where they would be right now, so a saved evening opens with everyone at the fire.
  for (const r of RESIDENTS) {
    const asleep = isAsleep(r, s.minutes)
    const anchor = anchorFor(r, s, gather, world)
    if (anchor.gathering && !asleep) gather += 1
    const tile = asleep ? bedOf(r) : anchor.tile
    npcs[r.id] = {
      id: r.id, x: center(tile[0]), y: center(tile[1]), goal: asleep ? "day" : anchor.goal, path: [], wait: Math.random() * 2, face: 1, asleep,
      gathering: anchor.gathering && !asleep, doing: asleep ? "asleep" : anchor.doing, talkUntil: 0, with: "", reading: false, seek: "", seekUntil: 0, seekPathAt: 0,
    }
  }
  return { px: center(spawn[0]), py: center(spawn[1]), face: 1, facing: "front", moving: false, running: false, clock: 0, npcs, pet: { x: center(spawn[0]) - 12, y: center(spawn[1]) }, met: [], lastTalk: {} }
}

function walkable(world: World, x: number, y: number, a: number) {
  return !isSolidTile(world, Math.floor(x / TILE), Math.floor(y / TILE), a)
}

function blocked(world: World, x: number, y: number, a: number, noclip = false) {
  if (noclip) return x < 4 || y < 4 || x > EXTENT_W * TILE - 4 || y > EXTENT_H * TILE - 4
  return [[-4, 1], [4, 1], [-4, 4], [4, 4]].some(([dx, dy]) => !walkable(world, x + dx!, y + dy!, a))
}

function bfs(world: World, from: [number, number], to: [number, number], a: number): Array<[number, number]> {
  const key = (x: number, y: number) => y * MAP_W + x
  const prev = new Map<number, number>([[key(...from), -1]])
  const queue: Array<[number, number]> = [from]
  while (queue.length) {
    const [x, y] = queue.shift()!
    if (x === to[0] && y === to[1]) break
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
      const nx = x + dx
      const ny = y + dy
      if (nx < 0 || ny < 0 || nx >= MAP_W || ny >= MAP_H || prev.has(key(nx, ny)) || isSolidTile(world, nx, ny, a)) continue
      prev.set(key(nx, ny), key(x, y))
      queue.push([nx, ny])
    }
  }
  if (!prev.has(key(...to))) return []
  const out: Array<[number, number]> = []
  for (let k = key(...to); k !== -1 && k !== key(...from); k = prev.get(k)!) out.unshift([k % MAP_W, Math.floor(k / MAP_W)])
  return out
}

/** Where a friend sleeps: their home's doorstep, or their day spot if they have no home. */
export const bedOf = (r: Resident): [number, number] => {
  const h = homeOf(r.id)
  return h ? homeDoor(h) : r.day
}

/** The hour before a friend falls asleep. */
export function bedtime(r: Resident, minutes: number): boolean {
  const [from] = r.sleeps ?? [22, 6]
  return Math.floor(minutes / 60) % 24 === (from + 23) % 24
}

export type Anchor = { tile: [number, number]; goal: string; radius: number; gathering: boolean; doing: string }

const zoneTiles = new WeakMap<World, Map<string, [number, number]>>()

/** An open tile near the middle of a zone (gates ignored; the walk there still has to get through them). */
export function zoneTile(zone: string, world?: World): [number, number] | null {
  const z = ZONES[zone as keyof typeof ZONES]
  if (!z) return null
  const mid: [number, number] = [Math.round((z.x0 + z.x1) / 2), Math.round((z.y0 + z.y1) / 2)]
  if (!world) return mid
  let cache = zoneTiles.get(world)
  if (!cache) zoneTiles.set(world, (cache = new Map()))
  const hit = cache.get(zone)
  if (hit) return hit
  let found = mid
  search: for (let r = 0; r < 8; r++) {
    for (let dy = -r; dy <= r; dy++) {
      for (let dx = -r; dx <= r; dx++) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue
        if (!isSolidTile(world, mid[0] + dx, mid[1] + dy, 9)) {
          found = [mid[0] + dx, mid[1] + dy]
          break search
        }
      }
    }
  }
  cache.set(zone, found)
  return found
}

/** Where a schedule place is, as a tile and a wander radius; null when it is out of reach this act. */
function placeAnchor(place: Place, r: Resident, a: number, world?: World): { tile: [number, number]; radius: number } | null {
  if (place === "spot") return { tile: r.day, radius: 2 }
  if (place === "home" || place === "read") return { tile: bedOf(r), radius: 0 }
  if (place.startsWith("zone:")) {
    const zone = place.slice(5)
    if ((ZONE_ACT[zone as keyof typeof ZONE_ACT] ?? 9) > a) return null
    const tile = zoneTile(zone, world)
    return tile ? { tile, radius: 3 } : null
  }
  if (place.startsWith("friend:")) {
    const pal = RESIDENTS.find((x) => x.id === place.slice(7))
    if (!pal || !inValley(pal, a)) return null
    const beside: [number, number] = [pal.day[0] + 1, pal.day[1]]
    return { tile: world && isSolidTile(world, beside[0], beside[1], a) ? pal.day : beside, radius: 1 }
  }
  return null
}

/** Where a friend wants to be right now, as a tile, with a label for the goal, a wander radius, and what they are doing. */
export function anchorFor(r: Resident, s: GameState, gatherIndex: number, world?: World): Anchor {
  if (bedtime(r, s.minutes)) return { tile: bedOf(r), goal: "home", radius: 0, gathering: false, doing: "heading home to bed" }
  const a = actOf(s)
  const fire = (doing: string): Anchor => ({ tile: FIRE_SLOTS[gatherIndex % FIRE_SLOTS.length]!, goal: `fire${gatherIndex}`, radius: 0, gathering: true, doing })
  // an urgent real-life worry draws the social ones to the fire, any hour they are awake
  const awake = !isAsleep(r, s.minutes)
  const council = (s.real ?? []).some((t) => !t.done && t.urgent)
  if (council && awake && r.social && r.act <= a) return fire("at the council fire")
  const sheltering = s.weather === "rain" && !r.rainLover
  const block = blockAt(s.minds?.[r.id], s.day, Math.floor(s.minutes / 60) % 24)
  if (!block) {
    // no mind (an old test state): the original day, dusk at the fire for the social ones
    if (s.minutes >= 18 * 60 && awake && r.social && r.act <= a) return fire("sitting by the fire")
    return { tile: r.day, goal: "day", radius: sheltering ? 0 : 2, gathering: false, doing: "about" }
  }
  if (block.place === "fire" && r.act <= a) return fire(block.doing)
  const at = block.place === "fire" ? null : placeAnchor(block.place, r, a, world)
  if (!at || block.place === "spot") return { tile: r.day, goal: "day", radius: sheltering ? 0 : 2, gathering: false, doing: block.doing }
  return { tile: at.tile, goal: block.place, radius: sheltering ? 0 : at.radius, gathering: false, doing: block.doing }
}

function pickWander(world: World, tile: [number, number], radius: number, a: number, rand: () => number): [number, number] {
  for (let i = 0; i < 6; i++) {
    const x = tile[0] + Math.round((rand() * 2 - 1) * radius)
    const y = tile[1] + Math.round((rand() * 2 - 1) * radius)
    if (!isSolidTile(world, x, y, a)) return [x, y]
  }
  return tile
}

/** `noclip` and `speed` are development-mode powers (`dev.ts`); play never sets them. */
export type StepInput = { dx: number; dy: number; run: boolean; noclip?: boolean; speed?: number }

/** Move everything by `dt` seconds. Returns ids of shy friends the player just startled. */
export function stepSim(sim: Sim, world: World, s: GameState, input: StepInput, dt: number, rand: () => number): string[] {
  const a = actOf(s)
  sim.clock += dt
  const wants = Math.hypot(input.dx, input.dy)
  sim.moving = wants > 0
  sim.running = sim.moving && input.run && s.energy > 0
  if (wants > 0) {
    const speed = (sim.running ? RUN : WALK) * (input.speed ?? 1) * dt
    const vx = (input.dx / wants) * speed
    const vy = (input.dy / wants) * speed
    if (!blocked(world, sim.px + vx, sim.py, a, input.noclip)) sim.px += vx
    if (!blocked(world, sim.px, sim.py + vy, a, input.noclip)) sim.py += vy
    if (vx !== 0) sim.face = vx > 0 ? 1 : -1
    sim.facing = Math.abs(vx) >= Math.abs(vy) ? "side" : vy < 0 ? "back" : "front"
  }

  // the companion trails the player
  const dx = sim.px - 11 * sim.face - sim.pet.x
  const dy = sim.py + 2 - sim.pet.y
  const dist = Math.hypot(dx, dy)
  if (dist > 3) {
    const step = Math.min(dist, (dist > 40 ? RUN * 1.3 : WALK * 0.95) * dt)
    sim.pet.x += (dx / dist) * step
    sim.pet.y += (dy / dist) * step
  }

  let gatherIndex = 0
  const startled: string[] = []
  for (const r of RESIDENTS) {
    const npc = sim.npcs[r.id]!
    if (!inValley(r, a)) continue
    npc.asleep = isAsleep(r, s.minutes)
    if (npc.asleep) {
      // asleep at home; anyone who never made it back (a dev time skip, a late council) is tucked in at once
      const [bx, by] = bedOf(r)
      npc.path = []
      npc.goal = "home"
      npc.x = center(bx)
      npc.y = center(by)
      continue
    }
    const anchor = anchorFor(r, s, gatherIndex, world)
    if (anchor.gathering) gatherIndex += 1
    npc.gathering = anchor.gathering
    npc.doing = npc.reading ? npc.shelfDoing ?? "reading at the bookshelf" : npc.talkUntil > sim.clock ? `talking with ${RESIDENTS.find((x) => x.id === npc.with)?.name ?? "a friend"}` : anchor.doing
    // talking or reading: stand still until it is over
    if (npc.talkUntil > sim.clock || npc.reading) continue
    const seeking = seekStep(sim, world, npc, anchor, a)
    if (!seeking && npc.goal !== anchor.goal) {
      npc.goal = anchor.goal
      npc.path = bfs(world, [Math.floor(npc.x / TILE), Math.floor(npc.y / TILE)], anchor.tile, a)
    }
    if (seeking) {
      // walking toward a friend: no idle wait
    } else if (npc.wait > 0) {
      npc.wait -= dt
    } else if (!npc.path.length) {
      npc.wait = 1.5 + rand() * 3
      if (!npc.seek && anchor.goal !== "home" && !anchor.gathering && trySeek(sim, s, r, npc, a, rand)) continue
      if (anchor.radius > 0) npc.path = bfs(world, [Math.floor(npc.x / TILE), Math.floor(npc.y / TILE)], pickWander(world, anchor.tile, anchor.radius, a, rand), a)
    }
    // shy friends flee a runner
    if (isShy(r.id) && sim.running && Math.hypot(npc.x - sim.px, npc.y - sim.py) < SPOOK_REACH) startled.push(r.id)
    const next = npc.path[0]
    if (next) {
      const tx = center(next[0])
      const ty = center(next[1])
      const d = Math.hypot(tx - npc.x, ty - npc.y)
      const step = NPC_SPEED * dt * (startled.includes(r.id) ? 2.2 : 1)
      if (d <= step) {
        npc.x = tx
        npc.y = ty
        npc.path.shift()
      } else {
        npc.x += ((tx - npc.x) / d) * step
        npc.y += ((ty - npc.y) / d) * step
        npc.face = tx > npc.x ? 1 : -1
      }
    }
  }
  meet(sim, a)
  return startled
}

/** Is the friend `q` a fair one to walk to: awake, out, not busy, and not just talked with `p`? */
function seekable(sim: Sim, p: Npc, q: Npc): boolean {
  if (q.asleep || q.reading || q.goal === "home" || q.talkUntil > sim.clock) return false
  return sim.clock - (sim.lastTalk[[p.id, q.id].sort().join("|")] ?? -1e9) >= PAIR_COOLDOWN
}

/** A friend with nothing in their step may decide to go find someone: social ones often, the rest now and then, liking friends best. */
function trySeek(sim: Sim, s: GameState, r: Resident, npc: Npc, a: number, rand: () => number): boolean {
  if (sim.clock - (sim.lastTalk[npc.id] ?? -1e9) <= SOLO_COOLDOWN) return false
  if (rand() > (r.social ? 0.75 : 0.35)) return false
  const bonds = s.minds?.[r.id]?.bonds ?? {}
  let best: { id: string; score: number } | null = null
  for (const o of RESIDENTS) {
    if (o.id === r.id || !inValley(o, a)) continue
    const q = sim.npcs[o.id]
    if (!q || !seekable(sim, npc, q)) continue
    const dist = Math.hypot(q.x - npc.x, q.y - npc.y) / TILE
    if (dist > SEEK_RANGE) continue
    const score = (bonds[o.id] ?? 0) * 2 + (o.social ? 1 : 0) - dist * 0.15 + rand() * 2
    if (!best || score > best.score) best = { id: o.id, score }
  }
  if (!best) return false
  npc.seek = best.id
  npc.seekUntil = sim.clock + SEEK_GIVE_UP
  npc.seekPathAt = -1e9
  return true
}

/** Keep walking toward the sought friend. Returns true while seeking; clears the seek when it is over. */
function seekStep(sim: Sim, world: World, npc: Npc, anchor: Anchor, a: number): boolean {
  if (!npc.seek) return false
  const target = sim.npcs[npc.seek]
  const stop = !target || sim.clock > npc.seekUntil || anchor.goal === "home" || anchor.gathering || !seekable(sim, npc, target)
  if (stop) {
    npc.seek = ""
    npc.goal = ""
    npc.path = []
    return false
  }
  if (sim.clock - npc.seekPathAt > SEEK_REPATH) {
    npc.seekPathAt = sim.clock
    npc.path = bfs(world, [Math.floor(npc.x / TILE), Math.floor(npc.y / TILE)], [Math.floor(target.x / TILE), Math.floor(target.y / TILE)], a)
    if (!npc.path.length) { npc.seek = ""; npc.goal = ""; return false }
  }
  return true
}

/** Is this friend free to start a talk: awake, out, not heading to bed, not busy, not just talked? */
function free(sim: Sim, npc: Npc): boolean {
  return !npc.asleep && !npc.reading && npc.goal !== "home" && npc.talkUntil <= sim.clock && sim.clock - (sim.lastTalk[npc.id] ?? -1e9) > SOLO_COOLDOWN
}

/** Pairs of free friends within reach of each other stop, face each other, and are queued in `sim.met`. */
function meet(sim: Sim, a: number) {
  const here = RESIDENTS.filter((r) => inValley(r, a) && free(sim, sim.npcs[r.id]!))
  for (let i = 0; i < here.length; i++) {
    const p = sim.npcs[here[i]!.id]!
    if (!free(sim, p)) continue
    for (let j = i + 1; j < here.length; j++) {
      const q = sim.npcs[here[j]!.id]!
      if (!free(sim, q) || Math.hypot(p.x - q.x, p.y - q.y) > MEET_REACH) continue
      const pair = [p.id, q.id].sort().join("|")
      if (sim.clock - (sim.lastTalk[pair] ?? -1e9) < PAIR_COOLDOWN) continue
      sim.lastTalk[pair] = sim.lastTalk[p.id] = sim.lastTalk[q.id] = sim.clock
      // a first guess at how long; the UI stretches it to fit what they actually say
      p.talkUntil = q.talkUntil = sim.clock + 8
      p.with = q.id
      q.with = p.id
      p.path = []
      q.path = []
      p.face = q.x >= p.x ? 1 : -1
      q.face = p.x >= q.x ? 1 : -1
      sim.met.push([p.id, q.id])
      break
    }
  }
}

/** Keep a pair standing together a while longer (the talk is longer than the first guess). */
export function holdTalk(sim: Sim, a: string, b: string, seconds: number) {
  for (const id of [a, b]) {
    const npc = sim.npcs[id]
    if (npc) npc.talkUntil = Math.max(npc.talkUntil, sim.clock + seconds)
  }
}

export type Target =
  | { kind: "npc"; id: string; x: number; y: number; label: string }
  | { kind: "node"; node: GameNode; x: number; y: number; label: string }
  | { kind: "station"; id: StationId; x: number; y: number; label: string }
  | { kind: "plot"; id: string; x: number; y: number; label: string }
  | { kind: "prop"; index: number; prop: PropKind; x: number; y: number; label: string }
  | { kind: "home"; id: string; x: number; y: number; label: string }
  | { kind: "tree"; idx: number; stage: "mature" | "stump"; x: number; y: number; label: string }

const NODE_LABEL: Record<string, string> = {
  berry: "Pick berries", acorn: "Gather acorns", reed: "Cut reeds", clover: "Pick clover", pebble: "Pick up pebbles",
  feather: "Find a feather", mushroom: "Pick mushrooms", shell: "Gather shells", dig: "Dig", fish: "Fish",
}

/** The nearest thing to talk to or gather. Pass `world` to include fellable trees and stumps within reach. */
export function nearest(sim: Sim, s: GameState, world?: World): Target | null {
  let best: Target | null = null
  let bestD = 1e9
  const a = actOf(s)
  const consider = (t: Target, reach: number) => {
    const d = Math.hypot(t.x - sim.px, t.y - sim.py)
    if (d <= reach && d < bestD) {
      best = t
      bestD = d
    }
  }
  for (const r of RESIDENTS) {
    if (!inValley(r, a)) continue
    const npc = sim.npcs[r.id]!
    consider({ kind: "npc", id: r.id, x: npc.x, y: npc.y, label: `Talk to ${r.name}` }, TALK_REACH)
  }
  for (const [id, st] of Object.entries(STATIONS) as Array<[StationId, (typeof STATIONS)[StationId]]>) {
    consider({ kind: "station", id, x: center(st.x), y: center(st.y), label: st.label }, TALK_REACH + 4)
  }
  for (const pl of PLOTS) {
    const p = s.farm[pl.id]
    const label = !p?.tilled ? "Till the soil" : !p.crop ? "Plant seeds" : p.grown >= (CROPS[p.crop]?.days ?? 99) ? "Harvest" : p.watered ? "Check the crop" : "Water the crop"
    consider({ kind: "plot", id: pl.id, x: center(pl.x), y: center(pl.y), label }, TALK_REACH - 9)
  }
  for (const r of RESIDENTS) {
    const h = HOMES[r.id]
    if (!h || !inValley(r, a)) continue
    consider({ kind: "home", id: r.id, x: center(h.x), y: center(h.y), label: `Knock at ${r.name}'s ${HOME_NOUN[h.kind]}` }, TALK_REACH)
  }
  PROPS.forEach((p, index) => consider({ kind: "prop", index, prop: p.kind, x: center(p.x), y: center(p.y), label: propLabel(s, index) }, TALK_REACH))
  if (world) {
    const [ptx, pty] = [Math.floor(sim.px / TILE), Math.floor(sim.py / TILE)]
    for (let ty = pty - 2; ty <= pty + 2; ty++) {
      for (let tx = ptx - 2; tx <= ptx + 2; tx++) {
        if (tx < 0 || ty < 0 || tx >= MAP_W || ty >= MAP_H) continue
        const idx = tileIndex(tx, ty)
        const stage = stageOf(s.trees?.[idx], s.day)
        if (stage === "mature" && world.tiles[idx] === T.TREE) consider({ kind: "tree", idx, stage, x: center(tx), y: center(ty), label: "Chop the tree" }, TALK_REACH + 2)
        else if (stage === "stump") consider({ kind: "tree", idx, stage, x: center(tx), y: center(ty), label: "Dig out the stump" }, TALK_REACH - 6)
      }
    }
  }
  for (const node of NODES) if (nodeReady(s, node.id)) consider({ kind: "node", node, x: center(node.x), y: center(node.y), label: NODE_LABEL[node.kind] ?? "Gather" }, TALK_REACH - 4)
  return best
}

/** Awake friends within three tiles of this one, other than themselves and the player. */
export function crowdNear(sim: Sim, s: GameState, id: string): number {
  const me = sim.npcs[id]
  if (!me) return 0
  let n = 0
  for (const r of RESIDENTS) {
    if (r.id === id || !inValley(r, actOf(s))) continue
    const other = sim.npcs[r.id]!
    if (!other.asleep && Math.hypot(other.x - me.x, other.y - me.y) < TILE * 3) n += 1
  }
  return n
}

/** Put the player (and the companion beside them) on a tile at once. Development mode's teleport. */
export function teleport(sim: Sim, tile: [number, number]) {
  sim.px = center(tile[0])
  sim.py = center(tile[1])
  sim.pet.x = sim.px - 12
  sim.pet.y = sim.py
}

export const tileOf = (sim: Sim): [number, number] => [Math.floor(sim.px / TILE), Math.floor(sim.py / TILE)]
export { tileIndex }

/** What happens when you knock at a friend's home: asleep inside, home and waving, or out. */
export function knockLine(sim: Sim, s: GameState, id: string): string {
  const r = RESIDENTS.find((x) => x.id === id)
  const h = HOMES[id]
  const npc = sim.npcs[id]
  if (!r || !h || !npc) return "Nobody lives here."
  if (isAsleep(r, s.minutes)) return `Tiny snores come from ${h.name}. ${r.name} is asleep.`
  const [dx, dy] = homeDoor(h)
  if (Math.hypot(npc.x - center(dx), npc.y - center(dy)) < TILE * 2) return `${r.name} peeks out of ${h.name} and waves.`
  return npc.gathering ? `Nobody answers at ${h.name}. ${r.name} is at the campfire.` : `Nobody answers at ${h.name}. ${r.name} is out and about.`
}
