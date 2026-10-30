/**
 * lib/bim-flow/texts-client.ts — Load recent phone texts into the lab
 *
 * Reads `/api/phone-texts` (the hub, read only). Only a recent window comes
 * back: texts from months ago say nothing about what the person is doing now.
 * Names come from People I Know phone numbers; an unknown number stays a
 * formatted number.
 */

import { formatHandle, normalizeHandle } from "@/lib/phone-sync/handles"
import { toRows, type RawText, type TextRow } from "./texts"
import type { VaultSnapshot } from "./vault-search"

/** Days of texts any lab path may read. Mirrors the server cap's default. */
export const TEXT_WINDOW_DAYS = 14
/** Days loaded so company habits can be learned from the person's own marked hours. Only the last `TEXT_WINDOW_DAYS` are read as evidence. */
export const TEXT_LEARN_DAYS = 60

export function nameResolver(people: VaultSnapshot["people"]): (handle: string) => string {
  const byHandle = new Map<string, string>()
  for (const p of people ?? []) for (const h of p.handles ?? []) byHandle.set(normalizeHandle(h), p.names[0] ?? p.title)
  return (handle) => byHandle.get(normalizeHandle(handle)) ?? formatHandle(handle)
}

export async function loadTexts(opts: { days?: number; day?: string; people?: VaultSnapshot["people"] }): Promise<TextRow[] | null> {
  try {
    const q = new URLSearchParams({ days: String(opts.days ?? TEXT_LEARN_DAYS) })
    if (opts.day) q.set("day", opts.day)
    const res = await fetch(`/api/phone-texts?${q}`)
    if (!res.ok) return null
    const body = (await res.json()) as { rows?: RawText[] }
    return toRows(body.rows ?? [], nameResolver(opts.people))
  } catch {
    return null
  }
}

/** Local days that have texts in the window, with counts. */
export async function loadTextDays(days = TEXT_WINDOW_DAYS): Promise<Record<string, number> | null> {
  try {
    const res = await fetch(`/api/phone-texts?index=1&days=${days}`)
    if (!res.ok) return null
    return ((await res.json()) as { counts?: Record<string, number> }).counts ?? {}
  } catch {
    return null
  }
}
