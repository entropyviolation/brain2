/**
 * lib/count-statuses.ts — Named tallies on the Tracking log
 *
 * Each count keeps its own ticks (date + minute). An optional intake class
 * also paints an Intake instant. An optional keyword is saved in
 * `brain2-log-keywords` so `log:` of that phrase increments the count.
 * Storage: `brain2-count-statuses` (persist v2). Hub-safe Zustand persist.
 * Not cycle marks, and not the time-grid blob. Deleting a count drops its
 * ticks and leaves intake instants already painted.
 *
 * Shower is the builtin `count-shower`. Deleting it sets `builtins.shower`
 * to `removed` and does not recreate it. v2 backfills Activity shower
 * instants once.
 */
"use client"

import { create } from "zustand"
import { persist } from "zustand/middleware"
import { formatLocalDateKey } from "@/lib/date-utils"
import { normalizeLogKeyword } from "@/lib/log-keywords"
import { logKeywordPhrase, useLogKeywordsStore } from "@/lib/log-keywords-store"
import { createCogsJSONStorage } from "@/lib/persist-storage"
import { persistKey } from "@/lib/storage-keys"
import { stablePenColor, useTimeTrackingStore } from "@/lib/time-tracking-store"
import type { IntakeClass, TrackingClockCertainty } from "@/lib/time-entries"

export const COUNT_STATUSES_STORAGE_KEY = persistKey("count-statuses")

/** Builtin tally. Stable id so days-since and the Data plate find one row. */
export const SHOWER_COUNT_ID = "count-shower"

export interface CountBuiltins {
  /** `removed` means the person deleted Shower. Do not seed it again. */
  shower?: "on" | "removed"
  /** Set once the v2 instant backfill has run. */
  showerBackfill?: "done"
}

const DATE_KEY = /^\d{4}-\d{2}-\d{2}$/
const ACTIVITY_SCOPE_ID = "activity"
const INTAKE_PEN_NAME = "Intake"

export interface CountWhen {
  date: string
  startMin: number
  clockCertainty?: TrackingClockCertainty
}

export interface CountTick {
  id: string
  date: string
  startMin: number
  clockCertainty?: Exclude<TrackingClockCertainty, "exact">
}

export interface CountStatus {
  id: string
  name: string
  intakeClass?: IntakeClass
  keyword?: string
  ticks: CountTick[]
}

export interface CountDraft {
  name: string
  intakeClass?: IntakeClass | ""
  keyword?: string
}

export function showerCount(ticks: CountTick[] = []): CountStatus {
  return { id: SHOWER_COUNT_ID, name: "Shower", keyword: "shower", ticks }
}

export function isShowerInstant(entry: {
  kind?: string
  scopeId?: string
  title?: string
  eventKind?: string
  logSource?: string
  generatedBy?: { id?: string }
}): boolean {
  if (entry.kind !== "instant") return false
  const title = (entry.title ?? "").trim().toLowerCase()
  const kind = (entry.eventKind ?? "").trim().toLowerCase()
  const titleHit = title === "shower"
  const nfc = entry.logSource === "nfc" || (entry.generatedBy?.id ?? "").startsWith("nfc:")
  if (nfc && titleHit) return true
  return entry.scopeId === "activity" && (titleHit || kind === "shower")
}

/** One tick per date+minute. Instants that are not showers are ignored. */
export function showerTicksFromEntries(
  entries: readonly {
    id?: string
    kind?: string
    scopeId?: string
    title?: string
    eventKind?: string
    logSource?: string
    generatedBy?: { id?: string }
    date: string
    startMin: number
    clockCertainty?: TrackingClockCertainty
  }[],
): CountTick[] {
  const seen = new Set<string>()
  const ticks: CountTick[] = []
  for (const entry of entries) {
    if (!isShowerInstant(entry)) continue
    if (!DATE_KEY.test(entry.date)) continue
    const startMin = Math.floor(entry.startMin)
    if (startMin < 0 || startMin > 1439) continue
    const key = `${entry.date}|${startMin}`
    if (seen.has(key)) continue
    seen.add(key)
    const clock = entry.clockCertainty
    const certainty = clock === "estimated" || clock === "unknown" ? clock : undefined
    ticks.push({
      id: `tick_shower_${entry.date}_${startMin}`,
      date: entry.date,
      startMin,
      ...(certainty ? { clockCertainty: certainty } : {}),
    })
  }
  return ticks
}

