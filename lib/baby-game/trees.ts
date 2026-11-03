/**
 * lib/baby-game/trees.ts — Tree life: felled stumps, saplings, young trees, and seeds that spread (pure, no clock)
 *
 * `world.ts` scatters the starting trees as `T.TREE` tiles, the same every time. `GameState.trees` holds only what the
 * player's village has changed since: a tile you felled (`cut`), a seedling that blew in (`seed`), or a stump you cleared
 * (`bare`). A tile with no record is a full-grown tree that was always there. `stageOf` turns a record and the day into a
 * stage; `syncTrees` writes the stage's solidity into `world.tiles` (young and mature trees block, the rest are walkable);
 * `growTrees` runs each night and lets mature trees seed a free tile nearby.
 */

import { MAP_H, MAP_W, T, tileIndex, zoneAt, type World } from "./world"
import type { GameState } from "./engine"

/** `cut`: felled on day `t`. `seed`: a seedling that sprouted on day `t`. `bare`: a cleared stump, open ground until a seed lands. */
export type TreeRec = { k: "cut" | "seed" | "bare"; t: number }
export type TreeStage = "stump" | "seedling" | "sapling" | "young" | "mature" | "bare"

/** A stump left alone for this many nights sprouts a seedling from its roots. */
export const STUMP_DAYS = 2
/** Nights of growth: seedling until 2, sapling until 4, young until 7, then mature. */
const SAPLING_AT = 2
const YOUNG_AT = 4
const MATURE_AT = 7
/** Chance per night that one mature tree drops a seed on a free tile within three tiles. */
export const SPREAD_CHANCE = 0.1
/** Most trees (standing or growing) allowed in the 7×7 around a new seedling. */
const CROWD_MAX = 12

export function stageOf(rec: TreeRec | undefined, day: number): TreeStage {
  if (!rec) return "mature"
  if (rec.k === "bare") return "bare"
  const age = day - rec.t
  const grown = rec.k === "cut" ? age - STUMP_DAYS : age
  if (grown < 0) return "stump"
  return grown < SAPLING_AT ? "seedling" : grown < YOUNG_AT ? "sapling" : grown < MATURE_AT ? "young" : "mature"
}

/** Young and mature trees block the path; stumps, seedlings and saplings are walked over. */
export const treeSolid = (stage: TreeStage) => stage === "young" || stage === "mature"

/** What a tree tile looks like once the tree is gone: the wood floor is dark, everywhere else grass. */
const groundAt = (tx: number, ty: number) => (zoneAt(tx, ty) === "wood" ? T.DARK : T.GRASS)

/** Make `world.tiles` agree with the trees' stages. Cheap: only tiles with a record are touched. */
export function syncTrees(world: World, s: GameState): void {
  for (const [key, rec] of Object.entries(s.trees ?? {})) {
    const i = Number(key)
    const tx = i % MAP_W
    const ty = Math.floor(i / MAP_W)
    world.tiles[i] = treeSolid(stageOf(rec, s.day)) ? T.TREE : groundAt(tx, ty)
  }
}

function hash(a: number, b: number, c = 0): number {
  let t = Math.imul(a, 374761393) ^ Math.imul(b, 668265263) ^ Math.imul(c + 1, 2147483629)
  t = Math.imul(t ^ (t >>> 15), 2246822519)
  t = Math.imul(t ^ (t >>> 13), 3266489917)
  return ((t ^ (t >>> 16)) >>> 0) / 4294967296
}

/** Is a tree standing or growing on this tile (any stage but bare)? */
function occupied(world: World, s: GameState, i: number): boolean {
  const rec = s.trees?.[i]
  if (rec) return rec.k !== "bare"
  return world.tiles[i] === T.TREE
}

/** Does a seedling at (nx, ny) touch no other tree and sit out of a crowd? */
function roomFor(world: World, s: GameState, sprouted: Record<number, TreeRec>, nx: number, ny: number): boolean {
  let crowd = 0
  for (let y = -3; y <= 3; y++) {
    for (let x = -3; x <= 3; x++) {
      if (nx + x < 0 || ny + y < 0 || nx + x >= MAP_W || ny + y >= MAP_H) continue
      const k = tileIndex(nx + x, ny + y)
      if (!occupied(world, s, k) && !sprouted[k]) continue
      if (Math.abs(x) <= 1 && Math.abs(y) <= 1) return false
      crowd += 1
    }
  }
  return crowd <= CROWD_MAX
}

/**
 * The night's growth: each mature tree may seed one free tile within three tiles. A tile must be grass, a flower patch or wood floor,
 * not held for a station, node, prop, home or friend, not touch another tree, and not be in a crowd. Returns a new state;
 * the same `world` and `s` always give the same seeds. Call after `sleep` so `s.day` is the new morning.
 */
export function growTrees(world: World, s: GameState): GameState {
  const sprouted: Record<number, TreeRec> = {}
  for (let ty = 0; ty < MAP_H; ty++) {
    for (let tx = 0; tx < MAP_W; tx++) {
      const i = tileIndex(tx, ty)
      if (world.tiles[i] !== T.TREE || stageOf(s.trees?.[i], s.day) !== "mature") continue
      if (hash(i, s.day, 1) >= SPREAD_CHANCE) continue
      const zone = zoneAt(tx, ty)
      const open: number[] = []
      for (let dy = -3; dy <= 3; dy++) {
        for (let dx = -3; dx <= 3; dx++) {
          const nx = tx + dx
          const ny = ty + dy
          if ((!dx && !dy) || nx < 1 || ny < 1 || nx >= MAP_W - 1 || ny >= MAP_H - 1) continue
          const j = tileIndex(nx, ny)
          if (sprouted[j] || world.held.has(j) || world.stationSolid.has(j) || zoneAt(nx, ny) !== zone) continue
          const ground = world.tiles[j]
          if (zone === "wood" ? ground !== T.DARK : ground !== T.GRASS && ground !== T.FLOWER) continue
          if (!roomFor(world, s, sprouted, nx, ny)) continue
          open.push(j)
        }
      }
      if (open.length) sprouted[open[Math.floor(hash(i, s.day, 2) * open.length)]!] = { k: "seed", t: s.day }
    }
  }
  if (!Object.keys(sprouted).length) return s
  return { ...s, trees: { ...(s.trees ?? {}), ...sprouted } }
}
