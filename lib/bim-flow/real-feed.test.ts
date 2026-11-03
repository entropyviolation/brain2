/**
 * The labelled real BIM lines (`real-feed.ts`), with no vault file and no model: the context check,
 * the context node in the routed flow, block times against what the person painted or accepted, and
 * BIM's own heads routed by code. Runs everywhere. The same lines on the real vault are
 * `real-vault.test.ts`; against a real model, `real-feed.live.test.ts`.
 */
import { describe, expect, it } from "vitest"
import { assembleBlocks, placeSinceClock } from "./blocks"
import { commonStems, linkPrior, stem } from "./context-link"
import { labelModel } from "./label-model"
import { REAL_LINES, REAL_PAIRS, type RealLine } from "./real-feed"
import { runFlow } from "./run-flow"
import { scriptedModel } from "./scenarios"
import { grammarFirstFlow, routedLogFlow } from "./task-flows"
import type { FlowMessage, TimeBlock } from "./types"
import { cueLists, headLists, type VaultSnapshot } from "./vault-search"

const line = (prefix: string, at?: string): RealLine => {
  const hits = REAL_LINES.filter((l) => l.text.startsWith(prefix) && (!at || l.at === at))
  if (hits.length !== 1) throw new Error(`${hits.length} labelled lines start "${prefix}"`)
  return hits[0]!
}
const msg = (l: RealLine): FlowMessage => ({ id: l.id, text: l.text, at: l.at, prior: l.prior, entry: "bim-text" })
const hm = (iso: string) => new Date(iso).toTimeString().slice(0, 5)
const span = (b: TimeBlock) => `${hm(b.start)}-${hm(b.end)} ${b.activity}${b.estimated ? "*" : ""}`
const minutes = (a: string, b: string) => Math.abs(new Date(a).getTime() - new Date(b).getTime()) / 60_000

/** Every pen and place the labels name, and the person's habits, as their vault spells them. */
const PEN_VAULT: VaultSnapshot = {
  items: [],
  lists: [],
  habits: [{ id: "h-kind", title: "Act of kindness" }, { id: "h-out", title: "Go outside" }, { id: "h-water", title: "Drink water" }, { id: "h-chl", title: "Chlorophyll" }],
  skipListIds: new Set(),
  scopes: [
    { id: "activity", name: "Activity", pens: [...new Set(REAL_LINES.flatMap((l) => (l.want.act ? [l.want.act[0]] : [])))].map((p) => ({ id: `pen-${p}`, name: p })) },
    { id: "location", name: "Location", pens: ["Home", "Outside", "Bedroom", "Goodwill"].map((p) => ({ id: `loc-${p}`, name: p })) },
  ],
}

// Word counts from the labelled lines and the lines before them: enough (50+) to learn "common".
const COMMON = commonStems([...REAL_LINES, ...REAL_LINES.flatMap((l) => l.prior)])

describe("the labelled set", () => {
  it("holds real lines with real times, oldest context first", () => {
    expect(REAL_LINES.length).toBeGreaterThan(100)
    expect(new Set(REAL_LINES.map((l) => l.id)).size).toBe(REAL_LINES.length)
    for (const l of REAL_LINES) {
      expect(Number.isNaN(new Date(l.at).getTime()), l.text).toBe(false)
      for (const p of l.prior) expect(p.at <= l.at, l.text).toBe(true)
      if (l.want.act) expect(["starting", "doing_now", "finished", "did_earlier"]).toContain(l.want.act[1])
    }
    const fam = new Map<string, number>()
    for (const l of REAL_LINES) fam.set(l.want.family, (fam.get(l.want.family) ?? 0) + 1)
    for (const f of ["doing", "keeping", "self", "people", "none"]) expect(fam.get(f), f).toBeGreaterThan(4)
  })

  it("pairs are close in time and both ways", () => {
    expect(REAL_PAIRS.length).toBeGreaterThan(40)
    expect(REAL_PAIRS.filter((p) => p.linked).length).toBeGreaterThan(15)
    expect(REAL_PAIRS.filter((p) => !p.linked).length).toBeGreaterThan(15)
    for (const p of REAL_PAIRS) expect(p.earlierAt <= p.at).toBe(true)
  })
})

