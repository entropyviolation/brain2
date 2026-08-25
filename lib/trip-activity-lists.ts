/**
 * Helpers for Activities map lists (buckets) and city chips.
 *
 * Places may belong to multiple filter lists (restaurants, favorites, day plans…).
 * Cities are normalized so "Lima" / "Lima, Peru" collapse to one chip.
 * List pin colors default from a palette and can be overridden per module.
 */
import type { AttributeValue, Task } from "@/lib/types"

export const FIXED_PIN_COLORS = {
  stay: "#0ea5e9",
  airport: "#6366f1",
  home: "#f59e0b",
  work: "#8b5cf6",
  significant: "#0f766e",
} as const

/** Fixed-kind pins always stay on the map and ignore list filters. */
export function isAlwaysVisiblePlaceKind(placeKind: string | undefined | null): boolean {
  const k = String(placeKind ?? "").trim().toLowerCase()
  return (
    k === "airport" ||
    k === "stay" ||
    k === "home" ||
    k === "work" ||
    k === "significant" ||
    k === "landmark"
  )
}

/** Canonical significant / anchor place kinds (not filter lists). */
export const SIGNIFICANT_PLACE_KINDS = ["Home", "Work", "Significant"] as const
export type SignificantPlaceKind = (typeof SIGNIFICANT_PLACE_KINDS)[number]

export function isSignificantPlaceKind(placeKind: string | undefined | null): boolean {
  const k = String(placeKind ?? "").trim().toLowerCase()
  return k === "home" || k === "work" || k === "significant" || k === "landmark"
}

/** Pin color for Airport / Stay / Home / Work / Significant, else list colors. */
export function colorForPlaceKind(
  placeKind: string | undefined | null,
  lists: string[],
  overrides?: Record<string, string> | null,
): string {
  const k = String(placeKind ?? "").trim().toLowerCase()
  if (k === "airport") return FIXED_PIN_COLORS.airport
  if (k === "stay") return FIXED_PIN_COLORS.stay
  if (k === "home") return FIXED_PIN_COLORS.home
  if (k === "work") return FIXED_PIN_COLORS.work
  if (k === "significant" || k === "landmark") return FIXED_PIN_COLORS.significant
  return colorForPlaceLists(lists, overrides)
}

/** Legend label for a fixed pin kind. */
export function labelForPlaceKind(placeKind: string | undefined | null): string {
  const k = String(placeKind ?? "").trim()
  if (!k) return "Place"
  if (k.toLowerCase() === "significant") return "Landmark"
  if (k.toLowerCase() === "stay") return "Sleeping"
  return k
}

export const DEFAULT_ACTIVITY_LISTS = ["Must do", "Maybe"] as const

/** Preset swatches for the color picker. */
export const LIST_COLOR_PRESETS = [
  "#e11d48", // rose
  "#ea580c", // orange
  "#ca8a04", // yellow
  "#16a34a", // green
  "#0891b2", // cyan
  "#2563eb", // blue
  "#7c3aed", // violet
  "#db2777", // pink
  "#0f766e", // teal
  "#b45309", // amber
  "#94a3b8", // slate
  "#171717", // near-black
] as const

const NAMED_LIST_COLORS: Record<string, string> = {
  "must do": "#e11d48",
  maybe: "#94a3b8",
  restaurants: "#ea580c",
  restaurant: "#ea580c",
  food: "#ea580c",
  activities: "#2563eb",
  activity: "#2563eb",
  favorites: "#7c3aed",
  favourite: "#7c3aed",
  favourites: "#7c3aed",
  free: "#16a34a",
  "free activities": "#16a34a",
}

function hashHue(s: string): number {
  let h = 0
  for (let i = 0; i < s.length; i++) h = (h * 33 + s.charCodeAt(i)) >>> 0
  return h
}

