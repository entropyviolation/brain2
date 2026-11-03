import { describe, expect, it } from "vitest"
import {
  childSummaryWindows,
  defaultPlaylistName,
  mergePastedSongs,
  normalizeHex,
  parseSongLine,
  parseSymbols,
  pastSummaryWindows,
  periodWindowForRange,
  periodWindowFromKey,
  spotifyEmbedUrl,
  windowDateKeys,
} from "./period-summary"

describe("period windows", () => {
  it("reads every summary key", () => {
    expect(periodWindowFromKey("month:2026-10")).toMatchObject({ period: "month", from: "2026-10-01", to: "2026-10-31" })
    expect(periodWindowFromKey("week:2026-10-26_2026-11-01")).toMatchObject({ period: "week", from: "2026-10-26" })
    expect(periodWindowFromKey("quarter:2026-Q4")).toMatchObject({ period: "season", from: "2026-10-01", to: "2026-12-31" })
    expect(periodWindowFromKey("year:2026")).toMatchObject({ from: "2026-01-01", to: "2026-12-31" })
    expect(periodWindowFromKey("2026-10-31")?.period).toBe("day")
    expect(periodWindowFromKey("nope:1")).toBeNull()
  })

  it("names a Data window only when it is exactly one period", () => {
    expect(periodWindowForRange("2026-10-01", "2026-10-31")?.key).toBe("month:2026-10")
    expect(periodWindowForRange("2026-10-26", "2026-11-01")?.key).toBe("week:2026-10-26_2026-11-01")
    expect(periodWindowForRange("2026-10-03", "2026-10-20")).toBeNull()
  })

  it("names the playlist after the period", () => {
    expect(defaultPlaylistName(periodWindowFromKey("month:2026-10")!)).toBe("October Songs")
    expect(defaultPlaylistName(periodWindowFromKey("week:2026-10-26_2026-11-01")!)).toBe("Week of Oct 26 Songs")
  })

  it("nests children and lists past periods newest first", () => {
    const month = periodWindowFromKey("month:2026-10")!
    expect(windowDateKeys(month)).toHaveLength(31)
    expect(childSummaryWindows(month).map((w) => w.period)).toEqual(Array(5).fill("week"))
    const past = pastSummaryWindows(["2026-10-02", "month:2026-09", "week:2026-10-26_2026-11-01"], ["month:2026-10"], false)
    expect(past.map((w) => w.key)).toEqual(["week:2026-10-26_2026-11-01", "month:2026-10", "month:2026-09"])
  })
})

describe("pasted playlist", () => {
  it("embeds Spotify links only", () => {
    expect(spotifyEmbedUrl("https://open.spotify.com/playlist/37i9dQZF1DX?si=abc")).toBe(
      "https://open.spotify.com/embed/playlist/37i9dQZF1DX",
    )
    expect(spotifyEmbedUrl("https://open.spotify.com/intl-de/album/xyz")).toBe("https://open.spotify.com/embed/album/xyz")
    expect(spotifyEmbedUrl("spotify:track:abc")).toBe("https://open.spotify.com/embed/track/abc")
    expect(spotifyEmbedUrl("https://music.apple.com/playlist/x")).toBeNull()
  })

  it("splits lines and keeps notes on a re-paste", () => {
    expect(parseSongLine("1. Pink + White — Frank Ocean 3:04")).toEqual({ title: "Pink + White", artist: "Frank Ocean" })
    expect(parseSongLine("Linger by The Cranberries")).toEqual({ title: "Linger", artist: "The Cranberries" })
    expect(parseSongLine("https://open.spotify.com/track/abc")?.url).toBeTruthy()
    const first = mergePastedSongs([], "Linger - The Cranberries")
    first[0].note = "rain"
    const again = mergePastedSongs(first, "Linger - The Cranberries\nDreams - Fleetwood Mac\n")
    expect(again).toHaveLength(2)
    expect(again[0].note).toBe("rain")
  })

  it("cleans colors and symbols", () => {
    expect(normalizeHex("ABC")).toBe("#aabbcc")
    expect(normalizeHex("red")).toBeNull()
    expect(parseSymbols("moth, key; Moth\nred door")).toEqual(["moth", "key", "red door"])
  })
})
