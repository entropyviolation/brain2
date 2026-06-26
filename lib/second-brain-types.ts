/**
 * lib/second-brain-types.ts — Source & Belief item types (Brain2 feature #10)
 *
 * Defines two user-facing `ItemTypeDefinition`s that turn COGS into a small
 * research → source → belief knowledge graph (Brain2 #55/#66/#67/#68):
 *
 *   - **Source** — a piece of captured evidence (a full document, a snippet, or
 *     a report) with a `trust` score and provenance (`origin`). Sources are the
 *     leaves of the graph: they support or refute beliefs.
 *   - **Belief** — a statement the user holds, with a `certainty` they assign and
 *     a `strength` *derived* from the sources linked to it (see
 *     `lib/belief-strength.ts`). A belief links to sources through the typed
 *     `supported-by` / `refuted-by` relations, each link carrying a `stance`.
 *
 * Both types render through the existing generic Lists attribute panels +
 * RelatedItemsPanel — this module only declares the schema (attributes,
 * defaults, displayed attributes, detail panels) so they display well, plus a
 * seed helper the item-type store wires into a "set up second brain" action.
 *
 * Pure + serializable: no store or React imports here.
 */
import type { AttributeDefinition, ItemTypeDefinition } from "@/lib/types"

/** Item type ids (stable string ids, referenced by the seed helper + tests). */
export const SOURCE_TYPE_ID = "source"
export const BELIEF_TYPE_ID = "belief"

/**
 * Attribute ids for the Source type. Centralized so `belief-strength.ts` and
 * any UI can read e.g. the trust attribute without hard-coding strings.
 */
export const SOURCE_ATTR = {
  content: "content",
  sourceType: "sourceType",
  origin: "origin",
  summaryShort: "summaryShort",
  summaryLong: "summaryLong",
  usageHint: "usageHint",
  trust: "trust",
  factCheckLevel: "factCheckLevel",
  tags: "tags",
} as const

/** Attribute ids for the Belief type. */
export const BELIEF_ATTR = {
  statement: "statement",
  presuppositions: "presuppositions",
  subjectTags: "subjectTags",
  strength: "strength",
  certainty: "certainty",
  justification: "justification",
  locked: "locked",
} as const

/** Neutral default trust applied to new Sources (0-1). */
export const DEFAULT_SOURCE_TRUST = 0.5

const SOURCE_ATTRIBUTES: AttributeDefinition[] = [
  { id: SOURCE_ATTR.content, name: "Content", type: "string" },
  {
    id: SOURCE_ATTR.sourceType,
    name: "Source Type",
    type: "selection",
    optionSource: "manual",
    options: ["full", "snippet", "report"],
  },
  { id: SOURCE_ATTR.origin, name: "Origin", type: "string" },
  { id: SOURCE_ATTR.summaryShort, name: "Short Summary", type: "string" },
  { id: SOURCE_ATTR.summaryLong, name: "Long Summary", type: "string" },
  { id: SOURCE_ATTR.usageHint, name: "Usage Hint", type: "string" },
  { id: SOURCE_ATTR.trust, name: "Trust", type: "number", allowFloat: true },
  { id: SOURCE_ATTR.factCheckLevel, name: "Fact-Check Level", type: "number" },
  { id: SOURCE_ATTR.tags, name: "Tags", type: "multistring" },
]

const BELIEF_ATTRIBUTES: AttributeDefinition[] = [
  { id: BELIEF_ATTR.statement, name: "Statement", type: "string" },
  { id: BELIEF_ATTR.presuppositions, name: "Presuppositions", type: "multistring" },
  { id: BELIEF_ATTR.subjectTags, name: "Subject Tags", type: "multistring" },
  // Strength is derived (computeBeliefStrength) — stored for display/sorting.
  { id: BELIEF_ATTR.strength, name: "Strength", type: "number", allowFloat: true },
  { id: BELIEF_ATTR.certainty, name: "Certainty", type: "number", allowFloat: true },
  { id: BELIEF_ATTR.justification, name: "Justification", type: "string" },
  // "Core" belief: harder to edit (a guardrail flag the UI can honor).
  { id: BELIEF_ATTR.locked, name: "Locked (core)", type: "boolean", booleanDisplay: "switch" },
]

