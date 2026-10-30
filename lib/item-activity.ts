/**
 * lib/item-activity.ts — Append-only per-item activity ledger
 *
 * `lib/action-history.ts` is last-write undo (in-memory snapshots). This module
 * is the durable "what changed, when" log for a single item — plan-vs-reality
 * at the item, and the History tab on item detail. Entries are never rewritten.
 *
 * Storage: localStorage `brain2-item-activity`. A full Settings backup carries
 * this key in `extras` and writes it back on restore. There is no persist
 * version: `source`, `order`, and `dedupeKey` are optional, and lines written
 * before them still load.
 *
 * `addTask` appends one created line (`recordItemCreate`). `updateTask` appends
 * one line per changed field (`recordItemWrite`). A no-op save writes nothing.
 * Each new line carries an attribution object (`lib/item-write-source.ts`).
 * The History line ends with `source …`. A create reads `created {time} — source …`.
 * A later edit keeps `{time} — {event} — {detail}` and adds the same clause.
 * Working-on-now sittings are lines too, recorded when the time log is written
 * (or, under a minute, when the pen clock stops), with surface `working-on-now`.
 * Reading the ledger does not append. `modifiedAt`, `estimateLog`, `listAddedAt`,
 * and `listRuleAddedIds` are stamps beside the field they follow, so they do
 * not get a second line. `order` stays on the row and is not printed.
 */

import { itemTitle } from "@/lib/item-utils"
import {
  formatItemWriteClause,
  resolveItemWriteAttribution,
  type ItemWriteAttribution,
} from "@/lib/item-write-source"
import { serializeSnapshot } from "@/lib/unsaved-changes"
import { persistKey, readAliasedLocal, removeAliasedLocal, writeAliasedLocal } from "@/lib/storage-keys"
import type { ItemLink, ItemNoteEntry, ItemResource, List, Subtask, Task, TimeLogEntry, TodoPeriodMark } from "@/lib/types"

export const ITEM_ACTIVITY_STORAGE_KEY = persistKey("item-activity")
export const MAX_ACTIVITY_PER_ITEM = 200

/**
 * The pen clock's block note starts with this. Duplicated here so this module
 * does not import `task-clock-log.ts` (that file imports the task store, and
 * the store imports this ledger).
 */
const WORKING_ON_NOW_NOTE_PREFIX = "added from Working On Now"

export interface ItemActivityChange {
  field: string
  label: string
  /** Previous value. */
  from: string
  /** Next value. */
  to: string
  /** Console detail. The History tab shows `from → to` when this is absent. */
  detail?: string
}

/** Abstraction order on a ledger line. Leaving it off is valid. */
export type ItemActivityOrder = "observed" | "recorded" | "derived" | "inferred"

export interface ItemActivityEntry {
  id: string
  itemId: string
  at: string
  summary: string
  changes: ItemActivityChange[]
  /**
   * Who wrote this row. New creates and edits store this. Older lines leave it off.
   */
  attribution?: ItemWriteAttribution
  /**
   * Legacy free-string source. Older lines may still have it. New rows use
   * `attribution` and leave this off.
   */
  source?: string
  /** Absent on older lines and on writes that do not name an order. Not printed. */
  order?: ItemActivityOrder
  /** The created line. One row for the create, not a field-by-field dump. */
  create?: boolean
  /** Set on a sitting line so the same stop cannot be recorded twice. */
  dedupeKey?: string
}

export interface ItemActivityLookup {
  tasks?: Task[]
  lists?: Pick<List, "id" | "name">[]
}

export interface ItemActivityMeta {
  /** Who wrote this edit. The store fills unknown when this and the frame are both absent. */
  attribution?: ItemWriteAttribution
  /** Legacy free string. Still loaded. New writes use `attribution`. */
  source?: string
  order?: ItemActivityOrder
}

