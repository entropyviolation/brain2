/**
 * lib/ingest/apply-bulk.ts — Bulk Add via the same path as the header dialog
 *
 * A grocery-ish header with no other folder (`Grocery list:`, or
 * `Grocery list: grocery list:`) files onto the store list the `groc` command
 * already uses. An open item with the same name is left in place; the reply
 * asks whether to peek, add another, or dismiss.
 */
import { parseSmartCapture } from "@/lib/smart-parse"
import { buildCapturedTask, ensureCaptureTarget } from "@/lib/capture-target"
import { itemTitleOrUntitled } from "@/lib/item-utils"
import { useTaskStore } from "@/lib/task-store"
import type { Task } from "@/lib/types"
import { findGroceryList, groceryDumpText, isGroceryListName } from "./apply-grocery"
import { parseBulkBuckets, type BulkBucket } from "./parse-bulk"
import { taskStoreMutators } from "./apply-capture"
import type { ApplyResult, DuplicateAddEntry, PendingClarify } from "./types"

const SEE_RE = /^(see|peek|look|show)$/
const DISMISS_RE = /^(dismiss|leave|skip|no|nah|nope)$/
const AGAIN_RE = /^(again|yes|y|yup|another|dup|dupe|add|add them|add it|add again)$/

export function stampMustBeDoneBefore<T extends Task>(task: T, due: Date | undefined): T {
  if (!due) return task
  return {
    ...task,
    deadline: due,
    schedulingConstraints: {
      ...task.schedulingConstraints,
      mustBeDoneBefore: due,
    },
  }
}

export function applyBulk(text: string, opts?: { sendToInbox?: boolean; now?: Date }): ApplyResult {
  const now = opts?.now ?? new Date()
  const buckets = parseBulkBuckets(text, now)
  if (buckets.length === 0) {
    return { status: "error", kind: "bulk", reply: "Nothing to bulk-add. Send bulk: then one item per line." }
  }

  const sendToInbox = opts?.sendToInbox ?? false
  const ids: string[] = []
  const groups: ReplyGroup[] = []
  const dupes: DuplicateAddEntry[] = []
  let grocery = false

  for (const bucket of buckets) {
    const dest = destination(bucket)
    if (dest.grocery) grocery = true
    const group = groupFor(groups, dest.listName, bucket.dueBefore)
    for (const line of bucket.lines) {
      const placed = placeLine({
        line,
        folderPath: dest.folderPath,
        listName: dest.listName,
        dueBefore: bucket.dueBefore,
        now,
        sendToInbox,
      })
      if (!placed) continue
      group.listId = placed.listId
      group.listName = placed.listName
      if (placed.grocery) grocery = true
      const open = findOpenDuplicate(placed.listId, placed.title)
      if (open) {
        dupes.push({
          listId: placed.listId,
          listName: placed.listName,
          line,
          dueBefore: bucket.dueBefore?.toISOString(),
          existingId: open.id,
          existingName: itemTitleOrUntitled(open),
        })
        continue
      }
      useTaskStore.getState().addTask(placed.task)
      ids.push(placed.task.id)
      group.added.push(placed.title)
    }
  }

  const addedReply = formatAdded(groups, now)
  if (dupes.length === 0) {
    const reply = addedReply || "Nothing to add."
    return pinGrocery({
      status: "ok",
      kind: "bulk",
      reply,
      summary: summarize(ids.length, groups),
      itemIds: ids,
    }, grocery)
  }

  const pending: PendingClarify = {
    kind: "duplicate",
    query: dupes.map((d) => d.existingName).join(", "),
    candidates: dupes.map((d) => ({ id: d.existingId, name: d.existingName, score: 1 })),
    createdAt: now.toISOString(),
    duplicateAdd: { addedReply, entries: dupes },
  }
  return pinGrocery({
    status: "needs_clarify",
    kind: "bulk",
    reply: formatDuplicateAsk(addedReply, dupes),
    pending,
  }, grocery)
}

export function isDuplicateFollowup(text: string): boolean {
  const word = text.trim().toLowerCase()
  return SEE_RE.test(word) || DISMISS_RE.test(word) || AGAIN_RE.test(word)
}

