import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { chatBusy, ollamaCall, resetCircuit, setChatHoldMs, CHAT_HOLD_MS } from "./ollama"

const SCHEMA = { type: "object" }

/** A fake daemon: each call waits `ms` (or until aborted) and answers `{ n }`. Records every start and how it ended. */
function fakeDaemon(ms: (body: { messages: { content: string }[] }) => number) {
  const log: string[] = []
  const fetchMock = vi.fn((_url: string, init: RequestInit) => {
    const body = JSON.parse(String(init.body)) as { messages: { content: string }[] }
    const who = body.messages[1]!.content
    log.push(`start ${who}`)
    return new Promise<Response>((done, fail) => {
      const t = setTimeout(() => {
        log.push(`done ${who}`)
        done(new Response(JSON.stringify({ message: { content: JSON.stringify({ who }) } }), { status: 200 }))
      }, ms(body))
      init.signal?.addEventListener("abort", () => {
        clearTimeout(t)
        log.push(`cut ${who}`)
        fail(init.signal!.reason)
      })
    })
  })
  vi.stubGlobal("fetch", fetchMock)
  return log
}

describe("chat first", () => {
  beforeEach(() => {
    resetCircuit()
    setChatHoldMs(30)
  })
  afterEach(() => {
    vi.unstubAllGlobals()
    setChatHoldMs(CHAT_HOLD_MS)
  })

  it("cuts a running background call for chat, then runs it again once chat is quiet", async () => {
    const log = fakeDaemon((b) => (b.messages[1]!.content === "day log" ? 80 : 10))
    const bg = ollamaCall("m", undefined, { background: true, fresh: true })({ system: "s", user: "day log", schema: SCHEMA })
    await new Promise((r) => setTimeout(r, 5))
    const fg = await ollamaCall("m", undefined, { fresh: true })({ system: "s", user: "what is my name?", schema: SCHEMA })
    expect(fg).toEqual({ who: "what is my name?" })
    expect(await bg).toEqual({ who: "day log" })
    expect(log).toEqual(["start day log", "cut day log", "start what is my name?", "done what is my name?", "start day log", "done day log"])
  })

  it("runs one background call at a time, so chat never queues behind a pile of them", async () => {
    const log = fakeDaemon(() => 15)
    const a = ollamaCall("m", undefined, { background: true, fresh: true })({ system: "s", user: "day log", schema: SCHEMA })
    const b = ollamaCall("m", undefined, { background: true, fresh: true })({ system: "s", user: "week log", schema: SCHEMA })
    await Promise.all([a, b])
    expect(log).toEqual(["start day log", "done day log", "start week log", "done week log"])
  })

  it("holds a new background call while chat runs", async () => {
    const log = fakeDaemon(() => 20)
    const fg = ollamaCall("m", undefined, { fresh: true })({ system: "s", user: "ask", schema: SCHEMA })
    const bg = ollamaCall("m", undefined, { background: true, fresh: true })({ system: "s", user: "learn", schema: SCHEMA })
    expect(chatBusy()).toBe(true)
    await Promise.all([fg, bg])
    expect(log).toEqual(["start ask", "done ask", "start learn", "done learn"])
  })

  it("a yield is not a daemon failure, and the caller's own abort still ends a background call", async () => {
    fakeDaemon(() => 1000)
    const stop = new AbortController()
    const bg = ollamaCall("m", stop.signal, { background: true, fresh: true })({ system: "s", user: "x", schema: SCHEMA })
    await new Promise((r) => setTimeout(r, 5))
    stop.abort()
    await expect(bg).rejects.toBeTruthy()
  })
})
