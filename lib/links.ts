/**
 * lib/links.ts — Typed relations & tags (pure helpers)
 *
 * The relation catalog and pure helpers behind generic item-to-item links and
 * tags (spec §5 — second-brain navigation). Links are stored on `Item.links`
 * as `{ id, relation, targetId }`; relations are typed and have inverses so a
 * link from A→B implies a discoverable backlink B→A. Tags are normalized free
 * text on `Item.tags`.
 *
 * Everything here is pure and unit-tested; the store/repository build on these.
 */
import type { ItemLink, LinkStance } from "@/lib/types"

/** A relation type item links can express. */
export interface RelationDef {
  id: string
  /** Forward label, e.g. "blocks". */
  label: string
  /** Inverse relation id; self-referential for symmetric relations. */
  inverse: string
  /** Label for the inverse direction, e.g. "blocked by". */
  inverseLabel: string
}

/** Built-in relation catalog. Symmetric relations use themselves as inverse. */
export const RELATIONS: RelationDef[] = [
  { id: "blocks", label: "blocks", inverse: "blocked-by", inverseLabel: "blocked by" },
  { id: "blocked-by", label: "blocked by", inverse: "blocks", inverseLabel: "blocks" },
  { id: "supports", label: "supports", inverse: "supported-by", inverseLabel: "supported by" },
  { id: "supported-by", label: "supported by", inverse: "supports", inverseLabel: "supports" },
  // Source→belief evidence relations (second-brain belief graph, Worker E). The
  // forward direction reads source→belief; the inverse reads belief→source so a
  // belief can discover the sources that support/refute it via backlinks.
  { id: "refutes", label: "refutes", inverse: "refuted-by", inverseLabel: "refuted by" },
  { id: "refuted-by", label: "refuted by", inverse: "refutes", inverseLabel: "refutes" },
  { id: "reviews", label: "reviews", inverse: "reviewed-by", inverseLabel: "reviewed by" },
  { id: "reviewed-by", label: "reviewed by", inverse: "reviews", inverseLabel: "reviews" },
  { id: "goal-of", label: "goal of", inverse: "action-of", inverseLabel: "action of" },
  { id: "action-of", label: "action of", inverse: "goal-of", inverseLabel: "goal of" },
  { id: "checklist-of", label: "checklist of", inverse: "has-checklist", inverseLabel: "has checklist" },
  { id: "has-checklist", label: "has checklist", inverse: "checklist-of", inverseLabel: "checklist of" },
  // Objectives layer (Worker A): goal↔objective↔action + subgoal nesting.
  { id: "objective-of", label: "objective of", inverse: "has-objective", inverseLabel: "has objective" },
  { id: "has-objective", label: "has objective", inverse: "objective-of", inverseLabel: "objective of" },
  { id: "subgoal-of", label: "subgoal of", inverse: "has-subgoal", inverseLabel: "has subgoal" },
  { id: "has-subgoal", label: "has subgoal", inverse: "subgoal-of", inverseLabel: "subgoal of" },
  // Operations / directed enterprises (Worker B): part/phase/resource composition.
  { id: "part-of", label: "part of", inverse: "has-part", inverseLabel: "has part" },
  { id: "has-part", label: "has part", inverse: "part-of", inverseLabel: "part of" },
  { id: "phase-of", label: "phase of", inverse: "has-phase", inverseLabel: "has phase" },
  { id: "has-phase", label: "has phase", inverse: "phase-of", inverseLabel: "phase of" },
  { id: "resource-of", label: "resource of", inverse: "has-resource", inverseLabel: "has resource" },
  { id: "has-resource", label: "has resource", inverse: "resource-of", inverseLabel: "resource of" },
  { id: "related", label: "related to", inverse: "related", inverseLabel: "related to" },
]

const RELATION_BY_ID = new Map(RELATIONS.map((r) => [r.id, r]))

/** Whether a relation id is part of the built-in catalog. */
export function isKnownRelation(relation: string): boolean {
  return RELATION_BY_ID.has(relation)
}

/**
 * Inverse of a relation. Unknown relations are treated as symmetric (their own
 * inverse), so user-defined relations still produce backlinks.
 */
export function inverseRelation(relation: string): string {
  return RELATION_BY_ID.get(relation)?.inverse ?? relation
}

/** Human label for a relation id (falls back to the raw id). */
export function relationLabel(relation: string): string {
  return RELATION_BY_ID.get(relation)?.label ?? relation
}

function makeLinkId(): string {
  try {
    if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
      return crypto.randomUUID()
    }
  } catch {
    /* fall through */
  }
  return `lnk_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`
}

/** Build a new link record. */
export function makeLink(relation: string, targetId: string): ItemLink {
  return { id: makeLinkId(), relation, targetId }
}

