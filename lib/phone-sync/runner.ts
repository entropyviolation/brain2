/**
 * lib/phone-sync/runner.ts — Run the readers, write what they found
 *
 * A reader reads its source from a cursor and returns records plus the next
 * cursor. The runner archives bodies first, then writes the vault, then moves
 * the cursor, so a crash mid-run re-reads rather than skips. Readers register
 * here; the hub's sync loop calls `runPhoneSync` (scripts/phone-hub.ts).
 */
import type { PhoneArchive } from "./archive"
import type { ApplyPhoneResult } from "./write"
import type { PhoneRecord, PhoneSyncRun, PhoneSyncSource } from "./types"

export interface PhoneReader {
  source: PhoneSyncSource
  /**
   * Read rows past `cursor`. Undefined on the first run: read from `sinceMs`
   * when given (a reader may jump there), else from the beginning.
   */
  read: (cursor: string | undefined, opts?: { sinceMs?: number }) => Promise<{ records: PhoneRecord[]; cursor?: string }>
}

const readers = new Map<PhoneSyncSource, PhoneReader>()

export function registerPhoneReader(reader: PhoneReader): void {
  readers.set(reader.source, reader)
}

export function registeredPhoneReaders(): PhoneReader[] {
  return [...readers.values()]
}

/** Test seam. */
export function clearPhoneReaders(): void {
  readers.clear()
}

export interface RunDeps {
  archive: PhoneArchive
  apply: (records: PhoneRecord[]) => ApplyPhoneResult
  /** Called after a run that wrote rows, so the hub can flush the vault. */
  onWrote?: () => void
  now?: () => number
  enabled?: (source: PhoneSyncSource) => boolean
  /** Oldest time to keep (epoch ms). Older records are dropped; the cursor still moves past them. */
  sinceMs?: () => number | undefined
}

export async function runPhoneSync(deps: RunDeps, list: PhoneReader[] = registeredPhoneReaders()): Promise<PhoneSyncRun[]> {
  const now = deps.now ?? Date.now
  const out: PhoneSyncRun[] = []
  for (const reader of list) {
    if (deps.enabled && !deps.enabled(reader.source)) continue
    const startedAt = now()
    let run: PhoneSyncRun
    try {
      const sinceMs = deps.sinceMs?.()
      const read = await reader.read(deps.archive.getCursor(reader.source), { sinceMs })
      const { cursor } = read
      const records = sinceMs === undefined ? read.records : read.records.filter((r) => r.at >= sinceMs)
      deps.archive.appendMessages(records)
      const result = deps.apply(records)
      if (cursor !== undefined) deps.archive.setCursor(reader.source, cursor)
      if (result.written > 0) deps.onWrote?.()
      run = { source: reader.source, startedAt, finishedAt: now(), ...result }
    } catch (err) {
      run = {
        source: reader.source,
        startedAt,
        finishedAt: now(),
        read: 0,
        written: 0,
        skipped: 0,
        error: err instanceof Error ? err.message : String(err),
      }
    }
    deps.archive.logRun(run)
    out.push(run)
  }
  return out
}
