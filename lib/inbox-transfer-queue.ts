/**
 * lib/inbox-transfer-queue.ts — Inbox Transfer to log, off the click
 *
 * The click drops the chosen rows and shows Undo, then returns. One later
 * turn writes every pending note in a single tracking-store update, each at
 * that idea's own `createdAt`. Undo before that turn cancels the write. Undo
 * after it restores the ideas and drops the notes. A failed write puts the
 * rows back. Either path clears those delete tombstones on the persist
 * payload (`restoredTaskIds`) so the vault union does not strip the ideas.
 * A second transfer joins the same flush.
 */
import { attachLatestUndoHooks, patchWorldsAfter, runAsAction, withoutUndo } from "@/lib/action-history"
import { ensureTransferLogPen, applyTransferredLogLines } from "@/lib/ingest/apply-discrete-event"
import { creditInboxBatchHandling } from "@/lib/inbox-credit"
import type { PreparedInboxLog } from "@/lib/inbox-transfer-log"
import { appendTombstoneIds, noteClearedTaskTombstones, resetClearedTaskTombstones, useTaskStore } from "@/lib/task-store"
import { usePointsStore } from "@/lib/points-store"
import { useTimeTrackingStore } from "@/lib/time-tracking-store"
import type { TimeEntry } from "@/lib/time-entries"
import type { Task } from "@/lib/types"

export interface InboxTransferFailure {
  tasks: Task[]
  points: number
}

interface PointRow {
  date: string
  taskId: string
  points: number
  taskDescription: string
}

interface TransferJob {
  items: PreparedInboxLog[]
  cancelled: boolean
  written: boolean
  failed: boolean
  seq: number
  omitEntryIds: Set<string>
  pointRows: PointRow[]
  onFailure?: (info: InboxTransferFailure) => void
}

const jobs: TransferJob[] = []
const inFlight = new Set<string>()
let flushTimer: ReturnType<typeof setTimeout> | null = null
let flushFrame: number | null = null
let flushing = false

function scheduleFlush(): void {
  if (flushTimer != null || flushFrame != null) return
  const run = () => {
    flushFrame = null
    flushTimer = setTimeout(() => {
      flushTimer = null
      flushInboxLogTransfers()
    }, 0)
  }
  if (typeof requestAnimationFrame === "function") {
    flushFrame = requestAnimationFrame(run)
    return
  }
  run()
}

function cancelScheduledFlush(): void {
  if (flushFrame != null && typeof cancelAnimationFrame === "function") cancelAnimationFrame(flushFrame)
  flushFrame = null
  if (flushTimer != null) clearTimeout(flushTimer)
  flushTimer = null
}

function taskIds(job: TransferJob): string[] {
  return job.items.map((item) => item.task.id)
}

function release(job: TransferJob): void {
  for (const id of taskIds(job)) inFlight.delete(id)
  const index = jobs.indexOf(job)
  if (index >= 0) jobs.splice(index, 1)
}

function clearTombstones(ids: readonly string[]): void {
  noteClearedTaskTombstones(ids)
  const drop = new Set(ids)
  useTaskStore.setState((state) => ({
    removedTaskIds: (state.removedTaskIds ?? []).filter((id) => !drop.has(id)),
  }))
}

function stampTombstones(ids: readonly string[]): void {
  useTaskStore.setState((state) => ({
    removedTaskIds: appendTombstoneIds(state.removedTaskIds, ids),
  }))
}

function dropPointRows(job: TransferJob): void {
  if (job.pointRows.length === 0) return
  const drop = new Set<PointRow>(job.pointRows)
  usePointsStore.setState((state) => ({
    pointsHistory: state.pointsHistory.filter((row) => !drop.has(row)),
  }))
  patchWorldsAfter(job.seq, (world) => {
    world.pointsHistory = world.pointsHistory.filter((row) => !drop.has(row as PointRow))
  })
}

function restoreTasks(job: TransferJob): void {
  const bring = job.items.map((item) => item.task)
  const ids = new Set(bring.map((task) => task.id))
  noteClearedTaskTombstones([...ids])
  useTaskStore.setState((state) => {
    const have = new Set(state.tasks.map((task) => task.id))
    const extra = bring.filter((task) => !have.has(task.id))
    return {
      tasks: extra.length ? state.tasks.concat(extra) : state.tasks,
      removedTaskIds: (state.removedTaskIds ?? []).filter((id) => !ids.has(id)),
    }
  })
  patchWorldsAfter(job.seq, (world) => {
    const have = new Set(world.tasks.map((task) => task.id))
    const extra = bring.filter((task) => !have.has(task.id))
    if (extra.length) world.tasks = world.tasks.concat(extra)
  })
  dropPointRows(job)
}

function dropWrittenEntries(entries: readonly TimeEntry[]): void {
  if (entries.length === 0) return
  const gone = new Set(entries.map((entry) => entry.id))
  withoutUndo(() => {
    useTimeTrackingStore.setState((state) => {
      const removed = new Set(state.removedEntryIds ?? [])
      for (const id of gone) removed.add(id)
      return {
        entries: state.entries.filter((entry) => !gone.has(entry.id)),
        removedEntryIds: [...removed],
      }
    })
  })
}

