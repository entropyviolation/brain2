import { beforeEach, describe, expect, it } from "vitest"
import type { ModelCall } from "./ollama"
import { answerWeb, HOME_ASK, looksLikeWebQuestion, resetWebAsk, takeHome, useHomeStore } from "./web-ask"
import type { WebFound } from "./web-lane"

const NOW = new Date(2026, 10, 11, 16, 10)
const Q = "can you find out what time the laundromats by my house close?"

const found = (query: string): WebFound => ({
  query,
  results: [
    { title: "Suds City Laundromat", url: "https://suds.example/hours", snippet: "Self-service laundry." },
    { title: "Bubbles Wash", url: "https://bubbles.example", snippet: "Open daily 7am to 9pm." },
  ],
  pages: [{ url: "https://suds.example/hours", text: "Suds City Laundromat\nHours\nMonday to Sunday: 6 am to 8 pm\nLast wash 7 pm" }],
})

let queries: string[] = []
const search = async (q: string) => {
  queries.push(q)
  return found(q)
}

beforeEach(() => {
  useHomeStore.setState({ home: null })
  resetWebAsk()
  queries = []
})

describe("the Web BIMBY", () => {
  it("knows an outside-world question from a line about your own day", () => {
    expect(looksLikeWebQuestion(Q)).toBe(true)
    expect(looksLikeWebQuestion("what time does the pharmacy close?")).toBe(true)
    expect(looksLikeWebQuestion("what did I do at 3pm?")).toBe(false)
    expect(looksLikeWebQuestion("the laundromat closes at 9")).toBe(false)
  })

  it("asks where home is once, holds the question, then searches near home", async () => {
    const first = await answerWeb(Q, NOW, { llm: false, search })
    expect(first).toMatchObject({ text: HOME_ASK, askedHome: true })
    expect(queries).toEqual([])

    expect(await takeHome("pack first", NOW, { llm: false, search, lastBim: "something else" })).toBeNull()
    const answered = await takeHome("North Park, San Diego", NOW, { llm: false, search, lastBim: HOME_ASK })
    expect(useHomeStore.getState().home).toBe("North Park, San Diego")
    expect(queries[0]).toMatch(/laundromats.*near North Park, San Diego/)
    // No model: the passages, source by source, with the hours line.
    expect(answered!.text).toMatch(/Kept: home is North Park, San Diego/)
    expect(answered!.text).toMatch(/\[1\] Suds City Laundromat: .*6 am to 8 pm/)
    expect(answered!.evidence[0]).toMatch(/^searched the web: /)

    // Home is kept: the next question goes straight to the search.
    const again = await answerWeb("what time does the pharmacy near me close?", NOW, { llm: false, search })
    expect(again.askedHome).toBeUndefined()
    expect(queries[1]).toMatch(/near North Park, San Diego/)
  })

  it("keeps \"I live in …\" said any time", async () => {
    const told = await takeHome("I live in Ocean Beach, San Diego", NOW, { llm: false, search })
    expect(useHomeStore.getState().home).toBe("Ocean Beach, San Diego")
    expect(told!.text).toMatch(/Kept: home is Ocean Beach/)
  })

  it("with a model, answers from the numbered sources it was given", async () => {
    useHomeStore.setState({ home: "North Park, San Diego" })
    let seen = ""
    const call: ModelCall = async ({ user }) => {
      seen = user
      return { answer: "Suds City closes at 8 pm, last wash 7 pm [1]." }
    }
    const a = await answerWeb(Q, NOW, { llm: true, search, call, model: "test" })
    expect(seen).toMatch(/\[1\] Suds City Laundromat[\s\S]*page says: .*6 am to 8 pm/)
    expect(a.text).toMatch(/^Suds City closes at 8 pm/)
    expect(a.route).toMatch(/^WEB · model test/)
  })

  it("says so when the hub cannot search", async () => {
    useHomeStore.setState({ home: "North Park, San Diego" })
    const a = await answerWeb(Q, NOW, { llm: false, search: async () => null })
    expect(a.text).toMatch(/could not search the web .*Mac hub did not answer/)
  })
})

describe("in BIM chat", () => {
  it("message 1: the day card, then BIM asks where home is, then answers from the web", async () => {
    const { sendToBim, useBimChatStore } = await import("@/lib/ingest/bim-chat")
    const { useDayPlanStore } = await import("@/lib/plan-bimby/day/store")
    const { useBimLlmMode } = await import("@/lib/ingest/bim-switchboard")
    useBimLlmMode.setState({ on: false } as never)
    useDayPlanStore.setState({ plans: {}, order: [] })
    useBimChatStore.setState({ lines: [], busy: false })
    const realFetch = globalThis.fetch
    const asked: string[] = []
    globalThis.fetch = (async (url: string) => {
      asked.push(String(url))
      const q = new URL(String(url), "http://hub").searchParams.get("q") ?? ""
      return new Response(JSON.stringify({ ok: true, ...found(q) }), { status: 200, headers: { "Content-Type": "application/json" } })
    }) as typeof fetch
    try {
      const M1 =
        "what I have to do for the rest of the day: order hairdye and anything else from walmart (tights comes to mind) asap, dye hair, bleach eyebrows, shave legs, pack (my stuff and elijahs) and plan outfits, finish foxtide stuff, and plan ny, and read marilyn text and reply. MUST be done is dye hair (and thus order hairdye) bleach eyebrows and pack, and text marilyn. and then foxtide stuff and planning ny is important as well. also i prob will have to do my laundry can you find out what time the laundromats by my house close?"
      await useBimChatStore.getState().send(M1)
      const day = useBimChatStore.getState().lines.find((l) => l.dayId)!
      expect(day.dayId).toBeTruthy()
      expect(day.text).toMatch(/I am looking up "can you find out what time the laundromats by my house close"/)
      // The question lands under the day card, not above it.
      await expect.poll(() => useBimChatStore.getState().lines.at(-1)?.text).toBe(HOME_ASK)
      expect(useBimChatStore.getState().lines.map((l) => l.who)).toEqual(["you", "bim", "bim"])

      const answer = await sendToBim("North Park, San Diego", NOW, { llm: false, lastBim: HOME_ASK })
      expect(answer.route).toMatch(/^WEB · passages/)
      expect(answer.text).toMatch(/6 am to 8 pm/)
      expect(asked.some((u) => u.startsWith("/api/web-search?") && /North\+Park/.test(u))).toBe(true)
    } finally {
      globalThis.fetch = realFetch
    }
  })
})
