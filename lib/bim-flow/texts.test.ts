import { describe, expect, it } from "vitest"
import { bursts, digest, digestFacts, textsToFeed, toRows, type RawText } from "./texts"
import { retrieve } from "./retrieve"
import type { VaultSnapshot } from "./vault-search"

const at = (h: number, m: number) => new Date(2026, 9, 28, h, m).getTime()
const raw: RawText[] = [
  { at: at(9, 0), dir: "in", h: "+1555", th: "a", t: "wanna get lunch?" },
  { at: at(9, 10), dir: "out", h: "+1555", th: "a", t: "yes! at the thai place" },
  { at: at(9, 12), dir: "in", h: "+1555", th: "a", t: "https://example.com/x" },
  { at: at(13, 0), dir: "out", h: "+1666", th: "b", t: "on my way home" },
  { at: at(13, 5), dir: "out", h: "+1666", th: "b", t: "￼" },
]
const rows = toRows(raw, (h) => (h === "+1555" ? "Sam" : h))

describe("texts", () => {
  it("drops bare links and attachment-only bodies", () => expect(rows).toHaveLength(3))
  it("groups bursts per thread", () => expect(bursts(rows, 30)).toHaveLength(2))
  it("mine keeps only sent texts and names the person", () => {
    const f = textsToFeed(rows, "mine")
    expect(f.map((x) => x.text)).toEqual(["yes! at the thai place (to Sam)", "on my way home (to +1666)"])
  })
  it("bursts join both sides", () => {
    const f = textsToFeed(rows, "bursts")
    expect(f[0]!.text).toContain("Sam: wanna get lunch?")
    expect(f[0]!.text).toContain("me: yes!")
  })
  it("digest counts in code", () => {
    const d = digest(rows)
    expect(d).toMatchObject({ sent: 2, received: 1, firstSent: "09:10", lastSent: "13:00" })
    expect(d.quiet[0]).toMatchObject({ from: "09:10", to: "13:00" })
    expect(d.replyMedianMin).toBe(10)
    expect(digestFacts(rows).join(" ")).toContain("no text from me for 90+ min")
  })
  it("retrieve texts reads only the recent window and a day read ignores words", async () => {
    const snap = { items: [], lists: [], habits: [], scopes: [], skipListIds: new Set(), texts: rows } as unknown as VaultSnapshot
    const now = new Date(2026, 9, 28, 20, 0)
    const day = await retrieve(snap, { kind: "texts", days: 1 }, { terms: ["zzz"], now })
    expect(day.total).toBe(3)
    const old = await retrieve(snap, { kind: "texts", days: 30 }, { terms: [], now: new Date(2026, 11, 30) })
    expect(old.total).toBe(0)
  })
})
