/**
 * lib/ingest/apply-read.ts — Plain-text dumps of lists, folders, inbox, habits
 *
 * Read-only. Fuzzy-resolves list/folder names the same way write commands
 * resolve pens. Inbox dumps newest capture first. Telegram chunking happens
 * at send time, not here.
 */
import { formatLocalDateKey, toLocalCalendarDate } from "@/lib/date-utils"
import { isFolderAllItemsCategoryId } from "@/lib/folder-all-items"
import { buildFolderTree, isAutoScheduledPeriodFolder, type FolderTreeNode } from "@/lib/folder-tree"
import { useEventStore } from "@/lib/event-store"
import { useHabitsStore } from "@/lib/habits-store"
import { isHabitGoalMet, isGoalType } from "@/lib/habit-utils"
import { incrementalLoggedValue } from "@/lib/incremental-habits"
import { inInboxPartition, sortInboxNewestFirst } from "@/lib/inbox-batch"
import { itemTitleOrUntitled } from "@/lib/item-utils"
import { getChildren } from "@/lib/list-tree"
import { selectOperations } from "@/lib/operations"
import { searchItems } from "@/lib/search"
import { useSleepStore } from "@/lib/sleep-store"
import { sleepMinutes } from "@/lib/sleep-log"
import { useTaskStore } from "@/lib/task-store"
import { useTimeTrackingStore } from "@/lib/time-tracking-store"
import { useWorkSessionStore } from "@/lib/work-session-store"
import { calculateDayPercentageAV } from "@/lib/calculations"
import { exemptionTest } from "@/lib/habit-exemption"
import { TaskType, type Folder, type List, type Task, type TaskCompletion, type WeeklyData, type WeeklyTask } from "@/lib/types"
import { applyMainInfo } from "./apply-glossary"
import { BIM_PING } from "./bim"
import { parkLooseText } from "./apply-iphone-notes"
import { resolveName, type Named } from "./name-resolve"
import { minutesPastMidnight } from "./times"
import type { ApplyResult, IngestIntentKind, NameCandidate, PendingClarify } from "./types"

const SEARCH_CAP = 25
const TAG_CAP = 40

export function applyInfo(): ApplyResult {
  return applyMainInfo()
}

export function applyPing(): ApplyResult {
  return ok("ping", BIM_PING, "Ping")
}

export function applyListsCatalog(): ApplyResult {
  return ok("lists", formatListsCatalog(), "Lists catalog")
}

export function applyFoldersCatalog(): ApplyResult {
  return ok("folders", formatFoldersCatalog(), "Folders catalog")
}

export function applyInboxDump(): ApplyResult {
  return ok("inbox", formatInbox(), "Inbox dump")
}

export function applySearch(payload: string): ApplyResult {
  const query = payload.trim()
  if (!query) {
    return { status: "error", kind: "search", reply: "Search for what? Example: search: milk" }
  }
  return ok("search", formatSearch(query), `Search ${query}`)
}

export function applyHabitsDump(now = new Date()): ApplyResult {
  return ok("habits", formatHabits(now), "Habits dump")
}

export function applyToday(now = new Date()): ApplyResult {
  return ok("today", formatToday(now), "Today snapshot")
}

export function applyStatus(now = new Date()): ApplyResult {
  return ok("status", formatStatus(now), "Status")
}

export function applyOps(): ApplyResult {
  return ok("ops", formatOps(), "Operations")
}

export function applyCount(payload: string): ApplyResult {
  const query = payload.trim()
  if (!query) return ok("count", formatCounts(), "Counts")
  const hit = resolveReadTarget(query, inferForce(query, null))
  if (hit.status === "ok" && hit.target.kind === "list") {
    const counts = listCounts(hit.target.list)
    return ok("count", `${hit.target.list.name}: ${counts.open} open, ${counts.done} done`, `Count ${hit.target.list.name}`)
  }
  if (hit.status === "ok" && hit.target.kind === "folder") {
    return ok("count", formatFolder(hit.target.folder), `Count ${hit.target.folder.name}`)
  }
  if (hit.status === "needs_clarify") return hit.result
  return { status: "error", kind: "count", reply: `Nothing named “${query}”. Send lists.` }
}

export function applyTags(): ApplyResult {
  return ok("tags", formatTags(), "Tags")
}