/** The Source item-type definition (user-facing, not built-in). */
export function getSourceTypeDefinition(): ItemTypeDefinition {
  return {
    id: SOURCE_TYPE_ID,
    name: "Source",
    pluralName: "Sources",
    itemLabel: "source",
    description:
      "A captured piece of evidence (document, snippet, or report) with a trust score and provenance. Sources support or refute beliefs.",
    builtin: false,
    color: "#2f6fed",
    attributes: SOURCE_ATTRIBUTES,
    defaultAttributeValues: {
      [SOURCE_ATTR.sourceType]: "snippet",
      [SOURCE_ATTR.trust]: DEFAULT_SOURCE_TRUST,
      [SOURCE_ATTR.factCheckLevel]: 0,
    },
    displayedAttributes: [
      SOURCE_ATTR.sourceType,
      SOURCE_ATTR.trust,
      SOURCE_ATTR.origin,
      SOURCE_ATTR.summaryShort,
    ],
    detailPanels: ["details", "dependencies"],
    capabilities: { completable: false },
    rules: [
      {
        id: "source-require-content",
        name: "Source content is required",
        trigger: "validate",
        action: {
          kind: "require",
          field: SOURCE_ATTR.content,
          message: "A source needs some content.",
        },
      },
    ],
  }
}

/** The Belief item-type definition (user-facing, not built-in). */
export function getBeliefTypeDefinition(): ItemTypeDefinition {
  return {
    id: BELIEF_TYPE_ID,
    name: "Belief",
    pluralName: "Beliefs",
    itemLabel: "belief",
    description:
      "A statement you hold. Its strength is derived from the sources that support or refute it (each weighted by trust and stance); certainty is your own assessment.",
    builtin: false,
    color: "#a855f7",
    attributes: BELIEF_ATTRIBUTES,
    defaultAttributeValues: {
      [BELIEF_ATTR.strength]: 0.5,
      [BELIEF_ATTR.certainty]: 0.5,
      [BELIEF_ATTR.locked]: false,
    },
    displayedAttributes: [
      BELIEF_ATTR.statement,
      BELIEF_ATTR.strength,
      BELIEF_ATTR.certainty,
      BELIEF_ATTR.locked,
    ],
    // "dependencies" panel surfaces the typed source links (supported-by /
    // refuted-by) via the generic RelatedItemsPanel.
    detailPanels: ["details", "dependencies"],
    capabilities: { completable: false },
    rules: [
      {
        id: "belief-require-statement",
        name: "Belief statement is required",
        trigger: "validate",
        action: {
          kind: "require",
          field: BELIEF_ATTR.statement,
          message: "A belief needs a statement.",
        },
      },
    ],
  }
}

/** Both second-brain type definitions, in display order (Source, Belief). */
export function getSecondBrainTypeDefinitions(): ItemTypeDefinition[] {
  return [getSourceTypeDefinition(), getBeliefTypeDefinition()]
}

/** Ids of the second-brain types (for presence checks / seeding). */
export const SECOND_BRAIN_TYPE_IDS = [SOURCE_TYPE_ID, BELIEF_TYPE_ID] as const

/**
 * Pure "set up second brain" merge: returns `existing` with the Source/Belief
 * types appended if missing (existing definitions are preserved untouched, so
 * this is idempotent and never removes user types). The item-type store wraps
 * this in a `seedSecondBrainTypes()` action.
 */
export function withSecondBrainTypes(existing: ItemTypeDefinition[]): ItemTypeDefinition[] {
  const present = new Set(existing.map((t) => t.id))
  const additions = getSecondBrainTypeDefinitions().filter((t) => !present.has(t.id))
  return additions.length ? [...existing, ...additions] : existing
}
