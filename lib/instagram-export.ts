/**
 * lib/instagram-export.ts — Parse an Instagram “Followers and following” download
 *
 * Pure. No store, no network. The official export is JSON (often inside a zip
 * this app does not open) under connections/followers_and_following/:
 * following.json uses `relationships_following`, and followers_1.json (plus
 * followers_2.json …) uses `relationships_followers` or, in some downloads, a
 * top-level array. Each row’s username is `string_list_data[].value`, or the
 * instagram.com href when value is empty. `title` is a display name when it
 * is non-empty and is often blank. Follower counts are not in that download.
 *
 * Follow-back is the intersection of the two sets in this import, not a guess.
 * A side that was not loaded stays unset so a missing file does not stamp
 * false on everyone. Rows absent from a file are not deleted; an export can
 * be split across followers_1.json, followers_2.json, and so on.
 */
export const IG_USERNAME = "ig-username"
export const IG_FOLLOWER_COUNT = "ig-follower-count"
export const IG_FOLLOWS_ME_BACK = "ig-follows-me-back"
export const IG_I_FOLLOW_BACK = "ig-i-follow-back"

export interface IgPerson {
  username: string
  /** Set only when the export title is non-empty. */
  name?: string
  /** Set only when the record actually included a count. */
  followerCount?: number
}

export interface ParsedInstagramExport {
  following: Map<string, IgPerson>
  followers: Map<string, IgPerson>
  /** True when a following file or `relationships_following` was in this import. */
  includedFollowing: boolean
  /** True when a followers file or `relationships_followers` was in this import. */
  includedFollowers: boolean
  notes: string[]
}

export interface InstagramExportFile {
  name: string
  text: string
}

export interface IgExisting {
  id: string
  name: string
  lists: string[]
  username?: string
  followerCount?: number
}

export interface IgChange {
  id?: string
  create: boolean
  name: string
  lists: string[]
  username: string
  followerCount?: number
  writeFollowerCount: boolean
  followsMeBack?: boolean
  writeFollowsMeBack: boolean
  iFollowBack?: boolean
  writeIFollowBack: boolean
}

const SKIP_PATH = new Set([
  "explore",
  "accounts",
  "about",
  "legal",
  "developer",
  "directory",
  "reels",
  "reel",
  "stories",
  "p",
  "direct",
  "tv",
  "emails",
  "privacy",
  "www",
])

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value)
}

export function usernameFromHref(href: string): string | undefined {
  const match = /instagram\.com\/(?:_u\/)?([A-Za-z0-9._]+)/i.exec(href.trim())
  if (!match) return undefined
  return acceptUsername(match[1])
}

export function cleanUsername(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined
  const raw = value.trim().replace(/^@+/, "")
  if (!raw) return undefined
  if (/instagram\.com/i.test(raw)) return usernameFromHref(raw)
  return acceptUsername(raw)
}

function acceptUsername(value: string): string | undefined {
  const name = value.replace(/\.+$/, "")
  if (!/^[A-Za-z0-9._]{1,30}$/.test(name)) return undefined
  if (SKIP_PATH.has(name.toLowerCase())) return undefined
  return name
}

function asCount(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value) && value >= 0) return value
  if (typeof value === "string" && /^\d+$/.test(value.trim())) return Number(value.trim())
  return undefined
}

function readCount(rec: Record<string, unknown>): number | undefined {
  for (const key of ["follower_count", "followers_count", "followerCount", "followersCount"]) {
    const count = asCount(rec[key])
    if (count !== undefined) return count
  }
  const edge = rec.edge_followed_by
  if (isRecord(edge)) return asCount(edge.count)
  return undefined
}

function displayName(title: unknown): string | undefined {
  if (typeof title !== "string") return undefined
  const trimmed = title.trim()
  return trimmed ? trimmed : undefined
}

function usernameFromStringList(rec: Record<string, unknown>): string | undefined {
  const list = rec.string_list_data
  if (!Array.isArray(list)) return undefined
  for (const row of list) {
    if (!isRecord(row)) continue
    const fromValue = cleanUsername(row.value)
    if (fromValue) return fromValue
    if (typeof row.href === "string") {
      const fromHref = usernameFromHref(row.href)
      if (fromHref) return fromHref
    }
  }
  return undefined
}

function usernameFromLabelValues(rec: Record<string, unknown>): string | undefined {
  const rows = rec.label_values
  if (!Array.isArray(rows)) return undefined
  let fallback: string | undefined
  for (const row of rows) {
    if (!isRecord(row)) continue
    const label = typeof row.label === "string" ? row.label.toLowerCase() : ""
    const fromValue = cleanUsername(row.value)
    const fromHref = typeof row.href === "string" ? usernameFromHref(row.href) : undefined
    const candidate = fromValue ?? fromHref
    if (!candidate) continue
    if (label.includes("user") || label.includes("profile")) return candidate
    fallback ??= candidate
  }
  return fallback
}