export function resolveDuplicateClarify(pending: PendingClarify, text: string, now = new Date()): ApplyResult {
  const pack = pending.duplicateAdd
  if (!pack) {
    return { status: "error", kind: "bulk", reply: "That question expired. Send the list again." }
  }
  const word = text.trim().toLowerCase()
  const grocery = pack.entries.some((entry) => isGroceryListName(entry.listName))
  if (SEE_RE.test(word)) {
    return pinGrocery({
      status: "needs_clarify",
      kind: "bulk",
      reply: formatSee(pack.entries),
      pending,
    }, grocery)
  }
  if (DISMISS_RE.test(word)) {
    const reply = pack.addedReply
      ? `${pack.addedReply}\n\nLeft the duplicates.`
      : "Left them."
    return pinGrocery({
      status: "ok",
      kind: "bulk",
      reply,
      summary: "Left duplicate items",
    }, grocery)
  }
  if (AGAIN_RE.test(word)) return addDuplicatesAgain(pack.entries, now)
  return {
    status: "needs_clarify",
    kind: "bulk",
    reply: `${formatDuplicateAsk(pack.addedReply, pack.entries)}\n\nReply see, again, or dismiss.`,
    pending,
  }
}

interface ReplyGroup {
  listId: string
  listName: string
  due?: Date
  added: string[]
}

interface PlaceInput {
  line: string
  folderPath: string[]
  listName: string
  listId?: string
  dueBefore?: Date
  now: Date
  sendToInbox: boolean
}

interface Placed {
  task: Task
  title: string
  listId: string
  listName: string
  grocery: boolean
}

function placeLine(input: PlaceInput): Placed | null {
  const { suggestion } = parseSmartCapture(input.line, { now: input.now })
  const title = (suggestion.description || input.line).trim()
  if (!title) return null

  const withPath = {
    ...suggestion,
    folderPath: suggestion.folderPath?.length
      ? suggestion.folderPath
      : input.folderPath.length
        ? input.folderPath
        : undefined,
    category: suggestion.category ?? input.listName,
  }
  const target = input.listId
    ? {
        list: useTaskStore.getState().lists.find((list) => list.id === input.listId),
        listIds: [input.listId],
      }
    : ensureCaptureTarget(withPath, taskStoreMutators)
  const listId = target.list?.id ?? target.listIds[0]
  if (!listId) return null
  const listName = target.list?.name ?? input.listName
  let task = buildCapturedTask({
    suggestion: { ...withPath, description: title },
    fallbackText: input.line,
    sendToInbox: input.sendToInbox,
    target: { ...target, listIds: target.listIds.length ? target.listIds : [listId] },
    folders: useTaskStore.getState().folders,
  })
  task = stampMustBeDoneBefore(task, input.dueBefore)
  return {
    task,
    title,
    listId,
    listName,
    grocery: isGroceryListName(listName),
  }
}

function destination(bucket: BulkBucket): { folderPath: string[]; listName: string; grocery: boolean } {
  if (!shouldUseGroceryStore(bucket)) {
    return { folderPath: bucket.folderPath, listName: bucket.listName, grocery: false }
  }
  return { folderPath: [], listName: findGroceryList()?.name ?? "Grocery list", grocery: true }
}

function shouldUseGroceryStore(bucket: BulkBucket): boolean {
  if (!isGroceryListName(bucket.listName)) return false
  if (bucket.folderPath.length === 0) return true
  return bucket.folderPath.every((name) => isGroceryListName(name))
}

function groupFor(groups: ReplyGroup[], listName: string, due: Date | undefined): ReplyGroup {
  const keyDue = due?.toISOString() ?? ""
  const found = groups.find((group) => group.listName === listName && (group.due?.toISOString() ?? "") === keyDue)
  if (found) return found
  const group: ReplyGroup = { listId: "", listName, due, added: [] }
  groups.push(group)
  return group
}

function findOpenDuplicate(listId: string, title: string): Task | undefined {
  const key = normTitle(title)
  if (!key) return undefined
  return useTaskStore.getState().tasks.find(
    (task) => task.lists?.includes(listId) && !task.completed && normTitle(itemTitleOrUntitled(task)) === key,
  )
}

