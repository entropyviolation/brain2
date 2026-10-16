/**
 * lib/relation-registry.ts — Which relations fit a link, and new ones
 *
 * `lib/links.ts` holds the map every label / inverse helper reads (catalog,
 * person seeds, person-made). This file picks relations for a pair of item
 * types and makes new relation pairs. Person-made relations are stored on
 * the item-type store (`relations`), which calls `registerRelationDefs`.
 */
import { allRelationDefs, getRelationDef, RELATIONS, type RelationDef, type RelationFamily } from "@/lib/links"

function fits(types: string[] | undefined, type: string | undefined): boolean {
  if (!types || types.length === 0) return true
  return !!type && types.includes(type)
}

function scoped(types: string[] | undefined): boolean {
  return !!types && types.length > 0
}

export interface RelationChoices {
  /** Made for this source type (and target type when known). */
  forType: RelationDef[]
  /** Open to any type. */
  any: RelationDef[]
  /** Person-made. */
  yours: RelationDef[]
}

/** Relations that read from `fromType` (and point at `toType` when given). Archived ones are hidden. */
export function relationsFor(fromType: string | undefined, toType?: string): RelationChoices {
  const out: RelationChoices = { forType: [], any: [], yours: [] }
  for (const def of allRelationDefs()) {
    if (def.archived) continue
    if (!fits(def.fromTypes, fromType)) continue
    if (toType !== undefined && !fits(def.toTypes, toType)) continue
    if (def.custom) out.yours.push(def)
    else if (scoped(def.fromTypes)) out.forType.push(def)
    else out.any.push(def)
  }
  return out
}

/** Family for color and sector. Catalog task relations read as "task", evidence as "evidence". */
export function relationFamily(relation: string): RelationFamily {
  const def = getRelationDef(relation)
  if (def?.family) return def.family
  if (["supports", "supported-by", "refutes", "refuted-by"].includes(relation)) return "evidence"
  if (RELATIONS.some((r) => r.id === relation)) return "task"
  return "other"
}

function slug(text: string): string {
  return (
    text
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 32) || "relation"
  )
}

function rand4(): string {
  return Math.random().toString(36).slice(2, 6)
}

/** "is a member of" → "has member"; "is the mother of" → "is the child of" is a guess the person edits. */
export function guessInverseLabel(label: string): string {
  const text = label.trim()
  const memberOf = /^is an? (.+) of$/i.exec(text)
  if (memberOf) return `has ${memberOf[1]}`
  const theOf = /^is the (.+) of$/i.exec(text)
  if (theOf) return `has ${theOf[1]}`
  if (/ with$/i.test(text)) return text
  return ""
}

export interface NewRelationInput {
  label: string
  /** Empty or same as label with `symmetric` → one def. */
  inverseLabel?: string
  symmetric?: boolean
  fromTypes?: string[]
  toTypes?: string[]
  family?: RelationFamily
}

/** One def when symmetric, else two that name each other. */
export function createRelationPair(input: NewRelationInput, now = new Date()): RelationDef[] {
  const label = input.label.trim()
  if (!label) return []
  const createdAt = now.toISOString()
  const family = input.family ?? "other"
  const inverseLabel = (input.inverseLabel ?? "").trim()
  const symmetric = input.symmetric || !inverseLabel || inverseLabel.toLowerCase() === label.toLowerCase()
  const id = `rel-${slug(label)}-${rand4()}`
  const fromTypes = input.fromTypes?.length ? input.fromTypes : undefined
  const toTypes = input.toTypes?.length ? input.toTypes : undefined
  if (symmetric) {
    const types = fromTypes || toTypes ? [...new Set([...(fromTypes ?? []), ...(toTypes ?? [])])] : undefined
    return [{ id, label, inverse: id, inverseLabel: label, fromTypes: types, toTypes: types, family, custom: true, createdAt }]
  }
  const inverseId = `rel-${slug(inverseLabel)}-${rand4()}`
  return [
    { id, label, inverse: inverseId, inverseLabel, fromTypes, toTypes, family, custom: true, createdAt },
    { id: inverseId, label: inverseLabel, inverse: id, inverseLabel: label, fromTypes: toTypes, toTypes: fromTypes, family, custom: true, createdAt },
  ]
}

/** Drop anything that is not a well-formed custom def (persisted data). */
export function sanitizeRelationDefs(raw: unknown): RelationDef[] {
  if (!Array.isArray(raw)) return []
  const out: RelationDef[] = []
  for (const row of raw) {
    if (!row || typeof row !== "object") continue
    const def = row as RelationDef
    if (typeof def.id !== "string" || typeof def.label !== "string" || typeof def.inverse !== "string") continue
    out.push({ ...def, inverseLabel: typeof def.inverseLabel === "string" ? def.inverseLabel : def.label, custom: true })
  }
  return out
}