export function applyPlan(now = new Date()): ApplyResult {
  return ok("plan", formatPlan(now), "Plan")
}

export function applyRead(payload: string, now = new Date()): ApplyResult {
  const peeled = peelReadPayload(payload)
  if (peeled.shortcut) return peeled.shortcut(now)

  const query = peeled.query
  if (!query) {
    return {
      status: "error",
      kind: "read",
      reply: "Name a list. Example: read: grocery list — or send lists / folders / info.",
    }
  }

  const hit = resolveReadTarget(query, inferForce(query, peeled.force))
  if (hit.status === "needs_clarify") return hit.result
  if (hit.status === "none") {
    // Named nothing here, so it was prose, not a lookup. Keep the words the way
    // Mac From Notes does instead of answering with a list of near-misses.
    const parked = parkLooseText(payload, now)
    if (parked.status !== "ok") return parked
    return {
      ...parked,
      reply: `${parked.reply}\n\nNot a list here — open Phone Notes to file or skip it. Send lists to see names.`,
    }
  }
  return dumpTarget(hit.target)
}

export function dumpReadCandidate(candidateId: string): ApplyResult {
  const parsed = parseTargetId(candidateId)
  if (!parsed) {
    return { status: "error", kind: "read", reply: "That pick disappeared. Send lists." }
  }
  if (parsed.kind === "inbox") return applyInboxDump()
  if (parsed.kind === "list") {
    const list = realLists().find((l) => l.id === parsed.id)
    if (!list) return { status: "error", kind: "read", reply: "That list disappeared. Send lists." }
    return ok("read", formatList(list), `Read ${list.name}`, looksGrocery(list.name) ? formatList(list) : undefined)
  }
  const folder = useTaskStore.getState().folders.find((f) => f.id === parsed.id)
  if (!folder) return { status: "error", kind: "read", reply: "That folder disappeared. Send folders." }
  return ok("read", formatFolder(folder), `Read ${folder.name}`)
}

function dumpTarget(target: ReadTarget): ApplyResult {
  if (target.kind === "list") {
    const reply = formatList(target.list)
    return ok("read", reply, `Read ${target.list.name}`, looksGrocery(target.list.name) ? reply : undefined)
  }
  if (target.kind === "folder") return ok("read", formatFolder(target.folder), `Read ${target.folder.name}`)
  return applyInboxDump()
}

type ForceKind = "list" | "folder" | null

type ReadTarget =
  | { kind: "list"; list: List }
  | { kind: "folder"; folder: Folder }
  | { kind: "inbox" }

function inferForce(query: string, force: ForceKind): ForceKind {
  if (force) return force
  const lower = query.trim().toLowerCase()
  const endsList = /(?:^|\s)lists?$/.test(lower)
  const endsFolder = /(?:^|\s)folders?$/.test(lower)
  if (endsList && !endsFolder) return "list"
  if (endsFolder && !endsList) return "folder"
  return null
}

function peelReadPayload(payload: string): {
  query: string
  force: ForceKind
  shortcut?: (now: Date) => ApplyResult
} {
  const text = payload.trim()
  const lower = text.toLowerCase()
  const shortcut = shortcutFor(lower)
  if (shortcut) return { query: "", force: null, shortcut }

  if (/^(folder)\b/.test(lower)) {
    return { query: text.replace(/^(folder)[:\s]*/i, "").trim(), force: "folder" }
  }
  if (/^(list)\b/.test(lower)) {
    return { query: text.replace(/^(list)[:\s]*/i, "").trim(), force: "list" }
  }
  return { query: text, force: null }
}

function shortcutFor(lower: string): ((now: Date) => ApplyResult) | null {
  if (!lower) return null
  if (lower === "inbox" || lower === "in") return () => applyInboxDump()
  if (lower === "lists" || lower === "ls") return () => applyListsCatalog()
  if (lower === "folders" || lower === "dirs") return () => applyFoldersCatalog()
  if (lower === "habits") return applyHabitsDump
  if (lower === "today") return applyToday
  if (lower === "status" || lower === "now" || lower === "where") return applyStatus
  if (lower === "ops" || lower === "operations") return () => applyOps()
  if (lower === "tags") return () => applyTags()
  if (lower === "plan" || lower === "agenda") return applyPlan
  if (lower === "info" || lower === "help") return () => applyInfo()
  if (lower === "count" || lower === "counts") return () => applyCount("")
  return null
}

