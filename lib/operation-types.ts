/**
 * lib/operation-types.ts — Operation item type (Feature 2, Worker B)
 *
 * Defines the built-in **Operation** `ItemTypeDefinition`: a *directed
 * enterprise* (Brain2 #201/#202–213/#276/#277) — a long-running project with
 * phases, a home/notes pad, a work/neglect heatmap, a running log, a
 * "to-do-next" rail, attached resources, and an op post-mortem.
 *
 * An Operation is just a `Task` carrying `type: "operation"`. Its phases, parts,
 * and resources are *other* tasks linked through the typed relations added to
 * `lib/links.ts` upfront (`has-phase`/`phase-of`, `has-part`/`part-of`,
 * `has-resource`/`resource-of`). This module only declares the type schema
 * (attributes, defaults, displayed attributes, detail panels, capabilities) plus
 * an idempotent `withOperationType()` merge helper the item-type store / the
 * integration pass wires into the built-in registry.
 *
 * Pure + serializable: no store or React imports here (mirrors
 * `lib/second-brain-types.ts`).
 */
import type { AttributeDefinition, ItemTypeDefinition } from "@/lib/types"

/** Stable item-type id, referenced by helpers, components, and tests. */
export const OPERATION_TYPE_ID = "operation"

/**
 * Attribute ids for the Operation type. Centralized so `lib/operations.ts` and
 * the Operations UI can read e.g. the stage without hard-coding strings.
 */
export const OPERATION_ATTR = {
  mission: "mission",
  stage: "stage",
  targetDate: "targetDate",
  homeNotes: "homeNotes",
} as const

/** Lifecycle stages an Operation moves through. */
export const OPERATION_STAGES = ["planning", "active", "paused", "done", "abandoned"] as const
export type OperationStage = (typeof OPERATION_STAGES)[number]

/** Default stage applied to a freshly created / upgraded Operation. */
export const DEFAULT_OPERATION_STAGE: OperationStage = "planning"

const OPERATION_ATTRIBUTES: AttributeDefinition[] = [
  { id: OPERATION_ATTR.mission, name: "Mission", type: "string" },
  {
    id: OPERATION_ATTR.stage,
    name: "Stage",
    type: "selection",
    optionSource: "manual",
    options: [...OPERATION_STAGES],
  },
  { id: OPERATION_ATTR.targetDate, name: "Target Date", type: "datetime", datetimeMode: "date" },
  // The Home notes pad lives in the dedicated `homeNotes` attribute so it never
  // collides with the task's generic `notes` field.
  { id: OPERATION_ATTR.homeNotes, name: "Home Notes", type: "string" },
]

/** The Operation item-type definition (built-in; seeded at integration). */
export function getOperationTypeDefinition(): ItemTypeDefinition {
  return {
    id: OPERATION_TYPE_ID,
    name: "Operation",
    pluralName: "Operations",
    itemLabel: "operation",
    description:
      "A directed enterprise: a long-running project broken into phases, with a home/notes pad, a work/neglect heatmap, a running log, a to-do-next rail, attached resources, and a post-mortem.",
    builtin: true,
    color: "#0f766e",
    attributes: OPERATION_ATTRIBUTES,
    defaultAttributeValues: {
      [OPERATION_ATTR.stage]: DEFAULT_OPERATION_STAGE,
    },
    displayedAttributes: [OPERATION_ATTR.stage, OPERATION_ATTR.mission, OPERATION_ATTR.targetDate],
    // Operations surface phases/parts/resources through the generic relations
    // panel ("dependencies") and roll up logged time ("time").
    detailPanels: ["details", "dependencies", "time", "analysis"],
    capabilities: {
      completable: true,
      subtasks: true,
      scheduleable: true,
      deadline: true,
      duration: true,
      nextActions: true,
    },
  }
}

/** Operation type id, for presence checks / seeding. */
export const OPERATION_TYPE_IDS = [OPERATION_TYPE_ID] as const

/**
 * Pure "register the Operation type" merge: returns `existing` with the
 * Operation type appended if missing (existing definitions are preserved
 * untouched, so this is idempotent and never removes user types). The
 * integration pass wires this into the built-in registry / item-type store.
 */
export function withOperationType(existing: ItemTypeDefinition[]): ItemTypeDefinition[] {
  if (existing.some((t) => t.id === OPERATION_TYPE_ID)) return existing
  return [...existing, getOperationTypeDefinition()]
}
