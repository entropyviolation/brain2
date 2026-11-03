/**
 * lib/baby-game/specs/prop.ts — `PropSpec`: a prop as parts, ramps, a size and exactly one verb
 *
 * Parts come from a small shape grammar (rect, ellipse, tri, line, dots) on the prop's own pixel box, 16 px per tile.
 * The verb list is what `props.ts` `USES` actually does today, grouped by effect: give an item, heal energy, feast on
 * food you carry, reveal tomorrow, grow crops, teach a skill, trade buttons for a find, cheer every friend, rewind the
 * clock, or open an existing screen (`PROP_SCREEN`). Each verb takes a fixed set of arguments (`VERB_ARGS`); a few side
 * fields (a chance item, a little xp, a risk) may ride along with any verb. A new verb means new code, never model output.
 *
 * Nothing in the game reads these yet. **Planned:** a spec painter in `realize/` draws `parts`, and `props.ts` runs `use`.
 */

import { Checker, join, SKILLS, type SpecContext, type SpecError, type SpecSkill } from "./common"
import { RAMP_NAMES, RAMPS, type RampName } from "./ramps"

/** Pixels per tile, as in `render.ts`. */
export const PROP_TILE = 16

export const SHAPES = ["rect", "ellipse", "tri", "line", "dots"] as const
export type Shape = (typeof SHAPES)[number]

/** How many numbers `at` holds for each shape. `dots` takes x,y pairs, 1 to 12 of them. */
export const SHAPE_ARITY: Record<Shape, string> = {
  rect: "[x, y, w, h]",
  ellipse: "[x, y, w, h] (the box it fills)",
  tri: "[ax, ay, bx, by, cx, cy]",
  line: "[x0, y0, x1, y1]",
  dots: "[x, y, x, y, ...]",
}

export const ANIMS = ["bob", "twinkle", "ripple", "swing", "spin", "glow"] as const
export type Anim = (typeof ANIMS)[number]

/** When a part shows. Leave it out for always. */
export const SHOWN = ["night", "day", "rain"] as const
export type Shown = (typeof SHOWN)[number]

export type PropPart = {
  shape: Shape
  at: number[]
  ramp: RampName
  /** Step on the ramp, 0 the lightest. */
  step: number
  anim?: Anim
  when?: Shown
}

export const VERBS = ["give", "heal", "feast", "reveal", "grow", "teach", "trade", "cheer", "rewind", "open"] as const
export type Verb = (typeof VERBS)[number]

export const POOLS = ["seed", "trinket"] as const
export const FORECASTS = ["weather", "crops", "festival"] as const
export const GROWTHS = ["water", "luck"] as const
export const SCREENS = ["bench", "fish"] as const
/** Refuse the use unless this holds. `daylight` is 7 to 16 o'clock and clear. */
export const NEEDS = ["night", "daylight", "rain"] as const

/** Arguments each verb must and may take. Any field not listed here or in `COMMON_ARGS` is refused for that verb. */
export const VERB_ARGS: Record<Verb, { required: readonly string[]; oneOf?: readonly string[]; optional?: readonly string[] }> = {
  give: { required: [], oneOf: ["item", "pool", "buttons"], optional: ["qty"] },
  heal: { required: ["amount"], optional: ["rainAmount"] },
  feast: { required: ["factor"] },
  reveal: { required: ["shows"] },
  grow: { required: ["effect"] },
  teach: { required: ["skill", "amount"] },
  trade: { required: ["cost"], oneOf: ["item", "pool"] },
  cheer: { required: ["amount"] },
  rewind: { required: ["amount"] },
  open: { required: ["screen"] },
}

/** Fields any verb may carry. */
export const COMMON_ARGS = ["verb", "label", "every", "minutes", "energy", "needs", "cost", "extra", "xp", "risk"] as const

export type PropUse = {
  verb: Verb
  /** What E says, as in `propLabel`. */
  label: string
  /** Once a `day` (default), once a `week`, or `any` time. */
  every?: "day" | "week" | "any"
  minutes?: number
  /** Energy it costs. */
  energy?: number
  needs?: (typeof NEEDS)[number]
  /** Paid on use. Missing it refuses the use, unless `risk` says what happens instead. */
  cost?: { buttons?: number; item?: string }
  /** give / trade: one item id, a random one from a pool, or buttons. */
  item?: string
  pool?: (typeof POOLS)[number]
  buttons?: number
  qty?: number
  /** heal: energy; teach: xp; cheer: trust per friend; rewind: minutes. */
  amount?: number
  /** heal: energy instead on a rainy day. */
  rainAmount?: number
  /** feast: the best food you carry restores this many times its value. */
  factor?: number
  shows?: Array<(typeof FORECASTS)[number]>
  effect?: (typeof GROWTHS)[number]
  /** teach: one skill, or the one you are weakest at. */
  skill?: SpecSkill | "weakest"
  screen?: (typeof SCREENS)[number]
  /** A chance at one more item, maybe only at night. */
  extra?: { item: string; chance: number; when?: "night" }
  xp?: { skill: SpecSkill; amount: number }
  /** If the cost is missing: this chance to lose energy, else the use goes ahead plainly. */
  risk?: { energy: number; chance: number }
}

