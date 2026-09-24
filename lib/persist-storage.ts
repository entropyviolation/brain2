/**
 * lib/persist-storage.ts — Guarded localStorage adapter for Zustand persist
 *
 * Every persisted store writes through this adapter so a QuotaExceeded (or any
 * other setItem failure) cannot fail silently. Memory state is left as-is;
 * callers subscribe to persist status to show a visible error and an export nudge.
 * A failure is remembered **per vault** (`persistKeyFailed`): the next store to
 * save something else no longer clears the banner for a key that is still
 * unsaved, which is how a submitted day note looked filed and was not.
 *
 * `localStorage` origin quota is typically 5–10MB. Attachments no longer live
 * in the JSON blob (`lib/attachments.ts`); this guard is the backstop for the
 * remaining JSON and for restore.
 *
 * On `localhost` in Electron, missing or seed-sized keys wait on the hub
 * (`/api/persist`, ~800ms cap) so a reboot cannot leave the desktop shell stuck
 * on an empty Chromium profile while Chrome has the live vault. A *rich* local
 * snapshot returns immediately — waiting on the 2MB hub JSON froze Daily Habits
 * (blank grid, seed habits, then a late swap). Chrome always reads and writes
 * its own localStorage (never imported from the hub). Electron seeds *missing*
 * keys from the hub on first boot, then keeps this profile's own snapshot so a
 * refresh cannot clobber completions, deletes, or new day to-dos. A *rich*
 * Electron vault also POSTs (hub shrink / Inbox-resurrection guards); seed-sized
 * Electron POSTs still skip. Plan-text keys (`monthPlan-*`, …) are the
 * exception: an empty hub tombstone re-seeded a blank Month Plan on refresh.
 *
 * Electron `userData` is pinned to Application Support/`cogs` (`electron/user-data-path.js`).
 * Do not let package.json `name` or `productName` choose a new empty profile.
 * Demo profile (`brain2-data-profile=demo`) skips the hub entirely so stock
 * fiction cannot POST into the Live persist file.
 *
 * Identical `setItem` payloads are no-ops (no localStorage write, no hub POST)
 * so a 3-second ingest poll cannot thrash the hub file. The hub itself also
 * refuses Tracking/Sleep/Lists/Habits snapshots that shrink to less than half
 * the stored records (`scripts/persist-api.mjs`). When a richer hub vault wins,
 * `pickPersistItem` still overlays this profile’s defined color / PCB / chrome
 * prefs so an older hub JSON (or a seed POST of defaults) cannot reset them.
 * Electron preload never replaces a present theme blob or PCB / LED pin from
 * the hub; `appearanceRev` > 0 blobs stamp those pins instead of reading them.
 * Tracking `dayNotes` / `untrackedNotes` overlay the same way — a richer hub
 * vault of painted intervals must not erase this profile's scratch pad. The
 * jot itself lives in `brain2-tracking-day-notes` (`lib/day-notes-persist.ts`),
 * with a `cogs-tracking-day-notes` alias that is copied, never deleted,
 * so a timegrid rewrite with empty `dayNotes` still has something to overlay.
 * Electron does not wait on the hub for that key once local has it — a larger
 * historical hub map used to replace today's jot (1 local day vs N hub days).
 * Late hub copies re-read localStorage (the user may have picked a plate or
 * hue during the wait) and `appearanceRev` keeps that pick over an older blob.
 * `setItem` refuses a theme/habits write that would roll a saved plate or hue
 * back to seed defaults (Zustand persist can stringify those before rehydrate).
 * It also refuses a habits write whose `contentRev` is older than the copy
 * already on disk, so a late rehydrate cannot put yesterday's titles and
 * completion values back over an edit that just landed.
 * The same seed write was clearing Telegram `allowedChats` and unpairing the
 * bot; a lower `allowlistRev` or an empty ingest seed is refused.
 * Identical `cogs-*` twins of a large `brain2-*` vault are dropped on boot and
 * on QuotaExceeded so Inbox clarifications and desktop hues can save again.
 * A successful habits/theme write stamps LED / tube / PCB pins from the new
 * blob; it does not re-apply an old pin onto that blob (that was resetting
 * Percent LED tint to a previous purple on refresh).
 */
import { createJSONStorage, type PersistStorage, type StateStorage } from "zustand/middleware"
import { overlayHabitCompletions, overlayIngestAllowlist, pickPersistItem as pickVaultItem, presentPersistValue, shouldRejectAppearanceDowngrade, shouldRejectContentDowngrade, shouldRejectIngestDowngrade, shouldRejectVaultShrink, stampAppearancePins, unionPersistSnapshots, vaultRecordCount } from "@/lib/vault-guard.js"
import {
  ensureLegacyPersistCopied,
  isPlanTextStorageKey,
  persistKey,
  persistKeyAliases,
  readAliasedLocal,
  twinPersistKey,
  writeAliasedLocal,
  releaseDuplicateLegacyTwins,
  releaseCopiedUnprefixedKeys,
  isDemoProfile,
  isQuotaExceededError,
} from "@/lib/storage-keys"