function resolveReadTarget(
  query: string,
  force: ForceKind,
):
  | { status: "ok"; target: ReadTarget }
  | { status: "none" }
  | { status: "needs_clarify"; result: ApplyResult } {
  const listQuery = stripKindWord(query, ["list", "lists"])
  const folderQuery = stripKindWord(query, ["folder", "folders"])
  const lists = namedLists()
  const folders = namedFolders()

  const listHit = force === "folder" ? { status: "none" as const, query } : bestName(listQuery, query, lists)
  const folderHit = force === "list" ? { status: "none" as const, query } : bestName(folderQuery, query, folders)

  if (listHit.status === "match" && folderHit.status === "match") {
    if (listHit.candidate.score === 1 && folderHit.candidate.score < 1) {
      return listTarget(listHit.candidate.id)
    }
    if (folderHit.candidate.score === 1 && listHit.candidate.score < 1) {
      return folderTarget(folderHit.candidate.id)
    }
    if (listHit.candidate.score - folderHit.candidate.score >= 0.12) {
      return listTarget(listHit.candidate.id)
    }
    if (folderHit.candidate.score - listHit.candidate.score >= 0.12) {
      return folderTarget(folderHit.candidate.id)
    }
    return clarify(
      query,
      [
        { id: targetId("list", listHit.candidate.id), name: `${listHit.candidate.name} (list)`, score: listHit.candidate.score },
        { id: targetId("folder", folderHit.candidate.id), name: `${folderHit.candidate.name} (folder)`, score: folderHit.candidate.score },
      ],
      "list or folder",
    )
  }

  if (listHit.status === "ambiguous" || folderHit.status === "ambiguous") {
    const candidates: NameCandidate[] = []
    if (listHit.status === "ambiguous") {
      candidates.push(
        ...listHit.candidates.map((c) => ({
          ...c,
          id: targetId("list", c.id),
          name: force ? c.name : `${c.name} (list)`,
        })),
      )
    } else if (listHit.status === "match") {
      candidates.push({
        id: targetId("list", listHit.candidate.id),
        name: force ? listHit.candidate.name : `${listHit.candidate.name} (list)`,
        score: listHit.candidate.score,
      })
    }
    if (folderHit.status === "ambiguous") {
      candidates.push(
        ...folderHit.candidates.map((c) => ({
          ...c,
          id: targetId("folder", c.id),
          name: force ? c.name : `${c.name} (folder)`,
        })),
      )
    } else if (folderHit.status === "match") {
      candidates.push({
        id: targetId("folder", folderHit.candidate.id),
        name: force ? folderHit.candidate.name : `${folderHit.candidate.name} (folder)`,
        score: folderHit.candidate.score,
      })
    }
    const noun = force === "folder" ? "folder" : force === "list" ? "list" : "list or folder"
    return clarify(query, candidates.slice(0, 5), noun)
  }

  if (listHit.status === "match") return listTarget(listHit.candidate.id)
  if (folderHit.status === "match") return folderTarget(folderHit.candidate.id)
  return { status: "none" }
}

function bestName(stripped: string, original: string, items: Named[]) {
  const originalHit = resolveName(original, items)
  if (originalHit.status === "match" && originalHit.candidate.score === 1) return originalHit
  if (stripped === original) return originalHit
  const strippedHit = resolveName(stripped, items)
  if (originalHit.status === "match" && (strippedHit.status !== "match" || originalHit.candidate.score >= strippedHit.candidate.score)) {
    return originalHit
  }
  if (strippedHit.status !== "none") return strippedHit
  return originalHit
}

function listTarget(id: string): { status: "ok"; target: ReadTarget } | { status: "none" } {
  const list = realLists().find((l) => l.id === id)
  if (!list) return { status: "none" }
  return { status: "ok", target: { kind: "list", list } }
}

function folderTarget(id: string): { status: "ok"; target: ReadTarget } | { status: "none" } {
  const folder = useTaskStore.getState().folders.find((f) => f.id === id)
  if (!folder) return { status: "none" }
  return { status: "ok", target: { kind: "folder", folder } }
}

