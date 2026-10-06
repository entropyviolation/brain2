/**
 * lib/habit-list-item.ts — The Lists item that stands for a habit
 *
 * Each habit has one standing item (not the per-day Done log). Opening it uses
 * the same screen pins as every other item: Lists location, app tab, and
 * `appItemId`. Coming back restores Home → Habits and the edit window.
 */
import {
  APP_NAV_KEYS,
  APP_TABS,
  readStoredId,
  readStoredTab,
  writeListsNavigation,
  writeStoredId,
  writeStoredTab,
} from "@/lib/app-navigation"
import { COGS_NAV_RESTORE_EVENT } from "@/lib/screen-location"
import { itemTitle } from "@/lib/item-utils"
import { useTaskStore } from "@/lib/task-store"
import type { AttributeValue, List, Task, WeeklyTask } from "@/lib/types"

export const HABIT_STANDING_LIST_ID = "list-habits-standing"
const RETURN_KEY = "cogs-habit-settings-return"

let returnDraft: WeeklyTask | null = null

export function habitStandingItemId(habitId: string): string {
  return `habit-item-${habitId}`
}

function standingList(): List {
  const store = useTaskStore.getState()
  const found =
    store.lists.find((list) => list.id === HABIT_STANDING_LIST_ID) ??
    store.lists.find((list) => list.name.trim().toLowerCase() === "habits")
  if (found) return found
  const created: List = {
    id: HABIT_STANDING_LIST_ID,
    name: "Habits",
    color: "#000080",
    createdAt: new Date(),
    description: "One item for each habit, so the habit can hold notes, links, and the rest of item detail.",
  }
  store.addList(created)
  return created
}

function isStandingHabitItem(task: Task, habitId: string): boolean {
  if (task.id.startsWith("habit-done-")) return false
  if (task.id === habitStandingItemId(habitId)) return true
  return task.attributes?.sourceHabitId === habitId
}

/** Find or create the Lists item for this habit. Returns the item id. */
export function ensureHabitStandingItem(habit: WeeklyTask): string {
  const list = standingList()
  const store = useTaskStore.getState()
  const existing = store.tasks.find((task) => isStandingHabitItem(task, habit.id))
  const name = habit.name.trim() || "Habit"
  if (existing) {
    if (itemTitle(existing) !== name || !(existing.lists ?? []).includes(list.id)) {
      const lists = new Set(existing.lists ?? [])
      lists.add(list.id)
      store.updateTask({
        ...existing,
        title: name,
        description: name,
        lists: [...lists],
        attributes: { ...existing.attributes, sourceHabitId: habit.id },
      })
    }
    return existing.id
  }
  const id = habitStandingItemId(habit.id)
  store.addTask({
    id,
    title: name,
    description: name,
    type: "item",
    stage: "list",
    lists: [list.id],
    createdAt: new Date(),
    completed: false,
    tags: ["habit"],
    links: [],
    attributes: { sourceHabitId: habit.id },
  })
  return id
}

export function stashHabitDraft(task: WeeklyTask): void {
  returnDraft = task
}

export function takeHabitDraft(habitId: string): WeeklyTask | null {
  if (!returnDraft || returnDraft.id !== habitId) return null
  const draft = returnDraft
  returnDraft = null
  return draft
}

/** The standing item's join to its habit. The attribute id stays `sourceHabitId`. */
export function sourceHabitIdOf(attributes: Record<string, AttributeValue> | undefined): string | null {
  const raw = attributes?.sourceHabitId
  if (typeof raw !== "string") return null
  const id = raw.trim()
  return id.length > 0 ? id : null
}

export function peekHabitSettingsReturn(): string | null {
  if (typeof window === "undefined") return null
  const id = sessionStorage.getItem(RETURN_KEY)
  return id && id.length > 0 ? id : null
}

/** Remember which habit Settings should reopen. Does not leave the current screen. */
export function armHabitSettingsReturn(habitId: string): void {
  if (typeof window === "undefined") return
  const id = habitId.trim()
  if (!id) return
  sessionStorage.setItem(RETURN_KEY, id)
}

export function clearHabitSettingsReturn(): void {
  if (typeof window === "undefined") return
  sessionStorage.removeItem(RETURN_KEY)
}

function restorePins(): void {
  if (typeof window === "undefined") return
  window.dispatchEvent(new CustomEvent(COGS_NAV_RESTORE_EVENT))
}

/**
 * Open the habit's item on the Lists tab, full item detail.
 * Remembers this habit so Back can reopen its settings.
 */
export function openHabitInLists(habit: WeeklyTask): string {
  const itemId = ensureHabitStandingItem(habit)
  const list = standingList()
  stashHabitDraft(habit)
  if (typeof window !== "undefined") sessionStorage.setItem(RETURN_KEY, habit.id)
  writeListsNavigation({ location: "home", openTarget: { type: "category", id: list.id } })
  writeStoredTab(APP_NAV_KEYS.homeTab, "habits")
  writeStoredTab(APP_NAV_KEYS.appTab, "categories")
  writeStoredId(APP_NAV_KEYS.appItemId, itemId)
  restorePins()
  return itemId
}

/** Leave item detail and land back on Home → Habits. The tracker reopens the form. */
export function returnToHabitSettings(): boolean {
  const habitId = peekHabitSettingsReturn()
  if (!habitId) return false
  writeStoredTab(APP_NAV_KEYS.appTab, "home")
  writeStoredTab(APP_NAV_KEYS.homeTab, "habits")
  writeStoredId(APP_NAV_KEYS.appItemId, null)
  restorePins()
  return true
}

export function habitSettingsReturnReady(): boolean {
  const habitId = peekHabitSettingsReturn()
  if (!habitId) return false
  if (readStoredId(APP_NAV_KEYS.appItemId)) return false
  return readStoredTab(APP_NAV_KEYS.appTab, APP_TABS, "home") === "home"
}
