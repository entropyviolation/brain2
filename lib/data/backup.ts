/**
 * lib/data/backup.ts — Full app backup & restore
 *
 * One-click export/import of the *entire* app: every persisted Zustand store
 * plus the day/week/month plan-entry logs. Implemented as a snapshot of
 * the underlying localStorage entries so it round-trips each store's own
 * (de)serialization (including Date encoding) without coupling to internal store
 * shapes. Restoring writes the entries back and rehydrates the live stores.
 * Restoring `brain2-theme-store` also rewrites the `brain2-pcb-mode` pin so the
 * desktop plate matches the snapshot on the next refresh. Restoring
 * `brain2-habits-store` rewrites the LED / tube pins (`brain2-habit-led-tint`,
 * `brain2-habit-grade-tube`, `brain2-habit-output-tube`). Canonical keys are
 * `brain2-*`; `cogs-*` aliases are copied and dual-written, never deleted.
 * Anything else this profile has saved — item history, home layout, friend
 * pins, module notes, navigation, ingested-note ids, and unprefixed relics —
 * rides along in `extras` so a restore does not quietly drop it. Split copies
 * of one vault (`brain2-*` and `cogs-*`, or a plan draft left on the bare
 * `monthPlan-*` key) are folded together so the key restore reads still has
 * every entry. A store the window has hydrated is included even when the last
 * disk write failed. Friend-picture bytes that only exist as `friend-pic:`
 * local copies, or still as `data:image` on the open gallery, are folded into
 * `attachments`. Snapshots stamp
 * `dataProfile`. A Demo file cannot restore onto Live.
 * Restore can replace the whole snapshot, or merge/replace chosen store keys
 * after a preview. Rolling files in `data/recovery-backups/` are a restore
 * source when the dev hub can list that folder.
 *
 * This is the app-wide layer the per-screen JSON exports should defer to
 * (docs/SPEC_MAPPING.md §3.2). Target backend: MongoDB export/import (§3).
 */
import { z } from "zod"
import type { Task, List } from "@/lib/types"
import { useTaskStore } from "@/lib/task-store"
import { getDescendants } from "@/lib/list-tree"
import { useEventStore } from "@/lib/event-store"
import { usePlannedActionStore } from "@/lib/planned-action-store"
import { useGoalsStore } from "@/lib/goals-store"
import { useHabitsStore } from "@/lib/habits-store"
import { usePointsStore } from "@/lib/points-store"
import { useReviewsStore } from "@/lib/reviews-store"
import { useModulesStore } from "@/lib/modules-store"
import { useTimeTrackingStore } from "@/lib/time-tracking-store"
import { getDayNotesPersist, hydrateDayNotesFromStorage } from "@/lib/day-notes-persist"
import { useSleepStore } from "@/lib/sleep-store"
import { useWorkSessionStore } from "@/lib/work-session-store"
import { usePenColorSessionStore } from "@/lib/pen-color-session-store"
import { useListsUiStore } from "@/lib/lists-ui-store"
import { useThemeStore } from "@/lib/theme-store"
import { writeStoredPcbMode } from "@/lib/pcb-backdrop"
import { writeStoredPercentLedTint } from "@/lib/habit-led"
import {
  DEFAULT_GRADE_TUBE_COLOR,
  DEFAULT_OUTPUT_TUBE_COLOR,
  GRADE_TUBE_COLOR_STORAGE_KEY,
  OUTPUT_TUBE_COLOR_STORAGE_KEY,
  writeStoredTubeColor,
} from "@/lib/habit-tube"
import { useUserSettingsStore } from "@/lib/user-settings-store"
import { useItemTypeStore } from "@/lib/item-type-store"
import { useWorkflowsStore } from "@/lib/workflows-store"
import { useModuleDefinitionsStore } from "@/lib/module-definitions"
import { useMetricsStore } from "@/lib/metrics-store"
import { useRegretStore } from "@/lib/regret-store"
import { useIngestStore } from "@/lib/ingest/ingest-store"
import { useBabyAnimalsStore } from "@/lib/baby-animals-store"
import { useHomeWidgetsStore } from "@/lib/home-widgets-store"
import { useHomeWeatherStore } from "@/lib/home-weather-store"
import { useHomeDaysUntilStore } from "@/lib/home-days-until-store"
import { useSunTimesStore } from "@/lib/sun-times-store"
import { useUiNamesStore } from "@/lib/ui-names-store"
import {
  exportAllAttachments,
  importAttachments,
  migrateTaskFileValues,
  migrateTaskImageAttributes,
  replaceAllAttachments,
  type AttachmentExport,
} from "@/lib/attachments"
import { listPersistedDocs, putPersistedDoc, replaceAllPersistedDocs } from "@/lib/doc-persist"
import { hydrateDocumentsFromIdb } from "@/lib/doc-hydrate"
import { parseAppendLog, parseAppendLogDraft, serializeAppendLog } from "@/lib/append-log"
import { isQuotaExceededError, persistErrorMessage, recordPersistFailure } from "@/lib/persist-storage"
import { unionPersistSnapshots } from "@/lib/vault-guard.js"
import { APP_ID, APP_ID_LEGACY, backupDownloadName } from "@/lib/app-brand"
import {
  DATA_PROFILE_KEY,
  DEMO_VAULT_READY_KEY,
  persistKey,
  persistKeyAliases,
  persistSuffix,
  readAliasedLocal,
  writeAliasedLocal,
  samePersistKey,
  twinPersistKey,
  isPlanTextStorageKey,
  persistKeyBelongsToActiveProfile,
  readDataProfile,
  isDemoProfile,
  isDemoPhysicalKey,
  demoPhysicalKey,
} from "@/lib/storage-keys"

const appIdSchema = z.union([z.literal(APP_ID), z.literal(APP_ID_LEGACY)])

/** A persisted store: its localStorage key and a rehydrate trigger. */
interface StoreDescriptor {
  key: string
  rehydrate: (mode: RestoreMode) => void | Promise<void>
}

interface PersistApi {
  getOptions: () => { merge?: (persisted: unknown, current: unknown) => unknown }
  setOptions: (options: { merge?: (persisted: unknown, current: unknown) => unknown }) => void
  rehydrate: () => Promise<void> | void
}

/**
 * Replace must not let the open window's rows win. The task store's persist
 * merge keeps live tasks the file does not have, so a replace looked saved and
 * then painted the newer rows back. On replace, disk fields overwrite; actions
 * stay on the live store.
 */