function clarify(query: string, candidates: NameCandidate[], noun: string): { status: "needs_clarify"; result: ApplyResult } {
  const list = candidates.map((c, i) => `${i + 1}. ${c.name}`).join("\n")
  const pending: PendingClarify = {
    kind: "read",
    query,
    candidates,
    createdAt: new Date().toISOString(),
  }
  return {
    status: "needs_clarify",
    result: {
      status: "needs_clarify",
      kind: "read",
      reply: `Which ${noun} for “${query}”?\n${list}`,
      pending,
    },
  }
}

function targetId(kind: "list" | "folder" | "inbox", id = ""): string {
  return kind === "inbox" ? "inbox" : `${kind}:${id}`
}

function parseTargetId(raw: string): { kind: "list" | "folder" | "inbox"; id: string } | null {
  if (raw === "inbox") return { kind: "inbox", id: "" }
  const m = raw.match(/^(list|folder):(.+)$/)
  if (!m) return null
  return { kind: m[1] as "list" | "folder", id: m[2] }
}

function stripKindWord(query: string, words: string[]): string {
  const q = query.trim()
  const lower = q.toLowerCase()
  for (const word of words) {
    if (lower === word) return q
    if (lower.endsWith(` ${word}`) && lower.length > word.length + 1) {
      return q.slice(0, -(word.length + 1)).trim()
    }
  }
  return q
}

function realLists(): List[] {
  return useTaskStore.getState().lists.filter((list) => !isFolderAllItemsCategoryId(list.id))
}

function namedLists(): Named[] {
  return realLists().map((list) => ({ id: list.id, name: list.name }))
}

function namedFolders(): Named[] {
  return useTaskStore
    .getState()
    .folders.filter((folder) => !isAutoScheduledPeriodFolder(folder.id))
    .map((folder) => ({ id: folder.id, name: folder.name }))
}

function itemsOnList(listId: string): Task[] {
  return useTaskStore.getState().tasks.filter((task) => task.lists?.includes(listId))
}

function inboxItems(): Task[] {
  return useTaskStore.getState().tasks.filter((task) => task.stage === "inbox" && !task.completed)
}

function listCounts(list: List): { open: number; done: number } {
  const items = itemsOnList(list.id)
  return {
    open: items.filter((item) => !item.completed).length,
    done: items.filter((item) => item.completed).length,
  }
}

function sortByTitle(items: Task[]): Task[] {
  return [...items].sort((a, b) => itemTitleOrUntitled(a).localeCompare(itemTitleOrUntitled(b)) || a.id.localeCompare(b.id))
}

function formatList(list: List): string {
  const items = itemsOnList(list.id)
  const open = sortByTitle(items.filter((item) => !item.completed))
  const done = sortByTitle(items.filter((item) => item.completed))
  const kids = getChildren(useTaskStore.getState().lists, list.id).filter((child) => !isFolderAllItemsCategoryId(child.id))
  const lines = [`${list.name} (${open.length} open, ${done.length} done)`]
  if (kids.length) lines.push(`Sublists: ${kids.map((k) => k.name).join(", ")}`)
  if (open.length === 0 && done.length === 0) {
    lines.push("(empty)")
    return lines.join("\n")
  }
  open.forEach((item, i) => lines.push(...formatItemLines(i + 1, item)))
  if (done.length) {
    lines.push("", "Done:")
    done.forEach((item) => lines.push(`• ${itemTitleOrUntitled(item)}`))
  }
  return lines.join("\n")
}

function formatItemLines(index: number, item: Task): string[] {
  const lines = [`${index}. ${itemTitleOrUntitled(item)}`]
  const subs = item.subtasks
  if (!subs?.length) return lines
  for (const sub of subs) {
    lines.push(`   ${sub.completed ? "[x]" : "[ ]"} ${sub.description}`)
  }
  return lines
}

function formatInbox(): string {
  const items = sortInboxNewestFirst(inboxItems())
  const revisit = items.filter((item) => inInboxPartition(item, "inbox"))
  const monkey = items.filter((item) => inInboxPartition(item, "monkey"))
  if (revisit.length === 0 && monkey.length === 0) return "Inbox is empty."
  const lines: string[] = []
  lines.push(revisit.length === 0 ? "Inbox (0)" : `Inbox (${revisit.length})`)
  revisit.forEach((item, i) => lines.push(...formatItemLines(i + 1, item)))
  if (monkey.length > 0) {
    lines.push("", `Monkey brain (${monkey.length})`)
    monkey.forEach((item, i) => lines.push(...formatItemLines(i + 1, item)))
  }
  return lines.join("\n")
}

