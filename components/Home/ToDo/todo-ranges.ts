/**
 * components/Home/ToDo/todo-ranges.ts — Other view: custom "done before" ranges, and the live title
 *
 * A range is a real List in Lists (folder "To do ranges" under Next Actions),
 * so membership edits either side show on both. The end date lives in To Do
 * prefs; a task on the list with no deadline gets the range's end as its
 * deadline, and moving the end moves deadlines that still match the old end.
 */
"use client"

import type { List, Task } from "@/lib/types"
import { useTaskStore } from "@/lib/task-store"
import { requestNavigateToList } from "@/lib/app-navigation"
import { useListsUiStore } from "@/lib/lists-ui-store"
import { findNextActionsFolder } from "@/lib/scheduled-lists-sync"
import { formatLocalDateKey, formatLocalMonthKey, getWeekString } from "@/lib/date-utils"
import { quarterKey, quarterLabel } from "@/lib/seasons"
import { getTodoPrefs, setTodoPrefs, type TodoRange, type TodoTitleView } from "./todo-prefs"

export const TODO_RANGES_FOLDER = "todo-ranges"
const RANGE_COLOR = "#5b6f8a"

export function isTodoRangeListId(id: string): boolean {
  return id.startsWith("todo-range-")
}

/** Local noon on the end day, so the deadline never slips a day across zones. */
export function rangeEndDate(range: TodoRange): Date {
  return new Date(`${range.end}T12:00:00`)
}

export function tasksInRange(tasks: Task[], rangeId: string): Task[] {
  return tasks.filter((t) => t.lists?.includes(rangeId))
}

function ensureRangesFolder(): void {
  const store = useTaskStore.getState()
  if (store.folders.some((f) => f.id === TODO_RANGES_FOLDER)) return
  store.addFolder({
    id: TODO_RANGES_FOLDER,
    name: "To do ranges",
    createdAt: new Date(),
    listIds: [],
    parentFolderId: findNextActionsFolder(store.folders)?.id,
    color: RANGE_COLOR,
  })
}

export function createTodoRange(name: string, end: string, start?: string): string {
  ensureRangesFolder()
  const store = useTaskStore.getState()
  const id = `todo-range-${Date.now().toString(36)}`
  const list: List = { id, name: name.trim() || "Before…", color: RANGE_COLOR, createdAt: new Date() }
  store.addList(list)
  const folder = useTaskStore.getState().folders.find((f) => f.id === TODO_RANGES_FOLDER)
  if (folder) store.updateFolder({ ...folder, listIds: [...folder.listIds, id] })
  const prefs = getTodoPrefs()
  setTodoPrefs({ ranges: [...prefs.ranges, start ? { id, end, start } : { id, end }], activeRangeId: id })
  return id
}

/** Name goes to the List; dates to prefs. A new end carries matching deadlines with it. */
export function updateTodoRange(id: string, patch: { name?: string; end?: string; start?: string | null }): void {
  const store = useTaskStore.getState()
  const list = store.lists.find((l) => l.id === id)
  if (list && patch.name !== undefined && patch.name.trim() && patch.name.trim() !== list.name) {
    store.updateList({ ...list, name: patch.name.trim() })
  }
  const prefs = getTodoPrefs()
  const old = prefs.ranges.find((r) => r.id === id)
  if (!old) return
  const next: TodoRange = { id, end: patch.end ?? old.end }
  const start = patch.start === null ? undefined : (patch.start ?? old.start)
  if (start) next.start = start
  setTodoPrefs({ ranges: prefs.ranges.map((r) => (r.id === id ? next : r)) })
  if (next.end !== old.end) {
    for (const task of tasksInRange(store.tasks, id)) {
      if (task.deadline && formatLocalDateKey(new Date(task.deadline)) === old.end) {
        store.updateTask({ ...task, deadline: rangeEndDate(next) })
      }
    }
  }
}

/** Deletes the List too. Tasks stay; their deadlines stay. */
export function deleteTodoRange(id: string): void {
  const store = useTaskStore.getState()
  if (store.lists.some((l) => l.id === id)) store.deleteList(id)
  const prefs = getTodoPrefs()
  const ranges = prefs.ranges.filter((r) => r.id !== id)
  setTodoPrefs({ ranges, activeRangeId: prefs.activeRangeId === id ? (ranges[0]?.id ?? null) : prefs.activeRangeId })
}

/** Items added on the Lists side pick up the done-before date. */
export function syncRangeDeadlines(tasks: Task[], ranges: TodoRange[]): void {
  const store = useTaskStore.getState()
  for (const range of ranges) {
    for (const task of tasksInRange(tasks, range.id)) {
      if (!task.deadline && !task.completed) store.updateTask({ ...task, deadline: rangeEndDate(range) })
    }
  }
}

export function openTodoRangeList(id: string): void {
  useListsUiStore.getState().setFolderView("list")
  useListsUiStore.getState().setListDisplay(id, "default")
  requestNavigateToList(id, useTaskStore.getState().folders)
}

const DAY = 86_400_000
const dayDiff = (a: Date, b: Date) =>
  Math.round((new Date(a.getFullYear(), a.getMonth(), a.getDate()).getTime() - new Date(b.getFullYear(), b.getMonth(), b.getDate()).getTime()) / DAY)

/** "today", "this week", "before album release" — the phrase after the title word. */
export function todoViewPhrase(view: TodoTitleView, focused: Date, now: Date, rangeName?: string): string {
  if (view === "other") return rangeName ? `before ${rangeName}` : "before…"
  if (view === "day") {
    const d = dayDiff(focused, now)
    if (d === 0) return "today"
    if (d === 1) return "tomorrow"
    if (d === -1) return "yesterday"
    return `on ${focused.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" })}`
  }
  if (view === "week") {
    const w = getWeekString(focused)
    if (w === getWeekString(now)) return "this week"
    if (w === getWeekString(new Date(now.getTime() + 7 * DAY))) return "next week"
    if (w === getWeekString(new Date(now.getTime() - 7 * DAY))) return "last week"
    return `the week of ${focused.toLocaleDateString(undefined, { month: "short", day: "numeric" })}`
  }
  if (view === "month") {
    const m = formatLocalMonthKey(focused)
    if (m === formatLocalMonthKey(now)) return "this month"
    if (m === formatLocalMonthKey(new Date(now.getFullYear(), now.getMonth() + 1, 1))) return "next month"
    if (m === formatLocalMonthKey(new Date(now.getFullYear(), now.getMonth() - 1, 1))) return "last month"
    return `in ${focused.toLocaleDateString(undefined, { month: "long", year: "numeric" })}`
  }
  const q = quarterKey(focused)
  return q === quarterKey(now) ? "this season" : `in ${quarterLabel(q)}`
}

export function todoTitle(
  view: TodoTitleView,
  focused: Date,
  prefs: { titleBase: string; titleByView: Partial<Record<TodoTitleView, string>> },
  rangeName?: string,
  now = new Date(),
): string {
  return prefs.titleByView[view] ?? `${prefs.titleBase} ${todoViewPhrase(view, focused, now, rangeName)}`
}
