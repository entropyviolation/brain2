/**
 * electron/code-docs.js — Read `docs/` when the window is `app://`.
 *
 * Dev loads `http://localhost:3000`, which serves the same folder over
 * `/api/code-docs`. A packaged or local production window has no Next server
 * on that origin, so the renderer asks here. The folder is the repo `docs/`
 * next to this file. A build that did not ship that folder returns no files.
 * Channels match `CODE_DOCS_*` in `electron/preload.js`.
 */
const path = require("path")
const { pathToFileURL } = require("url")

const CODE_DOCS_LIST = "cogs:code-docs:list"
const CODE_DOCS_READ = "cogs:code-docs:read"

function registerCodeDocsIpcHandlers() {
  const { ipcMain } = require("electron")
  const root = path.join(__dirname, "..", "docs")
  let api = null
  const load = async () => {
    if (!api) {
      api = await import(pathToFileURL(path.join(__dirname, "..", "lib", "code-docs-fs.mjs")).href)
    }
    return api
  }
  ipcMain.handle(CODE_DOCS_LIST, async () => {
    const { listDocs } = await load()
    const listed = listDocs(root)
    return { ok: true, missing: listed.missing, files: listed.files }
  })
  ipcMain.handle(CODE_DOCS_READ, async (_event, rel) => {
    const { readDocFile } = await load()
    return readDocFile(root, rel)
  })
}

module.exports = { registerCodeDocsIpcHandlers, CODE_DOCS_LIST, CODE_DOCS_READ }