function formatFolder(folder: Folder): string {
  const { lists, folders } = useTaskStore.getState()
  const lines = [folder.name]
  const childFolders = folders
    .filter((f) => f.parentFolderId === folder.id && !isAutoScheduledPeriodFolder(f.id))
    .sort((a, b) => a.name.localeCompare(b.name))
  for (const child of childFolders) {
    lines.push(`▸ ${child.name}`)
  }
  const owned = (folder.listIds ?? [])
    .map((id) => lists.find((list) => list.id === id))
    .filter((list): list is List => Boolean(list) && !isFolderAllItemsCategoryId(list.id))
  if (owned.length === 0 && childFolders.length === 0) {
    lines.push("(empty)")
    return lines.join("\n")
  }
  for (const list of owned) {
    const counts = listCounts(list)
    lines.push(`• ${list.name} (${counts.open})`)
  }
  return lines.join("\n")
}

function formatListsCatalog(): string {
  const { lists, folders } = useTaskStore.getState()
  const real = realLists()
  if (real.length === 0) return "No lists yet. Capture with Groceries: milk or send bulk:."

  const inFolder = new Set<string>()
  for (const folder of folders) {
    for (const id of folder.listIds ?? []) inFolder.add(id)
  }

  const lines: string[] = ["Lists"]
  const walk = (nodes: FolderTreeNode[]) => {
    for (const node of nodes) {
      if (isAutoScheduledPeriodFolder(node.folder.id)) continue
      const indent = "  ".repeat(node.depth)
      lines.push(`${indent}${node.folder.name}`)
      const owned = (node.folder.listIds ?? [])
        .map((id) => lists.find((list) => list.id === id))
        .filter((list): list is List => Boolean(list) && !isFolderAllItemsCategoryId(list.id))
      for (const list of owned) {
        const counts = listCounts(list)
        lines.push(`${indent}  • ${list.name} (${counts.open})`)
      }
      walk(node.children)
    }
  }
  walk(buildFolderTree(folders))

  const unfiled = real.filter((list) => !inFolder.has(list.id)).sort((a, b) => a.name.localeCompare(b.name))
  if (unfiled.length) {
    lines.push("Unfiled")
    for (const list of unfiled) {
      const counts = listCounts(list)
      lines.push(`  • ${list.name} (${counts.open})`)
    }
  }
  return lines.join("\n")
}

function formatFoldersCatalog(): string {
  const folders = useTaskStore.getState().folders.filter((folder) => !isAutoScheduledPeriodFolder(folder.id))
  if (folders.length === 0) return "No folders yet."
  const lines: string[] = ["Folders"]
  const walk = (nodes: FolderTreeNode[]) => {
    for (const node of nodes) {
      if (isAutoScheduledPeriodFolder(node.folder.id)) continue
      const indent = "  ".repeat(node.depth)
      const n = (node.folder.listIds ?? []).filter((id) => !isFolderAllItemsCategoryId(id)).length
      lines.push(`${indent}• ${node.folder.name} (${n})`)
      walk(node.children)
    }
  }
  walk(buildFolderTree(useTaskStore.getState().folders))
  return lines.join("\n")
}

function formatSearch(query: string): string {
  const hits = searchItems(query, useTaskStore.getState().tasks).slice(0, SEARCH_CAP)
  if (hits.length === 0) return `No items match “${query}”.`
  const lines = [`Search “${query}” (${hits.length}${hits.length === SEARCH_CAP ? "+" : ""})`]
  hits.forEach((hit, i) => {
    const where = locationLabel(hit.item as Task)
    lines.push(`${i + 1}. ${itemTitleOrUntitled(hit.item)}${where ? ` — ${where}` : ""}`)
  })
  return lines.join("\n")
}

function locationLabel(task: Task): string {
  if (inInboxPartition(task, "monkey")) return "Monkey brain"
  if (task.stage === "inbox") return "Inbox"
  const lists = useTaskStore.getState().lists
  const names = (task.lists ?? [])
    .map((id) => lists.find((list) => list.id === id && !isFolderAllItemsCategoryId(id))?.name)
    .filter((name): name is string => Boolean(name))
  return names.slice(0, 2).join(", ")
}