describe("context: is the line before needed?", () => {
  it("stems meet across word forms the person uses", () => {
    expect(stem("cooking")).toBe(stem("cook"))
    expect(stem("dishes")).toBe(stem("dish"))
    expect(stem("crying")).toBe(stem("cry"))
    expect(stem("Confit")).toBe("confit")
  })

  it("code never contradicts a label, and says why", () => {
    const wrong: string[] = []
    for (const p of REAL_PAIRS) {
      const [l] = linkPrior({ text: p.text, at: p.at }, [{ text: p.earlier, at: p.earlierAt }], COMMON)
      expect(l!.why.length).toBeGreaterThan(3)
      if (l!.call !== "unsure" && (l!.call === "linked") !== p.linked) wrong.push(`${l!.call} (${l!.why}): "${p.earlier.slice(0, 40)}" → "${p.text.slice(0, 40)}"`)
    }
    expect(wrong).toEqual([])
  })

  it("the person's own example: the BRAIN 2 note stands alone, the crying lines lean on each other", () => {
    const pair = (start: string) => REAL_PAIRS.find((p) => p.text.startsWith(start))!
    const brain = pair("BRAIN 2: allow llm bimflow")
    expect(linkPrior({ text: brain.text, at: brain.at }, [{ text: brain.earlier, at: brain.earlierAt }])[0]!.call).toBe("unlinked")
    const confit = REAL_PAIRS.find((p) => p.text.startsWith("Confit like 40") && p.linked)!
    expect(linkPrior({ text: confit.text, at: confit.at }, [{ text: confit.earlier, at: confit.earlierAt }])[0]!.call).toBe("linked")
    const crying = pair("Crying because")
    expect(linkPrior({ text: crying.text, at: crying.at }, [{ text: crying.earlier, at: crying.earlierAt }])[0]!.call).toBe("linked")
  })

  it("opening words alone never commit: 'Thus spent 80$' pointed past the line before it", () => {
    const thus = REAL_PAIRS.find((p) => p.text.startsWith("Thus spent"))!
    const [l] = linkPrior({ text: thus.text, at: thus.at }, [{ text: thus.earlier, at: thus.earlierAt }], COMMON)
    expect(l!.call).toBe("unsure")
    expect(l!.why).toContain("thus")
  })

  it("a repeat is linked, a long gap and a bare link are not", () => {
    const at = (m: number) => new Date(Date.UTC(2026, 9, 30, 20, m)).toISOString()
    expect(linkPrior({ text: "Log o", at: at(5) }, [{ text: "O", at: at(4) }])[0]!.call).toBe("linked")
    expect(linkPrior({ text: "Making me happy", at: at(59) }, [{ text: "Walking outside", at: at(0) }])[0]!.call).toBe("unlinked")
    expect(linkPrior({ text: "so good", at: at(2) }, [{ text: "https://www.instagram.com/reel/x/", at: at(1) }])[0]!.call).toBe("unlinked")
    expect(linkPrior({ text: "this reel is so good", at: at(2) }, [{ text: "https://www.instagram.com/reel/x/", at: at(1) }])[0]!.call).toBe("unsure")
  })

  it("in the routed flow, the gates see an earlier line only when it is needed", async () => {
    for (const p of REAL_PAIRS) {
      const lm = labelModel(REAL_LINES, REAL_PAIRS)
      const seen: string[] = []
      const call: typeof lm.call = async (req) => (seen.push(req.user), lm.call(req))
      const m: FlowMessage = { id: "p", text: p.text, at: p.at, prior: [{ text: p.earlier, at: p.earlierAt }], entry: "bim-text" }
      const run = await runFlow(routedLogFlow(), [m], call, PEN_VAULT, { model: "labels" })
      const ctx = run.messages[0]!.steps.find((s) => s.nodeId === "k-ctx")!.output as { prior: unknown[] }
      expect(ctx.prior.length, p.text).toBe(p.linked ? 1 : 0)
      const family = seen.find((u) => u.startsWith("What kind of line"))
      if (family) expect(family.includes(`(earlier `), p.text).toBe(p.linked)
    }
  })

  it("code-only mode asks no model", async () => {
    const flow = routedLogFlow()
    flow.nodes.find((n) => n.id === "k-ctx")!.config.contextMode = "code"
    const s = scriptedModel([])
    const p = REAL_PAIRS.find((x) => x.text.startsWith("That made me cry again"))!
    const run = await runFlow(flow, [{ id: "p", text: p.text, at: p.at, prior: [{ text: p.earlier, at: p.earlierAt }], entry: "bim-text" }], s.call, PEN_VAULT, { model: "t" })
    expect(s.calls.some((c) => c.user.includes("EARLIER ("))).toBe(false)
    expect((run.messages[0]!.steps[1]!.output as { prior: unknown[] }).prior).toEqual([])
  })
})

