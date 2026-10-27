/**
 * components/Operations/OperationLogFeed.tsx — Operation activity log
 *
 * One chronological feed (oldest first): a created line from the operation's
 * `createdAt`, then each `TimeLogEntry` on the operation and its task tree.
 * A quick "log time" form appends an entry to the operation. The hour total
 * is tracked minutes only — created is not time logged.
 *
 * Pen colors are the operation's `Task.penLinks` (the same Tracking pens a
 * task already joins). **Choose pens** opens a searchable multiselect on the
 * deck: the field filters by pen name, checked rows and the chips above stay
 * the selection, and each toggle writes `penLinks` at once. **Done** and
 * Escape only close that menu. A punch that names a real block (`entryIds`,
 * the same id, or the same date and start/end) opens that block in
 * `EntryDialog` on double-click, and shows that block's pen color.
 */
"use client"

import { endOfLocalDay, formatLocalDateKey, parseLocalDate } from "@/lib/date-utils"
import { trackedTimeForItems, findPen } from "@/lib/tracked-time"
import { useTimeTrackingStore, type TimeEntry } from "@/lib/time-tracking-store"
import { MINUTES_PER_DAY, timeStringToMinutes } from "@/lib/time-entries"
import { useEffect, useMemo, useRef, useState } from "react"
import { useTaskStore } from "@/lib/task-store"
import { getOperationTaskTree, minutesToHours } from "@/lib/operations"
import { OPERATION_ATTR } from "@/lib/operation-types"
import type { Task, TimeLogEntry } from "@/lib/types"
import { EntryDialog } from "@/components/Home/Tracking/entry-dialog"
import { logTime } from "./operation-actions"
import { itemTitle } from "@/lib/item-utils"

type PenLink = { scopeId: string; penId: string }

export type OperationLogLine =
  | {
      kind: "created"
      id: string
      at: number
      date: string
      time: string
      taskTitle: string
    }
  | {
      kind: "time"
      id: string
      at: number
      date: string
      durationMinutes: number
      label: string
      taskTitle: string
      log: TimeLogEntry
    }

function clockLabel(at: Date): string {
  return `${String(at.getHours()).padStart(2, "0")}:${String(at.getMinutes()).padStart(2, "0")}`
}

function createdInstant(operation: Task): Date | null {
  const raw = operation.createdAt as Date | string | null | undefined
  if (raw == null || raw === "") return null
  const at = raw instanceof Date ? raw : new Date(raw)
  return Number.isNaN(at.getTime()) ? null : at
}

/** A day-only punch has no clock, so it sorts at the end of that local day. */
function timeLogInstant(log: TimeLogEntry): number {
  const day = parseLocalDate(log.date)
  if (!day) return 0
  const start = log.startTime?.match(/^(\d{1,2}):(\d{2})/)
  if (start) {
    day.setHours(Number(start[1]), Number(start[2]), 0, 0)
    return day.getTime()
  }
  return endOfLocalDay(day).getTime()
}

/**
 * The punch's clock window on its own day.
 * `minutesToTimeString(1440)` stores midnight as `00:00`, so a span that
 * runs to the end of the day is recovered from `durationMinutes`.
 */
export function logBlockWindow(
  log: Pick<TimeLogEntry, "startTime" | "endTime" | "durationMinutes">,
): { startMin: number; endMin: number } | null {
  if (!log.startTime) return null
  const startMin = timeStringToMinutes(log.startTime)
  if (startMin == null) return null
  const parsedEnd = log.endTime ? timeStringToMinutes(log.endTime) : null
  const byDuration = log.durationMinutes > 0 ? startMin + log.durationMinutes : null
  let endMin = parsedEnd
  if (endMin == null) endMin = byDuration
  else if (endMin <= startMin && byDuration != null && byDuration > startMin && byDuration <= MINUTES_PER_DAY) {
    endMin = byDuration
  }
  if (endMin == null || endMin <= startMin || endMin > MINUTES_PER_DAY) return null
  return { startMin, endMin }
}

