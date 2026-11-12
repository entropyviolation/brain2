/**
 * lib/pharmacy-math.ts — Pure rules for the Pharmacy (no store, no React)
 *
 * One dose is one dose, however many doors report it. A bottle can lose units
 * from a hand tap, an Intake line in Tracking (name match), an NFC scan, or a
 * daily habit that is linked to it. This file holds the shapes and the maths:
 * which item an intake title means, how many units a habit cell is worth, and
 * how many days a bottle has left.
 */
import { TaskType, type TaskCompletion, type WeeklyTask } from "@/lib/types"

export const PHARMACY_KINDS = ["rx", "supplement", "otc"] as const
export type PharmacyKind = (typeof PHARMACY_KINDS)[number]

export const PHARMACY_KIND_LABEL: Record<PharmacyKind, string> = {
  rx: "Prescription",
  supplement: "Supplement",
  otc: "Over the counter",
}

/** The bottle drawn in the diorama. A `bottle` is an amber pill bottle. */
export const PHARMACY_FORMS = ["pill", "capsule", "gummy", "powder", "liquid"] as const
export type PharmacyForm = (typeof PHARMACY_FORMS)[number]

export const PHARMACY_FORM_LABEL: Record<PharmacyForm, string> = {
  pill: "Pills",
  capsule: "Capsules",
  gummy: "Gummies",
  powder: "Powder",
  liquid: "Liquid",
}

/** Count noun beside the number. Liquid and powder are measured, so they read "ml" and "scoops". */
export const PHARMACY_FORM_UNIT: Record<PharmacyForm, string> = {
  pill: "pills",
  capsule: "capsules",
  gummy: "gummies",
  powder: "scoops",
  liquid: "ml",
}

export interface PharmacyItem {
  id: string
  name: string
  /** Other names a log line may use. Matched like the name. */
  aliases: string[]
  kind: PharmacyKind
  form: PharmacyForm
  /** Printed strength, shown on the label. "10 mg". */
  strength?: string
  /** Units on hand now. Never below 0. */
  count: number
  /** A full bottle. The fill bar and the pill pile scale to it. */
  capacity: number
  /** Units one dose uses. A log line "2 adderall" draws 2 × this. */
  perDose: number
  /** Warn at or under this many units. Missing means 20% of capacity. */
  lowAt?: number
  /** Cap colour (hex). Missing picks one from the name. */
  color?: string
  /** A daily habit that draws from this bottle. */
  habitId?: string
  /** Units one habit completion draws. A count habit draws this per counted unit. */
  habitPer: number
  /** YYYY-MM-DD the link was made. Older habit days never draw. */
  habitSince?: string
  /** YYYY-MM-DD the item was added. Older Intake lines never draw. */
  addedOn: string
  note?: string
}

export type PharmacySource = "hand" | "intake" | "nfc" | "habit" | "refill" | "fix"

export interface PharmacyLedgerRow {
  itemId: string
  /** Units this source took. Refunded when the source goes away. */
  units: number
  /** YYYY-MM-DD */
  date: string
  source: PharmacySource
}

export interface PharmacyLogRow {
  id: string
  itemId: string
  /** ISO time of the change. */
  at: string
  /** Signed change in units on hand. Negative is a dose. */
  delta: number
  source: PharmacySource
  note?: string
}

const DATE_KEY = /^\d{4}-\d{2}-\d{2}$/
const UNIT_WORDS = new Set(["mg", "mcg", "ug", "g", "ml", "iu", "oz", "l", "cc", "units", "unit", "pill", "pills", "tab", "tabs", "capsule", "capsules", "cap", "caps", "softgel", "softgels", "gummy", "gummies"])

export function pharmacyAmount(value: unknown, fallback = 0): number {
  const n = typeof value === "number" ? value : Number(value)
  if (!Number.isFinite(n) || n < 0) return fallback
  return Math.round(n * 1000) / 1000
}

function cleanText(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined
  const text = value.trim().replace(/\s+/g, " ")
  return text || undefined
}

