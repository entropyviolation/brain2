/**
 * lib/phone-sync/health-apply.ts — Land one Health page in the stores
 *
 * Pure merging lives in `health.ts`. This is the door the phone calls after
 * each page: daily totals, sleep mornings, and Exercise blocks.
 */
import { syncSleepNight } from "@/lib/sleep-sync"
import { useSleepStore } from "@/lib/sleep-store"
import { useTimeTrackingStore } from "@/lib/time-tracking-store"
import { mergeHealthPage, type HealthPageWrite } from "./health"
import { useHealthImportStore } from "./health-store"

export function commitHealthPage(raw: unknown, now = new Date().toISOString()): HealthPageWrite {
  const health = useHealthImportStore.getState()
  const tracking = useTimeTrackingStore.getState()
  const sleep = useSleepStore.getState()
  const merged = mergeHealthPage(
    {
      days: health.days,
      ledger: health.nights,
      sleep: sleep.nights,
      entries: tracking.entries,
      removedEntryIds: tracking.removedEntryIds ?? [],
      scopes: tracking.scopes,
    },
    raw,
  )
  if (merged.state.days !== health.days || merged.state.ledger !== health.nights) {
    useHealthImportStore.setState({ days: merged.state.days, nights: merged.state.ledger })
  }
  if (merged.state.entries !== tracking.entries || merged.state.scopes !== tracking.scopes) {
    useTimeTrackingStore.setState({ entries: merged.state.entries, scopes: merged.state.scopes })
  }
  if (merged.nightDates.length) {
    const nights = { ...merged.state.sleep }
    for (const date of merged.nightDates) {
      const night = nights[date]
      if (night) nights[date] = { ...night, updatedAt: now }
    }
    useSleepStore.setState({ nights })
    for (const date of merged.nightDates) syncSleepNight(date)
  }
  return merged.write
}
