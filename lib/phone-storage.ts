/**
 * lib/phone-storage.ts — Make room in the phone's web-storage box.
 *
 * The desktop vault does not fit. A phone save stores item names and list
 * ids, and about a week of the time grid. A full box drops side vaults
 * (telegram, modules, sun times, …) so that write can land. NFC and the hub
 * URL stay. Desktop Electron never takes this path.
 */
import { slimStoredVault } from "@/lib/phone-hub-view.mjs"
import { isPhoneWebStorage } from "@/lib/phone-device"

const KEEP_SUFFIXES = [
  "task-storage",
  "timegrid-store",
  "habits-store",
  "goals-store",
  "event-storage",
  "sleep-store",
  "theme-store",
  "user-settings",
  "tracking-day-notes",
  "home-dashboard",
  "mobile-sync-url",
  "nfc-hub",
  "nfc-chips",
  "data-profile",
  "demo-vault-ready",
  "last-persist-ok",
]

const KEEP_EXACT = new Set(["points-store", "regret-store"])

function phoneKeepsKey(key: string): boolean {
  if (KEEP_EXACT.has(key)) return true
  return KEEP_SUFFIXES.some((suffix) => key === suffix || key.endsWith(`-${suffix}`) || key.endsWith(suffix))
}

/** Task and time-grid JSON as the phone stores them. Null when nothing changes. */
export function slimPhonePersistValue(name: string, value: string, now = new Date()): string | null {
  if (!isPhoneWebStorage()) return null
  if (!value || (!name.endsWith("task-storage") && !name.endsWith("timegrid-store"))) return null
  try {
    const slim = slimStoredVault(name, JSON.parse(value), now)
    const next = JSON.stringify(slim)
    if (!next || next === value || next.length >= value.length) return null
    return next
  } catch {
    return null
  }
}

function storageNames(): string[] {
  const names: string[] = []
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i)
    if (key) names.push(key)
  }
  return names
}

function isSideVault(key: string, value: string, minChars: number): boolean {
  if (phoneKeepsKey(key)) return false
  return value.length > minChars
}

/**
 * Drop side vaults and shrink the task / time-grid copies already on disk.
 * `keepName` is the key a caller is about to replace. Returns how many keys changed.
 */
export function freePhoneWebStorage(keepName?: string, options?: { dropTimegrid?: boolean }): number {
  if (!isPhoneWebStorage() || typeof localStorage === "undefined") return 0
  let changed = 0
  for (const key of storageNames()) {
    if (key === keepName) continue
    let value: string | null = null
    try {
      value = localStorage.getItem(key)
    } catch {
      continue
    }
    if (value == null) continue
    const minChars = options?.dropTimegrid ? 8192 : 100_000
    const dropTimegrid = options?.dropTimegrid === true && key.endsWith("timegrid-store")
    if (dropTimegrid || isSideVault(key, value, minChars)) {
      try {
        localStorage.removeItem(key)
        changed++
      } catch {
        /* the write that follows still retries */
      }
      continue
    }
    const slim = slimPhonePersistValue(key, value)
    if (typeof slim !== "string") continue
    try {
      localStorage.removeItem(key)
      localStorage.setItem(key, slim)
      changed++
    } catch {
      try {
        localStorage.setItem(key, value)
      } catch {
        /* the fat copy did not fit either */
      }
    }
  }
  return changed
}
