/**
 * lib/instagram-analysis.ts — Read the Instagram analysis summary into list rows
 *
 * Pure. No store, no network. The input is `out/summary.json` from the
 * person's `instagram-analysis/analyze.py`. That script reads the whole
 * Instagram download, so its follower and following lists are complete, and
 * `people` holds what the person did toward each account.
 *
 * The report's Network lists (followers, following, mutuals, I follow / no
 * follow-back, follow me / I don't, pending requests, blocked) become Brain2
 * lists with the same columns. Column names match the report's table, list
 * by list. A count of zero is left blank instead of stored, to save room in
 * the vault. Dates are the UTC day, as the report shows them.
 *
 * Follower counts per account are not in the export, so this file never
 * writes `ig-follower-count`. A count already on an item stays.
 */
import { IG_FOLLOWS_ME_BACK, IG_I_FOLLOW_BACK, IG_USERNAME } from "@/lib/instagram-export"
import type { AttributeDefinition, AttributeValue } from "@/lib/types"

/** The seven people lists in the report's Network section, in its order. */
export const IG_ANALYSIS_LIST_KEYS = [
  "followers",
  "following",
  "mutuals",
  "nofb",
  "fans",
  "pending",
  "blocked",
] as const
export type IgAnalysisListKey = (typeof IG_ANALYSIS_LIST_KEYS)[number]

export const IG_DISPLAY_NAME = "ig-display-name"
export const IG_FLAGS = "ig-flags"
export const IG_I_FOLLOWED = "ig-i-followed"
export const IG_FOLLOWED_ME = "ig-followed-me"
export const IG_REQUESTED = "ig-requested"
export const IG_BLOCKED = "ig-blocked"
export const IG_INTERACTIONS = "ig-interactions"
export const IG_LAST_ENGAGED = "ig-last-engaged"
export const IG_PROFILE = "ig-profile"

/** Report key → attribute id, for the per-account activity counts (report `ACT`). */
export const IG_ACTIVITY = [
  { key: "lk", id: "ig-liked-posts", name: "Liked posts" },
  { key: "sl", id: "ig-story-likes", name: "Story likes" },
  { key: "sv", id: "ig-saved-posts", name: "Saved posts" },
  { key: "cm", id: "ig-comments", name: "Comments" },
  { key: "lc", id: "ig-liked-their-comments", name: "Liked their comments" },
  { key: "st", id: "ig-story-stickers", name: "Story stickers" },
  { key: "dm", id: "ig-dms-sent", name: "DMs sent" },
  { key: "dmt", id: "ig-dms-got", name: "DMs got" },
  { key: "vw", id: "ig-viewed", name: "Reels/stories viewed" },
] as const

/** Keys the report adds into All my interactions (report `MINE`). */
const MINE = ["lk", "sl", "sv", "cm", "lc", "st", "dm"] as const

const DATE_IDS = { fo: IG_I_FOLLOWED, fr: IG_FOLLOWED_ME, rq: IG_REQUESTED, bk: IG_BLOCKED } as const
type DateKey = keyof typeof DATE_IDS

/** Report `FLAGS`: shown beside the username. */
const FLAG_LABELS = {
  cf: "close friend",
  rs: "restricted",
  hs: "story hidden",
  uf: "unfollowed recently",
} as const

/**
 * Attributes this import owns. A later run rewrites or clears each of them,
 * because summary.json is a whole snapshot. Username, follower count and a
 * person's own columns are not in this set.
 */
export const IG_ANALYSIS_OWNED: readonly string[] = [
  IG_DISPLAY_NAME,
  IG_FLAGS,
  IG_I_FOLLOWED,
  IG_FOLLOWED_ME,
  IG_REQUESTED,
  IG_BLOCKED,
  IG_INTERACTIONS,
  ...IG_ACTIVITY.map((a) => a.id),
  IG_LAST_ENGAGED,
  IG_PROFILE,
]

interface ListSpec {
  name: string
  color: string
  description: string
  /** The report's date columns for this list: [report key, column name]. */
  dates: ReadonlyArray<readonly [DateKey, string]>
}

/** Names, and the report's date columns per list (report `LISTS`). */
export const IG_ANALYSIS_LISTS: Record<IgAnalysisListKey, ListSpec> = {
  followers: {
    name: "People who follow me on Instagram",
    color: "#155e75",
    description: "",
    dates: [["fr", "Followed me"], ["fo", "I follow back since"]],
  },
  following: {
    name: "People I follow on Instagram",
    color: "#9f1239",
    description: "",
    dates: [["fo", "I followed"], ["fr", "Follows me since"]],
  },
  mutuals: {
    name: "Instagram mutuals",
    color: "#6d28d9",
    description: "Accounts I follow that also follow me. From the Instagram analysis.",
    dates: [["fo", "I followed"], ["fr", "They followed me"]],
  },
  nofb: {
    name: "I follow on Instagram, no follow-back",
    color: "#b45309",
    description: "Accounts I follow that do not follow me. From the Instagram analysis.",
    dates: [["fo", "I followed"]],
  },
  fans: {
    name: "Follow me on Instagram, I don't",
    color: "#0e7490",
    description: "Accounts that follow me that I do not follow. From the Instagram analysis.",
    dates: [["fr", "Followed me"]],
  },
  pending: {
    name: "Instagram pending requests",
    color: "#64748b",
    description: "Follow requests I sent that are still waiting. From the Instagram analysis.",
    dates: [["rq", "Requested"]],
  },
  blocked: {
    name: "Blocked on Instagram",
    color: "#7f1d1d",
    description: "Accounts I blocked. From the Instagram analysis.",
    dates: [["bk", "Blocked"]],
  },
}