function formatHabits(now: Date): string {
  const { tasks, weeklyData, habitExemptions } = useHabitsStore.getState()
  const habits = tasks.filter((habit) => !habit.frequency || habit.frequency === "daily")
  if (habits.length === 0) return "No habits."
  const dateKey = formatLocalDateKey(now)
  const dayIndex = (now.getDay() + 6) % 7
  const exempt = exemptionTest(habitExemptions, "daily")
  const required = habits.filter((habit) => !exempt(habit, dateKey))
  const pct =
    required.length === 0
      ? null
      : Math.round(calculateDayPercentageAV(dateKey, habits, weeklyData, dayIndex, exempt))
  const lines = [`Habits ${formatDay(now)} · ${pct === null ? "nothing required" : `${pct}%`}`]
  for (const habit of habits) {
    lines.push(formatHabitLine(habit, weeklyData[dateKey]?.[habit.id], now, weeklyData, exempt(habit, dateKey)))
  }
  return lines.join("\n")
}

function formatHabitLine(
  habit: WeeklyTask,
  completion: TaskCompletion | undefined,
  date: Date,
  weeklyData: WeeklyData,
  exempt = false,
): string {
  if (exempt) return `– ${habit.name} (exempt)`
  const met = isHabitGoalMet(habit, completion, { date, weeklyData })
  const mark = met ? "✓" : "·"
  if (habit.type === TaskType.BOOLEAN) return `${mark} ${habit.name}`
  if (habit.type === TaskType.TEXT) {
    const text = completion?.text?.trim()
    return text ? `${mark} ${habit.name}: ${text}` : `${mark} ${habit.name}`
  }
  if (isGoalType(habit.type)) {
    const value = completion?.value ?? 0
    const goal = habit.goal ?? 0
    const unit = habit.unit ? ` ${habit.unit}` : ""
    return `${mark} ${habit.name} ${value}/${goal}${unit}`
  }
  if (habit.type === TaskType.INCREMENTAL) {
    const value = incrementalLoggedValue(completion)
    const unit = habit.unit ? ` ${habit.unit}` : ""
    return value == null ? `${mark} ${habit.name}` : `${mark} ${habit.name} ${value}${unit}`
  }
  return `${mark} ${habit.name}`
}

function formatToday(now: Date): string {
  const { tasks, weeklyData, habitExemptions } = useHabitsStore.getState()
  const habits = tasks.filter((habit) => !habit.frequency || habit.frequency === "daily")
  const dateKey = formatLocalDateKey(now)
  const dayIndex = (now.getDay() + 6) % 7
  const exempt = exemptionTest(habitExemptions, "daily")
  const required = habits.filter((habit) => !exempt(habit, dateKey))
  const pct =
    required.length === 0
      ? null
      : Math.round(calculateDayPercentageAV(dateKey, habits, weeklyData, dayIndex, exempt))
  const session = useWorkSessionStore.getState().session
  const loc = penAt(now, "location")
  const act = penAt(now, "activity")
  const lines = [
    `Today ${formatDay(now)}`,
    `Inbox: ${inboxItems().filter((item) => inInboxPartition(item, "inbox")).length} open`,
    ...(inboxItems().some((item) => item.monkeyBrain) ? [`Monkey brain: ${inboxItems().filter((item) => item.monkeyBrain).length}`] : []),
    `Habits: ${pct === null ? "nothing required" : `${pct}%`}`,
    loc ? `Location: ${loc}` : "Location: —",
    act ? `Activity: ${act}` : "Activity: —",
  ]
  if (session) lines.push(`Working: ${session.title}`)
  const plan = formatPlan(now)
  if (!plan.startsWith("No events")) {
    lines.push("", plan)
  }
  return lines.join("\n")
}

function formatStatus(now: Date): string {
  const loc = penAt(now, "location")
  const act = penAt(now, "activity")
  const mood = penAt(now, "mood")
  const session = useWorkSessionStore.getState().session
  const night = useSleepStore.getState().getNight(formatLocalDateKey(now))
  const lines = [
    `Now ${formatClock(minutesPastMidnight(now))}`,
    `Location: ${loc ?? "—"}`,
    `Activity: ${act ?? "—"}`,
    `Mood: ${mood ?? "—"}`,
    session ? `Working: ${session.title}` : "Working: —",
  ]
  if (night && (night.sleptMin != null || night.wokeMin != null)) {
    const span = sleepMinutes(night)
    const bed = night.sleptMin != null ? formatClock(night.sleptMin) : "?"
    const wake = night.wokeMin != null ? formatClock(night.wokeMin) : "?"
    const dur = span != null ? ` (${Math.round(span / 60)}h ${span % 60}m)` : ""
    lines.push(`Sleep: ${bed}–${wake}${dur}`)
  }
  const revisit = inboxItems().filter((item) => inInboxPartition(item, "inbox")).length
  const monkey = inboxItems().filter((item) => item.monkeyBrain).length
  lines.push(`Inbox: ${revisit} open`)
  if (monkey) lines.push(`Monkey brain: ${monkey}`)
  return lines.join("\n")
}

