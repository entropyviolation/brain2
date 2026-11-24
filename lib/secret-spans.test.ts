import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import {
  asksForSecrets,
  hasSecretSpans,
  insertSecretMarks,
  revealSecretSpans,
  secretSpans,
  secretTally,
  stripSecretSpans,
  stripSecretsDeep,
} from "@/lib/secrets"
import { searchItems } from "@/lib/search"
import { maskSecrets, secretsAskedFor, useSecretsStore } from "@/lib/secrets-store"
import { itemFacts, itemGraph } from "@/lib/memory-graph/build"
import * as ollama from "@/lib/bim-flow/ollama"
import { ollamaCall, resetCircuit } from "@/lib/bim-flow/ollama"

// When background calls wait for chat (`setChatHoldMs`), shorten the wait so the background case runs at once.
const hold = ollama as unknown as { setChatHoldMs?: (ms: number) => void; CHAT_HOLD_MS?: number }
import type { Item, ItemRecord } from "@/lib/types"

const NOTE = String.raw`I love the new One Direction album \secret and I want all of them at once \secret honestly`

describe("inline secret spans", () => {
  it("finds, strips and reveals", () => {
    expect(hasSecretSpans(NOTE)).toBe(true)
    expect(hasSecretSpans("plain")).toBe(false)
    expect(stripSecretSpans(NOTE)).toBe("I love the new One Direction album honestly")
    expect(revealSecretSpans(NOTE)).toBe("I love the new One Direction album and I want all of them at once honestly")
    expect(secretSpans(NOTE)).toEqual([{ text: "and I want all of them at once" }])
  })

  it("reads the brace form and tags", () => {
    const t = String.raw`gym \secret {crush on Marilyn Monroe} \secret then \secret[o] thinking about Marilyn \secret.`
    expect(stripSecretSpans(t)).toBe("gym then.")
    expect(secretSpans(t)).toEqual([{ text: "crush on Marilyn Monroe" }, { text: "thinking about Marilyn", tag: "o" }])
  })

  it("an unclosed span hides to the end, never less", () => {
    expect(stripSecretSpans(String.raw`lunch \secret and the rest is mine`)).toBe("lunch")
  })

  it("a whole-line secret leaves nothing", () => {
    expect(stripSecretSpans(String.raw`\secret all of it \secret`)).toBe("")
  })

  it("strips deep and keeps untouched branches and Dates as they are", () => {
    const when = new Date(0)
    const clean = { a: "x", list: ["y"] }
    const value = { when, clean, notes: [String.raw`ok \secret no \secret`], n: 3 }
    const out = stripSecretsDeep(value)
    expect(out.notes).toEqual(["ok"])
    expect(out.when).toBe(when)
    expect(out.clean).toBe(clean)
    expect(stripSecretsDeep(clean)).toBe(clean)
  })

  it("only an explicit phrase asks for secrets", () => {
    expect(asksForSecrets("secrets included: what did I think about One Direction?")).toBe(true)
    expect(asksForSecrets("for therapy, include my secrets")).toBe(true)
    expect(asksForSecrets("what do I think about One Direction?")).toBe(false)
    expect(asksForSecrets("therapy session notes")).toBe(false)
    expect(asksForSecrets("I have a secret")).toBe(false)
  })
})

describe("secret tally", () => {
  it("counts pen rows and tagged spans, with thoughts and minutes", () => {
    const tally = secretTally(
      [
        { at: "2026-11-02T10:00:00Z", text: String.raw`\secret[o] Marilyn Monroe \secret`, minutes: 12, counts: true },
        { at: "2026-11-01T22:00:00Z", text: String.raw`tired \secret[O] the beach \secret` },
        { at: "2026-11-03T08:00:00Z", text: "plain block", counts: true, minutes: 5 },
        { at: "2026-11-03T09:00:00Z", text: String.raw`\secret not tagged \secret` },
      ],
      "o",
    )
    expect(tally.count).toBe(3)
    expect(tally.minutes).toBe(17)
    expect(tally.instances.map((i) => i.thoughts)).toEqual([["the beach"], ["Marilyn Monroe"], []])
  })
})

