/**
 * lib/kitchen-safety.ts — How long a kitchen lot has been here, and a keep guess
 *
 * The guess uses a typical keep time for that food and room, counted from the
 * bought date, or from the opened date, or from the day you marked it still
 * good. It is a house guess, not a safety test.
 */

import type { KitchenFood, KitchenRoom, KitchenStock } from "@/lib/kitchen-types"

export type KeepGuess = "fine" | "soon" | "past"

export interface KeepRead {
  daysHeld: number
  keepDays: number
  daysLeft: number
  guess: KeepGuess
  /** The date the clock started from. */
  since: string
}

export const ROOM_KEEP_DAYS: Record<KitchenRoom, number> = {
  fridge: 7,
  pantry: 180,
  spice: 730,
  freezer: 120,
}

const DATE_KEY = /^\d{4}-\d{2}-\d{2}$/

export function isDateKey(value: string): boolean {
  return DATE_KEY.test(value)
}

function utcDay(key: string): number {
  const [y, m, d] = key.split("-").map(Number)
  return Date.UTC(y, m - 1, d) / 86_400_000
}

/** Whole calendar days from `from` through `to`. Negative spans read as 0. */
export function daysBetween(from: string, to: string): number {
  if (!isDateKey(from) || !isDateKey(to)) return 0
  return Math.max(0, Math.round(utcDay(to) - utcDay(from)))
}

export function keepDaysFor(food: Pick<KitchenFood, "keepDays"> | null | undefined, room: KitchenRoom): number {
  const custom = food?.keepDays?.[room]
  if (typeof custom === "number" && custom > 0) return Math.round(custom)
  return ROOM_KEEP_DAYS[room]
}

/** Last days of a keep window that read as "use soon". Short windows warn on the last day. */
export function soonLimit(keepDays: number): number {
  if (keepDays <= 3) return 1
  return Math.min(14, Math.max(2, Math.round(keepDays * 0.1)))
}

export function keepAnchor(stock: Pick<KitchenStock, "boughtOn" | "openedOn" | "stillGoodOn">): string {
  return stock.stillGoodOn || stock.openedOn || stock.boughtOn
}

export function assessKeep(
  stock: Pick<KitchenStock, "room" | "boughtOn" | "openedOn" | "stillGoodOn" | "finished" | "amount">,
  food: Pick<KitchenFood, "keepDays"> | null | undefined,
  today: string,
): KeepRead {
  const since = keepAnchor(stock)
  const keepDays = keepDaysFor(food, stock.room)
  const daysHeld = daysBetween(since, today)
  const daysLeft = keepDays - daysHeld
  let guess: KeepGuess = "fine"
  if (stock.finished || stock.amount <= 0) guess = "past"
  else if (daysLeft < 0) guess = "past"
  else if (daysLeft <= soonLimit(keepDays)) guess = "soon"
  return { daysHeld, keepDays, daysLeft, guess, since }
}

export function heldLabel(daysHeld: number): string {
  if (daysHeld <= 0) return "Since today"
  if (daysHeld === 1) return "1 day"
  return `${daysHeld} days`
}

export function guessLabel(guess: KeepGuess): string {
  if (guess === "past") return "Past the usual keep time"
  if (guess === "soon") return "Use soon"
  return "Fine"
}
