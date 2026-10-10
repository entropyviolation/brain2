import { createRequire } from "node:module"
import { describe, expect, it } from "vitest"
import { deliverIngestReply } from "./deliver-reply"
import { extractTelegramMessage } from "../../scripts/telegram-file.mjs"

const require = createRequire(import.meta.url)
const electronExtract = require("../../electron/telegram-file.js").extractTelegramMessage as typeof extractTelegramMessage

describe("grocery pin reply extraction", () => {
  const update = {
    update_id: 9,
    message: {
      message_id: 3,
      date: 1_700_000_000,
      chat: { id: 5, type: "private" },
      text: "milk",
      reply_to_message: { message_id: 42, chat: { id: 5, type: "private" }, text: "list" },
    },
  }

  it("keeps reply_to_message.message_id", () => {
    expect(extractTelegramMessage(update)?.replyToMessageId).toBe(42)
    expect(electronExtract(update)?.replyToMessageId).toBe(42)
  })

  it("leaves a message that is not a reply without a target", () => {
    const plain = {
      update_id: 10,
      message: { message_id: 4, date: 1_700_000_000, chat: { id: 5, type: "private" }, text: "hello" },
    }
    expect(extractTelegramMessage(plain)?.replyToMessageId).toBeUndefined()
  })
})

describe("deliverIngestReply grocery card", () => {
  it("sends the card once when the reply is the pin", async () => {
    const card = "Grocery list\n• milk\n\nOther open shopping lists: Shopping list 2"
    const sent: string[] = []
    let pinned: number | undefined
    await deliverIngestReply(
      "5",
      { status: "ok", kind: "grocery", reply: card, summary: "Dump", pinText: card },
      {
        send: async (_chatId, text) => {
          sent.push(text)
          return { messageId: 42 }
        },
        pin: async (_chatId, messageId) => {
          pinned = messageId
        },
      },
    )
    expect(sent).toEqual([card])
    expect(pinned).toBe(42)
  })
})
