/**
 * lib/ingest/apply-quicklists.ts — `/quicklists` numbered list pulls
 *
 * `/quicklists` shows the menu. `/quicklists 5` or a bare number (the whole
 * message, and only when no clarify is waiting) dumps that slot.
 * Phrases such as "grocery list", "grocery store", and "to do list" are not
 * commands; they stay inbox.
 *
 * Default slots:
 * 1 To do today
 * 2 To do this week (day-scheduled tasks in this week count, same as the desk)
 * 3 To do this month (same roll-up as the desk)
 * 4 Open Next Actions
 * 5 Live grocery list (Settings picker, else the grocery-ish list)
 * 6 Shopping list when it is a different list. If it is the live grocery list,
 *    the next grocery-scored list, else the list named needed, else the next
 *    other list.
 * 7 The list named ISO
 * 8 Undone habits for today (not exempt, goal not met)
 */
import { isClearedFromWork } from "@/lib/completion-status"
import { formatLocalDateKey, formatLocalMonthKey, getWeekString, taskScheduledInMonth, taskScheduledInWeek, taskScheduledOnDay } from "@/lib/date-utils"
import { exemptionTest } from "@/lib/habit-exemption"
import { isHabitGoalMet } from "@/lib/habit-utils"
import { useHabitsStore } from "@/lib/habits-store"
import { isFolderAllItemsCategoryId } from "@/lib/folder-all-items"
import { itemTitleOrUntitled, taskIsNextAction } from "@/lib/item-utils"
import { useTaskStore } from "@/lib/task-store"
import type { List, Task } from "@/lib/types"
import { dumpReadCandidate } from "./apply-read"
import { findGroceryList, groceryScore, openCountOnList } from "./apply-grocery"
import type { ApplyResult } from "./types"

const SLOT_COUNT = 8

interface Slot {
  n: number
  label: string
  count: number
  dump: () => ApplyResult
}

export function applyQuicklists(payload: string, now = new Date()): ApplyResult {
  const text = payload.trim()
  const slots = buildSlots(now)
  if (!text) return menu(slots)
  if (!/^\d+$/.test(text)) {
    return {
      status: "error",
      kind: "quicklists",
      reply: "Send /quicklists, or a number from that menu.",
    }
  }
  const n = Number(text)
  const slot = slots.find((row) => row.n === n)
  if (!slot) {
    return {
      status: "error",
      kind: "quicklists",
      reply: `Quick lists are 1–${SLOT_COUNT}. Send /quicklists for the menu.`,
    }
  }
  const dumped = slot.dump()
  if (dumped.status !== "ok") return dumped
  return { ...dumped, kind: "quicklists", summary: slot.label }
}

function menu(slots: Slot[]): ApplyResult {
  const lines = ["Quick lists", ...slots.map((slot) => `${slot.n}. ${slot.label} (${slot.count})`), "Send a number to open one."]
  return {
    status: "ok",
    kind: "quicklists",
    reply: lines.join("\n"),
    summary: "Quick lists",
  }
}

function buildSlots(now: Date): Slot[] {
  const today = openTodos("day", now)
  const week = openTodos("week", now)
  const month = openTodos("month", now)
  const next = openNextActions()
  const grocery = findGroceryList()
  const shopping = shoppingStandIn(grocery)
  const iso = findNamedList("iso")
  const habits = undoneHabits(now)
  return [
    taskSlot(1, "To do today", today),
    taskSlot(2, "To do this week", week),
    taskSlot(3, "To do this month", month),
    taskSlot(4, "Next actions", next),
    listSlot(5, grocery ? `Grocery · ${grocery.name}` : "Grocery list", grocery, "No grocery list yet. Text groc milk to start one."),
    listSlot(
      6,
      shopping.label,
      shopping.list,
      "No other list to show beside the live grocery list.",
    ),
    listSlot(7, iso ? `ISO · ${iso.name}` : "ISO", iso, "No list named ISO."),
    {
      n: 8,
      label: "Undone habits",
      count: habits.length,
      dump: () => ok(formatHabits(habits)),
    },
  ]
}

