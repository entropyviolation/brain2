/**
 * lib/baby-game/dev.ts — Development mode: a sandbox village with powers, for building the game
 *
 * Dev mode plays on its own save (`brain2-baby-game-dev`), so nothing you do with powers touches the real village.
 * The flags (`DevFlags`) are kept apart again, under `brain2-baby-game-devflags`. Every power over the game state is a
 * pure function here, so it is tested like the engine; `components/BabyGame/devpanel.tsx` is only the keys.
 */

import { persistKey } from "@/lib/storage-keys"
import { RESIDENTS, resident, setRevealAll } from "./cast"
import { advance, claimQuest, clone, makeErrands, type GameState, type Weather } from "./engine"
import type { Quest } from "./quests"
import { CROPS, SKILL_STEPS } from "./farm"
import { ITEMS, LAMP_PARTS } from "./items"
import { GATES, isSolidTile, MAP_H, MAP_W, NODES, PROPS, STATIONS, ZONES, type World, type ZoneId } from "./world"

export type DevFlags = {
  /** Dev mode itself: the game swaps to the dev save and shows the DEV badge and the ` key. */
  on: boolean
  /** Walk through trees, walls, water and shut gates. The map edge still holds. */
  noclip: boolean
  /** The clock stands still. */
  freeze: boolean
  /** Walking speed multiplier. */
  speed: number
  /** Energy never drops below full. */
  energy: boolean
  /** The bag never runs out of gems to give. (Gems are a gift friends love, not money.) */
  gems: boolean
  /** Tile grid, solid tiles and the player's tile drawn over the world. */
  overlay: boolean
  /** Friends who have not been met or unlocked yet are drawn, walk about, and show on the map. */
  reveal: boolean
  /** The weather you set stays put when a new day would roll a different one. */
  lockWeather?: Weather
}

export const DEV_SPEEDS = [1, 2, 4, 8] as const

/** The next speed up the ladder, wrapping back to 1×. The R key and the quick bar use it. */
export const nextSpeed = (speed: number): number => DEV_SPEEDS[(DEV_SPEEDS.findIndex((x) => x === speed) + 1) % DEV_SPEEDS.length]!

export const blankFlags = (): DevFlags => ({ on: false, noclip: false, freeze: false, speed: 1, energy: false, gems: false, overlay: false, reveal: false })

const flagsKey = () => persistKey("baby-game-devflags")

/** Flags that take effect outside the React tree (the cast's reveal) are pushed there whenever they change. */
export function applyFlags(f: DevFlags): void {
  setRevealAll(f.on && f.reveal)
}

export function loadFlags(): DevFlags {
  try {
    const raw = localStorage.getItem(flagsKey())
    return raw ? { ...blankFlags(), ...(JSON.parse(raw) as Partial<DevFlags>) } : blankFlags()
  } catch {
    return blankFlags()
  }
}

export function saveFlags(f: DevFlags): void {
  try {
    localStorage.setItem(flagsKey(), JSON.stringify(f))
  } catch {
    // flags are a convenience; losing them is fine
  }
}

// ─── teleport ─────────────────────────────────────────────────────────────

export type DevPlace = { group: "zone" | "station" | "friend" | "prop" | "gate"; id: string; label: string; tile: [number, number] }

/** The open tile nearest `at`, searching outward ring by ring, with every gate open. Falls back to `at`. */
export function openTileNear(world: World, at: [number, number]): [number, number] {
  for (let r = 0; r < 12; r++) {
    for (let dy = -r; dy <= r; dy++) {
      for (let dx = -r; dx <= r; dx++) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue
        const x = at[0] + dx
        const y = at[1] + dy
        if (x >= 0 && y >= 0 && x < MAP_W && y < MAP_H && !isSolidTile(world, x, y, 99)) return [x, y]
      }
    }
  }
  return at
}