function personFromRecord(rec: Record<string, unknown>): IgPerson | undefined {
  const username =
    usernameFromStringList(rec) ??
    usernameFromLabelValues(rec) ??
    cleanUsername(rec.username) ??
    (typeof rec.href === "string" ? usernameFromHref(rec.href) : undefined)
  if (!username) return undefined
  const name = displayName(rec.title)
  const followerCount = readCount(rec)
  return {
    username,
    ...(name ? { name } : {}),
    ...(followerCount !== undefined ? { followerCount } : {}),
  }
}

function isRelationship(rec: Record<string, unknown>): boolean {
  return Array.isArray(rec.string_list_data) || Array.isArray(rec.label_values)
}

type Side = "following" | "followers"

function roleFromName(name: string): Side | "unknown" {
  const base = name.split(/[/\\]/).pop()?.toLowerCase() ?? ""
  if (/^following\b/.test(base)) return "following"
  if (/^followers?(?:[_\s.-]|$)/.test(base)) return "followers"
  return "unknown"
}

function preferName(current: string | undefined, incoming: string | undefined, username: string): string | undefined {
  const choices = [incoming, current].filter((value): value is string => !!value && value.trim() !== "")
  const display = choices.find((value) => value.toLowerCase() !== username.toLowerCase())
  return display ?? choices[0]
}

function putPerson(map: Map<string, IgPerson>, person: IgPerson): void {
  const key = person.username.toLowerCase()
  const prev = map.get(key)
  if (!prev) {
    map.set(key, person)
    return
  }
  const name = preferName(prev.name, person.name, person.username)
  const followerCount = person.followerCount ?? prev.followerCount
  map.set(key, {
    username: person.username || prev.username,
    ...(name ? { name } : {}),
    ...(followerCount !== undefined ? { followerCount } : {}),
  })
}

function addRecord(rec: Record<string, unknown>, side: Side, parsed: ParsedInstagramExport): void {
  const person = personFromRecord(rec)
  if (!person) return
  putPerson(side === "following" ? parsed.following : parsed.followers, person)
}

function absorb(value: unknown, role: Side | "unknown", parsed: ParsedInstagramExport): void {
  if (Array.isArray(value)) {
    if (value.length === 0) {
      if (role === "following") parsed.includedFollowing = true
      if (role === "followers") parsed.includedFollowers = true
      return
    }
    const records = value.filter(isRecord)
    if (records.length === value.length && records.every(isRelationship) && role !== "unknown") {
      if (role === "following") parsed.includedFollowing = true
      if (role === "followers") parsed.includedFollowers = true
      for (const rec of records) addRecord(rec, role, parsed)
      return
    }
    for (const item of value) absorb(item, role, parsed)
    return
  }
  if (!isRecord(value)) return
  let wrapped = false
  if (Array.isArray(value.relationships_following)) {
    wrapped = true
    parsed.includedFollowing = true
    for (const rec of value.relationships_following) {
      if (isRecord(rec)) addRecord(rec, "following", parsed)
    }
  }
  if (Array.isArray(value.relationships_followers)) {
    wrapped = true
    parsed.includedFollowers = true
    for (const rec of value.relationships_followers) {
      if (isRecord(rec)) addRecord(rec, "followers", parsed)
    }
  }
  if (wrapped) return
  if (role !== "unknown" && isRelationship(value)) {
    if (role === "following") parsed.includedFollowing = true
    if (role === "followers") parsed.includedFollowers = true
    addRecord(value, role, parsed)
  }
}

function stripTags(value: string): string {
  return value
    .replace(/<[^>]+>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/\s+/g, " ")
    .trim()
}