const FIELD_LABELS: Record<string, string> = {
  title: "Title",
  description: "Description",
  notes: "Notes",
  body: "Body",
  completed: "Completed",
  status: "Status",
  stage: "Stage",
  estimatedDuration: "Estimate",
  actualDuration: "Actual duration",
  minimumChunkSize: "Minimum chunk",
  scheduledDate: "Scheduled date",
  scheduledTime: "Scheduled time",
  scheduledWeek: "Scheduled week",
  scheduledMonth: "Scheduled month",
  scheduledYear: "Scheduled year",
  deadline: "Deadline",
  completedDate: "Completed date",
  startedAt: "Started",
  missedAt: "Missed",
  dependencies: "Depends on",
  lists: "Lists",
  tags: "Tags",
  links: "Links",
  context: "Context",
  why: "Why",
  importance: "Importance",
  urgency: "Urgency",
  cognitiveLoad: "Cognitive load",
  entropy: "Entropy",
  rewardValue: "Reward",
  pointsOverride: "On done points",
  todoMarks: "Required / prioritized",
  scheduleable: "Send to Scheduler",
  autoPush: "Auto-push",
  reminder: "Reminder",
  penLinks: "Pens",
  personProfile: "Profile",
  missReason: "Miss reason",
  hiddenFromTodo: "Hidden from To do",
  definitionOfDone: "Definition of done",
  taskDescription: "Task description",
  icon: "Icon",
  type: "Type",
}

const MINUTE_FIELDS = new Set(["estimatedDuration", "actualDuration", "minimumChunkSize"])
const DATE_FIELDS = new Set([
  "scheduledDate",
  "deadline",
  "completedDate",
  "startedAt",
  "missedAt",
  "attachedDate",
  "createdAt",
])
const SKIP_FIELDS = new Set([
  "id",
  "modifiedAt",
  "estimateLog",
  "listAddedAt",
  "listRuleAddedIds",
  "title",
  "description",
])

/** Human label for a History / activity field key. */
export function activityFieldLabel(field: string): string {
  return FIELD_LABELS[field] ?? humanize(field)
}

interface DraftLine {
  summary: string
  changes: ItemActivityChange[]
  dedupeKey?: string
  sitting?: boolean
}

const empty = (): Record<string, ItemActivityEntry[]> => ({})

function readAll(): Record<string, ItemActivityEntry[]> {
  if (typeof localStorage === "undefined") return empty()
  try {
    const raw = readAliasedLocal(ITEM_ACTIVITY_STORAGE_KEY)
    if (!raw) return empty()
    const parsed = JSON.parse(raw) as Record<string, ItemActivityEntry[]>
    if (!parsed || typeof parsed !== "object") return empty()
    return parsed
  } catch {
    return empty()
  }
}

function writeAll(all: Record<string, ItemActivityEntry[]>): void {
  if (typeof localStorage === "undefined") return
  writeAliasedLocal(ITEM_ACTIVITY_STORAGE_KEY, JSON.stringify(all))
}

function humanize(field: string): string {
  if (FIELD_LABELS[field]) return FIELD_LABELS[field]
  const spaced = field.replace(/[_-]+/g, " ").replace(/([a-z])([A-Z])/g, "$1 $2")
  return spaced.charAt(0).toUpperCase() + spaced.slice(1)
}

function clip(value: string, max = 180): string {
  const text = value.replace(/\s+/g, " ").trim()
  if (text.length <= max) return text
  return `${text.slice(0, max - 1)}…`
}

function q(name: string): string {
  return `“${name.trim()}”`
}

function isPlain(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value) && !(value instanceof Date)
}

function emptyAsNull(value: unknown): unknown {
  if (value === undefined || value === null || value === "") return null
  if (Array.isArray(value) && value.length === 0) return null
  return value
}

function sameValue(a: unknown, b: unknown): boolean {
  if (a === b) return true
  return serializeSnapshot(emptyAsNull(a)) === serializeSnapshot(emptyAsNull(b))
}

function formatValue(value: unknown): string {
  if (value === undefined || value === null || value === "") return "(empty)"
  if (typeof value === "boolean") return value ? "yes" : "no"
  if (typeof value === "number" && Number.isFinite(value)) return String(value)
  if (typeof value === "string") return clip(value)
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? "(empty)" : value.toLocaleDateString()
  try {
    return clip(JSON.stringify(value))
  } catch {
    return clip(String(value))
  }
}

function formatMinutes(value: unknown): string {
  if (value === undefined || value === null || value === "") return "(empty)"
  const n = typeof value === "number" ? value : Number(value)
  if (!Number.isFinite(n)) return formatValue(value)
  return `${Math.max(0, Math.round(n))}m`
}

function formatDateish(value: unknown): string {
  if (value === undefined || value === null || value === "") return "(empty)"
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? "(empty)" : value.toLocaleDateString()
  if (typeof value === "string" || typeof value === "number") {
    const date = new Date(value)
    if (!Number.isNaN(date.getTime())) return date.toLocaleDateString()
  }
  return formatValue(value)
}

