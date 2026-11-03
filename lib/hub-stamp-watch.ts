/**
 * Follow the hub's write stamp (`GET /api/persist/health`) so an edit made on
 * another device shows up without a focus or a manual refresh. The desktop and
 * the phone window both use it; each names its own write sources.
 */

/** Focus pulls run at most once per this window. */
export const HUB_FOCUS_PULL_MS = 10_000

/** Throttle for focus pulls. Pure apart from the clock. */
export function createHubFocusPull(pull: () => unknown, minMs = HUB_FOCUS_PULL_MS, now: () => number = Date.now) {
  let last = -Infinity
  return () => {
    const at = now()
    if (at - last < minMs) return false
    last = at
    void pull()
    return true
  }
}

export type HubHealth = { updatedAt?: string; source?: string; contentAt?: string; contentSource?: string } | null

/**
 * Feed it each health read. It calls `pull` (which returns false when
 * throttled) after another device wrote, and keeps asking until one runs, so a
 * throttled pull is not lost when this device's own save moves the stamp.
 */
export function createHubStampWatch(pull: () => boolean, isOwnSource: (source: string) => boolean) {
  let seen: string | null = null
  let pending = false
  return (health: HubHealth) => {
    // `contentAt` skips heartbeat keys; an older hub only has `updatedAt`.
    const at = health?.contentAt ?? health?.updatedAt
    const source = health?.contentAt ? health.contentSource : health?.source
    if (!at) return
    const foreign = typeof source === "string" && !isOwnSource(source)
    if (seen != null && at !== seen && foreign) pending = true
    seen = at
    if (pending && pull()) pending = false
  }
}
