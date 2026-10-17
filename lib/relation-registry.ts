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
 * `links.ts` imports this file and this file imports `RELATIONS` back, so the
 * built-in map is built lazily on first use, never at module load.
 */
import { RELATIONS, type RelationDef } from "@/lib/links"
import { PERSON_RELATIONS } from "@/lib/person-relations"

let builtins: Map<string, RelationDef> | null = null
let seeds: RelationDef[] = [...PERSON_RELATIONS]
let custom = new Map<string, RelationDef>()

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
}

/** Replace the custom set (call with the whole store list). */
export function registerCustomRelations(defs: RelationDef[]): void {
  const next = new Map<string, RelationDef>()
  for (const def of defs) {
    if (def?.id && typeof def.label === "string") next.set(def.id, { ...def, custom: true })
  }
  custom = next
}

export function getRelationDef(id: string): RelationDef | undefined {
  return builtinMap().get(id) ?? custom.get(id)
}

/** Built-ins, then seeds, then custom (archived included). */
export function allRelations(): RelationDef[] {
  const out = [...builtinMap().values()]
  for (const def of custom.values()) if (!builtinMap().has(def.id)) out.push(def)
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
