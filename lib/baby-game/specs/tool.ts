/**
 * lib/baby-game/specs/tool.ts — `ToolSpec`: a held tool as parts, a grip, one motion and a few effects on blocks
 *
 * A tool is what makes a noun do something to the world (the Scribblenauts half). The model picks; code owns the rest:
 *  - looks: prop parts on a 16×16 box, plus the `grip` pixel the paw holds, so any body can carry it,
 *  - motion: one kind from `MOTIONS`, a speed and an area. The frames are `MOTION_KEYS`, ours, not the model's,
 *  - effects: up to four rules, each "on this material or block, do this, with this power". `EFFECT_ON` says which
 *    materials each effect can touch, and with `ctx.blocks` the validator refuses a tool that could never work
 *    (a hammer too weak for every stone it names, a turn into a block that does not exist).
 * Blocks are `block.ts` `BlockSpec`. A new effect means new code, never model output.
 *
 * Nothing in the game reads these yet. **Planned:** a Tool BIMBY writes one from a sentence, `render.ts` plays the motion
 * on the companion's paw, and `engine.ts` runs the effects through the same `Result` path as `gather` and `water`.
 */

import { Checker, join, SKILLS, type SpecContext, type SpecError, type SpecSkill } from "./common"
import type { Material } from "./block"
import { MATERIALS } from "./block"
import { checkPart, PROP_TILE, type PropPart } from "./prop"

export const MOTIONS = ["chop", "sweep", "poke", "pour", "dig", "cast", "shake"] as const
export type Motion = (typeof MOTIONS)[number]

/** One frame of a motion: tilt in degrees around the grip (0 is held upright, positive leans forward) and a pixel nudge. */
export type MotionKey = { angle: number; dx: number; dy: number }

/** The frames code plays for each motion, facing right; the renderer mirrors them for left. */
export const MOTION_KEYS: Record<Motion, readonly MotionKey[]> = {
  chop: [{ angle: -50, dx: -1, dy: -2 }, { angle: -20, dx: 0, dy: -1 }, { angle: 60, dx: 2, dy: 1 }, { angle: 30, dx: 1, dy: 0 }],
  sweep: [{ angle: 70, dx: -3, dy: 1 }, { angle: 80, dx: 0, dy: 2 }, { angle: 70, dx: 3, dy: 1 }],
  poke: [{ angle: 80, dx: -1, dy: 0 }, { angle: 85, dx: 3, dy: 0 }, { angle: 80, dx: 0, dy: 0 }],
  pour: [{ angle: 0, dx: 0, dy: 0 }, { angle: 45, dx: 1, dy: 0 }, { angle: 75, dx: 1, dy: 1 }, { angle: 45, dx: 1, dy: 0 }],
  dig: [{ angle: 30, dx: 0, dy: -1 }, { angle: 100, dx: 2, dy: 2 }, { angle: 60, dx: 1, dy: 0 }],
  cast: [{ angle: -70, dx: -1, dy: -1 }, { angle: 20, dx: 1, dy: -1 }, { angle: 90, dx: 3, dy: 0 }],
  shake: [{ angle: -15, dx: 0, dy: -1 }, { angle: 15, dx: 0, dy: -1 }, { angle: -15, dx: 0, dy: -1 }, { angle: 15, dx: 0, dy: 0 }],
}

/** Milliseconds per frame. */
export const SPEEDS = { slow: 140, normal: 100, quick: 70 } as const
export type Speed = keyof typeof SPEEDS

/** Which tiles one use reaches: the tile faced, three in a row ahead, or the 3×3 ahead. */
export const AREAS = ["one", "line", "square"] as const

/**
 * What a tool does to a block. `break` removes it, drops its `drops` and leaves its `becomes`. `harvest` takes the
 * drops and leaves it to regrow. `turn` makes it the `into` ground (tilling). `water` waters a crop. `catch` fishes.
 */
export const EFFECTS = ["break", "harvest", "turn", "water", "catch"] as const
export type Effect = (typeof EFFECTS)[number]

/** The materials each effect can touch. Watering stone or catching in soil is refused before it exists. */
export const EFFECT_ON: Record<Effect, readonly Material[]> = {
  break: ["stone", "wood", "plant", "shell", "snow"],
  harvest: ["plant", "shell", "soil", "sand"],
  turn: ["grass", "soil", "sand", "snow"],
  water: ["soil", "plant"],
  catch: ["water"],
}

/** Effects that must beat the block's hardness. */
const NEEDS_POWER: readonly Effect[] = ["break", "harvest"]

export type ToolEffect = {
  /** A material, or one block id. Exactly one. */
  material?: Material
  block?: string
  does: Effect
  /** 1 to 3; break and harvest work only on blocks no harder than this. */
  power: number
  /** turn: the ground block it leaves. */
  into?: string
}

export type ToolSpec = {
  id: string
  name: string
  /** One line for the bag, like `items.ts` blurbs. */
  blurb: string
  parts: PropPart[]
  /** The pixel the paw holds, inside the 16×16 box. */
  grip: [number, number]
  motion: { kind: Motion; speed: Speed; area: (typeof AREAS)[number] }
  effects: ToolEffect[]
  /** Energy per use. */
  energy: number
  /** The skill one use trains (1 xp). */
  skill?: SpecSkill
  /** Items the Workbench takes to make it. */
  recipe?: string[]
}

