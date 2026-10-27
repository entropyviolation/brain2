/**
 * lib/chrome-sessions.ts — Chrome history as Screen Time blocks
 *
 * Data → Sources → Browser turns the merged history into runs (`runsOf`
 * in `lib/browser-history.ts`) and paints each on the Screen Time scope: pen =
 * site name, notes = `logged from chrome browser data` plus pages, full URLs,
 * searches and, for YouTube, minutes per video. Local servers use the page
 * title for their host:port, else `Local dev server`. Sites seen fewer than
 * 3 times share the `Other sites` pen. Rows carry a `phone-sync` stamp
 * (`chrome:<start>`) and are merged, never replaced: re-running adds only what
 * is new, and deleted ids stay deleted. Estimated (hatched).
 */
import { formatLocalDateKey } from "@/lib/date-utils"
import { cleanYouTubeTitle, categoryOf, devTitles, runsOf, siteName, videoWatch, type Run, type Visit } from "@/lib/browser-history"
import { mergeSessionEntries } from "@/lib/instagram-sessions"
import { SCREENTIME_CATEGORY_IDS, slugApp } from "@/lib/screentime/app-categories"
import { ensureScreenTimeScope } from "@/lib/screentime/sync"
import type { TimeEntry } from "@/lib/time-entries"
import { PEN_PALETTE, useTimeTrackingStore, type TrackPen } from "@/lib/time-tracking-store"

export const CHROME_NOTE = "logged from chrome browser data"
export const OTHER_SITES = "Other sites"
const MIN_SITE_VISITS = 3
const DAY = 1440

const PARENT: Record<string, string> = {
  "Local dev": SCREENTIME_CATEGORY_IDS.work,
  "AI & image gen": SCREENTIME_CATEGORY_IDS.work,
  Code: SCREENTIME_CATEGORY_IDS.work,
  "Docs & mail": SCREENTIME_CATEGORY_IDS.work,
  Video: SCREENTIME_CATEGORY_IDS.media,
  Music: SCREENTIME_CATEGORY_IDS.media,
  Social: SCREENTIME_CATEGORY_IDS.communication,
}

const cut = (s: string, n: number) => (s.length > n ? `${s.slice(0, n - 1)}…` : s)
const uniq = <T,>(xs: T[]) => [...new Set(xs)]

export function runNotes(run: Run): string {
  const lines = [CHROME_NOTE]
  const watch = run.host === "youtube.com" ? videoWatch(run) : []
  if (watch.length) {
    lines.push(
      "Watching:",
      ...watch.slice(0, 8).map((w) => `- ${cut(w.title || w.id, 80)} (~${Math.max(1, Math.round(w.minutes))} min)`),
    )
    if (watch.length > 8) lines.push(`- and ${watch.length - 8} more`)
  } else {
    const titles = uniq(run.visits.map((v) => cleanYouTubeTitle(v.title)).filter(Boolean))
    if (titles.length) lines.push(`Pages (${run.visits.length}): ${titles.slice(0, 4).map((t) => cut(t, 50)).join(" | ")}${titles.length > 4 ? ` | +${titles.length - 4}` : ""}`)
  }
  const qs = uniq(
    run.visits.flatMap((v) => {
      try {
        const q = new URL(v.url).searchParams.get("q")
        return q && v.url.includes("/search?") ? [q] : []
      } catch {
        return []
      }
    }),
  )
  if (qs.length) lines.push(`Searched: ${qs.slice(0, 5).join(" | ")}`)
  const urls = uniq(run.visits.map((v) => v.url))
  lines.push(...urls.slice(0, 2).map((u) => `URL: ${cut(u, 110)}`))
  if (urls.length > 2) lines.push(`+${urls.length - 2} more URLs`)
  lines.push(`Opened ${run.visits.length} page${run.visits.length === 1 ? "" : "s"}; switched away after ~${Math.max(1, Math.round((run.end - run.start) / 60000))} min`)
  return cut(lines.join("\n"), 600)
}

