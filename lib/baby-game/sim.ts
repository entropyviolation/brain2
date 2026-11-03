/**
 * lib/baby-game/sim.ts — The realtime half: walking, where friends stand, who is close
 *
 * Mutable on purpose: the canvas loop calls `stepSim` every frame and reads the same object. Nothing here
 * decides a rule; it only moves bodies. A friend's day is a spot and a wander radius; at dusk the social
 * ones walk to the campfire (BFS through open tiles, so gates matter); the sleepy ones stay put and snore;
 * in rain the ones who do not love it stop wandering and hold a leaf over their head.
 */

import { RESIDENTS, isShy, type Resident } from "./cast"
import { act as actOf, isAsleep, type GameState } from "./engine"
import { FIRE_SLOTS, isSolidTile, MAP_H, MAP_W, NODES, STATIONS, TILE, tileIndex, type GameNode, type StationId, type World } from "./world"

export const WALK = 54
export const RUN = 92
const NPC_SPEED = 15
const TALK_REACH = 22
const SPOOK_REACH = 44

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
}

export type Sim = {
  px: number
  py: number
  face: 1 | -1
  moving: boolean
  running: boolean
  clock: number
  npcs: Record<string, Npc>
  pet: { x: number; y: number }
}

export const center = (t: number) => t * TILE + TILE / 2

export function newSim(spawn: [number, number], s: GameState): Sim {
  const npcs: Record<string, Npc> = {}
  let gather = 0
  // Friends start where they would be right now, so a saved evening opens with everyone at the fire.
  for (const r of RESIDENTS) {
    const asleep = isAsleep(r, s.minutes)
    const anchor = anchorFor(r, s, gather)
    if (anchor.gathering && !asleep) gather += 1
    const tile = asleep ? r.day : anchor.tile
    npcs[r.id] = { id: r.id, x: center(tile[0]), y: center(tile[1]), goal: asleep ? "day" : anchor.goal, path: [], wait: Math.random() * 2, face: 1, asleep, gathering: anchor.gathering && !asleep }
  }
  return { px: center(spawn[0]), py: center(spawn[1]), face: 1, moving: false, running: false, clock: 0, npcs, pet: { x: center(spawn[0]) - 12, y: center(spawn[1]) } }
}

function walkable(world: World, x: number, y: number, a: number) {
  return !isSolidTile(world, Math.floor(x / TILE), Math.floor(y / TILE), a)
}

function blocked(world: World, x: number, y: number, a: number) {
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

/** Where a friend wants to be right now, as a tile, with a label for the goal and a wander radius. */
export function anchorFor(r: Resident, s: GameState, gatherIndex: number): { tile: [number, number]; goal: string; radius: number; gathering: boolean } {
  const evening = s.minutes >= 18 * 60 && !isAsleep(r, s.minutes)
  if (evening && r.social && r.act <= actOf(s)) {
    const slot = FIRE_SLOTS[gatherIndex % FIRE_SLOTS.length]!
    return { tile: slot, goal: `fire${gatherIndex}`, radius: 0, gathering: true }
  }
  const sheltering = s.weather === "rain" && !r.rainLover
  return { tile: r.day, goal: "day", radius: sheltering ? 0 : 2, gathering: false }
}

function pickWander(world: World, tile: [number, number], radius: number, a: number, rand: () => number): [number, number] {
  for (let i = 0; i < 6; i++) {
    const x = tile[0] + Math.round((rand() * 2 - 1) * radius)
    const y = tile[1] + Math.round((rand() * 2 - 1) * radius)
    if (!isSolidTile(world, x, y, a)) return [x, y]
  }
  return tile
}

export type StepInput = { dx: number; dy: number; run: boolean }

/** Move everything by `dt` seconds. Returns ids of shy friends the player just startled. */
export function stepSim(sim: Sim, world: World, s: GameState, input: StepInput, dt: number, rand: () => number): string[] {
  const a = actOf(s)
  sim.clock += dt
  const wants = Math.hypot(input.dx, input.dy)
  sim.moving = wants > 0
  sim.running = sim.moving && input.run && s.energy > 0
  if (wants > 0) {
    const speed = (sim.running ? RUN : WALK) * dt
    const vx = (input.dx / wants) * speed
    const vy = (input.dy / wants) * speed
    if (!blocked(world, sim.px + vx, sim.py, a)) sim.px += vx
    if (!blocked(world, sim.px, sim.py + vy, a)) sim.py += vy
    if (vx !== 0) sim.face = vx > 0 ? 1 : -1
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
    if (r.act > a) continue
    npc.asleep = isAsleep(r, s.minutes)
    if (npc.asleep) {
      npc.path = []
      continue
    }
    const anchor = anchorFor(r, s, gatherIndex)
    if (anchor.gathering) gatherIndex += 1
    npc.gathering = anchor.gathering
    if (npc.goal !== anchor.goal) {
      npc.goal = anchor.goal
      npc.path = bfs(world, [Math.floor(npc.x / TILE), Math.floor(npc.y / TILE)], anchor.tile, a)
    }
    if (npc.wait > 0) {
      npc.wait -= dt
    } else if (!npc.path.length) {
      npc.wait = 1.5 + rand() * 3
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
  return startled
}

export type Target =
  | { kind: "npc"; id: string; x: number; y: number; label: string }
  | { kind: "node"; node: GameNode; x: number; y: number; label: string }
  | { kind: "station"; id: StationId; x: number; y: number; label: string }

const NODE_LABEL: Record<string, string> = {
  berry: "Pick berries", acorn: "Gather acorns", reed: "Cut reeds", clover: "Pick clover", pebble: "Pick up pebbles",
  feather: "Find a feather", mushroom: "Pick mushrooms", shell: "Gather shells", dig: "Dig", fish: "Fish",
}

export function nearest(sim: Sim, s: GameState): Target | null {
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
    if (r.act > a) continue
    const npc = sim.npcs[r.id]!
    consider({ kind: "npc", id: r.id, x: npc.x, y: npc.y, label: `Talk to ${r.name}` }, TALK_REACH)
  }
  for (const [id, st] of Object.entries(STATIONS) as Array<[StationId, (typeof STATIONS)[StationId]]>) {
    consider({ kind: "station", id, x: center(st.x), y: center(st.y), label: st.label }, TALK_REACH + 4)
  }
  for (const node of NODES) consider({ kind: "node", node, x: center(node.x), y: center(node.y), label: NODE_LABEL[node.kind] ?? "Gather" }, TALK_REACH - 4)
  return best
}

/** Awake friends within three tiles of this one, other than themselves and the player. */
export function crowdNear(sim: Sim, s: GameState, id: string): number {
  const me = sim.npcs[id]
  if (!me) return 0
  let n = 0
  for (const r of RESIDENTS) {
    if (r.id === id || r.act > actOf(s)) continue
    const other = sim.npcs[r.id]!
    if (!other.asleep && Math.hypot(other.x - me.x, other.y - me.y) < TILE * 3) n += 1
  }
  return n
}

export const tileOf = (sim: Sim): [number, number] => [Math.floor(sim.px / TILE), Math.floor(sim.py / TILE)]
export { tileIndex }
