/**
 * lib/ingest/apply-menu.ts — `today menu` / `week menu` / `month menu` / `season menu`
 *
 * A numbered phone menu for one period: date header, quote of the day (a
 * random open item on the Quotes list, `lib/quotes-list.ts`), reminders that
 * fall in the period, then 1 To-do · 2 Habits · 3 Plan · 4 Summary.
 *
 * The open menu is a `menu` pending clarify. It only claims replies that read
 * as menu answers (numbers, action lines, help / back / menu / x, or text on a
 * screen that is waiting for text). Anything else closes the menu and runs as
 * an ordinary message. A menu older than six hours is closed the same way.
 *
 * To-do numbers are a snapshot taken when the list is first shown; new tasks
 * are appended, done tasks keep their number. Habit numbers are the position
 * among all of the period's habits, so a done habit leaves a gap.
 * Season to-dos are the three months rolled up; a task added from the season
 * menu is scheduled on the current month.
 */
import { createScheduledTodoTask } from "@/components/Home/ToDo/todo-utils"
import { formatAppendLog } from "@/lib/append-log"
import { isClearedFromWork } from "@/lib/completion-status"
import {
  formatLocalDateKey,
  formatLocalMonthKey,
  getWeekString,
  taskScheduledInMonth,
  taskScheduledInWeek,
  taskScheduledOnDay,
} from "@/lib/date-utils"
import { appendDayNote, getDayNote, setDayNotePersist, summaryProse } from "@/lib/day-notes-persist"
import { exemptionTest } from "@/lib/habit-exemption"
import { isHabitGoalMet } from "@/lib/habit-utils"
import { useHabitsStore } from "@/lib/habits-store"
import { itemTitleOrUntitled } from "@/lib/item-utils"
import { applyTodoWalkSlots, formatTodoWalkCurrent, parseTodoWalkReply } from "@/lib/morning-todo-walk"
import { startWorkingOnOperation } from "@/lib/operation-work-session"
import { appendPlanEntry, getPlanEntries } from "@/lib/plan-text"
import { ensureQuotesList, pickQuote, QUOTES_LIST_NAME } from "@/lib/quotes-list"
import { findRemindersList, formatReminderWhen, reminderInstant } from "@/lib/reminders"
import { getPeriodKey, periodLabel, useReviewsStore } from "@/lib/reviews-store"
import { monthsOfSeason, monthSummaryKeyFromDate, seasonSummaryKey, weekSummaryKey } from "@/lib/tracking-summaries"
import { useTaskStore } from "@/lib/task-store"
import { patchTodoCommitment, periodDayBounds, taskIsPrioritized, taskIsRequired, todoPeriodKey } from "@/lib/todo-commitment"
import { TaskType, type Task, type TaskCompletion, type WeeklyTask } from "@/lib/types"
import { useWorkSessionStore } from "@/lib/work-session-store"
import { writeHabit } from "./apply-habit"
import { finishTodo } from "./apply-todos"
import { parseExpectedWhen } from "./times"
import type { ApplyResult, MenuPeriod, MenuScreen, MenuState, PendingClarify } from "./types"

export const MENU_TTL_MS = 6 * 60 * 60 * 1000

const PERIOD_WORD: Record<MenuPeriod, string> = {
  day: "TODAY",
  week: "THIS WEEK",
  month: "THIS MONTH",
  quarter: "THIS SEASON",
}

const PERIOD_NOUN: Record<MenuPeriod, string> = { day: "day", week: "week", month: "month", quarter: "season" }

const NAV_FOOTER = "BACK · MENU · X to close"

/** Whole-message trigger: `today menu`, `day menu`, `week menu`, `month menu`, `season menu`. */
export function menuPeriodFromText(text: string): MenuPeriod | null {
  const t = text.trim().toLowerCase().replace(/[.!?]+$/, "").replace(/\s+/g, " ")
  if (t === "today menu" || t === "day menu") return "day"
  if (t === "week menu") return "week"
  if (t === "month menu") return "month"
  if (t === "season menu") return "quarter"
  return null
}

export function openMenu(period: MenuPeriod, now = new Date()): ApplyResult {
  const state: MenuState = { period, periodKey: getPeriodKey(period, now), anchor: now.toISOString(), screen: "home" }
  return show(state, homeText(state, now), now)
}

/** Is this reply the menu's to answer? False closes the menu and lets the message run normally. */
export function menuClaims(pending: PendingClarify, text: string, now = new Date()): boolean {
  const menu = pending.menu
  if (!menu) return false
  if (now.getTime() - new Date(pending.createdAt).getTime() > MENU_TTL_MS) return false
  const t = text.trim()
  if (!t) return false
  if (menuPeriodFromText(t)) return false
  if (isNav(t) || /^help$/i.test(t)) return true
  switch (menu.screen) {
    case "home":
      return /^[1-4]$/.test(t)
    case "todo":
    case "todo-help":
      return /^\d/.test(t)
    case "habits":
    case "habits-help":
      return /^\d/.test(t)
    case "plan":
    case "summary":
      return /^\d/.test(t)
    default:
      // Screens that asked for text, numbers, or detail slots take anything.
      return true
  }
}

