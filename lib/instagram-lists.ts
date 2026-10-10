/**
 * lib/instagram-lists.ts — Built-in Instagram following and followers lists
 *
 * Created once the vault has hydrated (`hooks/use-instagram-lists.ts`).
 * Rename keeps each flag. Delete is refused. A list already named
 * “People I follow on Instagram” or “People who follow me on Instagram”
 * is adopted instead of a second copy.
 *
 * One Instagram account is one item. `Task.lists` can include both list ids.
 * The match key is the username, case-insensitive. Follows me back is true
 * only when a followers import contains that username, and false only when a
 * followers import is present and the username is absent. I follow them back
 * is the same rule with the following import. A missing side stays unset.
 * A typed follower count stays when the file has no count. Rows missing from
 * a partial file stay.
 *
 * The settings download is what fills the lists. Instagram Login does not
 * return this list for a personal account, and this module does not ask for
 * a password or call Instagram. Settings → Import from Instagram data and
 * the file control on these two lists both call `importInstagramExportTexts`.
 */
import { createListItem, itemTitle } from "@/lib/item-utils"
import {
  IG_FOLLOWER_COUNT,
  IG_FOLLOWS_ME_BACK,
  IG_I_FOLLOW_BACK,
  IG_USERNAME,
  parseInstagramExport,
  planInstagramImport,
  type IgChange,
  type IgExisting,
  type InstagramExportFile,
  type ParsedInstagramExport,
} from "@/lib/instagram-export"
import { useTaskStore } from "@/lib/task-store"
import type { AttributeDefinition, AttributeValue, List, Task } from "@/lib/types"

export const INSTAGRAM_FOLLOWING_LIST_ID = "people-i-follow-on-instagram"
export const INSTAGRAM_FOLLOWING_LIST_NAME = "People I follow on Instagram"
export const INSTAGRAM_FOLLOWERS_LIST_ID = "people-who-follow-me-on-instagram"
export const INSTAGRAM_FOLLOWERS_LIST_NAME = "People who follow me on Instagram"

export const IG_FOLLOWING_COLUMNS = [IG_USERNAME, IG_FOLLOWER_COUNT, IG_FOLLOWS_ME_BACK] as const
export const IG_FOLLOWERS_COLUMNS = [IG_USERNAME, IG_FOLLOWER_COUNT, IG_I_FOLLOW_BACK] as const

const USERNAME_ATTR: AttributeDefinition = { id: IG_USERNAME, name: "Username", type: "string" }
const COUNT_ATTR: AttributeDefinition = {
  id: IG_FOLLOWER_COUNT,
  name: "Follower count",
  type: "number",
}
const FOLLOWS_ME_ATTR: AttributeDefinition = {
  id: IG_FOLLOWS_ME_BACK,
  name: "Follows me back",
  type: "boolean",
}
const I_FOLLOW_ATTR: AttributeDefinition = {
  id: IG_I_FOLLOW_BACK,
  name: "I follow them back",
  type: "boolean",
}

function sameName(name: string | undefined, wanted: string): boolean {
  return (name ?? "").trim().toLowerCase() === wanted.toLowerCase()
}

export function findInstagramFollowingList(lists: List[]): List | undefined {
  return (
    lists.find((list) => list.id === INSTAGRAM_FOLLOWING_LIST_ID) ??
    lists.find((list) => list.instagramFollowingList) ??
    lists.find((list) => sameName(list.name, INSTAGRAM_FOLLOWING_LIST_NAME))
  )
}

export function findInstagramFollowersList(lists: List[]): List | undefined {
  return (
    lists.find((list) => list.id === INSTAGRAM_FOLLOWERS_LIST_ID) ??
    lists.find((list) => list.instagramFollowersList) ??
    lists.find((list) => sameName(list.name, INSTAGRAM_FOLLOWERS_LIST_NAME))
  )
}

export function isInstagramFollowingList(
  list: { id: string; instagramFollowingList?: boolean } | null | undefined,
): boolean {
  if (!list) return false
  return list.id === INSTAGRAM_FOLLOWING_LIST_ID || list.instagramFollowingList === true
}

export function isInstagramFollowersList(
  list: { id: string; instagramFollowersList?: boolean } | null | undefined,
): boolean {
  if (!list) return false
  return list.id === INSTAGRAM_FOLLOWERS_LIST_ID || list.instagramFollowersList === true
}

export function isInstagramPeopleList(
  list: { id: string; instagramFollowingList?: boolean; instagramFollowersList?: boolean } | null | undefined,
): boolean {
  return isInstagramFollowingList(list) || isInstagramFollowersList(list)
}

