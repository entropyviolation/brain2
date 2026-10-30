/**
 * lib/phone-hub-view.mjs — The hub snapshot that fits on a phone.
 *
 * The hub file keeps the full desktop copy. A phone's web storage is about
 * 5 MB, separate from free space on the device, so this view drops photos,
 * docs, plan text, item attributes, and time-grid rows older than a week.
 * Each item keeps a short name as its description, plus when it was created,
 * so a later save on the phone still passes the item check.
 * `full` is the desktop copy. Shared by the sync server and the iOS app so a
 * Force pull cannot write the full task vault into that box. Lists and folders
 * are the short form (name, color, parent). Folder icons stay on the Mac.
 */

/** Phone web storage is about 5 MB, separate from free space on the device. */
export const PHONE_PULL_BUDGET = 2_500_000

const PHONE_STORE_KEYS = new Set([
  "brain2-task-storage",
  "cogs-task-storage",
  "brain2-timegrid-store",
  "cogs-timegrid-store",
  "brain2-habits-store",
  "cogs-habits-store",
  "brain2-event-storage",
  "cogs-event-storage",
  "brain2-goals-store",
  "cogs-goals-store",
  "brain2-user-settings",
  "cogs-user-settings",
  "brain2-theme-store",
  "cogs-theme-store",
  "brain2-tracking-day-notes",
  "cogs-tracking-day-notes",
  "brain2-sleep-store",
  "cogs-sleep-store",
])

function byteLength(value) {
  return new TextEncoder().encode(JSON.stringify(value)).length
}

function daysBefore(now, days) {
  const date = new Date(now.getTime())
  date.setDate(date.getDate() - days)
  const pad = (n) => String(n).padStart(2, "0")
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

function phoneTitle(task) {
  const title = typeof task.title === "string" ? task.title.trim() : ""
  const description = typeof task.description === "string" ? task.description.trim() : ""
  const name = title || description
  return name.length > 120 ? name.slice(0, 120) : name
}

function slimTask(task) {
  if (!task || typeof task !== "object" || Array.isArray(task)) return task
  const name = phoneTitle(task)
  const next = { id: task.id, title: name, description: name, completed: task.completed === true }
  if (Array.isArray(task.lists) && task.lists.length > 0) next.lists = task.lists
  if (typeof task.stage === "string" && task.stage) next.stage = task.stage
  if (typeof task.type === "string" && task.type) next.type = task.type
  if (typeof task.scheduledDate === "string" && task.scheduledDate) next.scheduledDate = task.scheduledDate
  if (typeof task.deadline === "string" && task.deadline) next.deadline = task.deadline
  if (typeof task.createdAt === "string" || typeof task.createdAt === "number") next.createdAt = task.createdAt
  return next
}

function slimList(list) {
  if (!list || typeof list !== "object" || Array.isArray(list)) return list
  const next = { id: list.id }
  if (typeof list.name === "string") next.name = list.name
  if (typeof list.parentListId === "string" && list.parentListId) next.parentListId = list.parentListId
  if (typeof list.color === "string" && list.color) next.color = list.color
  return next
}

function slimFolder(folder) {
  if (!folder || typeof folder !== "object" || Array.isArray(folder)) return folder
  const next = { id: folder.id }
  if (typeof folder.name === "string") next.name = folder.name
  if (Array.isArray(folder.listIds)) next.listIds = folder.listIds
  if (typeof folder.parentFolderId === "string" && folder.parentFolderId) next.parentFolderId = folder.parentFolderId
  if (typeof folder.order === "number") next.order = folder.order
  if (typeof folder.color === "string" && folder.color && !folder.color.startsWith("data:")) next.color = folder.color
  return next
}

function slimTaskStore(store) {
  const state = store?.state
  if (!state || !Array.isArray(state.tasks)) return store
  const nextState = { ...state, tasks: state.tasks.map(slimTask) }
  if (Array.isArray(state.lists)) nextState.lists = state.lists.map(slimList)
  if (Array.isArray(state.folders)) nextState.folders = state.folders.map(slimFolder)
  return { ...store, state: nextState }
}

function slimEntry(entry) {
  if (!entry || typeof entry !== "object" || Array.isArray(entry)) return entry
  const next = {}
  for (const [key, value] of Object.entries(entry)) {
    if (key === "notes" || key === "generatedBy") continue
    next[key] = value
  }
  return next
}

function slimTimegridStore(store, sinceDay) {
  const state = store?.state
  if (!state || !Array.isArray(state.entries)) return store
  const entries = []
  for (const entry of state.entries) {
    const day = typeof entry?.date === "string" ? entry.date.slice(0, 10) : ""
    if (sinceDay && day < sinceDay) continue
    entries.push(slimEntry(entry))
  }
  return { ...store, state: { ...state, entries } }
}

/**
 * One vault as the phone stores it. Task rows keep a name and list ids.
 * The time grid keeps about a week. Desktop files are unchanged.
 * @param {string} name
 * @param {Date} [now]
 */
export function slimStoredVault(name, store, now = new Date()) {
  if (typeof name !== "string") return store
  if (name.endsWith("task-storage")) return slimTaskStore(store)
  if (name.endsWith("timegrid-store")) return slimTimegridStore(store, daysBefore(now, 7))
  return store
}

/**
 * `?full=1` is the desktop copy. An iPhone still gets the phone view: the
 * installed app asks for the full snapshot, and that task vault does not fit
 * in the phone's web-storage box.
 * @param {string} [url]
 * @param {string} [userAgent]
 */
export function requestWantsFullPull(url, userAgent = "") {
  try {
    const parsed = new URL(url || "/", "http://127.0.0.1")
    if (parsed.searchParams.get("full") !== "1") return false
    return !/iPhone|iPad|iPod/i.test(userAgent)
  } catch {
    return false
  }
}

/**
 * The phone pull. The hub file keeps the full snapshot.
 * `full` is the desktop copy.
 * @param {Date} [now]
 */
export function pullBackupView(backup, full, now = new Date()) {
  if (!backup || full) return backup
  const view = { ...backup }
  delete view.attachments
  delete view.docs
  delete view.extras
  view.planText = {}
  if (!view.stores || typeof view.stores !== "object" || Array.isArray(view.stores)) return view
  const since = daysBefore(now, 7)
  const stores = {}
  for (const [key, store] of Object.entries(view.stores)) {
    if (!PHONE_STORE_KEYS.has(key)) continue
    if (key.endsWith("task-storage")) stores[key] = slimTaskStore(store)
    else if (key.endsWith("timegrid-store")) stores[key] = slimTimegridStore(store, since)
    else stores[key] = store
  }
  view.stores = stores
  if (byteLength(view) > PHONE_PULL_BUDGET) {
    for (const key of Object.keys(stores)) {
      if (key.endsWith("timegrid-store")) delete stores[key]
    }
  }
  return view
}