function persistRehydrate(store: { persist: PersistApi }): (mode: RestoreMode) => Promise<void> {
  return async (mode) => {
    if (mode !== "replace") {
      await store.persist.rehydrate()
      return
    }
    const previous = store.persist.getOptions().merge
    store.persist.setOptions({
      merge: (persisted, current) => ({
        ...(current as object),
        ...((persisted ?? {}) as object),
      }),
    })
    try {
      await store.persist.rehydrate()
    } finally {
      if (previous) store.persist.setOptions({ merge: previous })
    }
  }
}

/** Registry of every persisted store included in a full backup. */
export const BACKUP_STORES: StoreDescriptor[] = [
  { key: persistKey("task-storage"), rehydrate: persistRehydrate(useTaskStore) },
  { key: persistKey("event-storage"), rehydrate: persistRehydrate(useEventStore) },
  { key: persistKey("planned-actions"), rehydrate: persistRehydrate(usePlannedActionStore) },
  { key: persistKey("goals-store"), rehydrate: persistRehydrate(useGoalsStore) },
  { key: persistKey("habits-store"), rehydrate: persistRehydrate(useHabitsStore) },
  { key: "points-store", rehydrate: persistRehydrate(usePointsStore) },
  { key: persistKey("reviews-store"), rehydrate: persistRehydrate(useReviewsStore) },
  { key: persistKey("modules-store"), rehydrate: persistRehydrate(useModulesStore) },
  { key: persistKey("timegrid-store"), rehydrate: persistRehydrate(useTimeTrackingStore) },
  { key: persistKey("tracking-day-notes"), rehydrate: () => hydrateDayNotesFromStorage() },
  { key: persistKey("screentime-prefs"), rehydrate: () => undefined },
  { key: persistKey("sleep-store"), rehydrate: persistRehydrate(useSleepStore) },
  { key: persistKey("work-session"), rehydrate: persistRehydrate(useWorkSessionStore) },
  { key: persistKey("pen-color-session"), rehydrate: persistRehydrate(usePenColorSessionStore) },
  { key: persistKey("lists-ui"), rehydrate: persistRehydrate(useListsUiStore) },
  { key: persistKey("theme-store"), rehydrate: persistRehydrate(useThemeStore) },
  { key: persistKey("user-settings"), rehydrate: persistRehydrate(useUserSettingsStore) },
  { key: persistKey("item-types-store"), rehydrate: persistRehydrate(useItemTypeStore) },
  { key: persistKey("workflows-store"), rehydrate: persistRehydrate(useWorkflowsStore) },
  { key: persistKey("module-definitions"), rehydrate: persistRehydrate(useModuleDefinitionsStore) },
  { key: persistKey("metrics-store"), rehydrate: persistRehydrate(useMetricsStore) },
  { key: "regret-store", rehydrate: persistRehydrate(useRegretStore) },
  { key: persistKey("ingest-store"), rehydrate: persistRehydrate(useIngestStore) },
  { key: persistKey("baby-animals-store"), rehydrate: persistRehydrate(useBabyAnimalsStore) },
  { key: persistKey("home-widgets"), rehydrate: persistRehydrate(useHomeWidgetsStore) },
  { key: persistKey("home-weather"), rehydrate: persistRehydrate(useHomeWeatherStore) },
  { key: persistKey("home-days-until"), rehydrate: persistRehydrate(useHomeDaysUntilStore) },
  { key: persistKey("sun-times"), rehydrate: persistRehydrate(useSunTimesStore) },
  { key: persistKey("ui-names"), rehydrate: persistRehydrate(useUiNamesStore) },
]

/** Human labels for Settings restore preview (same keys as BACKUP_STORES, plus cogs-* aliases). */
export const BACKUP_STORE_LABELS: Record<string, string> = {
  [persistKey("task-storage")]: "Lists & items",
  "cogs-task-storage": "Lists & items",
  [persistKey("event-storage")]: "Plan events",
  "cogs-event-storage": "Plan events",
  [persistKey("planned-actions")]: "Plan day placements",
  "cogs-planned-actions": "Plan day placements",
  [persistKey("goals-store")]: "Goals",
  "cogs-goals-store": "Goals",
  [persistKey("habits-store")]: "Habits",
  "cogs-habits-store": "Habits",
  "points-store": "Points",
  [persistKey("reviews-store")]: "Reviews",
  "cogs-reviews-store": "Reviews",
  [persistKey("modules-store")]: "Modules",
  "cogs-modules-store": "Modules",
  [persistKey("timegrid-store")]: "Tracking",
  "cogs-timegrid-store": "Tracking",
  [persistKey("tracking-day-notes")]: "Tracking day notes",
  "cogs-tracking-day-notes": "Tracking day notes",
  [persistKey("screentime-prefs")]: "Screen Time prefs",
  "cogs-screentime-prefs": "Screen Time prefs",
  [persistKey("sleep-store")]: "Sleep",
  "cogs-sleep-store": "Sleep",
  [persistKey("work-session")]: "Work session",
  "cogs-work-session": "Work session",
  [persistKey("pen-color-session")]: "Pen color session",
  "cogs-pen-color-session": "Pen color session",
  [persistKey("lists-ui")]: "Lists window",
  "cogs-lists-ui": "Lists window",
  [persistKey("theme-store")]: "Window gray & PCB",
  "cogs-theme-store": "Window gray & PCB",
  [persistKey("user-settings")]: "User settings",
  "cogs-user-settings": "User settings",
  [persistKey("item-types-store")]: "Item types",
  "cogs-item-types-store": "Item types",
  [persistKey("workflows-store")]: "Workflows",
  "cogs-workflows-store": "Workflows",
  [persistKey("module-definitions")]: "Module definitions",
  "cogs-module-definitions": "Module definitions",
  [persistKey("metrics-store")]: "Metrics",
  "cogs-metrics-store": "Metrics",
  "regret-store": "Regret",
  [persistKey("ingest-store")]: "Message ingest",
  "cogs-ingest-store": "Message ingest",
  [persistKey("baby-animals-store")]: "Today's friend",
  "cogs-baby-animals-store": "Today's friend",
  [persistKey("home-widgets")]: "Home layout",
  "cogs-home-widgets": "Home layout",
  [persistKey("home-weather")]: "Home weather place",
  "cogs-home-weather": "Home weather place",
  [persistKey("home-days-until")]: "Days Until",
  "cogs-home-days-until": "Days Until",
  [persistKey("sun-times")]: "Sunrise & sunset history",
  "cogs-sun-times": "Sunrise & sunset history",
  [persistKey("ui-names")]: "Names overlay",
  "cogs-ui-names": "Names overlay",
}

