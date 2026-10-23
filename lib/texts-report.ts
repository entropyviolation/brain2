/**
 * lib/texts-report.ts — Renderer side of Analytics → Texts
 *
 * The texts report is built by `scripts/texts-analysis/` on this Mac and served
 * on loopback by `serve.py`. Electron starts that server (`electron/texts-report.js`)
 * through `window.desktop.texts`. The web build has no bridge and says so.
 * No message text passes through this file; the report loads in its own frame.
 */

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

/** What the report frame may ask Brain2 to do (`scripts/texts-analysis/report_app.js`). */
export type ReportRequest =
  | { type: "ready" }
  | { type: "link" | "unlink"; personId: string; handles: string[] }
  | { type: "open-person"; personId: string }

/** Check a message from the report frame. Anything else is null. */
export function readReportRequest(data: unknown): ReportRequest | null {
  if (!data || typeof data !== "object") return null
  const d = data as Record<string, unknown>
  if (d.source !== "texts-report") return null
  if (d.type === "ready") return { type: "ready" }
  if (typeof d.personId !== "string" || !d.personId) return null
  if (d.type === "open-person") return { type: "open-person", personId: d.personId }
  if (d.type !== "link" && d.type !== "unlink") return null
  if (!Array.isArray(d.handles)) return null
  const handles = d.handles.filter((h): h is string => typeof h === "string" && h.trim().length > 0 && h.length < 200).slice(0, 20)
  return handles.length ? { type: d.type, personId: d.personId, handles } : null
}