function normTitle(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, " ")
}

function addDuplicatesAgain(entries: DuplicateAddEntry[], now: Date): ApplyResult {
  const ids: string[] = []
  const titles: string[] = []
  let grocery = false
  for (const entry of entries) {
    if (!useTaskStore.getState().lists.some((list) => list.id === entry.listId)) {
      return { status: "error", kind: "bulk", reply: "That list disappeared. Send the items again." }
    }
    const due = entry.dueBefore ? new Date(entry.dueBefore) : undefined
    const placed = placeLine({
      line: entry.line,
      folderPath: [],
      listName: entry.listName,
      listId: entry.listId,
      dueBefore: due,
      now,
      sendToInbox: false,
    })
    if (!placed) continue
    useTaskStore.getState().addTask(placed.task)
    ids.push(placed.task.id)
    titles.push(placed.title)
    if (placed.grocery) grocery = true
  }
  const reply = titles.length
    ? `Added again: ${joinNames(titles)}.`
    : "Nothing new to add."
  return pinGrocery({
    status: "ok",
    kind: "bulk",
    reply,
    summary: `Added duplicate ${titles.length}`,
    itemIds: ids,
  }, grocery)
}

function formatAdded(groups: ReplyGroup[], now: Date): string {
  return groups
    .filter((group) => group.added.length > 0)
    .map((group) => {
      const due = group.due ? ` (due ${formatDue(group.due, now)})` : ""
      return `${group.listName}${due}: ${joinNames(group.added)}.`
    })
    .join("\n")
}

function formatDuplicateAsk(addedReply: string, dupes: DuplicateAddEntry[]): string {
  const names = dupes.map((dupe) => dupe.line.trim() || dupe.existingName)
  const noun = names.length === 1 ? "item" : "items"
  const where = [...new Set(dupes.map((dupe) => dupe.listName))].join(", ")
  const ask = [
    `Did you want to add the following duplicate ${noun} to ${where}?`,
    ...names.map((name) => `• ${name}`),
    "",
    "see — peek at what's already there",
    "again — add another anyway",
    names.length === 1 ? "dismiss — leave it" : "dismiss — leave them",
  ].join("\n")
  return addedReply ? `${addedReply}\n\n${ask}` : ask
}

function formatSee(entries: DuplicateAddEntry[]): string {
  const blocks: string[] = []
  const seen = new Set<string>()
  for (const entry of entries) {
    const key = `${entry.listId}:${normTitle(entry.existingName)}`
    if (seen.has(key)) continue
    seen.add(key)
    const last = blocks[blocks.length - 1]
    const bullet = `• ${entry.existingName}`
    if (last?.startsWith(entry.listName)) blocks[blocks.length - 1] = `${last}\n${bullet}`
    else blocks.push(`${entry.listName}:\n${bullet}`)
  }
  const one = seen.size === 1
  return [
    "Already there:",
    ...blocks,
    "",
    "again — add another anyway",
    one ? "dismiss — leave it" : "dismiss — leave them",
  ].join("\n")
}

function formatDue(date: Date, now: Date): string {
  const month = date.getMonth() + 1
  const day = date.getDate()
  if (date.getFullYear() !== now.getFullYear()) return `${month}/${day}/${date.getFullYear()}`
  return `${month}/${day}`
}

function joinNames(names: string[]): string {
  if (names.length <= 1) return names[0] ?? ""
  if (names.length === 2) return `${names[0]} and ${names[1]}`
  return `${names.slice(0, -1).join(", ")}, and ${names[names.length - 1]}`
}

function summarize(count: number, groups: ReplyGroup[]): string {
  const where = groups.filter((group) => group.added.length).map((group) => group.listName)
  const unique = [...new Set(where)]
  const place = unique.length ? ` on ${unique.join(", ")}` : ""
  return `Added ${count} item${count === 1 ? "" : "s"}${place}`
}

function pinGrocery<T extends ApplyResult>(result: T, grocery: boolean): T {
  if (!grocery) return result
  if (result.status !== "ok" && result.status !== "needs_clarify") return result
  const pinText = groceryDumpText() ?? undefined
  if (!pinText) return result
  return { ...result, pinText }
}
