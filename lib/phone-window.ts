/**
 * lib/phone-window.ts — The phone's memory window onto the Mac vault.
 *
 * After login the shell fetches `GET {hub}/api/persist?canon=1`, keeps one
 * `brain2-*` key in memory, and rehydrates the Zustand stores from that map.
 * Nothing vault-sized is written to localStorage. A later save of a store the
 * hub can patch is an outbox row, flushed only after the Mac has answered.
 * Demo profile never calls the hub. Electron and a desktop browser never
 * engage this module.
 */
import { isPhoneWebStorage } from "@/lib/phone-device"
import {
  deleteOutbox,
  enqueueOutbox,
  listOutbox,
  readLaunchCache,
  writeLaunchCache,
  type PhoneOutboxRow,
  type PhonePatch,
  resetPhoneWindowCacheForTests,
} from "@/lib/phone-window-cache"
import { isDemoProfile, isPlanTextStorageKey } from "@/lib/storage-keys"

export type PhoneWindowStatus = "idle" | "loading" | "live" | "stale" | "offline"

const PIN_SUFFIXES = ["mobile-sync-url", "nfc-hub", "nfc-chips"]

const PATCH_STORES = new Set([
  "task-storage",
  "timegrid-store",
  "planned-actions",
  "ingest-store",
  "telegram-feed",
  "habits-store",
  "sleep-store",
  "goals-store",
])

type Collection = {
  field: string
  tombstone?: string
  /** `map` is a date-keyed object. `cells` is bucket → habit id → completion. */
  shape?: "rows" | "map" | "cells"
  /** New ids land here when this matches. Existing ids stay in the array that already holds them. */
  claim?: (row: Record<string, unknown>) => boolean
}

const HABIT_CELL_FIELDS = ["weeklyData", "weeklyHabitData", "monthlyHabitData", "quarterlyHabitData"] as const

function goalShaped(row: Record<string, unknown>): boolean {
  if ("objectiveIds" in row || "periodKind" in row || "target" in row || "current" in row) return true
  return row.type === "numerical" || row.type === "boolean" || row.type === "count"
}

function categoryShaped(row: Record<string, unknown>): boolean {
  if ("frequency" in row || "type" in row || "goal" in row || "rewardValue" in row) return false
  return typeof row.color === "string" && typeof row.name === "string"
}

const COLLECTIONS: Record<string, Collection[]> = {
  "task-storage": [
    { field: "tasks", tombstone: "removedTaskIds" },
    { field: "lists", tombstone: "removedListIds" },
    { field: "folders" },
  ],
  "timegrid-store": [
    { field: "entries", tombstone: "removedEntryIds" },
    { field: "tags" },
  ],
  "planned-actions": [{ field: "actions" }],
  "ingest-store": [{ field: "events" }],
  "telegram-feed": [{ field: "rows" }],
  "habits-store": [
    { field: "categories", claim: categoryShaped },
    { field: "tasks" },
    { field: "weeklyData", shape: "cells" },
    { field: "weeklyHabitData", shape: "cells" },
    { field: "monthlyHabitData", shape: "cells" },
    { field: "quarterlyHabitData", shape: "cells" },
  ],
  "sleep-store": [{ field: "nights", shape: "map" }],
  "goals-store": [
    { field: "goals", claim: goalShaped },
    { field: "objectives", claim: (row) => !goalShaped(row) },
  ],
  plan: [{ field: "entries" }],
}

