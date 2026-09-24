/**
 * lib/vault-guard.js — Prefer the richer snapshot; never let a seed wipe a vault
 *
 * Shared by Electron preload (CJS), the persist hub (`scripts/persist-api.mjs`),
 * and Zustand `persist-storage`. Counts records in the live stores and rejects
 * a write that would drop them below half — the 2026-09-21 empty `brain2`
 * profile was 15 lists items vs 2455 in Application Support/`cogs`.
 *
 * `VAULT_RECORD_FIELDS` names the rows each vault holds, and every vault in it
 * is shrink-protected. It used to be a hand-picked five, so the friend gallery,
 * Goals, Reviews, Modules, Metrics, and item types could be replaced by a thin
 * snapshot with no guard at all. Counting stops below `MIN_GUARDED_RECORDS`
 * so deleting 1 of 2 cards is not mistaken for a wipe.
 *
 * Color / desktop prefs are not record counts. A richer hub blob that still
 * lacks `percentLedTint` / tube hues / `pcbMode` must not clobber this
 * profile's defined values (and a hub POST of seed defaults must not either).
 * `appearanceRev` is bumped whenever the user picks a plate or hue: a later
 * hub GET must not roll those picks back to an older snapshot. Habit
 * `contentRev` is the same stamp for titles, details, and completions: a
 * same-sized older snapshot must not replace a newer vault, and a newer
 * edit must not lose to a seed wipe (the shrink guard still wins that case).
 * Hub POST merge
 * keeps an *incoming* blob whose `appearanceRev` is higher (Electron just
 * saved a plate) instead of painting the previous hub plate back onto it.
 * Pins (`brain2-habit-led-tint`, tube keys, `brain2-pcb-mode`) are stamped from a
 * successful persist write (`stampAppearancePins`) and applied only when
 * *reading* a seed hub snapshot (`applyAppearancePins`). A blob with
 * `appearanceRev` > 0 is the user's last pick — stamp pins from it instead of
 * painting a stale pin back over the plate / hues (Electron preload was
 * rewriting localStorage that way on every launch). Tracking `dayNotes` / `untrackedNotes`
 * and the dedicated `cogs-tracking-day-notes` map overlay a richer hub vault
 * of painted intervals. Once this profile has the dedicated notes key, that
 * map is the source of truth — a hub with more historical days must not
 * replace today's jot (key-count shrink does not apply). Missing local still
 * seeds from the hub.
 * Today's-friend dismissals (`dismissedAnimalIds` + `cogs-friend-dismissed`)
 * never shrink. Hub snapshots merge gallery cards **by id** and keep a local
 * name when the hub copy is blank. Pack names do not dismiss catalog species.
 *
 * Inbox clarifications are not record counts. A same-sized snapshot that
 * puts 20+ items back in Inbox is a stale phone/hub dump, not a richer vault.
 * Overlay keeps a local row that already left Inbox when the chosen blob
 * still has it in Inbox. Telegram Inbox / Plan rows are not record counts
 * either: a desktop vault push that never saw the phone-hub write must not
 * drop those ids. `unionPersistSnapshots` folds task rows, planned actions,
 * and plan-text append logs by id (newer stamp / clarification wins; 
 * `removedTaskIds` is how a real Inbox delete stays deleted).
 *
 * Ordinary one-row edits still pass. This does not follow package.json `name`
 * or the git folder name (the checkout is `brain2`, formerly `cogs copy`);
 * those are not the vault.
 * Message ingest stays out of the shrink set (its event log is trimmed), but
 * a pre-hydration seed must not clear `allowedChats`. See
 * `shouldRejectIngestDowngrade`.
 *
 * Message ingest is not shrink-protected (the event log is trimmed on
 * purpose). Pairing is separate: `allowlistRev` plus `revokedChatIds`
 * tombstones. A seed written before rehydrate (empty `allowedChats`, no
 * tombstones, no events) must not replace a paired chat. Equal generations
 * union chats; a tombstone removes one. A lower `allowlistRev` is stale.
 */
function parseJson(value) {
  try {
    const parsed = JSON.parse(value)
    return parsed && typeof parsed === "object" ? parsed : null
  } catch {
    return null
  }
}

function parseState(value) {
  const parsed = typeof value === "string" ? parseJson(value) : null
  if (!parsed) return null
  return parsed.state && typeof parsed.state === "object" && !Array.isArray(parsed.state)
    ? parsed.state
    : parsed
}

function isDemoProfile() {
  try {
    return typeof localStorage !== "undefined" && localStorage.getItem("brain2-data-profile") === "demo"
  } catch {
    return false
  }
}

function vaultId(name) {
  if (typeof name === "string" && name.startsWith("brain2-demo-")) return "cogs-" + name.slice("brain2-demo-".length)
  if (typeof name === "string" && name.startsWith("brain2-")) return "cogs-" + name.slice(7)
  return name
}

function pinAliases(key) {
  if (typeof key !== "string") return [key]
  if (key === "brain2-data-profile" || key === "brain2-demo-vault-ready") return [key]
  if (isDemoProfile()) {
    if (key.startsWith("brain2-demo-")) return [key]
    if (key.startsWith("brain2-")) return ["brain2-demo-" + key.slice(7)]
    if (key.startsWith("cogs-")) return ["brain2-demo-" + key.slice(5)]
    return ["brain2-demo-" + key]
  }
  if (key.startsWith("brain2-")) return [key, "cogs-" + key.slice(7)]
  if (key.startsWith("cogs-")) return ["brain2-" + key.slice(5), key]
  return [key]
}

function arrayLen(value) {
  return Array.isArray(value) ? value.length : null
}

function objectLen(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? Object.keys(value).length : null
}

/**
 * The user's content, per vault: arrays of rows and date-keyed maps. Losing
 * these is the damage this file exists to prevent, so every vault that holds
 * records is listed. Vaults that hold only prefs (theme, lists window, user
 * settings, screen-time, ingest, work session) are deliberately absent — a
 * pref legitimately empties (Deselect all), and `USER_PREF_KEYS` guards those.
 *
 * Add a store here when it starts holding rows. `vault-coverage.test.ts` fails
 * until every backup store is either listed or declared a pref-only vault, so
 * the next store cannot ship unguarded the way the friend gallery did.
 */
const VAULT_RECORD_FIELDS = {
  // Curated collections: the user deletes from these by hand, so a halving
  // needs `MIN_GUARDED_RECORDS` rows before it counts as a wipe.
  "cogs-task-storage": { arrays: ["tasks", "lists", "folders"] },
  "cogs-event-storage": { arrays: ["events"] },
  "cogs-planned-actions": { arrays: ["actions"] },
  "cogs-goals-store": { arrays: ["objectives", "goals"] },
  "cogs-habits-store": { arrays: ["tasks"], maps: ["weeklyData"] },
  "cogs-modules-store": { arrays: ["modules"] },
  "cogs-module-definitions": { arrays: ["definitions"] },
  "cogs-workflows-store": { arrays: ["workflows"] },
  "cogs-item-types-store": { arrays: ["types"] },
  "cogs-baby-animals-store": { arrays: ["photos", "friendHistory"] },
  // Append-only logs: these only accumulate, so *any* real drop is suspect.
  "cogs-timegrid-store": { arrays: ["entries"], maps: ["dayNotes", "untrackedNotes"], log: true },
  "cogs-tracking-day-notes": { log: true }, // counted as a bare date→note map above
  "cogs-sleep-store": { maps: ["nights"], log: true },
  "cogs-reviews-store": { arrays: ["reviews", "operationReviews"], log: true },
  "cogs-metrics-store": { arrays: ["datapoints"], log: true },
  "points-store": { arrays: ["pointsHistory"], log: true },
  "regret-store": { arrays: ["regretHistory"], log: true },
}