function normalizeHex(color: string | undefined | null): string | null {
  if (!color) return null
  const c = color.trim()
  if (/^#[0-9a-fA-F]{6}$/.test(c)) return c.toLowerCase()
  if (/^#[0-9a-fA-F]{3}$/.test(c)) {
    const [, a, b, d] = c
    return `#${a}${a}${b}${b}${d}${d}`.toLowerCase()
  }
  return null
}

/** Look up a custom override (case-insensitive on list name). */
export function findListColorOverride(
  listName: string,
  overrides?: Record<string, string> | null,
): string | null {
  if (!overrides) return null
  const direct = normalizeHex(overrides[listName])
  if (direct) return direct
  const key = listName.trim().toLowerCase()
  for (const [k, v] of Object.entries(overrides)) {
    if (k.trim().toLowerCase() === key) {
      const hex = normalizeHex(v)
      if (hex) return hex
    }
  }
  return null
}

/** Default color for a list name (legend + pins), ignoring user overrides. */
export function defaultColorForList(listName: string): string {
  const key = listName.trim().toLowerCase()
  if (NAMED_LIST_COLORS[key]) return NAMED_LIST_COLORS[key]!
  return LIST_COLOR_PRESETS[hashHue(key) % LIST_COLOR_PRESETS.length]!
}

/** Color for a list name (legend + pins). */
export function colorForList(
  listName: string,
  overrides?: Record<string, string> | null,
): string {
  return findListColorOverride(listName, overrides) || defaultColorForList(listName)
}

/** Primary list color for a place (first membership). */
export function colorForPlaceLists(
  lists: string[],
  overrides?: Record<string, string> | null,
): string {
  if (!lists.length) return colorForList("Must do", overrides)
  return colorForList(lists[0]!, overrides)
}

/** Merge a color into overrides keyed by the canonical list label. */
export function withListColor(
  overrides: Record<string, string> | undefined,
  listName: string,
  color: string,
): Record<string, string> {
  const hex = normalizeHex(color) || defaultColorForList(listName)
  const next: Record<string, string> = { ...(overrides || {}) }
  // Drop any case-variant keys so we keep one entry per list
  const key = listName.trim().toLowerCase()
  for (const k of Object.keys(next)) {
    if (k.trim().toLowerCase() === key) delete next[k]
  }
  next[listName.trim()] = hex
  return next
}

/** Canonical city key for dedupe / remove. */
export function cityChipKey(label: string): string {
  return (label.split(",")[0] || label).trim().toLowerCase()
}

/** Prefer shorter display label when merging "Lima" + "Lima, Peru". */
export function preferCityLabel(a: string, b: string): string {
  const aa = a.trim()
  const bb = b.trim()
  if (!aa) return bb
  if (!bb) return aa
  return aa.length <= bb.length ? aa : bb
}

/** Dedupe city labels case-insensitively on the part before the first comma. */
export function dedupeCityLabels(labels: string[]): string[] {
  const map = new Map<string, string>()
  for (const raw of labels) {
    const label = raw.trim()
    if (!label) continue
    const key = cityChipKey(label)
    const prev = map.get(key)
    map.set(key, prev ? preferCityLabel(prev, label) : label)
  }
  return [...map.values()]
}

/** Read list membership from a place (supports legacy single string). */
export function getPlaceLists(place: Task | { attributes?: Record<string, AttributeValue> }): string[] {
  const raw = place.attributes?.bucket
  if (Array.isArray(raw)) {
    const out = raw.map((x) => String(x).trim()).filter(Boolean)
    return out.length ? [...new Set(out)] : [...DEFAULT_ACTIVITY_LISTS.slice(0, 1)]
  }
  if (raw == null || raw === "") return ["Must do"]
  const s = String(raw).trim()
  return s ? [s] : ["Must do"]
}

export function placeInList(place: Task, listName: string): boolean {
  return getPlaceLists(place).some((b) => b.toLowerCase() === listName.trim().toLowerCase())
}

export function placeVisibleForLists(
  place: Task,
  visible: Record<string, boolean>,
): boolean {
  const lists = getPlaceLists(place)
  return lists.some((b) => visible[b] !== false)
}

/** Merge list names into a value suitable for attributes.bucket. */
export function encodePlaceLists(lists: string[]): string | string[] {
  const clean = [...new Set(lists.map((s) => s.trim()).filter(Boolean))]
  if (clean.length <= 1) return clean[0] || "Must do"
  return clean
}

export function togglePlaceList(current: string[], listName: string): string[] {
  const name = listName.trim()
  if (!name) return current
  const has = current.some((b) => b.toLowerCase() === name.toLowerCase())
  if (has) {
    const next = current.filter((b) => b.toLowerCase() !== name.toLowerCase())
    return next.length ? next : ["Must do"]
  }
  return [...current, name]
}
