/**
 * components/Inventory/pharmacy/pharmacy-rows.ts — Bottles as rows and diorama props
 *
 * Pure. The list, the 3D shelf, and the phone all read the same row.
 */
import {
  countLabel,
  dailyUse,
  daysLeft,
  daysLeftLabel,
  fillOf,
  levelOf,
  PHARMACY_KIND_LABEL,
  type PharmacyItem,
  type PharmacyLevel,
  type PharmacyLogRow,
} from "@/lib/pharmacy-math"
import type { PharmacyBottle } from "./pharmacy-diorama"

const CAPS = ["#7dcec4", "#f2a6b8", "#f5c27a", "#a8c6f0", "#c9b2ec", "#a9d8a0"]

/** The stored cap colour, or one picked from the name so a bottle keeps its look. */
export function capColor(item: Pick<PharmacyItem, "color" | "name">): string {
  if (item.color) return item.color
  let h = 0
  for (const ch of item.name.toLowerCase()) h = (h * 31 + ch.charCodeAt(0)) >>> 0
  return CAPS[h % CAPS.length]
}

export interface PharmacyRow {
  id: string
  name: string
  strength?: string
  kindLabel: string
  amountLabel: string
  fill: number
  level: PharmacyLevel
  /** "about 12 days left", or "" when there is no recent use. */
  runway: string
  color: string
}

export function pharmacyRows(items: readonly PharmacyItem[], log: readonly PharmacyLogRow[], now = new Date()): PharmacyRow[] {
  return items.map((item) => ({
    id: item.id,
    name: item.name,
    ...(item.strength ? { strength: item.strength } : {}),
    kindLabel: PHARMACY_KIND_LABEL[item.kind],
    amountLabel: `${countLabel(item)} of ${item.capacity}`,
    fill: fillOf(item),
    level: levelOf(item),
    runway: daysLeftLabel(daysLeft(item.count, dailyUse(item.id, log, now, 14, item.addedOn))),
    color: capColor(item),
  }))
}

export function filterPharmacyRows(rows: readonly PharmacyRow[], query: string): PharmacyRow[] {
  const q = query.trim().toLowerCase()
  if (!q) return [...rows]
  return rows.filter((row) => row.name.toLowerCase().includes(q) || row.kindLabel.toLowerCase().includes(q))
}

export function pharmacyBottles(items: readonly PharmacyItem[]): PharmacyBottle[] {
  return items.map((item) => ({
    id: item.id,
    name: item.name,
    ...(item.strength ? { strength: item.strength } : {}),
    form: item.form,
    fill: fillOf(item),
    level: levelOf(item),
    color: capColor(item),
  }))
}

/** One quiet line above the shelf. */
export function pharmacySummary(items: readonly PharmacyItem[]): string {
  if (!items.length) return "No bottles yet."
  const low = items.filter((item) => levelOf(item) !== "ok")
  const bottles = `${items.length} ${items.length === 1 ? "bottle" : "bottles"}`
  if (!low.length) return bottles
  return `${bottles} · ${low.length} low`
}
