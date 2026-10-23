/**
 * electron/instagram-archive.js — Every Instagram export, kept and merged
 *
 * The report pipeline (`instagram-report.js`) keeps only the newest exports.
 * This keeps all of them, so data that later vanishes from Instagram (an
 * unsent DM, a deleted chat) stays readable from the export that held it.
 *
 * Layout under `<userData>/instagram/archive/`:
 *   blobs/<aa>/<sha256>        every file of every export, stored once by content
 *   manifests/<exportDir>.json relpath → { sha, size } for one export
 *   messages.json              all DMs from all archived exports, merged
 *   index.json                 which exports are archived, and when
 *
 * Blobs are hard links when the export sits on the same disk, so archiving
 * costs no extra space until the report pipeline prunes the export folder.
 * Unchanged files across weekly exports are stored once.
 *
 * A message is keyed by thread folder, time, sender and a content hash. It
 * keeps the first and last export that held it. When a newer export no
 * longer has it, it reads as removed since that export. A message whose
 * text changed at the same time and sender reads as edited, not removed.
 *
 * Plain Node, no `electron` import, so tests and the dev server can use it.
 */
const path = require("path")
const crypto = require("crypto")
const nodeFs = require("fs")

const ARCHIVE_VERSION = 1

function archiveDir(root) {
  return path.join(root, "archive")
}

function readJson(fs, p, fallback) {
  try {
    return JSON.parse(fs.readFileSync(p, "utf8"))
  } catch {
    return fallback
  }
}

function writeJson(fs, p, value) {
  fs.mkdirSync(path.dirname(p), { recursive: true })
  const tmp = `${p}.${process.pid}.tmp`
  fs.writeFileSync(tmp, JSON.stringify(value))
  fs.renameSync(tmp, p)
}

function loadIndex(root, { fs = nodeFs } = {}) {
  const idx = readJson(fs, path.join(archiveDir(root), "index.json"), null)
  return idx && typeof idx === "object" && idx.exports ? idx : { version: ARCHIVE_VERSION, exports: {} }
}

function loadMessages(root, { fs = nodeFs } = {}) {
  const m = readJson(fs, path.join(archiveDir(root), "messages.json"), null)
  return m && typeof m === "object" && m.threads ? m : { version: ARCHIVE_VERSION, threads: {} }
}

/** Meta writes UTF-8 bytes as Latin-1 code points. Undo that when it round-trips. */
function fixText(s) {
  if (typeof s !== "string" || !/[\u0080-ÿ]/.test(s) || /[^\u0000-ÿ]/.test(s)) return s
  const out = Buffer.from(s, "latin1").toString("utf8")
  return out.includes("�") ? s : out
}

/** Streamed, so a multi-GB export never sits in memory or blocks main. */
function sha256File(fs, p) {
  return new Promise((resolve, reject) => {
    const h = crypto.createHash("sha256")
    fs.createReadStream(p)
      .on("data", (chunk) => h.update(chunk))
      .on("end", () => resolve(h.digest("hex")))
      .on("error", reject)
  })
}

function walkFiles(fs, dir, rel = "") {
  const out = []
  let entries = []
  try {
    entries = fs.readdirSync(path.join(dir, rel), { withFileTypes: true })
  } catch {
    return out
  }
  for (const e of entries) {
    if (e.name.startsWith(".") || e.name === "__MACOSX") continue
    const r = rel ? path.join(rel, e.name) : e.name
    if (e.isDirectory()) out.push(...walkFiles(fs, dir, r))
    else if (e.isFile()) out.push(r)
  }
  return out
}

function blobPath(root, sha) {
  return path.join(archiveDir(root), "blobs", sha.slice(0, 2), sha)
}

/** Store one file by content. Hard link when possible, otherwise copy. */
async function storeBlob(fs, root, file, sha) {
  const dest = blobPath(root, sha)
  if (fs.existsSync(dest)) return
  await fs.promises.mkdir(path.dirname(dest), { recursive: true })
  try {
    await fs.promises.link(file, dest)
  } catch {
    await fs.promises.copyFile(file, dest)
  }
}

function messageKey(m) {
  const body = JSON.stringify([
    m.content ?? null,
    (m.photos || []).map((p) => p.uri),
    (m.videos || []).map((v) => v.uri),
    (m.audio_files || []).map((a) => a.uri),
    m.share ? m.share.link ?? m.share.share_text ?? null : null,
  ])
  const h = crypto.createHash("sha1").update(body).digest("hex").slice(0, 12)
  return `${m.timestamp_ms}|${fixText(m.sender_name || "")}|${h}`
}

