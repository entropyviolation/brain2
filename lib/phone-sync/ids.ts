/**
 * lib/phone-sync/ids.ts — Stable ids and the stamp every synced row carries
 *
 * The id is derived from the source id, so a re-read writes the same row and
 * the hub's union-by-id (lib/vault-guard.js) keeps one copy. The stamp's `id`
 * is per record, never per day or per source: the guard drops rows of a
 * generated batch that a fresher snapshot left out, and a per-source batch
 * would let a desktop that saw fewer messages delete the rest.
 */
import type { PhoneSyncSource } from "./types"

export const PHONE_SYNC_KIND = "phone-sync" as const

/** FNV-1a, 32-bit, base36. Short and stable; collisions only matter within one source. */
export function shortHash(text: string): string {
  let h = 0x811c9dc5
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i)
    h = Math.imul(h, 0x01000193) >>> 0
  }
  return h.toString(36)
}

export function sourceKey(source: PhoneSyncSource, sourceId: string): string {
  return `${source}:${sourceId}`
}

/** Tracking entry id. `part` numbers the day slices of a call that crosses midnight. */
export function phoneEntryId(source: PhoneSyncSource, sourceId: string, part = 0): string {
  const base = `ps-${source}-${shortHash(sourceId)}-${shortHash(`${sourceId}\0salt`)}`
  return part ? `${base}-${part}` : base
}

export function phoneStamp(source: PhoneSyncSource, sourceId: string): { kind: typeof PHONE_SYNC_KIND; id: string } {
  return { kind: PHONE_SYNC_KIND, id: sourceKey(source, sourceId) }
}