function formatOps(): string {
  const ops = selectOperations(useTaskStore.getState().tasks)
  if (ops.length === 0) return "No operations."
  const lines = [`Operations (${ops.length})`]
  for (const op of [...ops].sort((a, b) => itemTitleOrUntitled(a).localeCompare(itemTitleOrUntitled(b)))) {
    lines.push(`• ${itemTitleOrUntitled(op)}`)
  }
  return lines.join("\n")
}

function formatCounts(): string {
  const revisit = inboxItems().filter((item) => inInboxPartition(item, "inbox")).length
  const monkey = inboxItems().filter((item) => item.monkeyBrain).length
  const lines = ["Counts", `Inbox: ${revisit}`]
  if (monkey) lines.push(`Monkey brain: ${monkey}`)
  const real = [...realLists()].sort((a, b) => a.name.localeCompare(b.name))
  for (const list of real) {
    const counts = listCounts(list)
    lines.push(`${list.name}: ${counts.open}`)
  }
  if (real.length === 0) lines.push("(no lists)")
  return lines.join("\n")
}

function formatTags(): string {
  const counts = new Map<string, number>()
  for (const task of useTaskStore.getState().tasks) {
    for (const tag of task.tags ?? []) {
      const name = String(tag).trim()
      if (!name) continue
      counts.set(name, (counts.get(name) ?? 0) + 1)
    }
  }
  if (counts.size === 0) return "No tags in use."
  const ranked = [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).slice(0, TAG_CAP)
  const lines = ["Tags"]
  for (const [name, n] of ranked) lines.push(`• ${name} (${n})`)
  return lines.join("\n")
}

function formatPlan(now: Date): string {
  const key = formatLocalDateKey(now)
  const events = useEventStore
    .getState()
    .events.filter((event) => formatLocalDateKey(toLocalCalendarDate(event.date)) === key)
    .sort((a, b) => (a.startTime || "").localeCompare(b.startTime || "") || a.title.localeCompare(b.title))
  if (events.length === 0) return `No events on ${formatDay(now)}.`
  const lines = [`Plan ${formatDay(now)}`]
  for (const event of events) {
    const when = event.isAllDay ? "all day" : `${event.startTime}–${event.endTime}`
    lines.push(`• ${when} ${event.title}`)
  }
  return lines.join("\n")
}

function penAt(now: Date, scopeId: string): string | null {
  const date = formatLocalDateKey(now)
  const min = minutesPastMidnight(now)
  const entries = useTimeTrackingStore.getState().entriesFor(date, scopeId)
  const hit = entries.find((entry) => entry.startMin <= min && min < entry.endMin)
  if (!hit) return null
  const scope = useTimeTrackingStore.getState().scopes.find((s) => s.id === scopeId)
  const pen = scope?.pens.find((p) => p.id === hit.penId)
  return pen?.name ?? hit.title ?? null
}

function formatClock(min: number): string {
  const wrapped = ((Math.floor(min) % 1440) + 1440) % 1440
  const h = Math.floor(wrapped / 60)
  const m = wrapped % 60
  const am = h < 12
  const h12 = h % 12 || 12
  return `${h12}:${String(m).padStart(2, "0")} ${am ? "AM" : "PM"}`
}

function formatDay(date: Date): string {
  return date.toLocaleDateString("en-GB", { day: "numeric", month: "short" })
}

function looksGrocery(name: string): boolean {
  return /\bgrocery|\bgroceries|\bshopping\b/i.test(name)
}

function ok(kind: IngestIntentKind, reply: string, summary: string, pinText?: string): ApplyResult {
  return pinText ? { status: "ok", kind, reply, summary, pinText } : { status: "ok", kind, reply, summary }
}
