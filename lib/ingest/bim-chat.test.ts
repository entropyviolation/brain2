import { describe, it, expect, beforeEach } from "vitest"
import { resetAllStores } from "@/tests/test-utils"
import { useIngestStore } from "./ingest-store"
import { BIM_CHAT_ID, bimChoices, sendToBim, useBimChatStore } from "./bim-chat"
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
