#!/usr/bin/env node
/**
 * Standalone sync server (port 3847) — optional fallback when not using
 * the unified `npm run dev` server. Prefer `npm run dev` (sync on same port).
 */
import http from "node:http"
import os from "node:os"
import { handleSyncApi, syncDataPath } from "./sync-api.mjs"

const PORT = Number(process.env.COGS_SYNC_PORT || 3847)
const USER = process.env.COGS_SYNC_USER || "admin"
const PASS = process.env.COGS_SYNC_PASS || "admin"

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

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url || "/", `http://${req.headers.host || "localhost"}`)
  const handled = await handleSyncApi(req, res, url.pathname)
  if (!handled) {
    res.writeHead(404, { "Content-Type": "application/json" })
    res.end(JSON.stringify({ ok: false, error: "Not found" }))
  }
})

server.listen(PORT, "0.0.0.0", () => {
  console.log(`[cogs-mobile-sync] listening on http://0.0.0.0:${PORT}`)
  console.log(`[cogs-mobile-sync] local:  http://127.0.0.1:${PORT}`)
  for (const ip of lanAddresses()) {
    console.log(`[cogs-mobile-sync] lan:    http://${ip}:${PORT}`)
  }
  console.log(`[cogs-mobile-sync] auth:   ${USER} / ${PASS}`)
  console.log(`[cogs-mobile-sync] data:   ${syncDataPath()}`)
  console.log(`[cogs-mobile-sync] Tip: prefer npm run dev (sync on the app port).`)
})
