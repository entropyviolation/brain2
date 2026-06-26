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
