/**
 * lib/flight-bimby/backfill.ts — File flights that were pasted before the Flight BIMBY existed
 *
 * BIM chat kept every pasted line in its transcript, so a confirmation that was only logged can be
 * read again and filed. `backfillFlightsFromChat` is safe to repeat: ids are deterministic, so a
 * flight already filed comes back "existing". The caller waits for the task and event stores to
 * finish loading first (a write onto a store still on its seed would be lost or overwrite the vault).
 */
import { useEventStore } from "@/lib/event-store"
import { useTaskStore } from "@/lib/task-store"
import { looksLikeFlightConfirmation } from "./extract"
import { flushScheduledPersist } from "@/lib/persist-storage"
import { addFlightFromInfo, createEventFromFlight } from "./file"
import type { FiledFlight } from "./types"

export const FLIGHT_BACKFILL_KEY = "bimchat-flight-backfill-v2"

type Persisted = { persist?: { hasHydrated?: () => boolean; onFinishHydration?: (fn: () => void) => () => void } }

function whenHydrated(store: Persisted, timeoutMs: number): Promise<void> {
  const persist = store.persist
  if (!persist?.hasHydrated || persist.hasHydrated()) return Promise.resolve()
  return new Promise((resolve) => {
    const timer = setTimeout(resolve, timeoutMs)
    const stop = persist.onFinishHydration?.(() => {
      clearTimeout(timer)
      stop?.()
      resolve()
    })
  })
}

export async function whenFlightStoresReady(timeoutMs = 20_000): Promise<void> {
  await Promise.all([whenHydrated(useTaskStore as unknown as Persisted, timeoutMs), whenHydrated(useEventStore as unknown as Persisted, timeoutMs)])
}

/** Read each line you sent, oldest first, and file the flights in the ones that are confirmations. */
export async function backfillFlightsFromChat(lines: readonly { who: string; text: string; at: string }[]): Promise<FiledFlight[]> {
  const filed: FiledFlight[] = []
  for (const line of lines) {
    if (line.who !== "you") continue
    const when = new Date(line.at)
    const now = Number.isNaN(when.getTime()) ? new Date() : when
    if (!looksLikeFlightConfirmation(line.text, now)) continue
    const done = await addFlightFromInfo(line.text, { now })
    filed.push(...done.filed)
  }
  return filed
}

const pause = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

/**
 * Flush the writes, wait a beat, and make sure each filed flight's event is still on the calendar.
 * A store that reloads from the vault right after a write can drop an event that had not been saved
 * yet, so a missing one is made again from its Flight item. Resolves true when every event is there.
 */
export async function confirmFlightsLanded(filed: readonly FiledFlight[]): Promise<boolean> {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    flushScheduledPersist()
    await pause(2500)
    const missing = filed.filter((f) => f.eventId && !useEventStore.getState().events.some((e) => e.id === f.eventId))
    const lost = filed.filter((f) => !useTaskStore.getState().tasks.some((t) => t.id === f.taskId))
    if (!missing.length && !lost.length) return true
    for (const f of missing) createEventFromFlight(f.taskId)
  }
  flushScheduledPersist()
  return false
}
