/**
 * lib/chrome-history-inbox.ts — File a night's Chrome history into the vault.
 *
 * The extension posts a day to `/api/chrome-history`, or hands it to the page
 * through `brain2-chrome-history` when Brain2 is already open in that Chrome.
 * Visits land in IndexedDB. New ones are painted on Screen Time.
 */
import { historyFileFromPayload, mergeHistory, type HistoryFile } from "@/lib/browser-history"
import { addHistoryFiles } from "@/lib/browser-history-store"
import { applyChromeHistory } from "@/lib/chrome-sessions"
import { useTimeTrackingStore } from "@/lib/time-tracking-store"

export const CHROME_HISTORY_READY = "brain2-chrome-history-ready"
export const CHROME_HISTORY_PUSH = "brain2-chrome-history"
export const CHROME_HISTORY_ACK = "brain2-chrome-history-ack"
export const CHROME_HISTORY_POLL = "brain2-chrome-history-poll"
export const CHROME_HISTORY_KEPT = "brain2-chrome-history-kept"

export interface ChromeHistoryPushFile {
  id?: string
  day?: string
  profile?: string
  visits?: unknown
}

function whenTimeHydrated(): Promise<void> {
  const persist = useTimeTrackingStore.persist
  if (!persist?.hasHydrated || persist.hasHydrated()) return Promise.resolve()
  return new Promise((resolve) => {
    const stop = persist.onFinishHydration(() => {
      stop()
      resolve()
    })
  })
}

function filesOf(list: ChromeHistoryPushFile[]): { files: HistoryFile[]; ids: string[]; days: string[] } {
  const files: HistoryFile[] = []
  const ids: string[] = []
  const days: string[] = []
  for (const file of list) {
    const parsed = historyFileFromPayload(file, "Chrome")
    if (!parsed) continue
    files.push(parsed)
    if (typeof file.id === "string" && file.id) ids.push(file.id)
    if (typeof file.day === "string" && file.day) days.push(file.day)
  }
  return { files, ids, days }
}

async function keep(files: HistoryFile[], ids: string[], days: string[]): Promise<void> {
  if (!files.length) return
  const { added } = await addHistoryFiles(files)
  if (ids.length) {
    await fetch("/api/chrome-history/ack", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids }),
    }).catch(() => {})
  }
  if (days.length) window.dispatchEvent(new CustomEvent(CHROME_HISTORY_ACK, { detail: { days } }))
  window.dispatchEvent(new CustomEvent(CHROME_HISTORY_KEPT, { detail: { added } }))
  if (added > 0) {
    await whenTimeHydrated()
    await applyChromeHistory(mergeHistory(files))
  }
}

/** Days the extension still holds, passed in a page event. */
export async function ingestPushedChromeHistory(detail: unknown): Promise<void> {
  const files = detail && typeof detail === "object" && Array.isArray((detail as { files?: unknown }).files)
    ? ((detail as { files: ChromeHistoryPushFile[] }).files)
    : []
  const parsed = filesOf(files)
  await keep(parsed.files, [], parsed.days)
}

/** Days already posted to the local Brain2 server. Returns how many files were taken. */
export async function ingestChromeHistoryInbox(): Promise<number> {
  let body: { files?: ChromeHistoryPushFile[] } | null = null
  try {
    const res = await fetch("/api/chrome-history")
    if (!res.ok) return 0
    body = (await res.json()) as { files?: ChromeHistoryPushFile[] }
  } catch {
    return 0
  }
  const parsed = filesOf(body?.files ?? [])
  await keep(parsed.files, parsed.ids, parsed.days)
  return parsed.files.length
}

export function keptVisitCount(visits: Visit[]): number {
  return visits.length
}
