/**
 * lib/relation-registry.ts — Every relation an item link can use.
 *
 * Built-ins come from `RELATIONS` in `lib/links.ts`. Custom relations live in
 * `useItemTypeStore.relations` and are registered here on rehydrate and on
 * every change, so the pure helpers in `links.ts` (`relationLabel`,
 * `inverseRelation`) can read them without importing a store.
 *
 * Built-in ids always win: a custom def can never relabel `blocks`. Archived
 * defs still resolve (old links keep a label) but are hidden from pickers.
 *
 * Vocabulary v2 (LINKS_REDESIGN L1.1): built-ins and seeds take extra traits
 * from a side table (`lib/graph/builtin-traits.ts`), and every def can take
 * person overrides (`useItemTypeStore.relationOverrides`). Both only set
 * `OVERRIDABLE_RELATION_KEYS`. `aliasOf` makes a merged relation read as
 * another one; stored links keep their id.
 *
 * `links.ts` imports this file and this file imports `RELATIONS` back, so the
 * built-in map is built lazily on first use, never at module load.
 */
import { RELATIONS, type RelationDef } from "@/lib/links"
import { PERSON_RELATIONS } from "@/lib/person-relations"
import { BUILTIN_TRAITS } from "@/lib/graph/builtin-traits"

let builtins: Map<string, RelationDef> | null = null
let seeds: RelationDef[] = [...PERSON_RELATIONS]
let custom = new Map<string, RelationDef>()
let overrides: Record<string, Partial<RelationDef>> = {}
/** Resolved defs (side traits, overrides, alias). Cleared on every register. */
let resolved = new Map<string, RelationDef | null>()

/**
 * Fields a side table or a person override may set. Ids, labels, inverses,
 * scope and alias stay with the def itself (built-ins are frozen).
 */
export const OVERRIDABLE_RELATION_KEYS = ["parent", "traits", "reciprocity", "phrases", "description"] as const
type OverridableKey = (typeof OVERRIDABLE_RELATION_KEYS)[number]

function builtinMap(): Map<string, RelationDef> {
  if (!builtins) {
    builtins = new Map()
    for (const def of RELATIONS) builtins.set(def.id, def)
    for (const def of seeds) if (!builtins.has(def.id)) builtins.set(def.id, def)
  }
  return builtins
}

/** Add more code-defined seeds (person seeds are in from the start). Built-ins keep their ids. */
export function registerSeedRelations(defs: RelationDef[]): void {
  seeds = [...seeds, ...defs]
  builtins = null
  resolved = new Map()
}

/** Replace the custom set (call with the whole store list). */
export function registerCustomRelations(defs: RelationDef[]): void {
  const next = new Map<string, RelationDef>()
  for (const def of defs) {
    if (def?.id && typeof def.label === "string") next.set(def.id, { ...def, custom: true })
  }
  custom = next
  resolved = new Map()
}

/** Replace the person's trait overrides (`useItemTypeStore.relationOverrides`). */
export function registerRelationOverrides(next: Record<string, Partial<RelationDef>>): void {
  overrides = next && typeof next === "object" ? next : {}
  resolved = new Map()
}

/** Keep only the overridable keys of a patch. */
export function pickOverridable(patch: Partial<RelationDef> | undefined): Partial<Pick<RelationDef, OverridableKey>> {
  const out: Partial<Pick<RelationDef, OverridableKey>> = {}
  if (!patch || typeof patch !== "object") return out
  for (const key of OVERRIDABLE_RELATION_KEYS) {
    if (patch[key] !== undefined) (out as Record<string, unknown>)[key] = patch[key]
  }
  return out
}

function layer(def: RelationDef, patch: Partial<RelationDef> | undefined): RelationDef {
  const p = pickOverridable(patch)
  if (Object.keys(p).length === 0) return def
  const next: RelationDef = { ...def, ...p }
  if (def.traits && p.traits) next.traits = { ...def.traits, ...p.traits }
  if (def.phrases && p.phrases) next.phrases = { ...def.phrases, ...p.phrases }
  return next
}

