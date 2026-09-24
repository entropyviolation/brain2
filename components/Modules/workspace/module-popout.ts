/**
 * components/Modules/workspace/module-popout.ts — Module pop-out routing
 *
 * Opens a workspace in a standalone window that is *not* the full app shell.
 * The canonical route is a dedicated static page: `/popout/?module=<moduleId>`.
 * Hash `#popout/module/<id>` is still parsed so old links keep working.
 *
 * Electron loads that path in a real BrowserWindow (`window.desktop.openModulePopout`);
 * the browser falls back to `window.open`.
 */

export const MODULE_POPOUT_PREFIX = "popout/module/"

export function modulePopoutHash(moduleId: string): string {
  return `#${MODULE_POPOUT_PREFIX}${encodeURIComponent(moduleId)}`
}

/** Static-export-safe path for the standalone module window. */
export function modulePopoutPath(moduleId: string): string {
  return `/popout/?module=${encodeURIComponent(moduleId)}`
}

/** Extract a module id from a pop-out hash, or null if the hash isn't one. */
export function parseModulePopoutModuleId(hash: string | undefined | null): string | null {
  if (!hash) return null
  const h = hash.replace(/^#/, "")
  if (!h.startsWith(MODULE_POPOUT_PREFIX)) return null
  const id = decodeURIComponent(h.slice(MODULE_POPOUT_PREFIX.length))
  return id || null
}

/** Extract a module id from `?module=` (used by `/popout/`). */
export function parseModulePopoutFromSearch(search: string | undefined | null): string | null {
  if (!search) return null
  const params = new URLSearchParams(search.startsWith("?") ? search.slice(1) : search)
  const id = params.get("module")
  return id || null
}

export function parseModulePopoutLocation(loc: { hash?: string; search?: string }): string | null {
  return parseModulePopoutFromSearch(loc.search) ?? parseModulePopoutModuleId(loc.hash)
}

interface DesktopPopoutBridge {
  openModulePopout?: (target: string) => void
}

/** Open a module in its own window: Electron BrowserWindow, else `window.open`. */
export function openModulePopout(moduleId: string): void {
  if (typeof window === "undefined") return
  const path = modulePopoutPath(moduleId)
  const desktop = (window as unknown as { desktop?: DesktopPopoutBridge }).desktop
  if (desktop?.openModulePopout) {
    desktop.openModulePopout(path)
    return
  }
  const url = new URL(path, window.location.origin).href
  window.open(url, `cogs-module-${moduleId}`, "popup=yes,width=1200,height=820")
}
