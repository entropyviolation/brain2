/**
 * electron/dictate.js — Local speech-to-text for the desktop app
 *
 * Chromium's Web Speech API does not work inside Electron (it needs Google's
 * key), so dictation on the Mac records in the renderer and sends the audio
 * here. ffmpeg turns it into 16 kHz mono WAV and the Whisper CLI
 * (`BRAIN2_DICTATE_WHISPER_MODEL`, default `base`) writes the text. Nothing
 * leaves the machine. Bridged as `window.desktop.transcribeAudio(bytes, mime)`,
 * which resolves `{ ok: true, text }` or `{ ok: false, error }`.
 */
const { spawn } = require("child_process")
const fs = require("fs")
const os = require("os")
const path = require("path")

const TRANSCRIBE_AUDIO_IPC_CHANNEL = "cogs:dictate:transcribe"
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

async function transcribeAudio(bytes, mime) {
  const buffer = Buffer.from(bytes instanceof ArrayBuffer ? new Uint8Array(bytes) : bytes || [])
  if (!buffer.length) return { ok: false, error: "No audio was recorded." }
  if (buffer.length > MAX_BYTES) return { ok: false, error: "That recording is too long." }
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
  ipcMain.handle(TRANSCRIBE_AUDIO_IPC_CHANNEL, (_event, bytes, mime) =>
    transcribeAudio(bytes, mime).catch((error) => ({ ok: false, error: String((error && error.message) || error) })),
  )
}

module.exports = { TRANSCRIBE_AUDIO_IPC_CHANNEL, registerDictateIpc, transcribeAudio }
