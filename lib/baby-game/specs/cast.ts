/**
 * lib/baby-game/specs/cast.ts — `CastSpec`: a resident as a body template, ramps, an accessory, a temper and a want
 *
 * The body fields are the knobs `sprites.ts` already draws from: a template (its `quad` and `fowl` builders and the four
 * custom shapes), a size against the others, ear and tail kinds (`Ear`, `Tail`), snout and leg length, one marking. The
 * palette names ramps for fur, belly and accent (nose, inner ear, beak, feet). Tone and cadence are the app's friend
 * personality, which `cast.ts` `temper` reads today; the want, gift tastes and habits are the `Resident` fields.
 * Names and titles are the only free text: lines stay hand-written or come from the voice BIMBY.
 *
 * Nothing in the game reads these yet. **Planned:** `sprites.ts` templates paint the body, `walk.ts` and `idle.ts` animate it.
 */

import { CADENCES, Checker, CONDITIONS, TAGS, TONES, type SpecCadence, type SpecCondition, type SpecContext, type SpecError, type SpecTag, type SpecTone } from "./common"
import { RAMP_NAMES, type RampName } from "./ramps"

/** `quad` (four legs) and `fowl` (birds) are builders; the rest are the custom shapes in `sprites.ts`. */
export const BODY_TEMPLATES = ["quad", "fowl", "hedgehog", "seal", "penguin", "owl"] as const
export type BodyTemplate = (typeof BODY_TEMPLATES)[number]

/** `sprites.ts` `Ear["kind"]` and `Tail["kind"]`. */
export const EARS = ["point", "round", "long", "floppy", "leaf", "none"] as const
export const TAILS = ["bush", "thin", "short", "curl", "thick", "none"] as const
/** Snout: none, short (under 3.5 px forward), long. Legs: short (under 4 px), mid (under 7), long. */
export const SNOUTS = ["none", "short", "long"] as const
export const LEGS = ["short", "mid", "long"] as const
/** The markings the `mark` painters draw today: tabby stripes, fawn spots, a pale bib, a dark back stripe. */
export const MARKS = ["none", "stripes", "spots", "bib", "stripe"] as const
/** What a friend wears. From the bios (Ada's eggshell hat, Mathilda's scarf, Daria's braided wick) and the player's bow. */
export const ACCESSORIES = ["none", "eggshell", "scarf", "ribbon", "bow", "collar", "flower"] as const

/** Bird-shaped templates have no ears. */
const EARLESS: readonly BodyTemplate[] = ["fowl", "penguin"]

export type CastSpec = {
  id: string
  name: string
  title: string
  body: {
    template: BodyTemplate
    /** Against the others: a mouse is about 0.78, a foal 1.2. */
    size: number
    ears: (typeof EARS)[number]
    tail: (typeof TAILS)[number]
    snout: (typeof SNOUTS)[number]
    legs: (typeof LEGS)[number]
    mark: (typeof MARKS)[number]
  }
  palette: { fur: RampName; belly: RampName; accent: RampName }
  /** `ramp` is left out only when the kind is `none`. */
  accessory: { kind: (typeof ACCESSORIES)[number]; ramp?: RampName }
  tone: SpecTone
  cadence: SpecCadence
  want: {
    /** Items turned in before they trust you with the keepsake. */
    items: string[]
    /** The keepsake they hand over. */
    gives: string
    /** Hearts (of 10) needed first. */
    hearts: number
    condition: SpecCondition
  }
  likes: SpecTag[]
  hates: SpecTag[]
  habits: {
    /** Comes to the campfire at dusk. */
    social: boolean
    /** Hours asleep, `[from, to]`, wrapping midnight. Left out means 22 to 6. */
    sleeps?: [number, number]
    rainLover?: boolean
  }
}

const KEYS = ["id", "name", "title", "body", "palette", "accessory", "tone", "cadence", "want", "likes", "hates", "habits"] as const

