#!/usr/bin/env node
/**
 * Print BRAIN2_ONLY ids whose screenshot-manifest sources changed.
 *
 * sources in scripts/screenshot-manifest.mjs are repo-relative files.
 * A shot is listed when one of those paths is in the diff. A full
 * recapture is a gallery day — this only names the shots to refresh.
 *
 * Usage:
 *   node scripts/screenshot-targets.mjs
 *   node scripts/screenshot-targets.mjs -- path1 path2
 * Default diff is staged + unstaged + untracked against HEAD.
 */
import { execSync } from "node:child_process"
import { SHOTS } from "./screenshot-manifest.mjs"

function git(args) {
  try {
    return execSync(`git ${args}`, { encoding: "utf8" }).split("\n").map((l) => l.trim()).filter(Boolean)
  } catch {
    return []
  }
}

function changedFiles() {
  const argv = process.argv.slice(2)
  const dash = argv.indexOf("--")
  if (dash >= 0) return argv.slice(dash + 1).filter(Boolean)
  if (argv.length && !argv[0].startsWith("-")) return argv
  const diff = git("diff --name-only HEAD")
  const untracked = git("ls-files --others --exclude-standard")
  return [...new Set([...diff, ...untracked])]
}

const files = new Set(changedFiles())
const hits = []
for (const shot of SHOTS) {
  const sources = Array.isArray(shot.sources) ? shot.sources : []
  if (sources.some((src) => files.has(src))) hits.push(shot.file)
}

if (!hits.length) {
  console.log("No screenshot ids. The diff did not touch a manifest source.")
  process.exit(0)
}

console.log(hits.join("\n"))
console.log("")
console.log(`BRAIN2_ONLY=${hits.join(",")} npm run capture-screenshots`)