const SHRINK_PROTECTED = new Set(Object.keys(VAULT_RECORD_FIELDS))

/**
 * Below this, a halving of a *curated* vault is an ordinary edit (delete 1 of 2
 * friend cards), not a wipe. The guard would otherwise refuse the write *and*
 * hand the old copy back on the next read, resurrecting rows the user just
 * removed. A drop to *zero* is still refused from two rows up, and append-only
 * logs are guarded at any size — see `shouldRejectVaultShrink`.
 */
const MIN_GUARDED_RECORDS = 8

function minGuardedRecords(name) {
  const spec = VAULT_RECORD_FIELDS[name]
  return spec && spec.log ? 2 : MIN_GUARDED_RECORDS
}

/** Tracking, Sleep, Reviews, Metrics, Points, Regret: rows only accumulate. */
function isAppendOnlyVault(name) {
  const spec = VAULT_RECORD_FIELDS[vaultId(name)]
  return !!(spec && spec.log)
}

/** Appearance keys that must survive a hub vault upgrade. */
const USER_PREF_KEYS = {
  "cogs-habits-store": ["percentLedTint", "gradeTubeColor", "outputGradeTubeColor"],
  "cogs-theme-store": ["colors", "chromeFace", "pcbMode"],
}

/** Dedicated appearance pins — never replaced from the hub once this profile has them. */
const APPEARANCE_PIN_IDS = new Set([
  "cogs-pcb-mode",
  "cogs-habit-led-tint",
  "cogs-habit-grade-tube",
  "cogs-habit-output-tube",
])

/**
 * Electron preload: a present theme blob or appearance pin is this profile's
 * last pick. Habits still merge (task counts), but the plate / hue pins and
 * the theme store must not be rewritten from a stale hub dump on launch.
 */
function shouldSkipHubAppearanceCopy(name, local) {
  if (typeof local !== "string" || !local) return false
  const id = vaultId(name)
  if (id === "cogs-theme-store") return true
  return APPEARANCE_PIN_IDS.has(id)
}

/** Known seed defaults — overlaying these would wipe a customized hub. */
const PREF_DEFAULTS = {
  percentLedTint: "#7e14ff",
  gradeTubeColor: "#508b51",
  outputGradeTubeColor: "#25366a",
  chromeFace: 50,
  pcbMode: "teal",
}

const DEFAULT_THEME_COLORS = {
  pointsAllTime: "#ca8a04",
  pointsToday: "#16a34a",
  pointsWeek: "#2563eb",
  pointsMonth: "#9333ea",
  habitBoolean: "#22c55e",
  habitGoal: "#3b82f6",
  habitText: "#a855f7",
  habitIncremental: "#06b6d4",
}

function vaultRecordCount(name, value) {
  name = vaultId(name)
  if (typeof value !== "string") return null
  const state = parseState(value)
  if (!state || typeof state !== "object") return null
  if (name === "cogs-timegrid-store") {
    const entries = arrayLen(state.entries) ?? 0
    const notes = objectLen(state.dayNotes) ?? 0
    const gaps = objectLen(state.untrackedNotes) ?? 0
    return entries + notes + gaps
  }
  if (name === "cogs-tracking-day-notes") {
    const parsed = typeof value === "string" ? parseJson(value) : null
    if (!parsed) return null
    if (parsed.state && typeof parsed.state === "object" && !Array.isArray(parsed.state)) {
      return objectLen(parsed.state)
    }
    return objectLen(parsed)
  }
  const spec = VAULT_RECORD_FIELDS[name]
  if (!spec) return null
  let total = 0
  let counted = false
  for (const field of spec.arrays ?? []) {
    const n = arrayLen(state[field])
    if (n == null) continue
    total += n
    counted = true
  }
  for (const field of spec.maps ?? []) {
    const n = objectLen(state[field])
    if (n == null) continue
    total += n
    counted = true
  }
  return counted ? total : null
}

/**
 * Reject when incoming is thinner than half of what is already stored.
 * `<= prev * 0.5` so a 15-habit seed cannot replace a 30-habit vault.
 */
function isActiveInboxTask(task) {
  if (!task || typeof task !== "object" || task.completed) return false
  return task.stage === "inbox" || task.category === "inbox"
}

function inboxRecordCount(name, value) {
  if (vaultId(name) !== "cogs-task-storage") return null
  if (typeof value !== "string") return null
  const state = parseState(value)
  if (!state || !Array.isArray(state.tasks)) return null
  let n = 0
  for (let i = 0; i < state.tasks.length; i++) {
    if (isActiveInboxTask(state.tasks[i])) n++
  }
  return n
}

/** Inbox grew a lot without that many new rows — stale dump, not new captures. */
function shouldRejectInboxResurrection(name, incoming, existing) {
  if (vaultId(name) !== "cogs-task-storage") return false
  if (typeof existing !== "string" || typeof incoming !== "string") return false
  const nextInbox = inboxRecordCount(name, incoming)
  const prevInbox = inboxRecordCount(name, existing)
  if (nextInbox == null || prevInbox == null) return false
  const inboxDelta = nextInbox - prevInbox
  if (inboxDelta < 20) return false
  const next = vaultRecordCount(name, incoming)
  const prev = vaultRecordCount(name, existing)
  if (next == null || prev == null) return false
  const extraTasks = next - prev
  return inboxDelta > extraTasks + 5
}

function shouldRejectVaultShrink(name, incoming, existing) {
  name = vaultId(name)
  if (shouldRejectInboxResurrection(name, incoming, existing)) return true
  if (!SHRINK_PROTECTED.has(name)) return false
  if (typeof existing !== "string" || typeof incoming !== "string") return false
  const next = vaultRecordCount(name, incoming)
  const prev = vaultRecordCount(name, existing)
  if (next == null || prev == null || prev === 0) return false
  // Nothing at all, over something: a seed profile or a dropped parse, never an
  // edit. Emptying a single-row vault by hand still goes through.
  if (next === 0 && prev >= 2) return true
  if (prev < minGuardedRecords(name)) return false
  if (next < prev && next <= prev * 0.5) return true
  // Byte-size backstop if JSON counts are missing but the blob is clearly a wipe.
  if (existing.length > 200000 && incoming.length <= existing.length * 0.5) return true
  return false
}

/**
 * Hub-write rule for append-only logs: the shared file only grows. A launch
 * POST of 173 tracking rows over 216 is 80% — nowhere near the shrink guard —
 * and the next profile to seed from the file inherits the loss.
 *
 * Deliberately *not* used when reading: a profile that deleted a block is
 * ahead, and handing it the fuller hub copy would put the block back every
 * launch. The app deletes freely; the shared file keeps the superset.
 */
function generatedBatch(entry) {
  const stamp = entry && entry.generatedBy
  if (!stamp || typeof stamp !== "object") return null
  if (typeof stamp.kind !== "string" || typeof stamp.id !== "string") return null
  return stamp.kind + "\0" + stamp.id
}

function unionEntryIds(a, b) {
  const out = []
  const seen = new Set()
  for (const id of [...(Array.isArray(a) ? a : []), ...(Array.isArray(b) ? b : [])]) {
    if (typeof id !== "string" || seen.has(id)) continue
    seen.add(id)
    out.push(id)
  }
  return out.length > 4000 ? out.slice(out.length - 4000) : out
}

/**
 * A hand-painted block is protected. A generated row (Screen Time, sleep) may
 * disappear only when the incoming snapshot refreshed that same batch — the
 * sync owns those ids. Anything else missing is a stale window, not an edit,
 * and the hub must refuse it. Count is the wrong test: a Screen Time replace
 * drops ids while a new manual block is in the same payload, the count falls
 * by one, and refusing the payload throws the block away.
 */