const REHYDRATE: Record<string, () => Promise<unknown>> = {
  "task-storage": () => import("@/lib/task-store").then((m) => m.useTaskStore.persist.rehydrate()),
  "habits-store": () => import("@/lib/habits-store").then((m) => m.useHabitsStore.persist.rehydrate()),
  "goals-store": () => import("@/lib/goals-store").then((m) => m.useGoalsStore.persist.rehydrate()),
  "sleep-store": () => import("@/lib/sleep-store").then((m) => m.useSleepStore.persist.rehydrate()),
  "user-settings": () => import("@/lib/user-settings-store").then((m) => m.useUserSettingsStore.persist.rehydrate()),
  "theme-store": () => import("@/lib/theme-store").then((m) => m.useThemeStore.persist.rehydrate()),
  "timegrid-store": () => import("@/lib/time-tracking-store").then((m) => m.useTimeTrackingStore.persist.rehydrate()),
  kitchen: () => import("@/lib/kitchen-store").then((m) => m.useKitchenStore.persist.rehydrate()),
  "item-types-store": () => import("@/lib/item-type-store").then((m) => m.useItemTypeStore.persist.rehydrate()),
  wardrobe: () => import("@/lib/wardrobe").then((m) => m.useWardrobeStore.persist.rehydrate()),
  "planned-actions": () => import("@/lib/planned-action-store").then((m) => m.usePlannedActionStore.persist.rehydrate()),
  "ingest-store": () => import("@/lib/ingest/ingest-store").then((m) => m.useIngestStore.persist.rehydrate()),
  "telegram-feed": () => import("@/lib/ingest/telegram-feed-store").then((m) => m.useTelegramFeedStore.persist.rehydrate()),
}

const memory = new Map<string, string>()
const listeners = new Set<() => void>()
const inflight = new Set<string>()
const acked = new Set<string>()

let engaged = false
let macAnswered = false
let acceptPatches = true
let status: PhoneWindowStatus = "idle"
/** The step in flight, or why the last load missed. Shown on the phone so a failure names itself. */
let detail: string | null = null
let hubUrl = ""
let loadGen = 0
let outboxTail: Promise<void> = Promise.resolve()

export function isPhonePinKey(name: string): boolean {
  if (name === "brain2-data-profile" || name === "data-profile") return true
  return PIN_SUFFIXES.some((suffix) => name === suffix || name.endsWith(`-${suffix}`))
}

export function engagePhoneWindow(): void {
  if (!isPhoneWebStorage() || isDemoProfile()) return
  engaged = true
}

export function phoneWindowEngaged(): boolean {
  return engaged && isPhoneWebStorage() && !isDemoProfile()
}

export function getPhoneWindowSnapshot(): { status: PhoneWindowStatus; detail: string | null } {
  return { status, detail }
}

export function phoneWindowNote(next: PhoneWindowStatus = status): string | null {
  const why = detail ? ` ${detail}` : ""
  if (next === "offline") return `Can't reach the Mac.${why}`
  if (next === "stale") return `Saved copy. The Mac has not answered.${why}`
  if (next === "loading") return `Loading from the Mac…${why}`
  if (next === "idle" && detail) return detail
  return null
}

