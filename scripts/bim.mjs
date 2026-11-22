#!/usr/bin/env node
/**
 * scripts/bim.mjs — The Commands BIMBY in Terminal
 *
 *   bim                       list every command BIM knows
 *   bim <words>               print the best match ("bim llm server", "bim brain2 mobile")
 *   bim run <words>           print it, ask y/N, then run it in zsh
 *   bim copy <words>          put it on the clipboard (pbcopy)
 *   bim add <what it is for>  then paste the command and press Ctrl-D; kept in the vault, so BIM chat knows it too
 *   bim forget <words>        hide a command
 *
 * The list is the shipped one (`lib/commands-bimby/commands.mjs`) plus the vault's `brain2-commands`, read from the
 * hub on this Mac (port 8787, else the app on 3000), else from `data/shared-persist.json`. Writes go through the
 * hub's `/api/persist` PUT, the same merge the app's own sync uses.
 * Install once: `ln -sf ~/brain2/scripts/bim.mjs /opt/homebrew/bin/bim`.
 */
import fs from "node:fs"
import path from "node:path"
import { spawnSync } from "node:child_process"
import { createInterface } from "node:readline/promises"
import { fileURLToPath } from "node:url"
import { bestCommands, commandId, matchCommands, mergeCommands, SEED_COMMANDS, wordsOf } from "../lib/commands-bimby/commands.mjs"

const ROOT = path.resolve(path.dirname(fs.realpathSync(fileURLToPath(import.meta.url))), "..")
const KEY = "brain2-commands"
const HUBS = process.env.BIM_HUB ? [process.env.BIM_HUB] : ["http://127.0.0.1:8787", "http://127.0.0.1:3000"]

const dim = (s) => (process.stdout.isTTY ? `\x1b[2m${s}\x1b[0m` : s)
const bold = (s) => (process.stdout.isTTY ? `\x1b[1m${s}\x1b[0m` : s)

async function hubItems() {
  for (const base of HUBS) {
    try {
      const res = await fetch(`${base}/api/persist?canon=1`, { signal: AbortSignal.timeout(4000) })
      if (!res.ok) continue
      const body = await res.json()
      if (body?.items) return { base, items: body.items }
    } catch {
      /* next */
    }
  }
  return null
}

function fileItems() {
  try {
    return JSON.parse(fs.readFileSync(path.join(ROOT, "data", "shared-persist.json"), "utf8")).items ?? {}
  } catch {
    return {}
  }
}

function savedFrom(items) {
  try {
    const raw = items[KEY] ?? items["cogs-commands"]
    const saved = raw ? JSON.parse(raw)?.state?.saved : null
    return Array.isArray(saved) ? saved : []
  } catch {
    return []
  }
}

async function load() {
  const hub = await hubItems()
  const saved = savedFrom(hub?.items ?? fileItems())
  return { hub, saved, all: mergeCommands(SEED_COMMANDS, saved) }
}

async function write(hub, saved) {
  if (!hub) throw new Error("The hub is not running on this Mac (ports 8787 and 3000), so nothing was saved.")
  const value = JSON.stringify({ state: { saved }, version: 1 })
  const res = await fetch(`${hub.base}/api/persist`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ items: { [KEY]: value }, source: "bim-cli" }),
    signal: AbortSignal.timeout(8000),
  })
  if (!res.ok) throw new Error(`The hub said ${res.status}.`)
}

function show(c) {
  console.log(`${bold(c.name)}${c.source === "you" ? dim("  (yours)") : ""}`)
  console.log(`  ${c.command.split("\n").join("\n  ")}`)
  if (c.does) console.log(dim(`  ${c.does}`))
}

function pick(all, words) {
  const hit = bestCommands(all, words)
  if (!hit.length) {
    console.error(`No command matches "${words}". \`bim\` lists them all.`)
    process.exit(1)
  }
  if (hit.length > 1) {
    console.error(`A few match "${words}":\n`)
    for (const c of hit) show(c)
    process.exit(2)
  }
  return hit[0]
}

async function readStdin() {
  const chunks = []
  for await (const c of process.stdin) chunks.push(c)
  return Buffer.concat(chunks).toString("utf8").trim()
}

async function main() {
  const [verb, ...rest] = process.argv.slice(2)
  const words = rest.join(" ")
  const { hub, saved, all } = await load()

  if (!verb || verb === "list" || verb === "ls") {
    for (const c of all) show(c)
    console.log(dim(`\n${all.length} commands. Add one: bim add <what it is for>, then paste it.${hub ? "" : "  (hub not running: read from the file)"}`))
    return
  }
  if (verb === "-h" || verb === "--help" || verb === "help") {
    console.log("bim [words] | bim run <words> | bim copy <words> | bim add <what it is for> | bim forget <words>")
    return
  }
  if (verb === "run") {
    const c = pick(all, words)
    show(c)
    const rl = createInterface({ input: process.stdin, output: process.stdout })
    const yes = /^y(es)?$/i.test((await rl.question("\nRun it? [y/N] ")).trim())
    rl.close()
    if (!yes) return
    const out = spawnSync("/bin/zsh", ["-lc", c.command], { stdio: "inherit" })
    process.exit(out.status ?? 0)
  }
  if (verb === "copy") {
    const c = pick(all, words)
    spawnSync("pbcopy", { input: c.command })
    console.log(`Copied: ${c.command}`)
    return
  }
  if (verb === "add") {
    if (!words.trim()) throw new Error("Say what it is for: bim add autodownload a folder of mp3s")
    if (process.stdin.isTTY) console.log("Paste the command, then press Ctrl-D:")
    const command = (await readStdin()).replace(/^\$\s+/gm, "")
    if (!command) throw new Error("No command pasted; nothing saved.")
    const id = commandId(words)
    const name = words[0].toUpperCase() + words.slice(1)
    const row = { id, name, command, words: wordsOf(words).filter((w) => w.length > 2), at: new Date().toISOString(), source: "you" }
    await write(hub, [...saved.filter((s) => s.id !== id), row])
    console.log(`Saved: ${name}. BIM chat knows it too.`)
    return
  }
  if (verb === "forget" || verb === "rm") {
    const c = pick(all, words)
    await write(hub, [...saved.filter((s) => s.id !== c.id), { id: c.id, name: c.name, command: "", gone: true, at: new Date().toISOString() }])
    console.log(`Forgot: ${c.name}.`)
    return
  }
  // `bim <words>`: the best match, or the close ones.
  const asked = [verb, ...rest].join(" ")
  const hits = matchCommands(all, asked)
  if (!hits.length) {
    console.error(`No command matches "${asked}". \`bim\` lists them all.`)
    process.exit(1)
  }
  const top = hits.filter((h) => h.score === hits[0].score)
  for (const h of top) show(h.command)
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error))
  process.exit(1)
})
