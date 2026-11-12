/**
 * scripts/reel-watch.mjs — What a reel says and shows, for the Link BIMBY.
 *
 * `watchReel(url)` runs on this Mac only:
 *   1. yt-dlp fetches the smallest video (≤ 80 MB, ≤ 6 min) into a new empty temp folder.
 *      Instagram serves reels only to a signed-in session: set `BRAIN2_REEL_COOKIES_FROM_BROWSER`
 *      (e.g. `chrome`) or `BRAIN2_REEL_COOKIES` (a cookies.txt path) to use your own sign-in.
 *      TikTok and YouTube need neither.
 *   2. ffmpeg pulls 16 kHz mono audio; whisper (`BRAIN2_REEL_WHISPER_MODEL`, default `base`) writes
 *      what is said.
 *   3. ffmpeg takes one frame every 3 s (at most 10); tesseract reads the on-screen text.
 *   4. The folder is removed. The reading is kept in `data/link-peek/<sha1>.json`, so a reel is
 *      watched once.
 *
 * Returns `{ watched, transcript, onScreen, duration, uploader, description, error? }`.
 * `readStill` is the fallback for a photo post: OCR of its preview image (`still: true`).
 * Tools are looked up on PATH plus Homebrew and Anaconda folders, since the dev server's PATH is thin.
 */
import { spawn } from "node:child_process"
import crypto from "node:crypto"
import fs from "node:fs"
import os from "node:os"
import path from "node:path"
import { fileURLToPath } from "node:url"

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..")
const CACHE_DIR = () => process.env.BRAIN2_LINK_PEEK_DIR || path.join(ROOT, "data", "link-peek")
const EXTRA_BIN = ["/opt/homebrew/bin", "/usr/local/bin", "/opt/anaconda3/bin", path.join(os.homedir(), "anaconda3", "bin"), path.join(os.homedir(), ".local", "bin")]
const MAX_SECONDS = 360
const FRAMES = 10

function which(name) {
  const dirs = [...String(process.env.PATH || "").split(":"), ...EXTRA_BIN]
  for (const d of dirs) {
    const p = path.join(d, name)
    try {
      fs.accessSync(p, fs.constants.X_OK)
      return p
    } catch {
      /* next */
    }
  }
  return null
}

/** Run a tool without a shell. Resolves `{ code, out, err }`; kills it after `ms`. */
function run(bin, args, { ms = 120_000, cwd } = {}) {
  return new Promise((resolve) => {
    const env = { ...process.env, PATH: [...EXTRA_BIN, process.env.PATH || ""].join(":") }
    const child = spawn(bin, args, { cwd, env, stdio: ["ignore", "pipe", "pipe"] })
    let out = ""
    let err = ""
    child.stdout.on("data", (c) => (out = (out + c).slice(-2_000_000)))
    child.stderr.on("data", (c) => (err = (err + c).slice(-20_000)))
    const timer = setTimeout(() => child.kill("SIGKILL"), ms)
    child.on("close", (code) => {
      clearTimeout(timer)
      resolve({ code, out, err })
    })
    child.on("error", (e) => {
      clearTimeout(timer)
      resolve({ code: -1, out, err: String(e) })
    })
  })
}

const cacheFile = (url) => path.join(CACHE_DIR(), `${crypto.createHash("sha1").update(url).digest("hex")}.json`)

export function readWatchCache(url) {
  try {
    return JSON.parse(fs.readFileSync(cacheFile(url), "utf8"))
  } catch {
    return null
  }
}

function writeWatchCache(url, value) {
  try {
    fs.mkdirSync(CACHE_DIR(), { recursive: true })
    fs.writeFileSync(cacheFile(url), JSON.stringify({ url, at: new Date().toISOString(), ...value }, null, 2))
  } catch {
    /* a cache miss next time is fine */
  }
}