/**
 * Column definitions for one list, in the report's order: account, the list's
 * dates, All my interactions, the nine activity counts, Last I engaged, then
 * the profile link. The two built-in lists keep their follower count and
 * follow-back column; the caller keeps those.
 */
export function igAnalysisColumns(key: IgAnalysisListKey): AttributeDefinition[] {
  const spec = IG_ANALYSIS_LISTS[key]
  return [
    { id: IG_USERNAME, name: "Username", type: "string" },
    { id: IG_DISPLAY_NAME, name: "Display name", type: "string" },
    { id: IG_FLAGS, name: "Flags", type: "multistring" },
    ...spec.dates.map(
      ([dateKey, name]): AttributeDefinition => ({
        id: DATE_IDS[dateKey],
        name,
        type: "datetime",
        datetimeMode: "date",
      }),
    ),
    { id: IG_INTERACTIONS, name: "All my interactions", type: "number" },
    ...IG_ACTIVITY.map((a): AttributeDefinition => ({ id: a.id, name: a.name, type: "number" })),
    { id: IG_LAST_ENGAGED, name: "Last I engaged", type: "datetime", datetimeMode: "date" },
    { id: IG_PROFILE, name: "Profile", type: "link" },
  ]
}

export interface IgAnalysisPerson {
  username: string
  /** Report `n`. */
  displayName?: string
  /** Attribute values to write. Zero counts and missing dates are absent. */
  attributes: Record<string, AttributeValue>
}

export interface ParsedInstagramAnalysis {
  /** `generated` from summary.json (YYYY-MM-DD). */
  generated?: string
  /** Lower-cased username → person. */
  people: Map<string, IgAnalysisPerson>
  /** Lower-cased usernames per list. An empty list means that side was not in the export. */
  lists: Record<IgAnalysisListKey, Set<string>>
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

/** True for the shape `analyze.py` writes: `people`, `lists.followers` and `lists.following`. */
export function looksLikeInstagramAnalysis(value: unknown): boolean {
  if (!isRecord(value) || !isRecord(value.people) || !isRecord(value.lists)) return false
  return Array.isArray(value.lists.followers) && Array.isArray(value.lists.following)
}

/** The report's `day()`: a Unix-seconds stamp as its UTC YYYY-MM-DD. */
export function igDay(ts: unknown): string | undefined {
  if (typeof ts !== "number" || !Number.isFinite(ts) || ts <= 0) return undefined
  return new Date(ts * 1000).toISOString().slice(0, 10)
}

function count(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) && value > 0 ? value : 0
}

function personFrom(username: string, raw: Record<string, unknown>): IgAnalysisPerson {
  const attributes: Record<string, AttributeValue> = {}
  const displayName = typeof raw.n === "string" && raw.n.trim() ? raw.n.trim() : undefined
  if (displayName) attributes[IG_DISPLAY_NAME] = displayName
  const flags = (Object.keys(FLAG_LABELS) as Array<keyof typeof FLAG_LABELS>)
    .filter((key) => raw[key])
    .map((key) => FLAG_LABELS[key])
  if (flags.length) attributes[IG_FLAGS] = flags
  for (const [key, id] of Object.entries(DATE_IDS)) {
    const day = igDay(raw[key])
    if (day) attributes[id] = day
  }
  const total = MINE.reduce((sum, key) => sum + count(raw[key]), 0)
  if (total) attributes[IG_INTERACTIONS] = total
  for (const activity of IG_ACTIVITY) {
    const n = count(raw[activity.key])
    if (n) attributes[activity.id] = n
  }
  const last = igDay(raw.last)
  if (last) attributes[IG_LAST_ENGAGED] = last
  // Stored without the scheme to save room; the link field opens it as https.
  attributes[IG_PROFILE] = `instagram.com/${encodeURIComponent(username)}`
  return { username, ...(displayName ? { displayName } : {}), attributes }
}

function cleanName(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined
  const name = value.trim().replace(/^@/, "")
  return name || undefined
}

