/**
 * lib/graph/seed-packs/lexical.ts — Opt-in relations for a personal lexicon.
 *
 * Relation defs only. The word bank (`lib/vocab-words.ts`) stays words and
 * is not turned into items. Off until `addSeedPack` from the taxonomy module.
 * Parent is `related`: nothing tighter is already in the catalog.
 */
import type { RelationDef } from "@/lib/links"

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

export const LEXICAL_RELATIONS: RelationDef[] = [
  sym("translation-of", "is a translation of", {
    description: "The same meaning in another language.",
    phrases: { forward: ["$s is a translation of $o"], inverse: ["$o is a translation of $s"] },
  }),
  sym("synonym-of", "is a synonym of", {
    description: "The same meaning.",
    phrases: { forward: ["$s is a synonym of $o"], inverse: ["$o is a synonym of $s"] },
  }),
  sym("antonym-of", "is an antonym of", {
    traits: { disjointWith: ["synonym-of"] },
    description: "An opposite. Not a synonym of the same item.",
    phrases: { forward: ["$s is an antonym of $o"], inverse: ["$o is an antonym of $s"] },
  }),
  ...pair(
    "root-of",
    "is the root of",
    "derived-from",
    "is derived from",
    {
      description: "The earlier word the other one comes from.",
      phrases: { forward: ["$s is the root of $o"], inverse: ["$o is derived from $s"] },
    },
    {
      description: "A word grown from that root.",
      phrases: { forward: ["$s is derived from $o"], inverse: ["$o is the root of $s"] },
    },
  ),
  sym("false-friend-of", "is a false friend of", {
    description: "Looks like a translation and means something else.",
    phrases: { forward: ["$s is a false friend of $o"], inverse: ["$o is a false friend of $s"] },
  }),
]
