/**
 * lib/vault-guard.js — Prefer the richer snapshot; never let a seed wipe a vault
 *
 * Shared by Electron preload (CJS), the persist hub (`scripts/persist-api.mjs`),
 * and Zustand `persist-storage`. Counts records in the live stores and rejects
 * a write that would drop them below half — the 2026-09-21 empty `brain2`
 * profile was 15 lists items vs 2455 in Application Support/`cogs`.
 *
 * Ordinary one-row edits still pass. This does not follow package.json `name`
 * or the git folder name (`cogs copy` → `brain2`); those are not the vault.
 */
function parseState(value) {
  try {
    const parsed = JSON.parse(value)
    return parsed && typeof parsed === "object" ? (parsed.state ?? parsed) : null
  } catch {
    return null
  }
}

function arrayLen(value) {
  return Array.isArray(value) ? value.length : null
}

function objectLen(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? Object.keys(value).length : null
}

const SHRINK_PROTECTED = new Set([
  "cogs-timegrid-store",
  "cogs-sleep-store",
  "cogs-task-storage",
  "cogs-habits-store",
])

function vaultRecordCount(name, value) {
  if (typeof value !== "string") return null
  const state = parseState(value)
  if (!state || typeof state !== "object") return null
  if (name === "cogs-timegrid-store") return arrayLen(state.entries)
  if (name === "cogs-sleep-store") return objectLen(state.nights)
  if (name === "cogs-task-storage") return arrayLen(state.tasks)
  if (name === "cogs-habits-store") {
    const tasks = arrayLen(state.tasks)
    const days = objectLen(state.weeklyData)
    if (tasks == null && days == null) return null
    return (tasks ?? 0) + (days ?? 0)
  }
  return null
}

/**
 * Reject when incoming is thinner than half of what is already stored.
 * `<= prev * 0.5` so a 15-habit seed cannot replace a 30-habit vault.
 */
function shouldRejectVaultShrink(name, incoming, existing) {
  if (!SHRINK_PROTECTED.has(name)) return false
  if (typeof existing !== "string" || typeof incoming !== "string") return false
  const next = vaultRecordCount(name, incoming)
  const prev = vaultRecordCount(name, existing)
  if (next == null || prev == null || prev === 0) return false
  if (next < prev && next <= prev * 0.5) return true
  // Byte-size backstop if JSON counts are missing but the blob is clearly a wipe.
  if (existing.length > 200000 && incoming.length <= existing.length * 0.5) return true
  return false
}

/**
 * Local wins once this profile has a snapshot, unless that snapshot is a seed
 * wipe compared with the hub. Missing local still takes the hub.
 */
function pickPersistItem(local, hubValue, name) {
  const hub = typeof hubValue === "string" ? hubValue : null
  if (typeof local === "string" && hub && name && shouldRejectVaultShrink(name, local, hub)) {
    return hub
  }
  if (typeof local === "string") return local
  return hub
}

module.exports = {
  SHRINK_PROTECTED,
  vaultRecordCount,
  shouldRejectVaultShrink,
  pickPersistItem,
}
