#!/usr/bin/env node
/**
 * Build and launch BRAIN2 on an iPhone Simulator.
 * Uses a booted iPhone when one is already running, otherwise the first
 * available iPhone. `cap run` syncs `out/` into the Xcode project first.
 */
import { spawnSync } from "node:child_process"
import path from "node:path"
import { fileURLToPath } from "node:url"

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")

const listed = spawnSync("xcrun", ["simctl", "list", "devices", "available", "-j"], {
  encoding: "utf8",
})
if (listed.status !== 0) {
  console.error(listed.stderr || "simctl list failed")
  process.exit(listed.status ?? 1)
}

const devices = JSON.parse(listed.stdout)
const iphones = []
for (const runtime of Object.values(devices.devices ?? {})) {
  for (const device of runtime) {
    if (!device.isAvailable || !/iPhone/.test(device.name)) continue
    iphones.push(device)
  }
}

const target = iphones.find((device) => device.state === "Booted") ?? iphones[0]
if (!target) {
  console.error("[mobile-ios-sim] no available iPhone Simulator. Install one in Xcode → Settings → Platforms.")
  process.exit(1)
}

console.log(`[mobile-ios-sim] ${target.name} (${target.udid})`)

const run = spawnSync(
  "npx",
  ["cap", "run", "ios", "--target", target.udid],
  { cwd: root, stdio: "inherit", env: { ...process.env, LANG: "en_US.UTF-8", LC_ALL: "en_US.UTF-8" } },
)
process.exit(run.status ?? 1)
