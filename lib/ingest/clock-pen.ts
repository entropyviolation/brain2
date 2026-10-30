/**
 * lib/ingest/clock-pen.ts — Shared minute clock and pen helpers
 *
 * Ingest replies print this 12-hour clock. Phone pens and Screen Time pens
 * take a stable palette color from the id. Phone name match reads `{ id, name }`
 * off the scope's pens.
 */
import { PEN_PALETTE, useTimeTrackingStore } from "@/lib/time-tracking-store"
import type { Named } from "./name-resolve"

export function formatClock(min: number): string {
  const wrapped = ((Math.floor(min) % 1440) + 1440) % 1440
  const h = Math.floor(wrapped / 60)
  const m = wrapped % 60
  const am = h < 12
  const h12 = h % 12 || 12
  return `${h12}:${String(m).padStart(2, "0")} ${am ? "AM" : "PM"}`
}

export function hashPenColor(id: string): string {
  let hash = 0
  for (let i = 0; i < id.length; i++) {
    hash = (hash * 31 + id.charCodeAt(i)) >>> 0
  }
  return PEN_PALETTE[hash % PEN_PALETTE.length]
}

export function namedPens(scopeId: string): Named[] {
  const scope = useTimeTrackingStore.getState().scopes.find((s) => s.id === scopeId)
  return (scope?.pens ?? []).map((p) => ({ id: p.id, name: p.name }))
}
