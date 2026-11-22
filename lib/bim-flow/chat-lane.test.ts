import { describe, expect, it } from "vitest"
import { groundLine, looksGeneral, MAX_TOOL_HOPS, runChatLane, runChatTool } from "./chat-lane"
import type { ModelCall } from "./ollama"
import { NOW, SCENARIO_VAULT } from "./scenarios"
import type { WebFound } from "./web-lane"

type Req = Parameters<ModelCall>[0]

/** A model that answers tool picks from a list, in order, and replies with a fixed line. Every request is kept. */
function scripted(picks: { tool: string; subject?: string }[], reply = "ok", basis = "data") {
  const seen: Req[] = []
  let i = 0
  const call: ModelCall = async (req) => {
    seen.push(req)
    if ("tool" in (req.schema.properties as object)) {
      const p = picks[i++] ?? { tool: "none" }
      return { tool: p.tool, subject: p.subject ?? "", why: "" }
    }
    return { reply, basis }
  }
  const picked = () => seen.filter((r) => "tool" in (r.schema.properties as object))
  const replied = () => seen.filter((r) => "reply" in (r.schema.properties as object))
  return { call, seen, picked, replied }
}

const run = (text: string, m: ReturnType<typeof scripted>, turns?: { who: "you" | "bim"; text: string }[]) =>
  runChatLane({ text, turns, now: NOW, snap: SCENARIO_VAULT, call: m.call, pick: ["pick"], main: "main" })

describe("chat lane grounding", () => {
  it("knows when a line is about nothing in the vault", () => {
    expect(looksGeneral(groundLine(SCENARIO_VAULT, "what is the boiling point of nitrogen?", NOW))).toBe(true)
    // A how-to's "I" is anyone; "my" still points at the vault.
    expect(looksGeneral(groundLine(SCENARIO_VAULT, "how do i convert celcius to fahrenheit?", NOW))).toBe(true)
    expect(groundLine(SCENARIO_VAULT, "how do i get to my dentist?", NOW).self).toBe(true)
    // "I", a time word, a known topic, a known person: each one makes it about the vault.
    expect(looksGeneral(groundLine(SCENARIO_VAULT, "why am I so tired?", NOW))).toBe(false)
    expect(looksGeneral(groundLine(SCENARIO_VAULT, "what happened yesterday?", NOW))).toBe(false)
    expect(looksGeneral(groundLine(SCENARIO_VAULT, "what temp for garlic confit?", NOW))).toBe(false)
    expect(looksGeneral(groundLine(SCENARIO_VAULT, "is Alexis Reed around?", NOW))).toBe(false)
  })
})

describe("chat lane", () => {
  it("general line: no tool is picked, one call, and the reply is marked general by code", async () => {
    const m = scripted([], "It boils at about -196°C.")
    const out = await run("what is the boiling point of nitrogen?", m)
    expect(out).toMatchObject({ text: "It boils at about -196°C.", general: true, hops: [], evidence: [], calls: 1, models: ["main"] })
    expect(m.picked()).toHaveLength(0)
    expect(m.replied()[0]!.user).toContain("No FACTS or ROWS")
  })

  it("grounded line: the model picks, code counts, and the reply sees the counted facts", async () => {
    const m = scripted([{ tool: "count", subject: "computer work" }], "You have logged a lot of computer work this week.")
    const out = await run("feels like I've been on computer work a lot this week", m)
    expect(out.general).toBe(false)
    expect(out.hops).toEqual([{ tool: "count", subject: "computer work", found: 4 }])
    expect(out.calls).toBe(2)
    // Mon 3h + Tue 2h + Thu 90m + Fri 4h = 630 minutes, counted by code and handed to the model.
    expect(out.evidence[0]).toContain("630 minutes")
    expect(m.replied()[0]!.user).toContain("630 minutes")
    expect(m.replied()[0]!.model).toBe("main")
  })

  it("the model picking none leaves the reply general", async () => {
    const m = scripted([{ tool: "none" }], "That sounds hard.")
    const out = await run("I'm so tired of this", m)
    expect(out).toMatchObject({ general: true, hops: [], calls: 2 })
  })

  it("an empty read gets one more pick, told what was tried, and no third", async () => {
    const m = scripted([{ tool: "count", subject: "zzzz" }, { tool: "search", subject: "qqqq" }, { tool: "last", subject: "walking" }], "I have nothing on that.")
    const out = await run("I keep thinking about walking", m)
    expect(out.hops.map((h) => h.tool)).toEqual(["count", "search"])
    expect(out.hops).toHaveLength(MAX_TOOL_HOPS)
    expect(m.picked()[1]!.user).toContain('ALREADY TRIED: count "zzzz" found nothing')
    // Both reads were empty, so nothing stands behind the reply.
    expect(out.general).toBe(true)
    expect(out.evidence).toEqual([])
  })

  it("a second pick that finds rows grounds the reply", async () => {
    const m = scripted([{ tool: "count", subject: "zzzz" }, { tool: "last", subject: "walking" }])
    const out = await run("I keep thinking about walking", m)
    expect(out.general).toBe(false)
    expect(out.evidence.join(" ")).toContain("2026-10-30")
  })

  it("rows in hand but a reply that did not use them: general, and no evidence is shown", async () => {
    const m = scripted([{ tool: "search", subject: "garlic confit" }], "Usually around 250°F.", "general")
    const out = await run("what temp for garlic confit?", m)
    expect(out.hops[0]!.found).toBeGreaterThan(0)
    expect(out.general).toBe(true)
    expect(out.evidence).toEqual([])
  })

  it("the model cannot claim data it was never given", async () => {
    const out = await run("what is the boiling point of nitrogen?", scripted([], "About -196°C.", "data"))
    expect(out.general).toBe(true)
  })

  it("a tool off the list reads nothing", async () => {
    const m = scripted([{ tool: "delete-everything", subject: "walking" }])
    const out = await run("I keep thinking about walking", m)
    expect(out.hops).toEqual([])
    expect(out.general).toBe(true)
  })

  it("the reply sees only the last eight turns", async () => {
    const turns = Array.from({ length: 12 }, (_, i) => ({ who: i % 2 ? ("bim" as const) : ("you" as const), text: `turn ${i}` }))
    const m = scripted([])
    await run("what is the boiling point of nitrogen?", m, turns)
    const user = m.replied()[0]!.user
    expect(user).not.toContain("turn 3")
    expect(user).toContain("THEM: turn 4")
    expect(user).toContain("BIM: turn 11")
  })

  it("an empty reply throws, so the caller can file the line as before", async () => {
    await expect(run("what is the boiling point of nitrogen?", scripted([], ""))).rejects.toThrow(/no reply/)
  })

  it("no pick model: still replies, general", async () => {
    const m = scripted([{ tool: "count", subject: "walking" }])
    const out = await runChatLane({ text: "I keep thinking about walking", now: NOW, snap: SCENARIO_VAULT, call: m.call, pick: [], main: "main" })
    expect(out).toMatchObject({ general: true, calls: 1 })
  })

  it("every tool on the list runs against the vault", async () => {
    const g = groundLine(SCENARIO_VAULT, "Alexis Reed and walking", NOW)
    for (const tool of ["count", "last", "day", "person-days", "search", "texts-day"] as const) {
      const out = await runChatTool(SCENARIO_VAULT, tool, "walking", "walking", g, NOW)
      expect(out, tool).not.toBeNull()
    }
    expect(await runChatTool(SCENARIO_VAULT, "none", "", "", g, NOW)).toBeNull()
  })
})