/** Every place worth jumping to: zone centres, stations, friends' day spots, props and gates. Each lands on an open tile. */
export function devPlaces(world: World): DevPlace[] {
  const out: DevPlace[] = []
  for (const [id, z] of Object.entries(ZONES) as Array<[ZoneId, (typeof ZONES)[ZoneId]]>) {
    out.push({ group: "zone", id, label: z.name, tile: openTileNear(world, [Math.round((z.x0 + z.x1) / 2), Math.round((z.y0 + z.y1) / 2)]) })
  }
  for (const [id, st] of Object.entries(STATIONS)) out.push({ group: "station", id, label: st.label, tile: openTileNear(world, [st.x, st.y + 1]) })
  for (const r of RESIDENTS) out.push({ group: "friend", id: r.id, label: r.name, tile: openTileNear(world, [r.day[0], r.day[1] + 1]) })
  PROPS.forEach((p, i) => out.push({ group: "prop", id: `prop-${i}`, label: p.kind, tile: openTileNear(world, [p.x, p.y + 1]) }))
  GATES.forEach((g, i) => out.push({ group: "gate", id: `gate-${i}`, label: `Gate (act ${g.act})`, tile: openTileNear(world, [g.x, g.y + 1]) }))
  return out
}

// ─── powers over the game state ───────────────────────────────────────────

/** Jump the story to an act (1 to 5) by setting how many Lamp parts are placed. `6` lights the lamp: the ending. */
export function devSetAct(s: GameState, act: number): GameState {
  const n = clone(s)
  const placed = Math.max(0, Math.min(LAMP_PARTS.length, act - 1))
  n.parts = LAMP_PARTS.slice(0, placed) as string[]
  n.ended = placed >= LAMP_PARTS.length
  n.errands = makeErrands(n.day, Math.min(5, placed + 1))
  return n
}

/** Set the clock to a time of day (minutes since midnight, 0..1439) on the current day. */
export function devSetTime(s: GameState, minutes: number): GameState {
  const n = clone(s)
  n.minutes = Math.max(0, Math.min(24 * 60 - 1, Math.round(minutes)))
  return n
}

/** Skip the clock forward without sleeping (the day does not roll over). */
export const devSkip = (s: GameState, minutes: number): GameState => advance(s, minutes)

export function devSetDay(s: GameState, day: number): GameState {
  const n = clone(s)
  n.day = Math.max(1, Math.round(day))
  return n
}

export function devSetWeather(s: GameState, weather: Weather): GameState {
  const n = clone(s)
  n.weather = weather
  return n
}

export function devRefill(s: GameState): GameState {
  const n = clone(s)
  n.energy = n.maxEnergy
  return n
}

/** How many gems unlimited gems keeps in your bag. */
export const DEV_GEMS = 99

/** Add (or take) gems: an item in the bag, not money. */
export function devGems(s: GameState, add: number): GameState {
  return devGive(s, "gem", add)
}

export function devGive(s: GameState, id: string, qty: number): GameState {
  if (!ITEMS[id]) return s
  const n = clone(s)
  n.inv[id] = Math.max(0, (n.inv[id] ?? 0) + qty)
  if (n.inv[id]! > 0) n.found[id] = true
  return n
}

/** `qty` of every item in the game, or of one kind (material, seed, part...). */
export function devGiveAll(s: GameState, qty: number, kind?: string): GameState {
  const n = clone(s)
  for (const def of Object.values(ITEMS)) {
    if (kind && def.kind !== kind) continue
    n.inv[def.id] = (n.inv[def.id] ?? 0) + qty
    n.found[def.id] = true
  }
  return n
}

export function devEmptyBag(s: GameState): GameState {
  const n = clone(s)
  n.inv = {}
  return n
}

