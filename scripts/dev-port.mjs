/**
 * Port occupancy helpers for the unified Next/hub dev server.
 * Strict Electron binds only localhost:3000; a Next OOM abort can leave a
 * Node listener behind. Reclaim that listener; refuse anything that is not Node.
 */

const RECLAIMABLE = /^(node(\.\d+)?|next)$/i

/** Parse `lsof -Fpc` records into `{ pid, command }` rows. */
export function parseLsofFpc(text) {
  const procs = []
  let pid = null
  for (const line of String(text || "").split(/\r?\n/)) {
    if (line.startsWith("p")) {
      pid = Number(line.slice(1))
      continue
    }
    if (line.startsWith("c") && Number.isFinite(pid) && pid > 0) {
      procs.push({ pid, command: line.slice(1) })
      pid = null
    }
  }
  return procs
}

/**
 * PIDs that are safe to SIGTERM so the preferred port can bind again.
 * Returns `null` when a non-Node listener is present (do not kill).
 */
export function reclaimablePids(procs) {
  if (!Array.isArray(procs) || procs.length === 0) return []
  if (procs.some((p) => !RECLAIMABLE.test(p.command || ""))) return null
  return [...new Set(procs.map((p) => p.pid).filter((id) => Number.isFinite(id) && id > 0))]
}
