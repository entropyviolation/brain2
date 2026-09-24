/**
 * components/spreadsheet/sheet-popout.ts — Spreadsheet pop-out routing
 *
 * Open a list/category's spreadsheet grid in its own full-size window. Same
 * dedicated `/popout/` page as module workspaces (`?sheet=<categoryId>`). Hash
 * `#popout/sheet/<id>` is still parsed so old links keep working.
 *
 * Electron uses `window.desktop.openModulePopout(path)`; the browser uses
 * `window.open`. Pure + framework-free so `app/popout/page.tsx` can detect the
 * route without importing the (heavy) grid component.
 */

/** Hash prefix for the spreadsheet pop-out route: `#popout/sheet/<categoryId>`. */
export const SHEET_POPOUT_PREFIX = "popout/sheet/"

export function sheetPopoutHash(categoryId: string): string {
  return `#${SHEET_POPOUT_PREFIX}${encodeURIComponent(categoryId)}`
}

/** Static-export-safe path for the standalone spreadsheet window. */
export function sheetPopoutPath(categoryId: string): string {
  return `/popout/?sheet=${encodeURIComponent(categoryId)}`
}

/** Extract a category id from a sheet pop-out hash, or null if it isn't one. */
export function parseSheetPopoutCategoryId(hash: string | undefined | null): string | null {
  if (!hash) return null
  const h = hash.replace(/^#/, "")
  if (!h.startsWith(SHEET_POPOUT_PREFIX)) return null
  const id = decodeURIComponent(h.slice(SHEET_POPOUT_PREFIX.length))
  return id || null
}

/** Extract a category id from `?sheet=` (used by `/popout/`). */
export function parseSheetPopoutFromSearch(search: string | undefined | null): string | null {
  if (!search) return null
  const params = new URLSearchParams(search.startsWith("?") ? search.slice(1) : search)
  const id = params.get("sheet")
  return id || null
}

export function parseSheetPopoutLocation(loc: { hash?: string; search?: string }): string | null {
  return parseSheetPopoutFromSearch(loc.search) ?? parseSheetPopoutCategoryId(loc.hash)
}

interface DesktopPopoutBridge {
  openModulePopout?: (target: string) => void
}

/** Open a list's spreadsheet in its own window: Electron BrowserWindow, else `window.open`. */
export function openSheetPopout(categoryId: string): void {
  if (typeof window === "undefined") return
  const path = sheetPopoutPath(categoryId)
  const desktop = (window as unknown as { desktop?: DesktopPopoutBridge }).desktop
  if (desktop?.openModulePopout) {
    desktop.openModulePopout(path)
    return
  }
  const url = new URL(path, window.location.origin).href
  window.open(url, `cogs-sheet-${categoryId}`, "popup=yes,width=1400,height=900")
}
