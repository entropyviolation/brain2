import { describe, expect, it } from "vitest"
import { APPLE_EPOCH_MS, appleDateToMs, decodeAttributedBody, rowToMessage, type MessageRow } from "./messages"

/** A minimal typedstream NSAttributedString around `text`, laid out like chat.db's. */
function fakeAttributedBody(text: string): Uint8Array {
  const enc = new TextEncoder()
  const body = enc.encode(text)
  let len: number[]
  if (body.length < 0x80) len = [body.length]
  else if (body.length <= 0xffff) len = [0x81, body.length & 0xff, body.length >> 8]
  else len = [0x82, body.length & 0xff, (body.length >> 8) & 0xff, (body.length >> 16) & 0xff, body.length >>> 24]
  return new Uint8Array([
    ...enc.encode("\x04\x0bstreamtyped"),
    0x81, 0xe8, 0x03, 0x84, 0x01, 0x40, 0x84, 0x84, 0x84, 0x12,
    ...enc.encode("NSAttributedString"),
    0x00, 0x84, 0x84, 0x08,
    ...enc.encode("NSObject"),
    0x00, 0x85, 0x92, 0x84, 0x84, 0x84, 0x08,
    ...enc.encode("NSString"),
    0x01, 0x94, 0x84, 0x01, 0x2b,
    ...len,
    ...body,
    0x86, 0x84, 0x02, 0x69, 0x49, 0x01,
  ])
}

const row = (over: Partial<MessageRow> = {}): MessageRow => ({
  rowid: 1,
  guid: "G-1",
  text: "hello",
  attributedBody: null,
  date: 0,
  isFromMe: 0,
  service: "iMessage",
  handle: "+15551234567",
  associatedMessageType: 0,
  itemType: 0,
  chatIdentifier: "+15551234567",
  chatGuid: "iMessage;-;+15551234567",
  chatDisplayName: null,
  members: ["+15551234567"],
  attachments: [],
  ...over,
})

describe("appleDateToMs", () => {
  it("reads nanoseconds and old-style seconds", () => {
    const at = Date.UTC(2024, 4, 1, 12, 30)
    const secs = (at - APPLE_EPOCH_MS) / 1000
    expect(appleDateToMs(secs * 1e9)).toBe(at)
    expect(appleDateToMs(BigInt(secs) * BigInt(1e9))).toBe(at)
    expect(appleDateToMs(secs)).toBe(at)
    expect(appleDateToMs(0)).toBe(APPLE_EPOCH_MS)
  })
})

describe("decodeAttributedBody", () => {
  it("finds the NSString payload", () => {
    expect(decodeAttributedBody(fakeAttributedBody("on my way 🚗"))).toBe("on my way 🚗")
  })

  it("reads 0x81 and 0x82 lengths", () => {
    const long = "x".repeat(300)
    expect(decodeAttributedBody(fakeAttributedBody(long))).toBe(long)
    const huge = "y".repeat(70_000)
    expect(decodeAttributedBody(fakeAttributedBody(huge))).toBe(huge)
  })

  it("gives up on junk", () => {
    expect(decodeAttributedBody(null)).toBeUndefined()
    expect(decodeAttributedBody(new Uint8Array([1, 2, 3]))).toBeUndefined()
    const cut = fakeAttributedBody("hello world").subarray(0, -12)
    expect(decodeAttributedBody(cut)).toBeUndefined()
  })
})

describe("rowToMessage", () => {
  it("maps a 1:1 incoming text", () => {
    const secs = 700_000_000
    expect(rowToMessage(row({ date: secs * 1e9 }))).toEqual({
      type: "message",
      source: "messages",
      sourceId: "G-1",
      at: APPLE_EPOCH_MS + secs * 1000,
      direction: "in",
      party: { handle: "+15551234567" },
      threadId: "+15551234567",
      body: "hello",
      service: "iMessage",
    })
  })

  it("falls back to attributedBody and keeps attachments", () => {
    const r = rowToMessage(
      row({ text: null, attributedBody: fakeAttributedBody("￼look"), attachments: ["~/Library/Messages/Attachments/ab/01/IMG_1.heic"] }),
    )
    expect(r?.body).toBe("look")
    expect(r?.attachments).toEqual(["~/Library/Messages/Attachments/ab/01/IMG_1.heic"])
  })

  it("names group members and the first member for outgoing", () => {
    const group = { chatIdentifier: "chat123", chatDisplayName: "Climbing", members: ["+15550000001", "+15550000002", "a@b.co"] }
    const out = rowToMessage(row({ ...group, isFromMe: 1, handle: null }))
    expect(out).toMatchObject({ direction: "out", party: { handle: "+15550000001" }, threadId: "chat123", threadName: "Climbing" })
    expect(out?.members).toEqual([{ handle: "+15550000002" }, { handle: "a@b.co" }])
    const inc = rowToMessage(row({ ...group, handle: "+15550000002" }))
    expect(inc?.party.handle).toBe("+15550000002")
    expect(inc?.members).toEqual([{ handle: "+15550000001" }, { handle: "a@b.co" }])
  })

  it("skips tapbacks, group events and empty rows", () => {
    expect(rowToMessage(row({ associatedMessageType: 2000, text: "Loved “hello”" }))).toBeNull()
    expect(rowToMessage(row({ associatedMessageType: 3001 }))).toBeNull()
    expect(rowToMessage(row({ itemType: 2, text: null }))).toBeNull()
    expect(rowToMessage(row({ text: null }))).toBeNull()
  })
})
