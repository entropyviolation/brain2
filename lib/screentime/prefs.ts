/**
 * lib/screentime/prefs.ts — Screen Time prefs, outside the timegrid blob
 *
 * ActivityWatch connection + sync knobs live on their own persist key so a
 * tracking restore cannot clobber them and a prefs write cannot rewrite the
 * grid. Window titles stay off unless the user opts in.
 */

import { persistKey, readAliasedLocal, writeAliasedLocal } from "@/lib/storage-keys"

export const SCREENTIME_PREFS_KEY = persistKey("screentime-prefs")

export interface ScreenTimePrefs {
  url: string
  lookbackDays: number
  minDurationSec: number
  storeWindowTitles: boolean
  includeWebWatcher: boolean
  lastSuccessAt?: string
  lastError?: string
  /** Honest last-sync sentence (empty success vs filtered vs painted). */
  lastSyncNote?: string
}

export const DEFAULT_SCREENTIME_PREFS: ScreenTimePrefs = {
  url: "http://127.0.0.1:5600",
  lookbackDays: 14,
  minDurationSec: 15,
  storeWindowTitles: false,
  includeWebWatcher: true,
}

const LOOPBACK_HOSTS = new Set(["127.0.0.1", "localhost", "[::1]", "::1"])

function isLoopbackHost(hostname: string): boolean {
  const host = hostname.trim().toLowerCase()
  if (LOOPBACK_HOSTS.has(host)) return true
  const parts = host.split(".")
  return parts.length === 4 && parts[0] === "127" && parts.every((p) => /^\d{1,3}$/.test(p))
}

/** True for loopback http(s) URLs. Never throws. */
export function isLoopbackScreenTimeUrl(url: string): boolean {
  try {
    const parsed = new URL(String(url ?? "").trim())
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return false
    return isLoopbackHost(parsed.hostname)
  } catch {
    return false
  }
}

function clampInt(value: unknown, fallback: number, min: number, max: number): number {
  const n = typeof value === "number" ? value : Number(value)
  if (!Number.isFinite(n)) return fallback
  return Math.min(max, Math.max(min, Math.round(n)))
}

function sanitizePrefs(raw: Partial<ScreenTimePrefs> | null | undefined, base: ScreenTimePrefs): ScreenTimePrefs {
  const next: ScreenTimePrefs = {
    url: base.url,
    lookbackDays: clampInt(raw?.lookbackDays ?? base.lookbackDays, base.lookbackDays, 1, 365),
    minDurationSec: clampInt(raw?.minDurationSec ?? base.minDurationSec, base.minDurationSec, 0, 3600),
    storeWindowTitles: raw?.storeWindowTitles ?? base.storeWindowTitles,
    includeWebWatcher: raw?.includeWebWatcher ?? base.includeWebWatcher,
  }

  const candidate = typeof raw?.url === "string" ? raw.url.trim() : ""
  if (candidate && isLoopbackScreenTimeUrl(candidate)) next.url = candidate.replace(/\/+$/, "")

  if (typeof raw?.lastSuccessAt === "string" && raw.lastSuccessAt) next.lastSuccessAt = raw.lastSuccessAt
  if (typeof raw?.lastError === "string" && raw.lastError) next.lastError = raw.lastError
  if (typeof raw?.lastSyncNote === "string" && raw.lastSyncNote.trim()) {
    next.lastSyncNote = raw.lastSyncNote.trim().slice(0, 500)
  }
  return next
}

function readStored(): Partial<ScreenTimePrefs> | null {
  if (typeof localStorage === "undefined") return null
  try {
    const raw = readAliasedLocal(SCREENTIME_PREFS_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as unknown
    if (!parsed || typeof parsed !== "object") return null
    return parsed as Partial<ScreenTimePrefs>
  } catch {
    return null
  }
}

export function loadScreenTimePrefs(): ScreenTimePrefs {
  return sanitizePrefs(readStored(), DEFAULT_SCREENTIME_PREFS)
}

export function saveScreenTimePrefs(patch: Partial<ScreenTimePrefs>): ScreenTimePrefs {
  const current = loadScreenTimePrefs()
  const next = sanitizePrefs({ ...current, ...patch }, current)
  if (typeof localStorage !== "undefined") {
    try {
      writeAliasedLocal(SCREENTIME_PREFS_KEY, JSON.stringify(next))
    } catch {
      /* quota / private mode — still return the sanitized value */
    }
  }
  return next
}
