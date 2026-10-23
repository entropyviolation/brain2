#!/usr/bin/env node
// Keep the sideloaded iPhone app alive. A free Apple ID build stops opening after 7 days,
// and location stops with it. Run by launchd every few hours (deploy/mac/com.brain2.ios-reinstall.plist).
// Each run: if the last good install is older than COGS_IOS_REINSTALL_DAYS, build and install over
// Wi-Fi or cable. If the phone is not reachable, try again next run. If the install is getting old,
// remind on the Mac and, when configured, in Telegram.
//
// Usage: node scripts/ios-reinstall.mjs [--force] [--dry-run]
// Env:   COGS_IOS_TEAM_ID         Apple team id (Xcode → Settings → Accounts). Required to build.
//        COGS_IOS_DEVICE          device id or name; default: the first reachable iPhone
//        COGS_IOS_REINSTALL_DAYS  default 4 (leaves three days of retries before expiry)
//        COGS_IOS_REMIND_DAYS     default 5
//        COGS_TELEGRAM_BOT_TOKEN + COGS_IOS_REMIND_CHAT_ID  optional Telegram reminder
// State: ~/.brain2/ios-reinstall.json (lastSuccessAt, lastAttemptAt, lastError, lastRemindAt).
import { spawnSync } from "node:child_process"
import fs from "node:fs"
import os from "node:os"
import path from "node:path"
import { fileURLToPath } from "node:url"

const DAY = 24 * 60 * 60 * 1000
export const EXPIRY_DAYS = 7
export const DEFAULT_REINSTALL_DAYS = 4
export const DEFAULT_REMIND_DAYS = 5
/** At most one reminder per this many hours. */
export const REMIND_EVERY_HOURS = 12
export const STATE_FILE = path.join(os.homedir(), ".brain2", "ios-reinstall.json")

export function readState(file = STATE_FILE) {
  try {
    return JSON.parse(fs.readFileSync(file, "utf8"))
  } catch {
    return {}
  }
}

export function writeState(state, file = STATE_FILE) {
  fs.mkdirSync(path.dirname(file), { recursive: true })
  fs.writeFileSync(file, JSON.stringify(state, null, 2) + "\n")
}

/** Days since the last good install, or Infinity when there has never been one. */
export function installAgeDays(state, now = Date.now()) {
  const at = Date.parse(state.lastSuccessAt ?? "")
  return Number.isFinite(at) ? (now - at) / DAY : Infinity
}

export function isDue(state, { now = Date.now(), reinstallDays = DEFAULT_REINSTALL_DAYS, force = false } = {}) {
  return force || installAgeDays(state, now) >= reinstallDays
}

export function shouldRemind(state, { now = Date.now(), remindDays = DEFAULT_REMIND_DAYS } = {}) {
  if (installAgeDays(state, now) < remindDays) return false
  const last = Date.parse(state.lastRemindAt ?? "")
  return !Number.isFinite(last) || now - last >= REMIND_EVERY_HOURS * 60 * 60 * 1000
}

/** Words for the reminder. Infinity means no install was ever recorded. */
export function reminderText(state, now = Date.now()) {
  const age = installAgeDays(state, now)
  if (!Number.isFinite(age)) {
    return "Brain2 iPhone app: no automatic install has worked yet. Plug the phone into the Mac, or run npm run ios:reinstall -- --force."
  }
  const left = Math.max(0, EXPIRY_DAYS - age)
  const when = left < 1 ? "today" : `in ${Math.floor(left)} day${Math.floor(left) === 1 ? "" : "s"}`
  const why = state.lastError ? ` Last try: ${state.lastError}` : ""
  return `Brain2 iPhone app stops opening ${when}, and location stops with it. Bring the phone near the Mac on the same Wi-Fi, or plug it in.${why}`
}

/**
 * The iPhone to install on, from `xcrun devicectl list devices --json-output` data.
 * Prefers a match on COGS_IOS_DEVICE (id or name). Skips devices devicectl reports as unavailable.
 */
export function pickDevice(json, wanted = "") {
  const devices = (json?.result?.devices ?? []).filter((d) => {
    const platform = d?.hardwareProperties?.platform ?? ""
    const tunnel = d?.connectionProperties?.tunnelState ?? ""
    return /ios/i.test(platform) && tunnel !== "unavailable"
  })
  const want = wanted.trim().toLowerCase()
  const match = want
    ? devices.find((d) => d.identifier?.toLowerCase() === want || d?.deviceProperties?.name?.toLowerCase() === want)
    : devices[0]
  return match ? { id: match.identifier, name: match?.deviceProperties?.name ?? match.identifier } : null
}