export function advanceMenu(pending: PendingClarify, text: string, now = new Date()): ApplyResult {
  const menu: MenuState = { ...pending.menu!, todoIds: pending.menu?.todoIds ? [...pending.menu.todoIds] : undefined }
  const t = text.trim()
  const lower = t.toLowerCase()

  if (/^(x|exit|close|quit|done)$/.test(lower)) {
    return { status: "ok", kind: "menu", reply: "Menu closed. Send today menu to open it again.", summary: "Menu closed" }
  }
  if (lower === "menu") return show({ ...menu, screen: "home" }, homeText(menu, now), now)
  if (lower === "back" || lower === "b" || lower === "0") return back(menu, now)

  switch (menu.screen) {
    case "home":
      return homeAnswer(menu, t, now)
    case "todo":
    case "todo-help":
      if (lower === "help") return show({ ...menu, screen: "todo-help" }, todoHelp(menu), now)
      return todoAnswer(menu, t, now)
    case "todo-add":
      return todoAnswer(menu, `1. ${t}`, now)
    case "todo-op":
      return todoAnswer(menu, `${menu.op}. ${t}`, now)
    case "todo-detail":
      if (lower === "help") return show(menu, detailPrompt(menu, now), now)
      return detailAnswer(menu, t, now)
    case "habits":
    case "habits-help":
      if (lower === "help") return show({ ...menu, screen: "habits-help" }, habitsHelp(menu), now)
      return habitsAnswer(menu, t, now)
    case "plan":
      if (lower === "help") return show(menu, planHelp(menu), now)
      return planAnswer(menu, t, now)
    case "plan-add":
      return addPlan(menu, t, now)
    case "summary":
      if (lower === "help") return show(menu, summaryHelp(menu), now)
      return summaryAnswer(menu, t, now)
    case "summary-add":
      return writeSummary(menu, t, "add", now)
    case "summary-replace":
      return writeSummary(menu, t, "replace", now)
  }
}

// ── Shared ────────────────────────────────────────────────────────────

function isNav(t: string): boolean {
  return /^(x|exit|close|quit|done|menu|back|b|0)$/i.test(t)
}

function show(menu: MenuState, reply: string, now: Date): ApplyResult {
  return {
    status: "needs_clarify",
    kind: "menu",
    reply,
    pending: { kind: "menu", query: "", candidates: [], createdAt: now.toISOString(), menu },
  }
}

function back(menu: MenuState, now: Date): ApplyResult {
  switch (menu.screen) {
    case "todo-add":
    case "todo-op":
    case "todo-detail":
    case "todo-help":
      return show({ ...menu, screen: "todo", op: undefined, queue: undefined }, todoText(menu, now), now)
    case "habits-help":
      return show({ ...menu, screen: "habits" }, habitsText(menu), now)
    case "plan-add":
      return show({ ...menu, screen: "plan" }, planText(menu, now), now)
    case "summary-add":
    case "summary-replace":
      return show({ ...menu, screen: "summary" }, summaryText(menu), now)
    default:
      return show({ ...menu, screen: "home" }, homeText(menu, now), now)
  }
}

function anchorOf(menu: MenuState): Date {
  return new Date(menu.anchor)
}

function shortDate(d: Date): string {
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" })
}

/** `Thursday Oct 15 2026` · `Week of Oct 12 2026 (Oct 12 – Oct 18)` · `October 2026` · `Fall 2026`. */
export function menuHeader(menu: Pick<MenuState, "period" | "periodKey" | "anchor">): string {
  const anchor = new Date(menu.anchor)
  if (menu.period === "day") {
    const weekday = anchor.toLocaleDateString("en-US", { weekday: "long" })
    return `${weekday} ${shortDate(anchor)} ${anchor.getFullYear()}`
  }
  if (menu.period === "week") {
    const { start, end } = periodDayBounds("week", anchor)
    return `Week of ${shortDate(start)} ${start.getFullYear()} (${shortDate(start)} – ${shortDate(end)})`
  }
  return periodLabel(menu.period, menu.periodKey)
}

function titleLine(menu: MenuState, what: string): string {
  const scope = menu.period === "day" ? `${PERIOD_WORD.day} (${shortDate(anchorOf(menu))})` : PERIOD_WORD[menu.period]
  return `${what} · ${scope}`
}