/** Tesseract output → short distinct lines (drops noise like "|" or "@ ~"). Exported for the test. */
export function cleanOcr(texts) {
  const seen = new Set()
  const out = []
  for (const t of texts) {
    for (const raw of String(t).split(/\n+/)) {
      const line = raw.replace(/\s+/g, " ").trim()
      const letters = (line.match(/[a-z]/gi) || []).length
      if (line.length < 4 || letters < line.length * 0.55) continue
      const key = line.toLowerCase().replace(/[^a-z0-9]/g, "")
      if (!key || seen.has(key)) continue
      seen.add(key)
      out.push(line)
    }
  }
  return out.join("\n").slice(0, 1500)
}

const CHROMIUM_DIRS = { chrome: "Google/Chrome", brave: "BraveSoftware/Brave-Browser", edge: "Microsoft Edge", chromium: "Chromium", vivaldi: "Vivaldi" }

/**
 * yt-dlp searches a profile folder recursively and takes the newest `Cookies` file, which can be an
 * extension's (`Default/Storage/ext/…/Cookies`). For `chrome:Default`, link only the profile's own
 * `Cookies` into a folder in this run's temp dir and point yt-dlp there. The link goes with the dir.
 */
function cookieArgs(dir) {
  const browser = process.env.BRAIN2_REEL_COOKIES_FROM_BROWSER
  if (browser) {
    const m = /^(\w+):([^/].*)$/.exec(browser)
    const base = m && CHROMIUM_DIRS[m[1].toLowerCase()]
    const db = base ? path.join(os.homedir(), "Library", "Application Support", base, m[2], "Cookies") : null
    if (dir && db && fs.existsSync(db)) {
      const pin = path.join(dir, "cookie-profile")
      fs.mkdirSync(pin)
      fs.symlinkSync(db, path.join(pin, "Cookies"))
      return ["--cookies-from-browser", `${m[1].toLowerCase()}:${pin}`]
    }
    return ["--cookies-from-browser", browser]
  }
  const file = process.env.BRAIN2_REEL_COOKIES
  if (file && fs.existsSync(file)) return ["--cookies", file]
  return []
}

/**
 * A photo post has no video. Read the text in its preview image instead (`og:image`, already
 * checked as public by the caller). Cached like a watch, marked `still: true`.
 */
export async function readStill(url, imageUrl) {
  const hit = readWatchCache(url)
  if (hit?.watched) return hit
  const tesseract = which("tesseract")
  if (!tesseract || !imageUrl) return null
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "brain2-still-"))
  try {
    const res = await fetch(imageUrl, { signal: AbortSignal.timeout(15_000) })
    const type = res.headers.get("content-type") || ""
    if (!res.ok || !/^image\//.test(type)) return null
    const buf = Buffer.from(await res.arrayBuffer())
    if (buf.length > 15 * 1024 * 1024) return null
    const file = path.join(dir, `still.${type.includes("png") ? "png" : "jpg"}`)
    fs.writeFileSync(file, buf)
    const r = await run(tesseract, [file, "stdout", "--psm", "11"], { ms: 20_000 })
    const value = { watched: true, still: true, transcript: "", onScreen: r.code === 0 ? cleanOcr([r.out]) : "", duration: 0, uploader: "", description: "" }
    writeWatchCache(url, value)
    return value
  } catch {
    return null
  } finally {
    fs.rmSync(dir, { recursive: true, force: true })
  }
}

// ---- Instagram account guard -------------------------------------------------
//
// 2026-11-06: about 120 signed-in reel fetches in two hours (Guess all plus a pre-watch)
// got the account restricted. Rules since then:
//   - Signed out, Instagram never serves the video, so yt-dlp is not run at all.
//   - Signed in, a batch (`batch: true`, Guess all) never uses the account. Cache only.
//   - A single, person-pressed Guess may use it: at least 3 min apart, 5 an hour, 15 a day.
//   - Any sign of pushback (rate limit, checkpoint, challenge, login wall while signed in)
//     stops all signed-in fetches for 72 hours.
// State: `data/link-peek/instagram-guard.json` (gitignored).