export type PropSpec = {
  id: string
  name: string
  /** In tiles. Valdivia's props are all 1×1. */
  size: { w: number; h: number }
  /** Blocks walking (not in `FLAT_PROPS`). */
  solid: boolean
  /** A soft ground shadow under it. */
  shadow: boolean
  parts: PropPart[]
  use: PropUse
}

const PROP_KEYS = ["id", "name", "size", "solid", "shadow", "parts", "use"] as const
const PART_KEYS = ["shape", "at", "ramp", "step", "anim", "when"] as const
export const MAX_PARTS = 24

/** Every reason this value is not a valid `PropSpec`. Empty means valid. */
export function validatePropSpec(spec: unknown, ctx: SpecContext = {}): SpecError[] {
  const c = new Checker()
  if (!c.obj(spec, "")) return c.errors
  c.only(spec, "", PROP_KEYS)
  c.id(spec.id, "id")
  c.str(spec.name, "name", 40)
  c.bool(spec.solid, "solid")
  c.bool(spec.shadow, "shadow")

  let box: [number, number] | undefined
  if (c.obj(spec.size, "size")) {
    c.only(spec.size, "size", ["w", "h"])
    const okW = c.num(spec.size.w, "size.w", 1, 2, true)
    const okH = c.num(spec.size.h, "size.h", 1, 2, true)
    if (okW && okH) box = [(spec.size.w as number) * PROP_TILE, (spec.size.h as number) * PROP_TILE]
  }

  if (c.arr(spec.parts, "parts", 1, MAX_PARTS)) spec.parts.forEach((p, i) => checkPart(c, p, join("parts", i), box))
  checkUse(c, spec.use, ctx)
  return c.errors
}

/** Check one part against its box. Blocks and tools draw with the same grammar. */
export function checkPart(c: Checker, p: unknown, path: string, box: [number, number] | undefined) {
  if (!c.obj(p, path)) return
  c.only(p, path, PART_KEYS)
  const shape = c.oneOf(p.shape, join(path, "shape"), SHAPES) ? (p.shape as Shape) : undefined
  if (c.oneOf(p.ramp, join(path, "ramp"), RAMP_NAMES)) c.num(p.step, join(path, "step"), 0, RAMPS[p.ramp as RampName].length - 1, true)
  if (p.anim !== undefined) c.oneOf(p.anim, join(path, "anim"), ANIMS)
  if (p.when !== undefined) c.oneOf(p.when, join(path, "when"), SHOWN)
  const at = join(path, "at")
  if (!shape || !Array.isArray(p.at)) {
    if (!Array.isArray(p.at)) c.fail(at, "must be a list of numbers")
    return
  }
  const n = p.at.length
  const arityOk = shape === "dots" ? n >= 2 && n <= 24 && n % 2 === 0 : n === (shape === "tri" ? 6 : 4)
  if (!arityOk) return c.fail(at, `${shape} takes ${SHAPE_ARITY[shape]}`)
  if (!p.at.every((v) => typeof v === "number" && Number.isInteger(v))) return c.fail(at, "must be whole pixel numbers")
  const v = p.at as number[]
  if (!box) return
  const [bw, bh] = box
  const inside = (x: number, y: number) => x >= 0 && y >= 0 && x < bw && y < bh
  if (shape === "rect" || shape === "ellipse") {
    const [x, y, w, h] = v as [number, number, number, number]
    if (w < 1 || h < 1) return c.fail(at, "width and height must be at least 1")
    if (!inside(x, y) || !inside(x + w - 1, y + h - 1)) c.fail(at, `must stay inside the ${bw}×${bh} box`)
  } else {
    for (let i = 0; i < v.length; i += 2) if (!inside(v[i]!, v[i + 1]!)) return c.fail(at, `must stay inside the ${bw}×${bh} box`)
  }
}