function timegridLosesProtectedEntry(incoming, existing) {
  const next = parseState(incoming)
  const prev = parseState(existing)
  if (!next || !prev || !Array.isArray(prev.entries)) return false
  const incEntries = Array.isArray(next.entries) ? next.entries : []
  const removed = new Set(Array.isArray(next.removedEntryIds) ? next.removedEntryIds : [])
  const refreshed = new Set()
  const incIds = new Set()
  for (let i = 0; i < incEntries.length; i++) {
    const entry = incEntries[i]
    if (!entry || typeof entry.id !== "string") continue
    incIds.add(entry.id)
    const batch = generatedBatch(entry)
    if (batch) refreshed.add(batch)
  }
  for (let i = 0; i < prev.entries.length; i++) {
    const entry = prev.entries[i]
    if (!entry || typeof entry.id !== "string") continue
    if (incIds.has(entry.id) || removed.has(entry.id)) continue
    const batch = generatedBatch(entry)
    if (batch && refreshed.has(batch)) continue
    return true
  }
  return false
}

function shouldRejectHubLogShrink(name, incoming, existing) {
  if (!isAppendOnlyVault(name)) return false
  if (typeof existing !== "string" || typeof incoming !== "string") return false
  if (vaultId(name) === "cogs-timegrid-store") return timegridLosesProtectedEntry(incoming, existing)
  const next = vaultRecordCount(name, incoming)
  const prev = vaultRecordCount(name, existing)
  if (next == null || prev == null) return false
  return next < prev
}

function cellStamp(cell) {
  const n = cell && cell.updatedAt
  return typeof n === "number" && Number.isFinite(n) ? n : 0
}

/** Keep every completion either side holds. The newer stamp wins a conflict. */
function mergeCompletionMaps(incomingMap, existingMap, incomingRev, existingRev) {
  const inc = incomingMap && typeof incomingMap === "object" && !Array.isArray(incomingMap) ? incomingMap : {}
  const ex = existingMap && typeof existingMap === "object" && !Array.isArray(existingMap) ? existingMap : {}
  const out = { ...ex }
  for (const bucketKey of Object.keys(inc)) {
    const cells = inc[bucketKey]
    if (!cells || typeof cells !== "object" || Array.isArray(cells)) continue
    const prevBucket = out[bucketKey] && typeof out[bucketKey] === "object" ? { ...out[bucketKey] } : {}
    for (const taskId of Object.keys(cells)) {
      const incomingCell = cells[taskId]
      const existingCell = prevBucket[taskId]
      if (!existingCell) {
        prevBucket[taskId] = incomingCell
        continue
      }
      const incAt = cellStamp(incomingCell)
      const exAt = cellStamp(existingCell)
      if (incAt !== exAt) prevBucket[taskId] = incAt > exAt ? incomingCell : existingCell
      else if (incAt === 0 && existingRev > incomingRev) prevBucket[taskId] = existingCell
      else prevBucket[taskId] = incomingCell
    }
    out[bucketKey] = prevBucket
  }
  return out
}

/**
 * Copy completion cells onto `chosen` from `other`. Titles stay with `chosen`
 * (contentRev already picked that snapshot). A cell the winner lacks is kept,
 * and a newer `updatedAt` beats a gem-stamp that bumped the snapshot rev
 * without touching the checklist.
 */
function overlayHabitCompletions(chosen, other, name) {
  if (vaultId(name) !== "cogs-habits-store") return chosen
  if (typeof chosen !== "string" || typeof other !== "string" || chosen === other) return chosen
  const chosenObj = parseJson(chosen)
  const otherObj = parseJson(other)
  if (!chosenObj || !otherObj) return chosen
  const chosenWrapped = chosenObj.state && typeof chosenObj.state === "object" && !Array.isArray(chosenObj.state)
  const otherWrapped = otherObj.state && typeof otherObj.state === "object" && !Array.isArray(otherObj.state)
  const chosenState = chosenWrapped ? chosenObj.state : chosenObj
  const otherState = otherWrapped ? otherObj.state : otherObj
  const chosenRev = contentRevOf(chosenState)
  const otherRev = contentRevOf(otherState)
  chosenState.weeklyData = mergeCompletionMaps(otherState.weeklyData, chosenState.weeklyData, otherRev, chosenRev)
  chosenState.weeklyHabitData = mergeCompletionMaps(
    otherState.weeklyHabitData,
    chosenState.weeklyHabitData,
    otherRev,
    chosenRev,
  )
  chosenState.monthlyHabitData = mergeCompletionMaps(
    otherState.monthlyHabitData,
    chosenState.monthlyHabitData,
    otherRev,
    chosenRev,
  )
  try {
    return JSON.stringify(chosenObj)
  } catch {
    return chosen
  }
}

function unionIngestEvents(incoming, existing) {
  const byId = new Map()
  const rows = [...(Array.isArray(existing) ? existing : []), ...(Array.isArray(incoming) ? incoming : [])]
  for (let i = 0; i < rows.length; i++) {
    const event = rows[i]
    if (!event || typeof event.id !== "string") continue
    byId.set(event.id, event)
  }
  return [...byId.values()]
    .sort((a, b) => String(b.at || "").localeCompare(String(a.at || "")))
    .slice(0, 200)
}

function isPlanTextVault(name) {
  if (typeof name !== "string") return false
  let bare = name
  if (bare.indexOf("brain2-demo-") === 0) bare = bare.slice("brain2-demo-".length)
  else if (bare.indexOf("brain2-") === 0) bare = bare.slice(7)
  else if (bare.indexOf("cogs-") === 0) bare = bare.slice(5)
  return /^(day|week|month)Plan-/.test(bare)
}

function rowStamp(row) {
  if (!row || typeof row !== "object") return 0
  const c = row.createdAt
  if (typeof c === "number" && Number.isFinite(c)) return c
  if (typeof c === "string") {
    const t = Date.parse(c)
    return Number.isFinite(t) ? t : 0
  }
  if (c instanceof Date) {
    const t = c.getTime()
    return Number.isFinite(t) ? t : 0
  }
  return 0
}

function preferTaskRow(incoming, existing) {
  // A row that already left Inbox beats a stale dump that still has it there.
  if (isActiveInboxTask(incoming) && !isActiveInboxTask(existing)) return existing
  if (isActiveInboxTask(existing) && !isActiveInboxTask(incoming)) return incoming
  const incAt = rowStamp(incoming)
  const exAt = rowStamp(existing)
  if (incAt !== exAt) return incAt > exAt ? incoming : existing
  return incoming
}

/** Keep every id either side holds. `prefer(incoming, existing)` resolves a clash.
 * Order follows `incoming`, then ids only `existing` has — so a read that already
 * picked the richer local snapshot does not reshuffle into hub order.
 */
function unionRowsById(incoming, existing, prefer) {
  const byId = new Map()
  const ex = Array.isArray(existing) ? existing : []
  const inc = Array.isArray(incoming) ? incoming : []
  for (let i = 0; i < ex.length; i++) {
    const row = ex[i]
    if (row && typeof row.id === "string") byId.set(row.id, row)
  }
  for (let i = 0; i < inc.length; i++) {
    const row = inc[i]
    if (!row || typeof row.id !== "string") continue
    const prev = byId.get(row.id)
    byId.set(row.id, prev ? prefer(row, prev) : row)
  }
  const out = []
  const seen = new Set()
  for (let i = 0; i < inc.length; i++) {
    const row = inc[i]
    if (!row || typeof row.id !== "string" || seen.has(row.id)) continue
    const kept = byId.get(row.id)
    if (!kept) continue
    seen.add(row.id)
    out.push(kept)
  }
  for (let i = 0; i < ex.length; i++) {
    const row = ex[i]
    if (!row || typeof row.id !== "string" || seen.has(row.id)) continue
    const kept = byId.get(row.id)
    if (!kept) continue
    seen.add(row.id)
    out.push(kept)
  }
  return out
}

