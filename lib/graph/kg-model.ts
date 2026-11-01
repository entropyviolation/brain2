/**
 * lib/graph/kg-model.ts — The shared shape of the whole-vault knowledge graph.
 *
 * Types only. `knowledge-graph.ts` builds a `KnowledgeGraph` from the day
 * spine (`vault-graph.ts`), the recorded edges (`vault-edges.ts`), and the
 * read-time reasoner. `schema-category.ts` reads the vocabulary as a small
 * category. Extraction, insights, feedback, and the atlas view read these
 * types and never write a store. House laws: `docs/KNOWLEDGE_GRAPH_PLAN.md` §2.
 */
import type { EdgeOrder } from "@/lib/graph/vault-graph"

/** Address prefix of a node. `item:` ids are Items; the rest are read-time addresses. */
export type KgNodeKind =
  | "item"
  | "list"
  | "pen"
  | "block"
  | "message"
  | "place"
  | "habit"
  | "day"
  | "week"
  | "month"
  | "season"
  | "year"

export interface KgNode {
  /** Full address, e.g. `item:abc`, `day:2026-11-01`. */
  id: string
  kind: KgNodeKind
  label: string
  /** Item type id for `item:` nodes. */
  typeId?: string
  /**
   * The address prefix when it is not a `KgNodeKind` (`who`, `stream`,
   * `capture`, `value`, `review`, `period`). `kind` is then the nearest kind.
   */
  prefix?: string
}

export interface KgEdge {
  s: string
  p: string
  o: string
  /** Named graph the edge came from: `links`, `dependencies`, `lists`, `spine`, `derived`, … */
  graph: string
  order: EdgeOrder
  /** Valid time, local `YYYY-MM-DD`. */
  at?: string
  /** For a derived edge: the rule id or trait that made it. */
  proof?: string
}

export interface KnowledgeGraph {
  nodes: Map<string, KgNode>
  edges: KgEdge[]
  /** Edges by subject address. */
  out: Map<string, KgEdge[]>
  /** Edges by object address. */
  in: Map<string, KgEdge[]>
}

/**
 * The vocabulary read as a category (an olog, after Spivak and Kent).
 * Objects are item types plus address kinds. Morphisms are relations with a
 * domain and codomain. Composition is read from chain rules and transitive
 * traits. Nothing here is stored; it is computed from the relation registry.
 */
export interface SchemaObject {
  /** Item type id, or `@<kind>` for an address kind (`@day`), or `*` for any. */
  id: string
  label: string
}

export interface SchemaMorphism {
  /** Relation id. Identity morphisms use `id:<object>`. */
  id: string
  dom: string
  cod: string
  label: string
}

/**
 * Two relation paths from one object to another that the person says agree:
 * `left` and `right` are relation ids read left to right. A path equation
 * that fails on the data is a finding, never an automatic fix.
 */
export interface PathEquation {
  id: string
  label: string
  left: string[]
  right: string[]
  /** `equal`: both ways. `implies`: left ⊆ right (what a chain rule says). */
  kind: "equal" | "implies"
}

/** One place the data breaks a path equation. Extensional: names both ends and the path that holds. */
export interface EquationBreak {
  equationId: string
  from: string
  to: string
  /** Which side holds on the data. The other side is missing. */
  holds: "left" | "right"
}
