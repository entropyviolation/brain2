#!/usr/bin/env node
/**
 * Static export for the iOS app, beside a running `npm run dev`.
 *
 * Next's `output: "export"` always compiles into `.next` (a custom distDir
 * becomes the export folder, not the compile folder). The dev server already
 * owns `.next`, and a second compiler there drops /mobile while collecting
 * page data. This stages a copy in `.mobile-build` (excludes are anchored
 * at the repo root, so `lib/data` is copied), runs `next build` there,
 * and copies `out/` back for Capacitor (`webDir: "out"`).
 */
import { spawnSync } from "node:child_process"
import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
const stage = path.join(root, ".mobile-build")

fs.mkdirSync(stage, { recursive: true })

const rsync = spawnSync(
  "rsync",
  [
    "-a",
    "--delete",
    "--exclude", "/node_modules",
    "--exclude", "/.next",
    "--exclude", "/out",
    "--exclude", "/.git",
    "--exclude", "/.mobile-build",
    "--exclude", "/ios",
    "--exclude", "/android",
    "--exclude", "/data",
    "--exclude", "/.cursor",
    "--exclude", "/coverage",
    "--exclude", "/playwright-report",
    "--exclude", "/test-results",
    "./",
    `${stage}/`,
  ],
  { cwd: root, stdio: "inherit" },
)
if (rsync.status !== 0) process.exit(rsync.status ?? 1)

function link(name) {
  const dest = path.join(stage, name)
  const src = path.join(root, name)
  if (!fs.existsSync(src)) return
  try {
    const current = fs.lstatSync(dest)
    if (current.isSymbolicLink() && fs.readlinkSync(dest) === src) return
    fs.rmSync(dest, { recursive: true, force: true })
  } catch {
    // dest is missing
  }
  fs.symlinkSync(src, dest)
}

link("node_modules")
link("data")

const env = { ...process.env, LANG: "en_US.UTF-8", LC_ALL: "en_US.UTF-8" }
delete env.NEXT_DIST_DIR
const heap = "--max-old-space-size=8192"
if (!env.NODE_OPTIONS?.includes("max-old-space-size")) {
  env.NODE_OPTIONS = env.NODE_OPTIONS ? `${env.NODE_OPTIONS} ${heap}` : heap
}

const build = spawnSync("npx", ["next", "build"], {
  cwd: stage,
  stdio: "inherit",
  env,
})
if (build.status !== 0) process.exit(build.status ?? 1)

const copy = spawnSync(
  "rsync",
  ["-a", "--delete", `${path.join(stage, "out")}/`, `${path.join(root, "out")}/`],
  { stdio: "inherit" },
)
if (copy.status !== 0) process.exit(copy.status ?? 1)

console.log("[mobile-static-build] wrote out/")
