/**
 * lib/ingest/drain-heartbeat.ts — Healthchecks-style ping for the capture-box drain
 *
 * `COGS_DRAIN_HEALTHCHECK_URL` gets a ping after each good queue fetch (at most
 * once a minute) and `/fail` when the fetch or decrypt fails. A failed ping never throws.
 */

export const HEARTBEAT_MIN_GAP_MS = 60_000

/** Throttle: true when a ping is due. Call `mark` after sending. */
export function createPingThrottle(minGapMs = HEARTBEAT_MIN_GAP_MS) {
  let last = -Infinity
  return {
    due(nowMs: number) {
      return nowMs - last >= minGapMs
    },
    mark(nowMs: number) {
      last = nowMs
    },
  }
}

export function heartbeatUrl(base: string, fail: boolean): string {
  const clean = base.trim().replace(/\/+$/, "")
  return fail ? `${clean}/fail` : clean
}

export function createDrainHeartbeat(
  base: string,
  opts: { now?: () => number; ping?: (url: string) => Promise<unknown>; minGapMs?: number } = {},
) {
  const now = opts.now ?? Date.now
  const ping = opts.ping ?? ((url: string) => fetch(url, { signal: AbortSignal.timeout(10000) }))
  const throttle = createPingThrottle(opts.minGapMs)
  const url = base.trim()
  return {
    /** Good fetch, even when the queue was empty. Throttled. */
    async ok() {
      if (!url || !throttle.due(now())) return
      throttle.mark(now())
      try {
        await ping(heartbeatUrl(url, false))
      } catch {
        /* a missed ping must not stop the drain */
      }
    },
    /** Fetch or decrypt failed. Not throttled. */
    async fail() {
      if (!url) return
      try {
        await ping(heartbeatUrl(url, true))
      } catch {
        /* ignore */
      }
    },
  }
}
