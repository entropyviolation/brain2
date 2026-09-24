import { describe, expect, it } from "vitest"
import { mapScreenTimeEvents, msToLocalDateMin, type AwEvent } from "./map-events"

function at(year: number, month: number, day: number, hour: number, minute: number, second = 0): string {
  return new Date(year, month - 1, day, hour, minute, second).toISOString()
}

function windowEvent(app: string, timestamp: string, duration: number, title?: string): AwEvent {
  return { timestamp, duration, data: title ? { app, title } : { app } }
}

function afk(status: "afk" | "not-afk", timestamp: string, duration: number): AwEvent {
  return { timestamp, duration, data: { status } }
}

function web(url: string, timestamp: string, duration: number): AwEvent {
  return { timestamp, duration, data: { url } }
}

const DAY = { y: 2026, m: 9, d: 21 }

describe("msToLocalDateMin", () => {
  it("uses the local calendar, not UTC", () => {
    const local = new Date(2026, 8, 21, 15, 30, 0)
    expect(msToLocalDateMin(local.getTime())).toEqual({ date: "2026-09-21", min: 15 * 60 + 30 })
  })
})

describe("mapScreenTimeEvents", () => {
  it("leaves an AFK gap untracked and keeps the not-afk intersection", () => {
    const start = at(DAY.y, DAY.m, DAY.d, 10, 0)
    const mapped = mapScreenTimeEvents(
      [windowEvent("Cursor", start, 3600)],
      [
        afk("not-afk", start, 20 * 60),
        afk("afk", at(DAY.y, DAY.m, DAY.d, 10, 20), 20 * 60),
        afk("not-afk", at(DAY.y, DAY.m, DAY.d, 10, 40), 20 * 60),
      ],
    )
    expect(mapped).toHaveLength(2)
    expect(mapped[0]).toMatchObject({ date: "2026-09-21", startMin: 600, endMin: 620, penId: "st-app-cursor" })
    expect(mapped[1]).toMatchObject({ date: "2026-09-21", startMin: 640, endMin: 660, penId: "st-app-cursor" })
    const minutes = mapped.reduce((sum, row) => sum + (row.endMin - row.startMin), 0)
    expect(minutes).toBe(40)
  })

  it("does not count a window that is only AFK, or a missing AFK status", () => {
    const start = at(DAY.y, DAY.m, DAY.d, 11, 0)
    expect(
      mapScreenTimeEvents([windowEvent("Cursor", start, 600)], [afk("afk", start, 600)]),
    ).toEqual([])
    expect(
      mapScreenTimeEvents([windowEvent("Cursor", start, 600)], [{ timestamp: start, duration: 600, data: {} }]),
    ).toEqual([])
  })

  it("drops pieces shorter than 15 seconds", () => {
    const start = at(DAY.y, DAY.m, DAY.d, 12, 0)
    const notAfk = [afk("not-afk", start, 60)]
    expect(mapScreenTimeEvents([windowEvent("Cursor", start, 10)], notAfk)).toEqual([])
    const kept = mapScreenTimeEvents([windowEvent("Cursor", start, 20)], notAfk)
    expect(kept).toHaveLength(1)
    expect(kept[0].endMin - kept[0].startMin).toBeGreaterThanOrEqual(1)
  })

  it("merges adjacent same-pen intervals", () => {
    const notAfk = [afk("not-afk", at(DAY.y, DAY.m, DAY.d, 10, 0), 2 * 3600)]
    const mapped = mapScreenTimeEvents(
      [
        windowEvent("Cursor", at(DAY.y, DAY.m, DAY.d, 10, 0), 1800),
        windowEvent("Cursor", at(DAY.y, DAY.m, DAY.d, 10, 30), 1800),
      ],
      notAfk,
    )
    expect(mapped).toEqual([
      expect.objectContaining({
        date: "2026-09-21",
        startMin: 600,
        endMin: 660,
        penId: "st-app-cursor",
        parentPenId: "st-cat-work",
      }),
    ])
  })

  it("splits a span at local midnight", () => {
    const mapped = mapScreenTimeEvents(
      [windowEvent("Cursor", at(DAY.y, DAY.m, DAY.d, 23, 30), 3600)],
      [afk("not-afk", at(DAY.y, DAY.m, DAY.d, 23, 0), 3 * 3600)],
    )
    expect(mapped).toHaveLength(2)
    expect(mapped[0]).toMatchObject({ date: "2026-09-21", startMin: 1410, endMin: 1440 })
    expect(mapped[1]).toMatchObject({ date: "2026-09-22", startMin: 0, endMin: 30 })
  })

  it("makes an overlapping web domain a child under Chrome", () => {
    const mapped = mapScreenTimeEvents(
      [windowEvent("Chrome", at(DAY.y, DAY.m, DAY.d, 10, 0), 3600, "GitHub")],
      [afk("not-afk", at(DAY.y, DAY.m, DAY.d, 10, 0), 3600)],
      [web("https://www.github.com/brain2", at(DAY.y, DAY.m, DAY.d, 10, 15), 1800)],
    )
    expect(mapped).toHaveLength(3)
    expect(mapped[0]).toMatchObject({
      startMin: 600,
      endMin: 615,
      penId: "st-app-chrome",
      parentPenId: "st-cat-browsing",
    })
    expect(mapped[1]).toMatchObject({
      startMin: 615,
      endMin: 645,
      domain: "github.com",
      penId: "st-app-chrome-github-com",
      parentPenId: "st-app-chrome",
      penName: "github.com",
    })
    expect(mapped[2]).toMatchObject({
      startMin: 645,
      endMin: 660,
      penId: "st-app-chrome",
      parentPenId: "st-cat-browsing",
    })
  })

  it("ignores empty app names", () => {
    const start = at(DAY.y, DAY.m, DAY.d, 10, 0)
    expect(
      mapScreenTimeEvents(
        [{ timestamp: start, duration: 600, data: { app: "  " } }],
        [afk("not-afk", start, 600)],
      ),
    ).toEqual([])
  })
})