/** One run as entries, sliced at local midnight (slices share a `spanId`). */
export function runEntries(run: Run, scopeId: string, penId: string, notes: string): TimeEntry[] {
  const first = new Date(run.start)
  let dayStart = new Date(first.getFullYear(), first.getMonth(), first.getDate())
  let startMin = first.getHours() * 60 + first.getMinutes()
  const key = Math.floor(run.start / 1000)
  const stamp = { kind: "phone-sync", id: `chrome:${key}` } as NonNullable<TimeEntry["generatedBy"]>
  const out: TimeEntry[] = []
  for (let part = 0; part < 400; part++) {
    const nextDay = new Date(dayStart.getFullYear(), dayStart.getMonth(), dayStart.getDate() + 1)
    const last = run.end <= nextDay.getTime()
    let endMin = DAY
    if (last) {
      const d = new Date(run.end)
      endMin = d.getHours() * 60 + d.getMinutes() + (d.getSeconds() || d.getMilliseconds() ? 1 : 0)
    }
    endMin = Math.min(DAY, Math.max(startMin + 1, endMin))
    out.push({
      id: `chrome-${key}${part ? `-${part}` : ""}`,
      date: formatLocalDateKey(dayStart),
      scopeId,
      penId,
      startMin,
      endMin,
      notes,
      precision: "estimated",
      clockCertainty: "estimated",
      generatedBy: stamp,
    })
    if (last) break
    dayStart = nextDay
    startMin = 0
  }
  if (out.length > 1) for (const e of out) e.spanId = `chrome-span-${key}`
  return out
}

export interface ApplyChromeResult {
  runs: number
  added: number
  updated: number
}

const CHUNK = 500
const tick = () => new Promise<void>((resolve) => setTimeout(resolve, 30))

/**
 * Paint every run onto Screen Time. Safe to repeat. Pens go in one store write
 * and entries in chunks with a pause between, so the many store subscribers
 * (habit, people and pen-action syncs) do not stall the page in one go.
 */
export async function applyChromeHistory(visits: readonly Visit[], onProgress?: (done: number, total: number) => void): Promise<ApplyChromeResult> {
  if (!visits.length) return { runs: 0, added: 0, updated: 0 }
  const runs = runsOf([...visits])
  const titles = devTitles([...visits])
  const counts = new Map<string, number>()
  for (const v of visits) counts.set(v.host, (counts.get(v.host) ?? 0) + 1)
  const scope = ensureScreenTimeScope()
  const wanted = new Map<string, TrackPen>()
  const penFor = (host: string): string => {
    const small = (counts.get(host) ?? 0) < MIN_SITE_VISITS
    const name = small ? OTHER_SITES : siteName(host, titles)
    const id = `chrome-st-site-${slugApp(name)}`
    if (!wanted.has(id))
      wanted.set(id, {
        id,
        name,
        color: PEN_PALETTE[wanted.size % PEN_PALETTE.length],
        parentId: small ? SCREENTIME_CATEGORY_IDS.browsing : (PARENT[categoryOf(host)] ?? SCREENTIME_CATEGORY_IDS.browsing),
        lastUsedAt: Date.now(),
      })
    return id
  }
  const incoming = runs.flatMap((run) => {
    const notes = runNotes(run)
    const small = (counts.get(run.host) ?? 0) < MIN_SITE_VISITS
    return runEntries(run, scope.id, penFor(run.host), small ? `${notes}\nSite: ${run.host}` : notes)
  })
  // Existing pens keep the user's name, parent and colour; only missing ones are added.
  useTimeTrackingStore.setState((state) => ({
    scopes: state.scopes.map((row) =>
      row.id === scope.id ? { ...row, pens: [...row.pens, ...[...wanted.values()].filter((pen) => !row.pens.some((p) => p.id === pen.id))] } : row,
    ),
  }))
  let added = 0
  let updated = 0
  for (let at = 0; at < incoming.length; at += CHUNK) {
    const state = useTimeTrackingStore.getState()
    const merged = mergeSessionEntries(state.entries, state.removedEntryIds ?? [], incoming.slice(at, at + CHUNK))
    if (merged.added || merged.updated) useTimeTrackingStore.setState({ entries: merged.entries })
    added += merged.added
    updated += merged.updated
    onProgress?.(Math.min(incoming.length, at + CHUNK), incoming.length)
    await tick()
  }
  return { runs: runs.length, added, updated }
}