/** The stored def, before side traits, overrides, or alias. */
export function rawRelationDef(id: string): RelationDef | undefined {
  return builtinMap().get(id) ?? custom.get(id)
}

/** The def with side traits (built-ins and seeds) and person overrides on a copy. */
function withTraits(id: string): RelationDef | undefined {
  const raw = rawRelationDef(id)
  if (!raw) return undefined
  const side = raw.custom ? undefined : BUILTIN_TRAITS[id]
  return layer(layer(raw, side), overrides[id])
}

/**
 * The def behind a relation id. Side traits and overrides are merged into a
 * copy (`RELATIONS` is never touched). An alias resolves once, no chains: it
 * returns the target's def with `id` kept as asked and `aliasOf` naming the
 * target. Archived defs still resolve.
 */
export function getRelationDef(id: string): RelationDef | undefined {
  const hit = resolved.get(id)
  if (hit !== undefined) return hit ?? undefined
  const own = withTraits(id)
  let out = own
  if (own?.aliasOf && own.aliasOf !== id) {
    const target = withTraits(own.aliasOf)
    if (target) out = { ...target, id, aliasOf: target.id, archived: own.archived }
  }
  resolved.set(id, out ?? null)
  return out
}

/** Built-ins, then seeds, then custom (archived included). Traits merged; aliases not resolved. */
export function allRelations(): RelationDef[] {
  const out: RelationDef[] = []
  for (const id of builtinMap().keys()) out.push(withTraits(id)!)
  for (const id of custom.keys()) if (!builtinMap().has(id)) out.push(withTraits(id)!)
  return out
}

function allows(types: string[] | undefined, typeId: string | undefined): "scoped" | "any" | false {
  if (!types || types.length === 0) return "any"
  if (typeId && types.includes(typeId)) return "scoped"
  return false
}

/**
 * Relations a `fromType` item can use toward `toType` (absent = any target).
 * Scoped matches come first, then relations open to any type. Archived hidden.
 */
export function relationsFor(fromType: string | undefined, toType?: string): RelationDef[] {
  const scoped: RelationDef[] = []
  const open: RelationDef[] = []
  for (const def of allRelations()) {
    if (def.archived) continue
    const from = allows(def.fromTypes, fromType)
    if (!from) continue
    const to = toType === undefined ? (def.toTypes?.length ? "scoped" : "any") : allows(def.toTypes, toType)
    if (!to) continue
    if (from === "scoped" || to === "scoped") scoped.push(def)
    else open.push(def)
  }
  return [...scoped, ...open]
}

function slug(label: string): string {
  return (
    label
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 40) || "relation"
  )
}

function rand4(): string {
  return Math.random().toString(36).slice(2, 6).padEnd(4, "0")
}

export interface NewRelationInput {
  label: string
  inverseLabel?: string
  symmetric: boolean
  fromTypes?: string[]
  toTypes?: string[]
}

/**
 * One def (symmetric) or two that point at each other. Ids are
 * `rel-${slug}-${rand4}`. Pure: the caller stores them (`addRelations`).
 */
export function createRelationPair(input: NewRelationInput, now: Date = new Date()): RelationDef[] {
  const label = input.label.trim()
  const createdAt = now.toISOString()
  const scope = {
    ...(input.fromTypes?.length ? { fromTypes: input.fromTypes } : {}),
    ...(input.toTypes?.length ? { toTypes: input.toTypes } : {}),
  }
  const id = `rel-${slug(label)}-${rand4()}`
  const inverseLabel = input.inverseLabel?.trim()
  if (input.symmetric || !inverseLabel) {
    return [{ id, label, inverse: id, inverseLabel: label, custom: true, createdAt, ...scope }]
  }
  const backId = `rel-${slug(inverseLabel)}-${rand4()}`
  const back = {
    ...(input.toTypes?.length ? { fromTypes: input.toTypes } : {}),
    ...(input.fromTypes?.length ? { toTypes: input.fromTypes } : {}),
  }
  return [
    { id, label, inverse: backId, inverseLabel, custom: true, createdAt, ...scope },
    { id: backId, label: inverseLabel, inverse: id, inverseLabel: label, custom: true, createdAt, ...back },
  ]
}