function titleFor(id: string, lookup?: ItemActivityLookup): string {
  const task = lookup?.tasks?.find((t) => t.id === id)
  return task ? itemTitle(task) || id : id
}

function listName(id: string, lookup?: ItemActivityLookup): string {
  return lookup?.lists?.find((l) => l.id === id)?.name ?? id
}

function formatTodoMarks(value: unknown): string {
  if (!Array.isArray(value) || value.length === 0) return "(none)"
  return (value as TodoPeriodMark[])
    .map((mark) => {
      const flags = [mark.required ? "required" : null, mark.prioritized ? "prioritized" : null]
        .filter(Boolean)
        .join(" + ")
      return `${mark.period} ${mark.periodKey}${flags ? ` (${flags})` : ""}`
    })
    .join("; ")
}

function joinIds(value: unknown, nameOf: (id: string) => string): string {
  const ids = Array.isArray(value) ? (value as string[]) : []
  if (!ids.length) return "(none)"
  return ids.map((id) => nameOf(id)).join(", ")
}

function line(field: string, label: string, from: string, to: string, detail?: string, dedupeKey?: string): DraftLine | null {
  if (from === to) return null
  const shown = detail ?? `${from} → ${to}`
  return {
    summary: `${label} — ${shown}`,
    dedupeKey,
    changes: [{ field, label, from, to, detail: shown }],
  }
}

function push(lines: DraftLine[], draft: DraftLine | null): void {
  if (draft) lines.push(draft)
}

function flattenSteps(steps: readonly Subtask[] | undefined): Map<string, Subtask> {
  const map = new Map<string, Subtask>()
  const walk = (list: readonly Subtask[] | undefined) => {
    for (const step of list ?? []) {
      if (step?.id) map.set(step.id, step)
      if (step?.subtasks?.length) walk(step.subtasks)
    }
  }
  walk(steps)
  return map
}

function stepDone(step: Subtask): boolean {
  return !!step.completed
}

function diffSteps(before: Task, after: Task, lines: DraftLine[]): void {
  if (sameValue(before.subtasks, after.subtasks)) return
  const prev = flattenSteps(before.subtasks)
  const next = flattenSteps(after.subtasks)
  for (const [id, step] of next) {
    if (prev.has(id)) continue
    const name = step.description?.trim() || id
    push(lines, line("subtasks", "Substep added", "(none)", name, q(name)))
    if (stepDone(step)) push(lines, line("subtasks", "Substep completed", "no", "yes", q(name)))
  }
  for (const [id, step] of prev) {
    if (next.has(id)) continue
    const name = step.description?.trim() || id
    push(lines, line("subtasks", "Substep deleted", name, "(none)", q(name)))
  }
  for (const [id, step] of next) {
    const old = prev.get(id)
    if (!old) continue
    const oldName = old.description?.trim() || id
    const name = step.description?.trim() || id
    if (oldName !== name) push(lines, line("subtasks", "Substep renamed", oldName, name, `${q(oldName)} → ${q(name)}`))
    if (stepDone(old) !== stepDone(step)) {
      push(
        lines,
        stepDone(step)
          ? line("subtasks", "Substep completed", "no", "yes", q(name))
          : line("subtasks", "Substep reopened", "yes", "no", q(name)),
      )
    }
    const skip = new Set(["id", "subtasks", "estimateLog", "description", "completed", "completedAt"])
    if (stepDone(old) !== stepDone(step)) skip.add("completedAt")
    const beforeRec = old as unknown as Record<string, unknown>
    const afterRec = step as unknown as Record<string, unknown>
    const keys = new Set([...Object.keys(beforeRec), ...Object.keys(afterRec)])
    for (const key of [...keys].sort()) {
      if (skip.has(key) || sameValue(beforeRec[key], afterRec[key])) continue
      const from = key === "estimatedDuration" || key === "actualDuration" ? formatMinutes(beforeRec[key]) : formatValue(beforeRec[key])
      const to = key === "estimatedDuration" || key === "actualDuration" ? formatMinutes(afterRec[key]) : formatValue(afterRec[key])
      const label = key === "estimatedDuration" ? "Estimate" : `Substep ${humanize(key).toLowerCase()}`
      push(lines, line("subtasks", label, from, to, `${q(name)} ${from} → ${to}`))
    }
  }
}

