/**
 * lib/phone-sync/archive.ts — Full message bodies and reader cursors, on disk
 *
 * Node only (the phone hub and Electron main). Never import from the renderer.
 * Bodies go to `data/phone-sync/messages.jsonl`, one JSON record per line,
 * append-only. Years of texts do not fit the origin's ~5 MB localStorage, and
 * `data/` is what the nightly backup encrypts (docs/BIM_BACKUP.md).
 * `cursors.json` holds each reader's place so a run reads only what is new.
 */
import fs from "node:fs"
import path from "node:path"
import type { MessageRecord, PhoneRecord, PhoneSyncRun, PhoneSyncSource } from "./types"

export const ARCHIVE_DIR_NAME = "phone-sync"
const RUN_LOG_CAP = 200

export interface PhoneArchive {
  dir: string
  /** Append messages not already in the archive. Returns how many were new. */
  appendMessages: (records: readonly PhoneRecord[]) => number
  readMessages: (filter?: { threadId?: string; handle?: string; since?: number }) => MessageRecord[]
  getCursor: (source: PhoneSyncSource) => string | undefined
  setCursor: (source: PhoneSyncSource, cursor: string) => void
  logRun: (run: PhoneSyncRun) => void
  runs: () => PhoneSyncRun[]
  /** Missing file or missing key means on. Only an explicit `false` is off. */
  getEnabled: (source: PhoneSyncSource) => boolean
  setEnabled: (source: PhoneSyncSource, on: boolean) => void
}

function readJson<T>(file: string, fallback: T): T {
  try {
    return JSON.parse(fs.readFileSync(file, "utf8")) as T
  } catch {
    return fallback
  }
}

/** Write via a temp file and rename, so a crash never leaves half a JSON file. */
function writeJson(file: string, value: unknown): void {
  const tmp = `${file}.partial`
  fs.writeFileSync(tmp, JSON.stringify(value, null, 2), { mode: 0o600 })
  fs.renameSync(tmp, file)
}

/** `dataDir` is the repo's `data/` (or the Electron userData equivalent). */
export function openPhoneArchive(dataDir: string): PhoneArchive {
  const dir = path.join(dataDir, ARCHIVE_DIR_NAME)
  fs.mkdirSync(dir, { recursive: true, mode: 0o700 })
  const messagesFile = path.join(dir, "messages.jsonl")
  const cursorsFile = path.join(dir, "cursors.json")
  const runsFile = path.join(dir, "runs.json")
  const enabledFile = path.join(dir, "enabled.json")

  let seen: Set<string> | null = null
  const loadAll = (): MessageRecord[] => {
    if (!fs.existsSync(messagesFile)) return []
    const out: MessageRecord[] = []
    for (const line of fs.readFileSync(messagesFile, "utf8").split("\n")) {
      if (!line.trim()) continue
      try {
        out.push(JSON.parse(line) as MessageRecord)
      } catch {
        /* a torn last line from a crash; skip it */
      }
    }
    return out
  }
  const seenSet = () => {
    if (!seen) seen = new Set(loadAll().map((m) => `${m.source}:${m.sourceId}`))
    return seen
  }

  return {
    dir,
    appendMessages(records) {
      const set = seenSet()
      const lines: string[] = []
      for (const record of records) {
        if (record.type !== "message") continue
        const key = `${record.source}:${record.sourceId}`
        if (set.has(key)) continue
        set.add(key)
        lines.push(JSON.stringify(record))
      }
      if (lines.length) fs.appendFileSync(messagesFile, lines.join("\n") + "\n", { mode: 0o600 })
      return lines.length
    },
    readMessages(filter = {}) {
      return loadAll().filter(
        (m) =>
          (!filter.threadId || m.threadId === filter.threadId) &&
          (!filter.handle || m.party.handle === filter.handle || m.members?.some((p) => p.handle === filter.handle)) &&
          (!filter.since || m.at >= filter.since),
      )
    },
    getCursor(source) {
      return readJson<Record<string, string>>(cursorsFile, {})[source]
    },
    setCursor(source, cursor) {
      writeJson(cursorsFile, { ...readJson<Record<string, string>>(cursorsFile, {}), [source]: cursor })
    },
    logRun(run) {
      const runs = readJson<PhoneSyncRun[]>(runsFile, [])
      runs.push(run)
      writeJson(runsFile, runs.slice(-RUN_LOG_CAP))
    },
    runs() {
      return readJson<PhoneSyncRun[]>(runsFile, [])
    },
    getEnabled(source) {
      return readJson<Partial<Record<PhoneSyncSource, boolean>>>(enabledFile, {})[source] !== false
    },
    setEnabled(source, on) {
      const map = readJson<Partial<Record<PhoneSyncSource, boolean>>>(enabledFile, {})
      map[source] = on
      writeJson(enabledFile, map)
    },
  }
}