const IG_MIN_GAP_MS = 3 * 60_000
const IG_PER_HOUR = 5
const IG_PER_DAY = 15
const IG_BREAKER_MS = 72 * 3600_000
const PUSHBACK = /rate.?limit|too many|429|checkpoint|challenge|please wait|suspicious|restricted|login required|locked behind the login|not available/i

export function isInstagram(url) {
  try {
    const h = new URL(url).hostname.toLowerCase().replace(/^www\./, "")
    return h === "instagram.com" || h.endsWith(".instagram.com") || h === "instagr.am"
  } catch {
    return false
  }
}

const signedIn = () => Boolean(process.env.BRAIN2_REEL_COOKIES_FROM_BROWSER || process.env.BRAIN2_REEL_COOKIES)
const guardFile = () => path.join(CACHE_DIR(), "instagram-guard.json")

export function readGuard() {
  try {
    const g = JSON.parse(fs.readFileSync(guardFile(), "utf8"))
    return { fetches: Array.isArray(g.fetches) ? g.fetches : [], trippedUntil: g.trippedUntil || null, why: g.why || "" }
  } catch {
    return { fetches: [], trippedUntil: null, why: "" }
  }
}

function writeGuard(g) {
  fs.mkdirSync(CACHE_DIR(), { recursive: true })
  fs.writeFileSync(guardFile(), JSON.stringify(g, null, 2))
}

/** Null when a signed-in Instagram fetch may run now, or the reason it may not. Pure on `g`. Exported for the test. */
export function instagramRefusal(g, { batch, now = Date.now() }) {
  if (g.trippedUntil && now < Date.parse(g.trippedUntil)) {
    return `Instagram pushed back (${g.why || "rate limit"}); paused until ${new Date(g.trippedUntil).toLocaleString()} to protect your account`
  }
  if (batch) return "Guess all never uses your Instagram sign-in; press Guess on this link to watch it"
  const times = g.fetches.map((t) => Date.parse(t)).filter((t) => now - t < 24 * 3600_000)
  const last = Math.max(0, ...times)
  if (now - last < IG_MIN_GAP_MS) return `one Instagram video every ${IG_MIN_GAP_MS / 60_000} min; try again in ${Math.ceil((IG_MIN_GAP_MS - (now - last)) / 60_000)} min`
  if (times.filter((t) => now - t < 3600_000).length >= IG_PER_HOUR) return `${IG_PER_HOUR} Instagram videos an hour is the limit; try later`
  if (times.length >= IG_PER_DAY) return `${IG_PER_DAY} Instagram videos a day is the limit; try tomorrow`
  return null
}

const inflight = new Map()

/** `batch`: called from Guess all. Cached readings are always served. */
export function watchReel(url, { batch = false } = {}) {
  const hit = readWatchCache(url)
  if (hit?.watched) return Promise.resolve(hit)
  if (isInstagram(url)) {
    if (!signedIn()) return Promise.resolve({ watched: false, error: "Instagram shows videos only to a signed-in session, which is off; guessed from the caption" })
    const why = instagramRefusal(readGuard(), { batch })
    if (why) return Promise.resolve({ watched: false, error: why })
    const g = readGuard()
    writeGuard({ ...g, fetches: [...g.fetches.slice(-50), new Date().toISOString()] })
  }
  if (!inflight.has(url)) inflight.set(url, doWatch(url).finally(() => inflight.delete(url)))
  return inflight.get(url)
}