export function subscribePhoneWindow(listener: () => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

function emit() {
  for (const listener of listeners) listener()
}

function setStatus(next: PhoneWindowStatus) {
  status = next
  emit()
}

function setDetail(next: string | null) {
  detail = next
  emit()
}

function errorText(err: unknown): string {
  if (err instanceof Error) return err.message ? `${err.name}: ${err.message}` : err.name
  return String(err)
}

function hostOf(url: string): string {
  try {
    return new URL(url).host
  } catch {
    return url
  }
}

function canonicalWindowKey(name: string): string {
  if (name.startsWith("cogs-")) return `brain2-${name.slice(5)}`
  return name
}

function bareVault(name: string): string {
  const canon = canonicalWindowKey(name)
  if (canon.startsWith("brain2-demo-")) return canon.slice("brain2-demo-".length)
  if (canon.startsWith("brain2-")) return canon.slice("brain2-".length)
  return canon
}

export function readPhoneWindowItem(name: string): string | null {
  if (!name) return null
  const canon = canonicalWindowKey(name)
  const direct = memory.get(name) ?? memory.get(canon)
  if (direct != null && direct !== "") return direct
  if (canon.startsWith("brain2-")) {
    const legacy = memory.get(`cogs-${canon.slice(7)}`)
    if (legacy != null && legacy !== "") return legacy
  }
  return null
}

export function removePhoneWindowItem(name: string): void {
  const canon = canonicalWindowKey(name)
  memory.delete(name)
  memory.delete(canon)
  if (canon.startsWith("brain2-")) memory.delete(`cogs-${canon.slice(7)}`)
}

function vaultPatchAllowed(name: string): boolean {
  const bare = bareVault(name)
  if (PATCH_STORES.has(bare)) return true
  return isPlanTextStorageKey(name) || isPlanTextStorageKey(bare)
}

function collectionsFor(name: string): Collection[] {
  const bare = bareVault(name)
  if (COLLECTIONS[bare]) return COLLECTIONS[bare]
  if (isPlanTextStorageKey(name) || isPlanTextStorageKey(bare)) return COLLECTIONS.plan
  return []
}

function unwrapState(parsed: unknown): Record<string, unknown> | null {
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return null
  const obj = parsed as Record<string, unknown>
  const state = obj.state
  if (state && typeof state === "object" && !Array.isArray(state)) return state as Record<string, unknown>
  return obj
}

function rowId(row: unknown): string | null {
  if (!row || typeof row !== "object" || Array.isArray(row)) return null
  const id = (row as { id?: unknown }).id
  return typeof id === "string" && id ? id : null
}

function sameJson(a: unknown, b: unknown): boolean {
  if (Object.is(a, b)) return true
  if (typeof a !== "object" || typeof b !== "object" || a == null || b == null) return false
  try {
    return JSON.stringify(a) === JSON.stringify(b)
  } catch {
    return false
  }
}

function indexRows(value: unknown): Map<string, Record<string, unknown>> {
  const out = new Map<string, Record<string, unknown>>()
  if (!Array.isArray(value)) return out
  for (const row of value) {
    const id = rowId(row)
    if (!id) continue
    out.set(id, row as Record<string, unknown>)
  }
  return out
}

function indexMap(value: unknown): Map<string, Record<string, unknown>> {
  const out = new Map<string, Record<string, unknown>>()
  if (!value || typeof value !== "object" || Array.isArray(value)) return out
  for (const [key, row] of Object.entries(value as Record<string, unknown>)) {
    if (!row || typeof row !== "object" || Array.isArray(row)) continue
    out.set(key, row as Record<string, unknown>)
  }
  return out
}

function habitCellId(field: string, bucket: string, habitId: string): string {
  return `cell:${field}:${bucket}:${habitId}`
}

function parseHabitCellId(id: string): { field: string; bucket: string; habitId: string } | null {
  if (!id.startsWith("cell:")) return null
  const rest = id.slice(5)
  for (const field of HABIT_CELL_FIELDS) {
    const prefix = `${field}:`
    if (!rest.startsWith(prefix)) continue
    const tail = rest.slice(prefix.length)
    const cut = tail.indexOf(":")
    if (cut <= 0 || cut >= tail.length - 1) return null
    return { field, bucket: tail.slice(0, cut), habitId: tail.slice(cut + 1) }
  }
  return null
}

function indexCells(value: unknown, field: string): Map<string, Record<string, unknown>> {
  const out = new Map<string, Record<string, unknown>>()
  if (!value || typeof value !== "object" || Array.isArray(value)) return out
  for (const [bucket, cells] of Object.entries(value as Record<string, unknown>)) {
    if (!cells || typeof cells !== "object" || Array.isArray(cells)) continue
    for (const [habitId, cell] of Object.entries(cells as Record<string, unknown>)) {
      if (!cell || typeof cell !== "object" || Array.isArray(cell)) continue
      out.set(habitCellId(field, bucket, habitId), cell as Record<string, unknown>)
    }
  }
  return out
}

function indexCollection(value: unknown, col: Collection): Map<string, Record<string, unknown>> {
  if (col.shape === "map") return indexMap(value)
  if (col.shape === "cells") return indexCells(value, col.field)
  return indexRows(value)
}

function changedFields(prev: Record<string, unknown>, next: Record<string, unknown>): Record<string, unknown> | null {
  const keys = new Set([...Object.keys(prev), ...Object.keys(next)])
  const out: Record<string, unknown> = {}
  let any = false
  for (const key of keys) {
    if (key === "id") continue
    if (sameJson(prev[key], next[key])) continue
    out[key] = Object.prototype.hasOwnProperty.call(next, key) ? next[key] : null
    any = true
  }
  return any ? out : null
}

function diffPersist(previous: string, next: string, name: string): { patch: PhonePatch; nextValue: string } | null {
  let prevParsed: unknown
  let nextParsed: unknown
  try {
    prevParsed = JSON.parse(previous)
    nextParsed = JSON.parse(next)
  } catch {
    return null
  }
  const prevRoot = unwrapState(prevParsed)
  const nextRoot = unwrapState(nextParsed)
  if (!prevRoot || !nextRoot) return null
  const upserts: PhonePatch["upserts"] = []
  const removedIds: string[] = []
  const seenRemoved = new Set<string>()
  for (const col of collectionsFor(name)) {
    const prevRows = indexCollection(prevRoot[col.field], col)
    const nextRows = indexCollection(nextRoot[col.field], col)
    const gone: string[] = []
    for (const id of prevRows.keys()) {
      if (nextRows.has(id)) continue
      gone.push(id)
      if (!seenRemoved.has(id)) {
        seenRemoved.add(id)
        removedIds.push(id)
      }
    }
    for (const [id, row] of nextRows) {
      const before = prevRows.get(id)
      if (!before) {
        upserts.push({ ...row, id })
        continue
      }
      const changed = changedFields(before, row)
      if (changed) upserts.push({ id, ...changed })
    }
    if (col.tombstone && gone.length > 0) {
      const tomb = nextRoot[col.tombstone]
      const existing = Array.isArray(tomb)
        ? tomb.filter((id): id is string => typeof id === "string")
        : []
      const merged = [...existing]
      for (const id of gone) {
        if (!merged.includes(id)) merged.push(id)
      }
      nextRoot[col.tombstone] = merged
    }
  }
  if (upserts.length === 0 && removedIds.length === 0) return null
  return { patch: { upserts, removedIds }, nextValue: JSON.stringify(nextParsed) }
}

function newPatchId(): string {
  const cryptoApi = globalThis.crypto
  if (cryptoApi && typeof cryptoApi.randomUUID === "function") return cryptoApi.randomUUID()
  return `p-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`
}

function trackOutbox(work: Promise<void>) {
  outboxTail = outboxTail.then(() => work).catch(() => undefined)
}

export function phoneOutboxSettled(): Promise<void> {
  return outboxTail
}

/** Memory update for a phone vault key. Queues a patch when this store may write. */
export function applyPhoneWindowWrite(name: string, value: string): "same" | "wrote" {
  const canon = canonicalWindowKey(name)
  const previous = readPhoneWindowItem(name)
  if (!value) {
    if (previous == null) return "same"
    removePhoneWindowItem(name)
    return "wrote"
  }
  if (previous === value) return "same"
  let stored = value
  if (acceptPatches && previous != null && vaultPatchAllowed(name)) {
    const diff = diffPersist(previous, value, name)
    if (diff) {
      stored = diff.nextValue
      const row: PhoneOutboxRow = { id: newPatchId(), name: canon, source: "phone", patch: diff.patch }
      trackOutbox(
        (async () => {
          await enqueueOutbox(row)
          if (macAnswered) await flushPhoneOutbox()
        })(),
      )
    }
  }
  removePhoneWindowItem(name)
  memory.set(canon, stored)
  return stored === previous ? "same" : "wrote"
}

function tokenFromBlob(raw: string | null): string {
  if (!raw) return ""
  try {
    const parsed = JSON.parse(raw) as { state?: { phoneHubToken?: unknown }; phoneHubToken?: unknown }
    const state = parsed.state && typeof parsed.state === "object" ? parsed.state : parsed
    const token = state.phoneHubToken
    return typeof token === "string" ? token.trim() : ""
  } catch {
    return ""
  }
}

async function readPhoneHubToken(): Promise<string> {
  const fromMemory = tokenFromBlob(readPhoneWindowItem("brain2-ingest-store"))
  if (fromMemory) return fromMemory
  try {
    const mod = await import("@/lib/ingest/ingest-store")
    const token = mod.useIngestStore.getState().phoneHubToken
    return typeof token === "string" ? token.trim() : ""
  } catch {
    return ""
  }
}

async function authHeaders(): Promise<Record<string, string>> {
  const token = await readPhoneHubToken()
  if (!token) return {}
  return { Authorization: `Bearer ${token}` }
}

async function resolveHubCandidates(): Promise<string[]> {
  const { phoneHubCandidates } = await import("@/lib/mobile-sync")
  return phoneHubCandidates()
}

function asPersistString(value: unknown): string | null {
  if (typeof value === "string") return value === "" ? null : value
  if (value && typeof value === "object") {
    try {
      return JSON.stringify(value)
    } catch {
      return null
    }
  }
  return null
}

function collapseItems(items: Record<string, unknown>): Map<string, string> {
  const next = new Map<string, string>()
  const legacy: Array<[string, string]> = []
  for (const [key, raw] of Object.entries(items)) {
    const value = asPersistString(raw)
    if (value == null) continue
    if (key.startsWith("cogs-")) legacy.push([`brain2-${key.slice(5)}`, value])
    else next.set(key, value)
  }
  for (const [key, value] of legacy) {
    if (!next.has(key)) next.set(key, value)
  }
  return next
}

function installMap(next: Map<string, string>) {
  memory.clear()
  for (const [key, value] of next) memory.set(key, value)
}

/** Long enough for the whole vault over Wi-Fi; short enough that a dead socket names itself. */
const CANON_TIMEOUT_MS = 90_000

type CanonResult = { ok: true; items: Record<string, unknown> } | { ok: false; reason: string }

async function fetchCanon(url: string): Promise<CanonResult> {
  const controller = typeof AbortController === "function" ? new AbortController() : null
  const timer = controller ? setTimeout(() => controller.abort(), CANON_TIMEOUT_MS) : null
  try {
    const headers: Record<string, string> = { Accept: "application/json", ...(await authHeaders()) }
    const response = await fetch(`${url}/api/persist?canon=1`, { cache: "no-store", headers, signal: controller?.signal })
    if (!response.ok) {
      const hint = response.status === 401 ? " (hub token)" : ""
      return { ok: false, reason: `${hostOf(url)} answered ${response.status}${hint}.` }
    }
    const body = (await response.json()) as { items?: unknown }
    if (!body.items || typeof body.items !== "object" || Array.isArray(body.items)) {
      return { ok: false, reason: `${hostOf(url)} sent no vault.` }
    }
    return { ok: true, items: body.items as Record<string, unknown> }
  } catch (err) {
    if (controller?.signal.aborted) return { ok: false, reason: `${hostOf(url)} timed out.` }
    return { ok: false, reason: `${hostOf(url)}: ${errorText(err)}` }
  } finally {
    if (timer) clearTimeout(timer)
  }
}

function rowCollections(collections: Collection[]): Collection[] {
  return collections.filter((col) => !col.shape || col.shape === "rows")
}

function bestCollection(root: Record<string, unknown>, collections: Collection[], upsert: Record<string, unknown>): string | null {
  const rowsOnly = rowCollections(collections)
  let best: string | null = rowsOnly[0]?.field ?? null
  let score = -1
  for (const col of rowsOnly) {
    const rows = indexRows(root[col.field])
    const sample = rows.values().next().value as Record<string, unknown> | undefined
    let next = 0
    if (sample) {
      for (const key of Object.keys(upsert)) {
        if (key !== "id" && key in sample) next += 1
      }
    }
    if (next > score) {
      score = next
      best = col.field
    }
  }
  return best
}

function mergeStored(
  stored: Record<string, unknown> | undefined,
  upsert: Record<string, unknown>,
  keepId: boolean,
): Record<string, unknown> {
  const next: Record<string, unknown> = stored ? { ...stored } : {}
  for (const [key, value] of Object.entries(upsert)) {
    if (key === "id") continue
    next[key] = value
  }
  if (keepId) next.id = upsert.id
  return next
}

function placeField(root: Record<string, unknown>, collections: Collection[], upsert: Record<string, unknown>): string | null {
  for (const col of rowCollections(collections)) {
    if (col.claim?.(upsert)) return col.field
  }
  const unclaimed = rowCollections(collections).filter((col) => !col.claim)
  return bestCollection(root, unclaimed.length > 0 ? unclaimed : rowCollections(collections), upsert)
}

function applyPatch(name: string, raw: string, patch: PhonePatch): string {
  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    return raw
  }
  const root = unwrapState(parsed)
  if (!root) return raw
  const collections = collectionsFor(name)
  const removed = new Set(patch.removedIds)
  const pending = new Map(patch.upserts.map((row) => [row.id, row]))
  for (const col of collections) {
    if (col.shape === "cells" || col.shape === "map") {
      const raw = root[col.field]
      const map =
        raw && typeof raw === "object" && !Array.isArray(raw) ? { ...(raw as Record<string, unknown>) } : {}
      if (col.shape === "cells") {
        for (const id of removed) {
          const cell = parseHabitCellId(id)
          if (!cell || cell.field !== col.field) continue
          const dayRaw = map[cell.bucket]
          if (!dayRaw || typeof dayRaw !== "object" || Array.isArray(dayRaw)) continue
          const day = { ...(dayRaw as Record<string, unknown>) }
          if (!(cell.habitId in day)) continue
          delete day[cell.habitId]
          map[cell.bucket] = day
        }
        for (const [id, upsert] of [...pending]) {
          const cell = parseHabitCellId(id)
          if (!cell || cell.field !== col.field || removed.has(id)) continue
          const dayRaw = map[cell.bucket]
          const day =
            dayRaw && typeof dayRaw === "object" && !Array.isArray(dayRaw)
              ? { ...(dayRaw as Record<string, unknown>) }
              : {}
          const prev = day[cell.habitId]
          const stored =
            prev && typeof prev === "object" && !Array.isArray(prev) ? (prev as Record<string, unknown>) : undefined
          day[cell.habitId] = mergeStored(stored, upsert, false)
          map[cell.bucket] = day
          pending.delete(id)
        }
      } else {
        for (const id of removed) {
          if (id in map) delete map[id]
        }
        for (const [id, upsert] of [...pending]) {
          if (removed.has(id) || parseHabitCellId(id)) continue
          const prev = map[id]
          const stored =
            prev && typeof prev === "object" && !Array.isArray(prev) ? (prev as Record<string, unknown>) : undefined
          const merged = mergeStored(stored, upsert, false)
          if (col.field === "nights" && typeof merged.date !== "string") merged.date = id
          map[id] = merged
          pending.delete(id)
        }
      }
      root[col.field] = map
      continue
    }
    const rows = Array.isArray(root[col.field]) ? [...(root[col.field] as unknown[])] : null
    if (!rows) continue
    const next: unknown[] = []
    for (const row of rows) {
      const id = rowId(row)
      if (id && removed.has(id)) continue
      if (id && pending.has(id) && row && typeof row === "object") {
        next.push({ ...(row as Record<string, unknown>), ...pending.get(id) })
        pending.delete(id)
      } else {
        next.push(row)
      }
    }
    root[col.field] = next
    if (col.tombstone && removed.size > 0) {
      const existing = Array.isArray(root[col.tombstone])
        ? (root[col.tombstone] as unknown[]).filter((id): id is string => typeof id === "string")
        : []
      const merged = [...existing]
      for (const id of removed) {
        if (!merged.includes(id)) merged.push(id)
      }
      root[col.tombstone] = merged
    }
  }
  for (const upsert of pending.values()) {
    const field = placeField(root, collections, upsert)
    if (!field) continue
    const rows = Array.isArray(root[field]) ? [...(root[field] as unknown[])] : []
    rows.push(upsert)
    root[field] = rows
  }
  return JSON.stringify(parsed)
}

