/**
 * electron/main.js — Electron main process
 *
 * Boots the desktop shell around the static Next.js export. Registers the
 * privileged `app://` scheme, creates the BrowserWindow, and loads either the
 * Next dev server (development) or the bundled `out/` export via `app://`
 * (production). Resolves static file paths (including `trailingSlash` index.html
 * handling) and memoizes them for the life of the process. Routes external
 * links to the system browser, and manages the app/window lifecycle. The
 * Chrome persist hub is parsed once per file revision and reused for every
 * window.
 *
 * Spec: §2.1 "Option B — Electron". A future **MongoDB** connection + IPC layer
 * (spec §3; local `mongod` or Atlas) would be initialized here.
 */
const { app, BrowserWindow, shell, protocol, net, globalShortcut, ipcMain } = require("electron")
const path = require("path")
const fs = require("fs")
const { pathToFileURL } = require("url")
const { resolveElectronUserData } = require("./user-data-path")
const { createSharedPersistCache, hubRevArgument } = require("./persist-hub-cache")
const { createStaticFileResolver } = require("./static-file")

const isDev = !app.isPackaged

// Pin userData before ready. package.json `name` is now brain2; the live vault
// still lives in Application Support/cogs. A rename that follows the product
// name would boot an empty profile (seed lists, missing habits).
app.setPath("userData", resolveElectronUserData(app.getPath("appData")))
console.log("[brain2] vault", app.getPath("userData"))
// Must stay on localhost (not 127.0.0.1) — localStorage is origin-scoped and all
// persisted Zustand data lives under http://localhost:3000.
const DEV_SERVER_URL = "http://localhost:3000"

// Quick-capture global hotkey (Feature 10, Worker J). These MUST stay in sync
// with `QUICK_CAPTURE_GLOBAL_ACCELERATOR` / `QUICK_CAPTURE_IPC_CHANNEL` in
// `hooks/useQuickCaptureHotkey.ts` (duplicated here because the main process is
// plain CommonJS and the hook is bundled TS — same pattern as electron/ipc/channels.js).
const QUICK_CAPTURE_GLOBAL_ACCELERATOR = "CommandOrControl+Alt+Space"
const QUICK_CAPTURE_IPC_CHANNEL = "quick-capture:open"

// Optional PDF text-extraction channel (Workstream D). MUST match
// `extractPdfText` in electron/ipc/channels.js + `window.desktop.extractPdfText`
// bridged in electron/preload.js. Duplicated here because the main process is
// plain CommonJS (same convention as the quick-capture channel above).
const EXTRACT_PDF_TEXT_IPC_CHANNEL = "cogs:file:extractPdfText"

// Module pop-out channel (Workstream C). MUST match `openModulePopout` in
// electron/ipc/channels.js + `window.desktop.openModulePopout` bridged in
// electron/preload.js. Opens a module (or sheet) in its own BrowserWindow at
// `/popout/?module=<id>` or `/popout/?sheet=<id>` (legacy `#popout/…` hashes
// are still accepted and rewritten).
const OPEN_MODULE_POPOUT_IPC_CHANNEL = "cogs:window:openModulePopout"

// Apple Notes ingest. MUST match `fetchAppleNotes` in electron/ipc/channels.js +
// `window.desktop.fetchAppleNotes` in electron/preload.js.
const FETCH_APPLE_NOTES_IPC_CHANNEL = "cogs:notes:fetchAppleNotes"

// ActivityWatch screen time. MUST match `fetchScreenTime` in electron/ipc/channels.js +
// `window.desktop.fetchScreenTime` in electron/preload.js.
const FETCH_SCREENTIME_IPC_CHANNEL = "cogs:screentime:fetchScreenTime"

// Dev persist hub (Chrome localhost snapshot). MUST match preload.
const GET_SHARED_PERSIST_IPC_CHANNEL = "cogs:persist:getShared"