function isClockSittingLog(entry: TimeLogEntry): boolean {
  if (entry.id.startsWith("op-work-log-")) return true
  return (entry.notes ?? "").includes(WORKING_ON_NOW_NOTE_PREFIX)
}

function formatLogWhen(entry: Pick<TimeLogEntry, "date" | "startTime">): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(entry.date ?? "")
  if (!match) return entry.date || "(empty)"
  const [, year, month, day] = match
  const [hh, mm] = (entry.startTime ?? "00:00").split(":").map(Number)
  const date = new Date(Number(year), Number(month) - 1, Number(day), hh || 0, mm || 0, 0, 0)
  return formatActivityWhen(date.toISOString())
}

function stepLabel(task: Task, stepId: string): string {
  return flattenSteps(task.subtasks).get(stepId)?.description?.trim() || stepId
}

export function workedOnHistoryLine(duration: string, when: string): string {
  return `Worked on — ${duration} — ${when}`
}

export function workedOnSubstepHistoryLine(name: string, duration: string, when: string): string {
  return `Worked on substep — ${name} — ${duration} — ${when}`
}

export function formatSittingDuration(activeMs: number): string {
  const minutes = Math.round(activeMs / 60_000)
  if (minutes >= 1) return `${minutes}m`
  const seconds = Math.max(1, Math.round(activeMs / 1000))
  return `${seconds}s`
}

function sittingLine(summary: string, dedupeKey: string, label: string, to: string): DraftLine {
  return {
    summary,
    dedupeKey,
    sitting: true,
    changes: [{ field: "timeLogs", label, from: "(none)", to, detail: summary }],
  }
}

function diffTimeLogs(before: Task, after: Task, lines: DraftLine[]): void {
  if (sameValue(before.timeLogs, after.timeLogs)) return
  const prev = new Map((before.timeLogs ?? []).map((entry) => [entry.id, entry]))
  const next = new Map((after.timeLogs ?? []).map((entry) => [entry.id, entry]))
  for (const [id, entry] of next) {
    const old = prev.get(id)
    if (!old) {
      const duration = formatMinutes(entry.durationMinutes)
      const when = formatLogWhen(entry)
      if (isClockSittingLog(entry)) {
        lines.push(sittingLine(workedOnHistoryLine(duration, when), `timelog:${id}`, "Worked on", duration))
        if (entry.stepId) {
          const name = stepLabel(after, entry.stepId)
          lines.push(
            sittingLine(workedOnSubstepHistoryLine(name, duration, when), `timelog:${id}:step`, "Worked on substep", name),
          )
        }
      } else {
        push(lines, line("timeLogs", "Time log", "(none)", duration, `${duration} — ${when}`))
      }
      continue
    }
    if (sameValue(old, entry)) continue
    push(
      lines,
      line(
        "timeLogs",
        "Time log",
        `${formatMinutes(old.durationMinutes)} — ${formatLogWhen(old)}`,
        `${formatMinutes(entry.durationMinutes)} — ${formatLogWhen(entry)}`,
      ),
    )
  }
  for (const [id, entry] of prev) {
    if (next.has(id)) continue
    const duration = formatMinutes(entry.durationMinutes)
    push(lines, line("timeLogs", "Time log removed", duration, "(none)", `${duration} — ${formatLogWhen(entry)}`))
  }
}

function diffLinks(before: Task, after: Task, lookup: ItemActivityLookup | undefined, lines: DraftLine[]): void {
  if (sameValue(before.links, after.links)) return
  const text = (link: ItemLink) => `${link.relation} ${titleFor(link.targetId, lookup)}`
  const prev = new Map((before.links ?? []).map((link) => [link.id, link]))
  const next = new Map((after.links ?? []).map((link) => [link.id, link]))
  for (const [id, link] of next) {
    const old = prev.get(id)
    if (!old) {
      push(lines, line("links", "Link added", "(none)", text(link), text(link)))
      continue
    }
    if (sameValue(old, link)) continue
    push(lines, line("links", "Link", text(old), text(link)))
  }
  for (const [id, link] of prev) {
    if (next.has(id)) continue
    push(lines, line("links", "Link removed", text(link), "(none)", text(link)))
  }
}

