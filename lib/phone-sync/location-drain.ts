/**
 * lib/phone-sync/location-drain.ts — Pull the phone's sealed location batches
 *
 * Node only. The Oracle box keeps what the iPhone app posts to `POST /upload`
 * (`scripts/capture-upload.mjs`). This pulls `GET /uploads?kind=location`,
 * opens each batch with the private key, lands it with `applyLocationBatch`,
 * flushes the vault, moves the cursor, and only then acks, so the box forgets
 * a batch only after it is on disk. A crash re-pulls; ids are stable, so a
 * re-pull writes nothing new.
 *
 * A batch that will not open stops the drain and stays queued (same rule as
 * the Telegram drain). A batch that opens but is not a location batch is
 * skipped, so one bad upload cannot block the queue.
 *
 * The hub starts it (`scripts/phone-hub.ts`, owned by the core). `paused` skips a tick when Settings has location off:
 *   if (CAPTURE_URL) startLocationDrain({ boxUrl: CAPTURE_URL, token: CAPTURE_TOKEN, privateKey, open: openSealed, ... })
 */
import type { PhoneArchive } from "./archive"
import { LOCATION_SOURCE, applyLocationBatch, parseLocationBatch, type LocationBatch } from "./location"
import type { PhoneSyncRun } from "./types"
import type { ApplyPhoneResult } from "./write"

export interface LocationDrainDeps {
  /** Capture box base URL, no trailing slash (`BRAIN2_CAPTURE_BOX_URL`). */
  boxUrl: string
  /** Pull token (`BRAIN2_CAPTURE_TOKEN`), not the phone's upload token. */
  token: string
  /** Capture private key, base64 (`~/.brain2/capture-private.key`). */
  privateKey: string
  /** `open` from `scripts/sealed-box.mjs`. */
  open: (privateKey: string, sealed: string) => Uint8Array
  archive: Pick<PhoneArchive, "getCursor" | "setCursor" | "logRun">
  /** Load the vault from disk before writing (the hub's `rehydrateFromDisk`). */
  beforeApply?: () => unknown
  /** Write the vault to disk (the hub's `flushVault`). Runs before the ack. */
  onWrote?: () => unknown
  apply?: (batch: LocationBatch) => ApplyPhoneResult
  fetch?: typeof fetch
  now?: () => number
  /** When this returns true the tick waits and does not pull. The hub reads the Settings switch. */
  paused?: () => boolean
}

interface UploadRow {
  seq: number
  kind: string
  sealed: string
}

const PAGE = 50

/** One pull. Returns the run, or null when the box had nothing. Throws on a box or key error. */
export async function drainLocationOnce(deps: LocationDrainDeps): Promise<PhoneSyncRun | null> {
  const doFetch = deps.fetch ?? fetch
  const now = deps.now ?? Date.now
  const apply = deps.apply ?? applyLocationBatch
  const headers = { Authorization: `Bearer ${deps.token}` }
  const after = Number(deps.archive.getCursor(LOCATION_SOURCE)) || 0

  const res = await doFetch(`${deps.boxUrl}/uploads?after=${after}&limit=${PAGE}&kind=location`, {
    headers,
    signal: AbortSignal.timeout(20000),
  })
  if (!res.ok) throw new Error(`capture box uploads HTTP ${res.status}`)
  const items = (((await res.json()) as { items?: UploadRow[] }).items ?? []).filter((r) => r.kind === "location")
  if (items.length === 0) return null

  const startedAt = now()
  const events: LocationBatch["events"] = []
  let bad = 0
  let upto = after
  for (const item of items) {
    // Throws on a wrong key or tampered data: stop here, keep it queued.
    const text = new TextDecoder().decode(deps.open(deps.privateKey, item.sealed))
    let batch: LocationBatch | null = null
    try {
      batch = parseLocationBatch(JSON.parse(text))
    } catch {
      batch = null
    }
    if (batch) events.push(...batch.events)
    else bad++
    upto = Math.max(upto, item.seq)
  }

  await deps.beforeApply?.()
  const result = events.length ? apply({ events }) : { read: 0, written: 0, skipped: 0 }
  if (result.written > 0) await deps.onWrote?.()
  deps.archive.setCursor(LOCATION_SOURCE, String(upto))
  await doFetch(`${deps.boxUrl}/uploads/ack`, {
    method: "POST",
    headers: { ...headers, "Content-Type": "application/json" },
    body: JSON.stringify({ upto, kind: LOCATION_SOURCE }),
    signal: AbortSignal.timeout(20000),
  })

  const run: PhoneSyncRun = {
    source: LOCATION_SOURCE,
    startedAt,
    finishedAt: now(),
    read: result.read,
    written: result.written,
    skipped: result.skipped + bad,
    ...(bad ? { error: `${bad} upload(s) were not location batches` } : {}),
  }
  deps.archive.logRun(run)
  return run
}

/**
 * Pull on a timer until stopped. Pages back to back while the box has more.
 * Errors are logged and retried on the next tick; the cursor stays put.
 */
export function startLocationDrain(
  deps: LocationDrainDeps & { intervalMs?: number; log?: (line: string) => void },
): () => void {
  const intervalMs = Math.max(15000, deps.intervalMs ?? 60000)
  const log = deps.log ?? ((line: string) => console.log(line))
  let stopped = false
  let running = false
  let timer: ReturnType<typeof setTimeout> | undefined

  const tick = async () => {
    if (stopped || running) return
    if (deps.paused?.()) {
      if (!stopped) timer = setTimeout(() => void tick(), intervalMs)
      return
    }
    running = true
    let more = false
    try {
      const run = await drainLocationOnce(deps)
      if (run?.written) log(`[phone-hub] location: +${run.written}`)
      if (run?.error) log(`[phone-hub] location: ${run.error}`)
      more = run !== null
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      log(`[phone-hub] location drain: ${message}`)
      const t = deps.now?.() ?? Date.now()
      deps.archive.logRun({ source: LOCATION_SOURCE, startedAt: t, finishedAt: t, read: 0, written: 0, skipped: 0, error: message })
    } finally {
      running = false
    }
    if (!stopped) timer = setTimeout(() => void tick(), more ? 200 : intervalMs)
  }
  void tick()
  return () => {
    stopped = true
    if (timer) clearTimeout(timer)
  }
}
