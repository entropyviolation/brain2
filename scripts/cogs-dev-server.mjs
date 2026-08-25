#!/usr/bin/env node
/**
 * Unified COGS dev server: Next.js + live sync API on ONE port.
 *
 * Phone and desktop both use the same origin (e.g. http://192.168.x.x:3000),
 * so continuous live sync just works — no separate :3847 URL.
 *
 *   npm run dev
 *   npm run mobile:dev
 */
import { createServer } from "node:http"
import { parse } from "node:url"
import net from "node:net"
import os from "node:os"
import next from "next"
import { handleSyncApi, syncDataPath } from "./sync-api.mjs"

const hostname = "0.0.0.0"
const preferredPort = Number(process.env.PORT || 3000)

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

async function pickPort(start, maxTries = 15) {
  for (let i = 0; i < maxTries; i++) {
    const port = start + i
    if (await canListen(port)) return port
  }
  throw new Error(`No free port from ${start}–${start + maxTries - 1}. Kill old node/next processes and retry.`)
}

const port = await pickPort(preferredPort)
const dev = process.env.NODE_ENV !== "production"
const app = next({ dev, hostname, port })
const handle = app.getRequestHandler()

await app.prepare()

const server = createServer(async (req, res) => {
  try {
    const parsedUrl = parse(req.url || "/", true)
    const pathname = parsedUrl.pathname || "/"
    if (await handleSyncApi(req, res, pathname)) return
    await handle(req, res, parsedUrl)
  } catch (err) {
    console.error("[cogs-dev] request error", err)
    if (!res.headersSent) {
      res.statusCode = 500
      res.end("internal server error")
    }
  }
})

server.listen(port, hostname, () => {
  const lans = lanAddresses()
  console.log("")
  console.log(`[cogs-dev] Ready — Next + live sync on ONE port`)
  console.log(`[cogs-dev] local:   http://127.0.0.1:${port}`)
  for (const ip of lans) {
    console.log(`[cogs-dev] phone:   http://${ip}:${port}/mobile/`)
    console.log(`[cogs-dev] desktop: http://${ip}:${port}/`)
  }
  console.log(`[cogs-dev] sync:    ${`http://127.0.0.1:${port}`}/api/sync/*  (admin/admin)`)
  console.log(`[cogs-dev] data:    ${syncDataPath()}`)
  console.log(`[cogs-dev] Keep the desktop tab open. Phone updates automatically.`)
  console.log("")
})
