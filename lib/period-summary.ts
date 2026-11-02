/**
 * lib/period-summary.ts — Pure helpers for the period summary
 *
 * The summary of a week, month, season, or year is read on Data → Summary and
 * edited in the ritual summary step (`docs/PERIOD_SUMMARY_PLAN.md`). Keys are
 * the same keys the written summaries use (`lib/tracking-summaries.ts`). Songs
 * come from a pasted playlist until Spotify listening history is read.
 */
import { format } from "date-fns"
import { formatLocalDateKey, parseLocalDate, parseWeekString } from "@/lib/date-utils"
import { parseQuarterKey, quarterEndDate, seasonOfDate } from "@/lib/seasons"
import {
  monthSummaryKeyFromDate,
  seasonSummaryKey,
  weekSummaryKey,
  yearSummaryKey,
  type SummaryPeriod,
} from "@/lib/tracking-summaries"

export type PeriodSong = {
  title: string
  artist?: string
  /** A track link, when the pasted line was one. */
  url?: string
  /** What you like about it and how it makes you feel, this period. */
  note?: string
}

export type PeriodSummaryRecord = {
  playlistName?: string
  playlistUrl?: string
  songs: PeriodSong[]
  /** Hex colors, at most `MAX_PALETTE`. */
  palette: string[]
  symbols: string[]
  /** One Photo item id picked as the period's face. */
  coverPhotoId?: string
  updatedAt?: string
}

export const MAX_PALETTE = 8

export const EMPTY_PERIOD_SUMMARY: PeriodSummaryRecord = { songs: [], palette: [], symbols: [] }

export function isPeriodSummaryEmpty(record: PeriodSummaryRecord | undefined): boolean {
  if (!record) return true
  return (
    !record.playlistUrl?.trim() &&
    record.songs.length === 0 &&
    record.palette.length === 0 &&
    record.symbols.length === 0 &&
    !record.coverPhotoId
  )
}

/** One period: its summary key, inclusive day bounds, and a plain label. */
export type SummaryPeriodWindow = {
  period: SummaryPeriod
  key: string
  from: string
  to: string
  label: string
  /** "October", "Week of Oct 27", "Fall 2026" — the start of "October Songs". */
  shortLabel: string
}

function windowOf(period: SummaryPeriod, key: string, start: Date, end: Date): SummaryPeriodWindow {
  const from = formatLocalDateKey(start)
  const to = formatLocalDateKey(end)
  switch (period) {
    case "day":
      return { period, key, from, to, label: format(start, "EEE, MMM d yyyy"), shortLabel: format(start, "MMM d") }
    case "week":
      return {
        period,
        key,
        from,
        to,
        label: `Week ${format(start, "MMM d")} – ${format(end, "MMM d yyyy")}`,
        shortLabel: `Week of ${format(start, "MMM d")}`,
      }
    case "month":
      return { period, key, from, to, label: format(start, "MMMM yyyy"), shortLabel: format(start, "MMMM") }
    case "season": {
      const name = `${seasonOfDate(start)} ${start.getFullYear()}`
      return { period, key, from, to, label: name, shortLabel: name }
    }
    case "year":
      return { period, key, from, to, label: String(start.getFullYear()), shortLabel: String(start.getFullYear()) }
  }
}

