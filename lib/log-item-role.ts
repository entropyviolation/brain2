/**
 * lib/log-item-role.ts — Which item type a tracking row already is
 *
 * Read-only. `classifyLogBookRow` chooses the shelf. This maps that shelf
 * onto a log subtype id. An interval is not a log row. A location instant
 * with no switch is not one either. A non-instant interval is a timeblock.
 * Nothing here writes the store.
 */
import {
  classifyLogBookRow,
  type LogBookList,
  type LogTimeEntry,
} from "@/components/Home/Tracking/tracking-log-model"
import {
  LOG_DRINK_TYPE_ID,
  LOG_DRUG_TYPE_ID,
  LOG_FOOD_TYPE_ID,
  LOG_INTAKE_TYPE_ID,
  LOG_NOTE_TYPE_ID,
  LOG_SPEND_TYPE_ID,
  LOG_SWITCH_TYPE_ID,
} from "@/lib/log-item-types"
import { TIMEBLOCK_TYPE_ID } from "@/lib/timeblock-types"
import { LOG_TYPE_ID, THOUGHT_PROCESS_TYPE_ID } from "@/lib/tracking-item-types"

const SHELF_TYPE_ID: Record<LogBookList, LogItemTypeId> = {
  event: LOG_TYPE_ID,
  thought: THOUGHT_PROCESS_TYPE_ID,
  food: LOG_FOOD_TYPE_ID,
  drink: LOG_DRINK_TYPE_ID,
  drug: LOG_DRUG_TYPE_ID,
  intake: LOG_INTAKE_TYPE_ID,
  note: LOG_NOTE_TYPE_ID,
  switch: LOG_SWITCH_TYPE_ID,
  spend: LOG_SPEND_TYPE_ID,
}

export type LogItemTypeId =
  | typeof LOG_TYPE_ID
  | typeof THOUGHT_PROCESS_TYPE_ID
  | typeof LOG_FOOD_TYPE_ID
  | typeof LOG_DRINK_TYPE_ID
  | typeof LOG_DRUG_TYPE_ID
  | typeof LOG_INTAKE_TYPE_ID
  | typeof LOG_NOTE_TYPE_ID
  | typeof LOG_SWITCH_TYPE_ID
  | typeof LOG_SPEND_TYPE_ID

/** Shelf of an existing instant, or null for an interval or a row with no log shelf. */
export function logItemTypeIdForEntry(entry: LogTimeEntry, penName?: string): LogItemTypeId | null {
  if (entry.kind !== "instant") return null
  const row = classifyLogBookRow(entry, penName)
  if (!row) return null
  return SHELF_TYPE_ID[row.list]
}

/** A painted span. An instant, including a location tick, is not a timeblock. */
export function timeblockTypeIdForEntry(entry: LogTimeEntry): typeof TIMEBLOCK_TYPE_ID | null {
  if (entry.kind === "instant") return null
  return TIMEBLOCK_TYPE_ID
}

/** Item id for one count. The type id is `log-count`; this is the item. */
export function countItemId(countId: string): string {
  return `count-item-${countId}`
}
