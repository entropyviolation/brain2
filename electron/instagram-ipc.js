/**
 * electron/instagram-ipc.js — Instagram report: scheme, IPC, watcher
 *
 * Serves the current build of the Instagram report on `brain2-ig://report/`
 * (report.html, thumbs/, media/), with a CSP that allows only the two opt-in
 * outside requests: Instagram embeds and unavatar.io profile photos. Starts
 * the export watcher (`instagram-report.js`) in main. Channels `cogs:instagram:*`;
 * the preload duplicates the names.
 */
const fs = require("fs")
const { pathToFileURL } = require("url")
const ig = require("./instagram-report")
const archive = require("./instagram-archive")

const INSTAGRAM_SCHEME = "brain2-ig"
const INSTAGRAM_REPORT_BASE = `${INSTAGRAM_SCHEME}://report/`

const INSTAGRAM_CHANNELS = {
  status: "cogs:instagram:status",
  scan: "cogs:instagram:scan",
  saveUi: "cogs:instagram:saveUi",
  pickFolder: "cogs:instagram:pickFolder",
  removed: "cogs:instagram:removed",
  summary: "cogs:instagram:summary",
  changed: "cogs:instagram:changed",
}

const INSTAGRAM_SCHEME_PRIVILEGES = {
  scheme: INSTAGRAM_SCHEME,
  privileges: { standard: true, secure: true, supportFetchAPI: true, stream: true },
}

/** Call after `app` is ready. Returns the watcher so main can stop it on quit. */
function registerInstagramIpc({ app, ipcMain, dialog, protocol, net, getWindow }) {
  const root = ig.defaultRoot(app.getPath("userData"))
  fs.mkdirSync(root, { recursive: true })

  const broadcast = (status) => {
    const win = getWindow()
    if (win && !win.isDestroyed()) win.webContents.send(INSTAGRAM_CHANNELS.changed, status)
  }
  const watcher = ig.createInstagramWatcher({ root, onChange: broadcast })

  protocol.handle(INSTAGRAM_SCHEME, async (request) => {
    const url = new URL(request.url)
    if (url.host !== "report") return new Response("Not found", { status: 404 })
    const state = ig.loadState(root)
    const file = ig.resolveReportPath(root, state, url.pathname)
    if (!file) return new Response("Not found", { status: 404 })
    if (file.endsWith(".html")) {
      const config = ig.loadConfig(root)
      const html = ig.injectBridge(await fs.promises.readFile(file, "utf8"), ig.loadUiState(root, config))
      return new Response(html, {
        headers: {
          "content-type": "text/html; charset=utf-8",
          "content-security-policy": ig.REPORT_CSP,
          "cache-control": "no-store",
        },
      })
    }
    // net.fetch on file:// serves Range requests, so videos can seek.
    return net.fetch(pathToFileURL(file).toString(), { headers: request.headers })
  })

  const statusWithUrl = () => ({ ...watcher.status(), reportBase: INSTAGRAM_REPORT_BASE })

  ipcMain.handle(INSTAGRAM_CHANNELS.status, () => statusWithUrl())
  ipcMain.handle(INSTAGRAM_CHANNELS.scan, async () => {
    await watcher.refreshDeps()
    await watcher.scan({ force: true })
    return statusWithUrl()
  })
  ipcMain.handle(INSTAGRAM_CHANNELS.removed, () => archive.removedMessages(root))
  // summary.json of the current build, for the Instagram lists. Null when there is no build.
  ipcMain.handle(INSTAGRAM_CHANNELS.summary, async () => {
    const state = ig.loadState(root)
    const file = ig.resolveReportPath(root, state, "summary.json")
    if (!file || !state.current) return null
    try {
      return { buildId: state.current.buildId, text: await fs.promises.readFile(file, "utf8") }
    } catch {
      return null
    }
  })
  ipcMain.handle(INSTAGRAM_CHANNELS.saveUi, (_event, key, value) => {
    if (!ig.UI_STATE_KEYS.includes(key)) return false
    if (value !== null && typeof value !== "string") return false
    ig.saveUiState(root, ig.loadConfig(root), { [key]: value })
    return true
  })
  ipcMain.handle(INSTAGRAM_CHANNELS.pickFolder, async (_event, clear) => {
    if (clear === true) {
      ig.saveConfigPatch(root, { extraDir: "" })
    } else {
      const win = getWindow()
      const options = { title: "Watch a folder for Instagram exports", buttonLabel: "Watch", properties: ["openDirectory"] }
      const res = win ? await dialog.showOpenDialog(win, options) : await dialog.showOpenDialog(options)
      if (res.canceled || !res.filePaths[0]) return statusWithUrl()
      ig.saveConfigPatch(root, { extraDir: res.filePaths[0] })
    }
    watcher.rewatch()
    await watcher.scan()
    return statusWithUrl()
  })

  watcher.start().catch((err) => console.warn("[brain2] instagram watcher:", err && err.message))
  return watcher
}

module.exports = {
  INSTAGRAM_CHANNELS,
  INSTAGRAM_REPORT_BASE,
  INSTAGRAM_SCHEME,
  INSTAGRAM_SCHEME_PRIVILEGES,
  registerInstagramIpc,
}