function parseNumbers(text: string): number[] {
  return text
    .split(/[\s,]+/)
    .map((part) => part.trim())
    .filter(Boolean)
    .map(Number)
    .filter((n) => Number.isInteger(n) && n > 0)
}

// ── Home ──────────────────────────────────────────────────────────────

function homeText(menu: MenuState, now: Date): string {
  ensureQuotesList(now)
  const quote = pickQuote()
  const reminders = periodReminders(menu, now)
  const lines = [
    `${menuHeader(menu)}`,
    "",
    "QUOTE OF THE DAY",
    quote ?? `(Your ${QUOTES_LIST_NAME} list is empty. Add one quote per item.)`,
    "",
    "REMINDERS",
    ...(reminders.length ? reminders : ["None."]),
    "",
    "Reply with a number:",
    "1. To-do list",
    "2. Habits",
    "3. Plan",
    "4. Summary",
    "",
    "X to close",
  ]
  return lines.join("\n")
}

function homeAnswer(menu: MenuState, t: string, now: Date): ApplyResult {
  if (t === "1") return show({ ...menu, screen: "todo" }, todoText(menu, now), now)
  if (t === "2") return show({ ...menu, screen: "habits" }, habitsText(menu), now)
  if (t === "3") return show({ ...menu, screen: "plan" }, planText(menu, now), now)
  if (t === "4") return show({ ...menu, screen: "summary" }, summaryText(menu), now)
  return show(menu, `Reply 1, 2, 3, or 4.\n\n${homeText(menu, now)}`, now)
}

function periodReminders(menu: MenuState, now: Date): string[] {
  const { tasks, lists } = useTaskStore.getState()
  const list = findRemindersList(lists)
  if (!list) return []
  const bounds = periodDayBounds(menu.period, anchorOf(menu))
  const start = bounds.start.getTime()
  const end = new Date(bounds.end.getFullYear(), bounds.end.getMonth(), bounds.end.getDate() + 1).getTime()
  const rows: { at: Date; name: string }[] = []
  for (const task of tasks) {
    if (!task.lists?.includes(list.id) || isClearedFromWork(task)) continue
    const at = reminderInstant(task)
    if (!at || at.getTime() < start || at.getTime() >= end) continue
    rows.push({ at, name: itemTitleOrUntitled(task) })
  }
  void now
  rows.sort((a, b) => a.at.getTime() - b.at.getTime())
  return rows.map((row) => {
    const when = formatReminderWhen(row.at)
    return `• ${menu.period === "day" ? when.split(" · ")[1] : when} — ${row.name}`
  })
}

// ── To-do ─────────────────────────────────────────────────────────────

function periodTasks(menu: MenuState): Task[] {
  const anchor = anchorOf(menu)
  const week = getWeekString(anchor)
  const months = menu.period === "quarter" ? monthsOfSeason(anchor).map(formatLocalMonthKey) : [formatLocalMonthKey(anchor)]
  return useTaskStore.getState().tasks.filter((task) => {
    if (task.hiddenFromTodo) return false
    if (isClearedFromWork(task) && !task.completed) return false
    if (menu.period === "day") return taskScheduledOnDay(task, anchor)
    if (menu.period === "week") return taskScheduledInWeek(task, week)
    return months.some((month) => taskScheduledInMonth(task, month))
  })
}

/** Keep earlier numbers; append tasks that are new to the period. */
function syncTodoIds(menu: MenuState): string[] {
  const tasks = periodTasks(menu)
  const live = new Set(tasks.map((t) => t.id))
  const kept = (menu.todoIds ?? []).filter((id) => live.has(id))
  const fresh = tasks.filter((t) => !kept.includes(t.id)).sort((a, b) => Number(a.completed) - Number(b.completed))
  menu.todoIds = [...kept, ...fresh.map((t) => t.id)]
  return menu.todoIds
}

function markPeriod(menu: MenuState) {
  return { period: menu.period, key: todoPeriodKey(menu.period, anchorOf(menu)) }
}

function todoLine(menu: MenuState, task: Task, n: number): string {
  const { period, key } = markPeriod(menu)
  const priorityIds =
    period === "day" ? useReviewsStore.getState().getMorningReview(menu.periodKey)?.priorityTaskIds : undefined
  const tags: string[] = []
  if (taskIsPrioritized(task, period, key, priorityIds)) tags.push("priority")
  if (taskIsRequired(task, period, key)) tags.push("required")
  if (useWorkSessionStore.getState().session?.operationId === task.id) tags.push("working now")
  const name = itemTitleOrUntitled(task)
  if (task.completed) return `${n}. ✓ ${name}`
  return tags.length ? `${n}. ${name} — ${tags.join(", ")}` : `${n}. ${name}`
}

