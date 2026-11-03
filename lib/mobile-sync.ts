/**
 * lib/mobile-sync.ts — Client for the Brain2 sync hub.
 *
 * Prefer same-origin `/api/sync` (unified `npm run dev` server). A native
 * shell is not on that origin, so it uses the saved hub URL, or the dev
 * server on port 3000. Port 3847 is a retired standalone server.
 */

import { createFullBackup, parseBackup, restoreBackup, type Backup } from "@/lib/data/backup"
import { pullBackupView } from "@/lib/phone-hub-view.mjs"
import { useTaskStore } from "@/lib/task-store"
import { useEventStore } from "@/lib/event-store"

import { isPhoneWebStorage } from "@/lib/phone-device"
import {
  isPlanTextStorageKey,
  persistKey,
  persistKeyAliases,
  readAliasedLocal,
  releaseCopiedUnprefixedKeys,
  releaseDuplicateLegacyTwins,
  releaseFriendPicLocalKeys,
  writeAliasedLocal,
} from "@/lib/storage-keys"

export const MOBILE_SYNC_DEFAULT_URL = "http://127.0.0.1:3000"
export const MOBILE_SYNC_URL_KEY = persistKey("mobile-sync-url")
export const MOBILE_SYNC_PORT = 3000

export type MobileSyncStatusResponse = {
  ok: true
  hasData: boolean
  updatedAt: string | null
  exportedAt: string | null
  stats?: {
    taskCount: number
    eventCount: number
    listCount: number
    storeCount: number
  }
}

export type MobileSyncPullResponse = {
  ok: true
  backup: Backup | null
  updatedAt: string | null
}

function authHeader(username: string, password: string): string {
  const token =
    typeof btoa === "function" ? btoa(`${username}:${password}`) : Buffer.from(`${username}:${password}`).toString("base64")
  return `Basic ${token}`
}

function normalizeBaseUrl(url: string): string {
  return url.replace(/\/+$/, "")
}

function isLoopbackHost(host: string): boolean {
  return host === "localhost" || host === "127.0.0.1" || host === "[::1]" || host === "::1"
}

function isLoopbackUrl(url: string): boolean {
  try {
    return isLoopbackHost(new URL(url).hostname)
  } catch {
    return false
  }
}

function isHttpPageOrigin(): boolean {
  if (typeof window === "undefined") return false
  return window.location.protocol === "http:" || window.location.protocol === "https:"
}

/** A saved `http://127.0.0.1:3847` points at a server this app no longer starts. */
export function isRetiredHubUrl(url: string): boolean {
  try {
    const parsed = new URL(url)
    return isLoopbackHost(parsed.hostname) && parsed.port === "3847"
  } catch {
    return false
  }
}

/**
 * Same origin when the app is served from the unified Next+sync server.
 * A native shell's loopback is the phone, not the Mac. `mobile-hub.json`
 * supplies the Mac's LAN address for that shell.
 */
export function guessMobileSyncUrl(): string {
  if (typeof window === "undefined") return MOBILE_SYNC_DEFAULT_URL
  if (isHttpPageOrigin()) {
    // Unified server hosts /api/sync on the app port — this is the reliable path.
    return window.location.origin
  }
  const host = window.location.hostname
  if (host && !isLoopbackHost(host)) return `http://${host}:${MOBILE_SYNC_PORT}`
  return MOBILE_SYNC_DEFAULT_URL
}

export function readMobileSyncUrl(): string {
  if (typeof window === "undefined") return MOBILE_SYNC_DEFAULT_URL
  // Always prefer same-origin when we're on http(s) Next — ignores a stale saved hub.
  if (isHttpPageOrigin()) return window.location.origin
  const stored = readAliasedLocal(MOBILE_SYNC_URL_KEY)?.trim()
  if (stored && !isRetiredHubUrl(stored)) {
    if (isLoopbackUrl(stored) && !isLoopbackHost(window.location.hostname)) {
      return guessMobileSyncUrl()
    }
    return normalizeBaseUrl(stored)
  }
  return guessMobileSyncUrl()
}

export function writeMobileSyncUrl(url: string): void {
  const cleaned = normalizeBaseUrl(url.trim() || guessMobileSyncUrl())
  writeAliasedLocal(MOBILE_SYNC_URL_KEY, cleaned)
}

/**
 * Use a bundled Mac address when this shell only has a loopback hub.
 * Returns the replacement, or null when the current URL should stay.
 */
export function preferBundledHub(current: string, bundled: string | null, httpPage: boolean): string | null {
  if (httpPage || !bundled) return null
  const cleaned = bundled.trim().replace(/\/+$/, "")
  if (!cleaned.startsWith("http://") && !cleaned.startsWith("https://")) return null
  if (!isLoopbackUrl(current) || isLoopbackUrl(cleaned)) return null
  return cleaned
}