function withColumns(list: List, defs: AttributeDefinition[], columnIds: readonly string[]): Partial<List> {
  const patch: Partial<List> = {}
  const attrs = list.itemAttributes ?? []
  const missing = defs.filter((def) => !attrs.some((attr) => attr.id === def.id))
  if (missing.length) patch.itemAttributes = [...attrs, ...missing]
  const displayed = list.displayedAttributes
  if (!displayed?.length) patch.displayedAttributes = [...columnIds]
  else {
    const extra = columnIds.filter((id) => !displayed.includes(id))
    if (extra.length) patch.displayedAttributes = [...displayed, ...extra]
  }
  const current = list.sheetConfig?.columnIds
  const nextIds = !current?.length
    ? [...columnIds]
    : [...current, ...columnIds.filter((id) => !current.includes(id))]
  if (!current || nextIds.length !== current.length) {
    patch.sheetConfig = { ...list.sheetConfig, columnIds: nextIds }
  }
  return patch
}

function ensureSingleton(opts: {
  id: string
  name: string
  color: string
  description: string
  flag: "instagramFollowingList" | "instagramFollowersList"
  find: (lists: List[]) => List | undefined
  defs: AttributeDefinition[]
  columns: readonly string[]
}): string {
  const store = useTaskStore.getState()
  const existing = opts.find(store.lists)
  if (existing) {
    if (!existing[opts.flag]) {
      store.updateList({
        ...existing,
        [opts.flag]: true,
        scheduleable: false,
        itemLabel: existing.itemLabel || "account",
        ...withColumns(existing, opts.defs, opts.columns),
      })
    }
    return existing.id
  }
  store.addList({
    id: opts.id,
    name: opts.name,
    color: opts.color,
    createdAt: new Date(),
    itemLabel: "account",
    scheduleable: false,
    [opts.flag]: true,
    description: opts.description,
    itemAttributes: opts.defs,
    displayedAttributes: [...opts.columns],
    sheetConfig: { columnIds: [...opts.columns] },
  })
  return opts.id
}

/** Create or adopt People I follow on Instagram. Rename keeps the flag. */
export function ensureInstagramFollowingList(): string {
  return ensureSingleton({
    id: INSTAGRAM_FOLLOWING_LIST_ID,
    name: INSTAGRAM_FOLLOWING_LIST_NAME,
    color: "#9f1239",
    description:
      "Accounts you follow on Instagram. Username, follower count, and whether they follow you back. Filled from Instagram’s download of your information. The same account is one item if they also follow you.",
    flag: "instagramFollowingList",
    find: findInstagramFollowingList,
    defs: [USERNAME_ATTR, COUNT_ATTR, FOLLOWS_ME_ATTR],
    columns: IG_FOLLOWING_COLUMNS,
  })
}

/** Create or adopt People who follow me on Instagram. Rename keeps the flag. */
export function ensureInstagramFollowersList(): string {
  return ensureSingleton({
    id: INSTAGRAM_FOLLOWERS_LIST_ID,
    name: INSTAGRAM_FOLLOWERS_LIST_NAME,
    color: "#155e75",
    description:
      "Accounts that follow you on Instagram. Username, follower count, and whether you follow them back. The same account is one item if you also follow them.",
    flag: "instagramFollowersList",
    find: findInstagramFollowersList,
    defs: [USERNAME_ATTR, COUNT_ATTR, I_FOLLOW_ATTR],
    columns: IG_FOLLOWERS_COLUMNS,
  })
}

function snapshot(task: Task): IgExisting {
  const attributes = task.attributes ?? {}
  const username = attributes[IG_USERNAME]
  const count = attributes[IG_FOLLOWER_COUNT]
  return {
    id: task.id,
    name: itemTitle(task),
    lists: [...(task.lists ?? [])],
    ...(typeof username === "string" ? { username } : {}),
    ...(typeof count === "number" ? { followerCount: count } : {}),
  }
}

function attributesFromChange(
  change: IgChange,
  previous: Record<string, AttributeValue> | undefined,
): Record<string, AttributeValue> {
  const attributes: Record<string, AttributeValue> = { ...(previous ?? {}) }
  attributes[IG_USERNAME] = change.username
  if (change.writeFollowerCount && change.followerCount !== undefined) {
    attributes[IG_FOLLOWER_COUNT] = change.followerCount
  }
  if (change.writeFollowsMeBack && change.followsMeBack !== undefined) {
    attributes[IG_FOLLOWS_ME_BACK] = change.followsMeBack
  }
  if (change.writeIFollowBack && change.iFollowBack !== undefined) {
    attributes[IG_I_FOLLOW_BACK] = change.iFollowBack
  }
  return attributes
}

function withDisplayName(task: Task, name: string): Task {
  const previous = itemTitle(task)
  const description = typeof task.description === "string" ? task.description.trim() : ""
  const mirror =
    description === "" ||
    description === previous ||
    description.toLowerCase() === String(task.attributes?.[IG_USERNAME] ?? "").toLowerCase()
  return mirror ? { ...task, title: name, description: name } : { ...task, title: name }
}