function checkUse(c: Checker, u: unknown, ctx: SpecContext) {
  if (!c.obj(u, "use")) return
  if (!c.oneOf(u.verb, "use.verb", VERBS)) return
  const verb = u.verb as Verb
  const rule = VERB_ARGS[verb]
  const allowed = [...COMMON_ARGS, ...rule.required, ...(rule.oneOf ?? []), ...(rule.optional ?? [])]
  for (const k of Object.keys(u)) if (!allowed.includes(k)) c.fail(join("use", k), `is not an argument of ${verb}`)
  for (const k of rule.required) if (u[k] === undefined) c.fail(join("use", k), `is required for ${verb}`)
  if (rule.oneOf) {
    const given = rule.oneOf.filter((k) => u[k] !== undefined)
    if (given.length !== 1) c.fail("use", `${verb} takes exactly one of: ${rule.oneOf.join(", ")}`)
  }

  c.str(u.label, "use.label", 60)
  if (u.every !== undefined) c.oneOf(u.every, "use.every", ["day", "week", "any"] as const)
  if (u.minutes !== undefined) c.num(u.minutes, "use.minutes", 0, 120, true)
  if (u.energy !== undefined) c.num(u.energy, "use.energy", 0, 10, true)
  if (u.needs !== undefined) c.oneOf(u.needs, "use.needs", NEEDS)
  if (u.cost !== undefined && c.obj(u.cost, "use.cost")) {
    c.only(u.cost, "use.cost", ["buttons", "item"])
    if (u.cost.buttons === undefined && u.cost.item === undefined) c.fail("use.cost", "must name buttons or an item")
    if (u.cost.buttons !== undefined) c.num(u.cost.buttons, "use.cost.buttons", 1, 50, true)
    if (u.cost.item !== undefined) c.item(u.cost.item, "use.cost.item", ctx)
  }
  if (u.item !== undefined) c.item(u.item, "use.item", ctx)
  if (u.pool !== undefined) c.oneOf(u.pool, "use.pool", POOLS)
  if (u.buttons !== undefined) c.num(u.buttons, "use.buttons", 1, 10, true)
  if (u.qty !== undefined) c.num(u.qty, "use.qty", 1, 5, true)
  if (u.amount !== undefined) c.num(u.amount, "use.amount", 1, verb === "rewind" ? 120 : 20, true)
  if (u.rainAmount !== undefined) c.num(u.rainAmount, "use.rainAmount", 1, 20, true)
  if (u.factor !== undefined) c.num(u.factor, "use.factor", 1, 3)
  if (u.shows !== undefined && c.arr(u.shows, "use.shows", 1, FORECASTS.length)) {
    u.shows.forEach((s, i) => c.oneOf(s, join("use.shows", i), FORECASTS))
    if (new Set(u.shows).size !== u.shows.length) c.fail("use.shows", "must not repeat")
  }
  if (u.effect !== undefined) c.oneOf(u.effect, "use.effect", GROWTHS)
  if (u.skill !== undefined) c.oneOf(u.skill, "use.skill", [...SKILLS, "weakest"] as const)
  if (u.screen !== undefined) c.oneOf(u.screen, "use.screen", SCREENS)
  if (u.extra !== undefined && c.obj(u.extra, "use.extra")) {
    c.only(u.extra, "use.extra", ["item", "chance", "when"])
    c.item(u.extra.item, "use.extra.item", ctx)
    c.num(u.extra.chance, "use.extra.chance", 0.01, 1)
    if (u.extra.when !== undefined) c.oneOf(u.extra.when, "use.extra.when", ["night"] as const)
  }
  if (u.xp !== undefined && c.obj(u.xp, "use.xp")) {
    c.only(u.xp, "use.xp", ["skill", "amount"])
    c.oneOf(u.xp.skill, "use.xp.skill", SKILLS)
    c.num(u.xp.amount, "use.xp.amount", 1, 5, true)
  }
  if (u.risk !== undefined) {
    if (u.cost === undefined) c.fail("use.risk", "needs a cost: risk is what happens when the cost is missing")
    if (c.obj(u.risk, "use.risk")) {
      c.only(u.risk, "use.risk", ["energy", "chance"])
      c.num(u.risk.energy, "use.risk.energy", 1, 10, true)
      c.num(u.risk.chance, "use.risk.chance", 0.01, 1)
    }
  }
  // Open hands over to a screen; it runs no rule of its own.
  if (verb === "open") for (const k of ["energy", "cost", "extra", "xp", "risk", "needs"]) if (u[k] !== undefined) c.fail(join("use", k), "open only opens a screen")
}
