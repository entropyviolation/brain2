#!/usr/bin/env node
/**
 * Open the production build in Electron on port 3000.
 *
 * The first run exports `data/` with `scripts/backup-data.mjs` (the nightly
 * vault archive) before anything is served. Later runs skip that export.
 * `electron:dev` is a different script and is not changed.
 *
 * Port 3000 must be free. This script does not stop whatever is already there.
 */
import { spawn, spawnSync, execFileSync } from "node:child_process"
import fs from "node:fs"
import os from "node:os"
import path from "node:path"
import { fileURLToPath } from "node:url"

const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
const port = Number(process.env.PORT || 3000)
const marker = path.join(os.homedir(), "Brain2Backups", ".electron-local-first-export")

function portBusy(n) {
  try {
    execFileSync("lsof", ["-nP", `-iTCP:${n}`, "-sTCP:LISTEN"], { stdio: "ignore" })
    return true
  } catch {
    return false
  }
}

if (!fs.existsSync(marker)) {
  console.log("[electron:local] First run. Exporting a backup of data/ before serving.")
  const backed = spawnSync(process.execPath, [path.join(repo, "scripts", "backup-data.mjs")], {
    cwd: repo,
    stdio: "inherit",
  })
  if (backed.status !== 0) {
    console.error("[electron:local] Backup failed. Not starting.")
    process.exit(backed.status || 1)
  }
  fs.mkdirSync(path.dirname(marker), { recursive: true })
  fs.writeFileSync(marker, `${new Date().toISOString()}\n`)
}

if (!fs.existsSync(path.join(repo, "out", "index.html"))) {
  console.error("[electron:local] No production build in out/. Run npm run build first.")
  process.exit(1)
}

if (portBusy(port)) {
  console.error("")
  console.error(`[electron:local] port ${port} is already in use.`)
  console.error("[electron:local] This script does not stop it. electron:dev can keep that port.")
  console.error(`[electron:local] Find it:  lsof -nP -iTCP:${port} -sTCP:LISTEN`)
  console.error("")
  process.exit(1)
}

const child = spawn(
  "bash",
  [
    "-c",
    [
      "ulimit -n 10240 2>/dev/null || true",
      "unset ELECTRON_RUN_AS_NODE",
      "export LANG=en_US.UTF-8 LC_ALL=en_US.UTF-8",
      'exec concurrently -k -n next,electron -c blue,green "node scripts/cogs-prod-server.mjs" "wait-on -t 300000 -s 1 --httpTimeout 280000 http-get://127.0.0.1:' +
        port +
        '/ && electron ."',
    ].join("\n"),
  ],
  {
    cwd: repo,
    stdio: "inherit",
    env: {
      ...process.env,
      PORT: String(port),
      PATH: `${path.join(repo, "node_modules", ".bin")}${path.delimiter}${process.env.PATH ?? ""}`,
    },
  },
)

child.on("exit", (code, signal) => {
  if (signal) process.kill(process.pid, signal)
  process.exit(code ?? 1)
})