/** True if `links` already contains a (relation, targetId) pair. */
export function hasLink(links: ItemLink[] | undefined, relation: string, targetId: string): boolean {
  return (links ?? []).some((l) => l.relation === relation && l.targetId === targetId)
}

/**
 * Add a (relation → targetId) link to `links`, returning a new array.
 * Self-links (sourceId === targetId) and duplicate pairs are rejected (the
 * original array reference is returned unchanged so callers can skip writes).
 */
export function addLink(
  links: ItemLink[] | undefined,
  relation: string,
  targetId: string,
  sourceId?: string,
): ItemLink[] {
  const current = links ?? []
  if (!relation || !targetId) return current
  if (sourceId && sourceId === targetId) return current
  if (hasLink(current, relation, targetId)) return current
  return [...current, makeLink(relation, targetId)]
}

/** Remove a link by its id, returning a new array (or the original if absent). */
export function removeLink(links: ItemLink[] | undefined, linkId: string): ItemLink[] {
  const current = links ?? []
  const next = current.filter((l) => l.id !== linkId)
  return next.length === current.length ? current : next
}

/** Remove every link matching (relation, targetId). */
export function removeLinkByTarget(
  links: ItemLink[] | undefined,
  relation: string,
  targetId: string,
): ItemLink[] {
  const current = links ?? []
  const next = current.filter((l) => !(l.relation === relation && l.targetId === targetId))
  return next.length === current.length ? current : next
}

// --- Tag helpers -----------------------------------------------------------

/** Normalize a tag: trim, collapse inner whitespace, lowercase. */
export function normalizeTag(tag: string): string {
  return tag.trim().replace(/\s+/g, " ").toLowerCase()
}

/** Add a normalized tag, returning a new array (dedup, ignores empty). */
export function addTag(tags: string[] | undefined, tag: string): string[] {
  const current = tags ?? []
  const normalized = normalizeTag(tag)
  if (!normalized || current.includes(normalized)) return current
  return [...current, normalized]
}

/** Remove a tag (matched after normalization), returning a new array. */
export function removeTag(tags: string[] | undefined, tag: string): string[] {
  const current = tags ?? []
  const normalized = normalizeTag(tag)
  const next = current.filter((t) => t !== normalized)
  return next.length === current.length ? current : next
}

// --- Stance helpers (second-brain source→belief evidence, Worker E) ---------
//
// A link can carry an optional `stance` on the five-level support↔refute
// spectrum (see `LinkStance` in lib/types.ts). These additive helpers let the
// belief graph read/write a stance and weight it to a signed scalar in
// [-1, +1], used by lib/belief-strength.ts. Existing link/tag helpers are
// unchanged.

/** Relations that express source→belief evidence (forward + backlink ids). */
export const EVIDENCE_RELATIONS = [
  "supports",
  "supported-by",
  "refutes",
  "refuted-by",
] as const

/** True if a relation id participates in the support/refute evidence graph. */
export function isEvidenceRelation(relation: string): boolean {
  return (EVIDENCE_RELATIONS as readonly string[]).includes(relation)
}

/** Signed weight for each stance: support is positive, refute negative. */
export const STANCE_WEIGHTS: Record<LinkStance, number> = {
  "strong-support": 1,
  "weak-support": 0.5,
  none: 0,
  "weak-refute": -0.5,
  "strong-refute": -1,
}

/**
 * Map a stance to a signed scalar in [-1, +1]:
 * strong-support=+1, weak-support=+0.5, none=0, weak-refute=-0.5,
 * strong-refute=-1. Missing/unknown stances weigh 0 (neutral).
 */
export function stanceWeight(stance: LinkStance | undefined | null): number {
  if (!stance) return 0
  return STANCE_WEIGHTS[stance] ?? 0
}

/** Read a link's stance (undefined when none was set). */
export function getLinkStance(link: ItemLink | undefined | null): LinkStance | undefined {
  return link?.stance
}

/** Return a copy of `link` with its stance set (immutable update). */
export function setLinkStance(link: ItemLink, stance: LinkStance): ItemLink {
  return { ...link, stance }
}

/**
 * Default stance implied by a relation when a link carries no explicit stance:
 * `supports`/`supported-by` ⇒ strong-support, `refutes`/`refuted-by` ⇒
 * strong-refute, everything else ⇒ none.
 */
export function defaultStanceForRelation(relation: string): LinkStance {
  if (relation === "supports" || relation === "supported-by") return "strong-support"
  if (relation === "refutes" || relation === "refuted-by") return "strong-refute"
  return "none"
}

/**
 * Effective signed weight of an evidence link in [-1, +1]: its explicit stance
 * if present, otherwise the stance implied by its relation. Non-evidence
 * relations with no stance contribute 0.
 */
export function linkStanceWeight(link: ItemLink): number {
  const stance = link.stance ?? defaultStanceForRelation(link.relation)
  return stanceWeight(stance)
}