function slimMessage(m) {
  const out = { ts: m.timestamp_ms, sender: fixText(m.sender_name || "") }
  if (typeof m.content === "string") out.content = fixText(m.content)
  const media = [...(m.photos || []), ...(m.videos || []), ...(m.audio_files || [])].map((x) => x.uri).filter(Boolean)
  if (media.length) out.media = media
  if (m.share && (m.share.link || m.share.share_text)) {
    out.share = { link: m.share.link || undefined, text: m.share.share_text ? fixText(m.share.share_text) : undefined }
  }
  if (m.reactions && m.reactions.length) {
    out.reactions = m.reactions.map((r) => ({ reaction: fixText(r.reaction), actor: fixText(r.actor) }))
  }
  return out
}

/** DM threads in one export: thread folder → { title, participants, category, messages }. */
function readExportThreads(fs, exportRoot) {
  const base = path.join(exportRoot, "your_instagram_activity", "messages")
  const threads = {}
  let cats = []
  try {
    cats = fs.readdirSync(base, { withFileTypes: true }).filter((e) => e.isDirectory())
  } catch {
    return threads
  }
  for (const cat of cats) {
    let dirs = []
    try {
      dirs = fs.readdirSync(path.join(base, cat.name), { withFileTypes: true }).filter((e) => e.isDirectory())
    } catch {
      continue
    }
    for (const d of dirs) {
      let files = []
      try {
        files = fs.readdirSync(path.join(base, cat.name, d.name)).filter((f) => /^message_\d+\.json$/.test(f))
      } catch {
        continue
      }
      if (!files.length) continue
      const t = threads[d.name] || { category: cat.name, title: "", participants: [], messages: [] }
      for (const f of files) {
        const j = readJson(fs, path.join(base, cat.name, d.name, f), null)
        if (!j) continue
        if (j.title) t.title = fixText(j.title)
        if (Array.isArray(j.participants)) t.participants = j.participants.map((p) => fixText(p.name))
        if (Array.isArray(j.messages)) t.messages.push(...j.messages)
      }
      threads[d.name] = t
    }
  }
  return threads
}

/** Export folder names in archive order: by date, then name. */
function orderedExports(index) {
  return Object.entries(index.exports)
    .map(([dir, e]) => ({ dir, ...e }))
    .sort((a, b) => (a.date === b.date ? a.dir.localeCompare(b.dir) : a.date < b.date ? -1 : 1))
}

function rank(index) {
  const order = orderedExports(index).map((e) => e.dir)
  return (dir) => order.indexOf(dir)
}

/**
 * Merge one export's DMs into `merged`. `firstSeen` / `lastSeen` are export
 * folder names; `pos` ranks them so out-of-order archiving still works.
 */
function mergeThreads(merged, threads, exportDir, pos) {
  const later = (a, b) => (pos(a) >= pos(b) ? a : b)
  const earlier = (a, b) => (pos(a) <= pos(b) ? a : b)
  for (const [folder, t] of Object.entries(threads)) {
    const mt = merged.threads[folder] || { title: t.title, participants: t.participants, category: t.category, firstSeen: exportDir, lastSeen: exportDir, messages: {} }
    mt.firstSeen = earlier(mt.firstSeen, exportDir)
    if (later(mt.lastSeen, exportDir) === exportDir) {
      mt.lastSeen = exportDir
      mt.title = t.title || mt.title
      mt.participants = t.participants.length ? t.participants : mt.participants
      mt.category = t.category
    }
    for (const m of t.messages) {
      if (typeof m.timestamp_ms !== "number") continue
      const key = messageKey(m)
      const prev = mt.messages[key]
      if (prev) {
        prev.firstSeen = earlier(prev.firstSeen, exportDir)
        prev.lastSeen = later(prev.lastSeen, exportDir)
      } else {
        mt.messages[key] = { ...slimMessage(m), firstSeen: exportDir, lastSeen: exportDir }
      }
    }
    merged.threads[folder] = mt
  }
}

/**
 * Archive one unzipped export folder: blobs, manifest, merged DMs.
 * Idempotent: an export already in the index is skipped.
 */
