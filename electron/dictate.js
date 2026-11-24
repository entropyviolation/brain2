/**
 * electron/dictate.js — Local speech-to-text for the desktop app
 *
 * Chromium's Web Speech API does not work inside Electron (it needs Google's
 * key), so dictation on the Mac records in the renderer and sends the audio
 * here. ffmpeg turns it into 16 kHz mono WAV and the Whisper CLI
 * (`BRAIN2_DICTATE_WHISPER_MODEL`, default `base`) writes the text. Nothing
 * leaves the machine. Bridged as `window.desktop.transcribeAudio(bytes, mime)`,
 * which resolves `{ ok: true, text }` or `{ ok: false, error }`.
 *
 * Live text: `electron/dictate-worker.py` keeps one Whisper model loaded in a
 * Python process (about 0.3 s a pass instead of about 3 s cold). While the mic
 * is on, the renderer sends the recording so far on `cogs:dictate:partial`
 * (`window.desktop.dictatePartial`) and shows each pass as it lands.
 * `window.desktop.dictateWarm()` starts the worker when the mic opens. The
 * final pass also uses the worker; the CLI is the fallback.
 */
const { spawn } = require("child_process")
const fs = require("fs")
const os = require("os")
const path = require("path")

const TRANSCRIBE_AUDIO_IPC_CHANNEL = "cogs:dictate:transcribe"
const PARTIAL_AUDIO_IPC_CHANNEL = "cogs:dictate:partial"
const WARM_IPC_CHANNEL = "cogs:dictate:warm"
const EXTRA_BIN = ["/opt/homebrew/bin", "/usr/local/bin", "/opt/anaconda3/bin", path.join(os.homedir(), "anaconda3", "bin"), path.join(os.homedir(), ".local", "bin")]
const MAX_BYTES = 25 * 1024 * 1024

/** Find a tool on PATH or in the usual Homebrew / Anaconda folders (Finder launches have a bare PATH). */
function which(name) {
  const dirs = [...String(process.env.PATH || "").split(":"), ...EXTRA_BIN]
  for (const dir of dirs) {
    if (!dir) continue
    const candidate = path.join(dir, name)
    try {
      fs.accessSync(candidate, fs.constants.X_OK)
      return candidate
    } catch {
      /* next */
    }
  }
  return null
}

/** Run a tool without a shell. Resolves `{ code, err }`; kills it after `ms`. */
function run(bin, args, ms) {
  return new Promise((resolve) => {
    const child = spawn(bin, args, { stdio: ["ignore", "ignore", "pipe"], env: { ...process.env, PATH: [...EXTRA_BIN, process.env.PATH || ""].join(":") } })
    let err = ""
    const timer = setTimeout(() => child.kill("SIGKILL"), ms)
    child.stderr.on("data", (chunk) => {
      err = (err + chunk).slice(-2000)
    })
    child.on("error", (error) => {
      clearTimeout(timer)
      resolve({ code: -1, err: error.message })
    })
    child.on("close", (code) => {
      clearTimeout(timer)
      resolve({ code, err })
    })
  })
}

function extFor(mime) {
  if (/mp4|m4a|aac/i.test(mime || "")) return "m4a"
  if (/ogg/i.test(mime || "")) return "ogg"
  if (/wav/i.test(mime || "")) return "wav"
  return "webm"
}

function toBuffer(bytes) {
  return Buffer.from(bytes instanceof ArrayBuffer ? new Uint8Array(bytes) : bytes || [])
}

/* ---------- Warm worker ---------- */

let worker = null // { child, ready: Promise<boolean>, pending: Map<id, resolve>, nextId }