type JsonStorageOptions = {
  reviver?: (key: string, value: unknown) => unknown
  replacer?: (key: string, value: unknown) => unknown
}

export const LAST_PERSIST_OK_KEY = persistKey("last-persist-ok")

export type PersistStatus = {
  ok: boolean
  lastOkAt: string | null
  error: string | null
  quotaExceeded: boolean
}

const listeners = new Set<() => void>()

/**
 * Vaults whose last write failed. A failure used to be cleared by the *next*
 * successful write of any other key, so the banner blinked away while the day
 * note it was warning about stayed unsaved.
 */
const failedKeys = new Set<string>()

let status: PersistStatus = {
  ok: true,
  lastOkAt: readLastOkAt(),
  error: null,
  quotaExceeded: false,
}

function readLastOkAt(): string | null {
  if (typeof localStorage === "undefined") return null
  try {
    return readAliasedLocal(LAST_PERSIST_OK_KEY)
  } catch {
    return null
  }
}

function emit() {
  for (const listener of listeners) listener()
}

export { isQuotaExceededError }

export function persistErrorMessage(error: unknown): string {
  if (isQuotaExceededError(error)) {
    return "Storage is full. New edits are only in memory and will be lost on reload. Export a backup now."
  }
  return error instanceof Error ? error.message : "Could not save data."
}

export function getPersistStatus(): PersistStatus {
  return status
}

export function subscribePersistStatus(listener: () => void): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

export function recordPersistSuccess(name?: string): void {
  const lastOkAt = new Date().toISOString()
  if (typeof localStorage !== "undefined") {
    try {
      writeAliasedLocal(LAST_PERSIST_OK_KEY, lastOkAt)
    } catch {
      // Tiny key may also fail when quota is already exhausted; keep memory.
    }
  }
  if (name) failedKeys.delete(persistKey(name))
  else failedKeys.clear()
  if (failedKeys.size > 0) {
    status = { ...status, lastOkAt }
    emit()
    return
  }
  status = { ok: true, lastOkAt, error: null, quotaExceeded: false }
  emit()
}

export function recordPersistFailure(error: unknown, name?: string): void {
  if (name) failedKeys.add(persistKey(name))
  status = {
    ok: false,
    lastOkAt: status.lastOkAt,
    error: persistErrorMessage(error),
    quotaExceeded: isQuotaExceededError(error),
  }
  emit()
}

/** True while this vault's last write failed. Another vault saving cannot clear it. */
export function persistKeyFailed(name: string): boolean {
  return failedKeys.has(persistKey(name))
}

/** Test helper — resets in-memory status without touching store payloads. */
export function resetPersistStatus(): void {
  failedKeys.clear()
  status = { ok: true, lastOkAt: readLastOkAt(), error: null, quotaExceeded: false }
  emit()
}

function hasLocalStorage(): boolean {
  try {
    return typeof localStorage !== "undefined" && localStorage != null
  } catch {
    return false
  }
}

function inVitest(): boolean {
  return typeof process !== "undefined" && !!process.env.VITEST
}

function isElectronRenderer(): boolean {
  return typeof navigator !== "undefined" && /Electron/i.test(navigator.userAgent)
}

function hubEnabled(): boolean {
  if (inVitest()) return false
  if (isDemoProfile()) return false
  if (typeof window === "undefined") return false
  try {
    const { protocol, hostname } = window.location
    return protocol === "http:" && (hostname === "localhost" || hostname === "127.0.0.1")
  } catch {
    return false
  }
}

type HubSnapshot = { items?: Record<string, string> } | null

let hubPromise: Promise<HubSnapshot> | null = null

function loadHub(): Promise<HubSnapshot> {
  if (!hubEnabled()) return Promise.resolve(null)
  if (!hubPromise) {
    hubPromise = fetch("/api/persist")
      .then((r) => (r.ok ? r.json() : null))
      .catch(() => null)
  }
  return hubPromise
}

/**
 * Electron may seed empty keys from the hub, but once this profile has its own
 * snapshot it must win — unless that snapshot is a seed wipe vs the hub.
 */
export function pickPersistItem(local: string | null, hubValue: unknown, name?: string): string | null {
  return pickVaultItem(local, hubValue, name)
}

function presentLocal(value: string | null): string | null {
  return presentPersistValue(value)
}

/** 15-item Lists/Habits seed vs a live vault. Richer local snapshots must not wait. */
export const PERSIST_SEED_MAX_RECORDS = 20

