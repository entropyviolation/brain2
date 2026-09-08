/**
 * electron/preload.js — Electron preload (context-isolated)
 *
 * Runs in the renderer before the web app loads and exposes a minimal, read-only
 * `window.desktop` API (`isElectron`, `platform`, `versions`) via `contextBridge`.
 * This is the only privileged surface available to the renderer; all app data
 * stays in localStorage/Zustand in the renderer today; future MongoDB access
 * will go through IPC handlers exposed here (see docs/SPEC_MAPPING.md §3).
 */
const { contextBridge, ipcRenderer } = require("electron")

// Quick-capture IPC channel (Feature 10). MUST match `QUICK_CAPTURE_IPC_CHANNEL`
// in `hooks/useQuickCaptureHotkey.ts` + `electron/main.js`.
const QUICK_CAPTURE_IPC_CHANNEL = "quick-capture:open"

// Optional PDF text-extraction channel (Workstream D). MUST match
// `EXTRACT_PDF_TEXT_IPC_CHANNEL` in electron/main.js + `extractPdfText` in
// electron/ipc/channels.js. Consumed by lib/file-extract.ts.
const EXTRACT_PDF_TEXT_IPC_CHANNEL = "cogs:file:extractPdfText"

// Module pop-out channel (Workstream C). MUST match `OPEN_MODULE_POPOUT_IPC_CHANNEL`
// in electron/main.js + `openModulePopout` in electron/ipc/channels.js. Consumed
// by components/Modules/workspace/ModuleWorkspace.tsx (`openModulePopout`).
const OPEN_MODULE_POPOUT_IPC_CHANNEL = "cogs:window:openModulePopout"

// Apple Notes ingest (iCloud / iPhone + On My Mac). MUST match
// `FETCH_APPLE_NOTES_IPC_CHANNEL` in electron/main.js + `fetchAppleNotes` in
// electron/ipc/channels.js. Consumed by lib/apple-notes.ts.
const FETCH_APPLE_NOTES_IPC_CHANNEL = "cogs:notes:fetchAppleNotes"

// Chrome localhost persist snapshot. MUST match electron/main.js.
const GET_SHARED_PERSIST_IPC_CHANNEL = "cogs:persist:getShared"

function hydrateLocalStorageFromChromeHub() {
  try {
    const snapshot = ipcRenderer.sendSync(GET_SHARED_PERSIST_IPC_CHANNEL)
    const items = snapshot && snapshot.items
    if (!items || typeof items !== "object") return
    for (const [name, value] of Object.entries(items)) {
      // Seed missing keys only. Overwriting on every boot replaced this
      // profile's live vault with a stale Chrome snapshot (lost completions).
      if (typeof name === "string" && typeof value === "string" && localStorage.getItem(name) == null) {
        localStorage.setItem(name, value)
      }
    }
  } catch {
    // Hub is optional; never throw out of preload.
  }
}

hydrateLocalStorageFromChromeHub()

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
  // Best-effort PDF → text extraction in the main process (lib/file-extract.ts).
  // Resolves to "" when extraction is unavailable; never rejects in practice.
  extractPdfText: (dataUrl) => ipcRenderer.invoke(EXTRACT_PDF_TEXT_IPC_CHANNEL, dataUrl),
  // Open a module in its own window at the given pop-out hash (e.g.
  // "#popout/module/<id>"). Fire-and-forget; the web build lacks this method so
  // callers fall back to `window.open`.
  openModulePopout: (hash) => ipcRenderer.send(OPEN_MODULE_POPOUT_IPC_CHANNEL, hash),
  // Read Apple Notes for a date window. Resolves to `{ ok, notes }` or
  // `{ ok: false, error, code }`. Absent in the web build.
  fetchAppleNotes: (range) => ipcRenderer.invoke(FETCH_APPLE_NOTES_IPC_CHANNEL, range),
})

// Bridge the main-process global quick-capture accelerator to the renderer hook
// (`useQuickCaptureHotkey` calls `window.electron.onQuickCapture(cb)`). Returns
// an unsubscribe function.
contextBridge.exposeInMainWorld("electron", {
  onQuickCapture: (cb) => {
    const listener = () => cb()
    ipcRenderer.on(QUICK_CAPTURE_IPC_CHANNEL, listener)
    return () => ipcRenderer.removeListener(QUICK_CAPTURE_IPC_CHANNEL, listener)
  },
})