export function backupStoreLabel(key: string): string {
  return BACKUP_STORE_LABELS[key] ?? key
}

/** localStorage key prefixes for plan-entry logs (lib/plan-text.ts). */
export const PLAN_TEXT_PREFIXES = ["dayPlan-", "weekPlan-", "monthPlan-"]

export const BACKUP_VERSION = 1 as const

export const backupSchema = z.object({
  app: appIdSchema,
  version: z.number(),
  exportedAt: z.string(),
  /** Which Settings data profile this snapshot was taken from. */
  dataProfile: z.enum(["live", "demo"]).optional(),
  /** Raw persisted store payloads keyed by localStorage key. */
  stores: z.record(z.string(), z.unknown()),
  /** Free-text plan entries keyed by localStorage key. */
  planText: z.record(z.string(), z.string()),
  /** IndexedDB/memory attachment blobs keyed by FileValue id. Optional for older backups. */
  attachments: z
    .record(
      z.string(),
      z.object({
        name: z.string(),
        mime: z.string(),
        dataUrl: z.string(),
      }),
    )
    .optional(),
  /** IndexedDB Docs HTML bodies. Optional for older backups. */
  docs: z
    .array(
      z.object({
        id: z.string(),
        title: z.string(),
        folder: z.string(),
        fontFamily: z.string(),
        status: z.string(),
        body: z.string(),
        createdAt: z.string(),
        updatedAt: z.string(),
      }),
    )
    .optional(),
  /**
   * Every other durable localStorage value for this profile: item history,
   * friend pins, module notes, navigation, ingested-note ids, and the rest.
   * Absent on backups written before this field existed — those must not wipe
   * live extras on restore.
   */
  extras: z.record(z.string(), z.string()).optional(),
})

export type Backup = z.infer<typeof backupSchema>

function isPlanTextKey(key: string): boolean {
  return isPlanTextStorageKey(key)
}

/** Enumerate localStorage keys robustly (works across browsers + jsdom). */
function allLocalStorageKeys(): string[] {
  const keys = new Set<string>()
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i)
    if (key != null) keys.add(key)
  }
  for (const key of Object.keys(localStorage)) keys.add(key)
  return [...keys]
}

/**
 * Not user data. Session pins clear on reload; the profile selector must not
 * flip Live/Demo as a side effect of restore.
 */
const EPHEMERAL_BACKUP_KEYS = new Set([
  DATA_PROFILE_KEY,
  DEMO_VAULT_READY_KEY,
  "brain2-pcb-pick",
  "brain2-led-pick",
])

/** User data that never grew a `brain2-` prefix. */
const BARE_BACKUP_KEYS = new Set([
  "inbox-recent-list-ids",
  "planTextView",
  "weekly-habits-tasks",
  "weekly-habits-weeklyData",
  "weekly-habits-categories",
])

function storeCoversKey(key: string): boolean {
  for (const { key: storeKey } of BACKUP_STORES) {
    if (key === storeKey) return true
    const twin = twinPersistKey(storeKey)
    if (twin != null && key === twin) return true
    // Prefixed twins and demo keys are the same vault. A bare relic
    // (`task-storage`, `friend-worn`) is not — the store read never opens it.
    if (persistSuffix(key) != null && samePersistKey(key, storeKey)) return true
  }
  return false
}

function isFriendPicStorageKey(key: string): boolean {
  return key.includes("friend-pic:")
}

function isEphemeralBackupKey(key: string): boolean {
  if (EPHEMERAL_BACKUP_KEYS.has(key)) return true
  const suffix = persistSuffix(key) ?? key
  return suffix === "last-persist-ok" || suffix === "pcb-pick" || suffix === "led-pick"
}

/**
 * Durable localStorage that is not a registered store and not a plan log.
 * Friend pictures are excluded here — `createFullBackup` folds those bytes
 * into `attachments` so a restore does not also stuff them back into origin quota.
 */
export function isDurableExtraKey(key: string): boolean {
  if (isEphemeralBackupKey(key)) return false
  if (isFriendPicStorageKey(key)) return false
  if (isPlanTextKey(key)) return false
  if (storeCoversKey(key)) return false
  if (!persistKeyBelongsToActiveProfile(key)) return false
  if (key.startsWith("notes-")) return true
  if (BARE_BACKUP_KEYS.has(key)) return !isDemoProfile()
  if (persistSuffix(key) != null) return true
  // Live relics that never grew a prefix (`task-storage`, `friend-worn`, …).
  // Demo does not use them. They are not the vault the app reads, but a full
  // file still carries them so a restore can put the bytes back.
  return !isDemoProfile()
}

function canonicalExtraKey(key: string): string {
  if (persistSuffix(key) == null) return key
  if (isDemoProfile() || isDemoPhysicalKey(key)) return demoPhysicalKey(key)
  return persistKey(key)
}

/** Every other saved key the active profile would lose on a wipe. */
export function collectBackupExtras(): Record<string, string> {
  const extras: Record<string, string> = {}
  const seen = new Set<string>()
  for (const key of allLocalStorageKeys()) {
    if (!isDurableExtraKey(key)) continue
    const canonical = canonicalExtraKey(key)
    if (seen.has(canonical)) continue
    seen.add(canonical)
    const value = persistSuffix(key) != null ? readAliasedLocal(canonical) : localStorage.getItem(key)
    if (value == null || value === "") continue
    extras[canonical] = value
  }
  return extras
}

function mimeFromDataUrl(dataUrl: string): string {
  const match = /^data:([^;,]+)/.exec(dataUrl)
  return match?.[1] || "application/octet-stream"
}

/**
 * Gallery cutouts belong in the attachments vault (`friend_<id>`). A leftover
 * `friend-pic:` localStorage copy is the only bytes when IndexedDB never got
 * them — copy those into the attachment map so restore can bring the picture back.
 */
