/**
 * lib/graph/seed-packs/taxonomy.ts — Opt-in SKOS-like relations.
 *
 * Off until a person adds the pack. `addSeedPack` writes through
 * `useItemTypeStore.addRelations` with `origin: "seed"`. Removing archives
 * the defs and leaves every link id alone. This file does not call
 * `registerSeedRelations`.
 */
import type { RelationDef } from "@/lib/links"
import { useItemTypeStore } from "@/lib/item-type-store"

const house = { family: "other" as const, parent: "related", origin: "seed" as const }

function sym(id: string, label: string, extra?: Partial<RelationDef>): RelationDef {
  return { id, label, inverse: id, inverseLabel: label, ...house, ...extra }
}

function pair(
  id: string,
  label: string,
  inverse: string,
  inverseLabel: string,
  forward?: Partial<RelationDef>,
  back?: Partial<RelationDef>,
): RelationDef[] {
  return [
    { id, label, inverse, inverseLabel, ...house, ...forward },
    { id: inverse, label: inverseLabel, inverse: id, inverseLabel: label, ...house, ...back },
  ]
}

/**
 * Broader points at the more general concept (SKOS broader). No tighter
 * parent than `related` exists in the frozen catalog.
 */
export const TAXONOMY_RELATIONS: RelationDef[] = [
  ...pair(
    "broader",
    "has broader",
    "narrower",
    "has narrower",
    {
      traits: { transitive: true, acyclic: true },
      description: "Points at the more general concept.",
      phrases: { forward: ["$s has broader $o"], inverse: ["$o has narrower $s"] },
    },
    {
      traits: { transitive: true, acyclic: true },
      description: "Points at the more specific concept.",
      phrases: { forward: ["$s has narrower $o"], inverse: ["$o has broader $s"] },
    },
  ),
  ...pair(
    "instance-of",
    "is an instance of",
    "has-instance",
    "has instance",
    {
      description: "This item is an example of that one.",
      phrases: { forward: ["$s is an instance of $o"], inverse: ["$o has instance $s"] },
    },
    {
      description: "An example of this item.",
      phrases: { forward: ["$s has instance $o"], inverse: ["$o is an instance of $s"] },
    },
  ),
  sym("see-also", "see also", {
    description: "Worth reading beside this. Not broader or narrower.",
    phrases: { forward: ["$s see also $o"], inverse: ["$o see also $s"] },
  }),
]

/** True when every pack id is stored and none of those rows are archived. */
export function seedPackOn(defs: readonly { id: string }[], stored: readonly { id: string; archived?: true }[]): boolean {
  if (!defs.length) return false
  const byId = new Map(stored.map((r) => [r.id, r]))
  return defs.every((d) => {
    const row = byId.get(d.id)
    return !!row && !row.archived
  })
}

/** Add missing defs. Unarchive rows already stored. A live pack is left as it is. */
export function addSeedPack(defs: readonly RelationDef[]): void {
  const store = useItemTypeStore.getState()
  if (seedPackOn(defs, store.relations)) return
  const have = new Set(store.relations.map((r) => r.id))
  const fresh = defs.filter((d) => !have.has(d.id))
  if (fresh.length) store.addRelations([...fresh])
  for (const def of defs) {
    const cur = useItemTypeStore.getState().relations.find((r) => r.id === def.id)
    if (!cur?.archived) continue
    store.updateRelation({ ...cur, archived: undefined })
  }
}

/** Archive every live def in the pack. Ids stay. Links stay. */
export function archiveSeedPack(defs: readonly RelationDef[]): void {
  const store = useItemTypeStore.getState()
  for (const def of defs) {
    const cur = store.relations.find((r) => r.id === def.id)
    if (!cur || cur.archived) continue
    store.updateRelation({ ...cur, archived: true })
  }
}