function taskSlot(n: number, label: string, tasks: Task[]): Slot {
  return {
    n,
    label,
    count: tasks.length,
    dump: () => ok(formatTasks(label, tasks)),
  }
}

function listSlot(n: number, label: string, list: List | null, empty: string): Slot {
  const count = list ? openCountOnList(list.id) : 0
  return {
    n,
    label,
    count,
    dump: () => {
      if (!list) return ok(empty)
      const dumped = dumpReadCandidate(`list:${list.id}`)
      if (dumped.status !== "ok") return dumped
      return { ...dumped, kind: "quicklists" }
    },
  }
}

function ok(reply: string): ApplyResult {
  return { status: "ok", kind: "quicklists", reply, summary: "Quick list" }
}

function formatTasks(title: string, tasks: Task[]): string {
  if (tasks.length === 0) return `${title}\nNothing open.`
  const lines = [title]
  tasks.forEach((task, i) => lines.push(`${i + 1}. ${itemTitleOrUntitled(task)}`))
  return lines.join("\n")
}

function formatHabits(names: string[]): string {
  if (names.length === 0) return "Undone habits\nNothing undone."
  return ["Undone habits", ...names.map((name, i) => `${i + 1}. ${name}`)].join("\n")
}

function openTodos(period: "day" | "week" | "month", now: Date): Task[] {
  const week = getWeekString(now)
  const month = formatLocalMonthKey(now)
  return useTaskStore.getState().tasks.filter((task) => {
    if (isClearedFromWork(task) || task.hiddenFromTodo) return false
    if (period === "day") return taskScheduledOnDay(task, now)
    if (period === "week") return taskScheduledInWeek(task, week)
    return taskScheduledInMonth(task, month)
  })
}

function openNextActions(): Task[] {
  const { tasks, folders } = useTaskStore.getState()
  return tasks.filter((task) => !isClearedFromWork(task) && taskIsNextAction(task, folders))
}

function userLists(): List[] {
  return useTaskStore.getState().lists.filter((list) => !isFolderAllItemsCategoryId(list.id))
}

function findNamedList(name: string): List | null {
  const want = name.trim().toLowerCase()
  return userLists().find((list) => list.name.trim().toLowerCase() === want) ?? null
}

/**
 * Slot 6. A shopping-named list that is not the live grocery list.
 * When shopping is that live list, use another grocery-scored list, then
 * "needed", then any other list.
 */
function shoppingStandIn(live: List | null): { label: string; list: List | null } {
  const lists = userLists().filter((list) => list.id !== live?.id)
  const shopping = lists.find((list) => /\bshopping\b/i.test(list.name))
  if (shopping) return { label: `Shopping · ${shopping.name}`, list: shopping }
  const otherGrocery = lists
    .filter((list) => groceryScore(list.name) > 0)
    .sort((a, b) => groceryScore(b.name) - groceryScore(a.name) || a.name.localeCompare(b.name))
  if (otherGrocery[0]) {
    return { label: `${otherGrocery[0].name} (shopping list is the live grocery list)`, list: otherGrocery[0] }
  }
  const needed = lists.find((list) => list.name.trim().toLowerCase() === "needed")
  if (needed) return { label: `${needed.name} (shopping list is the live grocery list)`, list: needed }
  if (lists[0]) return { label: `${lists[0].name} (shopping list is the live grocery list)`, list: lists[0] }
  return { label: "Shopping list", list: null }
}

function undoneHabits(now: Date): string[] {
  const { tasks, weeklyData, habitExemptions } = useHabitsStore.getState()
  const dateKey = formatLocalDateKey(now)
  const exempt = exemptionTest(habitExemptions, "daily")
  return tasks
    .filter((habit) => !habit.frequency || habit.frequency === "daily")
    .filter((habit) => !exempt(habit, dateKey))
    .filter((habit) => !isHabitGoalMet(habit, weeklyData[dateKey]?.[habit.id], { date: now, weeklyData }))
    .map((habit) => habit.name)
}