function foldFriendPicLocalsIntoAttachments(attachments: Record<string, AttachmentExport>): void {
  for (const key of allLocalStorageKeys()) {
    if (!isFriendPicStorageKey(key)) continue
    if (!persistKeyBelongsToActiveProfile(key)) continue
    const raw = localStorage.getItem(key)
    if (raw == null || !raw.startsWith("data:image")) continue
    const marker = "friend-pic:"
    const id = key.slice(key.indexOf(marker) + marker.length)
    if (!id) continue
    const attachId = `friend_${id}`
    if (attachments[attachId]) continue
    attachments[attachId] = {
      name: `${id}.png`,
      mime: mimeFromDataUrl(raw),
      dataUrl: raw,
    }
  }
}

interface LivePersistStore {
  getState: () => object
  persist: {
    hasHydrated: () => boolean
    getOptions: () => { partialize?: (state: object) => unknown; version?: number }
  }
}

/** Open-window snapshot, in the same `{ state, version }` shape Zustand writes. */
function zustandLive(store: LivePersistStore): unknown | null {
  try {
    if (!store.persist.hasHydrated()) return null
  } catch {
    return null
  }
  const options = store.persist.getOptions()
  const partial =
    typeof options.partialize === "function" ? options.partialize(store.getState()) : store.getState()
  try {
    return JSON.parse(JSON.stringify({ state: partial, version: options.version ?? 0 }))
  } catch {
    return null
  }
}

function asLiveStore(store: object): LivePersistStore {
  return store as LivePersistStore
}

const LIVE_STORES: Record<string, LivePersistStore> = {
  [persistKey("task-storage")]: asLiveStore(useTaskStore),
  [persistKey("event-storage")]: asLiveStore(useEventStore),
  [persistKey("planned-actions")]: asLiveStore(usePlannedActionStore),
  [persistKey("goals-store")]: asLiveStore(useGoalsStore),
  [persistKey("habits-store")]: asLiveStore(useHabitsStore),
  "points-store": asLiveStore(usePointsStore),
  [persistKey("reviews-store")]: asLiveStore(useReviewsStore),
  [persistKey("modules-store")]: asLiveStore(useModulesStore),
  [persistKey("timegrid-store")]: asLiveStore(useTimeTrackingStore),
  [persistKey("sleep-store")]: asLiveStore(useSleepStore),
  [persistKey("work-session")]: asLiveStore(useWorkSessionStore),
  [persistKey("pen-color-session")]: asLiveStore(usePenColorSessionStore),
  [persistKey("lists-ui")]: asLiveStore(useListsUiStore),
  [persistKey("theme-store")]: asLiveStore(useThemeStore),
  [persistKey("user-settings")]: asLiveStore(useUserSettingsStore),
  [persistKey("item-types-store")]: asLiveStore(useItemTypeStore),
  [persistKey("workflows-store")]: asLiveStore(useWorkflowsStore),
  [persistKey("module-definitions")]: asLiveStore(useModuleDefinitionsStore),
  [persistKey("metrics-store")]: asLiveStore(useMetricsStore),
  "regret-store": asLiveStore(useRegretStore),
  [persistKey("ingest-store")]: asLiveStore(useIngestStore),
  [persistKey("baby-animals-store")]: asLiveStore(useBabyAnimalsStore),
  [persistKey("home-widgets")]: asLiveStore(useHomeWidgetsStore),
  [persistKey("home-weather")]: asLiveStore(useHomeWeatherStore),
  [persistKey("home-days-until")]: asLiveStore(useHomeDaysUntilStore),
  [persistKey("sun-times")]: asLiveStore(useSunTimesStore),
  [persistKey("ui-names")]: asLiveStore(useUiNamesStore),
}

/**
 * Fold two copies of one vault. The first wins a row both sides have; ids that
 * exist on only one side are kept. `unionPersistSnapshots` knows tombstones and
 * plan drafts; everything else uses the same id-merge as a selective restore.
 */
function mergeVaultRaw(key: string, preferred: string, other: string): string {
  if (preferred === other) return preferred
  const united = unionPersistSnapshots(preferred, other, key)
  if (typeof united === "string") return united
  try {
    return JSON.stringify(mergeUnknown(JSON.parse(preferred), JSON.parse(other)))
  } catch {
    return preferred
  }
}

function readLocalRaw(key: string): string | null {
  try {
    const value = localStorage.getItem(key)
    return value == null || value === "" ? null : value
  } catch {
    return null
  }
}

/** Every prefixed alias of a store (`brain2-*` and `cogs-*`), folded into one blob. */
function readUnionedStoreRaw(key: string): string | null {
  let chosen: string | null = null
  for (const name of persistKeyAliases(key)) {
    const raw = readLocalRaw(name)
    if (raw == null) continue
    chosen = chosen == null ? raw : mergeVaultRaw(key, chosen, raw)
  }
  return chosen
}

function parseStoreRaw(raw: string): unknown {
  try {
    return JSON.parse(raw)
  } catch {
    return raw
  }
}

function draftsTogether(a: string, b: string): string {
  if (!a) return b
  if (!b || a === b || a.includes(b)) return a
  if (b.includes(a)) return b
  return `${a}\n${b}`
}

function unionAppendLog(preferred: string, other: string): string {
  const entries = parseAppendLog(preferred)
  const seen = new Set(entries.map((entry) => entry.id))
  for (const entry of parseAppendLog(other)) {
    if (seen.has(entry.id)) continue
    seen.add(entry.id)
    entries.push(entry)
  }
  return serializeAppendLog(entries, draftsTogether(parseAppendLogDraft(preferred), parseAppendLogDraft(other)))
}

function parseDayNoteMap(raw: string | null): Record<string, string> {
  if (!raw) return {}
  try {
    const parsed = JSON.parse(raw) as unknown
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {}
    const out: Record<string, string> = {}
    for (const [day, text] of Object.entries(parsed)) {
      if (typeof text === "string" && text) out[day] = text
    }
    return out
  } catch {
    return {}
  }
}

function unionDayNoteMaps(preferred: Record<string, string>, other: Record<string, string>): Record<string, string> {
  const out: Record<string, string> = { ...other }
  for (const [day, text] of Object.entries(preferred)) {
    out[day] = out[day] ? unionAppendLog(text, out[day]) : text
  }
  return out
}