function readPlanLog(raw) {
  const parsed = parseJson(raw)
  if (parsed && typeof parsed === "object" && !Array.isArray(parsed) && parsed.v === 1 && Array.isArray(parsed.entries)) {
    return {
      entries: parsed.entries.filter(
        (entry) => entry && typeof entry.id === "string" && typeof entry.text === "string",
      ),
      draft: typeof parsed.draft === "string" ? parsed.draft : "",
    }
  }
  if (Array.isArray(parsed)) {
    return {
      entries: parsed.filter((entry) => entry && typeof entry.id === "string" && typeof entry.text === "string"),
      draft: "",
    }
  }
  if (typeof raw === "string" && raw) {
    return { entries: [{ id: "legacy", createdAt: null, text: raw }], draft: "" }
  }
  return { entries: [], draft: "" }
}

function unionPlanTextSnapshots(incoming, existing) {
  const inc = readPlanLog(incoming)
  const ex = readPlanLog(existing)
  const entries = unionRowsById(inc.entries, ex.entries, (row) => row)
  const draft = inc.draft || ex.draft
  const out = { v: 1, entries }
  if (draft) out.draft = draft
  try {
    return JSON.stringify(out)
  } catch {
    return null
  }
}

/**
 * Fold two snapshots of the same vault so a stale writer cannot drop rows the
 * other one added. `incoming` wins an edit of a row both sides have, except
 * where a habit cell carries a newer `updatedAt`, or a Lists row already left
 * Inbox. Returns null when this vault is not unioned (the caller keeps its
 * old pick).
 */
function unionPersistSnapshots(incoming, existing, name) {
  if (typeof incoming !== "string" || typeof existing !== "string" || incoming === existing) return null
  if (isPlanTextVault(name)) return unionPlanTextSnapshots(incoming, existing)

  const id = vaultId(name)
  if (
    id !== "cogs-timegrid-store" &&
    id !== "cogs-ingest-store" &&
    id !== "cogs-task-storage" &&
    id !== "cogs-planned-actions"
  ) {
    return null
  }
  const incObj = parseJson(incoming)
  const exObj = parseJson(existing)
  if (!incObj || !exObj) return null
  const incWrapped = incObj.state && typeof incObj.state === "object" && !Array.isArray(incObj.state)
  const exWrapped = exObj.state && typeof exObj.state === "object" && !Array.isArray(exObj.state)
  const inc = incWrapped ? incObj.state : incObj
  const ex = exWrapped ? exObj.state : exObj

  if (id === "cogs-timegrid-store") {
    const incEntries = Array.isArray(inc.entries) ? inc.entries : []
    const exEntries = Array.isArray(ex.entries) ? ex.entries : []
    const removed = unionEntryIds(inc.removedEntryIds, ex.removedEntryIds)
    const removedSet = new Set(removed)
    const refreshed = new Set()
    for (let i = 0; i < incEntries.length; i++) {
      const batch = generatedBatch(incEntries[i])
      if (batch) refreshed.add(batch)
    }
    const byId = new Map()
    for (let i = 0; i < exEntries.length; i++) {
      const entry = exEntries[i]
      if (entry && typeof entry.id === "string") byId.set(entry.id, entry)
    }
    for (let i = 0; i < incEntries.length; i++) {
      const entry = incEntries[i]
      if (entry && typeof entry.id === "string") byId.set(entry.id, entry)
    }
    for (const [entryId, entry] of byId) {
      if (removedSet.has(entryId)) {
        byId.delete(entryId)
        continue
      }
      const batch = generatedBatch(entry)
      if (!batch || !refreshed.has(batch)) continue
      if (!incEntries.some((row) => row && row.id === entryId)) byId.delete(entryId)
    }
    inc.entries = [...byId.values()]
    inc.removedEntryIds = removed
  } else if (id === "cogs-ingest-store") {
    inc.events = unionIngestEvents(inc.events, ex.events)
  } else if (id === "cogs-task-storage") {
    // A seed / resurrection dump must not absorb the rich vault via union and
    // then look "whole" — shrink still needs to hand the stored copy back.
    if (shouldRejectVaultShrink(name, incoming, existing)) return null
    const removed = unionEntryIds(inc.removedTaskIds, ex.removedTaskIds)
    const removedSet = new Set(removed)
    inc.tasks = unionRowsById(inc.tasks, ex.tasks, preferTaskRow).filter(
      (row) => row && typeof row.id === "string" && !removedSet.has(row.id),
    )
    const removedLists = unionEntryIds(inc.removedListIds, ex.removedListIds)
    const removedListSet = new Set(removedLists)
    // Do not invent empty lists/folders arrays — that reshapes a tasks-only
    // blob and breaks identity with the snapshot we already chose.
    if (Array.isArray(inc.lists) || Array.isArray(ex.lists)) {
      inc.lists = unionRowsById(inc.lists, ex.lists, (row) => row).filter(
        (row) => row && typeof row.id === "string" && !removedListSet.has(row.id),
      )
    }
    if (Array.isArray(inc.folders) || Array.isArray(ex.folders)) {
      inc.folders = unionRowsById(inc.folders, ex.folders, (row) => row)
    }
    if (removed.length > 0 || Array.isArray(inc.removedTaskIds) || Array.isArray(ex.removedTaskIds)) {
      inc.removedTaskIds = removed
    } else {
      delete inc.removedTaskIds
    }
    if (
      removedLists.length > 0 ||
      Array.isArray(inc.removedListIds) ||
      Array.isArray(ex.removedListIds)
    ) {
      inc.removedListIds = removedLists
    } else {
      delete inc.removedListIds
    }
  } else if (id === "cogs-planned-actions") {
    inc.actions = unionRowsById(inc.actions, ex.actions, (row) => row)
  }

  try {
    const out = JSON.stringify(incObj)
    return out === incoming ? null : out
  } catch {
    return null
  }
}

function overlayClarifiedTasks(chosen, local, name) {
  if (vaultId(name) !== "cogs-task-storage") return chosen
  if (typeof chosen !== "string" || typeof local !== "string" || chosen === local) return chosen
  const chosenObj = parseJson(chosen)
  const localObj = parseJson(local)
  if (!chosenObj || !localObj) return chosen
  const chosenState =
    chosenObj.state && typeof chosenObj.state === "object" && !Array.isArray(chosenObj.state)
      ? chosenObj.state
      : chosenObj
  const localState =
    localObj.state && typeof localObj.state === "object" && !Array.isArray(localObj.state)
      ? localObj.state
      : localObj
  if (!Array.isArray(chosenState.tasks) || !Array.isArray(localState.tasks)) return chosen
  const localById = new Map()
  for (let i = 0; i < localState.tasks.length; i++) {
    const row = localState.tasks[i]
    if (row && typeof row.id === "string") localById.set(row.id, row)
  }
  let changed = false
  const nextTasks = chosenState.tasks.map((row) => {
    if (!row || typeof row.id !== "string") return row
    const mine = localById.get(row.id)
    if (!mine) return row
    if (isActiveInboxTask(row) && !isActiveInboxTask(mine)) {
      changed = true
      return mine
    }
    return row
  })
  if (!changed) return chosen
  chosenState.tasks = nextTasks
  try {
    return JSON.stringify(chosenObj)
  } catch {
    return chosen
  }
}