/** Parse summary.json. Returns null when the value is not that shape. */
export function parseInstagramAnalysis(value: unknown): ParsedInstagramAnalysis | null {
  if (!looksLikeInstagramAnalysis(value)) return null
  const root = value as { generated?: unknown; people: Record<string, unknown>; lists: Record<string, unknown> }
  const people = new Map<string, IgAnalysisPerson>()
  const lists = {} as Record<IgAnalysisListKey, Set<string>>
  for (const key of IG_ANALYSIS_LIST_KEYS) {
    lists[key] = new Set()
    const names = root.lists[key]
    if (!Array.isArray(names)) continue
    for (const entry of names) {
      const username = cleanName(entry)
      if (!username) continue
      const lower = username.toLowerCase()
      lists[key].add(lower)
      if (!people.has(lower)) {
        const raw = root.people[username]
        people.set(lower, personFrom(username, isRecord(raw) ? raw : {}))
      }
    }
  }
  return {
    ...(typeof root.generated === "string" ? { generated: root.generated } : {}),
    people,
    lists,
  }
}

export interface IgAnalysisExisting {
  id: string
  name: string
  lists: string[]
  attributes?: Record<string, AttributeValue>
}

export interface IgAnalysisChange {
  /** Absent when `create` is true. */
  id?: string
  create: boolean
  /** Title for a new item: the username, as the report's Account column leads with it. */
  name: string
  lists: string[]
  /** The whole attribute record to store. */
  attributes: Record<string, AttributeValue>
}

function existingKey(item: IgAnalysisExisting, igListIds: Set<string>): string | undefined {
  const username = cleanName(item.attributes?.[IG_USERNAME])
  if (username) return username.toLowerCase()
  if (!item.lists.some((id) => igListIds.has(id))) return undefined
  return cleanName(item.name)?.toLowerCase()
}

function sameValue(a: AttributeValue | undefined, b: AttributeValue | undefined): boolean {
  if (Array.isArray(a) && Array.isArray(b)) return a.length === b.length && a.every((v, i) => v === b[i])
  return a === b
}

function sameAttributes(a: Record<string, AttributeValue>, b: Record<string, AttributeValue>): boolean {
  const keys = new Set([...Object.keys(a), ...Object.keys(b)])
  for (const key of keys) if (!sameValue(a[key], b[key])) return false
  return true
}

/**
 * Plan creates and updates from one summary.json. Never deletes an item.
 *
 * - A list that has names in the summary is a full snapshot: accounts on it
 *   join that Brain2 list, and items no longer on it leave that list. A list
 *   that is empty in the summary is left as it is, so a download without a
 *   followers file does not empty Followers.
 * - The attributes in `IG_ANALYSIS_OWNED` are rewritten for every account in
 *   the summary. Other attributes on the item stay.
 * - Follows me back and I follow them back are written only when both the
 *   followers and following lists have names.
 */
export function planInstagramAnalysisImport(
  existing: IgAnalysisExisting[],
  parsed: ParsedInstagramAnalysis,
  listIds: Record<IgAnalysisListKey, string>,
): IgAnalysisChange[] {
  const igListIds = new Set(Object.values(listIds))
  const byKey = new Map<string, IgAnalysisExisting>()
  for (const item of existing) {
    const key = existingKey(item, igListIds)
    if (key && !byKey.has(key)) byKey.set(key, item)
  }
  const authoritative = IG_ANALYSIS_LIST_KEYS.filter((key) => parsed.lists[key].size > 0)
  const bothSides = parsed.lists.followers.size > 0 && parsed.lists.following.size > 0

  const keys = new Set<string>(parsed.people.keys())
  // Items already on an authoritative list may need to leave it.
  for (const item of existing) {
    if (!authoritative.some((key) => item.lists.includes(listIds[key]))) continue
    const key = existingKey(item, igListIds)
    if (key) keys.add(key)
  }

  const changes: IgAnalysisChange[] = []
  for (const key of keys) {
    const prev = byKey.get(key)
    const person = parsed.people.get(key)
    const lists = prev ? [...prev.lists] : []
    for (const listKey of authoritative) {
      const id = listIds[listKey]
      const on = parsed.lists[listKey].has(key)
      const at = lists.indexOf(id)
      if (on && at === -1) lists.push(id)
      if (!on && at !== -1) lists.splice(at, 1)
    }
    if (!prev && lists.length === 0) continue

    const before = prev?.attributes ?? {}
    const attributes: Record<string, AttributeValue> = { ...before }
    if (person) {
      for (const id of IG_ANALYSIS_OWNED) delete attributes[id]
      Object.assign(attributes, person.attributes)
      attributes[IG_USERNAME] = person.username
      if (bothSides) {
        if (lists.includes(listIds.following)) attributes[IG_FOLLOWS_ME_BACK] = parsed.lists.followers.has(key)
        if (lists.includes(listIds.followers)) attributes[IG_I_FOLLOW_BACK] = parsed.lists.following.has(key)
      }
    }
    const listsSame = prev ? prev.lists.length === lists.length && prev.lists.every((id, i) => id === lists[i]) : false
    if (prev && listsSame && sameAttributes(before, attributes)) continue

    changes.push({
      ...(prev ? { id: prev.id } : {}),
      create: !prev,
      name: person?.username ?? prev?.name ?? key,
      lists,
      attributes,
    })
  }
  return changes
}
