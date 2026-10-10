import { describe, expect, it } from "vitest"
import {
  PRIVATE_SLASH_MENU,
  callbackQueryToIncoming,
  choiceTextFromCallback,
  commandMenuRegistration,
  inlineKeyboardForResult,
} from "./telegram-ui.mjs"

describe("private slash menu", () => {
  it("registers only start, help, now, quicklists, and info for private chats", () => {
    expect(PRIVATE_SLASH_MENU.map((row) => row.command)).toEqual([
      "start",
      "help",
      "now",
      "quicklists",
      "info",
    ])
    const calls = commandMenuRegistration()
    const set = calls.find((call) => call.method === "setMyCommands")
    expect(set?.params.scope).toBe(JSON.stringify({ type: "all_private_chats" }))
    const commands = JSON.parse(set?.params.commands || "[]")
    expect(commands).toHaveLength(5)
    expect(commands.map((row: { command: string }) => row.command)).toEqual([
      "start",
      "help",
      "now",
      "quicklists",
      "info",
    ])
    expect(JSON.stringify(commands)).not.toMatch(/store|groc|undo/)
    const scopes = calls
      .filter((call) => call.method === "deleteMyCommands")
      .map((call) => JSON.parse(call.params.scope).type)
    expect(scopes).toEqual(["all_group_chats", "default"])
  })
})

describe("inline question buttons", () => {
  it("puts numbered buttons on a clarify list and keeps callback data short", () => {
    const markup = inlineKeyboardForResult({
      status: "needs_clarify",
      pending: {
        kind: "habit",
        candidates: [
          { id: "habit-very-long-id-that-must-not-be-the-callback", name: "Read" },
          { id: "other", name: "Stretch" },
        ],
      },
    })
    expect(markup?.inline_keyboard.map((row) => row[0].callback_data)).toEqual(["n:1", "n:2"])
    expect(markup?.inline_keyboard[0][0].text).toBe("1. Read")
    expect(JSON.stringify(markup)).not.toMatch(/habit-very-long/)
    expect(JSON.stringify(markup)).not.toMatch(/reply_keyboard/)
    for (const row of markup?.inline_keyboard || []) {
      for (const button of row) {
        expect(new TextEncoder().encode(button.callback_data).length).toBeLessThanOrEqual(64)
      }
    }
  })

  it("offers see, again, and dismiss for a duplicate question", () => {
    const markup = inlineKeyboardForResult({
      status: "needs_clarify",
      pending: { kind: "duplicate", candidates: [] },
    })
    expect(markup?.inline_keyboard.map((row) => row[0].callback_data)).toEqual([
      "w:see",
      "w:again",
      "w:dismiss",
    ])
  })

  it("offers the receipt number plus inv and skip", () => {
    const markup = inlineKeyboardForResult({
      status: "needs_clarify",
      pending: {
        kind: "receipt",
        candidates: [{ id: "line", name: "Oats" }],
      },
    })
    const data = markup?.inline_keyboard.flat().map((button) => button.callback_data)
    expect(data).toEqual(["n:1", "w:inv", "w:skip"])
  })

  it("leaves ritual questions as plain text", () => {
    expect(
      inlineKeyboardForResult({
        status: "needs_clarify",
        pending: { kind: "ritual", candidates: [{ id: "1", name: "Start over" }] },
      }),
    ).toBeUndefined()
  })

  it("maps a tap onto the same text a typed reply uses", () => {
    expect(choiceTextFromCallback("n:1")).toBe("1")
    expect(choiceTextFromCallback("w:see")).toBe("see")
    expect(choiceTextFromCallback("w:inv")).toBe("inv")
    expect(choiceTextFromCallback("w:skip")).toBe("skip")
    expect(choiceTextFromCallback("see")).toBeNull()
    expect(choiceTextFromCallback("n:0")).toBeNull()
    const incoming = callbackQueryToIncoming({
      update_id: 9,
      callback_query: {
        id: "cq",
        data: "n:2",
        from: { id: 4, username: "ada" },
        message: { message_id: 12, chat: { id: 7, type: "private" } },
      },
    })
    expect(incoming?.payload.text).toBe("2")
    expect(incoming?.payload.chatId).toBe("7")
    expect(incoming?.payload.telegramUpdateId).toBe(9)
    expect(incoming?.clearMarkup).toEqual({ chatId: "7", messageId: 12 })
  })
})