function isDefinedPref(value) {
  return value !== undefined && value !== null
}

function prefEqual(a, b) {
  if (typeof a === "string" && typeof b === "string") return a.trim().toLowerCase() === b.trim().toLowerCase()
  return a === b
}

function appearanceRevOf(state) {
  const n = state && state.appearanceRev
  return typeof n === "number" && Number.isFinite(n) && n > 0 ? n : 0
}

function contentRevOf(state) {
  const n = state && state.contentRev
  return typeof n === "number" && Number.isFinite(n) && n > 0 ? n : 0
}

function contentRevOfBlob(value) {
  return contentRevOf(parseState(value))
}

/**
 * A habits write whose `contentRev` is behind the copy already stored.
 * Titles, details, and completion values live in that blob; record counts
 * stay the same when the user renames a habit or types a cell, so the shrink
 * guard never sees the loss.
 */
function shouldRejectContentDowngrade(name, incoming, existing) {
  if (vaultId(name) !== "cogs-habits-store") return false
  if (typeof incoming !== "string" || typeof existing !== "string") return false
  return contentRevOfBlob(existing) > contentRevOfBlob(incoming)
}

/** Overlay a local pick when the chosen blob lacks it, or when local is not the seed default. */
function shouldTakeLocalPref(key, localVal, chosenVal, localWinsRev) {
  if (localWinsRev) {
    if (localVal === undefined) return false
    return !prefEqual(localVal, chosenVal)
  }
  if (!isDefinedPref(localVal)) return false
  if (!isDefinedPref(chosenVal)) return true
  const def = PREF_DEFAULTS[key]
  if (def !== undefined && prefEqual(localVal, def)) return false
  return !prefEqual(localVal, chosenVal)
}

/**
 * Copy defined local appearance onto the chosen snapshot. Hub-missing keys
 * (and hub seed defaults written after hydrate) must not replace a present
 * local pick. Seed-default local values do not clobber a customized hub.
 * A higher local `appearanceRev` always wins, including an explicit reset
 * back to seed hues / ceramic.
 */
function overlayLocalUserPrefs(chosen, local, name) {
  if (typeof chosen !== "string" || typeof local !== "string" || chosen === local) return chosen
  const keys = name ? USER_PREF_KEYS[vaultId(name)] : null
  if (!keys) return chosen
  const chosenObj = parseJson(chosen)
  const localObj = parseJson(local)
  if (!chosenObj || !localObj) return chosen
  const chosenState =
    chosenObj.state && typeof chosenObj.state === "object" && !Array.isArray(chosenObj.state)
      ? chosenObj.state
      : chosenObj
  const localState =
    localObj.state && typeof localObj.state === "object" && !Array.isArray(localObj.state)
      ? localObj.state
      : localObj
  const chosenRev = appearanceRevOf(chosenState)
  const localRev = appearanceRevOf(localState)
  // A newer incoming pick (Electron POST of a plate / LED hue) must not be
  // painted over with the previous hub snapshot. `localWinsRev` still copies
  // this profile onto a *stale* dump.
  if (chosenRev > localRev) return chosen
  const localWinsRev = localRev > chosenRev
  let changed = false
  for (const key of keys) {
    if (!Object.prototype.hasOwnProperty.call(localState, key)) continue
    const lv = localState[key]
    if (!localWinsRev && !isDefinedPref(lv)) continue
    if (key === "colors" && lv && typeof lv === "object" && !Array.isArray(lv)) {
      const cv =
        chosenState.colors && typeof chosenState.colors === "object" && !Array.isArray(chosenState.colors)
          ? { ...chosenState.colors }
          : {}
      for (const [ck, cvv] of Object.entries(lv)) {
        if (!isDefinedPref(cvv) || cvv === "") continue
        const chosenColor = cv[ck]
        const colorDefault = DEFAULT_THEME_COLORS[ck]
        const localIsDefault = colorDefault !== undefined && prefEqual(cvv, colorDefault)
        if (!localWinsRev && isDefinedPref(chosenColor) && localIsDefault) continue
        if (!isDefinedPref(chosenColor) || !prefEqual(chosenColor, cvv)) {
          cv[ck] = cvv
          changed = true
        }
      }
      chosenState.colors = cv
      continue
    }
    if (!shouldTakeLocalPref(key, lv, chosenState[key], localWinsRev)) continue
    if (chosenState[key] !== lv) {
      chosenState[key] = lv
      changed = true
    }
  }
  if (localWinsRev && appearanceRevOf(chosenState) !== localRev) {
    chosenState.appearanceRev = localRev
    changed = true
  }
  if (!changed) return chosen
  try {
    return JSON.stringify(chosenObj)
  } catch {
    return chosen
  }
}

function allowlistRevOf(state) {
  const n = Number(state && state.allowlistRev)
  return Number.isFinite(n) && n > 0 ? n : 0
}

function allowedChatRows(state) {
  if (!state || !Array.isArray(state.allowedChats)) return []
  const out = []
  for (let i = 0; i < state.allowedChats.length; i++) {
    const row = state.allowedChats[i]
    if (!row || typeof row !== "object") continue
    const chatId = row.chatId != null ? String(row.chatId) : ""
    if (!chatId) continue
    const userId = row.userId != null && String(row.userId) !== "" ? String(row.userId) : undefined
    out.push({
      chatId,
      userId,
      username: typeof row.username === "string" ? row.username : undefined,
      pairedAt: typeof row.pairedAt === "string" ? row.pairedAt : "",
    })
  }
  return out
}

function revokedChatIdsOf(state) {
  if (!state || !Array.isArray(state.revokedChatIds)) return []
  const out = []
  for (let i = 0; i < state.revokedChatIds.length; i++) {
    const id = state.revokedChatIds[i]
    if (id == null || String(id) === "") continue
    out.push(String(id))
  }
  return out
}

/**
 * Union paired chats. Tombstones win. The higher allowlistRev is kept.
 * `primary` supplies overlapping row fields; `extra` still contributes chats
 * the primary forgot (a pre-hydration seed, or a second window).
 */
function mergeIngestAllowlistFields(primary, extra) {
  const revoked = new Set([...revokedChatIdsOf(primary), ...revokedChatIdsOf(extra)])
  const byId = new Map()
  const rows = [...allowedChatRows(extra), ...allowedChatRows(primary)]
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i]
    if (revoked.has(row.chatId)) continue
    if (row.userId && revoked.has(row.userId)) continue
    const prev = byId.get(row.chatId)
    if (!prev) {
      byId.set(row.chatId, row)
      continue
    }
    byId.set(row.chatId, {
      chatId: row.chatId,
      userId: row.userId || prev.userId,
      username: row.username || prev.username,
      pairedAt: row.pairedAt > prev.pairedAt ? row.pairedAt : prev.pairedAt,
    })
  }
  return {
    allowedChats: [...byId.values()],
    revokedChatIds: [...revoked],
    allowlistRev: Math.max(allowlistRevOf(primary), allowlistRevOf(extra)),
  }
}

/**
 * True when `incoming` must not replace `existing` for Message ingest.
 * Zustand persist writes seed defaults before rehydrate finishes; that empty
 * allowlist was unpairing Telegram at random, whenever the poll tick won the
 * race against hydration.
 */
