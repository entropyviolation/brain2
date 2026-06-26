/**
 * components/spreadsheet/sheet-popout.ts — Spreadsheet pop-out routing
 *
 * Open a list/category's spreadsheet grid in its own full-size window. Reuses the
 * app's existing pop-out convention (same as Module workspaces, see
 * `components/Modules/workspace/ModuleWorkspace.tsx`): a hash route the root page
 * recognizes, opened in Electron via the generic `window.desktop.openModulePopout`
 * bridge (any `#popout/...` hash) and in the browser via `window.open`.
 *
 * Pure + framework-free so `app/page.tsx` can detect the route without importing
 * the (heavy) grid component.
 */

/** Hash prefix for the spreadsheet pop-out route: `#popout/sheet/<categoryId>`. */
export const SHEET_POPOUT_PREFIX = "popout/sheet/"

export function sheetPopoutHash(categoryId: string): string {
  return `#${SHEET_POPOUT_PREFIX}${encodeURIComponent(categoryId)}`
}

/** Extract a category id from a sheet pop-out hash, or null if it isn't one. */
export function parseSheetPopoutCategoryId(hash: string | undefined | null): string | null {
  if (!hash) return null
  const h = hash.replace(/^#/, "")
  if (!h.startsWith(SHEET_POPOUT_PREFIX)) return null
  const id = decodeURIComponent(h.slice(SHEET_POPOUT_PREFIX.length))
  return id || null
}

interface DesktopPopoutBridge {
  openModulePopout?: (hash: string) => void
}

/** Open a list's spreadsheet in its own window: Electron BrowserWindow, else `window.open`. */
export function openSheetPopout(categoryId: string): void {
  if (typeof window === "undefined") return
  const hash = sheetPopoutHash(categoryId)
  const desktop = (window as unknown as { desktop?: DesktopPopoutBridge }).desktop
  if (desktop?.openModulePopout) {
    desktop.openModulePopout(hash)
    return
  }
  const url = `${window.location.pathname}${window.location.search}${hash}`
  window.open(url, `cogs-sheet-${categoryId}`, "noopener,width=1400,height=900")
}
