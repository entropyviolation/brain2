/**
 * lib/people-sync-runner.ts — Apply `lib/people-sync.ts` to the stores
 *
 * Started once from `usePeopleIKnowList` after the task vault and the
 * timegrid store have hydrated. Re-runs (batched to one microtask) when
 * scopes or tasks change, and writes only when the plan is non-empty, so it
 * settles after one pass. Writes are kept out of undo (`withoutUndo`) — they
 * are bookkeeping, not a person's edit.
 *
 * The first run also backfills block details once
 * (`brain2-people-backfill-v1`): every past block on a who pen with ticked
 * people, and every Company block, runs the cross-view mirror, so existing
 * Social · Elijah time shows Elijah in Company (blank minutes only) and
 * existing Company · Elijah ticks Elijah on overlapping Social blocks.
 */
import { withoutUndo } from "@/lib/action-history"
import { ensurePeopleIKnowList, joinedCompanyPenIds, personRecords, createPerson, withCompanyPen } from "@/lib/people-i-know"
import { COMPANY, isWhoPen, planPeopleItems, planPeopleSync } from "@/lib/people-sync"
import { startHydratedStoreSync, type HydratedStoreSyncSlot } from "@/lib/start-hydrated-store-sync"
import { persistKey, readAliasedLocal, writeAliasedLocal } from "@/lib/storage-keys"
import { useTaskStore } from "@/lib/task-store"
import { PEN_PALETTE, useTimeTrackingStore } from "@/lib/time-tracking-store"
import { isInstant } from "@/lib/time-entries"
import { relinkPhonePens } from "@/lib/phone-sync/person-links"
import { phonePeople } from "@/lib/phone-sync/write"

const BACKFILL_KEY = persistKey("people-backfill-v1")
const slot: HydratedStoreSyncSlot = { stopper: null }
let queued = false
let running = false

export function syncPeopleNow(): void {
  if (running) return
  running = true
  try {
    withoutUndo(() => {
      const tracking = useTimeTrackingStore.getState()
      const plan = planPeopleSync(tracking.scopes)
      for (const name of plan.createCompany) {
        const company = useTimeTrackingStore.getState().scopes.find((s) => s.id === COMPANY)
        const id = tracking.addPen(COMPANY, {
          name,
          color: PEN_PALETTE[(company?.pens.length ?? 0) % PEN_PALETTE.length]!,
          levelId: "lvl-company-person",
        })
        if (!id) continue
        // The new person can be ticked on every who pen too.
        for (const scope of useTimeTrackingStore.getState().scopes) {
          for (const pen of scope.pens) {
            if (!isWhoPen(scope.id, pen)) continue
            if ((pen.variants ?? []).some((v) => !v.scopeId && v.name.trim().toLowerCase() === name.toLowerCase())) continue
            tracking.addCrossViewDetail(scope.id, pen.id, COMPANY, id)
          }
        }
      }
      for (const row of planPeopleSync(useTimeTrackingStore.getState().scopes).addDetail) {
        tracking.addCrossViewDetail(row.scopeId, row.penId, COMPANY, row.companyPenId)
      }

      const tasks = useTaskStore.getState()
      const people = personRecords(tasks.tasks, tasks.lists)
      const items = planPeopleItems(useTimeTrackingStore.getState().scopes, people, (task) =>
        joinedCompanyPenIds(task.personPipelines as Parameters<typeof joinedCompanyPenIds>[0]),
      )
      if (items.join.length || items.create.length) {
        const listId = ensurePeopleIKnowList()
        for (const row of items.join) {
          const task = useTaskStore.getState().tasks.find((t) => t.id === row.taskId)
          if (task) useTaskStore.getState().updateTask(withCompanyPen(task, row.penId))
        }
        for (const row of items.create) {
          useTaskStore.getState().addTask(withCompanyPen(createPerson(row.name, listId), row.penId))
        }
      }
      // Phone pens wear the name of the person whose number they are (`lib/phone-sync/person-links.ts`).
      const scopes = useTimeTrackingStore.getState().scopes
      const relinked = relinkPhonePens(scopes, phonePeople())
      if (relinked !== scopes) useTimeTrackingStore.setState({ scopes: relinked })
    })
    backfillOnce()
  } finally {
    running = false
  }
}

function backfillOnce(): void {
  if (typeof window === "undefined") return
  try {
    if (readAliasedLocal(BACKFILL_KEY)) return
  } catch {
    return
  }
  const state = useTimeTrackingStore.getState()
  const scopes = state.scopes
  const windows = new Map<string, { date: string; scopeId: string; startMin: number; endMin: number }>()
  for (const entry of state.entries) {
    if (isInstant(entry)) continue
    const scope = scopes.find((s) => s.id === entry.scopeId)
    const pen = scope?.pens.find((p) => p.id === entry.penId)
    const relevant =
      entry.scopeId === COMPANY || (pen && isWhoPen(entry.scopeId, pen) && (entry.variantIds?.length ?? 0) > 0)
    if (!relevant) continue
    const key = `${entry.date}|${entry.scopeId}|${entry.startMin}|${entry.endMin}`
    windows.set(key, { date: entry.date, scopeId: entry.scopeId, startMin: entry.startMin, endMin: entry.endMin })
  }
  withoutUndo(() => {
    for (const window of windows.values()) useTimeTrackingStore.getState().mirrorDetails(window)
  })
  try {
    writeAliasedLocal(BACKFILL_KEY, new Date().toISOString())
  } catch {
    /* private mode: it runs again next time, harmlessly */
  }
}

function queue(): void {
  if (queued) return
  queued = true
  queueMicrotask(() => {
    queued = false
    syncPeopleNow()
  })
}

export function startPeopleSync(): () => void {
  return startHydratedStoreSync({
    slot,
    persists: [useTaskStore.persist, useTimeTrackingStore.persist],
    onReady: () => {
      queue()
      const stopTracking = useTimeTrackingStore.subscribe((state, previous) => {
        if (state.scopes !== previous.scopes) queue()
      })
      const stopTasks = useTaskStore.subscribe((state, previous) => {
        if (state.tasks !== previous.tasks && !running) queue()
      })
      return () => {
        stopTracking()
        stopTasks()
      }
    },
  })
}
