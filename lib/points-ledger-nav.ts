/**
 * lib/points-ledger-nav.ts — Jump to the Data points ledger, or to one item
 *
 * `openPointsLedger` writes the app tab (Data) and the Data view
 * (Points), fires the nav-restore event so the mounted shell re-reads them,
 * then scrolls the ledger plate (`#analytics-points-ledger`) into view once the
 * lazy view has painted. An optional row is remembered for one read so the
 * ledger opens with that award expanded.
 *
 * `openItemDetailPage` opens full-page item detail from any screen the same
 * way Back/Forward does (writes `appItemId`, fires nav-restore).
 */
import { APP_NAV_KEYS, writeStoredId, writeStoredTab } from "@/lib/app-navigation"
import { COGS_NAV_RESTORE_EVENT } from "@/lib/screen-location"

export const POINTS_LEDGER_ANCHOR = "analytics-points-ledger"
const FOCUS_KEY = "brain2-points-ledger-focus"

export type LedgerFocus = { date: string; taskId: string }

function restore(): void {
  window.dispatchEvent(new CustomEvent(COGS_NAV_RESTORE_EVENT))
}

export function openPointsLedger(focus?: LedgerFocus): void {
  if (typeof window === "undefined") return
  try {
    if (focus) window.sessionStorage.setItem(FOCUS_KEY, JSON.stringify(focus))
    else window.sessionStorage.removeItem(FOCUS_KEY)
  } catch {
    // The ledger still opens; the row just is not expanded.
  }
  writeStoredId(APP_NAV_KEYS.appItemId, null)
  writeStoredTab(APP_NAV_KEYS.analyticsTab, "points")
  writeStoredTab(APP_NAV_KEYS.appTab, "analytics")
  restore()
  const started = Date.now()
  const seek = () => {
    const el = document.getElementById(POINTS_LEDGER_ANCHOR)
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "start" })
      return
    }
    if (Date.now() - started < 4000) window.setTimeout(seek, 80)
  }
  window.setTimeout(seek, 0)
}

/** Read (and clear) the row the ledger should open expanded. */
export function takeLedgerFocus(): LedgerFocus | null {
  if (typeof window === "undefined") return null
  try {
    const raw = window.sessionStorage.getItem(FOCUS_KEY)
    window.sessionStorage.removeItem(FOCUS_KEY)
    if (!raw) return null
    const value = JSON.parse(raw) as Partial<LedgerFocus>
    return typeof value.date === "string" && typeof value.taskId === "string" ? { date: value.date, taskId: value.taskId } : null
  } catch {
    return null
  }
}

export function openItemDetailPage(itemId: string): void {
  if (typeof window === "undefined") return
  writeStoredId(APP_NAV_KEYS.appItemId, itemId)
  restore()
}

/** The app shell listens for this and opens the item as a popup over the current screen. */
export const OPEN_ITEM_POPUP_EVENT = "brain2-open-item-popup"

/** Open item detail as a popup above whatever is showing (Data keeps its place). */
export function openItemDetailPopup(itemId: string): void {
  if (typeof window === "undefined") return
  window.dispatchEvent(new CustomEvent(OPEN_ITEM_POPUP_EVENT, { detail: { id: itemId } }))
}
