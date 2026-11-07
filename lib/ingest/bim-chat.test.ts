import { describe, it, expect, beforeEach } from "vitest"
import { resetAllStores } from "@/tests/test-utils"
import { useIngestStore } from "./ingest-store"
import { BIM_CHAT_ID, bimChoices, sendToBim, useBimChatStore, useBimFactsStore } from "./bim-chat"
import { BIM_PING } from "./bim"
import type { ApplyResult } from "./types"
import { useEventStore } from "@/lib/event-store"
import { PASTED } from "@/lib/flight-bimby/fixture"
import { useTaskStore } from "@/lib/task-store"

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

  it("files pasted flight confirmations as Flight items with calendar events, once", async () => {
    useEventStore.setState({ events: [] })
    const line = await sendToBim(PASTED, new Date("2026-11-07T12:00:00"))
    expect(line.text).toMatch(/Filed JetBlue SAN → JFK \(WTWUQC\)/)
    expect(line.text).toMatch(/Filed Alaska Airlines AS25 JFK → SAN \(LLVAJR\)/)
    expect(useTaskStore.getState().tasks.filter((t) => t.type === "flight")).toHaveLength(2)
    expect(useEventStore.getState().events.filter((e) => e.id.startsWith("flight-event-"))).toHaveLength(2)
    const again = await sendToBim(PASTED, new Date("2026-11-07T12:05:00"))
    expect(again.text).toMatch(/Already had/)
    expect(useTaskStore.getState().tasks.filter((t) => t.type === "flight")).toHaveLength(2)
  })

  it("leaves a plan to book flights alone", async () => {
    const line = await sendToBim("need to book flights but im stuck")
    expect(line.text).not.toMatch(/Filed/)
    expect(useTaskStore.getState().tasks.filter((t) => t.type === "flight")).toHaveLength(0)
  })

  it("answers 'when am I flying to new york?' from the Flight items, not the model", async () => {
    useEventStore.setState({ events: [] })
    await sendToBim(PASTED, new Date("2026-11-07T12:00:00"))
    const line = await sendToBim("when am I flying to new york?", new Date("2026-11-07T12:03:00"), { llm: true })
    expect(line.text).toContain("Thursday, November 12 at 11:48 AM (in 5 days)")
    expect(line.route).toBeUndefined()
  })
})
