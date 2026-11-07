/**
 * lib/baby-game/flora.ts — Which small plants grow where (pure)
 *
 * The ground of Valdivia is dotted with plants drawn in ComfyUI and snapped to sprites (`flora-sprites.ts`, see
 * `scripts/baby-flora-queue.mjs`). A flower tile always grows one; a plain grass tile now and then. Which kind is
 * decided by the zone's list and a hash of the tile, so the same tile always grows the same plant. Scenery only: nothing
 * here changes a rule.
 */

import type { ZoneId } from "./regions"

/** Kinds by zone, most common first (the hash favours the start of the list). A zone not listed uses `DEFAULT_FLORA`. */
export const FLORA: Partial<Record<ZoneId, string[]>> = {
  meadow: ["daisy", "poppy", "buttercup", "clover", "tulip", "pompom"],
  orchard: ["tulip", "pompom", "daisy", "bluebell", "buttercup", "berrybush"],
  wood: ["fern", "mushroom", "moss", "foxglove", "calathea", "glowshroom"],
  cove: ["snowdrop", "moss", "tillandsia"],
  hill: ["moss", "clover", "succulent", "sprout"],
  barn: ["clover", "buttercup", "sprout", "dunegrass"],
  pond: ["iris", "cattail", "clover", "lilypad", "daisy"],
  highlands: ["lavender", "bluebell", "orchid", "foxglove", "pompom", "tillandsia"],
  lake: ["iris", "cattail", "daisy", "buttercup", "bluebell"],
  marsh: ["glowshroom", "iris", "cattail", "fern", "mushroom", "lilypad"],
  stacks: ["moss", "fern", "tillandsia", "mushroom", "sprout"],
  dunes: ["cactus", "dunegrass", "succulent", "tillandsia"],
  rhizome: ["daisy", "pompom", "lavender", "monstera", "tulip", "berrybush"],
}
export const DEFAULT_FLORA = ["daisy", "clover", "buttercup", "tulip", "bluebell"]

/** Share of plain grass tiles that grow a plant, so the lawn is not bare between flower tiles. */
export const GRASS_FLORA = 0.04

/** The kind that grows on this tile, given the zone's list and a hash in [0, 1). Squared so the first kinds are common and the last rare. */
export function floraKind(zone: ZoneId | null, r: number, have: (id: string) => boolean): string | null {
  const list = (zone && FLORA[zone]) || DEFAULT_FLORA
  const known = list.filter(have)
  if (!known.length) return null
  return known[Math.min(known.length - 1, Math.floor(r * r * known.length))]!
}
