/**
 * lib/period-songs.ts — A Spotify song kept on a week or a month (pure)
 *
 * Send BIM a Spotify link, then a line like "I've been listening to this a
 * lot this week" or "favorite of the month". The song joins that period's
 * summary record (`lib/period-summary.ts`), so the week or month review shows
 * it on the Songs plate. These helpers read the line and the link; the write
 * is `lib/ingest/apply-period-song.ts`.
 */
import { monthSummaryKeyFromDate, weekSummaryKey } from "@/lib/tracking-summaries"
import { songId, type PeriodSong, type PeriodSongTag, type PeriodSummaryRecord } from "@/lib/period-summary"

export type SongPeriod = "week" | "month"

export type SongPeriodRead = {
  period: SongPeriod
  /** 0 = this week / month, -1 = last one. */
  offset: 0 | -1
  tag?: PeriodSongTag
}

/** "this week", "of the month", "last week", "for the month", "this wk". */
const PERIOD_RE =
  /\b(?:(this|the|of the|for the|this past|past|last|previous|this whole|all)\s+)?(week|wk|month|mo)\b/i

const FAVORITE_RE = /\b(fav(?:ou?rite)?s?|faves?|best|top|number one|#1|song of the)\b/i
const REPEAT_RE =
  /\b(a lot|lots|on repeat|repeat(?:ing)?|loop(?:ing)?|nonstop|non-stop|obsessed|can'?t stop|been listening|been playing|playing|listening)\b/i

/** Words that say the line is about the song, once the period phrase is taken out. */
const SONG_CUE_RE =
  /\b(this|it|that|song|track|tune|listen\w*|play\w*|fav\w*|faves?|best|top|attach\w*|add|save|put|file|keep|repeat\w*|loop\w*|obsess\w*|anthem|vibe|lot|lots|nonstop|soundtrack)\b/i

/** Longer lines are about something else. */
const MAX_LINE = 160

/**
 * A short line that files a song on a week or a month. Null when there is no
 * period word, or the rest of the line is not about the song ("I worked out
 * this week").
 */
export function readSongPeriod(text: string): SongPeriodRead | null {
  const line = text.replace(/^﻿/, "").trim()
  if (!line || line.length > MAX_LINE || line.includes("\n")) return null
  const match = PERIOD_RE.exec(line)
  if (!match) return null
  const lead = (match[1] ?? "").toLowerCase()
  const unit = match[2]!.toLowerCase()
  const period: SongPeriod = unit === "week" || unit === "wk" ? "week" : "month"
  // "mo" and "wk" alone are too loose without "this" / "the" / "last".
  if ((unit === "mo" || unit === "wk") && !lead) return null
  const offset: 0 | -1 = /^(last|previous|past|this past)$/.test(lead) ? -1 : 0
  const rest = (line.slice(0, match.index) + " " + line.slice(match.index + match[0].length))
    .replace(/[^\p{L}\p{N}#'\s-]/gu, " ")
    .replace(/\s+/g, " ")
    .trim()
  if (rest && !SONG_CUE_RE.test(rest)) return null
  const tag: PeriodSongTag | undefined = FAVORITE_RE.test(line)
    ? "favorite"
    : REPEAT_RE.test(line)
      ? "on-repeat"
      : undefined
  return { period, offset, ...(tag ? { tag } : {}) }
}

/** The summary key for "this week" / "last month" at `now`. */
export function songPeriodKey(read: SongPeriodRead, now: Date): string {
  if (read.period === "week") {
    const day = new Date(now)
    day.setDate(day.getDate() + read.offset * 7)
    return weekSummaryKey(day)
  }
  return monthSummaryKeyFromDate(new Date(now.getFullYear(), now.getMonth() + read.offset, 1))
}

export type SpotifyLinkKind = "track" | "album" | "playlist" | "artist" | "short" | "other"

/** What a Spotify link points at. `spotify.link/…` short links can't be read offline. */
export function spotifyLinkKind(url: string): SpotifyLinkKind | null {
  try {
    const parsed = new URL(url)
    const host = parsed.hostname.toLowerCase().replace(/^www\./, "")
    if (host === "spotify.link" || host === "spotify.app.link") return "short"
    if (host !== "open.spotify.com") return null
    const parts = parsed.pathname.split("/").filter(Boolean).filter((p) => !p.startsWith("intl-"))
    const kind = parts[0] === "embed" ? parts[1] : parts[0]
    if (kind === "track" || kind === "album" || kind === "playlist" || kind === "artist") return kind
    return "other"
  } catch {
    return null
  }
}

/** The link without tracking params (`?si=…`), so the same song is one row. */
export function cleanSpotifyUrl(url: string): string {
  try {
    const parsed = new URL(url)
    parsed.search = ""
    parsed.hash = ""
    return parsed.toString()
  } catch {
    return url
  }
}

export const SONG_PLACEHOLDER_TITLE = "Spotify song"

/**
 * Add a song to the record, or update the one with the same link: a tag
 * already set stays unless a new one is given, and a new note goes under the
 * old one. Favorite outranks on-repeat.
 */
export function addSongToRecord(
  record: PeriodSummaryRecord,
  song: PeriodSong,
): { songs: PeriodSong[]; added: boolean } {
  const key = (s: PeriodSong) => (s.url ? cleanSpotifyUrl(s.url) : songId(s))
  const at = record.songs.findIndex((s) => key(s) === key(song))
  if (at < 0) return { songs: [...record.songs, song], added: true }
  const old = record.songs[at]!
  const tag = old.tag === "favorite" || !song.tag ? (old.tag ?? song.tag) : song.tag
  const prevNote = old.note?.trim() ?? ""
  const newNote = song.note?.trim() ?? ""
  const note = newNote && !prevNote.split("\n").includes(newNote) ? (prevNote ? `${prevNote}\n${newNote}` : newNote) : old.note
  const title = old.title === SONG_PLACEHOLDER_TITLE && song.title !== SONG_PLACEHOLDER_TITLE ? song.title : old.title
  const merged: PeriodSong = { ...old, title, ...(tag ? { tag } : {}), ...(note ? { note } : {}) }
  const songs = [...record.songs]
  songs[at] = merged
  return { songs, added: false }
}

export const SONG_TAG_LABELS: Record<PeriodSongTag, string> = {
  favorite: "favorite",
  "on-repeat": "on repeat",
}
