/**
 * lib/persist-storage.ts — Guarded localStorage adapter for Zustand persist
 *
 * Every persisted store writes through this adapter so a QuotaExceeded (or any
 * other setItem failure) cannot fail silently. Memory state is left as-is;
 * callers subscribe to persist status to show a visible error and an export nudge.
 *
 * `localStorage` origin quota is typically 5–10MB. Attachments no longer live
 * in the JSON blob (`lib/attachments.ts`); this guard is the backstop for the
 * remaining JSON and for restore.
 *
 * On `localhost` in Electron, reads prefer the dev-server hub (`/api/persist`)
 * so a reboot cannot leave the desktop shell stuck on an old Chromium profile
 * while Chrome has the live vault. Chrome always reads and writes its own
 * localStorage (never imported from the hub). Electron never writes the hub,
 * so a stale desktop boot cannot clobber Chrome's snapshot.
 */
import { createJSONStorage, type PersistStorage, type StateStorage } from "zustand/middleware"

type JsonStorageOptions = {
  reviver?: (key: string, value: unknown) => unknown
  replacer?: (key: string, value: unknown) => unknown
}

export const LAST_PERSIST_OK_KEY = "cogs-last-persist-ok"

export type PersistStatus = {
  ok: boolean
  lastOkAt: string | null
  error: string | null
  quotaExceeded: boolean
}

const listeners = new Set<() => void>()

let status: PersistStatus = {
  ok: true,
  lastOkAt: readLastOkAt(),
  error: null,
  quotaExceeded: false,
}

function readLastOkAt(): string | null {
  if (typeof localStorage === "undefined") return null
  try {
    return localStorage.getItem(LAST_PERSIST_OK_KEY)
  } catch {
    return null
  }
}

function emit() {
  for (const listener of listeners) listener()
}

export function isQuotaExceededError(error: unknown): boolean {
  if (!error || typeof error !== "object") return false
  const err = error as { name?: string; code?: number }
  return (
    err.name === "QuotaExceededError" ||
    err.name === "NS_ERROR_DOM_QUOTA_REACHED" ||
    err.code === 22 ||
    err.code === 1014
  )
}

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

export function recordPersistSuccess(): void {
  const lastOkAt = new Date().toISOString()
  if (typeof localStorage !== "undefined") {
    try {
      localStorage.setItem(LAST_PERSIST_OK_KEY, lastOkAt)
    } catch {
      // Tiny key may also fail when quota is already exhausted; keep memory.
    }
  }
  status = { ok: true, lastOkAt, error: null, quotaExceeded: false }
  emit()
}

export function recordPersistFailure(error: unknown): void {
  status = {
    ok: false,
    lastOkAt: status.lastOkAt,
    error: persistErrorMessage(error),
    quotaExceeded: isQuotaExceededError(error),
  }
  emit()
}

/** Test helper — resets in-memory status without touching store payloads. */
export function resetPersistStatus(): void {
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

const hubPostTimers = new Map<string, ReturnType<typeof setTimeout>>()

function postHub(name: string, value: string) {
  // Chrome is the only hub writer. Electron hydrates from the hub (and from
  // preload) but must never POST, or a stale desktop profile can overwrite
  // the Chrome vault.
  if (!hubEnabled() || isElectronRenderer()) return
  const prev = hubPostTimers.get(name)
  if (prev) clearTimeout(prev)
  hubPostTimers.set(
    name,
    setTimeout(() => {
      hubPostTimers.delete(name)
      void fetch("/api/persist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, value, source: "chrome" }),
      }).catch(() => {})
    }, 250),
  )
}

/** StateStorage that never throws out of setItem — quota becomes persist status. */
export function cogsStateStorage(): StateStorage {
  return {
    getItem: (name) => {
      if (!hasLocalStorage()) return null
      if (hubEnabled() && isElectronRenderer()) {
        return loadHub().then((hub) => {
          const fromHub = hub?.items?.[name]
          if (typeof fromHub === "string") {
            try {
              localStorage.setItem(name, fromHub)
            } catch {
              /* copy is best-effort; still return hub value */
            }
            return fromHub
          }
          try {
            return localStorage.getItem(name)
          } catch {
            return null
          }
        })
      }
      try {
        return localStorage.getItem(name)
      } catch {
        return null
      }
    },
    setItem: (name, value) => {
      if (!hasLocalStorage()) {
        recordPersistFailure(new Error("localStorage is not available"))
        return
      }
      try {
        localStorage.setItem(name, value)
        recordPersistSuccess()
        postHub(name, value)
      } catch (error) {
        recordPersistFailure(error)
      }
    },
    removeItem: (name) => {
      if (!hasLocalStorage()) return
      try {
        localStorage.removeItem(name)
      } catch {
        /* ignore */
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
        recordPersistFailure(error)
      }
    },
    removeItem: (name) => inner.removeItem(name),
  }
}
