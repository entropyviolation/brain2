/**
 * lib/app-navigation.ts — App-wide navigation persistence helpers
 *
 * Stores the user's last active tab/location in localStorage so a refresh
 * returns them to the same place (top-level tab, Lists folder/list, Home
 * sub-panels, Scheduler period, Analytics view, Docs scroll, etc.).
 */
import type { OpenTarget } from "@/components/Lists/types"

import { formatLocalDateKey, parseLocalDate } from "@/lib/date-utils"
import { persistKey, readAliasedLocal, removeAliasedLocal, writeAliasedLocal } from "@/lib/storage-keys"

export const APP_NAV_KEYS = {
  appTab: persistKey("app-tab"),
  appItemId: persistKey("app-item-id"),
  homeTab: persistKey("home-tab"),
  homeTrackingTab: persistKey("home-tracking-tab"),
  homePlanTab: persistKey("home-plan-tab"),
  homeTodoTab: persistKey("home-todo-tab"),
  homeNeedsAttention: persistKey("home-needs-attention"),
  homeDate: persistKey("home-date"),
  homeHabitsTab: persistKey("home-habits-tab"),
  homeHabitsWeek: persistKey("home-habits-week"),
  homeHabitsMonth: persistKey("home-habits-month"),
  homeGoalsPeriod: persistKey("home-goals-period"),
  homeGoalsFilter: persistKey("home-goals-filter"),
  schedulerTab: persistKey("scheduler-tab"),
  schedulerView: persistKey("scheduler-view"),
  schedulerDate: persistKey("scheduler-date"),
  analyticsTab: persistKey("analytics-tab"),
  analyticsGroupViews: persistKey("analytics-group-views"),
  listsNav: persistKey("lists-navigation"),
  docsDocId: persistKey("docs-doc-id"),
  docsFolder: persistKey("docs-folder"),
  opsId: persistKey("ops-id"),
  opsPanel: persistKey("ops-panel"),
  modulesWorkspaceId: persistKey("modules-workspace-id"),
  modulesView: persistKey("modules-view"),
  itemDetailTab: persistKey("item-detail-tab"),
  uiScroll: persistKey("ui-scroll"),
} as const

export const HOME_NEEDS_ATTENTION_STATES = ["expanded", "collapsed"] as const
export type HomeNeedsAttentionState = (typeof HOME_NEEDS_ATTENTION_STATES)[number]

export const APP_TABS = [
  "home",
  "categories",
  "docs",
  "scheduler",
  "operations",
  "modules",
  "analytics",
] as const
export type AppTab = (typeof APP_TABS)[number]

export const HABIT_FREQ_TABS = ["daily", "weekly", "monthly"] as const
export type HabitFreqTab = (typeof HABIT_FREQ_TABS)[number]

export const SCHEDULER_VIEWS = ["funnel", "gantt", "graph"] as const
export type SchedulerViewMode = (typeof SCHEDULER_VIEWS)[number]

export interface ListsNavigationState {
  location: string
  openTarget: OpenTarget
}

export function readStoredTab<T extends string>(key: string, allowed: readonly T[], fallback: T): T {
  if (typeof window === "undefined") return fallback
  const stored = readAliasedLocal(key)
  return stored && (allowed as readonly string[]).includes(stored) ? (stored as T) : fallback
}

export function writeStoredTab(key: string, value: string): void {
  if (typeof window === "undefined") return
  writeAliasedLocal(key, value)
  publishNavPin(key, value)
}

/** So a later launch does not seed an older tab from the shared persist file. */
function publishNavPin(name: string, value: string): void {
  if (typeof fetch !== "function") return
  const host = window.location?.hostname
  if (host !== "localhost" && host !== "127.0.0.1") return
  void fetch("/api/persist", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name, value, source: "nav" }),
  }).catch(() => {})
}

export function readStoredId(key: string): string | null {
  if (typeof window === "undefined") return null
  const stored = readAliasedLocal(key)
  return stored && stored.length > 0 ? stored : null
}

export function writeStoredId(key: string, id: string | null): void {
  if (typeof window === "undefined") return
  if (!id) removeAliasedLocal(key)
  else writeAliasedLocal(key, id)
}

export function readStoredRecord(key: string): Record<string, string> {
  if (typeof window === "undefined") return {}
  try {
    const raw = readAliasedLocal(key)
    if (!raw) return {}
    const parsed = JSON.parse(raw) as unknown
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {}
    const out: Record<string, string> = {}
    for (const [field, value] of Object.entries(parsed as Record<string, unknown>)) {
      if (typeof value === "string") out[field] = value
    }
    return out
  } catch {
    return {}
  }
}

export function writeStoredRecordField(key: string, field: string, value: string | null): void {
  if (typeof window === "undefined") return
  const next = readStoredRecord(key)
  if (!value) delete next[field]
  else next[field] = value
  writeStoredRecord(key, next)
}

export function writeStoredRecord(key: string, record: Record<string, string>): void {
  if (typeof window === "undefined") return
  writeAliasedLocal(key, JSON.stringify(record))
}

