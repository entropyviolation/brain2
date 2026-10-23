/**
 * lib/instagram-report.ts — Renderer side of the Instagram report
 *
 * The report is built in the Electron main process (`electron/instagram-report.js`).
 * Desktop reads it through `window.desktop.instagram` and the `brain2-ig://`
 * scheme. Chrome at localhost reads the same build through `/api/instagram`
 * (`scripts/instagram-api.mjs`); it cannot start a run. Other builds (web,
 * iOS) have no report.
 */

export const INSTAGRAM_UI_KEYS = ["ig-matches", "ig-hide-cols", "ig-photos"] as const
export type InstagramUiKey = (typeof INSTAGRAM_UI_KEYS)[number]

export const INSTAGRAM_EXPORT_URL = "https://accountscenter.instagram.com/info_and_permissions/dyi/"

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
  handle: string
  reportBase: string
  canIngest?: boolean
}

export interface DesktopInstagramBridge {
  status: () => Promise<InstagramStatus>
  scan: () => Promise<InstagramStatus>
  saveUi: (key: InstagramUiKey, value: string | null) => Promise<boolean>
  pickFolder: (clear?: boolean) => Promise<InstagramStatus>
  onChange: (cb: (s: Omit<InstagramStatus, "reportBase">) => void) => () => void
}

export interface InstagramSource {
  kind: "desktop" | "dev"
  canIngest: boolean
  status: () => Promise<InstagramStatus>
  scan?: () => Promise<InstagramStatus>
  pickFolder?: (clear?: boolean) => Promise<InstagramStatus>
  saveUi: (key: InstagramUiKey, value: string | null) => Promise<boolean>
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
      saveUi: (key, value) => bridge.saveUi(key, value),
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
