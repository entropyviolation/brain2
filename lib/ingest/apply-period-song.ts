/**
 * lib/ingest/apply-period-song.ts — A Spotify song filed on a week or a month
 *
 * Two shapes, Telegram and BIM chat alike:
 * - one message: `https://open.spotify.com/track/… favorite of the week`;
 * - a Spotify link alone, then within 30 minutes (or as a Telegram reply to
 *   it) a line like "I've been listening to this a lot this month".
 *
 * The song joins that period's summary record (`brain2-period-summaries`), so
 * Data → Summary and the week / month ritual show it on the Songs plate. The
 * line is the song's note; "favorite" or "a lot" sets its tag. A playlist link
 * becomes the period's playlist. In the two-message shape the link first
 * lands on Inbox → Links as usual, and filing it takes that row back off.
 * `undo` takes back the whole step. The title comes from Spotify's public
 * oEmbed (`prefetchSpotifyTitle`); offline it reads "Spotify song".
 */
import { attachLatestUndoHooks } from "@/lib/action-history"
import { defaultPlaylistName, periodWindowFromKey, type PeriodSong, type PeriodSummaryRecord } from "@/lib/period-summary"
import {
  addSongToRecord,
  cleanSpotifyUrl,
  readSongPeriod,
  SONG_PLACEHOLDER_TITLE,
  SONG_TAG_LABELS,
  songPeriodKey,
  spotifyLinkKind,
  type SongPeriodRead,
} from "@/lib/period-songs"
import { usePeriodSummaryStore } from "@/lib/period-summary-store"
import { parseLinkMessage } from "@/lib/saved-links"
import { useTaskStore } from "@/lib/task-store"
import type { ApplyResult, IncomingMessage } from "./types"

/** How long a bare Spotify link waits for its "this week" line. */
export const SONG_FOLLOW_UP_MS = 30 * 60 * 1000

type RecentLink = { url: string; at: number; messageId?: number; taskId?: string }

/** Last bare Spotify link per chat. In memory: a restart forgets it, which is fine. */
const recent = new Map<string, RecentLink>()
/** Track titles by clean link, from oEmbed. */
const titles = new Map<string, string>()

function chatKey(message: Pick<IncomingMessage, "source">): string {
  return `${message.source.channel}:${message.source.chatId}`
}

export function resetPeriodSongMemory(): void {
  recent.clear()
  titles.clear()
}

/** Test seam and oEmbed result: a title for a link. */
export function rememberSpotifyTitle(url: string, title: string): void {
  const clean = title.trim()
  if (clean) titles.set(cleanSpotifyUrl(url), clean)
}

function spotifyLinkOf(text: string): string | null {
  const parsed = parseLinkMessage(text)
  if (!parsed || parsed.link.kind !== "spotify") return null
  return parsed.link.url
}

/**
 * Fetch the title of the Spotify link a message starts with, before the
 * message is applied, so the reply and the row can name the song. Gives up
 * after `timeoutMs`; never throws.
 */
export async function prefetchSpotifyTitle(text: string, timeoutMs = 2500): Promise<void> {
  const url = spotifyLinkOf(text)
  if (!url || titles.has(cleanSpotifyUrl(url)) || typeof fetch !== "function") return
  const kind = spotifyLinkKind(url)
  if (kind !== "track" && kind !== "album" && kind !== "short") return
  const controller = typeof AbortController === "function" ? new AbortController() : null
  const timer = setTimeout(() => controller?.abort(), timeoutMs)
  try {
    const res = await fetch(`https://open.spotify.com/oembed?url=${encodeURIComponent(cleanSpotifyUrl(url))}`, {
      signal: controller?.signal,
    })
    if (!res.ok) return
    const body = (await res.json()) as { title?: unknown }
    if (typeof body.title === "string") rememberSpotifyTitle(url, body.title)
  } catch {
    /* offline or blocked: the song keeps its placeholder title */
  } finally {
    clearTimeout(timer)
  }
}

/** After a bare Spotify link lands on Links, remember it for the next line. */
export function noteSpotifyLink(message: IncomingMessage, result: ApplyResult, text: string, now: Date): void {
  const url = spotifyLinkOf(text)
  if (!url || result.status !== "ok") return
  const taskId = result.itemIds?.length === 1 ? result.itemIds[0] : undefined
  recent.set(chatKey(message), { url, at: now.getTime(), messageId: message.telegramMessageId, taskId })
}

/**
 * One message: a Spotify link whose note names a week or a month. Null when
 * the message is not that, so the link goes to Links as before.
 */
