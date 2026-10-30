/**
 * lib/timeblock-types.ts — Timeblock item type
 *
 * A timeblock is its own catalog type, not a child of Log. Interval blocks
 * open in EntryDialog. It is not a task: no schedule, subtasks, or complete.
 *
 * Pure + serializable. Registered via `withTimeblockType()` in `lib/item-types.ts`.
 */
import type { ItemTypeDefinition } from "@/lib/types"

export const TIMEBLOCK_TYPE_ID = "timeblock"

export function getTimeblockTypeDefinition(): ItemTypeDefinition {
  return {
    id: TIMEBLOCK_TYPE_ID,
    name: "Timeblock",
    pluralName: "Timeblocks",
    itemLabel: "timeblock",
    description: "An interval of tracked time. Interval timeblocks open in EntryDialog.",
    builtin: true,
    kind: "catalog",
    color: "#24506e",
    detailPanels: ["details"],
    capabilities: {},
  }
}

/** Append Timeblock when that id is not already present. */
export function withTimeblockType(types: ItemTypeDefinition[]): ItemTypeDefinition[] {
  if (types.some((type) => type.id === TIMEBLOCK_TYPE_ID)) return types
  return [...types, getTimeblockTypeDefinition()]
}