function diffNotes(before: Task, after: Task, lines: DraftLine[]): void {
  if (sameValue(before.noteLog, after.noteLog)) return
  const prev = new Map((before.noteLog ?? []).map((entry) => [entry.id, entry]))
  const next = new Map((after.noteLog ?? []).map((entry) => [entry.id, entry]))
  const blurb = (entry: ItemNoteEntry) => clip(entry.text || "(empty)", 80)
  for (const [id, entry] of next) {
    const old = prev.get(id)
    if (!old) {
      push(lines, line("noteLog", "Note added", "(none)", blurb(entry), `${entry.date} ${blurb(entry)}`.trim()))
      continue
    }
    if (sameValue(old, entry)) continue
    push(lines, line("noteLog", "Note", blurb(old), blurb(entry)))
  }
  for (const [id, entry] of prev) {
    if (next.has(id)) continue
    push(lines, line("noteLog", "Note removed", blurb(entry), "(none)", blurb(entry)))
  }
}

function diffResources(before: Task, after: Task, lines: DraftLine[]): void {
  if (sameValue(before.resources, after.resources)) return
  const prev = new Map((before.resources ?? []).map((entry) => [entry.id, entry]))
  const next = new Map((after.resources ?? []).map((entry) => [entry.id, entry]))
  const name = (entry: ItemResource) => entry.name?.trim() || entry.id
  for (const [id, entry] of next) {
    const old = prev.get(id)
    if (!old) {
      push(lines, line("resources", "Resource added", "(none)", name(entry), q(name(entry))))
      continue
    }
    if (sameValue(old, entry)) continue
    if ((old.caption ?? "") !== (entry.caption ?? "") || (old.useNote ?? "") !== (entry.useNote ?? "")) {
      push(
        lines,
        line(
          "resources",
          "Resource",
          old.useNote || old.caption || "(empty)",
          entry.useNote || entry.caption || "(empty)",
          `${q(name(entry))} ${old.useNote || old.caption || "(empty)"} → ${entry.useNote || entry.caption || "(empty)"}`,
        ),
      )
      continue
    }
    if (name(old) !== name(entry)) {
      push(lines, line("resources", "Resource renamed", name(old), name(entry), `${q(name(old))} → ${q(name(entry))}`))
      continue
    }
    push(lines, line("resources", "Resource", "(previous)", name(entry), `${q(name(entry))} updated`))
  }
  for (const [id, entry] of prev) {
    if (next.has(id)) continue
    push(lines, line("resources", "Resource removed", name(entry), "(none)", q(name(entry))))
  }
}

function diffBag(
  field: string,
  before: unknown,
  after: unknown,
  lines: DraftLine[],
  labelOf: (key: string) => string,
  fieldOf: (key: string) => string,
): void {
  if (!isPlain(before) || !isPlain(after)) {
    if (!sameValue(before, after)) push(lines, line(field, humanize(field), formatValue(before), formatValue(after)))
    return
  }
  const keys = new Set([...Object.keys(before), ...Object.keys(after)])
  for (const key of [...keys].sort()) {
    if (sameValue(before[key], after[key])) continue
    push(lines, line(fieldOf(key), labelOf(key), formatValue(before[key]), formatValue(after[key])))
  }
}