function trackingPenId(operation: Task): string {
  const raw = operation.attributes?.[OPERATION_ATTR.trackingPenId]
  return typeof raw === "string" ? raw : ""
}

/** Pens already joined to this operation, tracking pen first, then `penLinks`. */
export function operationPreferPenIds(operation: Task): string[] {
  const ids: string[] = []
  const tracking = trackingPenId(operation)
  if (tracking) ids.push(tracking)
  for (const link of operation.penLinks ?? []) {
    if (!ids.includes(link.penId)) ids.push(link.penId)
  }
  return ids
}

function blockRank(entry: TimeEntry, log: Pick<TimeLogEntry, "taskId">, preferPenIds: readonly string[]): number {
  if (log.taskId && entry.taskId === log.taskId) return 0
  const penAt = preferPenIds.indexOf(entry.penId)
  if (penAt >= 0) return 10 + penAt
  for (const id of entry.secondaryPenIds ?? []) {
    const at = preferPenIds.indexOf(id)
    if (at >= 0) return 50 + at
  }
  return 100
}

function pickBlock(hits: TimeEntry[], log: Pick<TimeLogEntry, "taskId">, preferPenIds: readonly string[]): TimeEntry {
  return [...hits].sort(
    (a, b) => blockRank(a, log, preferPenIds) - blockRank(b, log, preferPenIds) || a.id.localeCompare(b.id),
  )[0]
}

/**
 * The tracking block this punch records.
 * An id on the log (`entryIds`, or the log id itself) wins. Otherwise the
 * block on the same local date with the same start and end. The note is ignored.
 * Several blocks in that window: the punch's task, then this operation's
 * tracking pen, then a linked pen.
 */
export function matchLogTimeBlock(
  log: TimeLogEntry,
  entries: readonly TimeEntry[],
  preferPenIds: readonly string[] = [],
): TimeEntry | undefined {
  const byId = new Map(entries.map((entry) => [entry.id, entry]))
  const linked = (log.entryIds ?? []).map((id) => byId.get(id)).filter((entry): entry is TimeEntry => !!entry)
  const window = logBlockWindow(log)
  if (linked.length) {
    if (window) {
      const exact = linked.filter(
        (entry) => entry.date === log.date && entry.startMin === window.startMin && entry.endMin === window.endMin,
      )
      if (exact.length) return pickBlock(exact, log, preferPenIds)
    }
    const sameDay = linked.filter((entry) => entry.date === log.date)
    if (sameDay.length) return pickBlock(sameDay, log, preferPenIds)
    return pickBlock(linked, log, preferPenIds)
  }
  const sameId = byId.get(log.id)
  if (sameId) return sameId
  if (!window) return undefined
  const hits = entries.filter(
    (entry) =>
      entry.kind !== "instant" &&
      entry.date === log.date &&
      entry.startMin === window.startMin &&
      entry.endMin === window.endMin,
  )
  if (!hits.length) return undefined
  return pickBlock(hits, log, preferPenIds)
}

/** Oldest first. Created uses `createdAt` only — never a stand-in clock. */
export function operationLogLines(operation: Task, allTasks: Task[]): OperationLogLine[] {
  const lines: OperationLogLine[] = []
  const created = createdInstant(operation)
  if (created) {
    lines.push({
      kind: "created",
      id: `${operation.id}:created`,
      at: created.getTime(),
      date: formatLocalDateKey(created),
      time: clockLabel(created),
      taskTitle: itemTitle(operation),
    })
  }
  const contributors = [operation, ...getOperationTaskTree(operation.id, allTasks)]
  for (const task of contributors) {
    for (const log of task.timeLogs ?? []) {
      lines.push({
        kind: "time",
        id: log.id,
        at: timeLogInstant(log),
        date: log.date,
        durationMinutes: log.durationMinutes,
        label: log.notes || log.activityLabel || itemTitle(task),
        taskTitle: itemTitle(task),
        log,
      })
    }
  }
  lines.sort((a, b) => a.at - b.at || a.id.localeCompare(b.id))
  return lines
}

