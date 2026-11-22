import { beforeEach, describe, expect, it } from "vitest"
import { resetAllStores } from "@/tests/test-utils"
import { resetActionHistory } from "@/lib/action-history"
import { usePeriodSummaryStore } from "@/lib/period-summary-store"
import { useTaskStore } from "@/lib/task-store"
import { ingestIncoming } from "./executor"
import { useIngestStore } from "./ingest-store"
import { resetIngestDedupeForTests } from "./dedupe"
import { resetPhoneUndoForTests } from "./phone-undo"
import { rememberSpotifyTitle, resetPeriodSongMemory, SONG_FOLLOW_UP_MS } from "./apply-period-song"
import type { IncomingMessage } from "./types"

const NOW = new Date(2026, 10, 22, 15, 0)
const TRACK = "https://open.spotify.com/track/4uLU6hMCjMI75M1A2tKUQC"
let seq = 0

function sim(text: string, at = NOW, replyTo?: number): IncomingMessage {
  seq += 1
  return {
    source: { channel: "simulate", chatId: "sim" },
    text,
    receivedAt: at.toISOString(),
    telegramMessageId: seq,
    ...(replyTo != null ? { replyToMessageId: replyTo } : {}),
  }
}

const songsOn = (key: string) => usePeriodSummaryStore.getState().byKey[key]?.songs ?? []
const links = () => useTaskStore.getState().tasks.filter((t) => t.savedLink?.kind === "spotify")

describe("Spotify songs on a week or a month", () => {
  beforeEach(() => {
    resetAllStores()
    resetIngestDedupeForTests()
    resetActionHistory()
    resetPhoneUndoForTests()
    resetPeriodSongMemory()
    usePeriodSummaryStore.setState({ byKey: {} })
    useIngestStore.setState({ enabled: true, pendingByChat: {} })
    seq = 0
  })

  it("files a link with “favorite of the month” in one message", () => {
    rememberSpotifyTitle(TRACK, "Never Gonna Give You Up")
    const result = ingestIncoming(sim(`${TRACK}?si=abc favorite of the month`), NOW)
    expect(result.status).toBe("ok")
    if (result.status === "ok") expect(result.reply).toBe("Added “Never Gonna Give You Up” to November Songs (favorite).")
    expect(songsOn("month:2026-11")).toEqual([
      expect.objectContaining({ title: "Never Gonna Give You Up", url: TRACK, tag: "favorite", note: "favorite of the month" }),
    ])
    expect(links()).toHaveLength(0)
  })

  it("files a bare link from the next line, and takes it off Links", () => {
    ingestIncoming(sim(TRACK), NOW)
    expect(links()).toHaveLength(1)
    const later = new Date(NOW.getTime() + 60_000)
    const result = ingestIncoming(sim("I've been listening to this a lot this week", later), later)
    expect(result.status).toBe("ok")
    const weekKey = Object.keys(usePeriodSummaryStore.getState().byKey)[0]!
    expect(weekKey).toMatch(/^week:/)
    expect(songsOn(weekKey)[0]).toMatchObject({ url: TRACK, tag: "on-repeat", note: "I've been listening to this a lot this week" })
    expect(links()).toHaveLength(0)
  })

  it("leaves the next line alone after 30 minutes, unless it replies to the link", () => {
    const link = sim(TRACK)
    ingestIncoming(link, NOW)
    const late = new Date(NOW.getTime() + SONG_FOLLOW_UP_MS + 1000)
    ingestIncoming(sim("favorite of the week", late), late)
    expect(Object.keys(usePeriodSummaryStore.getState().byKey)).toHaveLength(0)
    ingestIncoming(sim("favorite of the week", late, link.telegramMessageId), late)
    expect(Object.keys(usePeriodSummaryStore.getState().byKey)).toHaveLength(1)
  })

  it("does not take a line about something else", () => {
    ingestIncoming(sim(TRACK), NOW)
    ingestIncoming(sim("I worked out a ton this week"), NOW)
    expect(Object.keys(usePeriodSummaryStore.getState().byKey)).toHaveLength(0)
    expect(links()).toHaveLength(1)
  })

  it("undo takes the song back", () => {
    ingestIncoming(sim(`${TRACK} song of the month`), NOW)
    expect(songsOn("month:2026-11")).toHaveLength(1)
    ingestIncoming(sim("undo"), NOW)
    expect(songsOn("month:2026-11")).toHaveLength(0)
  })

  it("a playlist link becomes the period's playlist", () => {
    ingestIncoming(sim("https://open.spotify.com/playlist/37i9dQZF1DX this month"), NOW)
    expect(usePeriodSummaryStore.getState().byKey["month:2026-11"]?.playlistUrl).toBe("https://open.spotify.com/playlist/37i9dQZF1DX")
  })
})
