/**
 * components/Home/Tracking/tracking-log/open-log-entry.ts — Open one log row as its item
 *
 * Day shelves, week agenda rows, and shelf dialogs use this. The pointer id is
 * `tracking-entry-` plus the time-entry id. `syncTrackingLists` files a missing
 * pointer and leaves an id in `removedTaskIds` deleted. The popup is the log
 * item desk for that subtype. Painted blocks stay on the block editor.
 */
import { openItemDetailPopup } from "@/lib/points-ledger-nav"
import { syncTrackingLists, trackingItemId } from "@/lib/tracking-lists"
import { useTaskStore } from "@/lib/task-store"

export function openLogEntry(entryId: string): void {
  if (!entryId) return
  syncTrackingLists()
  const itemId = trackingItemId(entryId)
  const state = useTaskStore.getState()
  if ((state.removedTaskIds ?? []).includes(itemId)) return
  if (!state.tasks.some((task) => task.id === itemId)) return
  openItemDetailPopup(itemId)
}
