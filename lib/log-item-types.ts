/**
 * lib/log-item-types.ts — Log subtypes
 *
 * Food, drink, drug, intake, log note, switch, spend, and count are catalog
 * children of Log (`parentTypeId` `log`). They are not tasks. The id is
 * `log-note`, not `note`, because the note type id forces the Body panel.
 * Food lines open in FoodDetailDialog. Counts live in the count store.
 * The other lines open in EntryDialog.
 *
 * Pure + serializable. Registered via `withLogItemTypes()` in `lib/item-types.ts`.
 * A stored catalog type is not replaced; a missing parent is filled in
 * `mergeTypeRegistry`.
 */
import type { ItemTypeDefinition } from "@/lib/types"
import { LOG_TYPE_ID } from "@/lib/tracking-item-types"

export const LOG_FOOD_TYPE_ID = "log-food"
export const LOG_DRINK_TYPE_ID = "log-drink"
export const LOG_DRUG_TYPE_ID = "log-drug"
export const LOG_INTAKE_TYPE_ID = "log-intake"
export const LOG_NOTE_TYPE_ID = "log-note"
export const LOG_SWITCH_TYPE_ID = "log-switch"
export const LOG_SPEND_TYPE_ID = "log-spend"
export const LOG_COUNT_TYPE_ID = "log-count"

export const LOG_SUBTYPE_IDS = [
  LOG_FOOD_TYPE_ID,
  LOG_DRINK_TYPE_ID,
  LOG_DRUG_TYPE_ID,
  LOG_INTAKE_TYPE_ID,
  LOG_NOTE_TYPE_ID,
  LOG_SWITCH_TYPE_ID,
  LOG_SPEND_TYPE_ID,
  LOG_COUNT_TYPE_ID,
] as const

const ENTRY = "Opens in EntryDialog."

const LOG_SUBTYPE_SEEDS: Array<Pick<ItemTypeDefinition, "id" | "name" | "pluralName" | "itemLabel" | "description" | "color">> = [
  {
    id: LOG_FOOD_TYPE_ID,
    name: "Food",
    pluralName: "Foods",
    itemLabel: "food",
    description: "A food line on the Tracking log. Food lines open in FoodDetailDialog.",
    color: "#8a5a2a",
  },
  {
    id: LOG_DRINK_TYPE_ID,
    name: "Drink",
    pluralName: "Drinks",
    itemLabel: "drink",
    description: `A drink line on the Tracking log. ${ENTRY}`,
    color: "#3d6b8a",
  },
  {
    id: LOG_DRUG_TYPE_ID,
    name: "Drug",
    pluralName: "Drugs",
    itemLabel: "drug",
    description: `A drug line on the Tracking log. ${ENTRY}`,
    color: "#6b3d5c",
  },
  {
    id: LOG_INTAKE_TYPE_ID,
    name: "Intake",
    pluralName: "Intakes",
    itemLabel: "intake",
    description: `An intake line on the Tracking log. ${ENTRY}`,
    color: "#5c6b3d",
  },
  {
    id: LOG_NOTE_TYPE_ID,
    name: "Log note",
    pluralName: "Log notes",
    itemLabel: "log note",
    description: `A note on the Tracking log. ${ENTRY}`,
    color: "#5c5346",
  },
  {
    id: LOG_SWITCH_TYPE_ID,
    name: "Switch",
    pluralName: "Switches",
    itemLabel: "switch",
    description: `A switch on the Tracking log. ${ENTRY}`,
    color: "#3d5c6b",
  },
  {
    id: LOG_SPEND_TYPE_ID,
    name: "Spent",
    pluralName: "Spent",
    itemLabel: "spend",
    description: `A spend on the Tracking log. ${ENTRY}`,
    color: "#6b5a3d",
  },
  {
    id: LOG_COUNT_TYPE_ID,
    name: "Count",
    pluralName: "Counts",
    itemLabel: "count",
    description: "A named tally on the Tracking log. Ticks live in the count store.",
    color: "#4a5c6b",
  },
]

function logSubtype(seed: (typeof LOG_SUBTYPE_SEEDS)[number]): ItemTypeDefinition {
  return {
    ...seed,
    builtin: true,
    kind: "catalog",
    parentTypeId: LOG_TYPE_ID,
    detailPanels: ["details"],
    capabilities: {},
  }
}

export function getLogSubtypeDefinitions(): ItemTypeDefinition[] {
  return LOG_SUBTYPE_SEEDS.map(logSubtype)
}

/** Append Log subtypes whose ids are not already present. */
export function withLogItemTypes(types: ItemTypeDefinition[]): ItemTypeDefinition[] {
  const present = new Set(types.map((type) => type.id))
  const missing = getLogSubtypeDefinitions().filter((type) => !present.has(type.id))
  if (missing.length === 0) return types
  return [...types, ...missing]
}
