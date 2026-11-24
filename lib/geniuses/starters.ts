/**
 * lib/geniuses/starters.ts — The three starter geniuses, unbound
 *
 * Names and faces are placeholders (`docs/GENIUSES.md` "Open decisions" 1). Bindings start empty: you bind them in the lab
 * or, later, in Gallery Details.
 */

import { emptyBindings } from "./sanitize"
import type { Genius } from "./types"

export const STARTER_GENIUSES: readonly Omit<Genius, "createdAt">[] = [
  {
    id: "genius-hearth",
    name: "Hearth",
    animalId: "hedgehog",
    area: "Daily habits and rituals",
    charter: "I want your days to have a steady floor: the small habits done, every day, without drama.",
    bindings: emptyBindings(),
    notes: [],
    origin: "starter",
    status: "active",
  },
  {
    id: "genius-coin",
    name: "Coin",
    animalId: "raccoon",
    area: "Budget and making money",
    charter: "I want the budget kept and your income growing, one logged lead and one cooked meal at a time.",
    bindings: emptyBindings(),
    notes: [],
    origin: "starter",
    status: "active",
  },
  {
    id: "genius-muse",
    name: "Muse",
    animalId: "crow",
    area: "Creative work and one project",
    charter: "I want your creative project finished and out in the world, not perfect, finished.",
    bindings: emptyBindings(),
    notes: [],
    origin: "starter",
    status: "active",
  },
]

export const starterGeniuses = (now = new Date().toISOString()): Genius[] =>
  STARTER_GENIUSES.map((g) => ({ ...g, bindings: emptyBindings(), notes: [], createdAt: now }))