async function replayOutbox() {
  const rows = await listOutbox()
  for (const row of rows) {
    const raw = readPhoneWindowItem(row.name)
    if (raw == null) continue
    memory.set(canonicalWindowKey(row.name), applyPatch(row.name, raw, row.patch))
  }
}

async function rehydrateMemory() {
  const suffixes = new Set<string>()
  for (const key of memory.keys()) suffixes.add(bareVault(key))
  await Promise.all(
    [...suffixes].map((suffix) => {
      const load = REHYDRATE[suffix]
      return load ? load().catch(() => undefined) : undefined
    }),
  )
}

async function paintCache(gen: number): Promise<PhoneWindowStatus> {
  const cached = await readLaunchCache()
  if (gen !== loadGen) return status
  if (memory.size > 0) {
    setStatus("stale")
    return status
  }
  if (cached.size === 0) {
    setStatus("offline")
    return status
  }
  installMap(cached)
  acceptPatches = false
  try {
    await rehydrateMemory()
  } finally {
    acceptPatches = true
  }
  if (gen !== loadGen) return status
  setStatus("stale")
  return status
}

/** Fetch the Mac file into memory. A miss paints the launch cache, or the offline line. */
export async function loadPhoneWindow(): Promise<PhoneWindowStatus> {
  engagePhoneWindow()
  if (!phoneWindowEngaged()) {
    detail = isDemoProfile() ? "Demo profile: the Mac is not loaded." : null
    setStatus("idle")
    return "idle"
  }
  const gen = ++loadGen
  try {
    return await loadPhoneWindowSteps(gen)
  } catch (err) {
    // A throw would leave "loading" up forever with nothing to say.
    if (gen !== loadGen) return status
    macAnswered = false
    setDetail(`Stopped while ${detail?.replace(/^\(|\)$/g, "") ?? "loading"}: ${errorText(err)}`)
    setStatus(memory.size > 0 ? "stale" : "offline")
    return status
  }
}

