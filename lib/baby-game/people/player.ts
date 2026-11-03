/**
 * lib/baby-game/people/player.ts — the Center of The World, drawn by the person drawer
 *
 * Her look is one `PersonSpec` (`CENTER_SPEC`, or one saved from the lab). `playerGrid` in `sprites.ts` reads it, and the
 * pose source registered here gives the renderer her walk frames, blinks, breaths and hand-made action poses.
 */

import { clearPeopleCache, drawPerson, type PersonPose } from "./draw"
import { poseSources, type View } from "./registry"
import { CENTER_SPEC, parsePerson, type PersonSpec } from "./spec"

const KEY = "brain2-baby-game-player"

let current: PersonSpec | null = null

/** Her spec: the one saved on this device, else the default. */
export function getPlayerSpec(): PersonSpec {
  if (current) return current
  let spec = CENTER_SPEC
  try {
    const raw = typeof localStorage === "undefined" ? null : localStorage.getItem(KEY)
    if (raw) spec = parsePerson(JSON.parse(raw))
  } catch {
    // private window or bad JSON: the default
  }
  current = spec
  return spec
}

/** Save a new look for her. Callers drop their own sprite caches (a reload does it too). */
export function setPlayerSpec(spec: PersonSpec | null) {
  current = spec ?? CENTER_SPEC
  clearPeopleCache()
  try {
    if (typeof localStorage !== "undefined") {
      if (spec) localStorage.setItem(KEY, JSON.stringify(spec))
      else localStorage.removeItem(KEY)
    }
  } catch {
    // the switch just will not stick
  }
}

/** The idle poses the generic pass makes that a person does not have. */
const POSES: Record<string, PersonPose> = { blink: "blink", breathe: "breathe" }

poseSources.set("player", (view: View, pose: string) => {
  const p = (POSES[pose] ?? pose) as PersonPose
  return drawPerson(getPlayerSpec(), view, p)
})

export function playerGridOf(view: View): string[] {
  return drawPerson(getPlayerSpec(), view, "stand")
}
