import { readFileSync, existsSync } from "node:fs"
import { describe, expect, it } from "vitest"
import { analyse, cleanYouTubeTitle, historyFileFromPayload, mergeHistory, mergeInto, parseHistoryExport, topicOf } from "./browser-history"

describe("browser-history", () => {
  it("dedupes across profiles and cleans titles", () => {
    const row = { visitTime: 1, url: "https://www.youtube.com/watch?v=abc", title: "(3) Hi - YouTube" }
    const v = mergeHistory([{ profile: "a", rows: [row] }, { profile: "b", rows: [row] }])
    expect(v).toHaveLength(1)
    expect(v[0].profile).toBe("a")
    const a = analyse(v)!
    expect(a.youtube.videos[0].title).toBe("Hi")
    expect(cleanYouTubeTitle("(657) X - YouTube")).toBe("X")
    expect(topicOf("Courtney & The Death of Empathy")).toBe("Philosophy & religion")
  })

  it("merges profiles and a later file only adds visits that are new", () => {
    const old = { visitTime: 1_700_000_000_000, url: "https://kept.example/old", title: "Old" }
    const shared = { visitTime: 1_700_000_100_400, url: "https://shared.example/", title: "Shared" }
    const fresh = { visitTime: 1_700_000_200_000, url: "https://new.example/", title: "New" }
    const kept = mergeInto([], [{ profile: "Work", rows: [old, shared] }])
    const again = mergeInto(kept, [
      { profile: "Phone", rows: [shared, fresh] },
      { profile: "Work", rows: [old] },
    ])
    expect(again.map((v) => [v.profile, v.url])).toEqual([
      ["Work", "https://kept.example/old"],
      ["Work", "https://shared.example/"],
      ["Phone", "https://new.example/"],
    ])
    expect(mergeInto(again, [{ profile: "Phone", rows: [shared, fresh] }])).toBe(again)
  })

  it("reads JSON, CSV, and Takeout, and does not double a second-resolution re-upload", () => {
    const when = new Date(2024, 0, 2, 3, 4, 5, 400).getTime()
    const json = parseHistoryExport(JSON.stringify([
      { url: "https://example.com/a", title: "A", visitTime: when, transition: "link" },
      { title: "skipped" },
      { url: "https://example.com/b", visitTime: when },
    ]))
    expect(json).toHaveLength(2)
    const wrapped = parseHistoryExport(JSON.stringify({ history: [{ url: "https://example.com/a", visitTime: when }] }))
    expect(wrapped).toHaveLength(1)
    const usec = when * 1000
    const takeout = parseHistoryExport(JSON.stringify({ "Browser History": [{ url: "https://example.com/a", title: "A", time_usec: usec, page_transition: "LINK" }] }))
    expect(takeout[0].visitTime).toBe(when)
    expect(takeout[0].transition).toBe("link")

    const csv = `order,id,date,time,title,url,visitCount,typedCount,transition\r\n1,1,1/2/2024,3:04:05,"A, quoted",https://example.com/a,1,0,link\r\n2,2,1/2/2024,3:04:05 PM,Later,https://example.com/c,1,0,typed\r\n`
    const fromCsv = parseHistoryExport(csv)
    expect(fromCsv.map((r) => [r.title, r.url, new Date(r.visitTime).getHours()])).toEqual([
      ["A, quoted", "https://example.com/a", 3],
      ["Later", "https://example.com/c", 15],
    ])

    const kept = mergeInto([], [{ profile: "Work", rows: json }])
    const csvFile = [{ profile: "Work", rows: fromCsv.filter((r) => r.url.endsWith("/a")) }]
    expect(mergeInto(kept, csvFile)).toBe(kept)
    const second = `url,date,time\nhttps://example.com/a,1/2/2024,3:04:05\nhttps://example.com/a,1/2/2024,3:04:05\n`
    const doubled = parseHistoryExport(second)
    expect(doubled).toHaveLength(2)
    const withRepeat = mergeInto([], [{ profile: "Work", rows: doubled }])
    expect(withRepeat).toHaveLength(2)
    expect(mergeInto(withRepeat, [{ profile: "Work", rows: doubled }])).toBe(withRepeat)
  })

  it("reads the Excel columns Quick Chrome History Export writes", async () => {
    const XLSX = await import("xlsx")
    const { visitsFromRecords } = await import("./browser-history")
    const sheet = XLSX.utils.json_to_sheet([
      { order: 1, id: "1", date: "1/2/2024", time: "3:04:05", title: "A", url: "https://example.com/a", visitCount: 1, typedCount: 0, transition: "link" },
    ])
    const rows = XLSX.utils.sheet_to_json(sheet, { raw: false, defval: "" })
    const visits = visitsFromRecords(rows)
    expect(visits.map((row) => [row.url, new Date(row.visitTime).getHours()])).toEqual([["https://example.com/a", 3]])
  })

  it("reads the Brain2 extension envelope", () => {
    const file = historyFileFromPayload({
      brain2: "chrome-history",
      profile: "Work",
      day: "2026-10-26",
      visits: [{ url: "https://example.com/a", title: "A", visitTime: 1_700_000_000_000, transition: "typed" }],
    })
    expect(file).toEqual({
      profile: "Work",
      rows: [{ url: "https://example.com/a", title: "A", visitTime: 1_700_000_000_000, transition: "typed" }],
    })
    expect(historyFileFromPayload({ visits: [] })).toBeNull()
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
