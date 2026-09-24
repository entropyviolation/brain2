#!/usr/bin/env node
/**
 * Unified Brain2 dev server: Next.js + mobile hub API on ONE port.
 *
 * Continuous live sync is not used. `/api/sync` remains for manual
 * push/pull from Settings and `/mobile`. `/api/persist` shares Zustand keys
 * between Chrome and Electron in local dev. `/api/notes` reads Apple Notes
 * on this Mac (loopback only) so Chrome localhost can ingest without Electron IPC.
 * `/api/screentime` queries a running ActivityWatch install (loopback only).
 *
 *   npm run dev
 *   npm run mobile:dev
 */
import { execFileSync } from "node:child_process"
import { createServer } from "node:http"
import { parse } from "node:url"
import net from "node:net"
import os from "node:os"
import next from "next"
import { parseLsofFpc, reclaimablePids } from "./dev-port.mjs"
import { handleSyncApi, syncDataPath } from "./sync-api.mjs"
import { handlePersistApi, sharedPersistPath } from "./persist-api.mjs"
import { handleIngestApi, ingestDataPath } from "./ingest-api.mjs"
import { handleNotesApi } from "./notes-api.mjs"
import { handleScreenTimeApi } from "./screentime-api.mjs"

const hostname = "0.0.0.0"
const preferredPort = Number(process.env.PORT || 3000)
const strictPort = process.env.COGS_STRICT_PORT === "1"

function lanAddresses() {
  try {
    const nets = os.networkInterfaces()
    const out = []
    for (const entries of Object.values(nets || {})) {
      for (const entry of entries || []) {
        if (entry.family === "IPv4" && !entry.internal) out.push(entry.address)
      }
    }
    return out
  } catch {
    return []
  }
}

function canListen(port) {
  return new Promise((resolve) => {
    const tester = net
      .createServer()
      .once("error", () => resolve(false))
      .once("listening", () => {
        tester.close(() => resolve(true))
      })
      .listen(port, hostname)
  })
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function listenersOnPort(port) {
  try {
    const out = execFileSync("lsof", ["-nP", `-iTCP:${port}`, "-sTCP:LISTEN", "-Fpc"], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    })
    return parseLsofFpc(out)
  } catch {
    return []
  }
}

/** After a Next OOM abort, SIGTERM the leftover Node listener so Electron can bind 3000 again. */
async function reclaimNodeListener(port) {
  const pids = reclaimablePids(listenersOnPort(port))
  if (!pids || pids.length === 0) return false
  console.warn(`[cogs-dev] port ${port} held by leftover Node (${pids.join(", ")}); reclaiming.`)
  for (const pid of pids) {
    try {
      process.kill(pid, "SIGTERM")
    } catch {
      /* already gone */
    }
  }
  for (let i = 0; i < 20; i++) {
    await sleep(100)
    if (await canListen(port)) return true
  }
  return false
}

function refuseBusyPort(port) {
  console.error("")
  console.error(`[cogs-dev] port ${port} is already in use.`)
  console.error(`[cogs-dev] Electron always loads http://localhost:${port}, so a leftover`)
  console.error(`[cogs-dev] Next/node process on that port will make the desktop window hang.`)
  console.error(`[cogs-dev] Find it:  lsof -nP -iTCP:${port} -sTCP:LISTEN`)
  console.error(`[cogs-dev] Kill it:  kill $(lsof -t -nP -iTCP:${port} -sTCP:LISTEN)`)
  console.error("")
  process.exit(1)
}

async function pickPort(start, maxTries = 15) {
  for (let i = 0; i < maxTries; i++) {
    const port = start + i
    if (await canListen(port)) return port
  }
  throw new Error(`No free port from ${start}–${start + maxTries - 1}. Kill old node/next processes and retry.`)
}

let port
if (strictPort) {
  if (!(await canListen(preferredPort))) {
    if (!(await reclaimNodeListener(preferredPort))) refuseBusyPort(preferredPort)
  }
  port = preferredPort
} else {
  port = await pickPort(preferredPort)
  if (port !== preferredPort) {
    console.warn(`[cogs-dev] ${preferredPort} busy — using ${port}. Electron still loads http://localhost:${preferredPort} and will not see this server.`)
  }
}
const dev = process.env.NODE_ENV !== "production"
const app = next({ dev, hostname, port })
const handle = app.getRequestHandler()

await app.prepare()

const server = createServer(async (req, res) => {
  try {
    const parsedUrl = parse(req.url || "/", true)
    const pathname = parsedUrl.pathname || "/"
    if (await handlePersistApi(req, res, pathname)) return
    if (await handleSyncApi(req, res, pathname)) return
    if (await handleIngestApi(req, res, pathname)) return
    if (await handleNotesApi(req, res, pathname)) return
    if (await handleScreenTimeApi(req, res, pathname)) return
    await handle(req, res, parsedUrl)
  } catch (err) {
    console.error("[cogs-dev] request error", err)
    if (!res.headersSent) {
      res.statusCode = 500
      res.end("internal server error")
    }
  }
})

let shuttingDown = false
function shutdown() {
  if (shuttingDown) return
  shuttingDown = true
  server.close(() => process.exit(0))
  setTimeout(() => process.exit(0), 2000).unref()
}

process.on("SIGINT", shutdown)
process.on("SIGTERM", shutdown)

server.listen(port, hostname, () => {
  const lans = lanAddresses()
  console.log("")
  console.log(`[cogs-dev] Ready — Next + hub API on ONE port`)
  console.log(`[cogs-dev] local:   http://127.0.0.1:${port}`)
  for (const ip of lans) {
    console.log(`[cogs-dev] phone:   http://${ip}:${port}/mobile/`)
    console.log(`[cogs-dev] desktop: http://${ip}:${port}/`)
  }
  console.log(`[cogs-dev] hub:     ${`http://127.0.0.1:${port}`}/api/sync/*  (admin/admin; live sync parked)`)
  console.log(`[cogs-dev] ingest:  http://127.0.0.1:${port}/api/ingest/*  (${ingestDataPath()})`)
  console.log(`[cogs-dev] notes:   http://127.0.0.1:${port}/api/notes  (loopback, Notes.app)`)
  console.log(`[cogs-dev] screentime: http://127.0.0.1:${port}/api/screentime  (loopback, ActivityWatch)`)
  console.log(`[cogs-dev] data:    ${syncDataPath()}`)
  console.log("")
})