describe("surfaces strip spans", () => {
  const fan: Item = { id: "a", title: "One Direction", createdAt: new Date(0), notes: String.raw`great harmonies \secret gangbang fantasy \secret` } as Item

  it("search never matches a word inside a span unless secrets are included", () => {
    expect(searchItems("harmonies", [fan]).map((r) => r.item.id)).toEqual(["a"])
    expect(searchItems("fantasy", [fan])).toEqual([])
    expect(searchItems("fantasy", [fan], { includeSecrets: true }).map((r) => r.item.id)).toEqual(["a"])
  })

  it("the memory graph shows no span", () => {
    const rec = { ...fan, stage: "now", noteLog: [{ id: "n1", date: "2026-11-01", text: String.raw`saw them \secret crush \secret` }] } as unknown as ItemRecord
    expect(itemFacts(rec, [rec]).join(" ")).not.toMatch(/crush|secret/)
    const g = itemGraph("a", [rec])
    expect(JSON.stringify(g)).not.toMatch(/crush|fantasy|\\\\secret/)
  })
})

describe("model calls strip spans unless included", () => {
  const seen: string[] = []
  beforeEach(() => {
    resetCircuit()
    hold.setChatHoldMs?.(1)
    seen.length = 0
    vi.stubGlobal(
      "fetch",
      vi.fn(async (_url: string, init: RequestInit) => {
        const body = JSON.parse(String(init.body)) as { messages: { content: string }[] }
        seen.push(body.messages.map((m) => m.content).join(" | "))
        return new Response(JSON.stringify({ message: { content: "{}" } }), { status: 200 })
      }),
    )
  })
  afterEach(() => {
    vi.unstubAllGlobals()
    if (hold.CHAT_HOLD_MS != null) hold.setChatHoldMs?.(hold.CHAT_HOLD_MS)
  })

  const req = { system: String.raw`ctx \secret hidden system \secret`, user: NOTE, schema: { type: "object" } }

  it("by default", async () => {
    await ollamaCall("m", undefined, { fresh: true })(req)
    expect(seen[0]).not.toMatch(/hidden|all of them|\\secret/)
  })

  it("background calls stay stripped even when asked", async () => {
    await ollamaCall("m", undefined, { fresh: true, background: true, secrets: "included" })(req)
    expect(seen[0]).not.toMatch(/hidden|all of them/)
  })

  it("only when the call says secrets are included", async () => {
    await ollamaCall("m", undefined, { fresh: true, secrets: "included" })(req)
    expect(seen[0]).toMatch(/all of them/)
  })
})

describe("the SECRET key", () => {
  it("fills an empty box with the caret between the marks", () => {
    const { text, caret } = insertSecretMarks("")
    expect(text).toBe(String.raw`\secret  \secret`)
    expect(text.slice(0, caret)).toBe(String.raw`\secret `)
  })

  it("goes in at the caret and deletes nothing", () => {
    const { text, caret } = insertSecretMarks("gym then lunch", 3)
    expect(text).toBe(String.raw`gym \secret  \secret then lunch`)
    expect(text.slice(0, caret)).toBe(String.raw`gym \secret `)
    expect(stripSecretSpans(text)).toBe("gym then lunch")
  })

  it("wraps a selection", () => {
    expect(insertSecretMarks("love my crush ok", 8, 13).text).toBe(String.raw`love my \secret crush \secret ok`)
  })
})

describe("secrets need a typed passphrase", () => {
  const LINE = String.raw`secrets included: what was I thinking \secret about Marilyn Monroe \secret`

  afterEach(() => {
    useSecretsStore.setState({ record: null, unlocked: false, include: { search: false, chat: false } })
  })

  it("the phrase alone never opens them, not even with no passphrase set", () => {
    useSecretsStore.setState({ record: null, unlocked: false })
    expect(secretsAskedFor(LINE)).toBe(false)
  })

  it("a set but untyped passphrase keeps them shut, switch or phrase", () => {
    useSecretsStore.setState({ record: { salt: "a", hash: "b", iterations: 1 }, unlocked: false, include: { search: false, chat: true } })
    expect(secretsAskedFor(LINE)).toBe(false)
  })

  it("typed: the phrase or the chat switch opens them", () => {
    useSecretsStore.setState({ record: { salt: "a", hash: "b", iterations: 1 }, unlocked: true })
    expect(secretsAskedFor(LINE)).toBe(true)
    expect(secretsAskedFor("plain line")).toBe(false)
    useSecretsStore.setState({ include: { search: false, chat: true } })
    expect(secretsAskedFor("plain line")).toBe(true)
  })

  it("a hidden screen draws nothing of a span", () => {
    const line = { id: "1", at: "x", who: "you", text: String.raw`charge headphones \secret[o] thinking about Marilyn \secret then clean` }
    expect(maskSecrets(line, false).text).toBe("charge headphones then clean")
    expect(maskSecrets(line, true)).toBe(line)
  })
})
