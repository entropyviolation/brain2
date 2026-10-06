/**
 * electron/persist-hub-cache.js — One parse of data/shared-persist.json
 *
 * Pop-out windows used to readFileSync + JSON.parse the whole hub on the main
 * thread inside a sendSync handler. This cache keeps the parsed snapshot for
 * the current mtime and size. The revision token is what the preload compares
 * (passed on the window argv) so a relaunch that already has those keys does
 * not IPC the blob again.
 */
const HUB_REV_PREFIX = "--brain2-hub-rev="

function emptySnapshot() {
  return { items: {}, source: null, updatedAt: null }
}

function snapshotFromParsed(parsed) {
  const items = parsed && parsed.items && typeof parsed.items === "object" ? parsed.items : {}
  return {
    items,
    source: parsed && parsed.source != null ? parsed.source : null,
    updatedAt: parsed && parsed.updatedAt != null ? parsed.updatedAt : null,
  }
}

function hubRevArgument(token) {
  return HUB_REV_PREFIX + encodeURIComponent(token == null ? "" : String(token))
}

function createSharedPersistCache(fsImpl, filePath) {
  let entry = null

  function remember(stat, snapshot) {
    entry = { mtimeMs: stat.mtimeMs, size: stat.size, snapshot }
    return snapshot
  }

  function readSnapshot() {
    let stat
    try {
      stat = fsImpl.statSync(filePath)
    } catch {
      entry = null
      return emptySnapshot()
    }
    if (entry && entry.mtimeMs === stat.mtimeMs && entry.size === stat.size) {
      return entry.snapshot
    }
    try {
      const parsed = JSON.parse(fsImpl.readFileSync(filePath, "utf8"))
      return remember(stat, snapshotFromParsed(parsed))
    } catch {
      entry = null
      return emptySnapshot()
    }
  }

  async function warm() {
    const promises = fsImpl.promises
    if (!promises || typeof promises.stat !== "function" || typeof promises.readFile !== "function") {
      readSnapshot()
      return
    }
    let stat
    try {
      stat = await promises.stat(filePath)
    } catch {
      entry = null
      return
    }
    if (entry && entry.mtimeMs === stat.mtimeMs && entry.size === stat.size) return
    try {
      const parsed = JSON.parse(await promises.readFile(filePath, "utf8"))
      remember(stat, snapshotFromParsed(parsed))
    } catch {
      /* sync reader retries; a half-written file must not stick as empty */
    }
  }

  function revToken() {
    readSnapshot()
    if (!entry) return ""
    const updated = entry.snapshot.updatedAt == null ? "" : String(entry.snapshot.updatedAt)
    return `${updated}@${entry.mtimeMs}:${entry.size}`
  }

  return { readSnapshot, warm, revToken }
}

module.exports = {
  HUB_REV_PREFIX,
  createSharedPersistCache,
  hubRevArgument,
}
