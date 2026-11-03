/**
 * lib/baby-game/people/spec.ts — a person as a closed description
 *
 * A `PersonSpec` is everything the drawer (`draw.ts`) needs: body, skin, hair, face, clothes, shoes, hat and a few
 * extras, each from a closed list. A person (or a model, or the lab) can only pick what exists, so any spec draws.
 * `parsePerson` clamps anything unknown to a safe default. The Center of The World is `CENTER_SPEC`.
 */

import { COLOR_NAMES, isColor, SKIN_NAMES, type SkinName } from "./color"

export const BUILDS = ["small", "slight", "average", "tall"] as const
export const HAIR_STYLES = ["short", "bangs", "side", "bob", "long", "pigtails", "ponytail", "bun", "curly", "bald"] as const
export const MOUTHS = ["smile", "grin", "neutral", "open", "smirk"] as const
export const TOPS = ["tee", "longsleeve", "sweater", "hoodie", "shirt", "dress", "overalls", "jacket", "corset"] as const
export const BOTTOMS = ["pants", "shorts", "skirt"] as const
export const SHOES = ["boots", "sneakers", "sandals", "gogo", "none"] as const
export const HATS = ["none", "beanie", "cap", "straw", "bow", "headband"] as const
export const PATTERNS = ["solid", "stripes", "dots"] as const
export const EXTRAS = ["scarf", "satchel", "freckles", "glasses", "chainbelt", "pointyears"] as const

export type Build = (typeof BUILDS)[number]
export type HairStyle = (typeof HAIR_STYLES)[number]
export type Mouth = (typeof MOUTHS)[number]
export type TopKind = (typeof TOPS)[number]
export type BottomKind = (typeof BOTTOMS)[number]
export type ShoeKind = (typeof SHOES)[number]
export type HatKind = (typeof HATS)[number]
export type Pattern = (typeof PATTERNS)[number]
export type Extra = (typeof EXTRAS)[number]

export type PersonSpec = {
  build: Build
  skin: SkinName
  hair: { style: HairStyle; color: string }
  eyes: string
  mouth: Mouth
  blush: boolean
  top: { kind: TopKind; color: string; accent: string; pattern: Pattern }
  bottom: { kind: BottomKind; color: string }
  shoes: { kind: ShoeKind; color: string }
  hat: { kind: HatKind; color: string; accent: string }
  /** Up to three of `EXTRAS`; `extraColor` tints a scarf or satchel. */
  extras: Extra[]
  extraColor: string
}

/**
 * The Center of The World: a pixie. Pale skin, brown eyes, wavy strawberry blonde hair, small pointed ears; mostly black, a
 * corset over sheer sleeves, a layered skirt, a grey scarf, a silver chain belt with O rings, white go-go boots.
 */
export const CENTER_SPEC: PersonSpec = {
  build: "slight",
  skin: "pale",
  hair: { style: "long", color: "strawberry" },
  eyes: "brown",
  mouth: "smile",
  blush: true,
  top: { kind: "corset", color: "black", accent: "charcoal", pattern: "solid" },
  bottom: { kind: "skirt", color: "black" },
  shoes: { kind: "gogo", color: "white" },
  hat: { kind: "none", color: "pink", accent: "rose" },
  extras: ["scarf", "chainbelt", "pointyears"],
  extraColor: "grey",
}

export const EYE_COLORS = ["brown", "chestnut", "green", "blue", "teal", "grey", "plum", "black"] as const

const pick = <T extends string>(list: readonly T[], v: unknown, fallback: T): T => (typeof v === "string" && (list as readonly string[]).includes(v) ? (v as T) : fallback)
const color = (v: unknown, fallback: string) => (isColor(v) ? (v as string).toLowerCase() : fallback)

/** Any object (a model's JSON, an old save) read as a `PersonSpec`: unknown values fall back to `base`. Never throws. */
export function parsePerson(raw: unknown, base: PersonSpec = CENTER_SPEC): PersonSpec {
  const r = (raw && typeof raw === "object" ? raw : {}) as Record<string, any>
  const hair = (r.hair ?? {}) as Record<string, unknown>
  const top = (r.top ?? {}) as Record<string, unknown>
  const bottom = (r.bottom ?? {}) as Record<string, unknown>
  const shoes = (r.shoes ?? {}) as Record<string, unknown>
  const hat = (r.hat ?? {}) as Record<string, unknown>
  const extras = Array.isArray(r.extras) ? (r.extras as unknown[]).filter((e): e is Extra => (EXTRAS as readonly unknown[]).includes(e)) : base.extras
  return {
    build: pick(BUILDS, r.build, base.build),
    skin: pick(SKIN_NAMES, r.skin, base.skin),
    hair: { style: pick(HAIR_STYLES, hair.style, base.hair.style), color: color(hair.color, base.hair.color) },
    eyes: color(r.eyes, base.eyes),
    mouth: pick(MOUTHS, r.mouth, base.mouth),
    blush: typeof r.blush === "boolean" ? r.blush : base.blush,
    top: {
      kind: pick(TOPS, top.kind, base.top.kind),
      color: color(top.color, base.top.color),
      accent: color(top.accent, base.top.accent),
      pattern: pick(PATTERNS, top.pattern, base.top.pattern),
    },
    bottom: { kind: pick(BOTTOMS, bottom.kind, base.bottom.kind), color: color(bottom.color, base.bottom.color) },
    shoes: { kind: pick(SHOES, shoes.kind, base.shoes.kind), color: color(shoes.color, base.shoes.color) },
    hat: { kind: pick(HATS, hat.kind, base.hat.kind), color: color(hat.color, base.hat.color), accent: color(hat.accent, base.hat.accent) },
    extras: [...new Set(extras)].slice(0, 3),
    extraColor: color(r.extraColor, base.extraColor),
  }
}

export const COLOR_LIST = COLOR_NAMES