/** Do not block first paint if `/api/persist` is slow (Next compiling, 2MB parse). */
export const PERSIST_HUB_WAIT_MS = 800

/**
 * True when Electron should wait on the hub: missing key, or a seed-sized
 * snapshot that might be an empty profile wiping Chrome's vault.
 */
export function shouldAwaitPersistHub(name: string, local: string | null): boolean {
  if (presentLocal(local) == null) return true
  // One or two day-notes keys look "seed sized" vs the 20-record cutoff.
  // Waiting on the hub then let a larger historical map replace today's jot.
  if (typeof name === "string" && name.endsWith("tracking-day-notes")) return false
  const count = vaultRecordCount(name, local)
  if (count == null) return false
  return count <= PERSIST_SEED_MAX_RECORDS
}

const persistRehydrators = new Map<string, () => void | Promise<void>>()

/** Stores register so a late hub copy can replace a seed without a full reload. */
export function registerPersistRehydrator(name: string, rehydrate: () => void | Promise<void>): void {
  for (const key of persistKeyAliases(name)) persistRehydrators.set(key, rehydrate)
}

/** Test helper — drop the cached hub GET. */
export function resetPersistHubCache(): void {
  hubPromise = null
}

function writeChosenLocal(name: string, local: string | null, chosen: string | null): string | null {
  const next = presentLocal(chosen)
  if (next == null) return presentLocal(typeof local === "string" ? local : null)
  if (next !== local) {
    try {
      writeAliasedLocal(name, next)
    } catch {
      /* copy is best-effort; still return hub value */
    }
  }
  return next
}

function readLocalItem(name: string): string | null {
  if (!hasLocalStorage()) return null
  ensureLegacyPersistCopied()
  return readAliasedLocal(name)
}

/**
 * Prefer whatever is on disk now over the snapshot captured at getItem start.
 * A PCB / LED pick during the hub wait must not be merged from stale JSON.
 */
export function choosePersistSnapshot(
  name: string,
  fallbackLocal: string | null,
  hubValue: unknown,
): string | null {
  const fresh = readLocalItem(name)
  const local = typeof fresh === "string" ? fresh : fallbackLocal
  return pickPersistItem(local, hubValue, name)
}

function hubItem(hub: HubSnapshot, name: string): unknown {
  if (!hub?.items) return undefined
  const twin = twinPersistKey(name)
  return hub.items[name] ?? (twin ? hub.items[twin] : undefined)
}

function applyHubItem(name: string, local: string | null, hub: HubSnapshot): string | null {
  const fresh = readLocalItem(name)
  const from = typeof fresh === "string" ? fresh : local
  return writeChosenLocal(name, from, choosePersistSnapshot(name, from, hubItem(hub, name)))
}

/**
 * The store kept working while the hub GET was in flight, so this profile is
 * ahead of both the snapshot we started from and the hub. Tracking blocks typed
 * during that window were painted over by the older hub copy and then
 * rehydrated out of the live store — the rows were gone from disk and screen.
 */
export function wroteWhileHubLoaded(fresh: string | null, local: string | null, painted: string | null): boolean {
  return presentLocal(fresh) != null && fresh !== local && fresh !== painted
}

function followHubAfterPaint(name: string, local: string | null, painted: string | null): void {
  // A present theme blob is the last plate / hues. Do not let a late hub GET
  // paint an older snapshot over a pick made during this session.
  if (typeof name === "string" && name.endsWith("theme-store") && presentLocal(readLocalItem(name))) {
    return
  }
  void loadHub().then((hub) => {
    const fresh = readLocalItem(name)
    if (wroteWhileHubLoaded(fresh, local, painted)) return
    const chosen = choosePersistSnapshot(name, fresh ?? local, hubItem(hub, name))
    if (typeof chosen !== "string") return
    if (chosen === painted && chosen === fresh) return
    writeChosenLocal(name, fresh ?? local, chosen)
    if (chosen === painted) return
    const rehydrate = persistRehydrators.get(name) ?? persistRehydrators.get(persistKey(name))
    if (rehydrate) void rehydrate()
  })
}

const hubPostTimers = new Map<string, ReturnType<typeof setTimeout>>()

/**
 * A second renderer (the module popout) or a store that rehydrated from an
 * older snapshot can send a thinner vault than this profile's own disk copy.
 * The hub takes it — the drop is far under the shrink guard — and the next
 * launch reads it back, which is how a day of tracking disappeared. A snapshot
 * that has already lost rows against our own localStorage never leaves.
 */
export function staleAgainstLocalVault(name: string, value: string, local: string | null): boolean {
  if (typeof local !== "string" || !local || local === value) return false
  const next = vaultRecordCount(name, value)
  const prev = vaultRecordCount(name, local)
  return next != null && prev != null && next < prev
}

