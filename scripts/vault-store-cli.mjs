#!/usr/bin/env node
/**
 * Vault store CLI (stage 4a, `docs/ORACLE_INTERIM_SYNC.md`).
 *
 *   npm run store:check    compare data/shared-persist.json with the SQLite store; exit 1 on a difference
 *   npm run store:import   fill the store from the JSON file (refuses a store that already differs, unless --force)
 *   npm run store:export   write the JSON file from the store (the old file is copied aside first)
 *
 * Add `--file <path>` to use another JSON file; the store sits beside it as `<file>.vaults.sqlite`.
 * The JSON file is never deleted.
 */
import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { expandAliases, collapseAliases, stripFriendPicItems, sharedPersistPath } from "./persist-api.mjs"
import { openVaultStore, closeVaultStore, compareItems, loadAll, replaceAll } from "./vault-store.mjs"

function readJson(file) {
  const parsed = JSON.parse(fs.readFileSync(file, "utf8"))
  return {
    updatedAt: parsed.updatedAt ?? null,
    source: parsed.source ?? null,
    contentAt: parsed.contentAt ?? null,
    contentSource: parsed.contentSource ?? null,
    items: collapseAliases(stripFriendPicItems(parsed.items && typeof parsed.items === "object" ? parsed.items : {})),
  }
}

function summarize(diff) {
  return `${diff.missing.length} only in the file, ${diff.differing.length} different, ${diff.extra.length} only in the store`
}

export function run(argv, log = console.log) {
  const args = argv.slice()
  const cmd = args.shift()
  const force = args.includes("--force")
  const at = args.indexOf("--file")
  const file = at >= 0 && args[at + 1] ? path.resolve(args[at + 1]) : sharedPersistPath()
  const store = openVaultStore(`${file}.vaults.sqlite`)
  try {
    if (cmd === "check") {
      const disk = readJson(file)
      const diff = compareItems(store, disk.items)
      const same = !diff.missing.length && !diff.differing.length && !diff.extra.length
      log(same ? `store matches ${path.basename(file)} (${Object.keys(disk.items).length} vaults)` : `store differs: ${summarize(diff)}`)
      for (const key of [...diff.missing, ...diff.differing, ...diff.extra].slice(0, 20)) log(`  ${key}`)
      return same ? 0 : 1
    }
    if (cmd === "import") {
      const disk = readJson(file)
      const diff = compareItems(store, disk.items)
      const empty = Object.keys(loadAll(store).items).length === 0
      if (!empty && !force && (diff.differing.length || diff.extra.length)) {
        log(`store already holds different data (${summarize(diff)}). Nothing changed. Use --force to replace it with the file.`)
        return 1
      }
      const done = replaceAll(store, disk.items, disk)
      log(`imported ${Object.keys(disk.items).length} vaults (${done.changed} changed)`)
      return 0
    }
    if (cmd === "export") {
      const all = loadAll(store)
      if (Object.keys(all.items).length === 0) {
        log("store is empty; refusing to write an empty file")
        return 1
      }
      if (fs.existsSync(file)) {
        const aside = `${file}.before-export.${new Date().toISOString().replace(/[:.]/g, "-")}`
        fs.copyFileSync(file, aside)
        log(`old file copied to ${aside}`)
      }
      const tmp = `${file}.${process.pid}.export.tmp`
      fs.writeFileSync(tmp, JSON.stringify({ updatedAt: all.updatedAt, source: all.source ?? "hub", contentAt: all.contentAt, contentSource: all.contentSource, items: expandAliases(all.items) }), "utf8")
      fs.renameSync(tmp, file)
      log(`exported ${Object.keys(all.items).length} vaults to ${file}`)
      return 0
    }
    log("usage: vault-store-cli <check|import|export> [--file <json>] [--force]")
    return 2
  } finally {
    closeVaultStore(store)
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) process.exit(run(process.argv.slice(2)))
