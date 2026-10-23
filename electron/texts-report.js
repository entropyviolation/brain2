/**
 * electron/texts-report.js — Analytics → Texts: the local texts report server
 *
 * The texts analysis is a Python pipeline in `scripts/texts-analysis/`. It
 * reads a copy of `~/Library/Messages/chat.db`, writes aggregates and the
 * report to a home folder outside the repo (default `~/texts-analysis`), and
 * `serve.py` serves that report on loopback. This file starts that server on
 * demand, asks it for status, and runs the daily refresh.
 *
 * Message text never enters the repo or the vault. Loopback only.
 * Returns structured results rather than throwing (same as activitywatch.js).
 *
 * CommonJS (matches electron/main.js).
 */
const path = require("path")
const os = require("os")
const fs = require("fs")
const { spawn } = require("child_process")

const DEFAULT_PORT = 8765
const STATUS_TIMEOUT_MS = 2500
const START_WAIT_MS = 15000
// Daily refresh: the day closes at 04:00 local time, so a morning view has all of yesterday.
const DAY_CLOSE_HOUR = 4
const SCHEDULE_TICK_MS = 60 * 60 * 1000

/** Home folder for data, venv and output. `COGS_TEXTS_HOME` overrides. */
function textsHome(env = process.env) {
  const raw = env.COGS_TEXTS_HOME
  if (raw && raw.trim()) return raw.trim().replace(/^~(?=$|\/)/, os.homedir())
  return path.join(os.homedir(), "texts-analysis")
}

function textsPort(env = process.env) {
  const n = Number(env.COGS_TEXTS_PORT)
  return Number.isInteger(n) && n > 1024 && n < 65536 ? n : DEFAULT_PORT
}

function textsBaseUrl(env = process.env) {
  return `http://127.0.0.1:${textsPort(env)}`
}

/** Most recent day close (04:00 local) at or before `now`. */
function lastDayClose(now) {
  const d = new Date(now.getTime())
  d.setHours(DAY_CLOSE_HOUR, 0, 0, 0)
  if (d.getTime() > now.getTime()) d.setDate(d.getDate() - 1)
  return d
}

/** True when no run has finished since the last day close. */
function dailyRunDue(lastRunISO, now = new Date()) {
  if (!lastRunISO) return true
  const last = new Date(lastRunISO)
  if (Number.isNaN(last.getTime())) return true
  return last.getTime() < lastDayClose(now).getTime()
}

async function getJson(url, init = {}, timeoutMs = STATUS_TIMEOUT_MS) {
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), timeoutMs)
  try {
    const res = await fetch(url, { ...init, signal: ctrl.signal })
    if (!res.ok) return { ok: false, code: "http", error: `HTTP ${res.status}` }
    return { ok: true, body: await res.json() }
  } catch (err) {
    return { ok: false, code: "unreachable", error: String((err && err.message) || err) }
  } finally {
    clearTimeout(timer)
  }
}

/** Paths the server needs. `missing` names the first one absent. */
function serverPaths(env = process.env, repoRoot = path.join(__dirname, "..")) {
  const home = textsHome(env)
  const python = path.join(home, ".venv", "bin", "python")
  const serve = path.join(repoRoot, "scripts", "texts-analysis", "serve.py")
  let missing = null
  if (!fs.existsSync(home)) missing = "home"
  else if (!fs.existsSync(python)) missing = "venv"
  else if (!fs.existsSync(serve)) missing = "script"
  return { home, python, serve, missing }
}

const MISSING_MESSAGES = {
  home: "No texts home folder yet. Run the first texts analysis on this Mac (scripts/texts-analysis/README.md).",
  venv: "The texts home has no Python environment. See scripts/texts-analysis/README.md.",
  script: "scripts/texts-analysis/serve.py is missing from this checkout.",
}

let child = null

/** Start serve.py if nothing answers on the port. Resolves to { ok, url } or an error. */
async function ensureTextsServer(env = process.env) {
  const url = textsBaseUrl(env)
  const first = await getJson(`${url}/api/status`)
  if (first.ok) return { ok: true, url, status: first.body }

  const paths = serverPaths(env)
  if (paths.missing) return { ok: false, code: `missing-${paths.missing}`, error: MISSING_MESSAGES[paths.missing] }

  if (!child || child.exitCode !== null) {
    child = spawn(paths.python, [paths.serve, "--home", paths.home, "--port", String(textsPort(env))], {
      cwd: path.dirname(paths.serve),
      stdio: "ignore",
      env: { ...process.env, PYTHONDONTWRITEBYTECODE: "1" },
    })
    child.on("error", (err) => console.error("[cogs] texts server failed to start:", err))
  }

  const deadline = Date.now() + START_WAIT_MS
  while (Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, 400))
    const next = await getJson(`${url}/api/status`)
    if (next.ok) return { ok: true, url, status: next.body }
  }
  return { ok: false, code: "start-failed", error: "The texts server did not answer. Check ~/texts-analysis/out/serve.log." }
}

async function textsStatus(env = process.env) {
  const res = await getJson(`${textsBaseUrl(env)}/api/status`)
  return res.ok ? { ok: true, status: res.body } : res
}

/** Ask the server to run the pipeline (new texts → analysis → report). */
async function refreshTexts(env = process.env) {
  const started = await ensureTextsServer(env)
  if (!started.ok) return started
  const res = await getJson(`${started.url}/api/refresh`, { method: "POST" }, 10000)
  return res.ok ? { ok: true, status: res.body } : res
}

/** Hourly check; runs the refresh once a day, the first check after 04:00. */
function startTextsDailySchedule(env = process.env) {
  if (serverPaths(env).missing) return null
  const tick = async () => {
    const res = await ensureTextsServer(env)
    if (!res.ok) return
    const s = res.status || {}
    if (!s.running && dailyRunDue(s.lastRun)) await refreshTexts(env)
  }
  setTimeout(() => void tick(), 30000)
  return setInterval(() => void tick(), SCHEDULE_TICK_MS)
}

function stopTextsServer() {
  if (child && child.exitCode === null) child.kill()
  child = null
}

module.exports = {
  textsHome,
  textsPort,
  textsBaseUrl,
  lastDayClose,
  dailyRunDue,
  serverPaths,
  ensureTextsServer,
  textsStatus,
  refreshTexts,
  startTextsDailySchedule,
  stopTextsServer,
}
