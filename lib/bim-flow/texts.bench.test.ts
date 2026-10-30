/**
 * Opt-in check of how to feed texts to a model, against the person's real data.
 * `BIM_TEXTS_BENCH=1 npx vitest run lib/bim-flow/texts.bench.test.ts`
 * For each text I sent inside a confirmed Activity block (not generated, not
 * estimated), the model picks which activity it was from a list. Each context
 * style is scored on how often it picks the tracked one. Results go to
 * data/bim-flow-runs/texts-bench.json. Needs Ollama; reads files, writes one.
 */
import fs from "node:fs"
import path from "node:path"
import { describe, it } from "vitest"
import { ollamaCall } from "./ollama"
import { toRows, type RawText, type TextRow } from "./texts"

const ROOT = process.cwd()
const run = process.env.BIM_TEXTS_BENCH === "1"
const DAYS = Number(process.env.BIM_TEXTS_DAYS ?? 14)
const SAMPLE = Number(process.env.BIM_TEXTS_SAMPLE ?? 60)
const MODEL = process.env.BIM_MODEL ?? "qwen2.5:14b-instruct"

type Ctx = "alone" | "thread" | "burst" | "nearby"
const CTXS: Ctx[] = ["alone", "thread", "burst", "nearby"]
const hhmm = (iso: string) => iso.length > 5 ? `${String(new Date(iso).getHours()).padStart(2, "0")}:${String(new Date(iso).getMinutes()).padStart(2, "0")}` : iso
const line = (r: TextRow) => `${hhmm(r.at)} ${r.dir === "out" ? "me" : r.who}: ${r.text.slice(0, 140)}`

describe.skipIf(!run)("texts bench (real data)", () => {
  it("scores context styles", async () => {
    const store = JSON.parse(fs.readFileSync(path.join(ROOT, "data/shared-persist.json"), "utf8")).items
    const tg = JSON.parse(store["brain2-timegrid-store"]).state
    const pens = new Map<string, string>()
    for (const s of tg.scopes) if (s.id === "activity") for (const p of s.pens) pens.set(p.id, String(p.name).slice(0, 40))
    const since = new Date(Date.now() - DAYS * 86400_000)
    const key = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
    const blocks = (tg.entries as { date: string; scopeId: string; penId: string; startMin: number; endMin: number; precision?: string; generatedBy?: unknown; kind?: string }[]).filter(
      (e) => e.scopeId === "activity" && !e.generatedBy && e.precision !== "estimated" && e.kind !== "instant" && e.endMin > e.startMin && e.date >= key(since),
    )
    const counts = new Map<string, number>()
    for (const b of blocks) counts.set(pens.get(b.penId) ?? b.penId, (counts.get(pens.get(b.penId) ?? b.penId) ?? 0) + 1)
    const options = [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10).map(([n]) => n)
    const raw: RawText[] = []
    for (const l of fs.readFileSync(path.join(ROOT, "data/phone-sync/messages.jsonl"), "utf8").split("\n")) {
      if (!l.includes('"type":"message"') || !l) continue
      const r = JSON.parse(l)
      if (r.at >= since.getTime()) raw.push({ at: r.at, dir: r.direction, h: r.party?.handle ?? "", th: r.threadId, g: r.members?.length ? 1 : undefined, t: String(r.body ?? "") })
    }
    const rows = toRows(raw, (h) => h.slice(-4))
    const samples: { row: TextRow; truth: string }[] = []
    for (const r of rows.filter((x) => x.dir === "out" && x.text.length > 6)) {
      const d = new Date(r.at)
      const m = d.getHours() * 60 + d.getMinutes()
      const b = blocks.find((x) => x.date === key(d) && m >= x.startMin && m < x.endMin && options.includes(pens.get(x.penId) ?? x.penId))
      if (b) samples.push({ row: r, truth: pens.get(b.penId) ?? b.penId })
    }
    const step = Math.max(1, Math.floor(samples.length / SAMPLE))
    const picked = samples.filter((_, i) => i % step === 0).slice(0, SAMPLE)
    const call = ollamaCall(MODEL)
    const schema = { type: "object", properties: { activity: { type: "string", enum: [...options, "unknown"] } }, required: ["activity"] }
    const system = "You decide what a person was doing when they sent a text. Choose from the list only. If the text and context do not say, answer unknown."
    const score: Record<string, { right: number; unknown: number; n: number }> = Object.fromEntries(CTXS.map((c) => [c, { right: 0, unknown: 0, n: 0 }]))
    const detail: unknown[] = []
    for (const s of picked) {
      const t = new Date(s.row.at).getTime()
      const ctx: Record<Ctx, string> = {
        alone: "",
        thread: rows.filter((x) => x.thread === s.row.thread && x.at < s.row.at).slice(-4).map(line).join("\n"),
        burst: rows.filter((x) => x.thread === s.row.thread && Math.abs(new Date(x.at).getTime() - t) <= 30 * 60_000 && x.at !== s.row.at).map(line).slice(-8).join("\n"),
        nearby: rows.filter((x) => x.dir === "out" && x.at !== s.row.at && Math.abs(new Date(x.at).getTime() - t) <= 45 * 60_000).map(line).slice(-8).join("\n"),
      }
      const got: Record<string, string> = {}
      for (const c of CTXS) {
        const user = `Activities: ${options.join("; ")}; unknown\n${ctx[c] ? `\nOther texts around it:\n${ctx[c]}\n` : ""}\nText I sent at ${hhmm(s.row.at)} to ${s.row.who}: ${s.row.text.slice(0, 300)}\n\nWhat was I doing?`
        const out = (await call({ system, user, schema, maxTokens: 40 })) as { activity?: string }
        const a = out.activity ?? "unknown"
        got[c] = a
        score[c]!.n++
        if (a === s.truth) score[c]!.right++
        if (a === "unknown") score[c]!.unknown++
      }
      detail.push({ at: s.row.at, text: s.row.text.slice(0, 80), truth: s.truth, got })
    }
    const base = Math.max(...[...counts.values()]) / blocks.length
    const out = { model: MODEL, days: DAYS, samples: picked.length, options, blocksBaseline: base, score, detail }
    fs.mkdirSync(path.join(ROOT, "data/bim-flow-runs"), { recursive: true })
    fs.writeFileSync(path.join(ROOT, "data/bim-flow-runs/texts-bench.json"), JSON.stringify(out, null, 1))
    console.log(JSON.stringify({ samples: picked.length, options, baseline: base, score }, null, 1))
  }, 3_600_000)
})
