/**
 * lib/row-vault.js — Task vault as rows: split, order hash, apply a delta
 *
 * Shared by the hub row mirror (`scripts/row-store.mjs`) and the phone window
 * (`lib/phone-window.ts`). Pure: no storage, no network. A client holds the
 * last whole vault the hub sent, asks for the rows changed since a cursor, and
 * rebuilds the vault with `applyRowChanges`. It then compares the result to the
 * hub's counts and order hash. Any mismatch means "download the whole vault".
 */

const KIND_FIELDS = { task: "tasks", list: "lists", folder: "folders" }
const KINDS = Object.keys(KIND_FIELDS)

/** 32-bit FNV-1a over UTF-16 units. Same result in Node and the web view. */
function hashIds(ids) {
  let h = 0x811c9dc5
  for (let i = 0; i < ids.length; i++) {
    const s = ids[i] + "\n"
    for (let j = 0; j < s.length; j++) {
      h ^= s.charCodeAt(j)
      h = Math.imul(h, 0x01000193)
    }
  }
  return (h >>> 0).toString(16)
}

function idsOf(list) {
  const out = []
  if (!Array.isArray(list)) return out
  for (const row of list) if (row && typeof row === "object" && typeof row.id === "string" && row.id) out.push(row.id)
  return out
}

/** Row ids in blob order per kind, plus the counts and hashes a client checks against. */
function describeVault(state) {
  const order = {}
  const counts = {}
  const hashes = {}
  for (const kind of KINDS) {
    order[kind] = idsOf(state[KIND_FIELDS[kind]])
    counts[kind] = order[kind].length
    hashes[kind] = hashIds(order[kind])
  }
  return { order, counts, hashes }
}

/**
 * Apply `rows` (from `/api/persist/rows`) to a whole vault blob. Existing rows
 * keep their place, new rows go last. `order`, when given, is the hub's id order
 * per kind and decides the final order. Returns null when the blob or a row is
 * not usable, so the caller falls back to a full download.
 */
function applyRowChanges(baseBlob, rows, order) {
  let parsed
  try {
    parsed = JSON.parse(baseBlob)
  } catch {
    return null
  }
  const state = parsed && typeof parsed === "object" ? parsed.state : null
  if (!state || typeof state !== "object" || !Array.isArray(state.tasks)) return null
  const maps = {}
  for (const kind of KINDS) {
    maps[kind] = new Map()
    for (const row of Array.isArray(state[KIND_FIELDS[kind]]) ? state[KIND_FIELDS[kind]] : []) {
      if (!row || typeof row.id !== "string" || !row.id) return null // cannot round-trip a row without an id
      maps[kind].set(row.id, row)
    }
  }
  let rest = null
  for (const change of rows) {
    if (!change || typeof change.id !== "string") return null
    if (change.kind === "state") {
      if (!change.deleted && change.row && typeof change.row === "object") rest = change.row
      continue
    }
    const map = maps[change.kind]
    if (!map) continue
    if (change.deleted) map.delete(change.id)
    else if (change.row && typeof change.row === "object") map.set(change.id, change.row)
    else return null
  }
  const next = { ...state }
  for (const kind of KINDS) {
    let list = [...maps[kind].values()]
    const want = order && order[kind]
    if (want) {
      const byId = maps[kind]
      list = []
      for (const id of want) {
        const row = byId.get(id)
        if (!row) return null
        list.push(row)
      }
      if (list.length !== byId.size) return null
    }
    next[KIND_FIELDS[kind]] = list
  }
  let version = parsed.version
  if (rest) {
    const { version: v, ...fields } = rest
    version = v
    for (const key of Object.keys(next)) if (!(key in KIND_FIELDS) && !Object.values(KIND_FIELDS).includes(key)) delete next[key]
    Object.assign(next, fields)
  }
  const described = describeVault(next)
  return { blob: JSON.stringify({ state: next, version }), ...described }
}

/** True when the rebuilt vault has the hub's counts and order. */
function matchesHub(result, head) {
  if (!result || !head || !head.counts || !head.hashes) return false
  return KINDS.every((k) => result.counts[k] === head.counts[k] && result.hashes[k] === head.hashes[k])
}

module.exports = { KIND_FIELDS, hashIds, describeVault, applyRowChanges, matchesHub }
