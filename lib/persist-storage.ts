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

/** StateStorage that never throws out of setItem — quota becomes persist status. */
export function cogsStateStorage(): StateStorage {
  return {
    getItem: (name) => {
      if (!hasLocalStorage()) return null
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