async function archiveExport(root, { exportDir, exportRoot, date }, { fs = nodeFs, now = () => Date.now() } = {}) {
  const index = loadIndex(root, { fs })
  if (index.exports[exportDir]) return { ok: true, skipped: true }

  const manifest = {}
  for (const rel of walkFiles(fs, exportRoot)) {
    const file = path.join(exportRoot, rel)
    const sha = await sha256File(fs, file)
    await storeBlob(fs, root, file, sha)
    manifest[rel.split(path.sep).join("/")] = { sha, size: (await fs.promises.stat(file)).size }
  }
  writeJson(fs, path.join(archiveDir(root), "manifests", `${exportDir}.json`), manifest)

  const threads = readExportThreads(fs, exportRoot)
  const count = Object.values(threads).reduce((n, t) => n + t.messages.length, 0)
  index.exports[exportDir] = { date, archivedAt: new Date(now()).toISOString(), files: Object.keys(manifest).length, threads: Object.keys(threads).length, messages: count }

  const merged = loadMessages(root, { fs })
  mergeThreads(merged, threads, exportDir, rank(index))
  writeJson(fs, path.join(archiveDir(root), "messages.json"), merged)
  writeJson(fs, path.join(archiveDir(root), "index.json"), index)
  return { ok: true, skipped: false, files: Object.keys(manifest).length, messages: count }
}

/**
 * Messages an earlier export held and a later one does not. Each row says
 * which export last had it and which first did not. A same-time, same-sender
 * message with other text in a later export marks the row as edited.
 */
function removedMessages(root, { fs = nodeFs } = {}) {
  const index = loadIndex(root, { fs })
  const order = orderedExports(index)
  if (order.length < 2) return { exports: order.length, rows: [] }
  const pos = rank(index)
  const dateOf = (dir) => (index.exports[dir] ? index.exports[dir].date : dir)
  const merged = loadMessages(root, { fs })
  const rows = []
  for (const [folder, t] of Object.entries(merged.threads)) {
    const threadGone = pos(t.lastSeen) < order.length - 1
    const latestByTsSender = new Map()
    for (const m of Object.values(t.messages)) {
      if (m.lastSeen === t.lastSeen) latestByTsSender.set(`${m.ts}|${m.sender}`, m)
    }
    for (const m of Object.values(t.messages)) {
      if (pos(m.lastSeen) >= order.length - 1) continue
      const goneIn = order[pos(m.lastSeen) + 1]
      const now = latestByTsSender.get(`${m.ts}|${m.sender}`)
      rows.push({
        thread: folder,
        title: t.title,
        participants: t.participants,
        sender: m.sender,
        ts: m.ts,
        content: m.content,
        media: m.media,
        share: m.share,
        lastSeen: dateOf(m.lastSeen),
        removedSince: dateOf(goneIn.dir),
        kind: threadGone ? "thread-gone" : now && now !== m ? "edited" : "removed",
        editedTo: now && now !== m ? now.content : undefined,
      })
    }
  }
  rows.sort((a, b) => b.ts - a.ts)
  return { exports: order.length, rows }
}

/** Archive every export folder the report pipeline still has that is not archived yet. */
async function archiveAll(root, { fs = nodeFs, findExportRoot, now } = {}) {
  const dir = path.join(root, "exports")
  let names = []
  try {
    names = fs.readdirSync(dir, { withFileTypes: true }).filter((e) => e.isDirectory()).map((e) => e.name)
  } catch {
    return []
  }
  const index = loadIndex(root, { fs })
  const done = []
  for (const name of names.sort()) {
    if (index.exports[name]) continue
    const m = /^(\d{4}-\d{2}-\d{2})-/.exec(name)
    const exportRoot = findExportRoot ? findExportRoot(path.join(dir, name), { fs }) : path.join(dir, name)
    if (!m || !exportRoot) continue
    done.push({ name, ...(await archiveExport(root, { exportDir: name, exportRoot, date: m[1] }, { fs, now })) })
  }
  return done
}

function archiveStatus(root, { fs = nodeFs } = {}) {
  const order = orderedExports(loadIndex(root, { fs }))
  return { exports: order.map((e) => ({ dir: e.dir, date: e.date, messages: e.messages })), count: order.length }
}

module.exports = {
  ARCHIVE_VERSION,
  archiveAll,
  archiveExport,
  archiveStatus,
  blobPath,
  fixText,
  loadIndex,
  loadMessages,
  messageKey,
  readExportThreads,
  removedMessages,
}