const TOOL_KEYS = ["id", "name", "blurb", "parts", "grip", "motion", "effects", "energy", "skill", "recipe"] as const
const EFFECT_KEYS = ["material", "block", "does", "power", "into"] as const
export const MAX_TOOL_PARTS = 16

/** Every reason this value is not a valid `ToolSpec`. Empty means valid. Pass `ctx.blocks` to check effects against blocks. */
export function validateToolSpec(spec: unknown, ctx: SpecContext = {}): SpecError[] {
  const c = new Checker()
  if (!c.obj(spec, "")) return c.errors
  c.only(spec, "", TOOL_KEYS)
  c.id(spec.id, "id")
  c.str(spec.name, "name", 40)
  c.str(spec.blurb, "blurb", 100)
  c.num(spec.energy, "energy", 0, 6, true)
  if (spec.skill !== undefined) c.oneOf(spec.skill, "skill", SKILLS)

  const box: [number, number] = [PROP_TILE, PROP_TILE]
  if (c.arr(spec.parts, "parts", 1, MAX_TOOL_PARTS)) spec.parts.forEach((p, i) => checkPart(c, p, join("parts", i), box))
  if (c.arr(spec.grip, "grip", 2, 2)) {
    const [x, y] = spec.grip
    if (!Number.isInteger(x) || !Number.isInteger(y) || (x as number) < 0 || (y as number) < 0 || (x as number) >= PROP_TILE || (y as number) >= PROP_TILE)
      c.fail("grip", `must be a whole pixel inside the ${PROP_TILE}×${PROP_TILE} box`)
  }

  if (c.obj(spec.motion, "motion")) {
    c.only(spec.motion, "motion", ["kind", "speed", "area"])
    c.oneOf(spec.motion.kind, "motion.kind", MOTIONS)
    c.oneOf(spec.motion.speed, "motion.speed", Object.keys(SPEEDS) as Speed[])
    c.oneOf(spec.motion.area, "motion.area", AREAS)
  }

  if (c.arr(spec.effects, "effects", 1, 4)) {
    const seen = new Set<string>()
    spec.effects.forEach((e, i) => {
      const key = checkEffect(c, e, join("effects", i), ctx)
      if (key && seen.has(key)) c.fail(join("effects", i), "repeats another effect")
      if (key) seen.add(key)
    })
  }

  if (spec.recipe !== undefined && c.arr(spec.recipe, "recipe", 1, 3)) spec.recipe.forEach((id, i) => c.item(id, join("recipe", i), ctx))
  return c.errors
}

/** Checks one effect; returns a key for spotting repeats. */
function checkEffect(c: Checker, e: unknown, path: string, ctx: SpecContext): string | undefined {
  if (!c.obj(e, path)) return
  c.only(e, path, EFFECT_KEYS)
  if (!c.oneOf(e.does, join(path, "does"), EFFECTS)) return
  const does = e.does as Effect
  const okPower = c.num(e.power, join(path, "power"), 1, 3, true)
  const allowed = EFFECT_ON[does]

  if ((e.material === undefined) === (e.block === undefined)) {
    c.fail(path, "takes exactly one of: material, block")
    return
  }
  let targets = ctx.blocks
  if (e.material !== undefined) {
    if (!c.oneOf(e.material, join(path, "material"), MATERIALS)) return
    if (!allowed.includes(e.material as Material)) c.fail(join(path, "material"), `${does} works only on: ${allowed.join(", ")}`)
    targets = ctx.blocks?.filter((b) => b.material === e.material)
  } else {
    if (!c.id(e.block, join(path, "block"))) return
    const b = ctx.blocks?.find((x) => x.id === e.block)
    if (ctx.blocks && !b) c.fail(join(path, "block"), `is not a known block: ${e.block}`)
    if (b && !allowed.includes(b.material as Material)) c.fail(join(path, "block"), `${b.id} is ${b.material}; ${does} works only on: ${allowed.join(", ")}`)
    targets = b ? [b] : undefined
  }

  if (okPower && NEEDS_POWER.includes(does) && targets && targets.length > 0 && !targets.some((b) => b.hardness <= (e.power as number)))
    c.fail(join(path, "power"), `is too weak to ${does} any of: ${targets.map((b) => b.id).join(", ")}`)

  if (does === "turn") {
    if (e.into === undefined) c.fail(join(path, "into"), "is required for turn")
    else if (c.id(e.into, join(path, "into"))) {
      const into = ctx.blocks?.find((b) => b.id === e.into)
      if (ctx.blocks && !into) c.fail(join(path, "into"), `is not a known block: ${e.into}`)
      if (into && into.layer !== "ground") c.fail(join(path, "into"), "must be a ground block")
      if (e.into === e.block) c.fail(join(path, "into"), "must be a different block")
    }
  } else if (e.into !== undefined) c.fail(join(path, "into"), `is only for turn, not ${does}`)

  return `${does}:${String(e.material ?? e.block)}`
}
