import { afterEach, describe, it, expect, beforeEach, vi } from "vitest"
import { HOME_ASK, resetWebAsk, useHomeStore } from "@/lib/bim-flow/web-ask"
import { resetAllStores } from "@/tests/test-utils"
import { useIngestStore } from "./ingest-store"
import { BIM_CHAT_ID, bimChoices, sendToBim, useBimChatStore, useBimFactsStore } from "./bim-chat"
import { BIM_PING } from "./bim"
import type { ApplyResult } from "./types"
import { useEventStore } from "@/lib/event-store"
import { PASTED } from "@/lib/flight-bimby/fixture"
import { useTaskStore } from "@/lib/task-store"

describe("BIM Chat: a to-do said beside a web question", () => {
  const SAID = "also i prob will have to do my laundry can you find out what time the laundromats by my house close? "
  let queries: string[] = []

  beforeEach(() => {
    resetAllStores()
    useBimChatStore.setState({ lines: [], busy: false })
    useHomeStore.setState({ home: null })
    resetWebAsk()
    queries = []
    vi.stubGlobal("fetch", async (url: string) => {
      if (!String(url).includes("/api/web-search")) throw new Error("no network in tests")
      const query = new URL(String(url), "http://hub").searchParams.get("q") ?? ""
      queries.push(query)
      return new Response(JSON.stringify({ ok: true, query, results: [{ title: "Spin Laundry", url: "https://spin.example.com", snippet: "Open daily 7am to 10pm" }], pages: [] }))
    })
  })
  afterEach(() => vi.unstubAllGlobals())

  it("asks for home, then answers the question alone and offers the to-do; nothing is filed until the key is tapped", async () => {
    const asked = await sendToBim(SAID, new Date(), { llm: false })
    expect(asked.text).toBe(HOME_ASK)
    expect(asked.choices).toBeUndefined()
    const answer = await sendToBim("North Park, San Diego", new Date(), { llm: false, lastBim: asked.text })
    expect(useHomeStore.getState().home).toBe("North Park, San Diego")
    // The search is the question, without the laundry aside.
    expect(queries).toHaveLength(1)
    expect(queries[0]).toContain("laundromats")
    expect(queries[0]).toContain("North Park, San Diego")
    expect(queries[0]).not.toMatch(/prob|have to/)
    expect(answer.text).toContain("Spin Laundry")
    expect(answer.text).toContain('Put "do laundry" on today\'s To Do?')
    expect(answer.choices).toEqual([{ label: "add to do: do laundry", text: "todo today: do laundry" }])
    expect(useTaskStore.getState().tasks.some((t) => /laundry/i.test(t.title ?? ""))).toBe(false)
    const added = await sendToBim(answer.choices![0]!.text, new Date(), { llm: false })
    expect(added.status).toBe("ok")
    expect(useTaskStore.getState().tasks.some((t) => t.title === "do laundry")).toBe(true)
  })

  it("with home known, one turn answers and offers the to-do; a question alone offers nothing", async () => {
    useHomeStore.setState({ home: "North Park, San Diego" })
    const both = await sendToBim(SAID, new Date(), { llm: false })
    expect(both.choices).toEqual([{ label: "add to do: do laundry", text: "todo today: do laundry" }])
    const alone = await sendToBim("what time do the laundromats by my house close?", new Date(), { llm: false })
    expect(alone.text).toContain("Spin Laundry")
    expect(alone.choices).toBeUndefined()
  })
})

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
