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
const { app, BrowserWindow, shell, protocol, net } = require("electron")
const path = require("path")
const fs = require("fs")
const { pathToFileURL } = require("url")

const isDev = !app.isPackaged
const DEV_SERVER_URL = "http://localhost:3000"

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

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow()
    }
  })
})

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit()
  }
})
