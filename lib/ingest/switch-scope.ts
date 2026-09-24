/**
 * lib/ingest/switch-scope.ts — "Until further notice" Tracking paint
 *
 * Location / mood / open activity are intervals, not events. Painting from
 * `nowMin` through the end of the local day lets the next switch overwrite
 * only the remaining hours.
 */
import { useTimeTrackingStore } from "@/lib/time-tracking-store"
import { MINUTES_PER_DAY } from "./times"

export function switchScopePen(
  date: string,
  scopeId: string,
  nowMin: number,
  penId: string,
  variantIds?: string[],
): void {
  const start = Math.min(Math.max(0, Math.floor(nowMin)), MINUTES_PER_DAY - 1)
  const endMin = start + 1 >= MINUTES_PER_DAY ? MINUTES_PER_DAY : MINUTES_PER_DAY
  useTimeTrackingStore.getState().paintMinutes(date, scopeId, start, endMin, penId, variantIds)
}

export function paintActivityWindow(
  date: string,
  startMin: number,
  endMin: number,
  penId: string,
  variantIds?: string[],
): void {
  const start = Math.min(Math.max(0, Math.floor(startMin)), MINUTES_PER_DAY - 1)
  let end = Math.floor(endMin)
  if (end <= start) end = start + 1
  if (end > MINUTES_PER_DAY) end = MINUTES_PER_DAY
  useTimeTrackingStore.getState().paintMinutes(date, "activity", start, end, penId, variantIds)
}