/** The Python that runs the `whisper` script (its shebang), so the worker sees the same install. */
function whisperPython() {
  const whisper = which("whisper")
  if (!whisper) return null
  try {
    const first = fs.readFileSync(whisper, "utf8").split("\n", 1)[0]
    const m = first.match(/^#!\s*(\S+)/)
    if (m && !/env$/.test(m[1]) && fs.existsSync(m[1])) return m[1]
  } catch {
    /* fall through */
  }
  return which("python3")
}

/** Start the worker once. Resolves true when the model is loaded, false when it cannot start. */
function warmWorker() {
  if (worker) return worker.ready
  const python = whisperPython()
  if (!python || !which("ffmpeg")) return Promise.resolve(false)
  // Read the script with Electron's fs (works inside app.asar) and pass it with -c.
  let source
  try {
    source = fs.readFileSync(path.join(__dirname, "dictate-worker.py"), "utf8")
  } catch {
    return Promise.resolve(false)
  }
  const child = spawn(python, ["-u", "-c", source], {
    stdio: ["pipe", "pipe", "pipe"],
    env: { ...process.env, PATH: [...EXTRA_BIN, process.env.PATH || ""].join(":"), PYTHONWARNINGS: "ignore" },
  })
  const state = { child, pending: new Map(), nextId: 1, ready: null }
  let markReady
  state.ready = new Promise((resolve) => (markReady = resolve))
  let buf = ""
  child.stdout.on("data", (chunk) => {
    buf += chunk
    let nl
    while ((nl = buf.indexOf("\n")) >= 0) {
      const line = buf.slice(0, nl)
      buf = buf.slice(nl + 1)
      let msg
      try {
        msg = JSON.parse(line)
      } catch {
        continue
      }
      if (msg.ready) markReady(true)
      else if (state.pending.has(msg.id)) {
        state.pending.get(msg.id)(msg)
        state.pending.delete(msg.id)
      }
    }
  })
  child.stderr.on("data", () => {})
  const die = () => {
    markReady(false)
    for (const resolve of state.pending.values()) resolve({ error: "Dictation worker stopped." })
    state.pending.clear()
    if (worker === state) worker = null
  }
  child.on("error", die)
  child.on("exit", die)
  worker = state
  return state.ready
}

/** Ask the warm worker for one file. Resolves `{ text }` or `{ error }`. */
function askWorker(file, ms) {
  const state = worker
  if (!state) return Promise.resolve({ error: "No worker." })
  const id = state.nextId++
  return new Promise((resolve) => {
    const timer = setTimeout(() => {
      state.pending.delete(id)
      resolve({ error: "Timed out." })
    }, ms)
    state.pending.set(id, (msg) => {
      clearTimeout(timer)
      resolve(msg)
    })
    state.child.stdin.write(JSON.stringify({ id, path: file }) + "\n")
  })
}

/** Write bytes to a temp file, ask the worker, clean up. Resolves `{ ok, text }` or `{ ok: false, error }`. */
async function workerTranscribe(buffer, mime, ms) {
  if (!(await warmWorker())) return { ok: false, error: "warm worker unavailable" }
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "brain2-dictate-"))
  try {
    const file = path.join(dir, `in.${extFor(mime)}`)
    fs.writeFileSync(file, buffer)
    const msg = await askWorker(file, ms)
    return msg.error ? { ok: false, error: msg.error } : { ok: true, text: String(msg.text || "").trim() }
  } finally {
    fs.rmSync(dir, { recursive: true, force: true })
  }
}

/** Live pass over the recording so far. Never falls back to the slow CLI. */
async function partialAudio(bytes, mime) {
  const buffer = toBuffer(bytes)
  if (!buffer.length || buffer.length > MAX_BYTES) return { ok: false, error: "skip" }
  return workerTranscribe(buffer, mime, 20_000)
}

async function transcribeAudio(bytes, mime) {
  const buffer = toBuffer(bytes)
  if (!buffer.length) return { ok: false, error: "No audio was recorded." }
  if (buffer.length > MAX_BYTES) return { ok: false, error: "That recording is too long." }
  const warm = await workerTranscribe(buffer, mime, 60_000)
  if (warm.ok) return warm
  return cliTranscribe(buffer, mime)
}

async function cliTranscribe(buffer, mime) {
  const ffmpeg = which("ffmpeg")
  const whisper = which("whisper")
  if (!ffmpeg || !whisper) return { ok: false, error: `Dictation needs ${!ffmpeg ? "ffmpeg" : "whisper"} installed on this Mac.` }

  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "brain2-dictate-"))
  try {
    const input = path.join(dir, `in.${extFor(mime)}`)
    const wav = path.join(dir, "in.wav")
    fs.writeFileSync(input, buffer)
    const conv = await run(ffmpeg, ["-y", "-loglevel", "error", "-i", input, "-ar", "16000", "-ac", "1", wav], 30_000)
    if (conv.code !== 0) return { ok: false, error: "Could not read the recording." }
    const model = process.env.BRAIN2_DICTATE_WHISPER_MODEL || "base"
    const args = [wav, "--model", model, "--output_format", "txt", "--output_dir", dir, "--fp16", "False", "--verbose", "False", "--task", "transcribe"]
    const lang = process.env.BRAIN2_DICTATE_LANGUAGE || "en"
    if (lang !== "auto") args.push("--language", lang)
    const res = await run(whisper, args, 120_000)
    const out = path.join(dir, "in.txt")
    if (res.code !== 0 || !fs.existsSync(out)) {
      console.warn("[brain2] dictation: whisper failed", res.err)
      return { ok: false, error: "Whisper could not transcribe that." }
    }
    const text = fs.readFileSync(out, "utf8").replace(/\s+/g, " ").trim()
    return { ok: true, text }
  } finally {
    fs.rmSync(dir, { recursive: true, force: true })
  }
}

function registerDictateIpc(ipcMain) {
  const fail = (error) => ({ ok: false, error: String((error && error.message) || error) })
  ipcMain.handle(TRANSCRIBE_AUDIO_IPC_CHANNEL, (_event, bytes, mime) => transcribeAudio(bytes, mime).catch(fail))
  ipcMain.handle(PARTIAL_AUDIO_IPC_CHANNEL, (_event, bytes, mime) => partialAudio(bytes, mime).catch(fail))
  ipcMain.handle(WARM_IPC_CHANNEL, () => warmWorker().catch(() => false))
}

/** Stop the worker (app quit). */
function stopDictateWorker() {
  if (worker) worker.child.kill()
  worker = null
}

module.exports = { TRANSCRIBE_AUDIO_IPC_CHANNEL, PARTIAL_AUDIO_IPC_CHANNEL, WARM_IPC_CHANNEL, registerDictateIpc, transcribeAudio, partialAudio, warmWorker, stopDictateWorker }
