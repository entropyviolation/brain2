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