function shouldRejectIngestDowngrade(name, incoming, existing) {
  if (vaultId(name) !== "cogs-ingest-store") return false
  if (typeof incoming !== "string" || typeof existing !== "string") return false
  const next = parseState(incoming)
  const prev = parseState(existing)
  if (!next || !prev) return false
  if (allowlistRevOf(next) < allowlistRevOf(prev)) return true
  const prevChats = allowedChatRows(prev).length
  const nextChats = allowedChatRows(next).length
  const nextEvents = arrayLen(next.events) ?? 0
  const prevEvents = arrayLen(prev.events) ?? 0
  const nextRevoked = revokedChatIdsOf(next).length
  const nextShortcuts =
    next.shortcuts && typeof next.shortcuts === "object" && !Array.isArray(next.shortcuts)
      ? Object.keys(next.shortcuts).length
      : 0
  const seed = nextChats === 0 && nextRevoked === 0 && nextEvents === 0 && nextShortcuts === 0
  if (!seed || allowlistRevOf(next) > allowlistRevOf(prev)) return false
  return prevChats > 0 || prevEvents > 0
}

/** Keep every paired chat that neither side has revoked. */
function overlayIngestAllowlist(chosen, other, name) {
  if (vaultId(name) !== "cogs-ingest-store") return chosen
  if (typeof chosen !== "string") return chosen
  if (typeof other !== "string" || other === chosen) return chosen
  const chosenObj = parseJson(chosen)
  const otherObj = parseJson(other)
  if (!chosenObj || !otherObj) return chosen
  const chosenState =
    chosenObj.state && typeof chosenObj.state === "object" && !Array.isArray(chosenObj.state)
      ? chosenObj.state
      : chosenObj
  const otherState =
    otherObj.state && typeof otherObj.state === "object" && !Array.isArray(otherObj.state)
      ? otherObj.state
      : otherObj
  const merged = mergeIngestAllowlistFields(chosenState, otherState)
  const prevIds = allowedChatRows(chosenState)
    .map((row) => row.chatId)
    .sort()
    .join("\n")
  const nextIds = merged.allowedChats
    .map((row) => row.chatId)
    .sort()
    .join("\n")
  const prevRevoked = revokedChatIdsOf(chosenState).slice().sort().join("\n")
  const nextRevoked = merged.revokedChatIds.slice().sort().join("\n")
  if (prevIds === nextIds && prevRevoked === nextRevoked && allowlistRevOf(chosenState) === merged.allowlistRev) {
    return chosen
  }
  chosenState.allowedChats = merged.allowedChats
  chosenState.revokedChatIds = merged.revokedChatIds
  chosenState.allowlistRev = merged.allowlistRev
  try {
    return JSON.stringify(chosenObj)
  } catch {
    return chosen
  }
}

/** Empty string is a tombstone, not a vault. Plan month keys were stored as "". */
function presentPersistValue(value) {
  return typeof value === "string" && value !== "" ? value : null
}

/**
 * Local wins once this profile has a snapshot, unless that snapshot is a seed
 * wipe compared with the hub. Missing local still takes the hub. When the hub
 * vault wins, local color / PCB / chrome prefs still overlay if they are defined.
 */
function pickPersistItem(local, hubValue, name) {
  const hub = presentPersistValue(typeof hubValue === "string" ? hubValue : null)
  local = presentPersistValue(typeof local === "string" ? local : null)
  // Day notes are a tiny map. A hub with more historical days is not "richer
  // vault of entries" — treating it that way wiped today's jot on Electron
  // refresh (1 local key vs N hub keys). Once this profile has the key, it
  // is the source of truth; missing local still seeds from the hub.
  if (vaultId(name) === "cogs-tracking-day-notes") {
    if (typeof local === "string") return local
    return hub
  }
  const united = typeof local === "string" && hub && name ? unionPersistSnapshots(local, hub, name) : null
  if (typeof united === "string") local = united
  let chosen = null
  if (typeof local === "string" && hub && name && shouldRejectContentDowngrade(name, local, hub)) {
    // This profile's copy is an older habit snapshot than the hub.
    chosen = shouldRejectVaultShrink(name, hub, local) ? local : hub
  } else if (typeof local === "string" && hub && name && shouldRejectContentDowngrade(name, hub, local)) {
    // Hub is older. Keep this profile unless it is a seed wipe of the hub.
    chosen = shouldRejectVaultShrink(name, local, hub) ? hub : local
  } else if (typeof local === "string" && hub && name && shouldRejectVaultShrink(name, local, hub)) {
    chosen = hub
  } else if (typeof local === "string") {
    chosen = local
  } else {
    chosen = hub
  }
  if (vaultId(name) === "cogs-ingest-store" && typeof local === "string" && hub && typeof chosen === "string") {
    const other = chosen === local ? hub : local
    if (shouldRejectIngestDowngrade(name, chosen, other)) chosen = other
  }
  const otherSnap = typeof local === "string" && hub ? (chosen === local ? hub : local) : null
  return overlayHabitCompletions(
    overlayIngestAllowlist(
    overlayLocalFriendDismissals(
    overlayLocalTrackingNotes(
      applyAppearancePins(
        overlayLocalUserPrefs(overlayClarifiedTasks(chosen, local, name), local, name),
        name,
      ),
      local,
      name,
    ),
    local,
    name,
  ),
    otherSnap,
    name,
  ),
    otherSnap,
    name,
  )
}

/**
 * Hub PUT/POST merge: take the incoming snapshot as the edit, but keep this
 * profile's Inbox clarifications and plate / hue picks when the dump is stale.
 * Friend-pic data URLs never belong in the hub file (they blow Chromium quota).
 */
function mergePersistSnapshots(existing, incoming, name) {
  if (typeof name === "string" && name.indexOf("friend-pic:") >= 0) {
    return presentPersistValue(typeof existing === "string" ? existing : null)
  }
  let inc = presentPersistValue(typeof incoming === "string" ? incoming : null)
  const cur = presentPersistValue(typeof existing === "string" ? existing : null)
  if (!inc) return cur
  if (!cur) return inc
  if (cur === inc) return inc
  const united = unionPersistSnapshots(inc, cur, name)
  if (typeof united === "string") inc = united
  if (shouldRejectContentDowngrade(name, inc, cur)) return overlayHabitCompletions(cur, inc, name)
  if (shouldRejectVaultShrink(name, inc, cur)) return overlayHabitCompletions(cur, inc, name)
  if (shouldRejectIngestDowngrade(name, inc, cur)) return cur
  return overlayHabitCompletions(
    overlayIngestAllowlist(
    overlayLocalFriendDismissals(
      overlayLocalTrackingNotes(
        applyAppearancePins(
          overlayLocalUserPrefs(overlayClarifiedTasks(inc, cur, name), cur, name),
          name,
        ),
        cur,
        name,
      ),
      cur,
      name,
    ),
    cur,
    name,
  ),
    cur,
    name,
  )
}

function readDedicatedDayNotes() {
  try {
    if (typeof localStorage === "undefined") return null
    const raw = localStorage.getItem("brain2-tracking-day-notes") || localStorage.getItem("cogs-tracking-day-notes")
    if (!raw) return null
    const parsed = JSON.parse(raw)
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return null
    return parsed
  } catch {
    return null
  }
}

/**
 * Day notes / untracked-gap notes are not entry counts. A richer hub vault
 * must not wipe this profile's scratch pad when Electron seeds from Chrome.
 * The dedicated `cogs-tracking-day-notes` map is the jot that survives even
 * when the timegrid blob itself was rewritten without `dayNotes`.
 */