/** Set a friend's hearts (0 to 10). Trust is ten a heart. */
export function devSetHearts(s: GameState, id: string, hearts: number): GameState {
  const n = clone(s)
  const base = n.animals[id] ?? { trust: 0, mood: 0, stage: "new", talked: false, gifted: false, approached: false, favored: false, chats: 0, spooked: false, fed: false, played: false, heard: 0, cluedAt: 0 }
  n.animals[id] = { ...base, trust: Math.max(0, Math.min(10, hearts)) * 10 }
  return n
}

export function devAllHearts(s: GameState, hearts: number): GameState {
  return RESIDENTS.reduce((acc, r) => devSetHearts(acc, r.id, hearts), s)
}

/** Clear every friend's once-a-day flags, so talk, gift, favor and approach work again. */
export function devFreshDay(s: GameState): GameState {
  const n = clone(s)
  for (const a of Object.values(n.animals)) Object.assign(a, { talked: false, gifted: false, approached: false, favored: false, fed: false, played: false, spooked: false, chats: 0 })
  n.nodes = {}
  // today's once-a-day stamps (`fire12`, `prop3d12`, `mg:glade:12`, ...) end in the day; older ones and milestones stay
  const today = new RegExp(`\\D${n.day}$`)
  for (const k of Object.keys(n.seen)) if (today.test(k)) delete n.seen[k]
  return n
}

/** Till every plot, water it, and make what is planted ripe now. */
export function devRipen(s: GameState): GameState {
  const n = clone(s)
  for (const p of Object.values(n.farm)) {
    p.tilled = true
    p.watered = true
    if (p.crop) p.grown = CROPS[p.crop]?.days ?? p.grown
  }
  return n
}

/** Every gatherable node ready again today. */
export function devRespawnNodes(s: GameState): GameState {
  const n = clone(s)
  for (const node of NODES) delete n.nodes[node.id]
  for (const k of Object.keys(n.nodes)) if (k.startsWith("prop-")) delete n.nodes[k]
  return n
}

/** Every skill to a level (1 to 5), by the XP that level needs. */
export function devSkills(s: GameState, level: number): GameState {
  const n = clone(s)
  const xp = level <= 1 ? 0 : SKILL_STEPS[Math.min(SKILL_STEPS.length, level - 1) - 1]!
  for (const k of Object.keys(n.skills) as Array<keyof GameState["skills"]>) n.skills[k] = xp
  return n
}

// ─── jumping the story and quests ─────────────────────────────────────────

/** Make a quest ready to claim: its giver in the valley and trusting, and its objective met. Nothing is claimed. */
export function devQuestReady(s: GameState, q: Quest): GameState {
  const giver = resident(q.giver)
  let n = giver && s.parts.length < giver.act - 1 ? devSetAct(s, giver.act) : clone(s)
  const o = q.objective
  switch (o.kind) {
    case "bring": n.inv[o.item] = Math.max(n.inv[o.item] ?? 0, o.qty); n.found[o.item] = true; break
    case "craft": n.made[o.item] = Math.max(n.made[o.item] ?? 0, 1); break
    case "harvest": n.stats.harvests = Math.max(n.stats.harvests, o.n); break
    case "fish": n.stats.fished = Math.max(n.stats.fished, o.n); break
    case "play": n.stats.played = Math.max(n.stats.played, o.n); break
    case "favors": n.stats.favors = Math.max(n.stats.favors, o.n); break
    case "hearts": n = devSetHearts(n, o.id, Math.max(o.n, n.animals[o.id] ? Math.round(n.animals[o.id]!.trust / 10) : 0)); break
  }
  return devSetHearts(n, q.giver, Math.max(2, Math.round((n.animals[q.giver]?.trust ?? 0) / 10)))
}

/** Ready the quest, then claim it: the reward, the trust and the thanks all land. */
export function devQuestDone(s: GameState, q: Quest): GameState {
  const ready = devQuestReady(s, q)
  return claimQuest(ready, q.id).s
}

/** Put a quest back to not-started so it can be run again. */
export function devQuestReset(s: GameState, id: string): GameState {
  const n = clone(s)
  delete n.questsDone[id]
  return n
}
