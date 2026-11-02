/**
 * lib/agents/registry.ts — Every agent the app ships, as Blueprints
 *
 * `builtinBlueprints()` builds them from the shipped flows. A module adds its own with `registerBlueprint`
 * (plan `MOD-1`); the lab lists the union. Nothing here reads storage, so it is safe to call anywhere.
 * The lab passes the person's saved copies to the adapters when it wants to show those instead.
 */

import { bimBlueprints } from "./adapters/bim-flow"
import { listsHelperBlueprint } from "./adapters/lists-helper"
import { habitsBimbyBlueprint } from "./adapters/habit-helper"
import { helperBlueprint } from "./adapters/tracking-helper"
import { validateBlueprint, type Blueprint } from "./blueprint"

const added = new Map<string, Blueprint>()

/** The agents that ship with Brain2. */
export function builtinBlueprints(): Blueprint[] {
  return [helperBlueprint(), listsHelperBlueprint(), habitsBimbyBlueprint(), ...bimBlueprints()]
}

/** Add an agent. Throws on a Blueprint that does not validate or reuses an id. */
export function registerBlueprint(b: Blueprint): void {
  const problems = validateBlueprint(b)
  if (problems.length) throw new Error(`Blueprint "${b.id}" is not sound: ${problems.join("; ")}`)
  if (added.has(b.id) || builtinBlueprints().some((x) => x.id === b.id)) throw new Error(`Blueprint id "${b.id}" is already taken`)
  added.set(b.id, b)
}

export function unregisterBlueprint(id: string): void {
  added.delete(id)
}

/** Shipped agents first, then registered ones in the order added. */
export function listBlueprints(): Blueprint[] {
  return [...builtinBlueprints(), ...added.values()]
}

export function getBlueprint(id: string): Blueprint | undefined {
  return listBlueprints().find((b) => b.id === id)
}
