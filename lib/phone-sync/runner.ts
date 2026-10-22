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
  /** Read rows past `cursor` (undefined on the first run: read everything). */
  read: (cursor: string | undefined) => Promise<{ records: PhoneRecord[]; cursor?: string }>
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
}

export async function runPhoneSync(deps: RunDeps, list: PhoneReader[] = registeredPhoneReaders()): Promise<PhoneSyncRun[]> {
  const now = deps.now ?? Date.now
  const out: PhoneSyncRun[] = []
  for (const reader of list) {
    if (deps.enabled && !deps.enabled(reader.source)) continue
    const startedAt = now()
    let run: PhoneSyncRun
    try {
      const { records, cursor } = await reader.read(deps.archive.getCursor(reader.source))
      deps.archive.appendMessages(records)
      const result = deps.apply(records)
      // Flush before the cursor moves: a crash in between re-reads instead of skipping.
      if (result.written > 0) deps.onWrote?.()
      if (cursor !== undefined) deps.archive.setCursor(reader.source, cursor)
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