function todoText(menu: MenuState, now: Date, notes: string[] = []): string {
  const ids = syncTodoIds(menu)
  const byId = new Map(useTaskStore.getState().tasks.map((t) => [t.id, t]))
  const rows = ids.map((id, i) => ({ task: byId.get(id), n: i + 1 })).filter((row) => row.task)
  void now
  const lines: string[] = []
  if (notes.length) lines.push(...notes, "")
  lines.push(titleLine(menu, "TO-DO"))
  if (!rows.length) lines.push("Nothing on the list yet.")
  else for (const row of rows) lines.push(todoLine(menu, row.task!, row.n))
  lines.push(
    "",
    "Start a line with an action number:",
    "1. Add tasks",
    "2. Prioritize",
    "3. Require",
    "4. Mark done",
    "5. Working on now",
    "6. Add details",
    "",
    "e.g. 4. 2, 5 ~9pm",
    `HELP · ${NAV_FOOTER}`,
  )
  return lines.join("\n")
}

function todoHelp(menu: MenuState): string {
  const noun = PERIOD_NOUN[menu.period]
  const seasonNote = menu.period === "quarter" ? "\n(Tasks added here go on this month.)" : ""
  return `TO-DO HELP
Start each line with an action number. Send as many lines as you like; they run top to bottom.

1. Add tasks — text after "1." is a task. Every line under it is another task, until the next action line.${seasonNote}
2. Prioritize — task numbers with commas: 2. 3, 4
3. Require — 3. 4, 7
   Undo either with a minus: 2. -3
4. Mark done — 4. 2, 8 ~9pm
   A number alone = done now. Put a time after the number for when you finished; ~ means estimated.
5. Working on now — 5. 4  (starts the clock; send stop to end it)
6. Add details — 6. 1, 3 walks you through those tasks (6. alone = every open task): time, points, why.

Example:
1. mow lawn
clean house
2. 3, 4
3. 4, 7
4. 2, 8 ~9pm
5. 4
6.
→ adds 2 tasks, prioritizes 3 & 4, requires 4 & 7, marks 2 done now and 8 done ~9pm, starts 4, then asks for details.

Numbers stay put for this ${noun}'s list while the menu is open.
${NAV_FOOTER}`
}

interface TodoOp {
  op: number
  lines: string[]
}

function splitOps(text: string): TodoOp[] | null {
  const ops: TodoOp[] = []
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim()
    if (!line) continue
    const head = /^([1-6])\s*[.)](?:\s+|$)(.*)$/.exec(line)
    if (head) {
      ops.push({ op: Number(head[1]), lines: head[2]!.trim() ? [head[2]!.trim()] : [] })
      continue
    }
    if (!ops.length) return null
    ops[ops.length - 1]!.lines.push(line)
  }
  return ops.length ? ops : null
}

const OP_ASK: Record<number, string> = {
  1: "Send the tasks to add, one per line.",
  2: "Which numbers to prioritize? e.g. 3, 4",
  3: "Which numbers to require? e.g. 4, 7",
  4: "Which numbers are done? e.g. 2, 8 ~9pm",
  5: "Which number are you working on now?",
}