/** Bounds and label for a summary key (`2026-10-31`, `week:…`, `month:2026-10`, `quarter:2026-Q4`, `year:2026`). */
export function periodWindowFromKey(key: string): SummaryPeriodWindow | null {
  if (/^\d{4}-\d{2}-\d{2}$/.test(key)) {
    const day = parseLocalDate(key)
    return day ? windowOf("day", key, day, day) : null
  }
  const [prefix, rest] = [key.slice(0, key.indexOf(":")), key.slice(key.indexOf(":") + 1)]
  if (prefix === "week") {
    const parsed = parseWeekString(rest)
    return parsed ? windowOf("week", key, parsed.start, parsed.end) : null
  }
  if (prefix === "month") {
    const match = /^(\d{4})-(\d{2})$/.exec(rest)
    if (!match) return null
    const year = Number(match[1])
    const month = Number(match[2]) - 1
    return windowOf("month", key, new Date(year, month, 1), new Date(year, month + 1, 0))
  }
  if (prefix === "quarter") {
    const parsed = parseQuarterKey(rest)
    const end = quarterEndDate(rest)
    if (!parsed || !end) return null
    return windowOf("season", key, new Date(parsed.year, (parsed.quarter - 1) * 3, 1), end)
  }
  if (prefix === "year") {
    const year = Number(rest)
    if (!Number.isInteger(year)) return null
    return windowOf("year", key, new Date(year, 0, 1), new Date(year, 11, 31))
  }
  return null
}

/**
 * The one period a Data window is exactly, or null for a custom range.
 * A single day, a Mon–Sun week, a calendar month, a season, or a year.
 */
export function periodWindowForRange(fromKey: string, toKey: string): SummaryPeriodWindow | null {
  const from = parseLocalDate(fromKey)
  if (!from) return null
  const candidates = [
    fromKey,
    weekSummaryKey(from),
    monthSummaryKeyFromDate(from),
    seasonSummaryKey(from),
    yearSummaryKey(from.getFullYear()),
  ]
  for (const key of candidates) {
    const window = periodWindowFromKey(key)
    if (window && window.from === fromKey && window.to === toKey) return window
  }
  return null
}

/** The summary key and window for a ritual's anchor. */
export function periodWindowForRitual(
  period: "day" | "week" | "month" | "quarter" | "year",
  anchor: Date,
): SummaryPeriodWindow | null {
  const key =
    period === "day"
      ? formatLocalDateKey(anchor)
      : period === "week"
        ? weekSummaryKey(anchor)
        : period === "month"
          ? monthSummaryKeyFromDate(anchor)
          : period === "quarter"
            ? seasonSummaryKey(anchor)
            : yearSummaryKey(anchor.getFullYear())
  return periodWindowFromKey(key)
}

/** Every local day key in the window, oldest first. */
export function windowDateKeys(window: Pick<SummaryPeriodWindow, "from" | "to">): string[] {
  const start = parseLocalDate(window.from)
  const end = parseLocalDate(window.to)
  if (!start || !end) return []
  const keys: string[] = []
  for (const d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) keys.push(formatLocalDateKey(d))
  return keys
}

/** The next level down: a week's days, a month's weeks, a season's months, a year's seasons. */
export function childSummaryWindows(window: SummaryPeriodWindow): SummaryPeriodWindow[] {
  const start = parseLocalDate(window.from)
  if (!start || window.period === "day") return []
  const keys: string[] = []
  if (window.period === "week") keys.push(...windowDateKeys(window))
  else if (window.period === "month")
    for (const d = new Date(start); formatLocalDateKey(d) <= window.to; d.setDate(d.getDate() + 7)) {
      const key = weekSummaryKey(d)
      if (!keys.includes(key)) keys.push(key)
    }
  else if (window.period === "season")
    for (let i = 0; i < 3; i++) keys.push(monthSummaryKeyFromDate(new Date(start.getFullYear(), start.getMonth() + i, 1)))
  else for (let q = 0; q < 4; q++) keys.push(seasonSummaryKey(new Date(start.getFullYear(), q * 3, 1)))
  return keys.flatMap((key) => periodWindowFromKey(key) ?? [])
}

/**
 * Every period that has something written or kept, newest first: the
 * written summaries in day notes, and the period summary records. Days are
 * many, so they join only when asked.
 */