describe("blocks from real lines, a perfect model, and the person's own painted time", () => {
  const blocksFor = async (ls: RealLine[]) => (await runFlow(routedLogFlow(), ls.map(msg), labelModel(REAL_LINES, REAL_PAIRS).call, PEN_VAULT, { model: "labels" })).blocks

  it("every activity line gives the labelled pen and relation", async () => {
    for (const l of REAL_LINES.filter((x) => x.want.act)) {
      const run = await runFlow(routedLogFlow(), [msg(l)], labelModel(REAL_LINES, REAL_PAIRS).call, PEN_VAULT, { model: "labels" })
      const s = run.messages[0]!.signals[0]
      expect(s?.activity, l.text).toBe(l.want.act![0])
      expect(s?.relation, l.text).toBe(l.want.act![1])
    }
  })

  it("Oct 16 morning: shower done 09:44, then egg bites 09:50–10:48 with nothing in between", async () => {
    const b = await blocksFor([line("Done with shower"), line("Starting to cook making egg bites"), line("Still cooking egg bites"), line("Done cooking and eating egg bites")])
    expect(b.map(span)).toEqual(["09:14-09:44 shower*", "09:50-10:48 cooking"])
  })

  it("Oct 29: 'Walking since 4:46' sent 17:09 starts at 16:46, inside the walk the person painted 16:40–17:10", async () => {
    const [b] = await blocksFor([line("Walking since 4:46")])
    expect(hm(b!.start)).toBe("16:46")
    expect(minutes(b!.start, "2026-10-29T23:40:00.000Z")).toBeLessThanOrEqual(10)
  })

  it("Oct 30: 'Gonna clean up the checks' is the 20:28–20:58 block the person accepted", async () => {
    const [b] = await blocksFor([line("Gonna clean up the checks")])
    expect(span(b!)).toBe("20:28-20:58 cleaning*")
  })

  it("Oct 30: 'Confit like 40 more min' closes 40 minutes on", async () => {
    const [b] = await blocksFor([line("Confit like 40 more min")])
    expect(span(b!)).toBe("02:58-03:38 cooking*")
  })

  it("Oct 24: 'nap since 10' reaches back to 10:00, not a 30-minute guess", async () => {
    expect(placeSinceClock("10", new Date("2026-10-24T12:07:00"))?.getHours()).toBe(10)
    expect(placeSinceClock("3", new Date("2026-10-23T16:30:00"))?.getHours()).toBe(15)
    expect(placeSinceClock("14", new Date("2026-10-23T16:30:00"))).toBeNull()
    const [b] = await blocksFor([line("Nap i think maybe o idk nap since 10")])
    expect(span(b!)).toBe("10:00-12:07 Sleep")
  })

  it("lines that file nothing make no block", async () => {
    const quiet = REAL_LINES.filter((l) => l.want.family === "keeping" || l.want.family === "none")
    expect(await blocksFor(quiet)).toEqual([])
  })

  it("a whole real afternoon assembles without two blocks on the same minutes", async () => {
    const day = REAL_LINES.filter((l) => l.want.act && l.at.startsWith("2026-10-30")).sort((a, b) => a.at.localeCompare(b.at))
    const b = (await blocksFor(day)).sort((x, y) => x.start.localeCompare(y.start))
    for (let i = 1; i < b.length; i++) expect(b[i]!.start >= b[i - 1]!.end, `${span(b[i - 1]!)} / ${span(b[i]!)}`).toBe(true)
  })
})

describe("BIM's own heads, on the person's lines", () => {
  const snap: VaultSnapshot = {
    items: [
      { id: "i1", title: "Need makeup wipes", listIds: ["l-needed"] },
      { id: "i2", title: "Need new sponges too", listIds: ["l-needed"] },
      { id: "i3", title: "Need jewelry glue to repair hoops", listIds: ["l-needed", "l-shop"] },
      { id: "i4", title: "Need a lamp", listIds: ["l-shop"] },
    ],
    lists: [{ id: "l-needed", name: "Needed" }, { id: "l-shop", name: "shopping list" }, { id: "l-lyric", name: "Lyric" }, { id: "l-merch", name: "Merch" }, { id: "l-get", name: "needed" }],
    habits: [],
    scopes: [],
    skipListIds: new Set(),
  }

  it("a head names its list: Lyric:, Merch:, and get: → needed as the grammar does", () => {
    expect(headLists(snap, line("Lyric: baby yeah").text)).toEqual(["Lyric"])
    expect(headLists(snap, line("Merch: hand to hand").text)).toEqual(["Merch"])
    expect(headLists(snap, line("Get: more big, sheer scarves").text)).toEqual(["needed"])
    expect(headLists(snap, line("Plucky").text)).toEqual([])
  })

  it("a line's first word brings the lists the person's items with that word sit on (3 or more)", () => {
    expect(cueLists(snap, line("Need more macbook bricks").text)).toEqual(["Needed"])
    expect(cueLists(snap, line("Need more shorts for under dresses").text)).toEqual(["Needed"])
    expect(cueLists(snap, line("Portable scanner").text)).toEqual([])
  })

  it("grammar first routes the person's own verb lines by code, with no model", async () => {
    const s = scriptedModel([])
    const verb = REAL_LINES.filter((l) => /^\s*(intake|log):/i.test(l.text))
    expect(verb.length).toBeGreaterThan(0)
    const run = await runFlow(grammarFirstFlow(), verb.map(msg), s.call, PEN_VAULT, { model: "t", getFlow: (id) => (id === "log-routed" ? routedLogFlow() : undefined) })
    for (const m of run.messages) expect((m.steps.find((st) => st.nodeId === "r-verb")!.output as { by: string }).by, m.message.text).toBe("code")
    expect(run.messages.find((m) => m.message.text.startsWith("Intake: brig"))!.proposals.map((p) => p.action)).toEqual(["intake"])
  })
})
