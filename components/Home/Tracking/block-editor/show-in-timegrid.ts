/**
 * components/Home/Tracking/block-editor/show-in-timegrid.ts — Jump from a block to the Time Grid
 *
 * The block editor can sit on the Activity Log, the Day Log, Data, the
 * task card, or the header Now popup. This leaves that layer, opens Home →
 * Tracking → Time Grid on the block's day and view, and asks the day grid to
 * scroll that block's hour up under the ruler. The block is named by id, so
 * two blocks that share a clock still land on the one that was open.
 */
import { APP_NAV_KEYS, writeStoredTab } from "@/lib/app-navigation"
import { formatLocalDateKey, parseLocalDate } from "@/lib/date-utils"
import { COGS_NAV_RESTORE_EVENT } from "@/lib/screen-location"
import { closeTaskCard } from "@/lib/task-card"
import { useTimeTrackingStore } from "@/lib/time-tracking-store"
import { pinHomeCursor } from "@/lib/use-current-date"
import { setTimegridReveal } from "@/components/Home/Tracking/timegrid-reveal"

/**
 * Point the desk at this saved block and ask the day grid to scroll it into
 * view. A missing id, or an id no longer on the store, does nothing.
 * Call after a pending save has been written — the position is read from the
 * store, not from an open draft.
 */
export function showBlockInTimegrid(entryId: string): void {
  if (!entryId) return
  const entry = useTimeTrackingStore.getState().entries.find((item) => item.id === entryId)
  if (!entry) return
  const date = parseLocalDate(entry.date)
  if (!date) return

  const state = useTimeTrackingStore.getState()
  if (state.activeScopeId !== entry.scopeId) state.setActiveScope(entry.scopeId)
  if (state.gridSpan !== "day") state.setGridSpan("day")
  if (state.infiniteScroll) state.setInfiniteScroll(false)

  pinHomeCursor(date, formatLocalDateKey(date) === formatLocalDateKey(new Date()))
  closeTaskCard()
  writeStoredTab(APP_NAV_KEYS.appTab, "home")
  writeStoredTab(APP_NAV_KEYS.homeTab, "tracking")
  writeStoredTab(APP_NAV_KEYS.homeTrackingTab, "grid")
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent(COGS_NAV_RESTORE_EVENT))
  }
  setTimegridReveal({
    entryId: entry.id,
    date: entry.date,
    scopeId: entry.scopeId,
    startMin: entry.startMin,
  })
}