// Directory containing the static Next.js export (`next build` with
// `output: "export"`). In production this is bundled alongside the app.
const OUT_DIR = path.join(__dirname, "..", "out")
const sharedPersist = createSharedPersistCache(
  fs,
  path.join(__dirname, "..", "data", "shared-persist.json"),
)
const resolveStaticFile = createStaticFileResolver(fs, OUT_DIR)

// Register a privileged custom scheme so the renderer behaves like it is on a
// real origin (needed for things like localStorage, fetch, history API, etc.).
protocol.registerSchemesAsPrivileged([
  {
    scheme: "app",
    privileges: {
      standard: true,
      secure: true,
      supportFetchAPI: true,
      stream: true,
    },
  },
])

// Tracks the primary window so the global capture shortcut can focus it.
let mainWindow = null

function createWindow() {
  const win = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 900,
    minHeight: 600,
    title: "BRAIN2",
    backgroundColor: "#ffffff",
    webPreferences: windowWebPreferences(),
  })

  win.webContents.on("did-fail-load", (_event, errorCode, errorDescription, validatedURL) => {
    console.error(`[cogs] failed to load ${validatedURL}: ${errorDescription} (${errorCode})`)
    if (isDev) {
      console.error(`[cogs] expected the Next dev server at ${DEV_SERVER_URL}.`)
      console.error("[cogs] If another node process is stuck on port 3000, kill it and rerun npm run electron:dev.")
    }
  })

  if (isDev) {
    win.loadURL(DEV_SERVER_URL)
    // Detached DevTools on this vault doubles the renderer cost. Opt in with
    // COGS_DEVTOOLS=1; otherwise Cmd-Opt-I still opens them.
    if (process.env.COGS_DEVTOOLS === "1") {
      win.webContents.openDevTools({ mode: "detach" })
    }
  } else {
    win.loadURL("app://local/")
  }

  // Open external links (http/https) in the user's default browser instead of
  // inside the desktop window.
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith("http://") || url.startsWith("https://")) {
      shell.openExternal(url)
      return { action: "deny" }
    }
    return { action: "allow" }
  })

  mainWindow = win
  win.on("closed", () => {
    if (mainWindow === win) mainWindow = null
  })
}

/**
 * Decode a `data:` URL (base64 or percent-encoded) into a Node Buffer. Returns
 * an empty Buffer for anything that isn't a usable data URL.
 */
function dataUrlToBuffer(dataUrl) {
  if (typeof dataUrl !== "string") return Buffer.alloc(0)
  const comma = dataUrl.indexOf(",")
  if (comma === -1 || !dataUrl.startsWith("data:")) return Buffer.alloc(0)
  const meta = dataUrl.slice(5, comma)
  const data = dataUrl.slice(comma + 1)
  if (/;base64/i.test(meta)) return Buffer.from(data, "base64")
  return Buffer.from(decodeURIComponent(data), "utf-8")
}

/**
 * Best-effort PDF → text extraction in the main process. Lazily requires
 * `pdf-parse` so the dependency is optional: if it isn't installed (or parsing
 * fails) we resolve to "" rather than crashing the desktop shell. The renderer
 * (lib/file-extract.ts) treats "" as "no text available".
 */
async function extractPdfText(dataUrl) {
  try {
    const buffer = dataUrlToBuffer(dataUrl)
    if (!buffer.length) return ""
    // eslint-disable-next-line global-require
    const pdfParse = require("pdf-parse")
    const result = await pdfParse(buffer)
    return (result && typeof result.text === "string" ? result.text : "").trim()
  } catch (err) {
    console.warn("[cogs] PDF text extraction unavailable:", err && err.message)
    return ""
  }
}

/** Register the optional PDF extraction IPC handler. */
function registerFileIpcHandlers() {
  ipcMain.handle(EXTRACT_PDF_TEXT_IPC_CHANNEL, (_event, dataUrl) => extractPdfText(dataUrl))
}