function postHub(name: string, value: string) {
  // Chrome and a rich Electron profile both POST. Seed-sized Electron
  // snapshots still skip so an empty desktop shell cannot wipe the hub.
  if (!hubEnabled()) return
  if (isElectronRenderer() && !isPlanTextStorageKey(name)) {
    const count = vaultRecordCount(name, value)
    if (count != null && count <= PERSIST_SEED_MAX_RECORDS) return
  }
  if (!value) return
  for (const key of persistKeyAliases(name)) {
    const prev = hubPostTimers.get(key)
    if (prev) clearTimeout(prev)
    hubPostTimers.set(
      key,
      setTimeout(() => {
        hubPostTimers.delete(key)
        // Re-read at send time: another window may have saved a richer vault
        // while this POST waited. Its own POST carries the full copy.
        if (staleAgainstLocalVault(name, value, readLocalItem(name))) return
        void fetch("/api/persist", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: key,
            value,
            source: isElectronRenderer() ? "electron" : "chrome",
          }),
        }).catch(() => {})
      }, 250),
    )
  }
}

/** StateStorage that never throws out of setItem — quota becomes persist status. */
export function cogsStateStorage(): StateStorage {
  return {
    getItem: (name) => {
      if (!hasLocalStorage()) return null
      ensureLegacyPersistCopied()
      const local = presentLocal(readLocalItem(name))
      if (local != null && !(hubEnabled() && isElectronRenderer())) return local
      if (hubEnabled() && isElectronRenderer()) {
        if (!shouldAwaitPersistHub(name, local)) return local
        return Promise.race([
          loadHub().then((hub) => applyHubItem(name, local, hub)),
          new Promise<string | null>((resolve) => {
            setTimeout(() => resolve(local), PERSIST_HUB_WAIT_MS)
          }),
        ]).then((painted) => {
          followHubAfterPaint(name, local, painted)
          return painted
        })
      }
      return local
    },
    setItem: (name, value) => {
      if (!hasLocalStorage()) {
        recordPersistFailure(new Error("localStorage is not available"), name)
        return
      }
      try {
        let previous: string | null = null
        try {
          previous = readAliasedLocal(name)
        } catch {
          previous = null
        }
        if (previous && value) {
          const united = unionPersistSnapshots(value, previous, name)
          if (typeof united === "string") value = united
          const habits = overlayHabitCompletions(value, previous, name)
          if (typeof habits === "string") value = habits
        }
        if (previous === value) {
          return
        }
        if (!value) {
          for (const key of persistKeyAliases(name)) {
            try {
              localStorage.removeItem(key)
            } catch {
              /* ignore */
            }
          }
          recordPersistSuccess(name)
          return
        }
        if (shouldRejectAppearanceDowngrade(name, value, previous)) {
          return
        }
        if (previous && shouldRejectContentDowngrade(name, value, previous)) {
          return
        }
        if (previous && shouldRejectIngestDowngrade(name, value, previous)) {
          return
        }
        if (previous) {
          const kept = overlayIngestAllowlist(value, previous, name)
          if (typeof kept === "string") value = kept
        }
        stampAppearancePins(value, name)
        try {
          writeAliasedLocal(name, value)
        } catch (error) {
          if (isQuotaExceededError(error)) {
            releaseDuplicateLegacyTwins()
            releaseCopiedUnprefixedKeys()
            writeAliasedLocal(name, value)
          } else {
            throw error
          }
        }
        recordPersistSuccess(name)
        postHub(name, value)
      } catch (error) {
        recordPersistFailure(error, name)
      }
    },
    removeItem: (name) => {
      if (!hasLocalStorage()) return
      for (const key of persistKeyAliases(name)) {
        try {
          localStorage.removeItem(key)
        } catch {
          /* ignore */
        }
      }
    },
  }
}

/**
 * Drop-in replacement for Zustand `createJSONStorage(() => localStorage)`.
 * Catches stringify failures (huge state) as well as QuotaExceeded on setItem.
 */
export function createCogsJSONStorage<S>(options?: JsonStorageOptions): PersistStorage<S> {
  const inner = createJSONStorage<S>(() => cogsStateStorage(), options)
  if (!inner) {
    return {
      getItem: () => null,
      setItem: () => {
        recordPersistFailure(new Error("localStorage is not available"))
      },
      removeItem: () => {},
    }
  }
  return {
    getItem: (name) => inner.getItem(name),
    setItem: (name, value) => {
      try {
        return inner.setItem(name, value)
      } catch (error) {
        recordPersistFailure(error, name)
      }
    },
    removeItem: (name) => inner.removeItem(name),
  }
}