function captureDayNotes(diskRaw: string | null): Record<string, string> | null {
  let map = parseDayNoteMap(diskRaw)
  for (const name of persistKeyAliases(persistKey("tracking-day-notes"))) {
    map = unionDayNoteMaps(map, parseDayNoteMap(readLocalRaw(name)))
  }
  map = unionDayNoteMaps(getDayNotesPersist(), map)
  return Object.keys(map).length > 0 ? map : null
}

function captureStore(key: string): unknown | null {
  if (samePersistKey(key, persistKey("tracking-day-notes"))) return captureDayNotes(readUnionedStoreRaw(key))
  const diskRaw = readUnionedStoreRaw(key)
  const live = LIVE_STORES[key] ? zustandLive(LIVE_STORES[key]) : null
  if (live == null) return diskRaw == null ? null : parseStoreRaw(diskRaw)
  if (diskRaw == null) return live
  return parseStoreRaw(mergeVaultRaw(key, JSON.stringify(live), diskRaw))
}

function canonicalPlanStorageKey(key: string): string {
  const bare = persistSuffix(key) ?? key
  return isDemoProfile() ? demoPhysicalKey(bare) : persistKey(bare)
}

/**
 * Plan logs: keep every physical key, and write the union onto the canonical
 * key the app reads. A draft left only on bare `monthPlan-*` used to survive
 * in the file and then disappear on restore, because a non-empty `brain2-*`
 * copy wins the read and never looks at the bare key.
 */
function collectPlanText(): Record<string, string> {
  const planText: Record<string, string> = {}
  const grouped = new Map<string, string[]>()
  for (const key of allLocalStorageKeys()) {
    if (!isPlanTextKey(key)) continue
    if (!persistKeyBelongsToActiveProfile(key)) continue
    const value = readLocalRaw(key)
    if (value == null) continue
    planText[key] = value
    const canon = canonicalPlanStorageKey(key)
    const list = grouped.get(canon) ?? []
    list.push(value)
    grouped.set(canon, list)
  }
  for (const [canon, raws] of grouped) {
    let united = raws[0] ?? ""
    for (const extra of raws.slice(1)) united = unionAppendLog(united, extra)
    if (united) planText[canon] = united
  }
  return planText
}

/** Build a full backup object from the current localStorage state. */
export function createBackup(): Backup {
  const stores: Record<string, unknown> = {}
  for (const { key } of BACKUP_STORES) {
    const payload = captureStore(key)
    if (payload == null) continue
    stores[key] = payload
  }

  const planText = collectPlanText()

  return {
    app: APP_ID,
    version: BACKUP_VERSION,
    exportedAt: new Date().toISOString(),
    dataProfile: readDataProfile(),
    stores,
    planText,
    extras: collectBackupExtras(),
    attachments: undefined,
  }
}

/**
 * Gallery cutouts still sitting on the open window as `data:image` (the
 * persist copy already points at `friend:<id>`). Export those bytes with the
 * file even if IndexedDB never accepted them.
 */
function foldLiveFriendDataUrls(attachments: Record<string, AttachmentExport>): void {
  const photos = useBabyAnimalsStore.getState().photos ?? []
  for (const photo of photos) {
    if (!photo?.id) continue
    const urls = [photo.uri, photo.sourceUrl].filter(
      (value): value is string => typeof value === "string" && value.startsWith("data:image"),
    )
    const attachId = `friend_${photo.id}`
    if (attachments[attachId] || urls.length === 0) continue
    const dataUrl = urls[0]
    attachments[attachId] = {
      name: `${photo.id}.png`,
      mime: mimeFromDataUrl(dataUrl),
      dataUrl,
    }
  }
}

/** Full backup including IndexedDB attachment bytes (for export / device sync). */
export async function createFullBackup(): Promise<Backup> {
  const backup = createBackup()
  backup.attachments = await exportAllAttachments()
  foldFriendPicLocalsIntoAttachments(backup.attachments)
  foldLiveFriendDataUrls(backup.attachments)
  backup.docs = await listPersistedDocs()
  return backup
}

/** Stable identity of a backup for round-trip tests (store keys + attachment ids). */
export function backupFingerprint(backup: Backup): {
  stores: string[]
  attachments: string[]
  planText: string[]
  extras: string[]
} {
  return {
    stores: Object.keys(backup.stores).sort(),
    attachments: Object.keys(backup.attachments ?? {}).sort(),
    planText: Object.keys(backup.planText).sort(),
    extras: Object.keys(backup.extras ?? {}).sort(),
  }
}

/** Serialize a backup to a pretty JSON string. */
export function serializeBackup(backup: Backup = createBackup()): string {
  return JSON.stringify(backup, null, 2)
}

/** Parse + validate a backup JSON string (throws on invalid shape). */
export function parseBackup(json: string): Backup {
  const data = JSON.parse(json)
  return backupSchema.parse(data)
}

export type RestoreMode = "merge" | "replace"

/**
 * Choose what to write. Omit the whole object for the historical full replace
 * (every store in the file, plan text cleared then rewritten, attachments/docs
 * and extras replaced). Pass `storeKeys` for a selective restore: unselected
 * stores, plan entries, and extras stay as they are unless opted in.
 */
export interface RestoreBackupOptions {
  storeKeys?: string[]
  planText?: boolean
  attachments?: boolean
  docs?: boolean
  /** Other saved keys (`extras`). Defaults on for a full restore, off for a selective one. */
  extras?: boolean
  mode?: RestoreMode
}

export type BackupStorePreview = {
  key: string
  label: string
  present: boolean
}

export type BackupPreview = {
  exportedAt: string
  stores: BackupStorePreview[]
  planText: { present: boolean; keys: number }
  attachments: { present: boolean; count: number }
  docs: { present: boolean; count: number }
  extras: { present: boolean; keys: number }
}