export function tryLinkWithPeriod(text: string, now: Date): ApplyResult | null {
  const parsed = parseLinkMessage(text)
  if (!parsed || parsed.link.kind !== "spotify" || !parsed.note) return null
  const kind = spotifyLinkKind(parsed.link.url)
  if (kind !== "track" && kind !== "album" && kind !== "short" && kind !== "playlist") return null
  const read = readSongPeriod(parsed.note)
  if (!read) return null
  return fileSpotifyOnPeriod(parsed.link.url, read, parsed.note, now)
}

/** True when `tryPeriodSongFollowUp` would take this line. Writes nothing. */
export function claimsPeriodSongFollowUp(
  message: Pick<IncomingMessage, "source" | "replyToMessageId">,
  text: string,
  now: Date,
): boolean {
  const link = recent.get(chatKey(message))
  if (!link) return false
  const repliesToIt =
    typeof message.replyToMessageId === "number" && link.messageId != null && message.replyToMessageId === link.messageId
  if (!repliesToIt && now.getTime() - link.at > SONG_FOLLOW_UP_MS) return false
  return readSongPeriod(text) != null
}

/**
 * The line after a bare Spotify link: "favorite of the week". Claimed only
 * when that link is recent (or this message replies to it) and the line reads
 * as one about the song.
 */
export function tryPeriodSongFollowUp(message: IncomingMessage, text: string, now: Date): ApplyResult | null {
  if (!claimsPeriodSongFollowUp(message, text, now)) return null
  const key = chatKey(message)
  const link = recent.get(key)!
  const read = readSongPeriod(text)!
  recent.delete(key)
  const result = fileSpotifyOnPeriod(link.url, read, text.trim(), now)
  if (result.status === "ok" && link.taskId) dropLinksRow(link.taskId, link.url)
  return result
}

/** The Links row the bare link made, now that the song lives on the period. */
function dropLinksRow(taskId: string, url: string): void {
  const store = useTaskStore.getState()
  const row = store.tasks.find((task) => task.id === taskId)
  if (!row || row.completed || row.savedLink?.url !== url) return
  store.deleteTask(taskId)
}

/** "Week of Nov 16 Songs", or the playlist name the period already has. */
function periodName(key: string): string {
  const named = usePeriodSummaryStore.getState().byKey[key]?.playlistName?.trim()
  if (named) return named
  const window = periodWindowFromKey(key)
  return window ? defaultPlaylistName(window) : key
}

function patchWithUndo(key: string, change: Partial<PeriodSummaryRecord>): void {
  const store = usePeriodSummaryStore.getState()
  const before = store.byKey[key]
  store.patch(key, change)
  const after = usePeriodSummaryStore.getState().byKey[key]
  const put = (record: PeriodSummaryRecord | undefined) =>
    usePeriodSummaryStore.setState((s) => {
      const byKey = { ...s.byKey }
      if (record) byKey[key] = record
      else delete byKey[key]
      return { byKey }
    })
  // The undo world does not hold period summaries, so this step carries its own.
  attachLatestUndoHooks({ onUndo: () => put(before), onRedo: () => put(after) })
}

export function fileSpotifyOnPeriod(url: string, read: SongPeriodRead, note: string, now: Date): ApplyResult {
  const kind = spotifyLinkKind(url)
  const key = songPeriodKey(read, now)
  const where = periodName(key)
  const clean = cleanSpotifyUrl(url)
  if (kind === "playlist") {
    patchWithUndo(key, { playlistUrl: clean })
    return {
      status: "ok",
      kind: "link",
      reply: `That playlist is now ${where}.`,
      summary: `Period playlist ${key}: ${clean}`,
    }
  }
  if (kind !== "track" && kind !== "album" && kind !== "short") {
    return {
      status: "ok",
      kind: "unknown",
      reply: "That Spotify link is not a song, so I left it on Links.",
      summary: "Spotify link not a song",
    }
  }
  const title = titles.get(clean) ?? SONG_PLACEHOLDER_TITLE
  const song: PeriodSong = {
    title,
    url: clean,
    ...(note ? { note } : {}),
    ...(read.tag ? { tag: read.tag } : {}),
    addedAt: now.toISOString(),
  }
  const record = usePeriodSummaryStore.getState().byKey[key] ?? { songs: [], palette: [], symbols: [] }
  const { songs, added } = addSongToRecord(record, song)
  patchWithUndo(key, { songs })
  const named = title === SONG_PLACEHOLDER_TITLE ? "the song" : `“${title}”`
  const tagged = read.tag ? ` (${SONG_TAG_LABELS[read.tag]})` : ""
  return {
    status: "ok",
    kind: "link",
    reply: added ? `Added ${named} to ${where}${tagged}.` : `${named[0]!.toUpperCase()}${named.slice(1)} was already on ${where}. Updated it${tagged}.`,
    summary: `Song on ${key}: ${clean}${read.tag ? ` (${read.tag})` : ""}`,
  }
}
