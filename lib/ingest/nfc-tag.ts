/**
 * lib/ingest/nfc-tag.ts — NFC tag records for phone taps
 *
 * A sticker does not write the vault. The phone sends `nfc:{id}` through BIM
 * or `POST /api/scan` on the phone hub, or `nfc:{id} 2` when this scan’s count
 * is not the saved quantity.
 * The id is the slug stored here. Settings → NFC tags keeps the list.
 * A second tap of the same tag inside 20 seconds is a double-read.
 */
import type { IntakeClass } from "@/lib/time-entries"

export const NFC_DEBOUNCE_MS = 20_000

export type NfcTagKind = "instant" | "toggle"
export type NfcHabitCredit = "done" | "add"
export type NfcDoorSide = "out" | "in"

export interface NfcTag {
  /** Slug the shortcut sends (`vitamin-d`). */
  id: string
  name: string
  kind: NfcTagKind
  /** Instant title. A toggle uses `leftTitle` / `backTitle`. */
  title: string
  intakeClass?: IntakeClass
  /** Minutes painted as a block ending at the scan. Instant tags only. */
  minutes?: number
  /**
   * How many this scan logs when the line has no number. Instant tags only.
   * `nfc:adderall 2` overrides it for that one text. Missing means 1.
   */
  quantity?: number
  leftTitle: string
  backTitle: string
  /** Door toggle. `out` was the last scan (logged left). `in` logged back. */
  lastSide?: NfcDoorSide
  lastAt?: string
  /** Daily habit only. Weekly and monthly ids are stored and skipped at scan time. */
  habitId?: string
  habitCredit: NfcHabitCredit
}

/** Letters, digits, and single hyphens. Empty when nothing usable remains. */
export function nfcSlug(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .replace(/^nfc\s*[:：]\s*/i, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
}

export function nfcLine(id: string): string {
  return `nfc:${nfcSlug(id)}`
}

/** `nfc:{id}` or `nfc:{id} {n}`. A null quantity omits the number so the saved count is used. */
export function nfcScanLine(id: string, quantity: number | null): string {
  const slug = nfcSlug(id)
  if (!slug) return ""
  if (quantity == null) return `nfc:${slug}`
  return `nfc:${slug} ${nfcQuantity(quantity)}`
}

/** Drug, food, or drink instants ask how many. A door or a plain event does not. */
export function nfcTagAsksQuantity(tag: { kind: NfcTagKind; intakeClass?: string | null }): boolean {
  return tag.kind === "instant" && (tag.intakeClass === "food" || tag.intakeClass === "drink" || tag.intakeClass === "drug")
}

export interface NfcTagCatalogRow {
  id: string
  name: string
  kind: NfcTagKind
  intakeClass?: NfcTag["intakeClass"]
  quantity?: number
}

/** Fields the phone needs to name a chip and decide whether to ask how many. */
export function nfcTagCatalog(tags: readonly NfcTag[]): NfcTagCatalogRow[] {
  return tags.map((tag) => ({
    id: tag.id,
    name: tag.name,
    kind: tag.kind,
    ...(tag.intakeClass ? { intakeClass: tag.intakeClass } : {}),
    ...(tag.kind === "instant" ? { quantity: nfcQuantity(tag.quantity) } : {}),
  }))
}

/** Split `adderall 2` into the slug and an optional count (1–99). A bare id keeps quantity null. */
export function parseNfcCommand(payload: string): { id: string; quantity: number | null } {
  let text = payload.trim().replace(/^nfc\s*[:：]\s*/i, "")
  const match = /^(.*\S)\s+(\d{1,2})$/.exec(text)
  let quantity: number | null = null
  if (match) {
    const count = Number(match[2])
    if (count >= 1 && count <= 99) {
      text = match[1]
      quantity = count
    }
  }
  return { id: nfcSlug(text), quantity }
}

export function nfcQuantity(raw: unknown): number {
  if (typeof raw !== "number" || !Number.isFinite(raw)) return 1
  return Math.min(99, Math.max(1, Math.floor(raw)))
}

export function sanitizeNfcTag(raw: Partial<NfcTag> | null | undefined): NfcTag | null {
  if (!raw || typeof raw !== "object") return null
  const id = nfcSlug(typeof raw.id === "string" ? raw.id : "")
  if (!id) return null
  const name = typeof raw.name === "string" && raw.name.trim() ? raw.name.trim() : id
  const kind: NfcTagKind = raw.kind === "toggle" ? "toggle" : "instant"
  const title = typeof raw.title === "string" && raw.title.trim() ? raw.title.trim() : name
  const intake =
    raw.intakeClass === "food" || raw.intakeClass === "drink" || raw.intakeClass === "drug"
      ? raw.intakeClass
      : undefined
  const minutes =
    kind === "instant" && typeof raw.minutes === "number" && Number.isFinite(raw.minutes) && raw.minutes >= 1
      ? Math.min(24 * 60, Math.floor(raw.minutes))
      : undefined
  const quantity = kind === "instant" ? nfcQuantity(raw.quantity) : undefined
  const leftTitle = typeof raw.leftTitle === "string" && raw.leftTitle.trim() ? raw.leftTitle.trim() : "left"
  const backTitle = typeof raw.backTitle === "string" && raw.backTitle.trim() ? raw.backTitle.trim() : "back"
  const lastSide = raw.lastSide === "out" || raw.lastSide === "in" ? raw.lastSide : undefined
  const lastAt = typeof raw.lastAt === "string" && raw.lastAt.trim() ? raw.lastAt : undefined
  const habitId = typeof raw.habitId === "string" && raw.habitId.trim() ? raw.habitId.trim() : undefined
  return {
    id,
    name,
    kind,
    title,
    ...(intake && kind === "instant" ? { intakeClass: intake } : {}),
    ...(minutes ? { minutes } : {}),
    ...(quantity ? { quantity } : {}),
    leftTitle,
    backTitle,
    ...(lastSide ? { lastSide } : {}),
    ...(lastAt ? { lastAt } : {}),
    ...(habitId ? { habitId } : {}),
    habitCredit: raw.habitCredit === "add" ? "add" : "done",
  }
}

export function sanitizeNfcTagList(value: unknown): NfcTag[] {
  if (!Array.isArray(value)) return []
  const out: NfcTag[] = []
  for (const row of value) {
    const clean = sanitizeNfcTag(row as Partial<NfcTag>)
    if (clean && !out.some((tag) => tag.id === clean.id)) out.push(clean)
  }
  return out
}

/** True when `now` is within 20 seconds after `lastAt`. A clock behind `lastAt` is not a double-read. */
export function nfcTapIsDebounced(lastAt: string | undefined, now: Date): boolean {
  if (!lastAt) return false
  const then = Date.parse(lastAt)
  if (!Number.isFinite(then)) return false
  const delta = now.getTime() - then
  return delta >= 0 && delta < NFC_DEBOUNCE_MS
}
