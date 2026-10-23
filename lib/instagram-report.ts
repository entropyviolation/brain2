/**
 * lib/instagram-report.ts — Renderer side of the Instagram report
 *
 * The report is built in the Electron main process (`electron/instagram-report.js`).
 * Desktop reads it through `window.desktop.instagram` and the `brain2-ig://`
 * scheme. Chrome at localhost reads the same build through `/api/instagram`
 * (`scripts/instagram-api.mjs`); it cannot start a run. Other builds (web,
 * iOS) have no report.
 */

import { APP_NAV_KEYS, writeStoredId, writeStoredTab } from "@/lib/app-navigation"
import { normalizeInstagram } from "@/lib/person-profile"
import { COGS_NAV_RESTORE_EVENT } from "@/lib/screen-location"

export const INSTAGRAM_UI_KEYS = ["ig-matches", "ig-hide-cols", "ig-photos"] as const
export type InstagramUiKey = (typeof INSTAGRAM_UI_KEYS)[number]

export { INSTAGRAM_EXPORT_URL } from "@/lib/instagram-export-steps"

export interface InstagramStatus {
  hasReport: boolean
  current: {
    buildId: string
    exportName: string
    exportDate: string
    builtAt: string
    ffmpeg: boolean
  } | null
  lastError: { at: string; step: string; message: string; stderr?: string; exportName?: string } | null
  running: boolean
  deps: {
    python: string
    pythonFound: boolean
    scriptsFound: boolean
    missingModules: string[]
    ffmpeg: string | null
    ok: boolean
  } | null
  watching: string[]
  /** Google Drive "My Drive" folders also watched for Meta's scheduled export. */
  drive?: string[]
  handle: string
  reportBase: string
  canIngest?: boolean
}

/** A DM an earlier export held and a later one does not (`electron/instagram-archive.js`). */
export interface InstagramRemovedMessage {
  thread: string
  title: string
  participants: string[]
  sender: string
  ts: number
  content?: string
  media?: string[]
  share?: { link?: string; text?: string }
  lastSeen: string
  removedSince: string
  kind: "removed" | "edited" | "thread-gone"
  editedTo?: string
}

export interface InstagramRemoved {
  exports: number
  rows: InstagramRemovedMessage[]
}

/** `summary.json` of the current build, as text, with the build it came from. */
export interface InstagramSummary {
  buildId: string
  text: string
}

export interface DesktopInstagramBridge {
  status: () => Promise<InstagramStatus>
  scan: () => Promise<InstagramStatus>
  saveUi: (key: InstagramUiKey, value: string | null) => Promise<boolean>
  pickFolder: (clear?: boolean) => Promise<InstagramStatus>
  removed?: () => Promise<InstagramRemoved>
  summary?: () => Promise<InstagramSummary | null>
  onChange: (cb: (s: Omit<InstagramStatus, "reportBase">) => void) => () => void
}

export interface InstagramSource {
  kind: "desktop" | "dev"
  canIngest: boolean
  status: () => Promise<InstagramStatus>
  scan?: () => Promise<InstagramStatus>
  pickFolder?: (clear?: boolean) => Promise<InstagramStatus>
  summary: () => Promise<InstagramSummary | null>
  saveUi: (key: InstagramUiKey, value: string | null) => Promise<boolean>
  removed?: () => Promise<InstagramRemoved>
  onChange?: (cb: () => void) => () => void
}

export function getDesktopInstagramBridge(): DesktopInstagramBridge | undefined {
  if (typeof window === "undefined") return undefined
  return (window as unknown as { desktop?: { instagram?: DesktopInstagramBridge } }).desktop?.instagram
}

function isLoopbackHost(hostname: string | undefined): boolean {
  return hostname === "localhost" || hostname === "127.0.0.1" || hostname === "[::1]"
}

/** Where this build reads the report from, or null when it cannot. */
export function instagramSource(
  bridge = getDesktopInstagramBridge(),
  location: Pick<Location, "hostname"> | undefined = typeof window === "undefined" ? undefined : window.location,
  fetchImpl: typeof fetch | undefined = typeof fetch === "undefined" ? undefined : fetch,
): InstagramSource | null {
  if (bridge && typeof bridge.status === "function") {
    return {
      kind: "desktop",
      canIngest: true,
      status: () => bridge.status(),
      scan: () => bridge.scan(),
      pickFolder: (clear) => bridge.pickFolder(clear),
      summary: async () => {
        if (typeof bridge.summary !== "function") throw new Error("restart")
        return bridge.summary()
      },
      saveUi: (key, value) => bridge.saveUi(key, value),
      removed: bridge.removed ? () => bridge.removed!() : undefined,
      onChange: (cb) => bridge.onChange(() => cb()),
    }
  }
  if (fetchImpl && isLoopbackHost(location?.hostname)) {
    return {
      kind: "dev",
      canIngest: false,
      status: async () => {
        const r = await fetchImpl("/api/instagram/status", { cache: "no-store" })
        if (!r.ok) throw new Error(`status ${r.status}`)
        return (await r.json()) as InstagramStatus
      },
      removed: async () => {
        const r = await fetchImpl("/api/instagram/removed", { cache: "no-store" })
        if (!r.ok) throw new Error(`removed ${r.status}`)
        return (await r.json()) as InstagramRemoved
      },
      summary: async () => {
        const r = await fetchImpl("/api/instagram/summary", { cache: "no-store" })
        if (!r.ok) return null
        return (await r.json()) as InstagramSummary | null
      },
      saveUi: async (key, value) => {
        const r = await fetchImpl("/api/instagram/ui-state", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ key, value }),
        })
        return r.ok
      },
    }
  }
  return null
}

