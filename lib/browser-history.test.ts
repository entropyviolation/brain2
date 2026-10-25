import { readFileSync, existsSync } from "node:fs"
import { describe, expect, it } from "vitest"
import { analyse, cleanYouTubeTitle, mergeHistory, topicOf } from "./browser-history"

describe("browser-history", () => {
  it("dedupes across profiles and cleans titles", () => {
    const row = { visitTime: 1, url: "https://www.youtube.com/watch?v=abc", title: "(3) Hi - YouTube" }
    const v = mergeHistory([{ profile: "a", rows: [row] }, { profile: "b", rows: [row] }])
    expect(v).toHaveLength(1)
    const a = analyse(v)!
    expect(a.youtube.videos[0].title).toBe("Hi")
    expect(cleanYouTubeTitle("(657) X - YouTube")).toBe("X")
    expect(topicOf("Courtney & The Death of Empathy")).toBe("Philosophy & religion")
  })
})

describe("chrome runs", () => {
  it("times each video and names local servers", async () => {
    const { runsOf, videoWatch, devTitles, siteName, mergeInto } = await import("./browser-history")
    const m = (t: number, url: string, title: string) => ({ visitTime: t, url, title })
    const v = mergeInto([], [{ profile: "a", rows: [
      m(0, "https://www.youtube.com/watch?v=aaaaaaaaaaa", "(1) One - YouTube"),
      m(600000, "https://www.youtube.com/watch?v=bbbbbbbbbbb", "Two - YouTube"),
      m(900000, "http://localhost:3003/", "Lab"),
    ] }])
    const runs = runsOf(v)
    expect(runs).toHaveLength(2)
    expect(videoWatch(runs[0]).map((x) => [x.title, x.minutes])).toEqual([["One", 10], ["Two", 5]])
    expect(siteName("localhost:3003", devTitles(v))).toBe("Lab")
    expect(siteName("localhost:1")).toBe("Local dev server")
    expect(mergeInto(v, [{ profile: "b", rows: [] }])).toBe(v)
  })
})
