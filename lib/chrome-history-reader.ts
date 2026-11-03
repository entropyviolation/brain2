/**
 * lib/chrome-history-reader.ts — Read Chrome's own History files, all profiles
 *
 * Node only (the phone hub). Every profile under Chrome's user data folder has
 * a `History` SQLite file. Chrome keeps it locked, so each run copies it to a
 * temp folder and reads the copy. Visits past the profile's cursor (the last
 * `visits.id` seen) are grouped by local day and merged into
 * `data/chrome-history-inbox/` in the extension's envelope. The open app's
 * inbox poll (`hooks/use-chrome-history-inbox.ts`) files them, so this is a
 * second producer for the same door, not a new store. Visits the extension
 * also sent are dropped by the app's merge (same URL, same millisecond).
 * `BRAIN2_CHROME_DIR` points at another user data folder (tests).
 */
import fs from "node:fs"
import os from "node:os"
import path from "node:path"
import { brain2Env } from "@/lib/brain2-env.mjs"

export interface InboxVisit {
  url: string
  title: string
  visitTime: number
  transition: string
}

export interface InboxEnvelope {
  brain2: "chrome-history"
  profile: string
  day: string
  visits: InboxVisit[]
}

export interface ChromeProfile {
  dir: string
  name: string
  historyFile: string
}

export interface ChromeReadResult {
  profile: string
  read: number
  days: string[]
  /** A full page was read; run again to catch up. */
  more: boolean
  error?: string
}

/** One profile reads at most this many visits per run; the next run continues. */
export const CHROME_PAGE = 20_000
const CHROME_EPOCH_MS = Date.UTC(1601, 0, 1)
/** Chrome's core transition codes, named as `chrome.history` names them. */
const TRANSITIONS = [
  "link",
  "typed",
  "auto_bookmark",
  "auto_subframe",
  "manual_subframe",
  "generated",
  "auto_toplevel",
  "form_submit",
  "reload",
  "keyword",
  "keyword_generated",
]
/** Chrome's History page hides frame loads; so do we. */
const SKIP_TRANSITIONS = new Set([3, 4])

export function chromeUserDataDir(env: Record<string, string | undefined> = process.env): string {
  return brain2Env("CHROME_DIR", env) || path.join(os.homedir(), "Library", "Application Support", "Google", "Chrome")
}

/** Profiles that have a History file, named as Chrome's profile menu names them. */
export function listChromeProfiles(userDataDir: string): ChromeProfile[] {
  let names: Record<string, string> = {}
  try {
    const state = JSON.parse(fs.readFileSync(path.join(userDataDir, "Local State"), "utf8"))
    const cache = state?.profile?.info_cache ?? {}
    names = Object.fromEntries(Object.entries(cache).map(([dir, info]) => [dir, String((info as { name?: unknown })?.name || dir)]))
  } catch {
    /* no Local State: fall back to folder names */
  }
  let dirs: string[] = []
  try {
    dirs = fs.readdirSync(userDataDir)
  } catch {
    return []
  }
  return dirs
    .filter((dir) => dir === "Default" || /^Profile \d+$/.test(dir))
    .map((dir) => ({ dir, name: names[dir] || dir, historyFile: path.join(userDataDir, dir, "History") }))
    .filter((p) => fs.existsSync(p.historyFile))
}

/** Chrome time (µs since 1601) → Unix ms, rounded like the extension rounds. */
export function chromeTimeToMs(us: number | bigint): number {
  // Today's µs values pass 2^53, so round in bigint before leaving it.
  const big = typeof us === "bigint" ? us : BigInt(Math.round(us))
  return Number((big + BigInt(500)) / BigInt(1000)) + CHROME_EPOCH_MS
}

export function localDay(ms: number): string {
  const d = new Date(ms)
  const p = (n: number) => String(n).padStart(2, "0")
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}

type Db = import("node:sqlite").DatabaseSync
type VisitRow = { id: bigint; url: string; title: string | null; visit_time: bigint; transition: bigint }

/** Copy History (and its journal) aside so Chrome's lock does not block the read. */
function openCopy(historyFile: string, tmpDir: string): Db {
  fs.mkdirSync(tmpDir, { recursive: true })
  const copy = path.join(tmpDir, "History")
  fs.copyFileSync(historyFile, copy)
  for (const side of ["-journal", "-wal"]) {
    const from = historyFile + side
    if (fs.existsSync(from)) fs.copyFileSync(from, copy + side)
    else fs.rmSync(copy + side, { force: true })
  }
  const { DatabaseSync } = process.getBuiltinModule("node:sqlite")
  return new DatabaseSync(copy)
}