export function readStoredDate(key: string): Date | null {
  if (typeof window === "undefined") return null
  return parseLocalDate(readAliasedLocal(key))
}

export function writeStoredDate(key: string, date: Date | null): void {
  if (typeof window === "undefined") return
  if (!date) removeAliasedLocal(key)
  else writeAliasedLocal(key, formatLocalDateKey(date))
}

const SCROLL_CAP = 80

function readScrollMap(): Record<string, number> {
  if (typeof window === "undefined") return {}
  try {
    const raw = readAliasedLocal(APP_NAV_KEYS.uiScroll)
    if (!raw) return {}
    const parsed = JSON.parse(raw) as unknown
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {}
    const out: Record<string, number> = {}
    for (const [slot, value] of Object.entries(parsed as Record<string, unknown>)) {
      if (typeof value === "number" && Number.isFinite(value) && value > 0) out[slot] = value
    }
    return out
  } catch {
    return {}
  }
}

export function docsScrollSlot(docId: string): string {
  return `docs:${docId}`
}

export function docsHomeScrollSlot(folder: string): string {
  return `docs-home:${folder}`
}

export const DOCS_SIDEBAR_SCROLL_SLOT = "docs-sidebar"

export function analyticsScrollSlot(tab: string): string {
  return `analytics:${tab}`
}

export function opsPanelScrollSlot(operationId: string, panelId: string): string {
  return `ops:${operationId}:${panelId}`
}

export function readScrollOffset(slot: string): number {
  const n = readScrollMap()[slot]
  return typeof n === "number" && n > 0 ? n : 0
}

export function writeScrollOffset(slot: string, top: number): void {
  if (typeof window === "undefined") return
  const map = readScrollMap()
  delete map[slot]
  const next = Math.max(0, Math.round(top))
  if (next > 0) map[slot] = next
  const keys = Object.keys(map)
  if (keys.length > SCROLL_CAP) {
    for (const extra of keys.slice(0, keys.length - SCROLL_CAP)) delete map[extra]
  }
  writeAliasedLocal(APP_NAV_KEYS.uiScroll, JSON.stringify(map))
}

function isValidOpenTarget(value: unknown): value is OpenTarget {
  if (value === null) return true
  if (!value || typeof value !== "object") return false
  const t = value as { type?: string; id?: string; folderId?: string }
  switch (t.type) {
    case "category":
      return typeof t.id === "string"
    case "smart":
      return t.id === "daily" || t.id === "weekly" || t.id === "monthly"
    case "habits":
      return t.id === "habits" || t.id === "weekly-habits" || t.id === "monthly-habits"
    case "objectives":
      return true
    case "folder-all":
      return typeof t.folderId === "string"
    default:
      return false
  }
}

export function readListsNavigation(): ListsNavigationState {
  if (typeof window === "undefined") return { location: "home", openTarget: null }
  try {
    const raw = readAliasedLocal(APP_NAV_KEYS.listsNav)
    if (!raw) return { location: "home", openTarget: null }
    const parsed = JSON.parse(raw) as Partial<ListsNavigationState>
    const location = typeof parsed.location === "string" ? parsed.location : "home"
    const openTarget = isValidOpenTarget(parsed.openTarget) ? parsed.openTarget : null
    return { location, openTarget }
  } catch {
    return { location: "home", openTarget: null }
  }
}

export function writeListsNavigation(state: ListsNavigationState): void {
  if (typeof window === "undefined") return
  writeAliasedLocal(APP_NAV_KEYS.listsNav, JSON.stringify(state))
}

/** Dispatched after Lists navigation is written so a mounted Lists view can sync in place (no remount). */
export const COGS_NAVIGATE_TO_LIST_EVENT = "cogs-navigate-to-list"

export interface NavigateToListDetail {
  listId: string
}

function detailListIdFor(state: ListsNavigationState): string {
  if (!state.openTarget) return state.location
  switch (state.openTarget.type) {
    case "category":
    case "smart":
    case "habits":
      return state.openTarget.id
    case "folder-all":
      return state.openTarget.folderId
    case "objectives":
      return "objectives"
    default:
      return state.location
  }
}

/**
 * Persist Lists location/openTarget and notify listeners.
 * Prefer this over `writeListsNavigation` alone when the Lists view may already be mounted —
 * `useListsNavigation` applies the new target in place instead of needing a remount key.
 */
export function applyListsNavigation(state: ListsNavigationState): void {
  writeListsNavigation(state)
  if (typeof window === "undefined") return
  window.dispatchEvent(
    new CustomEvent<NavigateToListDetail>(COGS_NAVIGATE_TO_LIST_EVENT, {
      detail: { listId: detailListIdFor(state) },
    }),
  )
}

/** Jump the Lists module to a specific list (persists + notifies listeners). */
export function requestNavigateToList(
  listId: string,
  folders: { id: string; listIds: string[] }[],
): void {
  const parent = folders.find((f) => f.listIds.includes(listId))
  applyListsNavigation({
    location: parent?.id ?? "home",
    openTarget: { type: "category", id: listId },
  })
}
