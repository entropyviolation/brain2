/**
 * lib/mobile/health-bridge.ts — The JS side of the iOS Health import
 *
 * The native side is `ios/App/App/HealthPlugin.swift` (jsName `BrainHealth`).
 * It reads Apple Health. It does not write HealthKit. Each call asks for one
 * page. `importAllHealth` walks from the oldest sample to now.
 *
 * On the web and in Electron the plugin is missing. The import then reports
 * that it runs in the iPhone app, and it does not touch the stores.
 */
import { Capacitor, registerPlugin } from "@capacitor/core"
import { rememberWorld } from "@/lib/action-history"
import { commitHealthPage } from "@/lib/phone-sync/health-apply"
import {
  healthPageLabel,
  runHealthImport,
  type HealthImportResult,
  type HealthKitClient,
} from "@/lib/phone-sync/health"

interface BrainHealthPlugin {
  requestAccess(): Promise<{ ok?: boolean; denied?: boolean; error?: string }>
  earliest(): Promise<{ at?: number | null; denied?: boolean; error?: string }>
  readPage(options: { startMs: number; endMs: number }): Promise<{
    days?: unknown
    sleeps?: unknown
    workouts?: unknown
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
export async function importAllHealth(onProgress?: (line: string) => void): Promise<HealthImportResult> {
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
      return commitHealthPage(raw)
    },
    onProgress: (progress) => {
      onProgress?.(`Reading ${healthPageLabel(progress.startMs)} · ${progress.index + 1} of ${progress.total}`)
    },
  })
}

/** Open Brain2's page in iPhone Settings. Health sharing itself lives in the Health app. */
export async function openHealthSettings(): Promise<boolean> {
  if (!isHealthPluginAvailable()) return false
  await BrainHealth.openSettings()
  return true
}