export function newPharmacyId(prefix: string): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") return `${prefix}_${crypto.randomUUID()}`
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`
}

export function sanitizePharmacyItem(raw: Partial<PharmacyItem> | null | undefined, today: string): PharmacyItem | null {
  if (!raw || typeof raw !== "object") return null
  const name = cleanText(raw.name)
  if (!name) return null
  const kind = PHARMACY_KINDS.includes(raw.kind as PharmacyKind) ? (raw.kind as PharmacyKind) : "supplement"
  const form = PHARMACY_FORMS.includes(raw.form as PharmacyForm) ? (raw.form as PharmacyForm) : "pill"
  const capacity = Math.max(1, pharmacyAmount(raw.capacity, 30) || 30)
  const count = pharmacyAmount(raw.count, capacity)
  const perDose = pharmacyAmount(raw.perDose, 1) || 1
  const lowAt = raw.lowAt != null && pharmacyAmount(raw.lowAt, -1) >= 0 ? pharmacyAmount(raw.lowAt) : undefined
  const aliases = Array.isArray(raw.aliases)
    ? raw.aliases.map(cleanText).filter((row): row is string => Boolean(row))
    : []
  const color = typeof raw.color === "string" && /^#[0-9a-f]{6}$/i.test(raw.color) ? raw.color : undefined
  const habitId = cleanText(raw.habitId)
  const habitPer = pharmacyAmount(raw.habitPer, 1) || 1
  const habitSince = habitId && typeof raw.habitSince === "string" && DATE_KEY.test(raw.habitSince) ? raw.habitSince : habitId ? today : undefined
  const strength = cleanText(raw.strength)
  const note = cleanText(raw.note)
  return {
    id: typeof raw.id === "string" && raw.id ? raw.id : newPharmacyId("rx"),
    name,
    aliases,
    kind,
    form,
    ...(strength ? { strength } : {}),
    count,
    capacity,
    perDose,
    ...(lowAt != null ? { lowAt } : {}),
    ...(color ? { color } : {}),
    ...(habitId ? { habitId } : {}),
    habitPer,
    ...(habitSince ? { habitSince } : {}),
    addedOn: typeof raw.addedOn === "string" && DATE_KEY.test(raw.addedOn) ? raw.addedOn : today,
    ...(note ? { note } : {}),
  }
}

export function lowThreshold(item: Pick<PharmacyItem, "lowAt" | "capacity">): number {
  return item.lowAt ?? Math.ceil(item.capacity * 0.2)
}

export type PharmacyLevel = "empty" | "low" | "ok"

export function levelOf(item: Pick<PharmacyItem, "count" | "lowAt" | "capacity">): PharmacyLevel {
  if (item.count <= 0) return "empty"
  return item.count <= lowThreshold(item) ? "low" : "ok"
}

/** 0–1, how full the bottle is. */
export function fillOf(item: Pick<PharmacyItem, "count" | "capacity">): number {
  return Math.min(1, Math.max(0, item.count / Math.max(1, item.capacity)))
}

export function countLabel(item: Pick<PharmacyItem, "count" | "form">): string {
  return `${trimNumber(item.count)} ${PHARMACY_FORM_UNIT[item.form]}`
}

export function trimNumber(value: number): string {
  return Number.isInteger(value) ? String(value) : String(Math.round(value * 100) / 100)
}

/** Lowercase word tokens. "Adderall XR 10mg" → adderall, xr, 10mg. */
export function nameTokens(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/(\d)([a-z])/g, "$1 $2")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .split(" ")
    .filter(Boolean)
}

function contentTokens(text: string): string[] {
  return nameTokens(text).filter((token) => !/^\d+(\.\d+)?$/.test(token) && !UNIT_WORDS.has(token))
}

/**
 * The count at the front of a log title and the name after it.
 * "2 10 mg adderall" → 2 and "10 mg adderall". "10 mg adderall" keeps no count
 * because a number before a unit word is a strength, not a dose count.
 */
export function splitDoseTitle(title: string): { doses: number; rest: string } {
  const match = /^\s*(\d+(?:\.\d+)?)\s*(?:x\s+|×\s*)?(.+)$/i.exec(title)
  if (!match) return { doses: 1, rest: title.trim() }
  const count = Number(match[1])
  const rest = match[2].trim()
  const next = nameTokens(rest)[0] ?? ""
  if (!(count > 0 && count <= 20) || UNIT_WORDS.has(next)) return { doses: 1, rest: title.trim() }
  return { doses: count, rest }
}

/** The item a log title names, or null. The longest name that fits wins. */
export function itemForIntakeTitle(
  title: string,
  items: readonly PharmacyItem[],
): { item: PharmacyItem; doses: number } | null {
  const { doses, rest } = splitDoseTitle(title)
  const have = new Set(nameTokens(rest))
  let best: { item: PharmacyItem; score: number } | null = null
  for (const item of items) {
    for (const candidate of [item.name, ...item.aliases]) {
      const need = contentTokens(candidate)
      if (!need.length || !need.every((token) => have.has(token))) continue
      // Strength words that appear on both sides break a tie between 10 mg and 20 mg.
      const strength = nameTokens(candidate).filter((token) => !need.includes(token) && have.has(token)).length
      const score = need.length * 10 + strength
      if (!best || score > best.score) best = { item, score }
    }
  }
  return best ? { item: best.item, doses } : null
}

/**
 * Units a daily habit cell is worth. A yes/no habit is `per` when done.
 * A count or goal habit is `per` for each counted unit.
 */
export function habitUnits(task: Pick<WeeklyTask, "type">, completion: TaskCompletion | undefined, per: number): number {
  if (!completion) return 0
  if (task.type === TaskType.BOOLEAN || task.type === TaskType.TEXT) return completion.completed ? per : 0
  const value = typeof completion.value === "number" && Number.isFinite(completion.value) ? completion.value : 0
  return Math.max(0, value) * per
}

/**
 * Average units used per day over the last `days` days that the item has a
 * history. Hand fixes and refills do not count as use. Null when nothing was used.
 */
export function dailyUse(
  itemId: string,
  log: readonly PharmacyLogRow[],
  now: Date,
  days = 14,
  addedOn?: string,
): number | null {
  const since = now.getTime() - days * 86_400_000
  let used = 0
  for (const row of log) {
    if (row.itemId !== itemId || row.delta >= 0) continue
    if (row.source === "fix" || row.source === "refill") continue
    if (Date.parse(row.at) < since) continue
    used += -row.delta
  }
  if (used <= 0) return null
  const added = addedOn ? Date.parse(`${addedOn}T00:00:00`) : NaN
  const span = Number.isFinite(added) ? Math.min(days, Math.max(1, Math.ceil((now.getTime() - added) / 86_400_000))) : days
  return used / span
}

export function daysLeft(count: number, use: number | null): number | null {
  if (use == null || use <= 0) return null
  return Math.floor(count / use)
}

export function daysLeftLabel(days: number | null): string {
  if (days == null) return ""
  if (days <= 0) return "runs out today"
  if (days === 1) return "about 1 day left"
  return `about ${days} days left`
}