function run(cmd, args, opts = {}) {
  const r = spawnSync(cmd, args, { stdio: "inherit", ...opts })
  if (r.status !== 0) throw new Error(`${cmd} ${args[0] ?? ""} failed (exit ${r.status ?? r.signal})`)
}

function listDevices() {
  const out = path.join(os.tmpdir(), `brain2-devices-${process.pid}.json`)
  const r = spawnSync("xcrun", ["devicectl", "list", "devices", "--json-output", out], { stdio: "ignore", timeout: 60000 })
  try {
    return r.status === 0 ? JSON.parse(fs.readFileSync(out, "utf8")) : null
  } catch {
    return null
  } finally {
    fs.rmSync(out, { force: true })
  }
}

function notifyMac(text) {
  spawnSync("osascript", ["-e", `display notification ${JSON.stringify(text)} with title "Brain2"`], { stdio: "ignore" })
}

async function notifyTelegram(text, env) {
  const token = env.COGS_TELEGRAM_BOT_TOKEN
  const chat = env.COGS_IOS_REMIND_CHAT_ID
  if (!token || !chat) return
  try {
    await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chat, text }),
      signal: AbortSignal.timeout(20000),
    })
  } catch {
    /* the Mac notification still went out */
  }
}

function buildAndInstall(root, device, teamId) {
  const env = { ...process.env, LANG: "en_US.UTF-8", LC_ALL: "en_US.UTF-8" }
  const derived = path.join(os.homedir(), "Library", "Caches", "brain2-ios-build")
  run("npm", ["run", "build"], { cwd: root, env })
  run("node", ["scripts/mobile-ios-ats.mjs"], { cwd: root, env })
  run("npx", ["cap", "sync", "ios"], { cwd: root, env })
  run(
    "xcodebuild",
    [
      "-workspace", "ios/App/App.xcworkspace",
      "-scheme", "App",
      "-configuration", "Debug",
      "-destination", "generic/platform=iOS",
      "-derivedDataPath", derived,
      "-allowProvisioningUpdates",
      `DEVELOPMENT_TEAM=${teamId}`,
      "CODE_SIGN_STYLE=Automatic",
      "build",
    ],
    { cwd: root, env },
  )
  const app = path.join(derived, "Build", "Products", "Debug-iphoneos", "App.app")
  run("xcrun", ["devicectl", "device", "install", "app", "--device", device.id, app], { cwd: root, env })
}

export async function main(argv = process.argv.slice(2), env = process.env) {
  const force = argv.includes("--force")
  const dryRun = argv.includes("--dry-run")
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
  const reinstallDays = Number(env.COGS_IOS_REINSTALL_DAYS) || DEFAULT_REINSTALL_DAYS
  const remindDays = Number(env.COGS_IOS_REMIND_DAYS) || DEFAULT_REMIND_DAYS
  const state = readState()
  const now = Date.now()
  const stamp = new Date(now).toISOString()

  if (!isDue(state, { now, reinstallDays, force })) {
    console.log(`[ios-reinstall] ${stamp} not due (installed ${installAgeDays(state, now).toFixed(1)} days ago)`)
    return 0
  }

  let error = ""
  const teamId = (env.COGS_IOS_TEAM_ID ?? "").trim()
  const device = teamId ? pickDevice(listDevices(), env.COGS_IOS_DEVICE ?? "") : null
  if (!teamId) error = "COGS_IOS_TEAM_ID is not set"
  else if (!device) error = "no iPhone reachable (same Wi-Fi and unlocked, or plugged in)"
  else if (dryRun) console.log(`[ios-reinstall] ${stamp} would install on ${device.name}`)
  else {
    try {
      console.log(`[ios-reinstall] ${stamp} installing on ${device.name}`)
      buildAndInstall(root, device, teamId)
    } catch (err) {
      error = err instanceof Error ? err.message : String(err)
    }
  }

  const next = { ...state, lastAttemptAt: stamp }
  if (!error && !dryRun) {
    next.lastSuccessAt = stamp
    delete next.lastError
    console.log(`[ios-reinstall] ${stamp} installed`)
  } else if (error) {
    next.lastError = error
    console.error(`[ios-reinstall] ${stamp} ${error}`)
  }
  if (!dryRun && shouldRemind(next, { now, remindDays })) {
    const text = reminderText(next, now)
    notifyMac(text)
    await notifyTelegram(text, env)
    next.lastRemindAt = stamp
  }
  if (!dryRun) writeState(next)
  return error ? 1 : 0
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  main().then((code) => process.exit(code))
}
