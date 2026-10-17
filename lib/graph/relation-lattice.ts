/**
 * lib/graph/relation-lattice.ts — The relation hierarchy (R ⊑ parent).
 *
 * Pure. Built from defs with `parent` (LINKS_REDESIGN §5, L1.2). `related` is
 * the root: a def with no parent, or an id the lattice has never seen,
 * parents to it. An alias (`aliasOf`) parents to its target. A parent cycle
 * is cut at the first repeat (that def parents to `related`) and reported in
 * `checks`, so every walk ends.
 */
import type { RelationDef } from "@/lib/links"

export const LATTICE_ROOT = "related"

export interface LatticeCheck {
  kind: "parent-cycle"
  ids: string[]
  line: string
}

export interface RelationLattice {
  /** Parent chain, nearest first, ending at `related`. Empty for the root. */
  ancestors(id: string): string[]
  /** Every relation below `id`, breadth first. */
  descendants(id: string): string[]
  /** r ⊑ s (reflexive). */
  isSubrelation(r: string, s: string): boolean
  /** Nearest shared ancestor-or-self. */
  meet(r: string, s: string): string
  /** Steps to the root. */
  depth(id: string): number
  /** Direct parent (`related` for unknown ids; undefined for the root). */
  parentOf(id: string): string | undefined
  checks: LatticeCheck[]
}

export function buildLattice(defs: readonly Pick<RelationDef, "id" | "parent" | "aliasOf">[]): RelationLattice {
  const parent = new Map<string, string>()
  for (const def of defs) {
    if (!def?.id || def.id === LATTICE_ROOT) continue
    const p = def.aliasOf || def.parent
    parent.set(def.id, p && p !== def.id ? p : LATTICE_ROOT)
  }
  const up = (id: string) => (id === LATTICE_ROOT ? undefined : (parent.get(id) ?? LATTICE_ROOT))

  // Cut cycles at the first repeat.
  const checks: LatticeCheck[] = []
  const safe = new Set<string>([LATTICE_ROOT])
  for (const start of parent.keys()) {
    const path: string[] = []
    const onPath = new Set<string>()
    let cur: string | undefined = start
    while (cur !== undefined && !safe.has(cur)) {
      if (onPath.has(cur)) {
        const last = path[path.length - 1]
        const ids = path.slice(path.indexOf(cur))
        parent.set(last, LATTICE_ROOT)
        checks.push({ kind: "parent-cycle", ids, line: `Parents loop: ${[...ids, cur].join(" → ")}. Read ${last} as under related.` })
        break
      }
      path.push(cur)
      onPath.add(cur)
      cur = up(cur)
    }
    for (const id of path) safe.add(id)
  }

  const children = new Map<string, string[]>()
  for (const [id, p] of parent) {
    const list = children.get(p) ?? []
    list.push(id)
    children.set(p, list)
  }

  const ancestors = (id: string): string[] => {
    const out: string[] = []
    for (let cur = up(id); cur !== undefined; cur = up(cur)) out.push(cur)
    return out
  }

  return {
    ancestors,
    descendants(id) {
      const out: string[] = []
      const queue = [...(children.get(id) ?? [])]
      while (queue.length) {
        const next = queue.shift()!
        out.push(next)
        queue.push(...(children.get(next) ?? []))
      }
      return out
    },
    isSubrelation: (r, s) => r === s || ancestors(r).includes(s),
    meet(r, s) {
      const theirs = new Set([s, ...ancestors(s)])
      return [r, ...ancestors(r)].find((id) => theirs.has(id)) ?? LATTICE_ROOT
    },
    depth: (id) => ancestors(id).length,
    parentOf: up,
    checks,
  }
}

/**
 * Many-to-one inverse check: R's inverse reads back as R, or as a relation
 * R sits under (`mother-of` → `child-of` → `parent-of`, and mother-of ⊑
 * parent-of). Returns a line for each pair the lattice does not explain.
 */
export function unexplainedInverses(
  defs: readonly Pick<RelationDef, "id" | "inverse">[],
  lattice: RelationLattice,
): { id: string; line: string }[] {
  const inv = new Map(defs.map((d) => [d.id, d.inverse]))
  const out: { id: string; line: string }[] = []
  for (const def of defs) {
    const back = inv.get(def.inverse) ?? def.inverse
    if (back === def.id || lattice.isSubrelation(def.id, back)) continue
    out.push({ id: def.id, line: `${def.id} reads back as ${def.inverse}, which reads back as ${back}.` })
  }
  return out
}