/**
 * LAN hub baked into the app at build time (`public/mobile-hub.json`).
 * Native shells only. `cache: "no-store"` makes WKWebView miss that file,
 * so the phone stays on 127.0.0.1 and never reaches the Mac.
 */
export async function fetchBundledHubUrl(): Promise<string | null> {
  if (typeof window === "undefined" || isHttpPageOrigin()) return null
  try {
    const response = await fetch("/mobile-hub.json")
    if (!response.ok) return null
    const data = (await response.json()) as { url?: unknown }
    if (typeof data.url !== "string") return null
    const cleaned = data.url.trim().replace(/\/+$/, "")
    if (!cleaned.startsWith("http://") && !cleaned.startsWith("https://")) return null
    if (isLoopbackUrl(cleaned)) return null
    return cleaned
  } catch {
    return null
  }
}

/** Native shells read `public/mobile-hub.json` for the Mac's LAN hub. */
export async function loadBundledHubUrl(): Promise<string | null> {
  const bundled = await fetchBundledHubUrl()
  const next = preferBundledHub(readMobileSyncUrl(), bundled, isHttpPageOrigin())
  if (!next) return null
  writeMobileSyncUrl(next)
  return next
}

/**
 * Hosts to try, first choice first. A loopback default is replaced by the
 * baked LAN address. A saved address that does not answer falls through to
 * that same bake.
 */
export async function phoneHubCandidates(): Promise<string[]> {
  const current = readMobileSyncUrl().replace(/\/+$/, "")
  if (typeof window === "undefined" || isHttpPageOrigin()) return current ? [current] : []
  const bundled = await fetchBundledHubUrl()
  const replaced = preferBundledHub(current, bundled, false)
  if (replaced) writeMobileSyncUrl(replaced)
  const first = replaced || current
  const out: string[] = []
  if (first) out.push(first)
  if (bundled && !out.includes(bundled)) out.push(bundled)
  return out
}

/** True when this client has essentially no user content (safe to auto-seed). */
export function mobileClientLooksEmpty(): boolean {
  if (typeof window === "undefined") return true
  const tasks = useTaskStore.getState().tasks
  const events = useEventStore.getState().events
  return tasks.length === 0 && events.length === 0
}

async function syncFetch(
  baseUrl: string,
  path: string,
  init: RequestInit & { username?: string; password?: string } = {},
): Promise<Response> {
  const { username = "admin", password = "admin", headers, ...rest } = init
  const response = await fetch(`${normalizeBaseUrl(baseUrl)}${path}`, {
    ...rest,
    headers: {
      Accept: "application/json",
      Authorization: authHeader(username, password),
      ...(headers ?? {}),
    },
  })
  if (!response.ok) {
    let detail = `${response.status} ${response.statusText}`
    try {
      const body = (await response.json()) as { error?: string }
      if (body.error) detail = body.error
    } catch {
      /* ignore */
    }
    throw new Error(detail)
  }
  return response
}

export async function fetchMobileSyncStatus(
  baseUrl: string = readMobileSyncUrl(),
  username = "admin",
  password = "admin",
): Promise<MobileSyncStatusResponse> {
  const response = await syncFetch(baseUrl, "/api/sync/status", { username, password })
  return (await response.json()) as MobileSyncStatusResponse
}

export async function pullMobileSyncBackup(
  baseUrl: string = readMobileSyncUrl(),
  username = "admin",
  password = "admin",
  full = false,
): Promise<MobileSyncPullResponse> {
  const path = full ? "/api/sync/pull?full=1" : "/api/sync/pull"
  const response = await syncFetch(baseUrl, path, { username, password })
  const data = (await response.json()) as { ok: true; backup: unknown; updatedAt: string | null }
  if (data.backup == null) {
    return { ok: true, backup: null, updatedAt: data.updatedAt }
  }
  const backup = parseBackup(JSON.stringify(data.backup))
  return { ok: true, backup, updatedAt: data.updatedAt }
}

export async function pushMobileSyncBackup(
  baseUrl: string = readMobileSyncUrl(),
  username = "admin",
  password = "admin",
  backup: Backup,
): Promise<{ ok: true; updatedAt: string }> {
  const response = await syncFetch(baseUrl, "/api/sync/push", {
    method: "POST",
    username,
    password,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ backup }),
  })
  return (await response.json()) as { ok: true; updatedAt: string }
}

function tasksInStorePayload(payload: unknown): number {
  if (!payload || typeof payload !== "object") return 0
  const record = payload as { state?: { tasks?: unknown }; tasks?: unknown }
  const tasks = record.state?.tasks ?? record.tasks
  return Array.isArray(tasks) ? tasks.length : 0
}

