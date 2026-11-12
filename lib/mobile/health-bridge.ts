/**
 * lib/mobile/health-bridge.ts — The JS side of the iOS Health import
 *
 * The native side is `ios/App/App/HealthPlugin.swift` (jsName `BrainHealth`).
 * It reads Apple Health. It does not write HealthKit. Each call asks for one
 * page. `importAllHealth` walks from the oldest sample to now.
 * `syncHealthSince` reads a recent window for the automatic sync.
 *
 * On the web and in Electron the plugin is missing. The import then reports
 * that it runs in the iPhone app, and it does not touch the stores.
 */
import { Capacitor, registerPlugin } from "@capacitor/core"
import { rememberWorld } from "@/lib/action-history"
import { commitHealthPage } from "@/lib/phone-sync/health-apply"
import {
  addTally,
  healthPageLabel,
  healthPages,
  runHealthImport,
  type HealthImportResult,
  type HealthKitClient,
  type HealthMergeOptions,
  type HealthTally,
} from "@/lib/phone-sync/health"

interface BrainHealthPlugin {
  requestAccess(): Promise<{ ok?: boolean; denied?: boolean; error?: string }>
  earliest(): Promise<{ at?: number | null; denied?: boolean; error?: string }>
  readPage(options: { startMs: number; endMs: number }): Promise<{
    days?: unknown
    sleeps?: unknown
    workouts?: unknown
    stepMinutes?: unknown
    denied?: boolean
    error?: string
  }>
  openSettings(): Promise<void>
}

const BrainHealth = registerPlugin<BrainHealthPlugin>("BrainHealth")

export function isHealthPluginAvailable(): boolean {
  return Capacitor.getPlatform() === "ios" && Capacitor.isPluginAvailable("BrainHealth")
}

const client: HealthKitClient = {
  async requestAccess() {
    return BrainHealth.requestAccess()
  },
  async earliest() {
    const row = await BrainHealth.earliest()
    return {
      at: typeof row.at === "number" && Number.isFinite(row.at) ? row.at : null,
      denied: row.denied,
      error: row.error,
    }
  },
  async readPage(startMs, endMs) {
    const raw = await BrainHealth.readPage({ startMs, endMs })
    return { raw, denied: raw.denied, error: raw.error }
  },
}

/** Import the full Health history. One page at a time. `onProgress` is a line for the card. */
export async function importAllHealth(
  onProgress?: (line: string) => void,
  merge: HealthMergeOptions = {},
): Promise<HealthImportResult> {
  if (!isHealthPluginAvailable()) {
    return {
      status: "unavailable",
      written: { days: 0, nights: 0, workouts: 0 },
      read: { days: 0, nights: 0, workouts: 0 },
      message: "Health import runs in the iPhone app.",
    }
  }
  let remembered = false
  return runHealthImport(client, {
    untilMs: Date.now(),
    apply: (raw) => {
      if (!remembered) {
        rememberWorld("health import")
        remembered = true
      }
      return commitHealthPage(raw, undefined, merge)
    },
    onProgress: (progress) => {
      onProgress?.(`Reading ${healthPageLabel(progress.startMs)} · ${progress.index + 1} of ${progress.total}`)
    },
  })
}

export interface HealthSyncResult {
  status: "synced" | "denied" | "unavailable" | "failed"
  written: HealthTally
  error?: string
}

/**
 * Read Health from `sinceMs` to now and land it. The automatic sync calls
 * this with a short window each time the app opens. It leaves the undo stack
 * alone, since nobody pressed a key.
 */
export async function syncHealthSince(sinceMs: number, merge: HealthMergeOptions = {}, untilMs = Date.now()): Promise<HealthSyncResult> {
  let written: HealthTally = { days: 0, nights: 0, workouts: 0 }
  if (!isHealthPluginAvailable()) return { status: "unavailable", written }
  try {
    const access = await client.requestAccess()
    if (access.denied) return { status: "denied", written }
    if (access.ok === false) return { status: "failed", written, error: access.error || "Health access could not be requested." }
    for (const page of healthPages(sinceMs, untilMs)) {
      const fetched = await client.readPage(page.startMs, page.endMs)
      if (fetched.denied) return { status: "denied", written }
      if (fetched.error) return { status: "failed", written, error: fetched.error }
      written = addTally(written, commitHealthPage(fetched.raw, undefined, merge).written)
    }
    return { status: "synced", written }
  } catch (err) {
    return { status: "failed", written, error: err instanceof Error ? err.message : String(err) }
  }
}

/** Open Brain2's page in iPhone Settings. Health sharing itself lives in the Health app. */
export async function openHealthSettings(): Promise<boolean> {
  if (!isHealthPluginAvailable()) return false
  await BrainHealth.openSettings()
  return true
}