/** A message the hosted report posts when one of its ig-* keys changes. */
export function readReportStateMessage(data: unknown): { key: InstagramUiKey; value: string | null } | null {
  if (!data || typeof data !== "object") return null
  const d = data as { brain2Instagram?: unknown; key?: unknown; value?: unknown }
  if (d.brain2Instagram !== "state") return null
  if (!INSTAGRAM_UI_KEYS.includes(d.key as InstagramUiKey)) return null
  if (d.value !== null && typeof d.value !== "string") return null
  return { key: d.key as InstagramUiKey, value: d.value as string | null }
}

/**
 * Settings pasted from the standalone report (its console prints them with
 * `STANDALONE_EXPORT_SNIPPET`). Only the three ig-* keys are kept.
 */
export function parseStandaloneSettings(text: string): Partial<Record<InstagramUiKey, string>> | null {
  let parsed: unknown
  try {
    parsed = JSON.parse(text.trim())
  } catch {
    return null
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return null
  const out: Partial<Record<InstagramUiKey, string>> = {}
  for (const k of INSTAGRAM_UI_KEYS) {
    const v = (parsed as Record<string, unknown>)[k]
    if (typeof v !== "string") continue
    try {
      JSON.parse(v)
    } catch {
      continue
    }
    out[k] = v
  }
  return Object.keys(out).length ? out : null
}

export const STANDALONE_EXPORT_SNIPPET =
  "copy(JSON.stringify(Object.fromEntries(['ig-matches','ig-hide-cols','ig-photos'].map(k=>[k,localStorage.getItem(k)]).filter(e=>e[1]!==null))))"

// ---------- the account card's Person link ----------
// The bridge in the report frame adds an "Attach to Person" bar to the account
// card. It asks the parent through these messages; the parent answers with
// `person-state` (who carries the handle, and who could).

export type AccountRequest =
  | { type: "opened"; handle: string }
  | { type: "attach" | "detach"; handle: string; personId: string }
  | { type: "create"; handle: string; name: string }
  | { type: "open-person"; personId: string }

export function readAccountRequest(data: unknown): AccountRequest | null {
  if (!data || typeof data !== "object") return null
  const d = data as Record<string, unknown>
  if (d.brain2Instagram !== "account") return null
  const handle = typeof d.handle === "string" ? normalizeInstagram(d.handle).slice(0, 60) : ""
  const personId = typeof d.personId === "string" ? d.personId.slice(0, 200) : ""
  switch (d.action) {
    case "opened":
      return handle ? { type: "opened", handle } : null
    case "attach":
    case "detach":
      return handle && personId ? { type: d.action, handle, personId } : null
    case "create":
      return handle ? { type: "create", handle, name: typeof d.name === "string" ? d.name.slice(0, 120) : "" } : null
    case "open-person":
      return personId ? { type: "open-person", personId } : null
    default:
      return null
  }
}

// ---------- open one account from a Person ----------
// A Person's Instagram handle opens that account's card in the report. The
// handle waits in sessionStorage until the report frame has loaded, then the
// view posts it into the frame (the bridge in `electron/instagram-report.js`).

const OPEN_KEY = "brain2-instagram-open"

/** Go to Analytics → Sources → Instagram and open this account's card. */
export function openInstagramFor(handle: string): void {
  const clean = normalizeInstagram(handle)
  if (!clean) return
  try {
    window.sessionStorage.setItem(OPEN_KEY, clean)
  } catch {
    // The report still opens, on its front page.
  }
  writeStoredId(APP_NAV_KEYS.appItemId, null)
  writeStoredTab(APP_NAV_KEYS.analyticsTab, "instagram")
  writeStoredTab(APP_NAV_KEYS.appTab, "analytics")
  window.dispatchEvent(new CustomEvent(COGS_NAV_RESTORE_EVENT))
}

/** The handle to open once the report frame is ready (read once). */
export function takePendingInstagramOpen(): string | null {
  try {
    const raw = window.sessionStorage.getItem(OPEN_KEY)
    window.sessionStorage.removeItem(OPEN_KEY)
    return raw ? normalizeInstagram(raw) || null : null
  } catch {
    return null
  }
}

/** `2026-10-22T18:04:00Z` → `Oct 22, 2026, 11:04 AM` in local time. */
export function formatInstagramStamp(iso: string | undefined | null): string {
  if (!iso) return "never"
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleString(undefined, { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" })
}

/** `2026-10-22` → `Oct 22, 2026` (calendar date, no time zone shift). */
export function formatExportDate(key: string | undefined | null): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(key ?? "")
  if (!m) return key || "unknown"
  return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  })
}
