/**
 * electron/preload.js — Electron preload (context-isolated)
 *
 * Runs in the renderer before the web app loads and exposes a minimal, read-only
 * `window.desktop` API (`isElectron`, `platform`, `versions`) via `contextBridge`.
 * This is the only privileged surface available to the renderer; all app data
 * stays in localStorage/Zustand in the renderer today; future MongoDB access
 * will go through IPC handlers exposed here (see docs/SPEC_MAPPING.md §3).
 */
const { contextBridge } = require("electron")

// Expose a minimal, read-only surface to the renderer. App data lives in
// localStorage/Zustand today; MongoDB IPC channels will be added here when the
// storage layer lands (see docs/SPEC_MAPPING.md §3).
contextBridge.exposeInMainWorld("desktop", {
  isElectron: true,
  platform: process.platform,
  versions: {
    electron: process.versions.electron,
    chrome: process.versions.chrome,
    node: process.versions.node,
  },
})
