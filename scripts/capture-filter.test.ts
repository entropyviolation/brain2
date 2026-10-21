import { describe, expect, it } from "vitest"
import { chatOf, chatTypeOf, checkConfig, parseChatIds, shouldKeep } from "./capture-filter.mjs"

const msg = (id: number, type = "private") => ({ message: { text: "hi", chat: { id, type } } })

describe("capture filter", () => {
  const cfg = { chats: parseChatIds("111, -100222"), allowAny: false }

  it("keeps an allowlisted chat and drops others", () => {
    expect(shouldKeep(msg(111), cfg)).toBe(true)
    expect(shouldKeep(msg(999), cfg)).toBe(false)
  })

  it("reads edited_message", () => {
    const u = { edited_message: { chat: { id: 111, type: "private" } } }
    expect(chatOf(u)).toBe("111")
    expect(shouldKeep(u, cfg)).toBe(true)
    expect(shouldKeep({ edited_message: { chat: { id: 5, type: "private" } } }, cfg)).toBe(false)
  })

  it("reads the chat from a callback_query's nested message", () => {
    const u = { callback_query: { id: "x", message: { chat: { id: 111, type: "private" } } } }
    expect(chatOf(u)).toBe("111")
    expect(shouldKeep(u, cfg)).toBe(true)
    expect(shouldKeep({ callback_query: { message: { chat: { id: 7, type: "private" } } } }, cfg)).toBe(false)
  })

  it("drops updates with no chat", () => {
    expect(chatOf({ callback_query: { id: "inline" } })).toBe("")
    expect(shouldKeep({ callback_query: { id: "inline" } }, cfg)).toBe(false)
    expect(shouldKeep({}, cfg)).toBe(false)
    expect(shouldKeep(null, cfg)).toBe(false)
  })

  it("keeps a group only when its id is listed", () => {
    expect(chatTypeOf(msg(-100222, "supergroup"))).toBe("supergroup")
    expect(shouldKeep(msg(-100222, "supergroup"), cfg)).toBe(true)
    expect(shouldKeep(msg(-100333, "supergroup"), cfg)).toBe(false)
  })

  it("allow-any mode keeps private chats only", () => {
    const any = { chats: parseChatIds(""), allowAny: true }
    expect(shouldKeep(msg(42), any)).toBe(true)
    expect(shouldKeep(msg(-100, "group"), any)).toBe(false)
    expect(shouldKeep(msg(-100, "channel"), any)).toBe(false)
  })

  it("empty allowlist without allow-any keeps nothing", () => {
    expect(shouldKeep(msg(42), { chats: parseChatIds(""), allowAny: false })).toBe(false)
  })

  it("parses ids with spaces and blanks", () => {
    expect([...parseChatIds(" 1, ,2 ,, -3 ")]).toEqual(["1", "2", "-3"])
    expect(parseChatIds(undefined).size).toBe(0)
  })

  it("config check: empty fails, allow-any warns, listed passes", () => {
    const empty = parseChatIds("")
    expect(checkConfig({ chats: empty, allowAny: false })).toMatchObject({ ok: false })
    expect(checkConfig({ chats: empty, allowAny: true })).toMatchObject({ ok: true, warning: expect.any(String) })
    expect(checkConfig({ chats: parseChatIds("1"), allowAny: false })).toEqual({ ok: true })
  })
})
