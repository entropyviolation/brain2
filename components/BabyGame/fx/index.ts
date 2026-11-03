import { dust } from "./dust"
import { hearts } from "./hearts"
import { idle } from "./idle"
import { light } from "./light"
import { rain } from "./rain"
import { shake } from "./shake"
import { walk } from "./walk"

export { FX_H, FX_W } from "./types"
export type { Draft, Effect } from "./types"

/** Every effect the lab can play. Add one file, add one line. */
export const EFFECTS = [light, idle, walk, shake, dust, hearts, rain]