function todoAnswer(menu: MenuState, text: string, now: Date): ApplyResult {
  const bare = /^([1-6])$/.exec(text.trim())
  if (bare && menu.screen !== "todo-op") {
    const op = Number(bare[1])
    if (op === 6) return startDetails(menu, [], now)
    return show({ ...menu, screen: op === 1 ? "todo-add" : "todo-op", op }, `${OP_ASK[op]}\n${NAV_FOOTER}`, now)
  }
  const ops = splitOps(text)
  if (!ops) {
    return show({ ...menu, screen: "todo" }, todoText(menu, now, ["Start the line with an action number, like 1. or 4. — or send HELP."]), now)
  }
  const ids = syncTodoIds(menu)
  const notes: string[] = []
  let detailNums: number[] | null = null
  const store = () => useTaskStore.getState()
  const taskAt = (n: number) => {
    const id = ids[n - 1]
    return id ? store().tasks.find((t) => t.id === id) : undefined
  }

  for (const { op, lines } of ops) {
    if (op === 1) {
      const added = lines.map((l) => l.replace(/^[-*•]\s*/, "").trim()).filter(Boolean)
      if (!added.length) notes.push("1. needs task text after it.")
      for (const line of added) {
        const anchor = anchorOf(menu)
        const task = createScheduledTodoTask({
          description: line,
          period: menu.period === "quarter" ? "month" : menu.period,
          date: anchor,
        })
        store().addTask(task)
        ids.push(task.id)
      }
      if (added.length) notes.push(`Added: ${added.join(", ")}`)
      continue
    }
    if (op === 2 || op === 3) {
      const flag = op === 2 ? "prioritized" : "required"
      const on: number[] = []
      const off: number[] = []
      for (const token of lines.join(",").split(/[\s,]+/).filter(Boolean)) {
        const neg = token.startsWith("-")
        const n = Number(token.replace(/^-/, ""))
        const task = Number.isInteger(n) ? taskAt(n) : undefined
        if (!task) {
          notes.push(`No task ${token.replace(/^-/, "")}.`)
          continue
        }
        const { period, key } = markPeriod(menu)
        store().updateTask(patchTodoCommitment(task, period, key, { [flag]: !neg }))
        ;(neg ? off : on).push(n)
      }
      const word = op === 2 ? "Prioritized" : "Required"
      if (on.length) notes.push(`${word}: ${on.join(", ")}`)
      if (off.length) notes.push(`No longer ${word.toLowerCase()}: ${off.join(", ")}`)
      if (!on.length && !off.length && !lines.length) notes.push(`${op}. needs task numbers after it.`)
      continue
    }
    if (op === 4) {
      const items = lines.join(",").split(",").map((s) => s.trim()).filter(Boolean)
      if (!items.length) notes.push("4. needs task numbers after it.")
      for (const item of items) {
        const m = /^(\d+)\s*(.*)$/.exec(item)
        const task = m ? taskAt(Number(m[1])) : undefined
        if (!m || !task) {
          notes.push(`No task ${item}.`)
          continue
        }
        if (task.completed) {
          notes.push(`${m[1]} was already done.`)
          continue
        }
        const when = parseDoneTime(m[2]!, now)
        if (when === "bad") {
          notes.push(`“${m[2]}” is not a time (task ${m[1]}).`)
          continue
        }
        finishTodo(task.id, when?.at ?? now, when?.estimated ?? false, now)
        notes.push(`Done: ${m[1]}. ${itemTitleOrUntitled(task)}${when ? ` at ${when.label}` : ""}`)
      }
      continue
    }
    if (op === 5) {
      const n = parseNumbers(lines.join(","))[0]
      const task = n ? taskAt(n) : undefined
      if (!task) {
        notes.push(n ? `No task ${n}.` : "5. needs one task number.")
        continue
      }
      const session = startWorkingOnOperation(task.id, now)
      notes.push(session ? `Working on now: ${n}. ${itemTitleOrUntitled(task)} (send stop to end)` : `Could not start ${n}.`)
      continue
    }
    if (op === 6) detailNums = parseNumbers(lines.join(","))
  }

  menu.todoIds = ids
  if (detailNums) return startDetails({ ...menu, screen: "todo" }, detailNums, now, notes)
  return show({ ...menu, screen: "todo", op: undefined }, todoText(menu, now, notes), now)
}

function parseDoneTime(raw: string, now: Date): { at: Date; estimated: boolean; label: string } | null | "bad" {
  let text = raw.trim()
  if (!text) return null
  let estimated = false
  if (text.startsWith("~")) {
    estimated = true
    text = text.slice(1).trim()
  }
  const flag = /^(.*?)\s*-?(?:est|estimated|e)$/i.exec(text)
  if (flag && flag[1] !== undefined && /\d/.test(flag[1])) {
    estimated = true
    text = flag[1].trim()
  }
  if (text.endsWith("~")) {
    estimated = true
    text = text.slice(0, -1).trim()
  }
  const compact = text.replace(/\s+(am|pm|a\.m\.|p\.m\.)$/i, "$1")
  const when = parseExpectedWhen(compact) ?? parseExpectedWhen(text)
  if (!when || when.minutes == null) return "bad"
  const at = new Date(now.getFullYear(), now.getMonth(), now.getDate(), Math.floor(when.minutes / 60), when.minutes % 60)
  const h = at.getHours()
  const label = `${estimated ? "~" : ""}${h % 12 || 12}:${String(at.getMinutes()).padStart(2, "0")} ${h < 12 ? "AM" : "PM"}`
  return { at, estimated, label }
}

// ── To-do details (6.) ────────────────────────────────────────────────

function startDetails(menu: MenuState, nums: number[], now: Date, notes: string[] = []): ApplyResult {
  const ids = syncTodoIds(menu)
  const tasks = useTaskStore.getState().tasks
  const picked = nums.length
    ? nums.map((n) => ids[n - 1]).filter((id): id is string => !!id)
    : ids.filter((id) => !tasks.find((t) => t.id === id)?.completed)
  if (!picked.length) {
    return show({ ...menu, screen: "todo" }, todoText(menu, now, [...notes, "No open tasks to add details to."]), now)
  }
  const next: MenuState = { ...menu, screen: "todo-detail", queue: picked, queueTotal: picked.length }
  return show(next, [...notes, ...(notes.length ? [""] : []), detailPrompt(next, now)].join("\n"), now)
}

