/**
 * lib/graph/schema-category.ts — The relation vocabulary read as a category (an olog).
 *
 * Pure and computed on read. Objects are item types (and `*` for "any").
 * Morphisms are relations: a def with `fromTypes` × `toTypes` gives one
 * morphism per pair; an absent side is `*`. Each object has an identity
 * `id:<object>`. Composition is read from three places:
 * - a chain rule of length 2 with no `unless` and no guards (r;s ⊑ head);
 * - a transitive relation h with r ⊑ h and s ⊑ h (r;s ⊑ h);
 * - the lattice: when r;s ⊑ h, also r;s ⊑ every ancestor of h below `related`.
 *
 * Rules read as path equations (`implies`: chain ⊆ [head]). `checkEquation`
 * walks both paths on a `KnowledgeGraph` and returns breaks. A break is a
 * finding, never a fix. Output is sorted, so the same input gives the same
 * answer.
 */
import type { EquationBreak, KnowledgeGraph, PathEquation, SchemaMorphism, SchemaObject } from "@/lib/graph/kg-model"
import { buildLattice, LATTICE_ROOT } from "@/lib/graph/relation-lattice"
import type { RelationRule } from "@/lib/graph/relation-rules"
import type { RelationDef } from "@/lib/links"

export const ANY_OBJECT = "*"

const byId = <T extends { id: string }>(a: T, b: T) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0)
const cmp = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0)

function live(defs: readonly RelationDef[]): RelationDef[] {
  return defs.filter((d) => d?.id && !d.archived && !d.aliasOf)
}

function ends(types?: readonly string[]): string[] {
  return types?.length ? [...new Set(types)].sort() : [ANY_OBJECT]
}

/** The vocabulary as objects and morphisms, identities included. */
export function schemaCategory(
  defs: readonly RelationDef[],
  typeIds: readonly string[],
  typeLabel: (id: string) => string = (id) => id,
): { objects: SchemaObject[]; morphisms: SchemaMorphism[] } {
  const relations = live(defs)
  const objectIds = new Set<string>(typeIds)
  const morphisms: SchemaMorphism[] = []
  for (const def of relations) {
    for (const dom of ends(def.fromTypes)) {
      for (const cod of ends(def.toTypes)) {
        objectIds.add(dom)
        objectIds.add(cod)
        morphisms.push({ id: def.id, dom, cod, label: def.label || def.id })
      }
    }
  }
  const objects = [...objectIds]
    .sort()
    .map((id) => ({ id, label: id === ANY_OBJECT ? "Anything" : typeLabel(id) || id }))
  for (const o of objects) morphisms.push({ id: `id:${o.id}`, dom: o.id, cod: o.id, label: `same ${o.label}` })
  morphisms.sort((a, b) => cmp(a.id, b.id) || cmp(a.dom, b.dom) || cmp(a.cod, b.cod))
  return { objects, morphisms }
}

function overlaps(a?: readonly string[], b?: readonly string[]): boolean {
  if (!a?.length || !b?.length) return true
  return a.some((t) => b.includes(t))
}

/** r then s can meet: r's codomain overlaps s's domain. Absent types mean any; an unknown id is any. */
export function composable(r: string, s: string, defs: readonly RelationDef[]): boolean {
  const left = defs.find((d) => d.id === r)
  const right = defs.find((d) => d.id === s)
  return overlaps(left?.toTypes, right?.fromTypes)
}

/** Relation ids h with r;s ⊑ h, sorted. Empty when r and s do not compose. */
export function composeRelations(
  r: string,
  s: string,
  rules: readonly RelationRule[],
  defs: readonly RelationDef[],
): string[] {
  if (!composable(r, s, defs)) return []
  const lattice = buildLattice(defs)
  const sub = (a: string, b: string) => lattice.isSubrelation(a, b)
  const heads = new Set<string>()
  for (const rule of rules) {
    if (!rule.enabled || rule.chain.length !== 2 || rule.unless) continue
    if (rule.guards?.some((g) => g?.length)) continue
    if (sub(r, rule.chain[0]) && sub(s, rule.chain[1])) heads.add(rule.head)
  }
  for (const def of live(defs)) {
    if (def.traits?.transitive && sub(r, def.id) && sub(s, def.id)) heads.add(def.id)
  }
  for (const h of [...heads]) for (const up of lattice.ancestors(h)) if (up !== LATTICE_ROOT) heads.add(up)
  return [...heads].sort()
}

/** Enabled chain rules as `implies` equations: chain ⊆ [head]. */
export function rulesAsEquations(rules: readonly RelationRule[]): PathEquation[] {
  return rules
    .filter((rule) => rule.enabled && rule.chain.length > 0)
    .map((rule) => ({
      id: `rule:${rule.id}`,
      label: rule.label,
      left: [...rule.chain],
      right: [rule.head],
      kind: "implies" as const,
    }))
    .sort(byId)
}

export interface CheckEquationOptions {
  /** Most breaks returned. Default 200. */
  limit?: number
  /** Walk derived edges too. Default false: recorded, observed, and inferred only. */
  withDerived?: boolean
  /** Step matches relation r when `isSubrelation(step, r)`. Default: equal ids. */
  isSubrelation?: (step: string, r: string) => boolean
}

/**
 * Where the data breaks a path equation. Walks both paths from every node
 * with an out edge. `implies` reports left-holds/right-missing only; `equal`
 * reports both ways. A path that comes back to its start is not counted.
 */
export function checkEquation(g: KnowledgeGraph, eq: PathEquation, opts: CheckEquationOptions = {}): EquationBreak[] {
  const limit = opts.limit ?? 200
  const sub = opts.isSubrelation ?? ((a: string, b: string) => a === b)
  const keep = (order: string) => opts.withDerived || order !== "derived"
  const walk = (start: string, path: readonly string[]): Set<string> => {
    let at = new Set([start])
    for (const r of path) {
      const next = new Set<string>()
      for (const id of at) for (const e of g.out.get(id) ?? []) if (keep(e.order) && sub(e.p, r)) next.add(e.o)
      at = next
      if (!at.size) break
    }
    at.delete(start)
    return at
  }
  const breaks: EquationBreak[] = []
  if (!eq.left.length || !eq.right.length) return breaks
  const starts = [...g.out.keys()].sort()
  for (const from of starts) {
    const left = walk(from, eq.left)
    const right = eq.kind === "equal" || left.size ? walk(from, eq.right) : new Set<string>()
    const found: EquationBreak[] = []
    for (const to of left) if (!right.has(to)) found.push({ equationId: eq.id, from, to, holds: "left" })
    if (eq.kind === "equal") for (const to of right) if (!left.has(to)) found.push({ equationId: eq.id, from, to, holds: "right" })
    found.sort((a, b) => cmp(a.to, b.to) || cmp(a.holds, b.holds))
    for (const b of found) {
      breaks.push(b)
      if (breaks.length >= limit) return breaks
    }
  }
  return breaks
}