/**
 * Resolve a renderer pop-out target to a full load URL. Accepts the dedicated
 * `/popout/?module=` / `/popout/?sheet=` path (preferred) or the legacy
 * `#popout/module|sheet/<id>` hash. Anything else is rejected so the window
 * cannot be pointed at an arbitrary URL.
 */
function resolvePopoutLoadURL(target) {
  if (typeof target !== "string" || !target) return null

  let pathAndQuery = null

  if (target.startsWith("#popout/module/")) {
    const id = target.slice("#popout/module/".length)
    if (!id) return null
    pathAndQuery = `/popout/?module=${id}`
  } else if (target.startsWith("#popout/sheet/")) {
    const id = target.slice("#popout/sheet/".length)
    if (!id) return null
    pathAndQuery = `/popout/?sheet=${id}`
  } else if (target.startsWith("/popout")) {
    try {
      const parsed = new URL(target, "https://cogs.local")
      if (parsed.pathname !== "/popout" && parsed.pathname !== "/popout/") return null
      const moduleId = parsed.searchParams.get("module")
      const sheetId = parsed.searchParams.get("sheet")
      if (moduleId && !sheetId) {
        pathAndQuery = `/popout/?module=${encodeURIComponent(moduleId)}`
      } else if (sheetId && !moduleId) {
        pathAndQuery = `/popout/?sheet=${encodeURIComponent(sheetId)}`
      } else {
        return null
      }
    } catch {
      return null
    }
  }

  if (!pathAndQuery) return null
  return isDev ? `${DEV_SERVER_URL}${pathAndQuery}` : `app://local${pathAndQuery}`
}

const popoutWindows = new Map()

/**
 * Open a module or spreadsheet in its own BrowserWindow at `/popout/…`.
 * Reuses an existing window for the same target instead of stacking duplicates.
 */
function openPopoutWindow(target) {
  const url = resolvePopoutLoadURL(target)
  if (!url) return

  const existing = popoutWindows.get(url)
  if (existing && !existing.isDestroyed()) {
    existing.focus()
    return
  }

  const win = new BrowserWindow({
    width: 1200,
    height: 820,
    minWidth: 700,
    minHeight: 500,
    title: "BRAIN2",
    backgroundColor: "#ffffff",
    webPreferences: windowWebPreferences(),
  })

  popoutWindows.set(url, win)
  win.on("closed", () => {
    if (popoutWindows.get(url) === win) popoutWindows.delete(url)
  })

  win.loadURL(url)

  win.webContents.setWindowOpenHandler(({ url: opened }) => {
    if (opened.startsWith("http://") || opened.startsWith("https://")) {
      shell.openExternal(opened)
      return { action: "deny" }
    }
    return { action: "allow" }
  })
}

/** Register the module pop-out IPC handler. */
function registerWindowIpcHandlers() {
  ipcMain.on(OPEN_MODULE_POPOUT_IPC_CHANNEL, (_event, hash) => openPopoutWindow(hash))
}

/**
 * Preload webPreferences, including the current hub revision. The renderer
 * compares that token to keys it already has and skips IPC when they match.
 * Read at window-creation time so a hub write between windows is visible
 * without another full parse when mtime and size are unchanged.
 */
function windowWebPreferences() {
  return {
    preload: path.join(__dirname, "preload.js"),
    contextIsolation: true,
    nodeIntegration: false,
    sandbox: true,
    // Default Blink waits until a script is hot, so each pop-out recompiles
    // the same Next bundles. Cache on the first compile instead.
    v8CacheOptions: "bypassHeatCheck",
    additionalArguments: [hubRevArgument(sharedPersist.revToken())],
  }
}

/** Read the Chrome-seeded hub file. Never writes Chrome's profile. */
function readSharedPersistSnapshot() {
  return sharedPersist.readSnapshot()
}