function overlayLocalTrackingNotes(chosen, local, name) {
  if (vaultId(name) !== "cogs-timegrid-store") return chosen
  if (typeof chosen !== "string") return chosen
  const dedicated = readDedicatedDayNotes()
  const hasLocal = typeof local === "string"
  if ((!hasLocal || chosen === local) && !dedicated) return chosen
  const chosenObj = parseJson(chosen)
  if (!chosenObj) return chosen
  const localObj = hasLocal ? parseJson(local) : null
  const chosenState =
    chosenObj.state && typeof chosenObj.state === "object" && !Array.isArray(chosenObj.state)
      ? chosenObj.state
      : chosenObj
  const localState =
    localObj && localObj.state && typeof localObj.state === "object" && !Array.isArray(localObj.state)
      ? localObj.state
      : localObj && typeof localObj === "object"
        ? localObj
        : {}
  let changed = false
  function mergeMap(field, extra) {
    const fromLocal = localState[field]
    const fromChosen =
      chosenState[field] && typeof chosenState[field] === "object" && !Array.isArray(chosenState[field])
        ? { ...chosenState[field] }
        : {}
    let fieldChanged = false
    function take(source) {
      if (!source || typeof source !== "object" || Array.isArray(source)) return
      for (const key of Object.keys(source)) {
        const val = source[key]
        if (typeof val !== "string" || !val) continue
        if (fromChosen[key] !== val) {
          fromChosen[key] = val
          fieldChanged = true
        }
      }
    }
    take(fromLocal)
    take(extra)
    if (fieldChanged) {
      chosenState[field] = fromChosen
      changed = true
    }
  }
  mergeMap("dayNotes", dedicated)
  mergeMap("untrackedNotes")
  if (!changed) return chosen
  try {
    return JSON.stringify(chosenObj)
  } catch {
    return chosen
  }
}

function slugFriendId(name) {
  const slug = String(name || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48)
  return slug && slug !== "friend" ? slug : ""
}

const FRIEND_CATALOG_IDS = new Set([
  "crow",
  "otter",
  "hedgehog",
  "fox",
  "owl",
  "seal",
  "duckling",
  "lamb",
  "fawn",
  "chick",
  "puppy",
  "bunny",
  "kitten",
  "piglet",
  "penguin",
  "capybara",
  "raccoon",
  "mouse",
  "goat",
  "axolotl",
  "cub",
  "foal",
  "gosling",
  "wolf",
  "skunk",
])

function isPackFriend(photo) {
  return (
    photo &&
    (photo.via === "pack" ||
      String(photo.id || "").indexOf("pack-") === 0 ||
      String(photo.animalId || "").indexOf("pack-") === 0)
  )
}

function friendIdentityKeys(animalId, displayName) {
  const animal = String(animalId || "").trim().toLowerCase()
  if (!animal) return []
  if (animal.indexOf("pack-") === 0) return [animal]
  const nameSlug = slugFriendId(displayName)
  return [...new Set([animal, nameSlug].filter(Boolean))]
}

function photoDismissKeys(photo) {
  if (!photo || typeof photo !== "object") return []
  const keys = [photo.id, photo.animalId, photo.sourceUrl]
  if (!isPackFriend(photo)) keys.push(slugFriendId(photo.displayName))
  return unionIdList(keys)
}

function mergeSameFriendCard(preferred, other) {
  const preferName = String(preferred.displayName || "").trim()
  return {
    ...other,
    ...preferred,
    id: preferred.id,
    animalId: preferred.animalId || other.animalId,
    displayName: preferName ? preferred.displayName : other.displayName || "",
    uri: preferred.uri || other.uri,
    sourceUrl: preferred.sourceUrl || other.sourceUrl,
    via: preferred.via || other.via,
    namedAt: preferName ? preferred.namedAt : other.namedAt,
  }
}

function reconcileFriendPhotos(preferred, other, dismissed, urls) {
  const byId = new Map()
  function add(photo) {
    if (!photo || !photo.id || photoIsDismissed(photo, dismissed, urls)) return
    const prev = byId.get(photo.id)
    byId.set(photo.id, prev ? mergeSameFriendCard(prev, photo) : photo)
  }
  ;(Array.isArray(preferred) ? preferred : []).forEach(add)
  ;(Array.isArray(other) ? other : []).forEach(add)
  return Array.from(byId.values())
}

function unionIdList() {
  const seen = new Set()
  const out = []
  for (let i = 0; i < arguments.length; i++) {
    const group = arguments[i]
    if (!Array.isArray(group)) continue
    for (const id of group) {
      const key = typeof id === "string" ? id.trim().toLowerCase() : ""
      if (!key || seen.has(key)) continue
      seen.add(key)
      out.push(key)
    }
  }
  return out
}

function readDismissedFriendPin() {
  const raw = readLocalPin("brain2-friend-dismissed")
  if (!raw) return []
  try {
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? unionIdList(parsed) : []
  } catch {
    return []
  }
}

function writeDismissedFriendPin(ids) {
  writeLocalPin("brain2-friend-dismissed", JSON.stringify(unionIdList(ids)))
}

function photoIsDismissed(photo, dismissed, urls) {
  if (!photo || typeof photo !== "object") return false
  const keys = photoDismissKeys(photo)
  if (dismissed.some((id) => keys.indexOf(id) >= 0)) return true
  const url = typeof photo.sourceUrl === "string" ? photo.sourceUrl.trim().toLowerCase() : ""
  return Boolean(url) && Array.isArray(urls) && urls.indexOf(url) >= 0
}

function scrubFalseCatalogDismissals(photos, dismissed) {
  const present = new Set()
  const packBorrowed = new Set()
  ;(Array.isArray(photos) ? photos : []).forEach((photo) => {
    if (!photo) return
    if (isPackFriend(photo)) {
      String(photo.displayName || "")
        .toLowerCase()
        .split(/[^a-z0-9]+/)
        .forEach((token) => {
          if (FRIEND_CATALOG_IDS.has(token)) packBorrowed.add(token)
        })
      return
    }
    const id = String(photo.animalId || "").trim().toLowerCase()
    if (FRIEND_CATALOG_IDS.has(id)) present.add(id)
  })
  return dismissed.filter((id) => !(FRIEND_CATALOG_IDS.has(id) && present.has(id) && packBorrowed.has(id)))
}

/**
 * Removed friends stay gone. Union dismissals from the chosen blob, this
 * profile, and the dedicated pin, then strip matching photos. Never shrink
 * the pin (Gallery reset is the only explicit clear).
 */
function overlayLocalFriendDismissals(chosen, local, name) {
  if (vaultId(name) !== "cogs-baby-animals-store") return chosen
  if (typeof chosen !== "string") return chosen
  const chosenObj = parseJson(chosen)
  if (!chosenObj) return chosen
  const localObj = typeof local === "string" ? parseJson(local) : null
  const chosenState =
    chosenObj.state && typeof chosenObj.state === "object" && !Array.isArray(chosenObj.state)
      ? chosenObj.state
      : chosenObj
  const localState =
    localObj && localObj.state && typeof localObj.state === "object" && !Array.isArray(localObj.state)
      ? localObj.state
      : localObj && typeof localObj === "object"
        ? localObj
        : {}
  const pin = readDismissedFriendPin()
  const combinedPhotos = [].concat(
    Array.isArray(localState.photos) ? localState.photos : [],
    Array.isArray(chosenState.photos) ? chosenState.photos : [],
  )
  const dismissed = scrubFalseCatalogDismissals(
    combinedPhotos,
    unionIdList(chosenState.dismissedAnimalIds, localState.dismissedAnimalIds, pin),
  )
  const urls = unionIdList(chosenState.dismissedSourceUrls, localState.dismissedSourceUrls)
  const photos = reconcileFriendPhotos(localState.photos, chosenState.photos, dismissed, urls)
  const localCurrent = photos.find((photo) => photo && photo.id === localState.currentPhotoId)
  const chosenCurrent = photos.find((photo) => photo && photo.id === chosenState.currentPhotoId)
  const worn = localCurrent || chosenCurrent || photos[photos.length - 1]
  let changed = false
  if (dismissed.length !== unionIdList(chosenState.dismissedAnimalIds).length) {
    chosenState.dismissedAnimalIds = dismissed
    changed = true
  }
  if (urls.length !== unionIdList(chosenState.dismissedSourceUrls).length) {
    chosenState.dismissedSourceUrls = urls
    changed = true
  }
  const prevPhotos = Array.isArray(chosenState.photos) ? chosenState.photos : []
  if (JSON.stringify(prevPhotos) !== JSON.stringify(photos)) {
    chosenState.photos = photos
    changed = true
  }
  if (worn) {
    if (chosenState.currentPhotoId !== worn.id || chosenState.displayName !== worn.displayName || chosenState.animalId !== worn.animalId) {
      chosenState.currentPhotoId = worn.id
      chosenState.animalId = worn.animalId
      chosenState.displayName = worn.displayName || ""
      changed = true
    }
  } else if (chosenState.currentPhotoId) {
    chosenState.currentPhotoId = null
    chosenState.displayName = ""
    changed = true
  }
  if (pin.length !== dismissed.length) {
    writeDismissedFriendPin(dismissed)
    changed = true
  }
  if (!changed) return chosen
  try {
    return JSON.stringify(chosenObj)
  } catch {
    return chosen
  }
}

