/**
 * Saved log keywords and log-line clocks.
 * Military time and US dates apply to log lines, not to inbox capture.
 */
import { beforeEach, describe, expect, it } from "vitest"
import { resetAllStores } from "@/tests/test-utils"
import { formatLocalDateKey } from "@/lib/date-utils"
import { useLogKeywordsStore } from "@/lib/log-keywords-store"
import { useTaskStore } from "@/lib/task-store"
import { useTimeTrackingStore } from "@/lib/time-tracking-store"
import { clearOpenLogStarts } from "./apply-discrete-event"
import { resetIngestDedupeForTests } from "./dedupe"
import { ingestIncoming } from "./executor"
import { parseMessage } from "./parse-message"
import { parseLogPayload } from "./parse-tracking-note"
import type { IncomingMessage } from "./types"

const SENT = new Date(2026, 8, 23, 15, 4, 0)

function sim(text: string, receivedAt = SENT): IncomingMessage {
  return {
    text,
    source: { channel: "simulate", chatId: "sim-keywords", isGroup: false },
    receivedAt: receivedAt.toISOString(),
  }
}

function entry(title: string) {
  return useTimeTrackingStore.getState().entries.find((row) => row.title === title)
}

beforeEach(() => {
  resetAllStores()
  resetIngestDedupeForTests()
  clearOpenLogStarts()
})

describe("log keywords", () => {
  it("logs a saved phrase, keeps the longest match, and lists without writing a row", () => {
    const store = useLogKeywordsStore.getState()
    store.addKeyword("went")
    store.addKeyword("went outside")
    store.addKeyword("walked")

    const logged = ingestIncoming(sim("log: went outside"), SENT)
    expect(logged.status).toBe("ok")
    expect(entry("went outside")).toMatchObject({
      kind: "instant",
      scopeId: "activity",
      eventKind: "went outside",
      date: formatLocalDateKey(SENT),
      startMin: 15 * 60 + 4,
    })

    ingestIncoming(sim("log went outside 12:04"), SENT)
    const noon = useTimeTrackingStore.getState().entries.filter((row) => row.title === "went outside")
    expect(noon).toHaveLength(2)
    expect(noon.some((row) => row.startMin === 12 * 60 + 4)).toBe(true)
    expect(noon.every((row) => row.eventKind === "went outside")).toBe(true)

    const before = useTimeTrackingStore.getState().entries.length
    const listed = ingestIncoming(sim("log keywords"), SENT)
    expect(listed.status).toBe("ok")
    expect(listed.reply).toBe("Log keywords\n1. went\n2. went outside\n3. walked")
    expect(ingestIncoming(sim("log: keywords"), SENT).reply).toBe(listed.reply)
    expect(useTimeTrackingStore.getState().entries.length).toBe(before)

    ingestIncoming(sim("log: walked"), SENT)
    expect(entry("walked")).toMatchObject({ eventKind: "walked", startMin: 15 * 60 + 4 })

    ingestIncoming(sim("went outside"), SENT)
    expect(useTimeTrackingStore.getState().entries.filter((row) => row.title === "went outside")).toHaveLength(2)
    expect(useTaskStore.getState().tasks.some((row) => row.description === "went outside")).toBe(true)
  })

  it("reads military clocks, dotted meridians, and a US date on log lines", () => {
    useLogKeywordsStore.getState().addKeyword("went outside")
    useLogKeywordsStore.getState().addKeyword("drank water")

    ingestIncoming(sim("log: went outside 1pm"), SENT)
    ingestIncoming(sim("log: drank water 1:00 PM"), SENT)
    ingestIncoming(sim("log: went outside 1:00"), SENT)
    ingestIncoming(sim("log: went outside 7/4/26 1:00"), SENT)
    ingestIncoming(sim("log: left room 1:00 p.m."), SENT)
    ingestIncoming(sim("log: left room at 3:30"), SENT)

    expect(entry("drank water")?.startMin).toBe(13 * 60)
    const outs = useTimeTrackingStore.getState().entries.filter((row) => row.title === "went outside")
    expect(outs.map((row) => [row.date, row.startMin])).toEqual(
      expect.arrayContaining([
        [formatLocalDateKey(SENT), 13 * 60],
        [formatLocalDateKey(SENT), 1 * 60],
        ["2026-07-04", 1 * 60],
      ]),
    )
    const rooms = useTimeTrackingStore.getState().entries.filter((row) => row.title === "left room")
    expect(rooms.map((row) => row.startMin).sort((a, b) => a - b)).toEqual([3 * 60 + 30, 13 * 60])
    expect(rooms.every((row) => row.date === formatLocalDateKey(SENT))).toBe(true)

    const parsed = parseLogPayload("went outside 7/4/2026 18:37", SENT, ["went outside"])
    expect(parsed).toMatchObject({ shape: "point", title: "went outside" })
    if (parsed?.shape === "point") {
      expect(parsed.at.getFullYear()).toBe(2026)
      expect(parsed.at.getMonth()).toBe(6)
      expect(parsed.at.getDate()).toBe(4)
      expect(parsed.at.getHours()).toBe(18)
      expect(parsed.at.getMinutes()).toBe(37)
    }

    const bare = parseLogPayload("went outside 12", SENT, ["went outside"])
    expect(bare).toMatchObject({ shape: "point", title: "went outside 12" })
    if (bare?.shape === "point") expect(bare.at.getHours()).toBe(15)

    expect(parseMessage("log went outside 12:04")).toMatchObject({
      kind: "event-log",
      payload: "went outside 12:04",
    })
    expect(parseMessage("went outside").kind).toBe("capture")
    expect(parseMessage("smoked weed").kind).not.toBe("event-log")
  })

  it("logs a saved phrase that still carries countId", () => {
    useLogKeywordsStore.setState({
      keywords: [{ phrase: "went outside", countId: "steps" }],
    })
    const logged = ingestIncoming(sim("log: went outside"), SENT)
    expect(logged.status).toBe("ok")
    expect(entry("went outside")).toMatchObject({
      kind: "instant",
      scopeId: "activity",
      title: "went outside",
    })
    expect(useLogKeywordsStore.getState().keywords).toEqual([{ phrase: "went outside", countId: "steps" }])
    const before = useTimeTrackingStore.getState().entries.length
    const listed = ingestIncoming(sim("log keywords"), SENT)
    expect(listed.reply).toBe("Log keywords\n1. went outside")
    expect(useTimeTrackingStore.getState().entries.length).toBe(before)
  })

  it("still logs a whole-message discrete trigger without a log prefix", () => {
    const smoked = ingestIncoming(sim("smoked weed"), SENT)
    expect(smoked.status).toBe("ok")
    expect(entry("smoked weed")?.kind).toBe("instant")
    const drank = ingestIncoming(sim("drank water"), SENT)
    expect(drank.status).toBe("ok")
    expect(entry("drank water")?.eventKind).toBe("intake.drink")
  })
})