function registerPersistIpcHandlers() {
  const reply = () => readSharedPersistSnapshot()
  // Cold seed only: preload sendSync must finish before the boot script.
  // The parsed object is the in-memory cache (one parse per mtime+size).
  ipcMain.on(GET_SHARED_PERSIST_IPC_CHANNEL, (event) => {
    event.returnValue = reply()
  })
  // Hub revision changed, previous keys still present, localhost getItem
  // already waits: invoke the same cached snapshot instead of sendSync.
  ipcMain.handle(GET_SHARED_PERSIST_IPC_CHANNEL, () => reply())
}

/** Copy Chrome's localhost IndexedDB snapshot into Electron userData. Dev only. */
function hydrateIndexedDBFromChromeSnapshot() {
  if (!isDev) return
  const src = path.join(__dirname, "..", "data", "chrome-idb-snapshot")
  if (!fs.existsSync(src)) return
  const destDir = path.join(app.getPath("userData"), "IndexedDB")
  const dest = path.join(destDir, "http_localhost_3000.indexeddb.leveldb")
  if (fs.existsSync(dest)) return
  try {
    fs.mkdirSync(destDir, { recursive: true })
    fs.cpSync(src, dest, { recursive: true })
    const lock = path.join(dest, "LOCK")
    if (fs.existsSync(lock)) fs.rmSync(lock)
  } catch (err) {
    console.warn("[cogs] IndexedDB hydrate skipped:", err && err.message)
  }
}

/** Register the Apple Notes ingest IPC handler (macOS Notes.app via osascript). */
function registerNotesIpcHandlers() {
  ipcMain.handle(FETCH_APPLE_NOTES_IPC_CHANNEL, (_event, range) => {
    // eslint-disable-next-line global-require
    const { fetchAppleNotes } = require("./apple-notes")
    return fetchAppleNotes(range)
  })
}

/** Register the ActivityWatch screen-time IPC handler (loopback aw-server only). */
function registerScreenTimeIpcHandlers() {
  ipcMain.handle(FETCH_SCREENTIME_IPC_CHANNEL, (_event, req) => {
    // eslint-disable-next-line global-require
    const { fetchScreenTime } = require("./activitywatch")
    return fetchScreenTime(req)
  })
}

function registerTelegramIpcHandlers() {
  // eslint-disable-next-line global-require
  const { registerTelegramIpc } = require("./telegram-ingest")
  registerTelegramIpc(() => mainWindow)
}

/**
 * Register the OS-wide quick-capture accelerator: focus (or restore) the window
 * and tell the renderer to open the capture surface over the IPC channel the
 * preload bridges to `window.electron.onQuickCapture`.
 */
function registerQuickCaptureShortcut() {
  globalShortcut.register(QUICK_CAPTURE_GLOBAL_ACCELERATOR, () => {
    if (!mainWindow) {
      createWindow()
    }
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore()
      mainWindow.show()
      mainWindow.focus()
      mainWindow.webContents.send(QUICK_CAPTURE_IPC_CHANNEL)
    }
  })
}

app.whenReady().then(async () => {
  if (!isDev) {
    protocol.handle("app", (request) => {
      const { pathname } = new URL(request.url)
      const filePath = resolveStaticFile(pathname)
      return net.fetch(pathToFileURL(filePath).toString())
    })
  }

  registerPersistIpcHandlers()
  // Parse once before the first window so its cold sendSync is a cache hit.
  await sharedPersist.warm()
  hydrateIndexedDBFromChromeSnapshot()
  createWindow()
  registerQuickCaptureShortcut()
  registerFileIpcHandlers()
  registerWindowIpcHandlers()
  // One broken registration must not leave the rest of the app unwired — the
  // renderer would only see "No handler registered" with no cause.
  for (const register of [registerNotesIpcHandlers, registerScreenTimeIpcHandlers, registerTelegramIpcHandlers]) {
    try {
      register()
    } catch (err) {
      console.error(`[cogs] ${register.name} failed:`, err)
    }
  }

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow()
    }
  })
})

app.on("will-quit", () => {
  globalShortcut.unregisterAll()
})

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit()
  }
})
