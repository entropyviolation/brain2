import { describe, it, expect, beforeEach } from "vitest"
import { resetAllStores } from "@/tests/test-utils"
import { useIngestStore } from "./ingest-store"
import { BIM_CHAT_ID, bimChoices, sendToBim, useBimChatStore, useBimFactsStore } from "./bim-chat"
import { BIM_PING } from "./bim"
import type { ApplyResult } from "./types"

describe("BIM Chat", () => {
  beforeEach(() => {
    resetAllStores()
    useBimChatStore.setState({ lines: [], busy: false })
  })

  it("answers through the bot executor without Telegram pairing", async () => {
    useIngestStore.setState({ enabled: false, allowedChats: [] } as never)
    const line = await sendToBim("ping")
    expect(line.who).toBe("bim")
    expect(line.text).toBe(BIM_PING)
  })

  it("keeps the Telegram allowlist untouched", async () => {
    const before = useIngestStore.getState().allowedChats
    await sendToBim("info")
    expect(useIngestStore.getState().allowedChats).toEqual(before)
  })

  it("logs writes under its own chat id", async () => {
    await sendToBim("inbox: buy stamps")
    const event = useIngestStore.getState().events[0]
    expect(event.channel).toBe("simulate")
    expect(event.chatId).toBe(BIM_CHAT_ID)
  })

  it("maps clarify buttons onto the same typed answers", () => {
    const result = {
      status: "needs_clarify",
      reply: "Which?",
      kind: "habit",
      pending: { kind: "duplicate", query: "x", candidates: [], createdAt: "" },
    } as unknown as ApplyResult
    expect(bimChoices(result).map((c) => c.text)).toEqual(["see", "again", "dismiss"])
  })

  it("store appends both sides of the turn", async () => {
    await useBimChatStore.getState().send("ping")
    const lines = useBimChatStore.getState().lines
    expect(lines.map((l) => l.who)).toEqual(["you", "bim"])
    expect(useBimChatStore.getState().busy).toBe(false)
  })
})

describe("ladder guards", () => {
  beforeEach(() => {
    resetAllStores()
  })

  it("does not log a question", async () => {
    const line = await sendToBim("what was yesterday like for me?")
    expect(line.status).toBe("ignored")
    expect(line.text).toMatch(/question/i)
  })

  it("logs a lone x instead of asking what was got", async () => {
    const line = await sendToBim("x")
    expect(line.text).not.toMatch(/Got what/)
  })

  it("answers info differently in BIM chat than on Telegram", async () => {
    const chat = await sendToBim("info")
    expect(chat.text).toContain("just talk")
    expect(chat.text).toContain("Shortcuts skip the model")
  })
})

describe("photos in BIM chat", () => {
  const photo = { kind: "photo" as const, mime: "image/jpeg", name: "p.jpg", dataUrl: "idb:hold_chat" }

  beforeEach(() => {
    resetAllStores()
    useBimChatStore.setState({ lines: [], busy: false })
  })

  it("asks what the photo is when there is no clear caption, with a tap answer for each place", async () => {
    const line = await sendToBim("album cover inspo", new Date(), { photos: [photo] })
    expect(line.status).toBe("needs_clarify")
    expect(line.choices?.map((c) => c.text)).toEqual(["journal", "outfit", "log", "inbox", "skip"])
  })

  it("files straight away when the caption names the place", async () => {
    const line = await sendToBim("inbox: album cover inspo", new Date(), { photos: [photo] })
    expect(line.status).toBe("ok")
  })

  it("shows the photo in the transcript and sends a photo with no words", async () => {
    await useBimChatStore.getState().send("", [photo])
    const lines = useBimChatStore.getState().lines
    expect(lines[0]?.text).toContain("📷")
    expect(lines).toHaveLength(2)
  })
})

describe("told facts", () => {
  beforeEach(() => {
    resetAllStores()
    useBimFactsStore.setState({ facts: [] })
  })

  it("keeps a moment, counts down to it, and does not assume it repeats", async () => {
    const midnight = new Date(2026, 10, 2, 0, 0)
    const told = await sendToBim("Claude limit resets at 2:00am", midnight)
    expect(told.text).toContain("2:00 am")
    const soon = await sendToBim("how long until claude limit resets?", new Date(2026, 10, 2, 1, 5))
    expect(soon.text).toBe("In 55 minutes (at 2:00 am).")
    const later = await sendToBim("how long until claude limit resets?", new Date(2026, 10, 3, 1, 5))
    expect(later.text).toContain("I don't know")
    expect(later.text).toContain("I'll remember")
    const again = await sendToBim("it resets at 3am", new Date(2026, 10, 3, 1, 6))
    expect(again.text).toContain("3:00 am")
  })

  it("resolves 'in 2 hours' when told", async () => {
    await sendToBim("Claude limit resets in 2 hours", new Date(2026, 10, 2, 0, 0))
    const r = await sendToBim("when does claude limit reset?", new Date(2026, 10, 2, 1, 5))
    expect(r.text).toBe("In 55 minutes (at 2:00 am).")
  })
})
