/**
 * lib/app-navigation.ts — App-wide navigation persistence helpers
 *
 * Stores the user's last active tab/location in localStorage so a refresh
 * returns them to the same place (top-level tab, Lists folder/list, Home
 * sub-panels, Scheduler period, Analytics view, etc.).
 */
import type { OpenTarget } from "@/components/Lists/types"

export const APP_NAV_KEYS = {
  appTab: "cogs-app-tab",
  homeTab: "cogs-home-tab",
  homeTrackingTab: "cogs-home-tracking-tab",
  homePlanTab: "cogs-home-plan-tab",
  homeTodoTab: "cogs-home-todo-tab",
  schedulerTab: "cogs-scheduler-tab",
  analyticsTab: "cogs-analytics-tab",
  listsNav: "cogs-lists-navigation",
} as const

export const APP_TABS = ["home", "categories", "scheduler", "operations", "modules", "graph", "analytics"] as const
export type AppTab = (typeof APP_TABS)[number]

export interface ListsNavigationState {
  location: string
  openTarget: OpenTarget
}

export function readStoredTab<T extends string>(key: string, allowed: readonly T[], fallback: T): T {
  if (typeof window === "undefined") return fallback
  const stored = localStorage.getItem(key)
  return stored && (allowed as readonly string[]).includes(stored) ? (stored as T) : fallback
}

export function writeStoredTab(key: string, value: string): void {
  if (typeof window === "undefined") return
  localStorage.setItem(key, value)
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
    const raw = localStorage.getItem(APP_NAV_KEYS.listsNav)
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
  localStorage.setItem(APP_NAV_KEYS.listsNav, JSON.stringify(state))
}

/** Dispatched after `requestNavigateToList` writes navigation state. */
export const COGS_NAVIGATE_TO_LIST_EVENT = "cogs-navigate-to-list"

export interface NavigateToListDetail {
  listId: string
}

/** Jump the Lists module to a specific list (persists + notifies listeners). */
export function requestNavigateToList(
  listId: string,
  folders: { id: string; listIds: string[] }[],
): void {
  const parent = folders.find((f) => f.listIds.includes(listId))
  writeListsNavigation({
    location: parent?.id ?? "home",
    openTarget: { type: "category", id: listId },
  })
  if (typeof window !== "undefined") {
    window.dispatchEvent(
      new CustomEvent<NavigateToListDetail>(COGS_NAVIGATE_TO_LIST_EVENT, {
        detail: { listId },
      }),
    )
  }
}