function spliceNotes(job: TransferJob, entries: readonly TimeEntry[]): void {
  for (const entry of entries) job.omitEntryIds.add(entry.id)
  patchWorldsAfter(job.seq, (world, action) => {
    const have = new Set(world.entries.map((entry) => entry.id))
    const extra = entries.filter((entry) => !have.has(entry.id) && !action.omitEntryIds?.has(entry.id))
    if (extra.length) world.entries = world.entries.concat(extra)
  })
}

function failJobs(pending: readonly TransferJob[]): void {
  for (const job of pending) {
    if (job.failed || job.written || job.cancelled) continue
    job.failed = true
    job.cancelled = true
    restoreTasks(job)
    const tasks = job.items.map((item) => item.task)
    const points = job.pointRows.reduce((sum, row) => sum + row.points, 0)
    release(job)
    job.onFailure?.({ tasks, points })
  }
}

/**
 * Drop these ideas from the inbox now and write their log notes on a later turn.
 * Rows already in flight are skipped. Returns the ids that left the pile.
 */
export function handOffInboxLogTransfers(
  prepared: readonly PreparedInboxLog[],
  hooks?: { onFailure?: (info: InboxTransferFailure) => void },
): string[] {
  const fresh = prepared.filter((item) => !inFlight.has(item.task.id))
  if (fresh.length === 0) return []
  const omitEntryIds = new Set<string>()
  const job: TransferJob = {
    items: fresh.map((item) => ({ ...item })),
    cancelled: false,
    written: false,
    failed: false,
    seq: 0,
    omitEntryIds,
    pointRows: [],
    onFailure: hooks?.onFailure,
  }
  const ids = taskIds(job)
  const idSet = new Set(ids)
  runAsAction("inbox transfer to log", () => {
    ensureTransferLogPen()
    const state = useTaskStore.getState()
    state.setTasks(
      state.tasks.filter((task) => !idSet.has(task.id)),
      { tombstoneIds: ids },
    )
  })
  job.seq =
    attachLatestUndoHooks({
      omitEntryIds,
      onUndo: () => {
        job.cancelled = true
        clearTombstones(ids)
        if (!job.written) release(job)
      },
      onRedo: () => {
        if (job.failed) return
        if (job.written) {
          stampTombstones(ids)
          return
        }
        job.cancelled = false
        if (!jobs.includes(job)) jobs.push(job)
        for (const id of ids) inFlight.add(id)
        stampTombstones(ids)
        scheduleFlush()
      },
    }) ?? 0
  for (const id of ids) inFlight.add(id)
  jobs.push(job)
  scheduleFlush()
  return ids
}

/** +1 / clear bonus for the newest handoff. A failed write removes these rows. */
export function creditInboxLogTransfer(
  items: { taskId: string; title: string }[],
  openBefore: number,
  openAfter: number,
): void {
  const before = usePointsStore.getState().pointsHistory.length
  creditInboxBatchHandling(items, openBefore, openAfter)
  rememberInboxLogTransferPoints(usePointsStore.getState().pointsHistory.slice(before))
}

/** Point rows just credited for the newest handoff, so a failed write can take them back. */
export function rememberInboxLogTransferPoints(rows: readonly PointRow[]): void {
  const job = jobs[jobs.length - 1]
  if (!job || job.written || job.failed || job.cancelled) return
  job.pointRows = [...rows]
}

/** Write every pending handoff now. Safe to call more than once. */
export function flushInboxLogTransfers(): void {
  cancelScheduledFlush()
  if (flushing) return
  const pending = jobs.filter((job) => !job.cancelled && !job.written && !job.failed)
  if (pending.length === 0) return
  flushing = true
  try {
    const lines = pending.flatMap((job) => job.items.map((item) => ({ line: item.line, at: item.at, job })))
    let applied: ReturnType<typeof applyTransferredLogLines>
    try {
      applied = withoutUndo(() => applyTransferredLogLines(lines.map(({ line, at }) => ({ line, at }))))
    } catch {
      failJobs(pending)
      return
    }
    if (!applied.ok || applied.entries.length !== lines.length) {
      failJobs(pending.filter((job) => !job.cancelled && !job.written))
      return
    }
    let cursor = 0
    for (const job of pending) {
      const slice = applied.entries.slice(cursor, cursor + job.items.length)
      cursor += job.items.length
      if (job.cancelled) {
        dropWrittenEntries(slice)
        continue
      }
      job.written = true
      spliceNotes(job, slice)
      release(job)
    }
  } finally {
    flushing = false
  }
}

/** Tests and store resets. Drops a scheduled write without running it. */
export function resetInboxLogTransferQueue(): void {
  cancelScheduledFlush()
  jobs.splice(0, jobs.length)
  inFlight.clear()
  flushing = false
  resetClearedTaskTombstones()
}
