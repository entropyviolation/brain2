/**
 * components/Inventory/kitchen/kitchen-rows.ts — Stock as shelf rows
 *
 * Living lots from `useKitchenStore` become the diorama lots and the phone
 * groups. Finished lots and empty amounts stay off the shelf. Names come
 * from `resolveKitchenFood` (saved foods, then the catalog).
 */

import { resolveKitchenFood } from "@/lib/kitchen-store"
import { KITCHEN_ROOMS, ROOM_LABEL, type KitchenFood, type KitchenRoom, type KitchenStock, type StockUnit } from "@/lib/kitchen-types"

export interface KitchenShelfRow {
  id: string
  name: string
  room: KitchenRoom
  roomLabel: string
  amountLabel: string
}

export interface KitchenPhoneGroup {
  room: KitchenRoom
  label: string
  rows: KitchenShelfRow[]
}

export type KitchenPick = { kind: "lot"; id: string } | { kind: "room"; room: KitchenRoom }

/** Pantry, fridge, and freezer, then the spice cabinet when it has lots. */
const PHONE_ROOMS: readonly KitchenRoom[] = ["pantry", "fridge", "freezer", "spice"]

/** Rooms the diorama opens, in shelf order. Spice stays when the store still has that room. */
export const SHELF_ROOMS: readonly KitchenRoom[] = PHONE_ROOMS.filter((room) =>
  (KITCHEN_ROOMS as readonly string[]).includes(room),
)

/** A new lot uses the store's count unit. A blank amount is 1. */
export function stockAddDraft(
  name: string,
  room: KitchenRoom,
  amountText: string,
  boughtOn: string,
): { name: string; room: KitchenRoom; amount: number; unit: StockUnit; boughtOn: string } | null {
  const trimmed = name.trim()
  if (!trimmed) return null
  const text = amountText.trim()
  const qty = text === "" ? 1 : Number(text)
  if (!Number.isFinite(qty) || qty <= 0) return null
  return { name: trimmed, room, amount: qty, unit: "count", boughtOn }
}

export function roomFromPick(pick: KitchenPick | null, rows: readonly KitchenShelfRow[]): KitchenRoom | null {
  if (!pick) return null
  if (pick.kind === "room") return pick.room
  return rows.find((row) => row.id === pick.id)?.room ?? null
}

/** Place in a sentence: "the pantry", "the spice cabinet". */
export function shelfRoomPhrase(room: KitchenRoom): string {
  if (room === "spice") return "the spice cabinet"
  return `the ${ROOM_LABEL[room].toLowerCase()}`
}

export function addedToRoomLine(name: string, room: KitchenRoom): string {
  return `${name.trim()} are in ${shelfRoomPhrase(room)}.`
}

export function formatStockAmount(amount: number, unit: StockUnit): string {
  const text = Number.isInteger(amount) ? String(amount) : String(Math.round(amount * 10) / 10)
  if (unit === "g") return `${text} g`
  if (unit === "ml") return `${text} ml`
  return text
}

export function stockToShelfRows(stock: readonly KitchenStock[], foods: readonly KitchenFood[]): KitchenShelfRow[] {
  const rows: KitchenShelfRow[] = []
  for (const lot of stock) {
    if (lot.finished || !(lot.amount > 0)) continue
    rows.push({
      id: lot.id,
      name: resolveKitchenFood(lot.foodId, foods)?.name || "Food",
      room: lot.room,
      roomLabel: ROOM_LABEL[lot.room],
      amountLabel: formatStockAmount(lot.amount, lot.unit),
    })
  }
  return rows
}

export function filterShelfRows(rows: readonly KitchenShelfRow[], query: string): KitchenShelfRow[] {
  const needle = query.trim().toLowerCase()
  if (!needle) return [...rows]
  return rows.filter((row) => row.name.toLowerCase().includes(needle))
}

export function shelfRowsToDioramaLots(rows: readonly KitchenShelfRow[]): { id: string; room: KitchenRoom; name: string }[] {
  return rows.map((row) => ({ id: row.id, room: row.room, name: row.name }))
}

export function groupShelfRows(rows: readonly KitchenShelfRow[]): KitchenPhoneGroup[] {
  return PHONE_ROOMS.flatMap((room) => {
    const inRoom = rows.filter((row) => row.room === room)
    if (inRoom.length === 0) return []
    return [{ room, label: ROOM_LABEL[room], rows: inRoom }]
  })
}

export function describeKitchenPick(pick: KitchenPick | null, rows: readonly KitchenShelfRow[]): string | null {
  if (!pick) return null
  if (pick.kind === "room") return ROOM_LABEL[pick.room]
  const row = rows.find((item) => item.id === pick.id)
  if (!row) return null
  return `${row.name} · ${row.roomLabel} · ${row.amountLabel}`
}

export function plannedMealLine(count: number): string | null {
  if (!Number.isFinite(count) || count <= 0) return null
  const n = Math.floor(count)
  return n === 1 ? "1 meal on the plan" : `${n} meals on the plan`
}

export function activeRoomForPick(pick: KitchenPick | null, rows: readonly KitchenShelfRow[]): KitchenRoom | "all" {
  if (!pick) return "all"
  if (pick.kind === "room") return pick.room
  return rows.find((row) => row.id === pick.id)?.room ?? "all"
}
