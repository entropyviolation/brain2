/**
 * lib/ingest/nfc-tag.ts — NFC tag records for phone taps
 *
 * A sticker does not write the vault. The phone sends `nfc:{id}` through BIM.
 * The id is the slug stored here. Settings → Message ingest keeps the list.
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