/** Which registered stores (and extras) a backup file actually contains. */
export function previewBackup(backup: Backup): BackupPreview {
  const present = new Set(Object.keys(backup.stores))
  return {
    exportedAt: backup.exportedAt,
    stores: BACKUP_STORES.map(({ key }) => ({
      key,
      label: backupStoreLabel(key),
      present: present.has(key) || (twinPersistKey(key) != null && present.has(twinPersistKey(key)!)),
    })),
    planText: {
      present: Object.keys(backup.planText).length > 0,
      keys: Object.keys(backup.planText).length,
    },
    attachments: {
      present: Object.keys(backup.attachments ?? {}).length > 0,
      count: Object.keys(backup.attachments ?? {}).length,
    },
    docs: {
      present: (backup.docs?.length ?? 0) > 0,
      count: backup.docs?.length ?? 0,
    },
    extras: {
      present: Object.keys(backup.extras ?? {}).length > 0,
      keys: Object.keys(backup.extras ?? {}).length,
    },
  }
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function mergeIdArrays(existing: unknown[], incoming: unknown[]): unknown[] {
  const byId = new Map<string, unknown>()
  const rest: unknown[] = []
  const take = (item: unknown, overwrite: boolean) => {
    if (isPlainObject(item) && typeof item.id === "string") {
      if (overwrite || !byId.has(item.id)) byId.set(item.id, item)
      return
    }
    rest.push(item)
  }
  for (const item of existing) take(item, true)
  for (const item of incoming) take(item, false)
  return [...byId.values(), ...rest]
}

function mergeUnknown(existing: unknown, incoming: unknown): unknown {
  if (Array.isArray(existing) && Array.isArray(incoming)) {
    return mergeIdArrays(existing, incoming)
  }
  if (isPlainObject(existing) && isPlainObject(incoming)) {
    const out: Record<string, unknown> = { ...existing }
    for (const [key, value] of Object.entries(incoming)) {
      if (!(key in out)) out[key] = value
      else out[key] = mergeUnknown(out[key], value)
    }
    return out
  }
  return existing
}

/**
 * Combine two Zustand persist blobs. Merge keeps existing ids/keys and adds
 * incoming ones that are new. Replace is a straight overwrite (caller can
 * skip this and write the backup payload).
 */
export function mergePersistPayload(existingRaw: string | null, incoming: unknown): string {
  const incomingSerialized = typeof incoming === "string" ? incoming : JSON.stringify(incoming)
  if (existingRaw == null) return incomingSerialized
  let existing: unknown
  let next: unknown
  try {
    existing = JSON.parse(existingRaw)
  } catch {
    return incomingSerialized
  }
  try {
    next = typeof incoming === "string" ? JSON.parse(incoming) : incoming
  } catch {
    return incomingSerialized
  }
  return JSON.stringify(mergeUnknown(existing, next))
}

function serializeStorePayload(payload: unknown): string {
  return typeof payload === "string" ? payload : JSON.stringify(payload)
}

/**
 * A task that is in the snapshot is not deleted. Merge used to keep the live
 * `removedTaskIds` tombstone and then rehydrate threw the restored row away.
 */
function dropTombstonesForPresentTasks(serialized: string): string {
  try {
    const blob = JSON.parse(serialized) as {
      state?: { tasks?: { id?: string }[]; removedTaskIds?: string[] }
    }
    const tasks = blob.state?.tasks
    const removed = blob.state?.removedTaskIds
    if (!Array.isArray(tasks) || !Array.isArray(removed)) return serialized
    const ids = new Set(tasks.map((task) => task?.id).filter((id): id is string => typeof id === "string"))
    const next = removed.filter((id) => !ids.has(id))
    if (next.length === removed.length) return serialized
    blob.state!.removedTaskIds = next
    return JSON.stringify(blob)
  } catch {
    return serialized
  }
}

/**
 * The task store's rehydrate merge unions live tombstones with the file.
 * Clearing them on the in-memory state (no persist write) lets a restored row stay.
 */
function forgetLiveTaskTombstones(serialized: string): void {
  try {
    const blob = JSON.parse(serialized) as { state?: { tasks?: { id?: string }[] } }
    const tasks = blob.state?.tasks
    if (!Array.isArray(tasks)) return
    const ids = new Set(tasks.map((task) => task?.id).filter((id): id is string => typeof id === "string"))
    const live = useTaskStore.getState()
    if (!Array.isArray(live.removedTaskIds)) return
    const next = live.removedTaskIds.filter((id) => !ids.has(id))
    if (next.length === live.removedTaskIds.length) return
    live.removedTaskIds = next
  } catch {
    /* the written blob still has the rows; rehydrate will read it */
  }
}

function writeLocalStorage(key: string, value: string): void {
  try {
    if (persistSuffix(key) != null) writeAliasedLocal(key, value)
    else localStorage.setItem(key, value)
  } catch (error) {
    recordPersistFailure(error)
    const reason = isQuotaExceededError(error)
      ? persistErrorMessage(error)
      : error instanceof Error
        ? error.message
        : "Unknown error"
    throw new Error(`Restore failed while writing ${key}: ${reason}`)
  }
}

/**
 * Restore a backup. With no options this is a full replace (mobile hub / old
 * callers). With `storeKeys`, only those stores are written; `mode: "merge"`
 * keeps live ids and adds missing records from the backup.
 */
export async function restoreBackup(
  backup: Backup,
  options?: RestoreBackupOptions,
): Promise<{ stores: number; planText: number; extras: number }> {
  const validKeys = new Set(BACKUP_STORES.map((s) => s.key))
  if (backup.dataProfile === "demo" && !isDemoProfile()) {
    throw new Error("This snapshot is the Demo profile. Switch to Demo in Settings before restoring so Live data stays untouched.")
  }
  if (backup.dataProfile === "live" && isDemoProfile()) {
    throw new Error("This snapshot is the Live profile. Switch to Live in Settings before restoring so the Demo sandbox stays separate.")
  }
  const selective = options?.storeKeys != null
  const mode: RestoreMode = options?.mode ?? "replace"
  const storeKeys = (options?.storeKeys ?? Object.keys(backup.stores))
    .map((key) => persistKey(key))
    .filter((key) => validKeys.has(key))
  const includePlanText = options?.planText ?? !selective
  const includeAttachments = options?.attachments ?? !selective
  const includeDocs = options?.docs ?? !selective
  const includeExtras = options?.extras ?? !selective
  const storeKeySet = new Set(storeKeys)

  if (includePlanText && mode === "replace") {
    allLocalStorageKeys()
      .filter(isPlanTextKey)
      .forEach((key) => localStorage.removeItem(key))
  }

  let extraCount = 0
  if (includeExtras && backup.extras) {
    if (mode === "replace") {
      const kept = new Set(Object.keys(backup.extras))
      for (const key of allLocalStorageKeys()) {
        if (!isDurableExtraKey(key)) continue
        const canonical = canonicalExtraKey(key)
        if (kept.has(key) || kept.has(canonical)) continue
        try {
          localStorage.removeItem(key)
        } catch {
          /* a key we cannot drop still gets overwritten below when it is in the file */
        }
      }
    }
    for (const [key, value] of Object.entries(backup.extras)) {
      if (typeof value !== "string") continue
      if (!isDurableExtraKey(key)) continue
      if (mode === "merge") {
        const existing = persistSuffix(key) != null ? readAliasedLocal(key) : localStorage.getItem(key)
        if (existing != null) continue
      }
      writeLocalStorage(key, value)
      extraCount++
    }
  }

  let storeCount = 0
  for (const [key, payload] of Object.entries(backup.stores)) {
    const canon = persistKey(key)
    if (!storeKeySet.has(canon)) continue
    const serialized =
      mode === "merge" ? mergePersistPayload(readAliasedLocal(canon), payload) : serializeStorePayload(payload)
    const toWrite = samePersistKey(canon, persistKey("task-storage"))
      ? dropTombstonesForPresentTasks(serialized)
      : serialized
    writeLocalStorage(canon, toWrite)
    if (samePersistKey(canon, persistKey("task-storage"))) forgetLiveTaskTombstones(toWrite)
    if (samePersistKey(canon, persistKey("habits-store"))) {
      try {
        const parsed = JSON.parse(serialized) as {
          state?: {
            percentLedTint?: unknown
            gradeTubeColor?: unknown
            outputGradeTubeColor?: unknown
          }
        }
        const s = parsed.state
        if (s?.percentLedTint != null) writeStoredPercentLedTint(s.percentLedTint)
        if (s?.gradeTubeColor != null) {
          writeStoredTubeColor(GRADE_TUBE_COLOR_STORAGE_KEY, s.gradeTubeColor, DEFAULT_GRADE_TUBE_COLOR)
        }
        if (s?.outputGradeTubeColor != null) {
          writeStoredTubeColor(OUTPUT_TUBE_COLOR_STORAGE_KEY, s.outputGradeTubeColor, DEFAULT_OUTPUT_TUBE_COLOR)
        }
      } catch {
        /* pin follows the habits blob when the JSON is readable */
      }
    }
    if (samePersistKey(canon, persistKey("theme-store"))) {
      try {
        const parsed = JSON.parse(serialized) as { state?: { pcbMode?: unknown } }
        if (parsed.state?.pcbMode != null) writeStoredPcbMode(parsed.state.pcbMode)
      } catch {
        /* pin follows the theme blob when the JSON is readable */
      }
    }
    storeCount++
  }

  let planCount = 0
  if (includePlanText) {
    for (const [key, value] of Object.entries(backup.planText)) {
      if (!isPlanTextKey(key)) continue
      if (!persistKeyBelongsToActiveProfile(key) && isDemoPhysicalKey(key)) continue
      if (mode === "merge" && localStorage.getItem(key) != null) continue
      writeLocalStorage(key, value)
      planCount++
    }
  }

  const incomingCanon = new Set(Object.keys(backup.stores).map((key) => persistKey(key)))
  const touched = BACKUP_STORES.filter((s) => storeKeySet.has(s.key) && incomingCanon.has(s.key))
  await Promise.all((selective ? touched : BACKUP_STORES).map((s) => s.rehydrate(mode)))

  const attachments = backup.attachments
  if (includeAttachments) {
    if (attachments && Object.keys(attachments).length > 0) {
      const rec = attachments as Record<string, AttachmentExport>
      if (mode === "replace") await replaceAllAttachments(rec)
      else await importAttachments(rec)
    } else if (!selective) {
      const files = await migrateTaskFileValues(useTaskStore.getState().tasks)
      const images = await migrateTaskImageAttributes(files.tasks)
      if (files.migrated + images.migrated > 0) useTaskStore.setState({ tasks: images.tasks })
    }
  }

  if (includeDocs && backup.docs && backup.docs.length > 0) {
    if (mode === "replace") {
      await replaceAllPersistedDocs(backup.docs)
    } else {
      const existing = new Set((await listPersistedDocs()).map((doc) => doc.id))
      for (const doc of backup.docs) {
        if (!existing.has(doc.id)) await putPersistedDoc(doc)
      }
    }
    await hydrateDocumentsFromIdb()
  }

  return { stores: storeCount, planText: planCount, extras: extraCount }
}

export const RECOVERY_BACKUPS_DIR = "data/recovery-backups"
export const RECOVERY_BACKUPS_API = "/api/recovery-backups"

export type RecoveryBackupInfo = {
  name: string
  exportedAt: string | null
  storeKeys: string[]
  planTextKeys: number
  bytes: number
}

/** JSON snapshots only; no path separators. */
export function isSafeRecoveryBackupName(name: string): boolean {
  return /^[A-Za-z0-9][A-Za-z0-9._-]*\.json$/.test(name) && !name.includes("..")
}

export function recoveryBackupInfoFromJson(name: string, json: string, bytes: number): RecoveryBackupInfo | null {
  if (!isSafeRecoveryBackupName(name)) return null
  try {
    const backup = parseBackup(json)
    return {
      name,
      exportedAt: backup.exportedAt ?? null,
      storeKeys: Object.keys(backup.stores).sort(),
      planTextKeys: Object.keys(backup.planText).length,
      bytes,
    }
  } catch {
    return null
  }
}

export type RecoveryBackupListing = {
  exists: boolean
  backups: RecoveryBackupInfo[]
}

function recoveryBackupsUrl(name?: string): string {
  const origin = typeof window !== "undefined" && window.location?.origin ? window.location.origin : ""
  const base = `${origin}${RECOVERY_BACKUPS_API}`
  return name ? `${base}/${encodeURIComponent(name)}` : base
}

/**
 * Read-only listing of `data/recovery-backups/` via the dev hub.
 * Missing folder or hub → `{ exists: false }` so Settings can hide the section.
 */
export async function listRecoveryBackups(): Promise<RecoveryBackupListing> {
  if (typeof fetch === "undefined") return { exists: false, backups: [] }
  try {
    const res = await fetch(recoveryBackupsUrl(), { headers: { Accept: "application/json" } })
    if (res.status === 404) return { exists: false, backups: [] }
    if (!res.ok) return { exists: false, backups: [] }
    const data = (await res.json()) as { exists?: boolean; backups?: RecoveryBackupInfo[] }
    const backups = Array.isArray(data.backups) ? data.backups.filter((row) => isSafeRecoveryBackupName(row.name)) : []
    return { exists: data.exists === true, backups }
  } catch {
    return { exists: false, backups: [] }
  }
}

/** Load one recovery snapshot (read-only). Throws on a bad name or invalid JSON. */
export async function loadRecoveryBackup(name: string): Promise<Backup> {
  if (!isSafeRecoveryBackupName(name)) throw new Error("Invalid recovery backup name")
  const res = await fetch(recoveryBackupsUrl(name), { headers: { Accept: "application/json" } })
  if (!res.ok) throw new Error("Recovery backup not found")
  const text = await res.text()
  return parseBackup(text)
}

// ---------------------------------------------------------------------------
// Per-category export / import (Feature 8 + HM4, Worker H)
//
// A focused serializer for a single list *and its sublists* (nested via
// `parentListId`) plus every task filed into any of those lists. Unlike the
// whole-app backup above, this is a portable subtree you can hand to another
// list/vault. Tasks are matched by membership in `Task.lists`.
// ---------------------------------------------------------------------------

export const CATEGORY_EXPORT_VERSION = 1 as const

export const categoryExportSchema = z.object({
  app: appIdSchema,
  kind: z.literal("category"),
  version: z.number(),
  exportedAt: z.string(),
  /** The root list followed by its descendant sublists. */
  lists: z.array(z.record(z.string(), z.unknown())).optional(),
  /** Legacy key (pre category→list migration). */
  categories: z.array(z.record(z.string(), z.unknown())).optional(),
  /** Tasks belonging to any exported list. */
  tasks: z.array(z.record(z.string(), z.unknown())),
})

export interface CategoryExport {
  app: typeof APP_ID | typeof APP_ID_LEGACY
  kind: "category"
  version: number
  exportedAt: string
  lists: List[]
  tasks: Task[]
}

/** Build a per-list export object (list subtree + member tasks). */
export function buildCategoryExport(categoryId: string): CategoryExport | null {
  const { lists, tasks } = useTaskStore.getState()
  const root = lists.find((c) => c.id === categoryId)
  if (!root) return null

  const subtree = [root, ...getDescendants(lists, categoryId)]
  const exportedIds = new Set(subtree.map((c) => c.id))
  const memberTasks = tasks.filter((t) => (t.lists ?? []).some((id) => exportedIds.has(id)))

  return {
    app: APP_ID,
    kind: "category",
    version: CATEGORY_EXPORT_VERSION,
    exportedAt: new Date().toISOString(),
    lists: subtree,
    tasks: memberTasks,
  }
}

/** Serialize a single category subtree to a pretty JSON string. */
export function exportCategory(categoryId: string): string | null {
  const data = buildCategoryExport(categoryId)
  return data ? JSON.stringify(data, null, 2) : null
}

function reviveDate(value: unknown): Date | undefined {
  if (value == null) return undefined
  const d = new Date(value as string)
  return Number.isNaN(d.getTime()) ? undefined : d
}

function reviveCategory(raw: any): List {
  // Tolerate legacy exports that still key the parent as `parentCategoryId`.
  const { parentCategoryId, ...rest } = raw
  return {
    ...rest,
    ...(parentCategoryId !== undefined ? { parentListId: parentCategoryId } : {}),
    createdAt: reviveDate(raw.createdAt) ?? new Date(),
  } as List
}

function reviveTask(raw: any): Task {
  // Tolerate legacy exports that still key lifecycle/membership as
  // `category`/`categories` (renamed to `stage`/`lists`).
  const { category, categories, ...rest } = raw
  return {
    ...rest,
    stage: raw.stage ?? category,
    lists: raw.lists ?? categories ?? [],
    createdAt: reviveDate(raw.createdAt) ?? new Date(),
    deadline: reviveDate(raw.deadline),
    scheduledDate: reviveDate(raw.scheduledDate),
  } as Task
}

/** Parse + validate a per-category export JSON string (throws on bad shape). */
export function parseCategoryExport(json: string): CategoryExport {
  const data = categoryExportSchema.parse(JSON.parse(json))
  // Tolerate legacy exports that key the list subtree as `categories`.
  const rawLists = (data.lists ?? data.categories ?? []) as unknown as List[]
  return {
    ...data,
    app: data.app,
    kind: "category",
    lists: rawLists.map(reviveCategory),
    tasks: (data.tasks as unknown as Task[]).map(reviveTask),
  }
}

/**
 * Import a per-category export into the live task store.
 * - `"merge"` (default): add categories/tasks whose ids are new; existing ids
 *   are left untouched.
 * - `"replace"`: overwrite categories/tasks that share an id with the import.
 * Dates are revived from ISO strings. Returns the counts written.
 */
export function importCategory(
  data: CategoryExport,
  mode: "merge" | "replace" = "merge",
): { lists: number; tasks: number } {
  const store = useTaskStore.getState()
  const categories = data.lists.map(reviveCategory)
  const tasks = data.tasks.map(reviveTask)

  const existingCategoryIds = new Set(store.lists.map((c) => c.id))
  const existingTaskIds = new Set(store.tasks.map((t) => t.id))

  for (const category of categories) {
    if (existingCategoryIds.has(category.id)) {
      if (mode === "replace") store.updateList(category)
    } else {
      store.addList(category)
    }
  }
  for (const task of tasks) {
    if (existingTaskIds.has(task.id)) {
      if (mode === "replace") store.updateTask(task)
    } else {
      store.addTask(task)
    }
  }

  return { lists: categories.length, tasks: tasks.length }
}

/** Trigger a browser download of a single category subtree as JSON. */
export function downloadCategoryExport(categoryId: string, filename?: string): void {
  const json = exportCategory(categoryId)
  if (json == null) return
  const name = filename ?? backupDownloadName("category", `${categoryId}-${new Date().toISOString().split("T")[0]}`)
  const blob = new Blob([json], { type: "application/json" })
  const url = URL.createObjectURL(blob)
  const link = document.createElement("a")
  link.href = url
  link.download = name
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}

/** Trigger a browser download of the current backup as a JSON file. */
export async function downloadBackup(filename?: string): Promise<void> {
  const name = filename ?? backupDownloadName("backup", new Date().toISOString().split("T")[0])
  const blob = new Blob([JSON.stringify(await createFullBackup(), null, 2)], { type: "application/json" })
  const url = URL.createObjectURL(blob)
  const link = document.createElement("a")
  link.href = url
  link.download = name
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}

