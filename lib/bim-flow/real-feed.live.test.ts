/**
 * Opt-in: score a real local model on the labelled BIM lines, gate by gate.
 * `BIM_LIVE=1 npx vitest run lib/bim-flow/real-feed.live.test.ts`
 * Model: BIM_MODEL (default qwen2.5:14b-instruct). Gate model: BIM_GATE_MODEL (default the same).
 *
 * The vault is the hub copy on disk when present (`data/shared-persist.json`), so search offers
 * what the lab offers. Each line runs through the routed log flow with its real two lines before it.
 * Scores, per room: the first route (family), the activity pen and relation, the list picked, and
 * the context yes/no on the pairs code was unsure of. A label-model run of the same lines is the
 * ceiling (what code alone allows), so a gap is the model's share. The report is written to
 * `data/bim-flow-runs/real-eval-<model>-<date>.json` (git-ignored). Nothing asserts a score: the
 * numbers are the result, compared run to run.
 */
import fs from "node:fs"
import { describe, expect, it } from "vitest"
import { commonStems, contextPrompt, linkPrior } from "./context-link"
import { labelModel } from "./label-model"
import { DEFAULT_MODEL, ollamaCall } from "./ollama"
import { REAL_LINES, REAL_PAIRS, type RealLine } from "./real-feed"
import { runFlow } from "./run-flow"
import { snapshotFromPersistItems } from "./store-snapshot"
import { routedLogFlow } from "./task-flows"
import type { FlowRun, MessageRun } from "./types"
import type { VaultSnapshot } from "./vault-search"

const live = process.env.BIM_LIVE === "1"
const model = process.env.BIM_MODEL ?? DEFAULT_MODEL
const gates = process.env.BIM_GATE_MODEL ?? model
const FILE = "data/shared-persist.json"

interface Score {
  right: number
  of: number
  misses: string[]
}
const score = (): Score => ({ right: 0, of: 0, misses: [] })
const tally = (s: Score, ok: boolean, miss: string) => {
  s.of++
  if (ok) s.right++
  else if (s.misses.length < 40) s.misses.push(miss)
}

function scoreRun(l: RealLine, m: MessageRun, s: Record<string, Score>) {
  const fam = (m.steps.find((x) => x.nodeId === "r-family")?.output as { routes?: string[] } | undefined)?.routes?.[0] ?? "none"
  tally(s.family!, fam === l.want.family, `${l.want.family} → ${fam}: ${l.text.slice(0, 60)}`)
  const sig = m.signals[0]
  if (l.want.act) {
    const ok = sig?.activity.toLowerCase() === l.want.act[0].toLowerCase() && sig.relation === l.want.act[1]
    tally(s.activity!, ok, `${l.want.act.slice(0, 2).join("/")} → ${sig ? `${sig.activity}/${sig.relation}` : "none"}: ${l.text.slice(0, 50)}`)
  } else tally(s.noInventedBlock!, !sig, `invented ${sig?.activity}: ${l.text.slice(0, 50)}`)
  if (l.want.keep) {
    const picks = m.proposals.filter((p) => p.action === "add-to-list").flatMap((p) => (p.data.picks as string[] | undefined) ?? [])
    tally(s.list!, picks.some((p) => p.toLowerCase() === l.want.keep!.toLowerCase()), `${l.want.keep} → ${picks.join(", ") || "none"}: ${l.text.slice(0, 50)}`)
  }
  if (l.want.self) {
    const self = (m.steps.find((x) => x.nodeId === "r-self")?.output as { routes?: string[] } | undefined)?.routes?.[0] ?? "none"
    tally(s.self!, self === l.want.self, `${l.want.self} → ${self}: ${l.text.slice(0, 50)}`)
  }
}

describe.skipIf(!live)(`live: labelled BIM lines on ${model}`, () => {
  const snap: VaultSnapshot = fs.existsSync(FILE)
    ? snapshotFromPersistItems((JSON.parse(fs.readFileSync(FILE, "utf8")) as { items: Record<string, string> }).items).snap
    : { items: [], lists: [], habits: [], scopes: [], skipListIds: new Set() }

  it("scores every room", { timeout: 60 * 60_000 }, async () => {
    const call = ollamaCall(model)
    const flow = routedLogFlow()
    const lanes = ["family", "activity", "noInventedBlock", "list", "self"]
    const real: Record<string, Score> = Object.fromEntries(lanes.map((k) => [k, score()]))
    const ceiling: Record<string, Score> = Object.fromEntries(lanes.map((k) => [k, score()]))
    const t0 = Date.now()
    const lm = labelModel(REAL_LINES, REAL_PAIRS)
    for (const l of REAL_LINES) {
      const m = { id: l.id, text: l.text, at: l.at, prior: l.prior, entry: "bim-text" }
      const run: FlowRun = await runFlow(flow, [m], call, snap, { model, models: { gates } })
      scoreRun(l, run.messages[0]!, real)
      scoreRun(l, (await runFlow(flow, [m], lm.call, snap, { model: "labels" })).messages[0]!, ceiling)
    }

    // The context yes/no, asked only where code was unsure (as the node does).
    const common = commonStems(snap.history?.feed ?? [])
    const ctx = score()
    const gateCall = ollamaCall(gates)
    for (const p of REAL_PAIRS) {
      const [link] = linkPrior({ text: p.text, at: p.at }, [{ text: p.earlier, at: p.earlierAt }], common)
      if (link!.call !== "unsure") continue
      const out = (await gateCall({
        system: "Answer one yes/no question about one short message a person sent to their notes app. Be strict: when unsure, answer no. JSON only.",
        user: contextPrompt({ text: p.text, at: p.at }, { text: p.earlier, at: p.earlierAt }),
        schema: { type: "object", properties: { answer: { type: "string", enum: ["yes", "no"] } }, required: ["answer"] },
        maxTokens: 20,
      })) as { answer?: string }
      tally(ctx, (out.answer === "yes") === p.linked, `${p.linked ? "linked" : "apart"} → ${out.answer}: "${p.earlier.slice(0, 35)}" → "${p.text.slice(0, 35)}"`)
    }

    const pct = (s: Score) => (s.of ? `${s.right}/${s.of} (${Math.round((100 * s.right) / s.of)}%)` : "—")
    const lines = [...lanes.map((k) => `${k.padEnd(16)} model ${pct(real[k]!).padEnd(14)} code ceiling ${pct(ceiling[k]!)}`), `${"context yes/no".padEnd(16)} model ${pct(ctx)}`]
    console.log(`${model} (gates ${gates}), ${REAL_LINES.length} lines, ${Math.round((Date.now() - t0) / 1000)}s\n${lines.join("\n")}`)
    const day = new Date().toISOString().slice(0, 10)
    fs.mkdirSync("data/bim-flow-runs", { recursive: true })
    fs.writeFileSync(
      `data/bim-flow-runs/real-eval-${model.replace(/[^\w.-]+/g, "_")}-${day}.json`,
      JSON.stringify({ model, gates, at: new Date().toISOString(), ms: Date.now() - t0, real, ceiling, context: ctx }, null, 1),
    )
    expect(real.family!.of).toBe(REAL_LINES.length)
  })
})