export function pastSummaryWindows(
  writtenKeys: string[],
  recordKeys: string[],
  includeDays: boolean,
): SummaryPeriodWindow[] {
  const byKey = new Map<string, SummaryPeriodWindow>()
  for (const key of [...writtenKeys, ...recordKeys]) {
    if (byKey.has(key)) continue
    const window = periodWindowFromKey(key)
    if (!window || (window.period === "day" && !includeDays)) continue
    byKey.set(key, window)
  }
  const rank: Record<SummaryPeriod, number> = { year: 0, season: 1, month: 2, week: 3, day: 4 }
  return [...byKey.values()].sort(
    (a, b) => b.to.localeCompare(a.to) || rank[a.period] - rank[b.period],
  )
}

export function defaultPlaylistName(window: SummaryPeriodWindow): string {
  return `${window.shortLabel} Songs`
}

/** A Spotify playlist, album, or track link as its embed URL. Anything else: null. */
export function spotifyEmbedUrl(link: string | undefined): string | null {
  if (!link) return null
  const uri = /^spotify:(playlist|album|track):([A-Za-z0-9]+)$/.exec(link.trim())
  if (uri) return `https://open.spotify.com/embed/${uri[1]}/${uri[2]}`
  try {
    const url = new URL(link.trim())
    if (url.hostname !== "open.spotify.com") return null
    const parts = url.pathname.split("/").filter(Boolean).filter((p) => !p.startsWith("intl-"))
    const kind = parts[0] === "embed" ? parts[1] : parts[0]
    const id = parts[0] === "embed" ? parts[2] : parts[1]
    if (!id || !["playlist", "album", "track"].includes(kind)) return null
    return `https://open.spotify.com/embed/${kind}/${id}`
  } catch {
    return null
  }
}

/** True when the text is one link and nothing else. */
export function looksLikeLink(text: string): boolean {
  return /^(https?:\/\/\S+|spotify:\S+)$/.test(text.trim())
}

const SEPARATORS = [" — ", " – ", " - ", " by "]

/**
 * One pasted line as a song. "Title — Artist", "Title - Artist", and
 * "Title by Artist" split; numbering ("1.", "01 ") and a trailing duration
 * ("3:42") drop. A bare link stays a link with its text as the title.
 */
export function parseSongLine(line: string): PeriodSong | null {
  let text = line.trim()
  if (!text) return null
  if (looksLikeLink(text)) return { title: text, url: text }
  text = text.replace(/^\d{1,3}[.)]?\s+/, "").replace(/\s+\d{1,2}:\d{2}$/, "").trim()
  if (!text) return null
  for (const sep of SEPARATORS) {
    const at = text.indexOf(sep)
    if (at > 0) {
      const title = text.slice(0, at).trim()
      const artist = text.slice(at + sep.length).trim()
      if (title && artist) return { title, artist }
    }
  }
  const tab = text.split("\t").map((part) => part.trim()).filter(Boolean)
  if (tab.length >= 2) return { title: tab[0], artist: tab[1] }
  return { title: text }
}

/** A pasted list, one song per line. Notes on songs already there are kept. */
export function mergePastedSongs(current: PeriodSong[], pasted: string): PeriodSong[] {
  const seen = new Map(current.map((song) => [songId(song), song]))
  const next = [...current]
  for (const line of pasted.split(/\r?\n/)) {
    const song = parseSongLine(line)
    if (!song) continue
    if (seen.has(songId(song))) continue
    seen.set(songId(song), song)
    next.push(song)
  }
  return next
}

export function songId(song: PeriodSong): string {
  return `${song.title.trim().toLowerCase()}|${(song.artist ?? "").trim().toLowerCase()}`
}

export function normalizeHex(value: string): string | null {
  const match = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(value.trim())
  if (!match) return null
  const hex = match[1].length === 3 ? match[1].replace(/./g, (c) => c + c) : match[1]
  return `#${hex.toLowerCase()}`
}

/** Symbols typed as "moth, key; red door" → trimmed, unique, in order. */
export function parseSymbols(text: string): string[] {
  const out: string[] = []
  for (const part of text.split(/[,;\n]/)) {
    const word = part.trim()
    if (word && !out.some((have) => have.toLowerCase() === word.toLowerCase())) out.push(word)
  }
  return out
}
