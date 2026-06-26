/**
 * electron/main.js — Electron main process
 *
 * Boots the desktop shell around the static Next.js export. Registers the
 * privileged `app://` scheme, creates the BrowserWindow, and loads either the
 * Next dev server (development) or the bundled `out/` export via `app://`
 * (production). Resolves static file paths (including `trailingSlash` index.html
 * handling), routes external links to the system browser, and manages the
 * app/window lifecycle.
 *
 * Spec: §2.1 "Option B — Electron". A future **MongoDB** connection + IPC layer
 * (spec §3; local `mongod` or Atlas) would be initialized here.
 */
const { app, BrowserWindow, shell, protocol, net, globalShortcut, ipcMain } = require("electron")
const path = require("path")
const fs = require("fs")
const { pathToFileURL } = require("url")

const isDev = !app.isPackaged
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
// electron/preload.js. Opens a module in its own BrowserWindow at a hash route
// the renderer recognizes (`#popout/module/<id>`).
const OPEN_MODULE_POPOUT_IPC_CHANNEL = "cogs:window:openModulePopout"

// Directory containing the static Next.js export (`next build` with
// `output: "export"`). In production this is bundled alongside the app.
const OUT_DIR = path.join(__dirname, "..", "out")

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

/**
 * Resolve a request pathname to an actual file inside the static export,
 * mirroring how a static file server resolves clean URLs.
 */
function resolveStaticFile(pathname) {
  let relativePath = decodeURIComponent(pathname)
  if (relativePath === "/" || relativePath === "") {
    return path.join(OUT_DIR, "index.html")
  }

  const candidate = path.join(OUT_DIR, relativePath)

  // Direct file hit (assets like /_next/static/..., images, etc.).
  if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) {
    return candidate
  }

  // Clean route -> `route.html`.
  if (fs.existsSync(`${candidate}.html`)) {
    return `${candidate}.html`
  }

  // Directory route -> `route/index.html`.
  const indexCandidate = path.join(candidate, "index.html")
  if (fs.existsSync(indexCandidate)) {
    return indexCandidate
  }

  // SPA fallback so client-side navigation still works.
  return path.join(OUT_DIR, "index.html")
}

// Tracks the primary window so the global capture shortcut can focus it.
let mainWindow = null

function createWindow() {
  const win = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 900,
    minHeight: 600,
    title: "COGS",
    backgroundColor: "#ffffff",
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  })

  if (isDev) {
    win.loadURL(DEV_SERVER_URL)
    win.webContents.openDevTools({ mode: "detach" })
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
 * Open a module in its own BrowserWindow at the given pop-out hash. Reuses the
 * same dev/prod URL scheme as the main window. The hash is sanitized to the
 * expected `#popout/...` shape so it can only deep-link within the app.
 */
function openPopoutWindow(hash) {
  const safeHash = typeof hash === "string" && hash.startsWith("#popout/") ? hash : ""

  const win = new BrowserWindow({
    width: 1200,
    height: 820,
    minWidth: 700,
    minHeight: 500,
    title: "COGS",
    backgroundColor: "#ffffff",
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  })

  if (isDev) {
    win.loadURL(`${DEV_SERVER_URL}/${safeHash}`)
  } else {
    win.loadURL(`app://local/${safeHash}`)
  }

  win.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith("http://") || url.startsWith("https://")) {
      shell.openExternal(url)
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

app.whenReady().then(() => {
  if (!isDev) {
    protocol.handle("app", (request) => {
      const { pathname } = new URL(request.url)
      const filePath = resolveStaticFile(pathname)
      return net.fetch(pathToFileURL(filePath).toString())
    })
  }

  createWindow()
  registerQuickCaptureShortcut()
  registerFileIpcHandlers()
  registerWindowIpcHandlers()

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