/** Task rows in a hub snapshot. Reads either persist name. */
export function backupTaskCount(backup: Backup): number {
  const stores = backup.stores ?? {}
  return Math.max(
    tasksInStorePayload(stores["brain2-task-storage"]),
    tasksInStorePayload(stores["cogs-task-storage"]),
  )
}

/**
 * How many tasks this device already has. The disk copy counts too, so a
 * store that has not rehydrated yet cannot look empty.
 */
export function deviceTaskCount(): number {
  const live = useTaskStore.getState().tasks?.length ?? 0
  const raw = readAliasedLocal(persistKey("task-storage"))
  if (!raw) return live
  try {
    return Math.max(live, tasksInStorePayload(JSON.parse(raw)))
  } catch {
    return Math.max(live, raw.length > 1000 ? Number.MAX_SAFE_INTEGER : 0)
  }
}

/**
 * A pull replaces this device. Refuse when the snapshot has fewer tasks
 * than the device already does. An empty phone can still take the desktop copy.
 */
export function pullShrinksDevice(backup: Backup, localTaskCount = deviceTaskCount()): string | null {
  const incoming = backupTaskCount(backup)
  if (localTaskCount >= 20 && incoming < localTaskCount) {
    return `Refusing pull that would shrink this device from ${localTaskCount} to ${incoming} tasks. Nothing on this device was changed.`
  }
  return null
}

/**
 * The iOS app and `/mobile` share a web-storage box of about 5 MB. The full
 * desktop snapshot does not fit in it. A saved hub URL on a phone is not enough
 * — the shell's origin is `capacitor:`, and Safari on a phone is `/mobile` or
 * an iPhone user agent.
 */
export function deviceNeedsPhoneHubPull(): boolean {
  return isPhoneWebStorage()
}

const PHONE_PIN_KEYS = [
  "brain2-data-profile",
  "brain2-demo-vault-ready",
  "brain2-nfc-hub",
  "brain2-nfc-chips",
]

/**
 * A failed full pull can leave extras and a twin vault in the box, so the next
 * phone copy still will not fit. Drop those. NFC setup and the hub URL stay.
 * Returns how many keys were removed.
 */
export function reclaimPhonePullStorage(keepNames: string[]): number {
  if (typeof localStorage === "undefined") return 0
  releaseDuplicateLegacyTwins()
  releaseCopiedUnprefixedKeys()
  releaseFriendPicLocalKeys()
  const keep = new Set<string>(PHONE_PIN_KEYS)
  for (const alias of persistKeyAliases(persistKey("mobile-sync-url"))) keep.add(alias)
  for (const name of keepNames) {
    for (const alias of persistKeyAliases(name)) keep.add(alias)
  }
  const names: string[] = []
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i)
    if (key) names.push(key)
  }
  let removed = 0
  for (const key of names) {
    if (keep.has(key)) continue
    const drop =
      key.startsWith("brain2-") ||
      key.startsWith("cogs-") ||
      key.includes("friend-pic:") ||
      isPlanTextStorageKey(key)
    if (!drop) continue
    try {
      localStorage.removeItem(key)
      removed++
    } catch {
      /* this key stays; the restore write still retries without it */
    }
  }
  return removed
}

export async function pullAndRestoreMobileSync(
  baseUrl: string = readMobileSyncUrl(),
  username = "admin",
  password = "admin",
  full = false,
): Promise<{ restored: boolean; stores: number; planText: number; updatedAt: string | null }> {
  const phone = deviceNeedsPhoneHubPull()
  const { backup, updatedAt } = await pullMobileSyncBackup(baseUrl, username, password, full && !phone)
  if (!backup || Object.keys(backup.stores || {}).length === 0) {
    return { restored: false, stores: 0, planText: 0, updatedAt }
  }
  const shrink = pullShrinksDevice(backup)
  if (shrink) throw new Error(shrink)
  const view = (phone ? pullBackupView(backup, false) : backup) as Backup
  if (!view.stores || Object.keys(view.stores).length === 0) {
    return { restored: false, stores: 0, planText: 0, updatedAt }
  }
  if (phone) reclaimPhonePullStorage(Object.keys(view.stores))
  const result = await restoreBackup(
    view,
    phone
      ? {
          storeKeys: Object.keys(view.stores),
          mode: "replace",
          planText: false,
          attachments: false,
          docs: false,
          extras: false,
        }
      : undefined,
  )
  return { restored: true, stores: result.stores, planText: result.planText, updatedAt }
}

export async function pushCurrentMobileSync(
  baseUrl: string = readMobileSyncUrl(),
  username = "admin",
  password = "admin",
): Promise<{ ok: true; updatedAt: string }> {
  return pushMobileSyncBackup(baseUrl, username, password, await createFullBackup())
}
