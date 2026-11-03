/**
 * The flows on the person's real vault (`data/shared-persist.json`, the hub's copy on this Mac).
 * Skipped where that file is missing (CI, another machine). Nothing is written.
 *
 * Every model step is answered from the hand labels (`label-model.ts`), so a miss here is code:
 * search that did not offer the right pen or list, a person the linker could not settle, a block
 * placed away from what the person painted. `npx vitest run lib/bim-flow/real-vault.test.ts`
 */
import fs from "node:fs"
import { describe, expect, it } from "vitest"
import { commonStems, linkPrior } from "./context-link"
import { linkText } from "./entity-link"
import { labelModel } from "./label-model"
import { REAL_LINES, REAL_PAIRS, type RealLine } from "./real-feed"
import { runFlow } from "./run-flow"
import { snapshotFromPersistItems } from "./store-snapshot"
import { routedLogFlow } from "./task-flows"
import type { FlowMessage, SearchOutput } from "./types"
import { isArtifactName } from "./vault-search"

const FILE = "data/shared-persist.json"
const have = fs.existsSync(FILE)

describe.skipIf(!have)("real vault", () => {
  const items = have ? (JSON.parse(fs.readFileSync(FILE, "utf8")) as { items: Record<string, string> }).items : {}
  const { snap, feed } = snapshotFromPersistItems(items, new Date("2026-11-01T12:00:00"))
  const common = commonStems(snap.history?.feed ?? [])
  const flow = routedLogFlow()
  const msg = (l: RealLine): FlowMessage => ({ id: l.id, text: l.text, at: l.at, prior: l.prior, entry: "bim-text" })

  it("loads the vault the lab reads", () => {
    expect(feed.length).toBeGreaterThan(500)
    expect(snap.scopes.find((s) => s.id === "activity")?.pens.length).toBeGreaterThan(50)
    expect(snap.people?.length).toBeGreaterThan(20)
  })

  it("every labelled line is still in the feed, at its time, with the same lines before it", () => {
    const rows = feed.filter((r) => r.text.trim())
    for (const l of REAL_LINES) {
      const i = rows.findIndex((r) => r.id === l.id)
      expect(i, l.text).toBeGreaterThan(-1)
      expect(rows[i]!.text).toBe(l.text)
      expect(rows.slice(Math.max(0, i - 2), i).map((r) => r.text)).toEqual(expect.arrayContaining(l.prior.map((p) => p.text)))
    }
  })

  it("the feed's common words are the ones the person writes all the time", () => {
    for (const w of ["brain2", "elijah"]) expect(common.has(w), w).toBe(true)
    for (const w of ["confit", "cry", "shower", "nfc", "jewelry"]) expect(common.has(w), w).toBe(false)
  })

  it("context: code never contradicts a label on the real feed's word counts", () => {
    const wrong: string[] = []
    let committed = 0
    for (const p of REAL_PAIRS) {
      const [l] = linkPrior({ text: p.text, at: p.at }, [{ text: p.earlier, at: p.earlierAt }], common)
      if (l!.call === "unsure") continue
      committed++
      if ((l!.call === "linked") !== p.linked) wrong.push(`${l!.call} (${l!.why}): "${p.earlier.slice(0, 40)}" → "${p.text.slice(0, 40)}"`)
    }
    expect(wrong).toEqual([])
    // The pairs were picked for being close in time, the hard case; over the whole feed code settles more.
    expect(committed / REAL_PAIRS.length).toBeGreaterThan(0.3)
  })

  it("context on every BIM line: code settles most pairs, the rest go to one yes/no", () => {
    const rows = feed.filter((r) => r.text.trim())
    const c = { linked: 0, unlinked: 0, unsure: 0 }
    rows.forEach((r, i) => {
      const prior = rows.slice(Math.max(0, i - 2), i).filter((p) => new Date(r.at).getTime() - new Date(p.at).getTime() < 3 * 3600_000)
      for (const l of linkPrior(r, prior, common)) c[l.call]++
    })
    const total = c.linked + c.unlinked + c.unsure
    console.log(`context over ${rows.length} lines: ${JSON.stringify(c)}`)
    expect(c.unsure / total).toBeLessThan(0.35)
  })

  it("people: duplicated person items are one person, typos and nicknames link, strangers stay nil", () => {
    const best = (text: string, mention: string) => linkText(snap, text, { kind: "person" }).find((m) => m.text.toLowerCase() === mention)
    // Elijah, Rebecca and Linda each exist three times as person items with the same name. The list
    // "tell elijah" is a longer name than the person; the people lane links people only.
    expect(linkText(snap, "Tell elijah about texts").find((m) => m.status === "linked")?.best?.sub).toBe("list")
    for (const [text, mention, who] of [
      // "Elijah" is a nickname on Elijah Gibbins-Croft's profile, so the stubs fold into him.
      ["Tell elijah about texts", "elijah", "Elijah Gibbins-Croft"],
      ["get some lemon of this for elikah abd linda", "elikah", "Elijah Gibbins-Croft"],
      ["get some lemon of this for elikah abd linda", "linda", "Linda"],
      ["Elijah wants me to come to ny book ny", "elijah", "Elijah Gibbins-Croft"],
    ] as const) {
      const m = best(text, mention)
      expect(m?.status, text).toBe("linked")
      expect(m?.best?.label, text).toBe(who)
      expect(m?.best?.sub, text).toBe("person")
    }
    // Two real Rebeccas (Ellis, Anne Smith): a typo of the first name is a question, not a guess.
    expect(best("also text rebcca back", "rebcca")?.status).toBe("ambiguous")
    expect(best("Woke dream involving school, Alexis wanting to be friends again", "alexis")?.status).toBe("nil")
  })

  describe("every labelled line through the routed flow, with right answers at every model step", async () => {
    const lm = labelModel(REAL_LINES, REAL_PAIRS)
    const runs = await Promise.all(REAL_LINES.map(async (l) => ({ l, run: await runFlow(flow, [msg(l)], lm.call, snap, { model: "labels" }) })))
    const proposals = (r: (typeof runs)[number]) => r.run.messages[0]!.proposals
    const picksOf = (r: (typeof runs)[number], action: string) => proposals(r).filter((p) => p.action === action).flatMap((p) => (p.data.picks as string[] | undefined) ?? [])

    it("activity lines: the pen is offered and the signal is right", () => {
      const miss: string[] = []
      for (const r of runs.filter((x) => x.l.want.act)) {
        const [pen, relation] = r.l.want.act!
        const sig = r.run.messages[0]!.signals[0]
        if (sig?.activity.toLowerCase() !== pen.toLowerCase() || sig.relation !== relation) miss.push(`${r.l.text.slice(0, 50)} → ${sig ? `${sig.activity}/${sig.relation}` : "no signal"}`)
      }
      expect(miss).toEqual([])
    })

    it("keep lines: how often the right list is even offered (word search over items)", () => {
      const rows = runs.filter((x) => x.l.want.keep)
      const found = rows.filter((r) => picksOf(r, "add-to-list").some((p) => p.toLowerCase() === r.l.want.keep!.toLowerCase()))
      const missed = rows.filter((r) => !found.includes(r)).map((r) => `${r.l.want.keep}${r.l.want.hard ? " (hard)" : ""} ← ${r.l.text.slice(0, 60)}`)
      console.log(`keep recall with a perfect model: ${found.length}/${rows.length}\n  ${missed.join("\n  ")}`)
      // Every "Brain2:" head reaches the brain2 list.
      for (const r of rows.filter((x) => /^brain ?2\b/i.test(x.l.text))) expect(found, r.l.text).toContain(r)
      expect(found.length / rows.length).toBeGreaterThan(0.5)
    })

    it("people lines: each named person is offered", () => {
      const miss: string[] = []
      for (const r of runs.filter((x) => x.l.want.family === "people" && x.l.want.people)) {
        const got = picksOf(r, "person-mention").map((p) => p.toLowerCase())
        for (const who of r.l.want.people!) if (!got.includes(who.toLowerCase())) miss.push(`${who} ← ${r.l.text.slice(0, 50)}`)
      }
      expect(miss).toEqual([])
    })

    it("search never offers a pasted paragraph as a pen or a place", () => {
      for (const r of runs) {
        for (const st of r.run.messages[0]!.steps) {
          if (st.nodeId !== "s-pens" && st.nodeId !== "s-loc") continue
          for (const o of (st.output as SearchOutput).options) expect(isArtifactName(o), o).toBe(false)
        }
      }
    })

    it("the label model knew every message it was asked about", () => {
      expect([...lm.unlabelled]).toEqual([])
    })
  })
})