describe("chat lane: the web tool", () => {
  const found = (query: string): WebFound => ({
    query,
    results: [{ title: "Finals recap", url: "https://scores.example/recap", snippet: "The Wave won 3-1 last night." }],
    pages: [],
  })
  const withWeb = (text: string, m: ReturnType<typeof scripted>, search: (q: string) => Promise<WebFound | null>, home?: string) =>
    runChatLane({ text, now: NOW, snap: SCENARIO_VAULT, call: m.call, pick: ["pick"], main: "main", web: { search, ...(home ? { home } : {}) } })

  it("a general question may be searched: the model writes the query, the reply sees the results and carries the sources", async () => {
    const queries: string[] = []
    const m = scripted([{ tool: "web", subject: "Wave final score last night" }], "The Wave won 3-1.", "web")
    const out = await withWeb("who won the final last night?", m, async (q) => (queries.push(q), found(q)), "North Park, San Diego")
    expect(queries).toEqual(["Wave final score last night"])
    expect(m.picked()[0]!.user).toContain("HOME: North Park, San Diego")
    expect((m.picked()[0]!.schema.properties as { tool: { enum: string[] } }).tool.enum).toContain("web")
    expect(m.replied()[0]!.user).toContain("WEB RESULTS")
    expect(m.replied()[0]!.user).toContain("The Wave won 3-1 last night.")
    expect(out).toMatchObject({ general: false, web: { query: "Wave final score last night" }, hops: [{ tool: "web", subject: "Wave final score last night", found: 1 }] })
    expect(out.evidence).toEqual(["searched the web: Wave final score last night", "Finals recap · https://scores.example/recap"])
  })

  it("plain general knowledge is still one call: no pick, no search", async () => {
    const m = scripted([{ tool: "web", subject: "nitrogen" }], "It boils at about -196°C.", "general")
    const out = await withWeb("what is the boiling point of nitrogen?", m, async () => { throw new Error("must not search") })
    expect(m.picked()).toHaveLength(0)
    expect(out).toMatchObject({ general: true, hops: [], evidence: [], calls: 1 })
  })

  it("a general question that may be newer than the model is put to the pick, and the query is tidied before it leaves", async () => {
    const queries: string[] = []
    const m = scripted([{ tool: "web", subject: "Disneyland day pass price now HOME 飀 one two three four five six seven" }], "Listed from $104.", "web")
    const out = await withWeb("how much is a day pass at Disneyland right now?", m, async (q) => (queries.push(q), found(q)))
    expect(m.picked()).toHaveLength(1)
    expect(m.picked()[0]!.user).toContain("TODAY: ")
    expect(queries).toEqual(["Disneyland day pass price now one two three four five"])
    expect(out.web).toEqual({ query: "Disneyland day pass price now one two three four five" })
  })

  it("a statement is never offered the web", async () => {
    const m = scripted([{ tool: "web", subject: "tired" }], "That sounds rough.", "general")
    const out = await withWeb("so tired of everything", m, async () => { throw new Error("must not search") })
    for (const req of m.picked()) expect((req.schema.properties as { tool: { enum: string[] } }).tool.enum).not.toContain("web")
    expect(out.web).toBeUndefined()
  })

  it("a search that fails is said, and the reply is not marked as from the web", async () => {
    const m = scripted([{ tool: "web", subject: "Wave final score" }, { tool: "none" }], "I could not search just now.", "web")
    const out = await withWeb("who won the final last night?", m, async () => null)
    expect(m.replied()[0]!.user).toContain("The web search failed or found nothing.")
    expect(out).toMatchObject({ general: true, evidence: [], hops: [{ tool: "web", subject: "Wave final score", found: 0 }] })
    expect(out.web).toBeUndefined()
  })
})
