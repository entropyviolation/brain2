import { describe, expect, it } from "vitest"
import {
  CORE_DATA_EPOCH_MS,
  callService,
  coreDataToMs,
  decodeCallCursor,
  encodeCallCursor,
  msToCoreData,
  rowToCallRecord,
  type CallHistoryRow,
} from "./calls"

const row = (over: Partial<CallHistoryRow> = {}): CallHistoryRow => ({
  ZUNIQUE_ID: "CALL-1",
  ZDATE: 783_000_000.25,
  ZDURATION: 912.4,
  ZORIGINATED: 0,
  ZANSWERED: 1,
  ZADDRESS: "(555) 123-4567",
  ZNAME: "Jane Doe",
  ZCALLTYPE: 1,
  ZSERVICE_PROVIDER: "com.apple.Telephony",
  ...over,
})

describe("Core Data time", () => {
  it("counts seconds from 2001-01-01 UTC", () => {
    expect(coreDataToMs(0)).toBe(Date.UTC(2001, 0, 1))
    expect(coreDataToMs(1.5)).toBe(CORE_DATA_EPOCH_MS + 1500)
    expect(msToCoreData(coreDataToMs(783_000_000.25))).toBeCloseTo(783_000_000.25, 3)
  })
})

describe("rowToCallRecord", () => {
  it("maps an answered incoming call", () => {
    expect(rowToCallRecord(row())).toEqual({
      type: "call",
      source: "calls",
      sourceId: "CALL-1",
      at: coreDataToMs(783_000_000.25),
      direction: "in",
      party: { handle: "(555) 123-4567", displayName: "Jane Doe" },
      durationSec: 912,
      answered: true,
      service: "phone",
    })
  })

  it("keeps a missed call at zero seconds", () => {
    const r = rowToCallRecord(row({ ZANSWERED: 0, ZDURATION: 0, ZNAME: null }))
    expect(r).toMatchObject({ answered: false, durationSec: 0, direction: "in", party: { handle: "(555) 123-4567" } })
    expect(r?.party.displayName).toBeUndefined()
  })

  it("counts an outgoing call with a duration as answered", () => {
    expect(rowToCallRecord(row({ ZORIGINATED: 1, ZANSWERED: 0, ZDURATION: 60 }))).toMatchObject({
      direction: "out",
      answered: true,
      durationSec: 60,
    })
  })

  it("decodes a blob address and drops rows with no id or date", () => {
    expect(rowToCallRecord(row({ ZADDRESS: new TextEncoder().encode("+15551234567") }))?.party.handle).toBe("+15551234567")
    expect(rowToCallRecord(row({ ZUNIQUE_ID: "" }))).toBeNull()
    expect(rowToCallRecord(row({ ZDATE: null as unknown as number }))).toBeNull()
  })
})

describe("callService", () => {
  it("names phone, FaceTime and VoIP apps", () => {
    expect(callService({ ZCALLTYPE: 1 })).toBe("phone")
    expect(callService({ ZCALLTYPE: 8, ZSERVICE_PROVIDER: "com.apple.FaceTime" })).toBe("facetime-video")
    expect(callService({ ZCALLTYPE: 16, ZSERVICE_PROVIDER: "com.apple.FaceTime" })).toBe("facetime-audio")
    expect(callService({ ZCALLTYPE: 1, ZSERVICE_PROVIDER: "net.whatsapp.WhatsApp" })).toBe("net.whatsapp.WhatsApp")
    expect(callService({})).toBeUndefined()
  })
})

describe("call cursor", () => {
  it("round-trips the date exactly", () => {
    const c = { date: 783_000_000.123456, uniqueId: "A|B" }
    expect(decodeCallCursor(encodeCallCursor(c))).toEqual(c)
  })

  it("treats a missing or broken cursor as a fresh start", () => {
    expect(decodeCallCursor(undefined)).toBeUndefined()
    expect(decodeCallCursor("42")).toBeUndefined()
    expect(decodeCallCursor("x|id")).toBeUndefined()
  })
})
