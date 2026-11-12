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

/**
 * A handle's name: the person item that has it saved; else the Mac Contacts name (`names`, from the hub),
 * as the person item of that name when there is exactly one; else the Contacts name; else the number.
 */
export function nameResolver(people: VaultSnapshot["people"], contacts: Record<string, string> = {}): (handle: string) => string {
  const byHandle = new Map<string, string>()
  const byName = new Map<string, Set<string>>()
  for (const p of people ?? []) {
    const shown = p.names[0] ?? p.title
    for (const h of p.handles ?? []) byHandle.set(normalizeHandle(h), shown)
    for (const n of p.names) {
      const k = n.trim().toLowerCase()
      if (k) byName.set(k, (byName.get(k) ?? new Set()).add(shown))
    }
  }
  const byContact = new Map<string, string>()
  for (const [h, n] of Object.entries(contacts)) byContact.set(normalizeHandle(h), n)
  return (handle) => {
    const h = normalizeHandle(handle)
    const saved = byHandle.get(h)
    if (saved) return saved
    const contact = byContact.get(h)
    if (!contact) return formatHandle(handle)
    const items = byName.get(contact.trim().toLowerCase())
    return items?.size === 1 ? [...items][0]! : contact
  }
}

/** `base`: the hub's address when the page is not served by it (the iPhone app); default same origin. */
export async function loadTexts(opts: { days?: number; day?: string; people?: VaultSnapshot["people"]; hideHandles?: string[]; base?: string }): Promise<TextRow[] | null> {
  try {
    const q = new URLSearchParams({ days: String(opts.days ?? TEXT_LEARN_DAYS) })
    if (opts.day) q.set("day", opts.day)
    const res = await fetch(`${opts.base ?? ""}/api/phone-texts?${q}`)
    if (!res.ok) return null
    const body = (await res.json()) as { rows?: RawText[]; names?: Record<string, string> }
    const hidden = new Set((opts.hideHandles ?? []).map((h) => normalizeHandle(h)))
    const rows = hidden.size ? (body.rows ?? []).filter((r) => !hidden.has(normalizeHandle(r.h))) : (body.rows ?? [])
    return toRows(rows, nameResolver(opts.people, body.names))
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
