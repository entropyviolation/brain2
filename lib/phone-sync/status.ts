/**
 * lib/phone-sync/status.ts — What Settings → Phone sync lists
 *
 * One row per source. Switchable rows are the readers and the location drain
 * that already run. The rest are named so the bay can say they are not built.
 * No disk access: the route and the panel share this list.
 */

import type { PhoneSyncRun, PhoneSyncSource } from "./types"

export interface PhoneSyncRow {
  id: PhoneSyncSource
  title: string
  /** Where it reads, and the permission it needs. */
  needs: string
  /** A reader or drain exists, so Settings can turn it off. */
  switchable: boolean
}

export const PHONE_SYNC_ROWS: readonly PhoneSyncRow[] = [
  {
    id: "messages",
    title: "Texts",
    needs: "This Mac. Full Disk Access, and Messages in iCloud.",
    switchable: true,
  },
  {
    id: "calls",
    title: "Calls",
    needs: "This Mac. Full Disk Access, and Calls from iPhone.",
    switchable: true,
  },
  {
    id: "location",
    title: "Location",
    needs: "The iPhone app. Always location, Tailscale, and the upload route on the box.",
    switchable: true,
  },
  {
    id: "health",
    title: "Health",
    needs: "The iPhone app, HealthKit. Not built yet.",
    switchable: false,
  },
  {
    id: "screen",
    title: "Screen Time",
    needs: "A Shortcut when an app opens. Not built yet. Mac usage stays on the Screen Time bay.",
    switchable: false,
  },
  {
    id: "email",
    title: "Email",
    needs: "IMAP on this Mac. Not built yet. Bodies stay off until asked.",
    switchable: false,
  },
  {
    id: "dms",
    title: "DMs",
    needs: "An account download. Not built yet. No live API for personal Instagram DMs.",
    switchable: false,
  },
]

export function phoneSyncRow(id: string): PhoneSyncRow | undefined {
  return PHONE_SYNC_ROWS.find((row) => row.id === id)
}

/** The newest run for that source, from a log stored oldest-first. */
export function latestRun(runs: readonly PhoneSyncRun[], source: PhoneSyncSource): PhoneSyncRun | null {
  for (let i = runs.length - 1; i >= 0; i--) {
    if (runs[i]?.source === source) return runs[i]
  }
  return null
}