function collectHistoryLines(before: Task, after: Task, lookup?: ItemActivityLookup): DraftLine[] {
  const lines: DraftLine[] = []
  const beforeName = itemTitle(before)
  const afterName = itemTitle(after)
  if (beforeName !== afterName) push(lines, line("title", "Title", beforeName || "(empty)", afterName || "(empty)"))

  diffSteps(before, after, lines)
  diffTimeLogs(before, after, lines)
  diffLinks(before, after, lookup, lines)
  diffNotes(before, after, lines)
  diffResources(before, after, lines)

  if (!sameValue(before.tags, after.tags)) {
    push(lines, line("tags", "Tags", joinIds(before.tags, (id) => id), joinIds(after.tags, (id) => id)))
  }
  if (!sameValue(before.lists, after.lists)) {
    push(lines, line("lists", "Lists", joinIds(before.lists, (id) => listName(id, lookup)), joinIds(after.lists, (id) => listName(id, lookup))))
  }
  if (!sameValue(before.dependencies, after.dependencies)) {
    push(
      lines,
      line(
        "dependencies",
        "Depends on",
        joinIds(before.dependencies, (id) => titleFor(id, lookup)),
        joinIds(after.dependencies, (id) => titleFor(id, lookup)),
      ),
    )
  }
  if (!sameValue(before.todoMarks, after.todoMarks)) {
    push(lines, line("todoMarks", "Required / prioritized", formatTodoMarks(before.todoMarks), formatTodoMarks(after.todoMarks)))
  }

  const labels = { ...before.attributeLabels, ...after.attributeLabels }
  if (!sameValue(before.attributes, after.attributes)) {
    diffBag(
      "attributes",
      before.attributes,
      after.attributes,
      lines,
      (key) => labels?.[key] || key,
      (key) => key,
    )
  }

  const beforeRec = before as unknown as Record<string, unknown>
  const afterRec = after as unknown as Record<string, unknown>
  const keys = new Set([...Object.keys(beforeRec), ...Object.keys(afterRec)])
  for (const key of [...keys].sort()) {
    if (SKIP_FIELDS.has(key)) continue
    if (
      key === "subtasks" ||
      key === "timeLogs" ||
      key === "links" ||
      key === "noteLog" ||
      key === "resources" ||
      key === "tags" ||
      key === "lists" ||
      key === "dependencies" ||
      key === "todoMarks" ||
      key === "attributes"
    ) {
      continue
    }
    if (sameValue(beforeRec[key], afterRec[key])) continue
    if (isPlain(beforeRec[key]) || isPlain(afterRec[key])) {
      diffBag(key, beforeRec[key], afterRec[key], lines, (child) => humanize(child), (child) => `${key}.${child}`)
      continue
    }
    if (MINUTE_FIELDS.has(key)) {
      push(lines, line(key, activityFieldLabel(key), formatMinutes(beforeRec[key]), formatMinutes(afterRec[key])))
      continue
    }
    if (DATE_FIELDS.has(key)) {
      push(lines, line(key, activityFieldLabel(key), formatDateish(beforeRec[key]), formatDateish(afterRec[key])))
      continue
    }
    push(lines, line(key, activityFieldLabel(key), formatValue(beforeRec[key]), formatValue(afterRec[key])))
  }
  return lines
}