function absorbHtml(html: string, role: Side | "unknown", parsed: ParsedInstagramExport): void {
  let side = role
  if (side === "unknown") {
    const head = html.slice(0, 5000).toLowerCase()
    const followers = head.includes("followers")
    const following = head.includes("following")
    if (followers && !following) side = "followers"
    else if (following && !followers) side = "following"
    else return
  }
  const re = /<h2\b[^>]*>([\s\S]*?)<\/h2>|<a\b[^>]*\bhref\s*=\s*["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi
  let lastHeading = ""
  let found = 0
  for (let match = re.exec(html); match; match = re.exec(html)) {
    if (match[1] != null) {
      lastHeading = stripTags(match[1])
      continue
    }
    const username = usernameFromHref(match[2] ?? "") ?? cleanUsername(stripTags(match[3] ?? ""))
    if (!username) continue
    const heading = lastHeading.trim()
    const name = heading && heading.toLowerCase() !== username.toLowerCase() ? heading : undefined
    putPerson(side === "following" ? parsed.following : parsed.followers, {
      username,
      ...(name ? { name } : {}),
    })
    found += 1
    lastHeading = ""
  }
  if (found > 0) {
    if (side === "following") parsed.includedFollowing = true
    if (side === "followers") parsed.includedFollowers = true
  }
}

function looksLikeHtml(text: string): boolean {
  return /<(?:html|a|div|h2)\b/i.test(text)
}

export function parseInstagramExport(files: InstagramExportFile[]): ParsedInstagramExport {
  const parsed: ParsedInstagramExport = {
    following: new Map(),
    followers: new Map(),
    includedFollowing: false,
    includedFollowers: false,
    notes: [],
  }
  for (const file of files) {
    const name = file.name || "download"
    if (name.toLowerCase().endsWith(".zip")) {
      parsed.notes.push("Unzip the download and choose the JSON or HTML inside. This app does not read the zip.")
      continue
    }
    const text = file.text.replace(/^\uFEFF/, "").trim()
    if (!text) continue
    const role = roleFromName(name)
    if (looksLikeHtml(text) && !text.startsWith("{") && !text.startsWith("[")) {
      absorbHtml(text, role, parsed)
      continue
    }
    try {
      absorb(JSON.parse(text) as unknown, role, parsed)
    } catch {
      if (looksLikeHtml(text)) absorbHtml(text, role, parsed)
      else parsed.notes.push(`${name} is not Instagram JSON or HTML.`)
    }
  }
  return parsed
}

function existingKey(item: IgExisting, followingListId: string, followersListId: string): string | undefined {
  const fromUsername = cleanUsername(item.username)
  if (fromUsername) return fromUsername.toLowerCase()
  const onList = item.lists.includes(followingListId) || item.lists.includes(followersListId)
  if (!onList) return undefined
  return cleanUsername(item.name)?.toLowerCase()
}

/**
 * Plan creates and updates. Never a delete. Booleans are written only for the
 * side that was actually in this import, and only on the list that shows them.
 */
export function planInstagramImport(
  existing: IgExisting[],
  parsed: ParsedInstagramExport,
  ids: { followingListId: string; followersListId: string },
): IgChange[] {
  const byKey = new Map<string, IgExisting>()
  for (const item of existing) {
    const key = existingKey(item, ids.followingListId, ids.followersListId)
    if (!key || byKey.has(key)) continue
    byKey.set(key, item)
  }

  const keys = new Set<string>()
  if (parsed.includedFollowing) {
    for (const key of parsed.following.keys()) keys.add(key)
    for (const item of existing) {
      if (!item.lists.includes(ids.followersListId)) continue
      const key = existingKey(item, ids.followingListId, ids.followersListId)
      if (key) keys.add(key)
    }
  }
  if (parsed.includedFollowers) {
    for (const key of parsed.followers.keys()) keys.add(key)
    for (const item of existing) {
      if (!item.lists.includes(ids.followingListId)) continue
      const key = existingKey(item, ids.followingListId, ids.followersListId)
      if (key) keys.add(key)
    }
  }

  const changes: IgChange[] = []
  for (const key of keys) {
    const prev = byKey.get(key)
    const following = parsed.following.get(key)
    const followers = parsed.followers.get(key)
    const inFollowing = parsed.includedFollowing && parsed.following.has(key)
    const inFollowers = parsed.includedFollowers && parsed.followers.has(key)
    const lists = prev ? [...prev.lists] : []
    if (inFollowing && !lists.includes(ids.followingListId)) lists.push(ids.followingListId)
    if (inFollowers && !lists.includes(ids.followersListId)) lists.push(ids.followersListId)
    if (!prev && lists.length === 0) continue

    const onFollowing = lists.includes(ids.followingListId)
    const onFollowers = lists.includes(ids.followersListId)
    const username = following?.username ?? followers?.username ?? prev?.username ?? key
    const importedName = preferName(following?.name, followers?.name, username)
    const name = importedName ?? prev?.name ?? username
    const importedCount = following?.followerCount ?? followers?.followerCount
    const writeFollowsMeBack = parsed.includedFollowers && onFollowing
    const writeIFollowBack = parsed.includedFollowing && onFollowers

    changes.push({
      id: prev?.id,
      create: !prev,
      name,
      lists,
      username,
      ...(importedCount !== undefined ? { followerCount: importedCount } : {}),
      writeFollowerCount: importedCount !== undefined,
      ...(writeFollowsMeBack ? { followsMeBack: parsed.followers.has(key) } : {}),
      writeFollowsMeBack,
      ...(writeIFollowBack ? { iFollowBack: parsed.following.has(key) } : {}),
      writeIFollowBack,
    })
  }
  return changes
}
