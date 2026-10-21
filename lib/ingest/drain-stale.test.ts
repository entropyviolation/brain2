import { describe, expect, it } from "vitest"
import { drainStaleMinutes, formatAge, prefixStaleReply, staleReplyNote } from "./drain-stale"

const NOW = Date.parse("2026-10-20T12:00:00Z")
const ago = (ms: number) => new Date(NOW - ms).toISOString()

describe("drain-stale", () => {
  it("is quiet for fresh texts", () => {
    expect(staleReplyNote(ago(5 * 60000), NOW, 30)).toBe("")
    expect(staleReplyNote(ago(30 * 60000), NOW, 30)).toBe("")
  })
  it("notes old texts", () => {
    expect(staleReplyNote(ago(3 * 3600000), NOW, 30)).toBe("(from 3h ago)")
    expect(staleReplyNote(ago(45 * 60000), NOW, 30)).toBe("(from 45m ago)")
    expect(staleReplyNote(ago(3 * 86400000), NOW, 30)).toBe("(from 3d ago)")
  })
  it("ignores missing or bad times", () => {
    expect(staleReplyNote(undefined, NOW, 30)).toBe("")
    expect(staleReplyNote("nope", NOW, 30)).toBe("")
  })
  it("parses the env value", () => {
    expect(drainStaleMinutes(undefined)).toBe(30)
    expect(drainStaleMinutes("")).toBe(30)
    expect(drainStaleMinutes("abc")).toBe(30)
    expect(drainStaleMinutes("10")).toBe(10)
  })
  it("formats age", () => {
    expect(formatAge(1000)).toBe("1m")
    expect(formatAge(47 * 3600000)).toBe("47h")
  })
  it("prefixes only when there is a note", () => {
    expect(prefixStaleReply("ok", "")).toBe("ok")
    expect(prefixStaleReply("ok", "(from 3h ago)")).toBe("(from 3h ago)\nok")
  })
})