function writePenLinks(operationId: string, next: PenLink[]) {
  const task = useTaskStore.getState().tasks.find((item) => item.id === operationId)
  if (!task) return
  useTaskStore.getState().updateTask({ ...task, penLinks: next.length ? next : undefined })
}

type PenCatalogRow = { scopeId: string; scopeName: string; penId: string; name: string; color: string }

function penRowId(row: Pick<PenCatalogRow, "scopeId" | "penId">): string {
  return `ops-log-pen-opt-${row.scopeId}-${row.penId}`
}

/** Pen name, or the row label (`Activity · Work`), so the typed text matches what is on screen. */
function penMatchesQuery(row: Pick<PenCatalogRow, "name" | "scopeName">, query: string): boolean {
  const q = query.trim().toLowerCase()
  if (!q) return true
  return row.name.toLowerCase().includes(q) || `${row.scopeName} · ${row.name}`.toLowerCase().includes(q)
}

export function OperationLogFeed({ operation }: { operation: Task }) {
  const allTasks = useTaskStore((s) => s.tasks)
  const live = allTasks.find((task) => task.id === operation.id) ?? operation
  const trackingEntries = useTimeTrackingStore((s) => s.entries)
  const scopes = useTimeTrackingStore((s) => s.scopes)
  const [minutesDraft, setMinutesDraft] = useState("")
  const [noteDraft, setNoteDraft] = useState("")
  const [pickingPens, setPickingPens] = useState(false)
  const [penQuery, setPenQuery] = useState("")
  const [penCursor, setPenCursor] = useState(0)
  const [openEntryId, setOpenEntryId] = useState<string | null>(null)
  const penSearchRef = useRef<HTMLInputElement>(null)

  const preferPens = operationPreferPenIds(live)
  const links = live.penLinks ?? []

  const catalog = useMemo(() => {
    const rows: PenCatalogRow[] = []
    for (const scope of scopes) {
      for (const pen of scope.pens) {
        rows.push({ scopeId: scope.id, scopeName: scope.name, penId: pen.id, name: pen.name, color: pen.color })
      }
    }
    return rows
  }, [scopes])

  const filteredPens = useMemo(
    () => catalog.filter((row) => penMatchesQuery(row, penQuery)),
    [catalog, penQuery],
  )
  const penCursorIndex = filteredPens.length ? Math.min(penCursor, filteredPens.length - 1) : 0

  useEffect(() => {
    if (!pickingPens) return
    setPenQuery("")
    setPenCursor(0)
    penSearchRef.current?.focus()
  }, [pickingPens])

  useEffect(() => {
    if (!pickingPens || !filteredPens.length) return
    document.getElementById(penRowId(filteredPens[penCursorIndex]))?.scrollIntoView?.({ block: "nearest" })
  }, [pickingPens, penCursorIndex, filteredPens])

  const { lines, totalHours, timeCount } = useMemo(() => {
    const tree = getOperationTaskTree(live.id, allTasks)
    const contributors = [live, ...tree]
    const lines = operationLogLines(live, allTasks)
    const totalMinutes = trackedTimeForItems(contributors, trackingEntries).total
    return {
      lines,
      timeCount: lines.filter((line) => line.kind === "time").length,
      totalHours: minutesToHours(totalMinutes),
    }
  }, [live, allTasks, trackingEntries])

  const openEntry = openEntryId ? trackingEntries.find((entry) => entry.id === openEntryId) : undefined
  useEffect(() => {
    if (openEntryId && !openEntry) setOpenEntryId(null)
  }, [openEntryId, openEntry])

  const submit = () => {
    const minutes = Number(minutesDraft)
    if (!Number.isFinite(minutes) || minutes <= 0) return
    logTime(live.id, { durationMinutes: minutes, notes: noteDraft.trim() || undefined })
    setMinutesDraft("")
    setNoteDraft("")
  }

  const togglePen = (link: PenLink) => {
    const current = useTaskStore.getState().tasks.find((item) => item.id === live.id)?.penLinks ?? []
    const has = current.some((item) => item.penId === link.penId && item.scopeId === link.scopeId)
    writePenLinks(
      live.id,
      has ? current.filter((item) => item.penId !== link.penId) : [...current, link],
    )
  }

  const onPenSearchKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Escape") {
      event.preventDefault()
      setPickingPens(false)
      return
    }
    if (!filteredPens.length) return
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault()
      const delta = event.key === "ArrowDown" ? 1 : -1
      setPenCursor((penCursorIndex + delta + filteredPens.length) % filteredPens.length)
      return
    }
    if (event.key === "Enter" && event.target === penSearchRef.current) {
      event.preventDefault()
      const row = filteredPens[penCursorIndex]
      if (row) togglePen({ scopeId: row.scopeId, penId: row.penId })
    }
  }

  const penOf = (penId: string | undefined) => (penId ? findPen(scopes, penId) : undefined)

  return (
    <div className="ops-panel">
      <div className="ops-deck">
        <div className="ops-deck-head">
          Log
          <span>{totalHours}h total</span>
        </div>
        <div className="ops-log-pens">
          <span className="ops-log-pens-label">Pens</span>
          {links.map((link) => {
            const pen = penOf(link.penId)
            const scopeName = catalog.find((row) => row.penId === link.penId)?.scopeName
            const name = pen?.name ?? "Missing pen"
            const label = scopeName ? `${scopeName} · ${name}` : name
            return (
              <button
                key={link.penId}
                type="button"
                className="ops-log-pen"
                aria-label={`Unlink ${label}`}
                title={label}
                onClick={() => togglePen(link)}
              >
                <span className="ops-log-swatch" style={{ background: pen?.color ?? "transparent" }} aria-hidden />
                {name}
              </button>
            )
          })}
          {catalog.length === 0 ? (
            <span className="ops-hint">No pen colors yet.</span>
          ) : (
            <button
              type="button"
              className="ops-btn ops-keycap"
              data-no95=""
              aria-expanded={pickingPens}
              aria-controls="ops-log-pen-menu"
              onClick={() => setPickingPens((open) => !open)}
            >
              {pickingPens ? "Done" : "Choose pens"}
            </button>
          )}
        </div>
        {pickingPens && catalog.length > 0 ? (
          <div id="ops-log-pen-menu" className="ops-log-pen-menu" role="group" aria-label="Pen colors">
            <input
              ref={penSearchRef}
              className="ops-input ops-log-pen-search"
              type="search"
              value={penQuery}
              aria-label="Filter pens"
              aria-controls="ops-log-pen-list"
              aria-activedescendant={filteredPens[penCursorIndex] ? penRowId(filteredPens[penCursorIndex]) : undefined}
              placeholder="Filter by name"
              autoComplete="off"
              onChange={(event) => {
                setPenQuery(event.target.value)
                setPenCursor(0)
              }}
              onKeyDown={onPenSearchKeyDown}
            />
            <div
              id="ops-log-pen-list"
              className="ops-log-pen-list"
              onKeyDown={(event) => {
                if (!filteredPens.length) return
                if (event.key !== "ArrowDown" && event.key !== "ArrowUp" && event.key !== "Escape") return
                event.preventDefault()
                if (event.key === "Escape") {
                  setPickingPens(false)
                  return
                }
                const delta = event.key === "ArrowDown" ? 1 : -1
                const next = (penCursorIndex + delta + filteredPens.length) % filteredPens.length
                setPenCursor(next)
                document.getElementById(penRowId(filteredPens[next]))?.focus()
              }}
            >
              {filteredPens.length === 0 ? (
                <p className="ops-log-pen-empty">No pens match.</p>
              ) : (
                filteredPens.map((row, index) => {
                  const selected = links.some((link) => link.penId === row.penId && link.scopeId === row.scopeId)
                  return (
                    <button
                      key={`${row.scopeId}:${row.penId}`}
                      id={penRowId(row)}
                      type="button"
                      className={index === penCursorIndex ? "ops-log-pen is-active" : "ops-log-pen"}
                      aria-pressed={selected}
                      onMouseEnter={() => setPenCursor(index)}
                      onClick={() => togglePen({ scopeId: row.scopeId, penId: row.penId })}
                    >
                      <span className="ops-log-swatch" style={{ background: row.color }} aria-hidden />
                      {row.scopeName} · {row.name}
                      {selected ? (
                        <span className="ops-log-pen-check" aria-hidden>
                          ✓
                        </span>
                      ) : null}
                    </button>
                  )
                })
              )}
            </div>
          </div>
        ) : null}
        <div className="ops-add-row">
          <input
            className="ops-input"
            style={{ flex: "0 0 5.5rem", width: "5.5rem" }}
            type="number"
            min={1}
            value={minutesDraft}
            onChange={(e) => setMinutesDraft(e.target.value)}
            placeholder="min"
            aria-label="Minutes"
          />
          <input
            className="ops-input"
            value={noteDraft}
            onChange={(e) => setNoteDraft(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && submit()}
            placeholder="What did you work on?"
          />
          <button
            type="button"
            className="ops-btn ops-btn-default ops-keycap is-primary"
            data-no95=""
            onClick={submit}
            disabled={!Number(minutesDraft)}
          >
            Log time
          </button>
        </div>
      </div>

      {timeCount === 0 ? <p className="ops-hint">No time logged yet.</p> : null}

      {lines.length > 0 ? (
        <ul className="ops-log">
          {lines.map((line) => {
            if (line.kind === "created") {
              return (
                <li key={line.id}>
                  <span className="ops-log-swatch is-empty" aria-hidden />
                  <span className="w-24 shrink-0 tabular-nums">{line.date}</span>
                  <span className="w-16 shrink-0 font-medium">created</span>
                  <span className="min-w-0 flex-1 truncate tabular-nums">{line.time}</span>
                  <span className="hidden max-w-[8rem] truncate sm:block">{line.taskTitle}</span>
                </li>
              )
            }
            const block = matchLogTimeBlock(line.log, trackingEntries, preferPens)
            const pen = penOf(block?.penId)
            return (
              <li
                key={line.id}
                className={block ? "is-block" : undefined}
                title={block ? `${pen?.name ? `${pen.name}. ` : ""}Double-click to open this time block` : undefined}
                onDoubleClick={
                  block
                    ? (event) => {
                        event.preventDefault()
                        setOpenEntryId(block.id)
                      }
                    : undefined
                }
              >
                <span
                  className={pen ? "ops-log-swatch" : "ops-log-swatch is-empty"}
                  style={pen ? { background: pen.color } : undefined}
                  title={pen?.name}
                  role={pen ? "img" : undefined}
                  aria-label={pen?.name}
                  aria-hidden={pen ? undefined : true}
                />
                <span className="w-24 shrink-0 tabular-nums">{line.date}</span>
                <span className="w-16 shrink-0 font-medium tabular-nums">{line.durationMinutes}m</span>
                <span className="min-w-0 flex-1 truncate">{line.label}</span>
                <span className="hidden max-w-[8rem] truncate sm:block">{line.taskTitle}</span>
              </li>
            )
          })}
        </ul>
      ) : null}
      {openEntry ? <EntryDialog entry={openEntry} onClose={() => setOpenEntryId(null)} /> : null}
    </div>
  )
}

export default OperationLogFeed
