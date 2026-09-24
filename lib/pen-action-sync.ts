/**
 * lib/pen-action-sync.ts — Paint a block → Done-today row (and keep them in step)
 *
 * When a pen carries `actionFormats`, every painted block of that pen (primary
 * or secondary) writes a `loggedAction` row so it appears in To-Do Done / Home
 * Done today. Create, retime, rename, retag location, change project, or delete
 * the block and this module updates or drops the row. A title the user edited
 * in To-Do is left alone; duration and clock still follow the block.
 *
 * Sleep-derived blocks already have a Done row (`lib/sleep-sync.ts`) and are
 * skipped. Operation work sessions are a separate path (`operation-work-session`).
 *
 * Only this file imports the tracking store *and* the task repository, matching
 * `habit-tracking-sync.ts`. Pure title math lives in `lib/pen-action-format.ts`.
 */
"use client"

import { useEffect } from "react"
import { taskRepository } from "@/lib/data/task-repository"
import { LOGGED_ACTION_TYPE_ID } from "@/lib/item-types"
import { parseLocalDate } from "@/lib/date-utils"
import { findPen, useTimeTrackingStore } from "@/lib/time-tracking-store"
import { assignedPenIds, entryMinutes, entriesForSpan, type TimeEntry } from "@/lib/time-entries"
import {
  actionValuesFor,
  locationLabelForWindow,
  penActionLogId,
  renderPenActionTitle,
} from "@/lib/pen-action-format"
import type { Task } from "@/lib/types"

const ATTR_ENTRY = "trackingEntryId"
const ATTR_GENERATED = "trackingActionGenerated"

function atLocalMinutes(dateKey: string, minutes: number): Date {
  const [y, mo, d] = dateKey.split("-").map(Number)
  const clamped = Math.max(0, Math.min(24 * 60 - 1, minutes))
  return new Date(y, mo - 1, d, Math.floor(clamped / 60), clamped % 60, 0, 0)
}

function formatsFor(entry: TimeEntry, scopes: ReturnType<typeof useTimeTrackingStore.getState>["scopes"]) {
  for (const id of assignedPenIds(entry)) {
    const pen = findPen(scopes, id)
    if (pen?.actionFormats?.length) return { pen, formats: pen.actionFormats }
  }
  const primary = findPen(scopes, entry.penId)
  return { pen: primary, formats: primary?.actionFormats }
}

function groupKey(entry: TimeEntry): string {
  return entry.spanId || entry.id
}

function groupsFrom(entries: TimeEntry[]): TimeEntry[][] {
  const seen = new Set<string>()
  const groups: TimeEntry[][] = []
  for (const entry of entries) {
    const key = groupKey(entry)
    if (seen.has(key)) continue
    seen.add(key)
    groups.push(entry.spanId ? entriesForSpan(entries, entry.spanId) : [entry])
  }
  return groups
}

function titleForGroup(
  group: TimeEntry[],
  allEntries: TimeEntry[],
  scopes: ReturnType<typeof useTimeTrackingStore.getState>["scopes"],
): { title: string; origin: TimeEntry; minutes: number } | null {
  const origin = group[0]
  if (!origin || origin.generatedBy?.kind === "sleep") return null
  const { pen, formats } = formatsFor(origin, scopes)
  if (!formats?.length) return null
  const last = group[group.length - 1] ?? origin
  const minutes = group.reduce((sum, e) => sum + entryMinutes(e), 0)
  const synthetic: TimeEntry = { ...origin, endMin: origin.startMin + minutes }
  const values = actionValuesFor(synthetic, pen, allEntries, scopes)
  if (group.length > 1) {
    const locations = group
      .map((slice) => locationLabelForWindow(slice, allEntries, scopes))
      .filter(Boolean)
    values.location = [...new Set(locations)].join(" / ")
    values.start = actionValuesFor(origin, pen, allEntries, scopes).start
    values.end = actionValuesFor(last, pen, allEntries, scopes).end
  }
  const title = renderPenActionTitle(formats, values)
  if (!title) return null
  return { title, origin, minutes }
}

function userEditedTitle(existing: Task | undefined): boolean {
  if (!existing) return false
  const generated = String(existing.attributes?.[ATTR_GENERATED] ?? "")
  if (!generated) return false
  return (existing.description || existing.title || "") !== generated
}

function upsertDoneRow(group: TimeEntry[], title: string, minutes: number): void {
  const origin = group[0]
  const last = group[group.length - 1] ?? origin
  const id = penActionLogId(origin)
  const existing = taskRepository.getById(id)
  const startedAt = atLocalMinutes(origin.date, origin.startMin)
  const completedAt = atLocalMinutes(last.date, Math.max(0, last.endMin - 1))
  const keepTitle = userEditedTitle(existing)
  const description = keepTitle ? existing!.description : title
  const fields: Partial<Task> = {
    description,
    title: description,
    completedDate: completedAt,
    startedAt,
    scheduledDate: startedAt,
    actualDuration: minutes,
    estimatedDuration: minutes,
    attributes: {
      ...(existing?.attributes ?? {}),
      [ATTR_ENTRY]: origin.id,
      [ATTR_GENERATED]: keepTitle ? String(existing!.attributes?.[ATTR_GENERATED] ?? title) : title,
    },
  }

  if (existing) {
    taskRepository.update({ ...existing, ...fields, completed: true, loggedAction: true })
    return
  }

  taskRepository.add({
    id,
    type: LOGGED_ACTION_TYPE_ID,
    loggedAction: true,
    stage: "completed",
    status: "done",
    createdAt: startedAt,
    completed: true,
    lists: [],
    tags: ["tracking"],
    links: [],
    rewardValue: 0,
    ...fields,
  } as Task)
}

function wantedIds(
  entries: TimeEntry[],
  scopes: ReturnType<typeof useTimeTrackingStore.getState>["scopes"],
): Set<string> {
  const ids = new Set<string>()
  for (const group of groupsFrom(entries)) {
    const rendered = titleForGroup(group, entries, scopes)
    if (rendered) ids.add(penActionLogId(rendered.origin))
  }
  return ids
}

/**
 * Reconcile Done rows with the current vault. Safe to call often — ids are
 * deterministic, and a customised title is not overwritten.
 */
export function syncPenActions(): void {
  const { entries, scopes } = useTimeTrackingStore.getState()
  const wanted = wantedIds(entries, scopes)

  for (const group of groupsFrom(entries)) {
    const rendered = titleForGroup(group, entries, scopes)
    if (!rendered) continue
    upsertDoneRow(group, rendered.title, rendered.minutes)
  }

  for (const task of taskRepository.getAll()) {
    if (!String(task.id).startsWith("pen-action-")) continue
    if (wanted.has(task.id)) continue
    if (userEditedTitle(task)) continue
    taskRepository.remove(task.id)
  }
}

let unsubscribe: (() => void) | null = null

export function startPenActionSync(): () => void {
  if (unsubscribe) return unsubscribe
  let previous = useTimeTrackingStore.getState()
  const stop = useTimeTrackingStore.subscribe((state) => {
    const entriesChanged = state.entries !== previous.entries
    const scopesChanged = state.scopes !== previous.scopes
    previous = state
    if (entriesChanged || scopesChanged) syncPenActions()
  })
  unsubscribe = () => {
    stop()
    unsubscribe = null
  }
  syncPenActions()
  return unsubscribe
}

/** Mount on Tracking views, pen settings, and To-Do so Done today stays in step. */
export function usePenActionSync(): void {
  useEffect(() => {
    startPenActionSync()
  }, [])
}
