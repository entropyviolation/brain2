/**
 * lib/ingest/gps-log.ts — GPS pins stay off the message-ingest log
 *
 * Live Location and Arrive/Leave still paint Location. Those rows used to
 * fill the 200-line ingest log and bury everything else. They live in this
 * memory-only ring (not the persist hub — a point every few seconds must
 * not rewrite the vault). The header log shows them only when asked.
 * A failed `gps:` and an unpaired refusal stay on the main log.
 */
import { create } from "zustand"
import { UNPAIRED_SUMMARY } from "./pairing"
import type { IngestEvent } from "./types"

const MAX_GPS_LOG = 40

export function isGpsTrackingLogEvent(
  event: { kind?: string; status?: string; summary?: string } | null | undefined,
): boolean {
  if (!event || event.kind !== "gps") return false
  if (event.status === "error" || event.status === "clarify") return false
  if (event.summary === UNPAIRED_SUMMARY) return false
  return true
}

interface GpsLogState {
  events: IngestEvent[]
  push: (event: IngestEvent) => void
  clear: () => void
}

export const useGpsIngestLog = create<GpsLogState>((set) => ({
  events: [],
  push: (event) =>
    set((state) => ({
      events: [event, ...state.events.filter((row) => row.id !== event.id)].slice(0, MAX_GPS_LOG),
    })),
  clear: () => set({ events: [] }),
}))

export function resetGpsIngestLogForTests(): void {
  useGpsIngestLog.setState({ events: [] })
}

/** Main log, plus GPS points only when `showGps` is on. Newest first. */
export function visibleIngestEvents(
  events: readonly IngestEvent[],
  gpsEvents: readonly IngestEvent[],
  showGps: boolean,
): IngestEvent[] {
  const main = events.filter((event) => !isGpsTrackingLogEvent(event))
  if (!showGps) return main
  const gps = new Map<string, IngestEvent>()
  for (const event of [...events, ...gpsEvents]) {
    if (isGpsTrackingLogEvent(event)) gps.set(event.id, event)
  }
  return [...main, ...gps.values()].sort((a, b) => (a.at < b.at ? 1 : a.at > b.at ? -1 : 0))
}

export function hiddenGpsCount(
  events: readonly IngestEvent[],
  gpsEvents: readonly IngestEvent[],
): number {
  const ids = new Set<string>()
  for (const event of events) {
    if (isGpsTrackingLogEvent(event)) ids.add(event.id)
  }
  for (const event of gpsEvents) ids.add(event.id)
  return ids.size
}

export function withoutGpsTrackingLog<T extends { kind?: string; status?: string; summary?: string }>(
  events: readonly T[] | undefined,
): T[] {
  if (!events) return []
  return events.filter((event) => !isGpsTrackingLogEvent(event))
}