/** Visits past `afterId`, oldest first. Exported for tests. */
export function readVisitPage(
  db: Db,
  afterId: number,
  limit = CHROME_PAGE,
): { visits: InboxVisit[]; lastId: number; more: boolean } {
  const maxRow = db.prepare("SELECT MAX(id) AS m FROM visits").get() as { m: number | null } | undefined
  const max = Number(maxRow?.m ?? 0)
  // History was cleared and ids started over: read it all again; the app's merge drops repeats.
  const from = max < afterId ? 0 : afterId
  const stmt = db.prepare(
    `SELECT v.id AS id, u.url AS url, u.title AS title, v.visit_time AS visit_time, v.transition AS transition
     FROM visits v JOIN urls u ON u.id = v.url
     WHERE v.id > :from ORDER BY v.id LIMIT :limit`,
  )
  stmt.setReadBigInts(true)
  const rows = stmt.all({ from, limit }) as unknown as VisitRow[]
  const visits: InboxVisit[] = []
  for (const row of rows) {
    const core = Number(row.transition & BigInt(0xff))
    if (SKIP_TRANSITIONS.has(core)) continue
    if (!row.url || row.url.length > 8000 || !row.visit_time) continue
    visits.push({
      url: row.url,
      title: (row.title ?? "").slice(0, 500),
      visitTime: chromeTimeToMs(row.visit_time),
      transition: TRANSITIONS[core] ?? "link",
    })
  }
  const last = rows[rows.length - 1]
  return { visits, lastId: last ? Number(last.id) : from, more: rows.length === limit }
}

/** Same file name rule as `scripts/chrome-history-api.mjs` → `safeHistoryId`. */
export function inboxFileName(day: string, profile: string): string {
  const who = String(profile || "Chrome").replace(/[^\w .'-]+/g, "").trim().slice(0, 40) || "Chrome"
  return `${day}__${who}.json`
}

/** Merge visits into the day's inbox file. A file the app has not taken yet keeps its visits. */
export function writeInboxDays(inboxDir: string, profile: string, visits: InboxVisit[]): string[] {
  const byDay = new Map<string, InboxVisit[]>()
  for (const v of visits) {
    const day = localDay(v.visitTime)
    const list = byDay.get(day)
    if (list) list.push(v)
    else byDay.set(day, [v])
  }
  fs.mkdirSync(inboxDir, { recursive: true })
  for (const [day, list] of byDay) {
    const file = path.join(inboxDir, inboxFileName(day, profile))
    let kept: InboxVisit[] = []
    try {
      const prior = JSON.parse(fs.readFileSync(file, "utf8")) as Partial<InboxEnvelope>
      if (Array.isArray(prior.visits)) kept = prior.visits
    } catch {
      /* new day, or the app already took it */
    }
    const seen = new Set(kept.map((v) => `${v.visitTime}|${v.url}`))
    const merged = [...kept]
    for (const v of list) {
      const key = `${v.visitTime}|${v.url}`
      if (seen.has(key)) continue
      seen.add(key)
      merged.push(v)
    }
    merged.sort((a, b) => a.visitTime - b.visitTime || a.url.localeCompare(b.url))
    const envelope: InboxEnvelope = { brain2: "chrome-history", profile, day, visits: merged }
    const tmp = `${file}.tmp`
    fs.writeFileSync(tmp, JSON.stringify(envelope))
    fs.renameSync(tmp, file)
  }
  return [...byDay.keys()].sort()
}

export interface ChromeSyncOptions {
  userDataDir?: string
  inboxDir: string
  /** Holds `cursors.json` (profile folder → last visit id). */
  stateDir: string
}

function readCursors(file: string): Record<string, number> {
  try {
    return JSON.parse(fs.readFileSync(file, "utf8")) as Record<string, number>
  } catch {
    return {}
  }
}

/** One pass over every profile. A profile that fails is reported; the others still run. */
export function syncChromeHistory(opts: ChromeSyncOptions): ChromeReadResult[] {
  const userDataDir = opts.userDataDir ?? chromeUserDataDir()
  const cursorFile = path.join(opts.stateDir, "cursors.json")
  const cursors = readCursors(cursorFile)
  const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), "brain2-chrome-"))
  const out: ChromeReadResult[] = []
  try {
    for (const profile of listChromeProfiles(userDataDir)) {
      let db: Db | null = null
      try {
        db = openCopy(profile.historyFile, path.join(tmpRoot, profile.dir))
        const { visits, lastId, more } = readVisitPage(db, cursors[profile.dir] ?? 0)
        // Inbox first, cursor after: a crash in between re-reads instead of skipping.
        const days = visits.length ? writeInboxDays(opts.inboxDir, profile.name, visits) : []
        cursors[profile.dir] = lastId
        out.push({ profile: profile.name, read: visits.length, days, more })
      } catch (err) {
        out.push({ profile: profile.name, read: 0, days: [], more: false, error: err instanceof Error ? err.message : String(err) })
      } finally {
        db?.close()
      }
    }
    fs.mkdirSync(opts.stateDir, { recursive: true })
    fs.writeFileSync(cursorFile, JSON.stringify(cursors, null, 2))
  } finally {
    fs.rmSync(tmpRoot, { recursive: true, force: true })
  }
  return out
}
