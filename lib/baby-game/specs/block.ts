/**
 * lib/baby-game/specs/block.ts — `BlockSpec`: a ground tile or a thing growing on one, and what tools can do to it
 *
 * Two layers. A `ground` block is a tile under your feet (`world.ts` `T.*`): a base ramp, one pattern from a short list
 * and an accent, painted by code, so a model never draws ground pixel by pixel. A `node` block stands on a tile and is
 * gathered (`world.ts` `NodeKind`): it draws with the prop parts grammar on one 16 px tile. Both carry what a tool needs
 * to act on them: a material from a closed list, a hardness (0 is picked by paw, 3 needs the strongest tool), what it
 * drops, how fast it regrows and what is left when it is broken. A `ToolSpec` (`tool.ts`) names blocks by id or material.
 *
 * Nothing in the game reads these yet. **Planned:** `art.ts` paints `look`, `engine.gather` reads `drops` and `regrow`.
 */

import { Checker, join, type SpecContext, type SpecError } from "./common"
import { checkPart, PROP_TILE, type PropPart } from "./prop"
import { RAMP_NAMES, RAMPS, type RampName } from "./ramps"

export const LAYERS = ["ground", "node"] as const
export type Layer = (typeof LAYERS)[number]

/** What a block is made of. Tools act on materials, so a new block works with every old tool that fits it. */
export const MATERIALS = ["grass", "soil", "sand", "snow", "stone", "wood", "plant", "water", "shell"] as const
export type Material = (typeof MATERIALS)[number]

/** Ground patterns the painter knows: flat, scattered specks, rows, cracked cells, ripples, grass tufts. */
export const PATTERNS = ["plain", "speck", "stripe", "cell", "wave", "tuft"] as const
export const SOUNDS = ["soft", "crunch", "splash", "clink", "rustle"] as const
export const REGROWS = ["never", "day", "week"] as const

/** Water can never be walked on, whatever the spec says. */
const NEVER_WALKABLE: readonly Material[] = ["water"]

export type Swatch = { ramp: RampName; step: number }

export type BlockLook = {
  base: Swatch
  pattern: (typeof PATTERNS)[number]
  /** The pattern's color. Required unless the pattern is `plain`. */
  accent?: Swatch
  /** How much of the tile the pattern covers, 0.05 to 0.6. */
  density?: number
}

export type BlockDrop = {
  item: string
  min: number
  max: number
  /** Leave out for always. Several drops with chances make a dig-spot roll. */
  chance?: number
}

export type BlockSpec = {
  id: string
  name: string
  layer: Layer
  material: Material
  walkable: boolean
  /** 0 picks by paw; a tool must bring at least this much power to break or harvest it. */
  hardness: number
  /** Ground only. */
  look?: BlockLook
  /** Node only: parts on one 16×16 tile. */
  parts?: PropPart[]
  drops: BlockDrop[]
  regrow: (typeof REGROWS)[number]
  /** The ground block left behind when this one is broken or turned. */
  becomes?: string
  sound: (typeof SOUNDS)[number]
}

const BLOCK_KEYS = ["id", "name", "layer", "material", "walkable", "hardness", "look", "parts", "drops", "regrow", "becomes", "sound"] as const
export const MAX_NODE_PARTS = 16

/** Every reason this value is not a valid `BlockSpec`. Empty means valid. `ctx.blocks` checks `becomes`. */
export function validateBlockSpec(spec: unknown, ctx: SpecContext = {}): SpecError[] {
  const c = new Checker()
  if (!c.obj(spec, "")) return c.errors
  c.only(spec, "", BLOCK_KEYS)
  c.id(spec.id, "id")
  c.str(spec.name, "name", 40)
  const layer = c.oneOf(spec.layer, "layer", LAYERS) ? (spec.layer as Layer) : undefined
  const material = c.oneOf(spec.material, "material", MATERIALS) ? (spec.material as Material) : undefined
  if (c.bool(spec.walkable, "walkable") && spec.walkable && material && NEVER_WALKABLE.includes(material)) c.fail("walkable", `${material} cannot be walked on`)
  c.num(spec.hardness, "hardness", 0, 3, true)
  c.oneOf(spec.regrow, "regrow", REGROWS)
  c.oneOf(spec.sound, "sound", SOUNDS)

  if (layer === "ground") {
    if (spec.parts !== undefined) c.fail("parts", "ground is painted from look, not parts")
    checkLook(c, spec.look)
  } else if (layer === "node") {
    if (spec.look !== undefined) c.fail("look", "a node is drawn from parts, not look")
    if (c.arr(spec.parts, "parts", 1, MAX_NODE_PARTS)) spec.parts.forEach((p, i) => checkPart(c, p, join("parts", i), [PROP_TILE, PROP_TILE]))
  }

  if (c.arr(spec.drops, "drops", 0, 4)) spec.drops.forEach((d, i) => checkDrop(c, d, join("drops", i), ctx))
  if (spec.becomes !== undefined && c.id(spec.becomes, "becomes")) {
    if (spec.becomes === spec.id) c.fail("becomes", "must be a different block")
    const left = ctx.blocks?.find((b) => b.id === spec.becomes)
    if (ctx.blocks && !left) c.fail("becomes", `is not a known block: ${spec.becomes}`)
    if (left && left.layer !== "ground") c.fail("becomes", "must be a ground block")
  }
  return c.errors
}

function checkSwatch(c: Checker, v: unknown, path: string) {
  if (!c.obj(v, path)) return
  c.only(v, path, ["ramp", "step"])
  if (c.oneOf(v.ramp, join(path, "ramp"), RAMP_NAMES)) c.num(v.step, join(path, "step"), 0, RAMPS[v.ramp as RampName].length - 1, true)
}

function checkLook(c: Checker, v: unknown) {
  if (!c.obj(v, "look")) return
  c.only(v, "look", ["base", "pattern", "accent", "density"])
  checkSwatch(c, v.base, "look.base")
  const plain = c.oneOf(v.pattern, "look.pattern", PATTERNS) && v.pattern === "plain"
  if (v.accent !== undefined) checkSwatch(c, v.accent, "look.accent")
  else if (!plain) c.fail("look.accent", "is required unless the pattern is plain")
  if (v.density !== undefined) c.num(v.density, "look.density", 0.05, 0.6)
}

function checkDrop(c: Checker, d: unknown, path: string, ctx: SpecContext) {
  if (!c.obj(d, path)) return
  c.only(d, path, ["item", "min", "max", "chance"])
  c.item(d.item, join(path, "item"), ctx)
  const okMin = c.num(d.min, join(path, "min"), 1, 5, true)
  const okMax = c.num(d.max, join(path, "max"), 1, 5, true)
  if (okMin && okMax && (d.min as number) > (d.max as number)) c.fail(path, "min must not be more than max")
  if (d.chance !== undefined) c.num(d.chance, join(path, "chance"), 0.01, 1)
}

/** The facts a tool validator reads from a block list. */
export const blockFacts = (blocks: readonly BlockSpec[]) => blocks.map(({ id, layer, material, hardness }) => ({ id, layer, material, hardness }))
