/**
 * lib/baby-game/save.ts — One village save, in this browser
 *
 * `brain2-baby-game`. The village is shared by every friend you open the game from; only the follower changes.
 * It is play progress, not a vault: it never goes to the hub, and nothing here touches tasks, habits, or points.
 * Development mode (`dev.ts`) keeps its own sandbox under `brain2-baby-game-dev`, so powers never touch the real village.
 */

import { persistKey } from "@/lib/storage-keys"
import { refreshCharacters } from "./character"
import { refreshMinds } from "./mind"
import { blankCommons, newGame, type GameState } from "./engine"
import { DEFAULT_ECONOMY, ECONOMIES } from "./economy"
import { rekeyTrees } from "./trees"
import { MAP_W } from "./world"

export type SaveSlot = "play" | "dev"

const key = (slot: SaveSlot = "play") => persistKey(slot === "dev" ? "baby-game-dev" : "baby-game")

/** Is there a save in this slot yet? */
export function hasSave(slot: SaveSlot): boolean {
  try {
    return !!localStorage.getItem(key(slot))
  } catch {
    return false
  }
}

export function loadGame(slot: SaveSlot = "play"): GameState {
  try {
    const raw = localStorage.getItem(key(slot))
    if (!raw) return newGame()
    const saved = JSON.parse(raw) as Partial<GameState>
    if (saved?.v !== 1) return newGame()
    const base = newGame()
    // The map grid got wider (80 to 160) on 2026-11-03, so saved tree tiles are re-keyed to the same places.
    if ((saved.mapW ?? 80) !== MAP_W) {
      saved.trees = rekeyTrees(saved.trees, saved.mapW ?? 80, MAP_W)
      saved.mapW = MAP_W
    }
    // A save from before economies (2026-11-02) held buttons as money. The world is a gift commons now, so they come back as gems.
    if (!saved.economy && (saved.buttons ?? 0) > 0) {
      const inv = { ...(saved.inv ?? base.inv) }
      inv.gem = (inv.gem ?? 0) + Math.max(1, Math.round(saved.buttons! * ECONOMIES[DEFAULT_ECONOMY]!.gemRate))
      saved.inv = inv
      saved.buttons = 0
      saved.found = { ...(saved.found ?? {}), gem: true }
    }
    const characters = refreshCharacters(saved.characters)
    return { ...base, ...saved, stats: { ...base.stats, ...saved.stats }, real: saved.real ?? [], made: saved.made ?? {}, questsDone: saved.questsDone ?? {}, inv: saved.inv ?? base.inv, animals: saved.animals ?? {}, commons: { ...blankCommons(), ...saved.commons }, characters, minds: refreshMinds(saved.minds, characters), chatter: Array.isArray(saved.chatter) ? saved.chatter : [], shelves: saved.shelves ?? {} } as GameState
  } catch {
    return newGame()
  }
}

export function saveGame(s: GameState, slot: SaveSlot = "play"): void {
  try {
    localStorage.setItem(key(slot), JSON.stringify(s))
  } catch {
    // a full or blocked store: the game keeps running, the save just is not kept
  }
}

export function resetGame(slot: SaveSlot = "play"): GameState {
  try {
    localStorage.removeItem(key(slot))
  } catch {
    // nothing to clear
  }
  return newGame()
}
