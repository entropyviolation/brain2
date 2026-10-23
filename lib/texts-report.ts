/**
 * lib/texts-report.ts — Renderer side of Analytics → Texts
 *
 * The texts report is built by `scripts/texts-analysis/` on this Mac and served
 * on loopback by `serve.py`. Electron starts that server (`electron/texts-report.js`)
 * through `window.desktop.texts`. The web build has no bridge and says so.
 * No message text passes through this file; the report loads in its own frame.
 */

import { APP_NAV_KEYS, writeStoredId, writeStoredTab } from "@/lib/app-navigation"
import { normalizeHandle } from "@/lib/phone-sync/handles"
import { COGS_NAV_RESTORE_EVENT } from "@/lib/screen-location"

export type TextsStatus = {
  lastRun?: string | null
  running?: boolean
  messages?: number
  range?: { from?: string; to?: string }
  error?: string | null
}

export type TextsResult =
  | { ok: true; url?: string; status?: TextsStatus }
  | { ok: false; code: string; error: string }

export type DesktopTextsBridge = {
  ensureServer: () => Promise<TextsResult>
  status: () => Promise<TextsResult>
  refresh: () => Promise<TextsResult>
}

export const TEXTS_WEB_BUILD_SENTENCE =
  "Texts are read from this Mac's Messages database, so the report only opens in the Brain2 desktop app."

export function getDesktopTextsBridge(): DesktopTextsBridge | undefined {
  if (typeof window === "undefined") return undefined
  return (window as unknown as { desktop?: { texts?: DesktopTextsBridge } }).desktop?.texts
}

/** "Updated Sun 25 Oct, 21:04" or "Not run yet". */
export function textsUpdatedLabel(status: TextsStatus | undefined, locale?: string): string {
  if (status?.running) return "Updating now…"
  const iso = status?.lastRun
  if (!iso) return "Not run yet"
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return "Not run yet"
  const when = d.toLocaleString(locale, { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })
  return `Updated ${when}`
}

/** One person as the report sees them: name and every saved number / email. */
export type ReportPerson = { id: string; name: string; nicknames?: string[]; handles: string[] }

/** One person card in the report: its id there, its name, and its numbers. */
export type TextsIndexRow = { ent: string; name: string; handles: string[] }

/** What the report frame may ask Brain2 to do (`scripts/texts-analysis/report_app.js`). */
export type ReportRequest =
  | { type: "ready" }
  | { type: "refreshing" }
  | { type: "index"; people: TextsIndexRow[] }
  | { type: "link" | "unlink"; personId: string; handles: string[] }
  | { type: "create-person"; name: string; handles: string[] }
  | { type: "open-person"; personId: string }

function cleanHandles(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return value.filter((h): h is string => typeof h === "string" && h.trim().length > 0 && h.length < 200).slice(0, 20)
}

/** Check a message from the report frame. Anything else is null. */
export function readReportRequest(data: unknown): ReportRequest | null {
  if (!data || typeof data !== "object") return null
  const d = data as Record<string, unknown>
  if (d.source !== "texts-report") return null
  if (d.type === "ready") return { type: "ready" }
  if (d.type === "refreshing") return { type: "refreshing" }
  if (d.type === "index") {
    if (!Array.isArray(d.people)) return null
    const people = d.people
      .slice(0, 200)
      .flatMap((row): TextsIndexRow[] => {
        const r = row as Record<string, unknown>
        if (typeof r?.ent !== "string" || typeof r.name !== "string") return []
        return [{ ent: r.ent, name: r.name.slice(0, 120), handles: cleanHandles(r.handles) }]
      })
    return { type: "index", people }
  }
  if (d.type === "create-person") {
    const name = typeof d.name === "string" ? d.name.trim().slice(0, 120) : ""
    const handles = cleanHandles(d.handles)
    return name && handles.length ? { type: "create-person", name, handles } : null
  }
  if (typeof d.personId !== "string" || !d.personId) return null
  if (d.type === "open-person") return { type: "open-person", personId: d.personId }
  if (d.type !== "link" && d.type !== "unlink") return null
  const handles = cleanHandles(d.handles)
  return handles.length ? { type: d.type, personId: d.personId, handles } : null
}

// ---------- which people have a card in the report ----------
// The report sends its person cards (ids, names, numbers) each time it loads.
// Brain2 keeps that small index so a Person can show "View text analytics"
// without asking the server. Names and numbers only; no message text.

const INDEX_KEY = "brain2-texts-index"
const OPEN_KEY = "brain2-texts-open"

export function writeTextsIndex(rows: TextsIndexRow[]): void {
  try {
    window.localStorage.setItem(INDEX_KEY, JSON.stringify(rows))
    window.dispatchEvent(new CustomEvent(INDEX_KEY))
  } catch {
    // Private mode: the button just stays hidden.
  }
}

export function readTextsIndex(): TextsIndexRow[] {
  try {
    const raw = typeof window === "undefined" ? null : window.localStorage.getItem(INDEX_KEY)
    const rows = raw ? (JSON.parse(raw) as unknown) : []
    return Array.isArray(rows) ? (rows as TextsIndexRow[]) : []
  } catch {
    return []
  }
}

export function subscribeTextsIndex(fn: () => void): () => void {
  window.addEventListener(INDEX_KEY, fn)
  return () => window.removeEventListener(INDEX_KEY, fn)
}

/** The report card for any of these numbers, if the report has one. */
export function textsCardFor(handles: readonly string[], rows = readTextsIndex()): TextsIndexRow | null {
  const want = new Set(handles.map((h) => normalizeHandle(h)).filter(Boolean))
  if (!want.size) return null
  return rows.find((row) => row.handles.some((h) => want.has(normalizeHandle(h)))) ?? null
}

/** Go to Analytics → Texts and open the relationship page for these numbers. */
export function openTextsFor(handles: readonly string[]): void {
  try {
    window.sessionStorage.setItem(OPEN_KEY, JSON.stringify(handles))
  } catch {
    // The report still opens, on its front page.
  }
  writeStoredId(APP_NAV_KEYS.appItemId, null)
  writeStoredTab(APP_NAV_KEYS.analyticsTab, "texts-report")
  writeStoredTab(APP_NAV_KEYS.appTab, "analytics")
  window.dispatchEvent(new CustomEvent(COGS_NAV_RESTORE_EVENT))
}

/** Numbers to open once the report frame is ready (read once). */
export function takePendingTextsOpen(): string[] | null {
  try {
    const raw = window.sessionStorage.getItem(OPEN_KEY)
    window.sessionStorage.removeItem(OPEN_KEY)
    const v = raw ? (JSON.parse(raw) as unknown) : null
    return Array.isArray(v) ? v.filter((h): h is string => typeof h === "string") : null
  } catch {
    return null
  }
}

/** Open Analytics → Texts in its own, bigger window (desktop), or a browser window. */
export function openTextsWindow(): void {
  const path = "/popout/?view=texts"
  const desktop = (window as unknown as { desktop?: { openModulePopout?: (target: string) => void } }).desktop
  if (desktop?.openModulePopout) desktop.openModulePopout(path)
  else window.open(new URL(path, window.location.origin).href, "brain2-texts", "popup=yes,width=1400,height=950")
}