/**
 * Update matching usernames and add new ones onto one or both lists.
 * Does not delete rows the file left out, and does not clear a follower
 * count the file did not include.
 */
export function applyInstagramImport(parsed: ParsedInstagramExport): { added: number; updated: number } {
  const followingListId = ensureInstagramFollowingList()
  const followersListId = ensureInstagramFollowersList()
  const store = useTaskStore.getState()
  const changes = planInstagramImport(
    store.tasks.map(snapshot),
    parsed,
    { followingListId, followersListId },
  )
  let added = 0
  let updated = 0
  for (const change of changes) {
    if (change.create) {
      const item = createListItem(change.name, change.lists)
      useTaskStore.getState().addTask({
        ...item,
        attributes: attributesFromChange(change, undefined),
      })
      added += 1
      continue
    }
    const current = useTaskStore.getState().tasks.find((task) => task.id === change.id)
    if (!current) continue
    let next: Task = {
      ...current,
      lists: change.lists,
      attributes: attributesFromChange(change, current.attributes),
    }
    if (change.name && change.name !== itemTitle(current)) next = withDisplayName(next, change.name)
    useTaskStore.getState().updateTask(next)
    updated += 1
  }
  return { added, updated }
}

export interface InstagramImportReport {
  ok: boolean
  message: string
  followingRows: number
  followerRows: number
  added: number
  updated: number
}

const UNZIP_FIRST =
  "Unzip the download, then choose the JSON or HTML inside. This app does not read the zip."

const NO_LIST =
  "No followers or following list was in that file. Choose following.json and the followers JSON from the download."

function rowCount(count: number, kind: "following" | "follower"): string {
  const noun = kind === "following" ? "following" : "follower"
  return `${count} ${noun} ${count === 1 ? "row" : "rows"}`
}

/** Sentence for a finished import: extracted rows, added, updated, and a blank side. */
export function describeInstagramImportResult(input: {
  followingRows: number
  followerRows: number
  includedFollowing: boolean
  includedFollowers: boolean
  added: number
  updated: number
  skippedZip?: boolean
}): string {
  const parts = [
    `Extracted ${rowCount(input.followingRows, "following")} and ${rowCount(input.followerRows, "follower")}.`,
    `Added ${input.added}.`,
    `Updated ${input.updated}.`,
  ]
  if (!input.includedFollowers) {
    parts.push("Follows me back stays blank until a followers file is included.")
  }
  if (!input.includedFollowing) {
    parts.push("I follow them back stays blank until a following file is included.")
  }
  if (input.skippedZip) parts.push("The zip was skipped. The JSON and HTML were read.")
  return parts.join(" ")
}

/** Skip reading a zip. The parser still sees the name and refuses it. */
export async function readInstagramFiles(
  files: ReadonlyArray<{ name: string; text: () => Promise<string> }>,
): Promise<InstagramExportFile[]> {
  return Promise.all(
    files.map(async (file) => ({
      name: file.name,
      text: file.name.toLowerCase().endsWith(".zip") ? "" : await file.text(),
    })),
  )
}

/**
 * Parse already-read export files and write them onto the two built-in lists.
 * Ensures both lists first, with the same helpers the hydrate hooks use.
 * A zip alone is refused. A partial file does not delete rows that were absent.
 */
export function importInstagramExportTexts(files: InstagramExportFile[]): InstagramImportReport {
  const empty: InstagramImportReport = {
    ok: false,
    message: NO_LIST,
    followingRows: 0,
    followerRows: 0,
    added: 0,
    updated: 0,
  }
  if (files.length === 0) return empty
  const zipOnly = files.every((file) => file.name.toLowerCase().endsWith(".zip"))
  if (zipOnly) return { ...empty, message: UNZIP_FIRST }
  const parsed = parseInstagramExport(files)
  if (!parsed.includedFollowing && !parsed.includedFollowers) {
    return { ...empty, message: parsed.notes[0] ?? NO_LIST }
  }
  ensureInstagramFollowingList()
  ensureInstagramFollowersList()
  const result = applyInstagramImport(parsed)
  const skippedZip = files.some((file) => file.name.toLowerCase().endsWith(".zip"))
  return {
    ok: true,
    message: describeInstagramImportResult({
      followingRows: parsed.following.size,
      followerRows: parsed.followers.size,
      includedFollowing: parsed.includedFollowing,
      includedFollowers: parsed.includedFollowers,
      added: result.added,
      updated: result.updated,
      skippedZip,
    }),
    followingRows: parsed.following.size,
    followerRows: parsed.followers.size,
    added: result.added,
    updated: result.updated,
  }
}
