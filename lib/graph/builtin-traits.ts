/**
 * lib/graph/builtin-traits.ts — Vocabulary v2 fields for built-ins and seeds.
 *
 * `RELATIONS` in `lib/links.ts` stays frozen. Parents, traits, reciprocity,
 * phrases and descriptions for built-in and seed relations live here and are
 * merged by `lib/relation-registry.ts` on read (LINKS_REDESIGN §6.2, L1.3).
 * Only the keys in `OVERRIDABLE_RELATION_KEYS` are read; ids and labels never
 * change. Seed parents live on the seeds (`lib/person-relations.ts`).
 *
 * `functional` caps targets per source and `inverseFunctional` caps sources
 * per target: a person has one mother (mother-of inverse-functional 1), and
 * a mother can have many children.
 */
import type { RelationDef } from "@/lib/links"

export const BUILTIN_TRAITS: Record<string, Partial<RelationDef>> = {
  // Composition.
  "part-of": { traits: { transitive: true, acyclic: true }, description: "A piece of something larger." },
  "has-part": { traits: { transitive: true, acyclic: true } },
  "phase-of": { parent: "part-of", traits: { acyclic: true } },
  "has-phase": { parent: "has-part", traits: { acyclic: true } },
  "subgoal-of": { traits: { transitive: true, acyclic: true } },
  "has-subgoal": { traits: { transitive: true, acyclic: true } },
  // Order.
  blocks: { traits: { acyclic: true } },
  "blocked-by": { traits: { acyclic: true } },
  // Evidence: one source cannot both support and refute a belief.
  supports: { traits: { disjointWith: ["refutes"] } },
  refutes: { traits: { disjointWith: ["supports"] } },
  "supported-by": { traits: { disjointWith: ["refuted-by"] } },
  "refuted-by": { traits: { disjointWith: ["supported-by"] } },
  // One-way facts: the ledger does not ask for the reverse.
  reviews: { reciprocity: "quiet" },
  "reviewed-by": { reciprocity: "quiet" },
  // Person seeds.
  "mother-of": { traits: { inverseFunctional: 1 } },
  "father-of": { traits: { inverseFunctional: 1 } },
  "married-to": { traits: { functional: 1 } },
}
