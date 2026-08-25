/**
 * lib/live-sync.ts — Continuous two-way sync between desktop and phone.
 *
 * DEPRECATED for now. The engine is parked while the core app is finished;
 * a dedicated semi-mobile live sync component will land after that.
 * Flip `LIVE_SYNC_DEPRECATED` only when that component is ready.
 * Manual hub push/pull (`lib/mobile-sync.ts`) is unchanged.
 *
 * Local edits debounce-push; remote changes poll-pull (last-write-wins).
 * Safeguards refuse empty/tiny snapshots so a blank phone cannot wipe desktop.
 */

import { BACKUP_STORES, createBackup } from "@/lib/data/backup"
import { useTaskStore } from "@/lib/task-store"
import { useEventStore } from "@/lib/event-store"
import { useHabitsStore } from "@/lib/habits-store"
import { useGoalsStore } from "@/lib/goals-store"
import { usePointsStore } from "@/lib/points-store"
import { useTimeTrackingStore } from "@/lib/time-tracking-store"
import {
  fetchMobileSyncStatus,
  guessMobileSyncUrl,
  mobileClientLooksEmpty,
  pullAndRestoreMobileSync,
  pushCurrentMobileSync,
  readMobileSyncUrl,
  writeMobileSyncUrl,
  type MobileSyncStatusResponse,
} from "@/lib/mobile-sync"

export const LIVE_SYNC_REMOTE_AT_KEY = "cogs-live-sync-remote-at"
export const LIVE_SYNC_ENABLED_KEY = "cogs-live-sync-enabled"

/** Parked until a dedicated semi-mobile live sync component ships. */
export const LIVE_SYNC_DEPRECATED = true

const POLL_MS = 2000
const PUSH_DEBOUNCE_MS = 900
const PLAN_PREFIXES = ["dayPlan-", "weekPlan-", "monthPlan-"]

export type LiveSyncStatus = {
  state: "starting" | "synced" | "syncing" | "offline" | "error"
  message: string
  url: string
  lastRemoteAt: string | null
}

type Listener = (status: LiveSyncStatus) => void

function readLastRemoteAt(): string | null {
  if (typeof window === "undefined") return null
  return localStorage.getItem(LIVE_SYNC_REMOTE_AT_KEY)
}

function writeLastRemoteAt(value: string | null) {
  if (value) localStorage.setItem(LIVE_SYNC_REMOTE_AT_KEY, value)
  else localStorage.removeItem(LIVE_SYNC_REMOTE_AT_KEY)
}

/** Off while deprecated; previously on by default unless set to "0". */
export function isLiveSyncEnabled(): boolean {
  if (LIVE_SYNC_DEPRECATED) return false
  if (typeof window === "undefined") return false
  return localStorage.getItem(LIVE_SYNC_ENABLED_KEY) !== "0"
}

export function setLiveSyncEnabled(enabled: boolean) {
  localStorage.setItem(LIVE_SYNC_ENABLED_KEY, enabled ? "1" : "0")
}

function localTaskCount(): number {
  return useTaskStore.getState().tasks.length
}

function localEventCount(): number {
  return useEventStore.getState().events.length
}

function localFingerprint(): string {
  const parts: string[] = []
  for (const { key } of BACKUP_STORES) {
    const raw = localStorage.getItem(key)
    parts.push(`${key}:${raw?.length ?? 0}:${raw ? raw.slice(0, 24) : ""}`)
  }
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i)
    if (!key || !PLAN_PREFIXES.some((p) => key.startsWith(p))) continue
    const raw = localStorage.getItem(key)
    parts.push(`${key}:${raw?.length ?? 0}`)
  }
  return parts.join("|")
}

function resolveSyncUrl(): string {
  const guessed = guessMobileSyncUrl()
  writeMobileSyncUrl(guessed)
  return guessed
}

/** Pull only when remote isn't a catastrophic wipe vs local. */
function isSafeToPull(status: MobileSyncStatusResponse): boolean {
  if (!status.hasData) return false
  const remoteTasks = status.stats?.taskCount ?? 0
  const remoteEvents = status.stats?.eventCount ?? 0
  const localTasks = localTaskCount()
  const localEvents = localEventCount()

  if (localTasks === 0 && localEvents === 0) return true
  if (remoteTasks === 0 && remoteEvents === 0 && (localTasks > 0 || localEvents > 0)) return false
  // Allow normal churn; block only huge shrinks (empty-phone overwrite).
  if (localTasks > 50 && remoteTasks < Math.floor(localTasks * 0.25)) return false
  return true
}

/**
 * Start continuous two-way sync. Returns a dispose function.
 */