function detailPrompt(menu: MenuState, now: Date): string {
  const id = menu.queue?.[0]
  const task = id ? useTaskStore.getState().tasks.find((t) => t.id === id) : undefined
  if (!task) return "Nothing left to detail."
  void now
  const total = menu.queueTotal ?? menu.queue!.length
  const at = total - menu.queue!.length + 1
  const n = (menu.todoIds ?? []).indexOf(task.id) + 1
  return `DETAILS ${at} of ${total} · ${n ? `${n}. ` : ""}${itemTitleOrUntitled(task)}
${formatTodoWalkCurrent(task)}

Line 1 — six values, a dash keeps one:
tier  minutes  points  importance  resistance  excitement
e.g. A 30 10 7 3 6   (tiers A+ A A/B B C D; last three 0–10)
Line 2 (optional) — why you're doing it.
Just the why? Send why: …

SKIP · SKIP ALL · BACK`
}

function detailAnswer(menu: MenuState, text: string, now: Date): ApplyResult {
  const queue = [...(menu.queue ?? [])]
  const id = queue[0]
  const store = useTaskStore.getState()
  const task = id ? store.tasks.find((t) => t.id === id) : undefined
  const lower = text.trim().toLowerCase()
  if (!task || lower === "skip all") return finishDetails(menu, now, lower === "skip all" ? "Skipped the rest." : "")
  if (lower === "skip") return nextDetail(menu, queue, now, "Skipped.")

  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean)
  let why: string | null = null
  let slotsLine: string | null = null
  for (const line of lines) {
    const w = /^why\s*[:\-]\s*(.+)$/i.exec(line)
    if (w) why = w[1]!.trim()
    else if (slotsLine == null) slotsLine = line
    else why = why ? `${why} ${line}` : line
  }
  let next: Task = task
  if (slotsLine) {
    const parsed = parseTodoWalkReply(slotsLine)
    if (!parsed.ok) {
      // A lone free-text line is the why, not six bad slots.
      if (lines.length === 1 && !/\d/.test(slotsLine)) why = slotsLine
      else return show(menu, `${parsed.error}\n\n${detailPrompt(menu, now)}`, now)
    } else {
      next = applyTodoWalkSlots(next, parsed.slots, formatLocalDateKey(now), now, "morning-telegram")
    }
  }
  if (why) next = { ...next, notes: next.notes?.trim() ? `${next.notes.trim()}\nWhy: ${why}` : `Why: ${why}` }
  store.updateTask(next)
  return nextDetail(menu, queue, now, `Saved: ${itemTitleOrUntitled(task)}`)
}

function nextDetail(menu: MenuState, queue: string[], now: Date, note: string): ApplyResult {
  const rest = queue.slice(1)
  if (!rest.length) return finishDetails(menu, now, note)
  const next = { ...menu, queue: rest }
  return show(next, `${note}\n\n${detailPrompt(next, now)}`, now)
}

function finishDetails(menu: MenuState, now: Date, note: string): ApplyResult {
  const next: MenuState = { ...menu, screen: "todo", queue: undefined, queueTotal: undefined }
  return show(next, todoText(next, now, [note, "Details done."].filter(Boolean)), now)
}

// ── Habits ────────────────────────────────────────────────────────────

const HABIT_FREQUENCY: Record<MenuPeriod, NonNullable<WeeklyTask["frequency"]>> = {
  day: "daily",
  week: "weekly",
  month: "monthly",
  quarter: "quarterly",
}

function periodHabits(menu: MenuState): { habit: WeeklyTask; n: number }[] {
  const { tasks, habitExemptions } = useHabitsStore.getState()
  const frequency = HABIT_FREQUENCY[menu.period]
  const exempt = exemptionTest(habitExemptions, frequency)
  const key = habitKey(menu)
  return tasks
    .filter((habit) => (habit.frequency ?? "daily") === frequency)
    .map((habit, i) => ({ habit, n: i + 1 }))
    .filter(({ habit }) => !exempt(habit, key))
}

function habitKey(menu: MenuState): string {
  const anchor = anchorOf(menu)
  if (menu.period === "day") return formatLocalDateKey(anchor)
  return getPeriodKey(menu.period, anchor)
}

function habitCell(menu: MenuState, habit: WeeklyTask): TaskCompletion | undefined {
  const s = useHabitsStore.getState()
  const bucket =
    menu.period === "day"
      ? s.weeklyData
      : menu.period === "week"
        ? s.weeklyHabitData
        : menu.period === "month"
          ? s.monthlyHabitData
          : s.quarterlyHabitData
  return bucket[habitKey(menu)]?.[habit.id]
}