const PCB_MODES = ["teal", "ceramic", "mint", "ice", "xray", "fr4"]

function readLocalPin(key) {
  try {
    if (typeof localStorage === "undefined") return null
    for (const alias of pinAliases(key)) {
      const value = localStorage.getItem(alias)
      if (value != null) return value
    }
    return null
  } catch {
    return null
  }
}

function writeLocalPin(key, value) {
  try {
    if (typeof localStorage === "undefined") return
    for (const alias of pinAliases(key)) localStorage.setItem(alias, value)
  } catch {
    /* pin is best-effort */
  }
}

/**
 * Copy plate / hue fields from a blob the user just saved onto the tiny pins.
 * Skip seed defaults at appearanceRev 0 so first paint cannot pin instrument green
 * over a vault that still has a custom hex.
 */
function stampAppearancePins(blob, name) {
  if (typeof blob !== "string") return
  const obj = parseJson(blob)
  if (!obj) return
  const state =
    obj.state && typeof obj.state === "object" && !Array.isArray(obj.state) ? obj.state : obj
  const rev = appearanceRevOf(state)
  function stampHex(storageKey, raw, def) {
    if (typeof raw !== "string") return
    const hex = raw.trim().toLowerCase()
    if (!/^#[0-9a-f]{6}$/.test(hex)) return
    if (hex === def && !(rev > 0)) return
    writeLocalPin(storageKey, hex)
  }
  if (vaultId(name) === "cogs-habits-store") {
    stampHex("brain2-habit-led-tint", state.percentLedTint, "#7e14ff")
    stampHex("brain2-habit-grade-tube", state.gradeTubeColor, "#508b51")
    stampHex("brain2-habit-output-tube", state.outputGradeTubeColor, "#25366a")
  }
  if (vaultId(name) === "cogs-theme-store") {
    const mode = state.pcbMode
    if (typeof mode === "string" && PCB_MODES.indexOf(mode) >= 0) {
      if (mode !== "teal" || rev > 0) writeLocalPin("brain2-pcb-mode", mode)
    }
  }
  if (vaultId(name) === "cogs-baby-animals-store") {
    writeDismissedFriendPin(unionIdList(state.dismissedAnimalIds, readDismissedFriendPin()))
  }
}

/**
 * Dedicated pins survive a richer hub vault replacing a *seed* blob.
 * A blob with appearanceRev > 0 is the user's last pick — stamp pins from it
 * instead of painting a stale pin back over the plate / hues (Electron preload
 * was rewriting localStorage that way on every launch).
 */
function applyAppearancePins(blob, name) {
  if (typeof blob !== "string") return blob
  const obj = parseJson(blob)
  if (!obj) return blob
  const state =
    obj.state && typeof obj.state === "object" && !Array.isArray(obj.state) ? obj.state : obj
  if (appearanceRevOf(state) > 0) {
    stampAppearancePins(blob, name)
    return blob
  }
  let changed = false
  function pinHex(storageKey, field) {
    const raw = readLocalPin(storageKey)
    if (typeof raw !== "string") return
    const hex = raw.trim().toLowerCase()
    if (!/^#[0-9a-f]{6}$/.test(hex)) return
    if (state[field] !== hex) {
      state[field] = hex
      changed = true
    }
  }
  if (vaultId(name) === "cogs-habits-store") {
    pinHex("brain2-habit-led-tint", "percentLedTint")
    pinHex("brain2-habit-grade-tube", "gradeTubeColor")
    pinHex("brain2-habit-output-tube", "outputGradeTubeColor")
  }
  if (vaultId(name) === "cogs-theme-store") {
    const pin = readLocalPin("brain2-pcb-mode")
    if (typeof pin === "string" && PCB_MODES.indexOf(pin) >= 0 && state.pcbMode !== pin) {
      state.pcbMode = pin
      changed = true
    }
  }
  if (!changed) return blob
  try {
    return JSON.stringify(obj)
  } catch {
    return blob
  }
}

/**
 * Refuse a persist write that would roll plate / hue picks backward.
 * Zustand can stringify seed defaults before rehydrate finishes; that must
 * not replace a saved PCB plate or LED tint on refresh.
 */
function shouldRejectAppearanceDowngrade(name, incoming, existing) {
  name = vaultId(name)
  if (typeof incoming !== "string" || typeof existing !== "string") return false
  if (!name || !USER_PREF_KEYS[name]) return false
  const next = parseState(incoming)
  const prev = parseState(existing)
  if (!next || !prev) return false
  const nextRev = appearanceRevOf(next)
  const prevRev = appearanceRevOf(prev)
  if (name === "cogs-theme-store") {
    if (prevRev > nextRev) return true
    const prevMode = typeof prev.pcbMode === "string" ? prev.pcbMode : null
    const nextMode = typeof next.pcbMode === "string" ? next.pcbMode : null
    if (prevMode && nextMode !== prevMode && nextRev <= prevRev) {
      if (nextMode === "teal") return true
      if (nextMode === "ceramic" && prevMode !== "ceramic") return true
    }
  }
  if (name === "cogs-habits-store") {
    const keys = USER_PREF_KEYS[name]
    for (const key of keys) {
      const def = PREF_DEFAULTS[key]
      if (def === undefined) continue
      const pv = prev[key]
      const nv = next[key]
      if (typeof pv === "string" && !prefEqual(pv, def) && (nv == null || prefEqual(nv, def)) && nextRev <= prevRev) {
        return true
      }
    }
  }
  return false
}

module.exports = {
  SHRINK_PROTECTED,
  USER_PREF_KEYS,
  VAULT_RECORD_FIELDS,
  MIN_GUARDED_RECORDS,
  isAppendOnlyVault,
  shouldRejectHubLogShrink,
  unionPersistSnapshots,
  vaultRecordCount,
  inboxRecordCount,
  shouldRejectVaultShrink,
  overlayHabitCompletions,
  overlayLocalUserPrefs,
  overlayLocalTrackingNotes,
  overlayLocalFriendDismissals,
  appearanceRevOf,
  contentRevOf,
  shouldRejectContentDowngrade,
  shouldRejectAppearanceDowngrade,
  applyAppearancePins,
  stampAppearancePins,
  shouldSkipHubAppearanceCopy,
  pickPersistItem,
  mergePersistSnapshots,
  presentPersistValue,
  shouldRejectIngestDowngrade,
  overlayIngestAllowlist,
  mergeIngestAllowlistFields,
}