function newEntryId(): string {
  return `act-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
}

/** Every item's lines (weekly graph review reads link edits from it). */
export function allItemActivity(): Record<string, ItemActivityEntry[]> {
  return readAll()
}

/** Newest-first ledger for one item. Equal timestamps keep the later write first. */
export function listItemActivity(itemId: string): ItemActivityEntry[] {
  if (!itemId) return []
  const rows = readAll()[itemId] ?? []
  return rows
    .map((row, index) => ({ row, index }))
    .sort((a, b) => {
      if (a.row.at !== b.row.at) return a.row.at < b.row.at ? 1 : -1
      return b.index - a.index
    })
    .map((item) => item.row)
}

/** Append one entry. Caps per-item length by dropping the oldest. A repeated `dedupeKey` is ignored. */
export function appendItemActivity(entry: Omit<ItemActivityEntry, "id"> & { id?: string }): ItemActivityEntry {
  const all = readAll()
  const existing = all[entry.itemId] ?? []
  if (entry.dedupeKey) {
    const prior = existing.find((row) => row.dedupeKey === entry.dedupeKey)
    if (prior) return prior
  }
  const next: ItemActivityEntry = {
    id: entry.id ?? newEntryId(),
    itemId: entry.itemId,
    at: entry.at,
    summary: entry.summary,
    changes: entry.changes,
  }
  if (entry.attribution !== undefined) next.attribution = entry.attribution
  if (entry.source !== undefined) next.source = entry.source
  if (entry.order !== undefined) next.order = entry.order
  if (entry.create) next.create = true
  if (entry.dedupeKey !== undefined) next.dedupeKey = entry.dedupeKey
  const rows = [...existing, next]
  all[entry.itemId] = rows.length > MAX_ACTIVITY_PER_ITEM ? rows.slice(rows.length - MAX_ACTIVITY_PER_ITEM) : rows
  writeAll(all)
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event(ITEM_ACTIVITY_STORAGE_KEY))
    window.dispatchEvent(new Event("cogs-item-activity"))
  }
  return next
}

/**
 * If `after` differs from `before`, append one ledger row per change.
 * No-op when there is nothing to record. Returns the first row of this write.
 */
export function recordItemWrite(
  before: Task | null | undefined,
  after: Task,
  lookup?: ItemActivityLookup,
  at: Date = new Date(),
  meta?: ItemActivityMeta,
): ItemActivityEntry | null {
  if (!after?.id || !before || before.id !== after.id) return null
  const lines = collectHistoryLines(before, after, lookup)
  if (!lines.length) return null
  let first: ItemActivityEntry | null = null
  for (const draft of [...lines].reverse()) {
    const saved = appendItemActivity({
      itemId: after.id,
      at: at.toISOString(),
      summary: draft.summary,
      changes: draft.changes,
      ...(draft.dedupeKey ? { dedupeKey: draft.dedupeKey } : {}),
      ...activityFields(meta, !!draft.sitting),
    })
    first = saved
  }
  return first
}

/**
 * A pen sitting shorter than a minute never reaches `timeLogs`. Record it once,
 * on the task that was on the clock. A later read does not call this.
 */
export function recordClockSitting(input: {
  itemId: string
  activeMs: number
  sittingAt: Date
  recordedAt?: Date
  stepName?: string
  dedupeKey: string
}): void {
  if (!input.itemId || !(input.activeMs > 0)) return
  const duration = formatSittingDuration(input.activeMs)
  const when = formatActivityWhen(input.sittingAt.toISOString())
  const at = (input.recordedAt ?? input.sittingAt).toISOString()
  const sitting = sittingAttribution()
  appendItemActivity({
    itemId: input.itemId,
    at,
    summary: workedOnHistoryLine(duration, when),
    changes: [{ field: "timeLogs", label: "Worked on", from: "(none)", to: duration, detail: duration }],
    dedupeKey: input.dedupeKey,
    attribution: sitting,
  })
  const step = input.stepName?.trim()
  if (!step) return
  appendItemActivity({
    itemId: input.itemId,
    at,
    summary: workedOnSubstepHistoryLine(step, duration, when),
    changes: [{ field: "timeLogs", label: "Worked on substep", from: "(none)", to: step, detail: step }],
    dedupeKey: `${input.dedupeKey}:step`,
    attribution: sitting,
  })
}

/** Diff the item. Empty when nothing meaningful changed. */
export function diffItemActivity(before: Task, after: Task, lookup?: ItemActivityLookup): ItemActivityChange[] {
  return collectHistoryLines(before, after, lookup).flatMap((draft) => draft.changes)
}

/** Test helper: wipe the ledger. */
export function resetItemActivity(): void {
  if (typeof localStorage === "undefined") return
  removeAliasedLocal(ITEM_ACTIVITY_STORAGE_KEY)
}

/** Format an ISO timestamp for the History well. */
export function formatActivityWhen(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleString(undefined, { dateStyle: "short", timeStyle: "short" })
}

function activityFields(meta: ItemActivityMeta | undefined, sitting: boolean): Pick<ItemActivityEntry, "attribution" | "source" | "order"> {
  if (sitting) return { attribution: sittingAttribution() }
  const out: Pick<ItemActivityEntry, "attribution" | "source" | "order"> = {}
  if (meta?.attribution) out.attribution = meta.attribution
  else if (meta?.source) out.source = meta.source
  if (meta?.order) out.order = meta.order
  return out
}

function sittingAttribution(): ItemWriteAttribution {
  return resolveItemWriteAttribution({ surface: "working-on-now" })
}

/** One created line. Rule-changed fields on that same create are separate writes. */
export function recordItemCreate(
  item: Task,
  attribution: ItemWriteAttribution,
  at: Date = new Date(),
  order?: ItemActivityOrder,
): ItemActivityEntry | null {
  if (!item?.id) return null
  return appendItemActivity({
    itemId: item.id,
    at: at.toISOString(),
    summary: "created",
    changes: [],
    create: true,
    attribution,
    ...(order ? { order } : {}),
  })
}

export interface RuledHistoryInput {
  create: boolean
  /** Stored item. The created line uses its id. */
  item: Task
  caller: ItemWriteAttribution
  order?: ItemActivityOrder
  /** Stored item before this update. Absent on create. */
  previous?: Task
  /** Caller snapshot, after the store's own date stamps and before rules. */
  userSnapshot: Task
  rules: { name: string; item: Task }[]
  afterRules: Task
  afterLinks: Task
  afterJoin: Task
  afterMembership: Task
  lookup?: ItemActivityLookup
  lists?: Pick<List, "id" | "name" | "membershipRules">[]
  at?: Date
}

/**
 * One create line, or the caller's field lines, then rule / list-link /
 * membership lines for the fields those steps changed.
 */
export function recordRuledHistory(input: RuledHistoryInput): void {
  const at = input.at ?? new Date()
  const lookup = input.lookup
  if (input.create) {
    recordItemCreate(input.item, input.caller, at, input.order)
  } else if (input.previous) {
    recordItemWrite(input.previous, input.userSnapshot, lookup, at, {
      attribution: input.caller,
      ...(input.order ? { order: input.order } : {}),
    })
  }
  let cursor = input.userSnapshot
  for (const step of input.rules) {
    recordItemWrite(cursor, step.item, lookup, at, {
      attribution: resolveItemWriteAttribution({ surface: "rule", name: step.name }),
    })
    cursor = step.item
  }
  if (cursor !== input.afterRules) {
    recordItemWrite(cursor, input.afterRules, lookup, at, {
      attribution: resolveItemWriteAttribution({ surface: "rule" }),
    })
  }
  const lists = input.lists
  recordItemWrite(input.afterRules, input.afterLinks, lookup, at, {
    attribution: resolveItemWriteAttribution(namedSurface("list-link", changedListNames(input.afterRules, input.afterLinks, lists))),
  })
  recordItemWrite(input.afterLinks, input.afterJoin, lookup, at, {
    attribution: resolveItemWriteAttribution(
      namedSurface("membership-rule", changedListNames(input.afterLinks, input.afterJoin, lists, true)),
    ),
  })
  recordItemWrite(input.afterJoin, input.afterMembership, lookup, at, {
    attribution: resolveItemWriteAttribution(namedSurface("list-link", changedListNames(input.afterJoin, input.afterMembership, lists))),
  })
}

/**
 * Batch membership and list-link writes never enter `updateTask`.
 * Append only when `lists` actually changed.
 */
export function recordListMembershipHistory(
  before: readonly Task[],
  after: readonly Task[],
  lists: Pick<List, "id" | "name" | "membershipRules">[],
  surface: "membership-rule" | "list-link",
): void {
  const lookup: ItemActivityLookup = { tasks: [...after], lists }
  const at = new Date()
  const prevById = new Map(before.map((task) => [task.id, task]))
  for (const next of after) {
    const prev = prevById.get(next.id)
    if (!prev || sameStringList(prev.lists, next.lists)) continue
    const name = changedListNames(prev, next, lists, surface === "membership-rule")
    recordItemWrite(prev, next, lookup, at, {
      attribution: resolveItemWriteAttribution(namedSurface(surface, name)),
    })
  }
}

function namedSurface(surface: "rule" | "membership-rule" | "list-link", name?: string): ItemWriteAttribution {
  return name ? { surface, name } : { surface }
}

function sameStringList(a: string[] | undefined, b: string[] | undefined): boolean {
  const left = a ?? []
  const right = b ?? []
  if (left.length !== right.length) return false
  for (let i = 0; i < left.length; i++) if (left[i] !== right[i]) return false
  return true
}

function changedListNames(
  before: Task,
  after: Task,
  lists: Pick<List, "id" | "name" | "membershipRules">[] | undefined,
  preferRules = false,
): string | undefined {
  const prev = new Set(before.lists ?? [])
  const next = new Set(after.lists ?? [])
  const ids = [...next].filter((id) => !prev.has(id)).concat([...prev].filter((id) => !next.has(id)))
  const rows = ids
    .map((id) => lists?.find((list) => list.id === id))
    .filter((list): list is Pick<List, "id" | "name" | "membershipRules"> => !!list)
  const ruled = preferRules
    ? rows.filter((list) => (list.membershipRules ?? []).some((rule) => rule.enabled !== false && rule.conditions.length > 0))
    : rows
  const names = (ruled.length ? ruled : rows).map((list) => list.name.trim()).filter(Boolean)
  const unique = [...new Set(names)]
  return unique.length ? unique.join(", ") : undefined
}

/** One console line. A sitting line already carries its date. The source clause is last. */
export function formatHistoryLine(entry: ItemActivityEntry): string {
  const create = entry.create === true || (entry.summary === "created" && entry.changes.length === 0)
  const clause = formatItemWriteClause(entry, { create })
  const suffix = clause ? ` — ${clause}` : ""
  if (create) return `created ${formatActivityWhen(entry.at)}${suffix}`
  if (entry.summary.startsWith("Worked on")) return `${entry.summary}${suffix}`
  const when = formatActivityWhen(entry.at)
  if (entry.changes.length > 1 && !entry.summary.includes("—")) {
    return (
      entry.changes
        .map((change) => `${when} — ${change.label} — ${change.detail ?? `${change.from} → ${change.to}`}`)
        .join("\n") + suffix
    )
  }
  return `${when} — ${entry.summary}${suffix}`
}
