/**
 * electron/preload.js — Electron preload (context-isolated)
 *
 * Runs in the renderer before the web app loads and exposes a minimal, read-only
 * `window.desktop` API (`isElectron`, `platform`, `versions`, `fetchAppleNotes`, `fetchScreenTime`, …) via `contextBridge`.
 * This is the only privileged surface available to the renderer; all app data
 * stays in localStorage/Zustand in the renderer today; future MongoDB access
 * will go through IPC handlers exposed here (see docs/SPEC_MAPPING.md §3).
 */
const { contextBridge, ipcRenderer } = require("electron")

// Sandbox: true blocks require() of app files, so this fallback is what actually
// runs. It used to return the hub value whenever one existed, and every refresh
// painted that over localStorage. The hub's home tab was stuck on "tracking"
// and its time grid was missing blocks that only this profile had saved, so
// Habits snapped back to Tracking and painted blocks disappeared.
function keepPresentLocal(local, hubValue) {
  if (typeof local === "string" && local !== "") return local
  return typeof hubValue === "string" && hubValue !== "" ? hubValue : null
}
let pickPersistItem = keepPresentLocal
let stampAppearancePins = (_blob, _name) => {}
let shouldSkipHubAppearanceCopy = () => false
try {
  ;({
    pickPersistItem,
    stampAppearancePins,
    shouldSkipHubAppearanceCopy,
  } = require("../lib/vault-guard.js"))
} catch {
  pickPersistItem = keepPresentLocal
}

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

// ActivityWatch screen time (loopback aw-server). MUST match
// `FETCH_SCREENTIME_IPC_CHANNEL` in electron/main.js + `fetchScreenTime` in
// electron/ipc/channels.js.
const FETCH_SCREENTIME_IPC_CHANNEL = "cogs:screentime:fetchScreenTime"

const TELEGRAM_SET_TOKEN = "cogs:telegram:setToken"
const TELEGRAM_CLEAR_TOKEN = "cogs:telegram:clearToken"
const TELEGRAM_HAS_TOKEN = "cogs:telegram:hasToken"
const TELEGRAM_START = "cogs:telegram:start"
const TELEGRAM_STOP = "cogs:telegram:stop"
const TELEGRAM_STATUS = "cogs:telegram:status"
const TELEGRAM_SEND = "cogs:telegram:send"
const TELEGRAM_PIN = "cogs:telegram:pin"
const TELEGRAM_MESSAGE = "cogs:telegram:message"
const TELEGRAM_POLL_STATUS = "cogs:telegram:pollStatus"

// Chrome localhost persist snapshot. MUST match electron/main.js.
const GET_SHARED_PERSIST_IPC_CHANNEL = "cogs:persist:getShared"

function hydrateLocalStorageFromChromeHub() {
  try {
    const snapshot = ipcRenderer.sendSync(GET_SHARED_PERSIST_IPC_CHANNEL)
    const items = snapshot && snapshot.items
    if (!items || typeof items !== "object") return
    for (const [name, value] of Object.entries(items)) {
      if (typeof name !== "string" || typeof value !== "string") continue
      // Hub dual-writes brain2-* and cogs-*. Applying both doubles quota and
      // can resurrect a stale cogs twin over a live brain2 vault.
      if (name.startsWith("cogs-")) {
        const twin = "brain2-" + name.slice("cogs-".length)
        if (typeof items[twin] === "string") continue
      }
      if (name.includes("friend-pic:")) continue
      const local = localStorage.getItem(name)
      // This profile's theme blob / PCB / LED pins are the last pick. A hub
      // snapshot (or a stale pin overlay on it) must not paint them back on launch.
      if (shouldSkipHubAppearanceCopy(name, local)) {
        if (typeof local === "string" && local && name.endsWith("theme-store")) {
          try {
            stampAppearancePins(local, name)
          } catch {
            /* pin restamp is best-effort */
          }
        }
        continue
      }
      const chosen = pickPersistItem(local, value, name)
      if (typeof chosen === "string" && chosen !== local) {
        try {
          localStorage.setItem(name, chosen)
        } catch {
          /* quota: skip this hub key; live keys already in the profile stay */
        }
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
  // Open a module (or sheet) in its own window at `/popout/?module=` /
  // `/popout/?sheet=` (legacy `#popout/…` hashes still accepted). Fire-and-forget;
  // the web build lacks this method so callers fall back to `window.open`.
  openModulePopout: (target) => ipcRenderer.send(OPEN_MODULE_POPOUT_IPC_CHANNEL, target),
  // Read Apple Notes for a date window. Resolves to `{ ok, notes }` or
  // `{ ok: false, error, code }`. Absent in the web build.
  fetchAppleNotes: (range) => ipcRenderer.invoke(FETCH_APPLE_NOTES_IPC_CHANNEL, range),
  // Query local ActivityWatch. Resolves to health or window/afk/web events.
  fetchScreenTime: (req) => ipcRenderer.invoke(FETCH_SCREENTIME_IPC_CHANNEL, req),
  telegram: {
    setToken: (token) => ipcRenderer.invoke(TELEGRAM_SET_TOKEN, token),
    clearToken: () => ipcRenderer.invoke(TELEGRAM_CLEAR_TOKEN),
    hasToken: () => ipcRenderer.invoke(TELEGRAM_HAS_TOKEN),
    start: () => ipcRenderer.invoke(TELEGRAM_START),
    stop: () => ipcRenderer.invoke(TELEGRAM_STOP),
    status: () => ipcRenderer.invoke(TELEGRAM_STATUS),
    send: (chatId, text) => ipcRenderer.invoke(TELEGRAM_SEND, chatId, text),
    pin: (chatId, messageId, previousId) => ipcRenderer.invoke(TELEGRAM_PIN, chatId, messageId, previousId),
    onMessage: (cb) => {
      const listener = (_event, payload) => cb(payload)
      ipcRenderer.on(TELEGRAM_MESSAGE, listener)
      return () => ipcRenderer.removeListener(TELEGRAM_MESSAGE, listener)
    },
    onStatus: (cb) => {
      const listener = (_event, payload) => cb(payload)
      ipcRenderer.on(TELEGRAM_POLL_STATUS, listener)
      return () => ipcRenderer.removeListener(TELEGRAM_POLL_STATUS, listener)
    },
  },
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
