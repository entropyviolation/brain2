import { describe, expect, it } from "vitest"
import { addSongToRecord, cleanSpotifyUrl, readSongPeriod, songPeriodKey, spotifyLinkKind } from "./period-songs"

describe("readSongPeriod", () => {
  it("reads the lines from the ask", () => {
    expect(readSongPeriod("I've been listening to this a lot this week")).toEqual({ period: "week", offset: 0, tag: "on-repeat" })
    expect(readSongPeriod("a lot this month")).toEqual({ period: "month", offset: 0, tag: "on-repeat" })
    expect(readSongPeriod("attached to the week")).toEqual({ period: "week", offset: 0 })
    expect(readSongPeriod("attached to the month")).toEqual({ period: "month", offset: 0 })
    expect(readSongPeriod("favorite of the week")).toEqual({ period: "week", offset: 0, tag: "favorite" })
    expect(readSongPeriod("Favorite of the month")).toEqual({ period: "month", offset: 0, tag: "favorite" })
    expect(readSongPeriod("song of the month")).toEqual({ period: "month", offset: 0, tag: "favorite" })
    expect(readSongPeriod("month")).toEqual({ period: "month", offset: 0 })
  })

  it("reads last week and last month", () => {
    expect(readSongPeriod("fave of last week")).toEqual({ period: "week", offset: -1, tag: "favorite" })
    expect(readSongPeriod("on repeat last month")).toEqual({ period: "month", offset: -1, tag: "on-repeat" })
  })

  it("leaves lines about something else", () => {
    expect(readSongPeriod("I worked out a ton this week")).toBeNull()
    expect(readSongPeriod("dentist next tuesday")).toBeNull()
    expect(readSongPeriod("mo")).toBeNull()
    expect(readSongPeriod("favorite song")).toBeNull()
  })
})

describe("songPeriodKey", () => {
  const now = new Date(2026, 10, 22, 15, 0) // Sun Nov 22 2026
  it("names this and last week and month", () => {
    expect(songPeriodKey({ period: "month", offset: 0 }, now)).toBe("month:2026-11")
    expect(songPeriodKey({ period: "month", offset: -1 }, now)).toBe("month:2026-10")
    expect(songPeriodKey({ period: "week", offset: 0 }, now)).toMatch(/^week:/)
    expect(songPeriodKey({ period: "week", offset: -1 }, now)).not.toBe(songPeriodKey({ period: "week", offset: 0 }, now))
  })
})

describe("spotify links", () => {
  it("knows a track from a playlist and drops ?si", () => {
    expect(spotifyLinkKind("https://open.spotify.com/track/abc?si=1")).toBe("track")
    expect(spotifyLinkKind("https://open.spotify.com/intl-de/track/abc")).toBe("track")
    expect(spotifyLinkKind("https://open.spotify.com/playlist/xyz")).toBe("playlist")
    expect(spotifyLinkKind("https://spotify.link/q1w2")).toBe("short")
    expect(spotifyLinkKind("https://youtube.com/watch?v=1")).toBeNull()
    expect(cleanSpotifyUrl("https://open.spotify.com/track/abc?si=1")).toBe("https://open.spotify.com/track/abc")
  })
})

describe("addSongToRecord", () => {
  const base = { songs: [], palette: [], symbols: [] }
  it("adds once, keeps favorite, stacks notes", () => {
    const first = addSongToRecord(base, { title: "Spotify song", url: "https://open.spotify.com/track/a", tag: "favorite", note: "fav of the week" })
    expect(first.added).toBe(true)
    const again = addSongToRecord({ ...base, songs: first.songs }, { title: "Espresso", url: "https://open.spotify.com/track/a?si=9", tag: "on-repeat", note: "a lot this week" })
    expect(again.added).toBe(false)
    expect(again.songs).toHaveLength(1)
    expect(again.songs[0]).toMatchObject({ title: "Espresso", tag: "favorite", note: "fav of the week\na lot this week" })
  })
})