async function loadPhoneWindowSteps(gen: number): Promise<PhoneWindowStatus> {
  detail = "(finding the Mac)"
  if (memory.size === 0) setStatus("loading")
  else emit()
  let candidates: string[] = []
  let candidateError = ""
  try {
    candidates = await resolveHubCandidates()
  } catch (err) {
    candidates = []
    candidateError = errorText(err)
  }
  if (gen !== loadGen) return status
  let url = ""
  let first: { ok: true; items: Record<string, unknown> } | null = null
  const misses: string[] = []
  for (const candidate of candidates) {
    if (gen !== loadGen) return status
    setDetail(`(asking ${hostOf(candidate)})`)
    const attempt = await fetchCanon(candidate)
    if (gen !== loadGen) return status
    if (!attempt.ok) {
      misses.push(attempt.reason)
      continue
    }
    url = candidate
    first = attempt
    break
  }
  hubUrl = url
  if (!first) {
    macAnswered = false
    detail = misses.length > 0 ? misses.join(" ") : `No Mac address saved${candidateError ? ` (${candidateError})` : ""}.`
    setDetail(`(opening the saved copy) ${detail}`)
    const why = detail
    const painted = await paintCache(gen)
    if (gen === loadGen) setDetail(why)
    return painted
  }
  setDetail("(sending phone edits)")
  await phoneOutboxSettled()
  const flushed = await flushPhoneOutbox({ force: true })
  if (gen !== loadGen) return status
  let items = first.items
  if (flushed > 0) {
    const second = await fetchCanon(url)
    if (second.ok) items = second.items
  }
  if (gen !== loadGen) return status
  installMap(collapseItems(items))
  setDetail("(saving the launch copy)")
  await writeLaunchCache(memory)
  await replayOutbox()
  setDetail("(drawing the vault)")
  acceptPatches = false
  try {
    await rehydrateMemory()
  } finally {
    acceptPatches = true
  }
  if (gen !== loadGen) return status
  macAnswered = true
  detail = null
  setStatus("live")
  if ((await listOutbox()).length > 0) await flushPhoneOutbox()
  return status
}

