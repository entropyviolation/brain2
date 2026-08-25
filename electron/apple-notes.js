/**
 * electron/apple-notes.js — Main-process Apple Notes fetch (macOS only)
 *
 * Spawns `osascript` against Notes.app so iCloud-synced iPhone notes and On My
 * Mac notes can be read for a date window. Returns a structured result rather
 * than throwing, so the renderer can show a permission / platform message.
 *
 * CommonJS (matches electron/main.js).
 */
const { execFile } = require("child_process")
const path = require("path")

const SCRIPT_PATH = path.join(__dirname, "apple-notes.jxa")
const TIMEOUT_MS = 60000
const MAX_BUFFER = 32 * 1024 * 1024

/** Map osascript / TCC failures onto a short machine code + human message. */
function classifyError(err, stderr) {
  const text = `${(err && err.message) || ""} ${stderr || ""}`.toLowerCase()
  if (err && (err.killed || err.code === "ETIMEDOUT")) {
    return {
      code: "timeout",
      error:
        "Timed out reading Apple Notes. Try a shorter period, or open Notes.app once and retry.",
    }
  }
  if (
    text.includes("-1743") ||
    text.includes("not authorised") ||
    text.includes("not authorized") ||
    text.includes("not allowed to send apple events")
  ) {
    return {
      code: "permission",
      error:
        "macOS blocked access to Notes. System Settings → Privacy & Security → Automation → enable Notes for COGS, then retry.",
    }
  }
  if (text.includes("(-2700)") || text.includes("application isn't running") || text.includes("can’t get application")) {
    return {
      code: "unavailable",
      error: "Notes.app could not be opened. Install or open Notes, wait for iCloud to finish syncing, then retry.",
    }
  }
  return {
    code: "osascript",
    error: (stderr || (err && err.message) || "Failed to read Apple Notes.").trim().slice(0, 400),
  }
}

/**
 * @param {{ sinceISO: string, untilISO: string, mode?: string, ids?: string[] }} range
 * @returns {Promise<{ ok: true, notes: object[] } | { ok: false, error: string, code: string }>}
 */
function fetchAppleNotes(range) {
  if (process.platform !== "darwin") {
    return Promise.resolve({
      ok: false,
      code: "unsupported-platform",
      error: "Apple Notes ingest runs on the Mac desktop app, where iPhone notes sync through iCloud.",
    })
  }
  const sinceISO = range && range.sinceISO
  const untilISO = range && range.untilISO
  const mode = range && (range.mode === "bodies" || range.mode === "snippet") ? range.mode : "preview"
  if (typeof sinceISO !== "string" || typeof untilISO !== "string") {
    return Promise.resolve({ ok: false, code: "invalid-range", error: "A start and end date are required." })
  }
  if (mode !== "preview" && (!Array.isArray(range.ids) || range.ids.length === 0)) {
    return Promise.resolve({ ok: true, notes: [] })
  }

  const args = ["-l", "JavaScript", SCRIPT_PATH, sinceISO, untilISO, mode]
  if (mode !== "preview") args.push(JSON.stringify(range.ids.slice(0, 200)))

  return new Promise((resolve) => {
    execFile(
      "osascript",
      args,
      { timeout: TIMEOUT_MS, maxBuffer: MAX_BUFFER },
      (err, stdout, stderr) => {
        if (err) {
          resolve({ ok: false, ...classifyError(err, stderr) })
          return
        }
        const raw = String(stdout || "").trim()
        if (!raw) {
          resolve({ ok: true, notes: [] })
          return
        }
        try {
          const parsed = JSON.parse(raw)
          if (!Array.isArray(parsed)) {
            resolve({ ok: false, code: "parse", error: "Notes.app returned an unexpected payload." })
            return
          }
          resolve({ ok: true, notes: parsed })
        } catch (parseErr) {
          resolve({
            ok: false,
            code: "parse",
            error: "Could not parse Notes.app output. Open Notes once, wait for iCloud sync, then retry.",
          })
        }
      },
    )
  })
}

module.exports = { fetchAppleNotes }