/** Every reason this value is not a valid `CastSpec`. Empty means valid. */
export function validateCastSpec(spec: unknown, ctx: SpecContext = {}): SpecError[] {
  const c = new Checker()
  if (!c.obj(spec, "")) return c.errors
  c.only(spec, "", KEYS)
  c.id(spec.id, "id")
  c.str(spec.name, "name", 24)
  c.str(spec.title, "title", 48)
  c.oneOf(spec.tone, "tone", TONES)
  c.oneOf(spec.cadence, "cadence", CADENCES)

  const b = spec.body
  if (c.obj(b, "body")) {
    c.only(b, "body", ["template", "size", "ears", "tail", "snout", "legs", "mark"])
    const t = c.oneOf(b.template, "body.template", BODY_TEMPLATES)
    c.num(b.size, "body.size", 0.5, 1.3)
    if (c.oneOf(b.ears, "body.ears", EARS) && t && EARLESS.includes(b.template as BodyTemplate) && b.ears !== "none") {
      c.fail("body.ears", `a ${b.template} has no ears`)
    }
    c.oneOf(b.tail, "body.tail", TAILS)
    c.oneOf(b.snout, "body.snout", SNOUTS)
    c.oneOf(b.legs, "body.legs", LEGS)
    c.oneOf(b.mark, "body.mark", MARKS)
  }

  if (c.obj(spec.palette, "palette")) {
    c.only(spec.palette, "palette", ["fur", "belly", "accent"])
    for (const k of ["fur", "belly", "accent"] as const) c.oneOf(spec.palette[k], `palette.${k}`, RAMP_NAMES)
  }

  const a = spec.accessory
  if (c.obj(a, "accessory")) {
    c.only(a, "accessory", ["kind", "ramp"])
    if (c.oneOf(a.kind, "accessory.kind", ACCESSORIES)) {
      if (a.kind === "none" && a.ramp !== undefined) c.fail("accessory.ramp", "must be left out when there is no accessory")
      if (a.kind !== "none") c.oneOf(a.ramp, "accessory.ramp", RAMP_NAMES)
    }
  }

  const w = spec.want
  if (c.obj(w, "want")) {
    c.only(w, "want", ["items", "gives", "hearts", "condition"])
    if (c.arr(w.items, "want.items", 1, 3)) w.items.forEach((id, i) => c.item(id, `want.items[${i}]`, ctx))
    c.item(w.gives, "want.gives", ctx)
    c.num(w.hearts, "want.hearts", 1, 10, true)
    c.oneOf(w.condition, "want.condition", CONDITIONS)
    if (Array.isArray(w.items) && w.items.includes(w.gives)) c.fail("want.gives", "must not be one of the items they want")
  }

  const likes = checkTags(c, spec.likes, "likes", 1, 3)
  const hates = checkTags(c, spec.hates, "hates", 1, 2)
  for (const t of hates) if (likes.includes(t)) c.fail("hates", `cannot also like ${t}`)

  const h = spec.habits
  if (c.obj(h, "habits")) {
    c.only(h, "habits", ["social", "sleeps", "rainLover"])
    c.bool(h.social, "habits.social")
    if (h.sleeps !== undefined && c.arr(h.sleeps, "habits.sleeps", 2, 2)) {
      h.sleeps.forEach((v, i) => c.num(v, `habits.sleeps[${i}]`, 0, 23, true))
      if (h.sleeps[0] === h.sleeps[1]) c.fail("habits.sleeps", "must start and end at different hours")
    }
    if (h.rainLover !== undefined) c.bool(h.rainLover, "habits.rainLover")
  }
  return c.errors
}

function checkTags(c: Checker, v: unknown, path: string, min: number, max: number): SpecTag[] {
  if (!c.arr(v, path, min, max)) return []
  const ok = v.filter((t, i) => c.oneOf(t, `${path}[${i}]`, TAGS)) as SpecTag[]
  if (new Set(v).size !== v.length) c.fail(path, "must not repeat")
  return ok
}