function newId(prefix: string): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return `${prefix}_${crypto.randomUUID()}`
  }
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`
}

function phraseKey(phrase: string): string {
  return normalizeLogKeyword(phrase).toLowerCase()
}

function normalizeName(raw: string): string {
  return raw.trim().replace(/\s+/g, " ")
}

function intakeOf(value: unknown): IntakeClass | undefined {
  if (value === "drug" || value === "food" || value === "drink") return value
  return undefined
}

function cleanWhen(when: CountWhen): CountWhen | null {
  if (!when || typeof when.date !== "string" || !DATE_KEY.test(when.date)) return null
  if (!Number.isFinite(when.startMin)) return null
  const startMin = Math.floor(when.startMin)
  if (startMin < 0 || startMin > 1439) return null
  const clock = when.clockCertainty
  if (clock && clock !== "exact" && clock !== "estimated" && clock !== "unknown") return null
  return {
    date: when.date,
    startMin,
    ...(clock && clock !== "exact" ? { clockCertainty: clock } : {}),
  }
}

function tickFrom(when: CountWhen, id = newId("tick")): CountTick {
  return {
    id,
    date: when.date,
    startMin: when.startMin,
    ...(when.clockCertainty && when.clockCertainty !== "exact" ? { clockCertainty: when.clockCertainty } : {}),
  }
}

function nowWhen(): CountWhen {
  const now = new Date()
  return {
    date: formatLocalDateKey(now),
    startMin: now.getHours() * 60 + now.getMinutes(),
  }
}

function readTick(value: unknown): CountTick | null {
  if (!value || typeof value !== "object") return null
  const row = value as { id?: unknown; date?: unknown; startMin?: unknown; clockCertainty?: unknown }
  if (typeof row.date !== "string" || !DATE_KEY.test(row.date)) return null
  if (typeof row.startMin !== "number" || !Number.isFinite(row.startMin)) return null
  const startMin = Math.floor(row.startMin)
  if (startMin < 0 || startMin > 1439) return null
  const clock = row.clockCertainty
  const certainty = clock === "estimated" || clock === "unknown" ? clock : undefined
  const id = typeof row.id === "string" && row.id.trim() ? row.id.trim() : newId("tick")
  return { id, date: row.date, startMin, ...(certainty ? { clockCertainty: certainty } : {}) }
}

function readCount(value: unknown): CountStatus | null {
  if (!value || typeof value !== "object") return null
  const row = value as {
    id?: unknown
    name?: unknown
    intakeClass?: unknown
    keyword?: unknown
    ticks?: unknown
  }
  const name = typeof row.name === "string" ? normalizeName(row.name) : ""
  const id = typeof row.id === "string" ? row.id.trim() : ""
  if (!name || !id) return null
  const keyword = typeof row.keyword === "string" ? normalizeLogKeyword(row.keyword) : ""
  const intakeClass = intakeOf(row.intakeClass)
  const ticks = Array.isArray(row.ticks) ? row.ticks.map(readTick).filter((tick): tick is CountTick => tick != null) : []
  return {
    id,
    name,
    ...(intakeClass ? { intakeClass } : {}),
    ...(keyword ? { keyword } : {}),
    ticks,
  }
}

export function sanitizeCountStatuses(value: unknown): CountStatus[] {
  const raw = Array.isArray(value)
    ? value
    : value && typeof value === "object" && Array.isArray((value as { counts?: unknown }).counts)
      ? (value as { counts: unknown[] }).counts
      : []
  const out: CountStatus[] = []
  const seen = new Set<string>()
  for (const item of raw) {
    const count = readCount(item)
    if (!count || seen.has(count.id)) continue
    seen.add(count.id)
    out.push(count)
  }
  return out
}

/**
 * Same Intake instant `paintLogInstant` writes: Intake pen, `intake.${class}`,
 * title = the count name. Called here so this store does not import the log model.
 */
function paintIntakeInstant(title: string, intakeClass: IntakeClass, when: CountWhen): void {
  const name = title.trim()
  if (!name) return
  const store = useTimeTrackingStore.getState()
  const scope = store.scopes.find((row) => row.id === ACTIVITY_SCOPE_ID)
  if (!scope) return
  const existing = scope.pens.find((pen) => pen.name.toLowerCase() === INTAKE_PEN_NAME.toLowerCase())
  const penId = existing?.id || store.addPen(ACTIVITY_SCOPE_ID, { name: INTAKE_PEN_NAME, color: stablePenColor(INTAKE_PEN_NAME) })
  if (!penId) return
  const clock = when.clockCertainty ?? "exact"
  const minute = clock === "unknown" ? 0 : when.startMin
  useTimeTrackingStore.getState().paintMinutes(
    when.date,
    ACTIVITY_SCOPE_ID,
    minute,
    minute,
    penId,
    undefined,
    undefined,
    clock === "estimated" ? "estimated" : undefined,
    {
      kind: "instant",
      title: name,
      eventKind: `intake.${intakeClass}`,
      intakeClass,
      ...(clock === "exact" ? {} : { clockCertainty: clock }),
    },
  )
}

function countsBoundToPhrase(phrase: string): string[] {
  const key = phraseKey(phrase)
  if (!key) return []
  const ids = new Set<string>()
  for (const count of useCountStatusesStore.getState().counts) {
    if (count.keyword && phraseKey(count.keyword) === key) ids.add(count.id)
  }
  const row = useLogKeywordsStore.getState().keywords.find((item) => logKeywordPhrase(item).toLowerCase() === key)
  const linked = row && typeof row !== "string" ? row.countId?.trim() : ""
  if (linked && useCountStatusesStore.getState().counts.some((count) => count.id === linked)) ids.add(linked)
  return [...ids]
}

interface CountStatusesState {
  counts: CountStatus[]
  builtins: CountBuiltins
  addCount: (draft: CountDraft) => string | null
  renameCount: (id: string, name: string) => boolean
  removeCount: (id: string) => void
  /** One tick. Omitted `when` is the current local minute, exact. */
  incrementCount: (id: string, when?: CountWhen) => CountTick | null
  /** Correct one tick's date, minute or clock certainty (backlogging). */
  updateTick: (countId: string, tickId: string, when: CountWhen) => boolean
  removeTick: (countId: string, tickId: string) => void
}

export const useCountStatusesStore = create<CountStatusesState>()(
  persist(
    (set, get) => ({
      counts: [showerCount()],
      builtins: { shower: "on" },
      addCount: (draft) => {
        const name = normalizeName(draft.name)
        if (!name) return null
        const intakeClass = intakeOf(draft.intakeClass)
        const keyword = draft.keyword ? normalizeLogKeyword(draft.keyword) : ""
        const id = newId("count")
        const count: CountStatus = {
          id,
          name,
          ...(intakeClass ? { intakeClass } : {}),
          ...(keyword ? { keyword } : {}),
          ticks: [],
        }
        set({ counts: [...get().counts, count] })
        if (keyword) useLogKeywordsStore.getState().linkKeywordCount(keyword, id)
        return id
      },
      renameCount: (id, name) => {
        const next = normalizeName(name)
        if (!next) return false
        const counts = get().counts
        const index = counts.findIndex((row) => row.id === id)
        if (index < 0) return false
        if (counts[index]!.name === next) return true
        const copy = counts.slice()
        copy[index] = { ...counts[index]!, name: next }
        set({ counts: copy })
        return true
      },
      removeCount: (id) => {
        const count = get().counts.find((row) => row.id === id)
        if (!count) return
        const builtins = id === SHOWER_COUNT_ID ? { ...get().builtins, shower: "removed" as const } : get().builtins
        set({ counts: get().counts.filter((row) => row.id !== id), builtins })
        if (!count.keyword) return
        const row = useLogKeywordsStore
          .getState()
          .keywords.find((item) => logKeywordPhrase(item).toLowerCase() === phraseKey(count.keyword ?? ""))
        if (row && typeof row !== "string" && row.countId === id) {
          useLogKeywordsStore.getState().linkKeywordCount(count.keyword, undefined)
        }
      },
      incrementCount: (id, when) => {
        const count = get().counts.find((row) => row.id === id)
        if (!count) return null
        const clean = cleanWhen(when ?? nowWhen())
        if (!clean) return null
        const tick = tickFrom(clean)
        set({
          counts: get().counts.map((row) => (row.id === id ? { ...row, ticks: [...row.ticks, tick] } : row)),
        })
        if (count.intakeClass) paintIntakeInstant(count.name, count.intakeClass, clean)
        return tick
      },
      updateTick: (countId, tickId, when) => {
        const clean = cleanWhen(when)
        if (!clean) return false
        let hit = false
        set({
          counts: get().counts.map((row) =>
            row.id !== countId
              ? row
              : {
                  ...row,
                  ticks: row.ticks.map((tick) => {
                    if (tick.id !== tickId) return tick
                    hit = true
                    return tickFrom(clean, tick.id)
                  }),
                },
          ),
        })
        return hit
      },
      removeTick: (countId, tickId) => {
        set({
          counts: get().counts.map((row) =>
            row.id === countId ? { ...row, ticks: row.ticks.filter((tick) => tick.id !== tickId) } : row,
          ),
        })
      },
    }),
    {
      name: COUNT_STATUSES_STORAGE_KEY,
      version: 2,
      storage: createCogsJSONStorage(),
      partialize: (state) => ({ counts: state.counts, builtins: state.builtins }),
      migrate: (persisted, version) => migrateCountStatuses(persisted, version),
      merge: (persisted, current) => {
        const next = applyShowerBuiltin(persisted, false)
        if (next.builtins.shower === "on") {
          useLogKeywordsStore.getState().linkKeywordCount("shower", SHOWER_COUNT_ID)
        }
        return { ...current, counts: next.counts, builtins: next.builtins }
      },
      onRehydrateStorage: () => (state) => {
        if (state?.builtins.shower === "on") {
          useLogKeywordsStore.getState().linkKeywordCount("shower", SHOWER_COUNT_ID)
        }
      },
    },
  ),
)

function readBuiltins(value: unknown): CountBuiltins {
  if (!value || typeof value !== "object") return {}
  const row = value as { builtins?: unknown; shower?: unknown; showerBackfill?: unknown }
  const raw = row.builtins && typeof row.builtins === "object" ? (row.builtins as CountBuiltins) : row
  const shower = raw.shower === "removed" || raw.shower === "on" ? raw.shower : undefined
  const showerBackfill = raw.showerBackfill === "done" ? "done" : undefined
  return {
    ...(shower ? { shower } : {}),
    ...(showerBackfill ? { showerBackfill } : {}),
  }
}

function entriesForShowerBackfill(): Parameters<typeof showerTicksFromEntries>[0] {
  const disk = readTimegridEntries()
  let live: Parameters<typeof showerTicksFromEntries>[0] = []
  try {
    if (useTimeTrackingStore.persist.hasHydrated()) {
      live = useTimeTrackingStore.getState().entries
    }
  } catch {
    live = []
  }
  if (live.length === 0) return disk
  const byId = new Map<string, (typeof live)[number]>()
  for (const entry of disk) if (entry.id) byId.set(entry.id, entry)
  for (const entry of live) if (entry.id) byId.set(entry.id, entry)
  return [...byId.values()]
}

function readTimegridEntries(): Parameters<typeof showerTicksFromEntries>[0] {
  if (typeof localStorage === "undefined") return []
  try {
    const raw = localStorage.getItem(persistKey("timegrid-store"))
    if (!raw) return []
    const parsed = JSON.parse(raw) as { state?: { entries?: unknown }; entries?: unknown }
    const entries = parsed.state?.entries ?? parsed.entries
    return Array.isArray(entries) ? (entries as Parameters<typeof showerTicksFromEntries>[0]) : []
  } catch {
    return []
  }
}

function withBackfill(counts: CountStatus[], builtins: CountBuiltins, run: boolean): { counts: CountStatus[]; builtins: CountBuiltins } {
  if (!run || builtins.showerBackfill === "done") return { counts, builtins }
  if (builtins.shower === "removed") return { counts, builtins: { ...builtins, showerBackfill: "done" } }
  const incoming = showerTicksFromEntries(entriesForShowerBackfill())
  const existing = counts.find((row) => row.id === SHOWER_COUNT_ID)
  const have = new Set((existing?.ticks ?? []).map((tick) => `${tick.date}|${tick.startMin}`))
  const extra = incoming.filter((tick) => !have.has(`${tick.date}|${tick.startMin}`))
  const ticks = [...(existing?.ticks ?? []), ...extra]
  const shower = showerCount(ticks)
  const rest = counts.filter((row) => row.id !== SHOWER_COUNT_ID)
  return {
    counts: [...rest, shower],
    builtins: { ...builtins, shower: "on", showerBackfill: "done" },
  }
}

function applyShowerBuiltin(persisted: unknown, backfill: boolean): { counts: CountStatus[]; builtins: CountBuiltins } {
  const counts = sanitizeCountStatuses(persisted)
  const builtins = readBuiltins(persisted)
  const filled = withBackfill(counts, builtins, backfill || builtins.showerBackfill !== "done")
  if (filled.builtins.shower === "removed") {
    return { counts: filled.counts.filter((row) => row.id !== SHOWER_COUNT_ID), builtins: filled.builtins }
  }
  if (!filled.counts.some((row) => row.id === SHOWER_COUNT_ID)) {
    return { counts: [...filled.counts, showerCount()], builtins: { ...filled.builtins, shower: "on" } }
  }
  return { counts: filled.counts, builtins: { ...filled.builtins, shower: "on" } }
}

/** Persist migrate. Version 2 backfills shower instants once. Older blobs stay valid. */
export function migrateCountStatuses(persisted: unknown, version: number): { counts: CountStatus[]; builtins: CountBuiltins } {
  if (version >= 2) {
    const counts = sanitizeCountStatuses(persisted)
    const builtins = readBuiltins(persisted)
    return { counts, builtins }
  }
  return applyShowerBuiltin(persisted, true)
}

/**
 * Increment every count bound to this phrase. No binding is a no-op.
 * `when.date` is `YYYY-MM-DD`. `startMin` is minutes past local midnight.
 */
export function recordCountForKeyword(phrase: string, when: CountWhen): boolean {
  const ids = countsBoundToPhrase(phrase)
  if (ids.length === 0) return false
  const clean = cleanWhen(when)
  if (!clean) return false
  let wrote = false
  for (const id of ids) {
    if (useCountStatusesStore.getState().incrementCount(id, clean)) wrote = true
  }
  return wrote
}

/** Start a tally for a phrase that is already a log keyword. */
export function ensureCountForKeyword(phrase: string): string | null {
  const keyword = normalizeLogKeyword(phrase)
  if (!keyword) return null
  const bound = countsBoundToPhrase(keyword)
  if (bound[0]) {
    useLogKeywordsStore.getState().linkKeywordCount(keyword, bound[0])
    return bound[0]
  }
  return useCountStatusesStore.getState().addCount({ name: keyword, keyword })
}
