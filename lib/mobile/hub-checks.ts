/**
 * lib/mobile/hub-checks.ts — What the Mobile hub says about each phone link
 *
 * Pure. The hub screen gathers a `HubInput` (the Mac window, the hub ping, the
 * outbox, and the three native plugins) and this turns it into rows: a tone, a
 * line, and the fix to try. No fetch or plugin call here, so it is testable.
 */
import { locationChip, appExpiryWarning, type LocationStatus } from "@/lib/mobile/location-bridge"

export type HubTone = "ok" | "warn" | "bad" | "off"

export interface HubRow {
  id: "mac" | "hub" | "outbox" | "location" | "health" | "nfc" | "app"
  label: string
  tone: HubTone
  line: string
  /** What to do when the tone is not ok. */
  fix?: string
}

export interface HubInput {
  windowStatus: "idle" | "loading" | "live" | "stale" | "offline"
  windowDetail: string | null
  /** The address the last load used, or the saved one. */
  hubUrl: string
  /** Result of a status ping on the hub. `null` until it has run. */
  ping: { ok: true; hasData: boolean } | { ok: false; reason: string } | null
  loadedAt: number | null
  outbox: number
  onPhone: boolean
  location: LocationStatus
  healthAvailable: boolean
  nfcAvailable: boolean
  nfcConfigured: boolean
  now: number
}

function ago(from: number, now: number): string {
  const mins = Math.max(0, Math.round((now - from) / 60000))
  if (mins < 1) return "just now"
  if (mins < 60) return `${mins} min ago`
  return `${Math.round(mins / 60)} h ago`
}

export function hubRows(input: HubInput): HubRow[] {
  const rows: HubRow[] = []

  const mac: HubRow =
    input.windowStatus === "live"
      ? { id: "mac", label: "Mac data", tone: "ok", line: `Loaded${input.loadedAt ? ` ${ago(input.loadedAt, input.now)}` : ""}.` }
      : input.windowStatus === "loading"
        ? { id: "mac", label: "Mac data", tone: "warn", line: `Loading… ${input.windowDetail ?? ""}`.trim() }
        : input.windowStatus === "stale"
          ? {
              id: "mac",
              label: "Mac data",
              tone: "warn",
              line: `Saved copy only. ${input.windowDetail ?? ""}`.trim(),
              fix: "Run npm run electron:dev on the Mac, same Wi-Fi, then Reload.",
            }
          : input.windowStatus === "offline"
            ? {
                id: "mac",
                label: "Mac data",
                tone: "bad",
                line: `No data. ${input.windowDetail ?? ""}`.trim(),
                fix: "Allow Local Network for Brain2 in iPhone Settings, and check the hub address.",
              }
            : { id: "mac", label: "Mac data", tone: "off", line: "Not asked yet.", fix: "Tap Reload." }
  rows.push(mac)

  if (!input.ping) rows.push({ id: "hub", label: "Hub", tone: "off", line: `${input.hubUrl || "No address"} — checking…` })
  else if (!input.ping.ok)
    rows.push({
      id: "hub",
      label: "Hub",
      tone: "bad",
      line: `${input.hubUrl} did not answer: ${input.ping.reason}`,
      fix: "Set the hub to the Mac's address, such as http://192.168.0.150:3000.",
    })
  else if (!input.ping.hasData)
    rows.push({
      id: "hub",
      label: "Hub",
      tone: "warn",
      line: `${input.hubUrl} answers, but has no snapshot.`,
      fix: "Only the old Force push path needs one. The Mac window does not.",
    })
  else rows.push({ id: "hub", label: "Hub", tone: "ok", line: `${input.hubUrl} answers.` })

  rows.push(
    input.outbox === 0
      ? { id: "outbox", label: "Phone edits", tone: "ok", line: "Nothing waiting to send." }
      : {
          id: "outbox",
          label: "Phone edits",
          tone: "warn",
          line: `${input.outbox} waiting for the Mac.`,
          fix: "They send when the Mac answers. Reload to try now.",
        },
  )

  if (!input.onPhone) {
    for (const [id, label] of [["location", "Location"], ["health", "Health"], ["nfc", "NFC"]] as const)
      rows.push({ id, label, tone: "off", line: "Phone app only." })
    return rows
  }

  const chip = locationChip(input.location, input.now)
  rows.push({
    id: "location",
    label: "Location",
    tone: chip.tone,
    line: chip.label.replace(/^Location: /, "") + (input.location.lastError ? `. ${input.location.lastError}` : ""),
    fix: chip.tone === "ok" ? undefined : "Open the Location card below.",
  })
  rows.push(
    input.healthAvailable
      ? { id: "health", label: "Health", tone: "ok", line: "HealthKit is in this build." }
      : { id: "health", label: "Health", tone: "bad", line: "HealthKit is missing from this build.", fix: "Reinstall the app with the HealthKit capability." },
  )
  rows.push(
    !input.nfcAvailable
      ? { id: "nfc", label: "NFC", tone: "bad", line: "The NFC radio is missing from this build.", fix: "Needs a paid developer account's NFC capability." }
      : input.nfcConfigured
        ? { id: "nfc", label: "NFC", tone: "ok", line: "Radio and hub are set." }
        : { id: "nfc", label: "NFC", tone: "warn", line: "Radio ready, no hub set.", fix: "Open the NFC hub and save the hub URL and token." },
  )

  const expiry = appExpiryWarning(input.location, input.now, 7)
  if (input.location.appExpiresAt) {
    const days = Math.max(0, Math.floor((input.location.appExpiresAt - input.now) / 86400000))
    rows.push({
      id: "app",
      label: "App install",
      tone: expiry ? (days < 2 ? "bad" : "warn") : "ok",
      line: days === 0 ? "Stops opening today." : `Opens for ${days} more day${days === 1 ? "" : "s"}.`,
      fix: expiry ? "Reinstall from the Mac: npm run ios:reinstall." : undefined,
    })
  }
  return rows
}

/** The worst tone among rows, for the one-line summary. */
export function hubSummary(rows: HubRow[]): { tone: HubTone; line: string } {
  const bad = rows.filter((r) => r.tone === "bad")
  const warn = rows.filter((r) => r.tone === "warn")
  if (bad.length > 0) return { tone: "bad", line: `${bad.length} broken: ${bad.map((r) => r.label).join(", ")}.` }
  if (warn.length > 0) return { tone: "warn", line: `${warn.length} to look at: ${warn.map((r) => r.label).join(", ")}.` }
  return { tone: "ok", line: "Everything is hooked up." }
}
