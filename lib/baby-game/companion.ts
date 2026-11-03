/**
 * lib/baby-game/companion.ts — The friend you opened the game from, and what they bring along
 *
 * The companion follows you around Mossmere Hollow in the sprite for their species (a friend that is not one
 * of the twenty gets a stable stand-in picked by their id). What they are good at comes from the weights the
 * app already stores for them: whichever of daily habits, today's To Do, and Next Actions they weigh most.
 * Their bond level (`lib/friend-stats.ts`) is the real-life half: each level past the first is +4 energy
 * and +1 button a morning.
 */

import { speciesPersonality } from "@/lib/baby-animal-personality"
import { hashString } from "@/lib/string-utils"
import { GAME_SPECIES } from "./sprites"

export type PerkId = "routine" | "fetch" | "nose"

export type Perk = { id: PerkId; name: string; blurb: string }

const PERKS: Record<PerkId, Perk> = {
  routine: { id: "routine", name: "Steady paws", blurb: "A habit-minded friend: you wake with 15 extra energy." },
  fetch: { id: "fetch", name: "Fetch", blurb: "A doer: a 30% chance of one extra when you gather." },
  nose: { id: "nose", name: "Nose for next steps", blurb: "A planner: a ! marks any friend you could hand something to." },
}

export function perkFor(animalId: string): Perk {
  const p = speciesPersonality(animalId)
  const best = Math.max(p.habitWeight, p.todoWeight, p.nextActionsWeight)
  if (best === p.habitWeight) return PERKS.routine
  if (best === p.todoWeight) return PERKS.fetch
  return PERKS.nose
}

/** The sprite id for any friend, including uploaded pictures and species outside the twenty. */
export function spriteFor(animalId: string): string {
  if (GAME_SPECIES.includes(animalId)) return animalId
  // the hyrax is a companion-only species, drawn by hand in `hyrax.ts`
  if (/hyrax|dassie/i.test(animalId)) return "hyrax"
  return GAME_SPECIES[hashString(animalId || "friend") % GAME_SPECIES.length]!
}
