/**
 * lib/baby-game/specs/common.ts — Shared pieces of the spec contract: errors, closed lists, small checks
 *
 * Specs are plain JSON a weak local model can write. Every validator returns a list of `SpecError` and never throws, so a
 * bad answer is refused with reasons the next prompt can quote. Lists here are copies of the game's own closed unions
 * (`items.ts` `TAGS`, `cast.ts` `Condition`, `farm.ts` `SKILL_IDS`, the app's tone and cadence); the tests check that the
 * copies still match. Imports nothing, so a Rust port can read the same shapes.
 */

/** One reason a spec was refused. `path` is a JSON path like `parts[2].at`. */
export type SpecError = { path: string; message: string }

/** Ids are short lowercase slugs, so a generated id is safe as a save key and a file name. */
export const ID_PATTERN = /^[a-z][a-z0-9-]{0,31}$/

/** Gift taste tags (`items.ts` `TAGS`). */
export const TAGS = ["sweet", "crunchy", "watery", "green", "shiny", "cozy", "musical", "bookish", "fishy", "soft", "earthy"] as const
export type SpecTag = (typeof TAGS)[number]

/** The skills that take xp (`farm.ts` `SKILL_IDS`). */
export const SKILLS = ["farming", "foraging", "fishing", "crafting"] as const
export type SpecSkill = (typeof SKILLS)[number]

/** How a friend likes to be approached (the app's `FRIEND_TONE`). */
export const TONES = ["gentle", "playful", "direct", "coach"] as const
export type SpecTone = (typeof TONES)[number]

/** How much a friend talks; `quiet` friends spook when you run (the app's `FRIEND_CADENCE`). */
export const CADENCES = ["quiet", "occasional", "chatty", "eager"] as const
export type SpecCadence = (typeof CADENCES)[number]

/** What must be true when you ask for a keepsake (`cast.ts` `Condition`). */
export const CONDITIONS = ["none", "morning", "evening", "rain", "dry", "sneak", "alone", "fed", "played"] as const
export type SpecCondition = (typeof CONDITIONS)[number]

/** Facts from the world a validator may check ids against. Leave a list out to skip that check. */
export type SpecContext = { items?: readonly string[]; blocks?: readonly SpecBlockFact[] }

/** What a tool validator needs to know about each block it may name (`block.ts` `BlockSpec`). */
export type SpecBlockFact = { id: string; layer: string; material: string; hardness: number }

/** A tiny error collector with the checks every spec needs. */
export class Checker {
  errors: SpecError[] = []

  fail(path: string, message: string) {
    this.errors.push({ path, message })
  }

  obj(v: unknown, path: string): v is Record<string, unknown> {
    if (typeof v === "object" && v !== null && !Array.isArray(v)) return true
    this.fail(path, "must be an object")
    return false
  }

  /** Refuse keys the shape does not have, so a model cannot smuggle in extra fields. */
  only(v: Record<string, unknown>, path: string, keys: readonly string[]) {
    for (const k of Object.keys(v)) if (!keys.includes(k)) this.fail(join(path, k), "is not a field of this spec")
  }

  str(v: unknown, path: string, max = 80): v is string {
    if (typeof v !== "string" || !v.trim()) return this.fail(path, "must be a non-empty string"), false
    if (v.length > max) return this.fail(path, `must be at most ${max} characters`), false
    return true
  }

  id(v: unknown, path: string): v is string {
    if (typeof v !== "string" || !ID_PATTERN.test(v)) return this.fail(path, "must be a lowercase slug (a-z, 0-9, -), at most 32 characters"), false
    return true
  }

  bool(v: unknown, path: string): v is boolean {
    if (typeof v !== "boolean") return this.fail(path, "must be true or false"), false
    return true
  }

  num(v: unknown, path: string, min: number, max: number, int = false): v is number {
    if (typeof v !== "number" || !Number.isFinite(v)) return this.fail(path, "must be a number"), false
    if (int && !Number.isInteger(v)) return this.fail(path, "must be a whole number"), false
    if (v < min || v > max) return this.fail(path, `must be between ${min} and ${max}`), false
    return true
  }

  oneOf<T extends string>(v: unknown, path: string, list: readonly T[]): v is T {
    if (typeof v !== "string" || !list.includes(v as T)) return this.fail(path, `must be one of: ${list.join(", ")}`), false
    return true
  }

  arr(v: unknown, path: string, min: number, max: number): v is unknown[] {
    if (!Array.isArray(v)) return this.fail(path, "must be a list"), false
    if (v.length < min || v.length > max) return this.fail(path, `must have ${min === max ? min : `${min} to ${max}`} entries`), false
    return true
  }

  item(v: unknown, path: string, ctx: SpecContext) {
    if (!this.id(v, path)) return
    if (ctx.items && !ctx.items.includes(v)) this.fail(path, `is not a known item: ${v}`)
  }
}

export function join(path: string, key: string | number): string {
  return typeof key === "number" ? `${path}[${key}]` : path ? `${path}.${key}` : key
}