function habitDone(menu: MenuState, habit: WeeklyTask): boolean {
  const cell = habitCell(menu, habit)
  if (menu.period === "day") {
    const s = useHabitsStore.getState()
    return isHabitGoalMet(habit, cell, { date: anchorOf(menu), weeklyData: s.weeklyData })
  }
  return isHabitGoalMet(habit, cell)
}

function habitProgress(menu: MenuState, habit: WeeklyTask): string {
  const cell = habitCell(menu, habit)
  const unit = habit.unit ? ` ${habit.unit}` : ""
  if (habit.type === TaskType.BOOLEAN) return "not done"
  if (habit.type === TaskType.TEXT) return cell?.text?.trim() ? cell.text.trim() : "nothing yet"
  const value = cell?.value ?? 0
  const goal = cell?.goal ?? habit.goal
  return goal ? `${value} / ${goal}${unit}` : `${value}${unit}`
}

function habitsText(menu: MenuState, notes: string[] = []): string {
  const rows = periodHabits(menu)
  const label = menu.period === "day" ? "DAILY HABITS" : `${PERIOD_NOUN[menu.period].toUpperCase()} HABITS`
  const lines: string[] = []
  if (notes.length) lines.push(...notes, "")
  lines.push(titleLine(menu, label))
  if (!rows.length) {
    lines.push(`No ${HABIT_FREQUENCY[menu.period]} habits.`, "", NAV_FOOTER)
    return lines.join("\n")
  }
  const open = rows.filter(({ habit }) => !habitDone(menu, habit))
  const done = rows.filter(({ habit }) => habitDone(menu, habit))
  lines.push(open.length ? `${open.length} of ${rows.length} left` : "All done ✓")
  for (const { habit, n } of open) lines.push(`${n}. ${habit.name} — ${habitProgress(menu, habit)}`)
  if (done.length) lines.push(`Done: ${done.map(({ n }) => n).join(", ")}`)
  lines.push("", "Reply:", "1, 3 → mark done", "3 = 18 → set a value", "", `HELP · ${NAV_FOOTER}`)
  return lines.join("\n")
}

function habitsHelp(menu: MenuState): string {
  const noun = PERIOD_NOUN[menu.period]
  return `HABITS HELP
Numbers stay the same all ${noun}. A done habit drops off the list and leaves a gap (1, 3, 4…).

• Mark done: 1, 3
• Set a value: 3 = 18  (replaces the current value)
• Text habit: 5 = 20 pages of Dune
• Uncheck a yes/no habit: 2 = no
Mix them with commas or new lines: 1, 3 = 18

${NAV_FOOTER}`
}

function habitsAnswer(menu: MenuState, text: string, now: Date): ApplyResult {
  const rows = periodHabits(menu)
  const byN = new Map(rows.map((row) => [row.n, row.habit]))
  const notes: string[] = []
  const items = text.split(/[\n,]+/).map((s) => s.trim()).filter(Boolean)
  for (const item of items) {
    const set = /^(\d+)\s*[=:]\s*(.+)$/.exec(item)
    const targets = set ? [{ n: Number(set[1]), value: set[2]!.trim() }] : parseNumbers(item).map((n) => ({ n, value: "" }))
    if (!set && !/^[\d\s]+$/.test(item)) {
      notes.push(`Couldn't read “${item}”. Use 1, 3 or 3 = 18.`)
      continue
    }
    for (const { n, value } of targets) {
      const habit = byN.get(n)
      if (!habit) {
        notes.push(`No habit ${n}.`)
        continue
      }
      notes.push(`✓ ${writePeriodHabit(menu, habit, value, now)}`)
    }
  }
  return show({ ...menu, screen: "habits" }, habitsText(menu, notes), now)
}

/** Daily habits use the same writer as `habit:`. Week / month / season cells write their own bucket. */
function writePeriodHabit(menu: MenuState, habit: WeeklyTask, value: string, now: Date): string {
  if (menu.period === "day") {
    const result = writeHabit(habit, value, anchorOf(menu))
    return result.status === "ok" ? result.reply : `${habit.name}: not saved`
  }
  const s = useHabitsStore.getState()
  const anchor = anchorOf(menu)
  const lower = value.toLowerCase()
  let patch: TaskCompletion
  let label: string
  if (habit.type === TaskType.BOOLEAN) {
    const off = lower === "no" || lower === "off" || lower === "undo"
    patch = { completed: !off }
    label = off ? "not done" : "done"
  } else if (habit.type === TaskType.TEXT) {
    patch = { text: value || "logged", completed: true }
    label = value || "logged"
  } else {
    const num = /-?\d+(?:\.\d+)?/.exec(value)
    const v = num ? Number(num[0]) : habit.goal || 1
    patch = { value: v, goal: habit.goal ?? 0, ...(num ? {} : { completed: true }) }
    label = `${v}${habit.unit ? ` ${habit.unit}` : ""}`
  }
  if (menu.period === "week") s.updateWeeklyHabitCompletion(habit.id, anchor, patch)
  else if (menu.period === "month") s.updateMonthlyHabitCompletion(habit.id, anchor, patch)
  else s.updateQuarterlyHabitCompletion(habit.id, anchor, patch)
  void now
  return `${habit.name}: ${label}`
}

