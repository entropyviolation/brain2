/**
 * lib/tracking-item-types.ts — Thought Process and Log item types
 *
 * These match the Tracking log rows already written by BIM, Quick Add, and
 * the Tracking log composer. A thought process is an Activity instant with
 * `eventKind` `thought-process` (title, note, clock). A log is an Activity
 * Text log event whose `eventKind` is the slug of the phrase (`left room`),
 * including a range. Intake, notes, switches, and spends stay off these types.
 *
 * Pure + serializable. Registered via `withTrackingItemTypes()` in
 * `lib/item-types.ts`.
 */
import type { AttributeDefinition, ItemTypeDefinition } from "@/lib/types"

export const THOUGHT_PROCESS_TYPE_ID = "thought-process"
export const LOG_TYPE_ID = "log"

export const TRACKING_ITEM_ATTR = {
  when: "trackingWhen",
  clock: "trackingClock",
  eventKind: "trackingEventKind",
  entryId: "trackingEntryId",
} as const

const WHEN: AttributeDefinition = { id: TRACKING_ITEM_ATTR.when, name: "When", type: "string" }
const CLOCK: AttributeDefinition = {
  id: TRACKING_ITEM_ATTR.clock,
  name: "Clock",
  type: "selection",
  optionSource: "manual",
  options: ["exact", "estimated", "unknown"],
}
const KIND: AttributeDefinition = { id: TRACKING_ITEM_ATTR.eventKind, name: "Kind", type: "string" }
const ENTRY: AttributeDefinition = { id: TRACKING_ITEM_ATTR.entryId, name: "Tracking entry", type: "string" }

export function getThoughtProcessTypeDefinition(): ItemTypeDefinition {
  return {
    id: THOUGHT_PROCESS_TYPE_ID,
    name: "Thought Process",
    pluralName: "Thought processes",
    itemLabel: "thought",
    description:
      "A guiding strand of this moment: why you are doing something, what you expect next, and how it lands. The same Text log instant as tp: / thought process:, eventKind thought-process.",
    builtin: true,
    kind: "catalog",
    color: "#3d6b8a",
    attributes: [WHEN, CLOCK, KIND, ENTRY],
    displayedAttributes: [TRACKING_ITEM_ATTR.when, TRACKING_ITEM_ATTR.clock],
    detailPanels: ["details"],
    capabilities: { completable: false },
  }
}

export function getLogTypeDefinition(): ItemTypeDefinition {
  return {
    id: LOG_TYPE_ID,
    name: "Log",
    pluralName: "Logs",
    itemLabel: "log",
    description:
      "A Tracking log event: the phrase is the title and the eventKind slug, with the clock and any note. The same row as log: and the Tracking log Event composer.",
    builtin: true,
    kind: "catalog",
    color: "#1a3a5c",
    attributes: [WHEN, CLOCK, KIND, ENTRY],
    displayedAttributes: [TRACKING_ITEM_ATTR.when, TRACKING_ITEM_ATTR.clock, TRACKING_ITEM_ATTR.eventKind],
    detailPanels: ["details"],
    capabilities: { completable: false },
  }
}

export function withTrackingItemTypes(existing: ItemTypeDefinition[]): ItemTypeDefinition[] {
  const present = new Set(existing.map((type) => type.id))
  const next = [...existing]
  if (!present.has(THOUGHT_PROCESS_TYPE_ID)) next.push(getThoughtProcessTypeDefinition())
  if (!present.has(LOG_TYPE_ID)) next.push(getLogTypeDefinition())
  return next
}
