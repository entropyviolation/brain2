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

/** A vault pull waits this long after the last key or tap. */
export const INPUT_QUIET_MS = 2_000

let lastInputAt = -Infinity
let watchingInput = false

/** Note every key and tap, so a pull can wait for a pause. Idempotent; a no-op off the browser. */
export function watchInput(): void {
  if (watchingInput || typeof window === "undefined") return
  watchingInput = true
  const mark = () => {
    lastInputAt = Date.now()
  }
  for (const type of ["keydown", "input", "compositionupdate", "pointerdown"]) window.addEventListener(type, mark, { capture: true, passive: true })
}

/**
 * Resolves after a macrotask, once no key or tap came for `quietMs`. A pull merges an 18 MB vault on the main
 * thread (seconds when the task vault differs); started mid-sentence it froze BIM Chat and every text field.
 */
export async function untilInputQuiet(quietMs = INPUT_QUIET_MS, now: () => number = Date.now): Promise<void> {
  watchInput()
  for (;;) {
    await new Promise((resolve) => setTimeout(resolve, 0))
    const wait = lastInputAt + quietMs - now()
    if (wait <= 0) return
    await new Promise((resolve) => setTimeout(resolve, wait))
  }
}