async function doWatch(url) {
  const ytdlp = which("yt-dlp")
  const ffmpeg = which("ffmpeg")
  if (!ytdlp || !ffmpeg) return { watched: false, error: "yt-dlp and ffmpeg are needed to watch a reel" }
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "brain2-reel-"))
  try {
    const got = await run(
      ytdlp,
      [
        ...cookieArgs(dir),
        "--no-playlist",
        "--no-progress",
        "--max-filesize", "80M",
        "--match-filter", `duration <= ${MAX_SECONDS}`,
        "-f", "worst[ext=mp4][vcodec!=none][acodec!=none]/worst[ext=mp4]/worst",
        "-o", path.join(dir, "v.%(ext)s"),
        "--print-json",
        "--", url,
      ],
      { ms: 120_000 },
    )
    let info = {}
    try {
      info = JSON.parse(got.out.trim().split("\n").pop() || "{}")
    } catch {
      /* no metadata */
    }
    const video = fs.readdirSync(dir).find((f) => f.startsWith("v."))
    if (!video && isInstagram(url) && signedIn() && PUSHBACK.test(got.err) && !/no video formats/i.test(got.err)) {
      const why = (got.err.split("\n").find((l) => PUSHBACK.test(l)) || "pushback").replace(/^ERROR:\s*/, "").slice(0, 160)
      writeGuard({ ...readGuard(), trippedUntil: new Date(Date.now() + IG_BREAKER_MS).toISOString(), why })
      return { watched: false, error: `Instagram pushed back; signed-in fetches paused for 72 hours (${why})` }
    }
    if (!video) {
      const login = /login required|cookies|locked behind the login/i.test(got.err)
      return {
        watched: false,
        error: login
          ? process.env.BRAIN2_REEL_COOKIES_FROM_BROWSER || process.env.BRAIN2_REEL_COOKIES
            ? "Instagram still sees no sign-in: sign in to instagram.com in that browser profile (or name it, e.g. chrome:Profile 4)"
            : "Instagram wants a sign-in to show the video (set BRAIN2_REEL_COOKIES_FROM_BROWSER)"
          : `could not fetch the video: ${got.err.split("\n").filter((l) => /ERROR/.test(l)).pop() || "yt-dlp failed"}`.slice(0, 300),
      }
    }
    const vpath = path.join(dir, video)

    // What is said.
    let transcript = ""
    const whisper = which("whisper")
    if (whisper) {
      const wav = path.join(dir, "a.wav")
      const a = await run(ffmpeg, ["-y", "-loglevel", "error", "-i", vpath, "-vn", "-ac", "1", "-ar", "16000", wav], { ms: 60_000 })
      if (a.code === 0 && fs.existsSync(wav)) {
        const model = process.env.BRAIN2_REEL_WHISPER_MODEL || "base"
        await run(whisper, [wav, "--model", model, "--output_format", "txt", "--output_dir", dir, "--fp16", "False", "--verbose", "False"], { ms: 240_000 })
        try {
          transcript = fs.readFileSync(path.join(dir, "a.txt"), "utf8").replace(/\s+/g, " ").trim().slice(0, 4000)
        } catch {
          /* silent reel */
        }
      }
    }

    // What is shown.
    let onScreen = ""
    const tesseract = which("tesseract")
    if (tesseract) {
      await run(ffmpeg, ["-y", "-loglevel", "error", "-i", vpath, "-vf", "fps=1/3,scale=720:-2", "-frames:v", String(FRAMES), path.join(dir, "f%02d.png")], { ms: 60_000 })
      const frames = fs.readdirSync(dir).filter((f) => /^f\d+\.png$/.test(f)).sort()
      const texts = []
      for (const f of frames) {
        const r = await run(tesseract, [path.join(dir, f), "stdout", "--psm", "11"], { ms: 20_000 })
        if (r.code === 0) texts.push(r.out)
      }
      onScreen = cleanOcr(texts)
    }

    const value = {
      watched: true,
      transcript,
      onScreen,
      duration: Number(info.duration) || 0,
      uploader: String(info.uploader || info.channel || ""),
      description: String(info.description || "").slice(0, 2000),
      tools: { whisper: Boolean(whisper), tesseract: Boolean(tesseract) },
    }
    writeWatchCache(url, value)
    return value
  } finally {
    fs.rmSync(dir, { recursive: true, force: true })
  }
}