/** POST each outbox row once. Deletes it after a 2xx. No-op while the Mac has not answered. */
export async function flushPhoneOutbox(opts?: { force?: boolean }): Promise<number> {
  if (!opts?.force && !macAnswered) return 0
  if (!hubUrl) return 0
  const rows = await listOutbox()
  let sent = 0
  for (const row of rows) {
    if (inflight.has(row.id) || acked.has(row.id)) continue
    inflight.add(row.id)
    try {
      const headers: Record<string, string> = {
        Accept: "application/json",
        "Content-Type": "application/json",
        ...(await authHeaders()),
      }
      const response = await fetch(`${hubUrl}/api/persist`, {
        method: "POST",
        headers,
        body: JSON.stringify({ name: row.name, source: row.source, patch: row.patch }),
      })
      if (!response.ok) continue
      acked.add(row.id)
      sent += 1
      try {
        await deleteOutbox(row.id)
      } catch {
        /* accepted once; a later flush must not send this id again */
      }
    } catch {
      /* the row stays until the Mac answers */
    } finally {
      inflight.delete(row.id)
    }
  }
  return sent
}

export function resetPhoneWindowForTests(): void {
  memory.clear()
  engaged = false
  macAnswered = false
  acceptPatches = true
  status = "idle"
  detail = null
  hubUrl = ""
  loadGen += 1
  inflight.clear()
  acked.clear()
  listeners.clear()
  outboxTail = Promise.resolve()
  resetPhoneWindowCacheForTests()
}

engagePhoneWindow()
