/**
 * lib/mobile/nfc-settings.ts — The text record written from the NFC hub
 *
 * Testing settings are the phone's scan-door hub (origin and token) and the
 * sync URL used to pull the desktop. One short JSON object fits a small
 * sticker. `k` is `b2test` so a read can tell this record from any other text.
 */
import { nfcHubOrigin } from "@/lib/mobile/nfc-scan"

export const TESTING_SETTINGS_KIND = "b2test"

export interface TestingSettings {
  origin: string
  token: string
  syncUrl: string
}

export function encodeTestingSettings(settings: TestingSettings): string {
  const body: Record<string, string> = {
    k: TESTING_SETTINGS_KIND,
    o: settings.origin,
    t: settings.token,
  }
  if (settings.syncUrl) body.s = settings.syncUrl
  return JSON.stringify(body)
}

/** Null when the text is not this record, or the hub URL or token is unusable. */
export function parseTestingSettings(raw: string): TestingSettings | null {
  try {
    const parsed = JSON.parse(raw) as { k?: unknown; o?: unknown; t?: unknown; s?: unknown }
    if (parsed.k !== TESTING_SETTINGS_KIND) return null
    if (typeof parsed.o !== "string" || typeof parsed.t !== "string") return null
    const origin = nfcHubOrigin(parsed.o)
    const token = parsed.t.trim()
    if (!origin || !token) return null
    if (typeof parsed.s !== "string" || !parsed.s.trim()) return { origin, token, syncUrl: "" }
    const syncUrl = nfcHubOrigin(parsed.s)
    if (!syncUrl) return null
    return { origin, token, syncUrl }
  } catch {
    return null
  }
}