// ── Plan ──────────────────────────────────────────────────────────────

function planText(menu: MenuState, now: Date, notes: string[] = []): string {
  const entries = getPlanEntries(menu.period, menu.periodKey)
  const lines: string[] = []
  if (notes.length) lines.push(...notes, "")
  lines.push(titleLine(menu, "PLAN"))
  lines.push(entries.length ? formatAppendLog(entries, "all", now) : "No plan yet.")
  lines.push("", "1. Add to the plan", "", `HELP · ${NAV_FOOTER}`)
  return lines.join("\n")
}

function planHelp(menu: MenuState): string {
  return `PLAN HELP
Shows this ${PERIOD_NOUN[menu.period]}'s plan log, newest first, each entry stamped with its date and time.

• 1 — then send the plan as your next message
• 1. go to gym, then write — adds it in one go
Entries are added, never overwritten.

${NAV_FOOTER}`
}

function planAnswer(menu: MenuState, text: string, now: Date): ApplyResult {
  if (text === "1") {
    return show({ ...menu, screen: "plan-add" }, `Send the plan — any length, one message.\n${NAV_FOOTER}`, now)
  }
  const inline = /^1\s*[.)]\s*([\s\S]+)$/.exec(text)
  if (inline) return addPlan(menu, inline[1]!, now)
  return show(menu, planText(menu, now, ["Reply 1 to add to the plan."]), now)
}

function addPlan(menu: MenuState, text: string, now: Date): ApplyResult {
  const body = text.trim()
  const entry = body ? appendPlanEntry(menu.period, menu.periodKey, body, now, { stampSuffix: "from text" }) : null
  const note = entry || body ? "Added to the plan." : "Nothing to add."
  return show({ ...menu, screen: "plan" }, planText(menu, now, [note]), now)
}

// ── Summary ───────────────────────────────────────────────────────────

function summaryKey(menu: MenuState): string {
  const anchor = anchorOf(menu)
  if (menu.period === "day") return formatLocalDateKey(anchor)
  if (menu.period === "week") return weekSummaryKey(anchor)
  if (menu.period === "month") return monthSummaryKeyFromDate(anchor)
  return seasonSummaryKey(anchor)
}

function summaryText(menu: MenuState, notes: string[] = []): string {
  const prose = summaryProse(getDayNote(summaryKey(menu))).trim()
  const lines: string[] = []
  if (notes.length) lines.push(...notes, "")
  lines.push(titleLine(menu, "SUMMARY"))
  lines.push(prose || "Nothing written yet.")
  lines.push("", "1. Add to it", "2. Replace it", "", `HELP · ${NAV_FOOTER}`)
  return lines.join("\n")
}

function summaryHelp(menu: MenuState): string {
  return `SUMMARY HELP
The ${PERIOD_NOUN[menu.period]} summary from Tracking — what actually happened.

• 1 — then send text to add as a new paragraph
• 2 — then send text to replace the whole summary
• 1. text or 2. text does it in one message

${NAV_FOOTER}`
}

function summaryAnswer(menu: MenuState, text: string, now: Date): ApplyResult {
  if (text === "1") return show({ ...menu, screen: "summary-add" }, `Send what to add.\n${NAV_FOOTER}`, now)
  if (text === "2") {
    return show(
      { ...menu, screen: "summary-replace" },
      `Send the new summary. It replaces everything that's there now.\n${NAV_FOOTER}`,
      now,
    )
  }
  const inline = /^([12])\s*[.)]\s*([\s\S]+)$/.exec(text)
  if (inline) return writeSummary(menu, inline[2]!, inline[1] === "1" ? "add" : "replace", now)
  return show(menu, summaryText(menu, ["Reply 1 to add or 2 to replace."]), now)
}

function writeSummary(menu: MenuState, text: string, mode: "add" | "replace", now: Date): ApplyResult {
  const body = text.trim()
  const key = summaryKey(menu)
  if (body) {
    if (mode === "add") appendDayNote(key, body, now)
    else setDayNotePersist(key, body)
  }
  const note = !body ? "Nothing to save." : mode === "add" ? "Added to the summary." : "Summary replaced."
  return show({ ...menu, screen: "summary" }, summaryText(menu, [note]), now)
}

export type { MenuScreen }
