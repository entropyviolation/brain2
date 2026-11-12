/**
 * lib/speed-read-library.ts — client for the Speed Read PDF library on the Mac.
 *
 * The desk (browser or Electron) is served by the Mac, so it calls
 * `/api/speed-read` on its own origin. The iPhone app is a `capacitor://` page;
 * it asks `lib/phone-window.ts` for the Mac address and hub token, the same
 * route BIM chat uses. Server: `scripts/speed-read-api.mjs`.
 */

export interface SpeedReadEntry {
  id: string
  name: string
  bytes: number
  addedAt: number
  openedAt: number
  /** Page the book was left on (1-based). Absent until it has been read. */
  page?: number
  /** Word on that page (0-based) where reading stopped. */
  word?: number
  /** When `page`/`word` were last saved, from any device. */
  savedAt?: number
}

async function route(): Promise<{ base: string; headers: Record<string, string> }> {
  if (typeof window !== "undefined" && /^https?:$/.test(window.location.protocol)) return { base: "", headers: {} }
  const pw = await import("@/lib/phone-window")
  let r = await pw.phoneHubRoute()
  if (!r.url) {
    await pw.loadPhoneWindow().catch(() => undefined)
    r = await pw.phoneHubRoute()
  }
  if (!r.url) {
    const { phoneHubCandidates } = await import("@/lib/mobile-sync")
    const [first] = await phoneHubCandidates()
    if (!first) throw new Error("No Mac address yet. Set the Hub URL under Menu → Mobile hub.")
    r = { url: first, headers: r.headers }
  }
  return { base: r.url.replace(/\/+$/, ""), headers: r.headers }
}

async function failText(res: Response): Promise<string> {
  try {
    const j = (await res.json()) as { error?: string }
    if (j?.error) return j.error
  } catch {
    /* not JSON */
  }
  return `The Mac answered ${res.status}.`
}

export async function listSpeedReadLibrary(): Promise<SpeedReadEntry[]> {
  const { base, headers } = await route()
  const res = await fetch(`${base}/api/speed-read`, { headers, cache: "no-store" })
  if (!res.ok) throw new Error(await failText(res))
  const j = (await res.json()) as { items?: SpeedReadEntry[] }
  return Array.isArray(j.items) ? j.items : []
}

export async function uploadToSpeedReadLibrary(name: string, data: ArrayBuffer): Promise<SpeedReadEntry> {
  const { base, headers } = await route()
  const res = await fetch(`${base}/api/speed-read`, {
    method: "POST",
    headers: { ...headers, "Content-Type": "application/pdf", "X-File-Name": encodeURIComponent(name) },
    body: data,
  })
  if (!res.ok) throw new Error(await failText(res))
  return ((await res.json()) as { item: SpeedReadEntry }).item
}

export async function fetchSpeedReadPdf(id: string): Promise<ArrayBuffer> {
  const { base, headers } = await route()
  const res = await fetch(`${base}/api/speed-read/file/${encodeURIComponent(id)}`, { headers })
  if (!res.ok) throw new Error(await failText(res))
  return res.arrayBuffer()
}

/** The library's current entry for one book (fresh from the Mac), or null. */
export async function getSpeedReadEntry(id: string): Promise<SpeedReadEntry | null> {
  return (await listSpeedReadLibrary()).find((x) => x.id === id) ?? null
}

/** Remember where a book was left (page, and word on it), so any device opens there next time. */
export async function saveSpeedReadPage(id: string, page: number, word = 0): Promise<SpeedReadEntry | null> {
  const { base, headers } = await route()
  const res = await fetch(`${base}/api/speed-read/${encodeURIComponent(id)}`, {
    method: "PATCH",
    headers: { ...headers, "Content-Type": "application/json" },
    body: JSON.stringify({ page, word }),
    keepalive: true,
  })
  if (!res.ok) throw new Error(await failText(res))
  return ((await res.json().catch(() => ({}))) as { item?: SpeedReadEntry }).item ?? null
}

export async function removeFromSpeedReadLibrary(id: string): Promise<void> {
  const { base, headers } = await route()
  const res = await fetch(`${base}/api/speed-read/${encodeURIComponent(id)}`, { method: "DELETE", headers })
  if (!res.ok) throw new Error(await failText(res))
}

export function formatPdfSize(bytes: number): string {
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  return `${Math.max(1, Math.round(bytes / 1024))} KB`
}
