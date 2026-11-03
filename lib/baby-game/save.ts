/**
 * lib/baby-game/save.ts — One village save, in this browser
 *
 * `brain2-baby-game`. The village is shared by every friend you open the game from; only the follower changes.
 * It is play progress, not a vault: it never goes to the hub, and nothing here touches tasks, habits, or points.
 */

import { persistKey } from "@/lib/storage-keys"
import { newGame, type GameState } from "./engine"

const key = () => persistKey("baby-game")

export function loadGame(): GameState {
  try {
    const raw = localStorage.getItem(key())
    if (!raw) return newGame()
    const saved = JSON.parse(raw) as Partial<GameState>
    if (saved?.v !== 1) return newGame()
    const base = newGame()
    return { ...base, ...saved, stats: { ...base.stats, ...saved.stats }, real: saved.real ?? [], made: saved.made ?? {}, questsDone: saved.questsDone ?? {}, inv: saved.inv ?? base.inv, animals: saved.animals ?? {} } as GameState
  } catch {
    return newGame()
  }
}

export function saveGame(s: GameState): void {
  try {
    localStorage.setItem(key(), JSON.stringify(s))
  } catch {
    // a full or blocked store: the game keeps running, the save just is not kept
  }
}

export function resetGame(): GameState {
  try {
    localStorage.removeItem(key())
  } catch {
    // nothing to clear
  }
  return newGame()
}