export function startLiveSync(onStatus?: Listener): () => void {
  if (typeof window === "undefined" || LIVE_SYNC_DEPRECATED) return () => {}

  let disposed = false
  let applyingRemote = false
  let dirty = false
  let pushTimer: number | null = null
  let pollTimer: number | null = null
  let fpTimer: number | null = null
  let lastFp = localFingerprint()
  let lastRemoteAt = readLastRemoteAt()
  let busy = false

  const emit = (partial: Partial<LiveSyncStatus> & Pick<LiveSyncStatus, "state" | "message">) => {
    onStatus?.({
      state: partial.state,
      message: partial.message,
      url: partial.url ?? resolveSyncUrl(),
      lastRemoteAt: partial.lastRemoteAt !== undefined ? partial.lastRemoteAt : lastRemoteAt,
    })
  }

  const schedulePush = () => {
    if (pushTimer != null) window.clearTimeout(pushTimer)
    pushTimer = window.setTimeout(() => {
      pushTimer = null
      void runPush()
    }, PUSH_DEBOUNCE_MS)
  }

  const runPush = async () => {
    if (disposed || applyingRemote || busy || !isLiveSyncEnabled()) return
    const url = resolveSyncUrl()
    const backup = createBackup()
    const storeCount = Object.keys(backup.stores || {}).length
    if (storeCount === 0 || mobileClientLooksEmpty()) {
      dirty = false
      emit({
        state: "synced",
        message: "Live sync on — waiting for local data before upload",
        url,
      })
      return
    }
    busy = true
    emit({ state: "syncing", message: "Uploading…", url })
    try {
      const result = await pushCurrentMobileSync(url)
      lastRemoteAt = result.updatedAt
      writeLastRemoteAt(lastRemoteAt)
      lastFp = localFingerprint()
      dirty = false
      emit({ state: "synced", message: "Live sync · both ways", url, lastRemoteAt })
    } catch (err) {
      emit({
        state: "offline",
        message: `Sync offline — ${err instanceof Error ? err.message : "unreachable"}`,
        url,
      })
    } finally {
      busy = false
    }
  }

  const runPull = async (reason: string) => {
    if (disposed || busy || !isLiveSyncEnabled()) return
    const url = resolveSyncUrl()
    busy = true
    applyingRemote = true
    emit({ state: "syncing", message: reason, url })
    try {
      const result = await pullAndRestoreMobileSync(url)
      if (result.restored) {
        lastRemoteAt = result.updatedAt
        writeLastRemoteAt(lastRemoteAt)
        lastFp = localFingerprint()
        dirty = false
        emit({ state: "synced", message: "Live sync · updated from other device", url, lastRemoteAt })
        window.dispatchEvent(new CustomEvent("cogs-live-sync-applied"))
      } else {
        emit({ state: "synced", message: "Live sync on — hub empty, seeding…", url })
        await runPush()
      }
    } catch (err) {
      emit({
        state: "offline",
        message: `Sync offline — ${err instanceof Error ? err.message : "unreachable"}`,
        url,
      })
    } finally {
      applyingRemote = false
      busy = false
      lastFp = localFingerprint()
    }
  }

  const tick = async () => {
    if (disposed || busy || !isLiveSyncEnabled()) return
    const url = resolveSyncUrl()
    try {
      const status = await fetchMobileSyncStatus(url)
      if (!status.hasData) {
        if (!mobileClientLooksEmpty()) await runPush()
        else {
          emit({
            state: "synced",
            message: "Live sync on — waiting for desktop to seed hub",
            url,
          })
        }
        return
      }

      const remoteNewer =
        !!status.updatedAt && status.updatedAt !== lastRemoteAt && (!lastRemoteAt || status.updatedAt > lastRemoteAt)

      // Local edits always upload first (phone → hub → desktop on next poll).
      if (dirty) {
        await runPush()
        return
      }

      if (remoteNewer && isSafeToPull(status)) {
        await runPull("Downloading other device’s changes…")
        return
      }

      if (remoteNewer && !isSafeToPull(status)) {
        emit({
          state: "error",
          message: "Hub looks much smaller than this device — pull blocked. Use Settings → Force pull only if intentional.",
          url,
          lastRemoteAt: status.updatedAt,
        })
        return
      }

      emit({ state: "synced", message: "Live sync · both ways", url, lastRemoteAt: status.updatedAt })
    } catch {
      emit({
        state: "offline",
        message: `Can't reach ${url}. Keep npm run dev / electron:dev running.`,
        url,
      })
    }
  }

  emit({ state: "starting", message: "Starting live sync…", url: resolveSyncUrl() })
  void tick()

  pollTimer = window.setInterval(() => void tick(), POLL_MS)
  fpTimer = window.setInterval(() => {
    if (applyingRemote || disposed) return
    const fp = localFingerprint()
    if (fp !== lastFp) {
      lastFp = fp
      dirty = true
      schedulePush()
    }
  }, 700)

  // Instant dirty flags when Home/Lists stores mutate (phone edits → desktop).
  const markDirty = () => {
    if (applyingRemote || disposed) return
    dirty = true
    schedulePush()
  }
  const unsubs = [
    useTaskStore.subscribe(markDirty),
    useEventStore.subscribe(markDirty),
    useHabitsStore.subscribe(markDirty),
    useGoalsStore.subscribe(markDirty),
    usePointsStore.subscribe(markDirty),
    useTimeTrackingStore.subscribe(markDirty),
  ]

  const onStorage = (e: StorageEvent) => {
    if (applyingRemote || !e.key) return
    const watched =
      BACKUP_STORES.some((s) => s.key === e.key) || PLAN_PREFIXES.some((p) => e.key!.startsWith(p))
    if (!watched) return
    markDirty()
  }
  window.addEventListener("storage", onStorage)

  return () => {
    disposed = true
    if (pushTimer != null) window.clearTimeout(pushTimer)
    if (pollTimer != null) window.clearInterval(pollTimer)
    if (fpTimer != null) window.clearInterval(fpTimer)
    window.removeEventListener("storage", onStorage)
    for (const u of unsubs) u()
  }
}

export function preferSameOriginSyncUrl(): string {
  const url = guessMobileSyncUrl()
  writeMobileSyncUrl(url)
  return url
}

export function currentLiveSyncUrl(): string {
  return readMobileSyncUrl()
}
