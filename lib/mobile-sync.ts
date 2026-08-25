/**
 * lib/mobile-sync.ts — Client for the COGS sync hub.
 *
 * Prefer same-origin `/api/sync` (unified `npm run dev` server). Fall back to
 * LAN host:3847 only for Capacitor/static shells that aren't on the Next port.
 */

import { createFullBackup, parseBackup, restoreBackup, type Backup } from "@/lib/data/backup"
import { useTaskStore } from "@/lib/task-store"
import { useEventStore } from "@/lib/event-store"

export const MOBILE_SYNC_DEFAULT_URL = "http://127.0.0.1:3847"
export const MOBILE_SYNC_URL_KEY = "cogs-mobile-sync-url"
export const MOBILE_SYNC_PORT = 3847

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

/**
 * Same origin when the app is served from the unified Next+sync server.
 * Otherwise LAN hostname:3847 so a phone never uses its own 127.0.0.1.
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
  // Always prefer same-origin when we're on http(s) Next — ignores stale :3847 prefs.
  if (isHttpPageOrigin()) return window.location.origin
  const stored = localStorage.getItem(MOBILE_SYNC_URL_KEY)?.trim()
  if (stored) {
    if (isLoopbackUrl(stored) && !isLoopbackHost(window.location.hostname)) {
      return guessMobileSyncUrl()
    }
    return normalizeBaseUrl(stored)
  }
  return guessMobileSyncUrl()
}

export function writeMobileSyncUrl(url: string): void {
  const cleaned = normalizeBaseUrl(url.trim() || guessMobileSyncUrl())
  localStorage.setItem(MOBILE_SYNC_URL_KEY, cleaned)
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
): Promise<MobileSyncPullResponse> {
  const response = await syncFetch(baseUrl, "/api/sync/pull", { username, password })
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

export async function pullAndRestoreMobileSync(
  baseUrl: string = readMobileSyncUrl(),
  username = "admin",
  password = "admin",
): Promise<{ restored: boolean; stores: number; planText: number; updatedAt: string | null }> {
  const { backup, updatedAt } = await pullMobileSyncBackup(baseUrl, username, password)
  if (!backup || Object.keys(backup.stores || {}).length === 0) {
    return { restored: false, stores: 0, planText: 0, updatedAt }
  }
  const result = await restoreBackup(backup)
  return { restored: true, stores: result.stores, planText: result.planText, updatedAt }
}

export async function pushCurrentMobileSync(
  baseUrl: string = readMobileSyncUrl(),
  username = "admin",
  password = "admin",
): Promise<{ ok: true; updatedAt: string }> {
  return pushMobileSyncBackup(baseUrl, username, password, await createFullBackup())
}
