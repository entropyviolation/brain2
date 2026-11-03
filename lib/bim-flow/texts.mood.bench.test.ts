/**
 * Opt-in: can the texts I sent in a day say how I felt? Checked against the Mood
 * pens the person logged. `BIM_TEXTS_BENCH=1 npx vitest run lib/bim-flow/texts.mood.bench.test.ts`
 * Writes data/bim-flow-runs/texts-mood-bench.json: per day, what was logged and what the model read.
 */
import fs from "node:fs"
import path from "node:path"
import { describe, it } from "vitest"
import { ollamaCall } from "./ollama"
import { textsToFeed, toRows, type RawText } from "./texts"

const ROOT = process.cwd()
const run = process.env.BIM_TEXTS_BENCH === "1"

describe.skipIf(!run)("texts mood bench (real data)", () => {
  it("reads a day's sent texts for mood", async () => {
    const store = JSON.parse(fs.readFileSync(path.join(ROOT, "data/shared-persist.json"), "utf8")).items
    const tg = JSON.parse(store["brain2-timegrid-store"]).state
    const pens = new Map<string, string>()
    for (const s of tg.scopes) if (s.id === "mood") for (const p of s.pens) pens.set(p.id, String(p.name))
    const since = new Date(Date.now() - 60 * 86400_000)
    const key = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
    const logged = new Map<string, string[]>()
    for (const e of tg.entries as { date: string; scopeId: string; penId: string; generatedBy?: unknown }[]) {
      if (e.scopeId === "mood" && !e.generatedBy && e.date >= key(since)) logged.set(e.date, [...(logged.get(e.date) ?? []), pens.get(e.penId) ?? e.penId])
    }
    const raw: RawText[] = []
    for (const l of fs.readFileSync(path.join(ROOT, "data/phone-sync/messages.jsonl"), "utf8").split("\n")) {
      if (!l.includes('"type":"message"')) continue
      const r = JSON.parse(l)
      if (r.at >= since.getTime()) raw.push({ at: r.at, dir: r.direction, h: r.party?.handle ?? "", th: r.threadId, g: r.members?.length ? 1 : undefined, t: String(r.body ?? "") })
    }
    const rows = toRows(raw, (h) => h.slice(-4))
    const call = ollamaCall("qwen2.5:14b-instruct")
    const schema = {
      type: "object",
      properties: { mood: { type: "string", maxLength: 60 }, sure: { type: "string", enum: ["clear", "weak", "none"] } },
      required: ["mood", "sure"],
    }
    const system =
      "You read the texts a person SENT in one day and say how they seemed to feel, in a few words. Only use what their own words show (complaints, excitement, apologies, jokes, tiredness). " +
      "If the texts are just logistics, answer mood 'neutral' and sure 'none'."
    const out: unknown[] = []
    for (const [date, was] of [...logged.entries()].sort()) {
      const day = rows.filter((r) => key(new Date(r.at)) === date)
      const mine = textsToFeed(day, "mine")
      if (mine.length < 5) {
        out.push({ date, logged: was, skipped: `only ${mine.length} sent texts` })
        continue
      }
      const body = mine.map((m) => m.text).join("\n").slice(-2800)
      const got = (await call({ system, user: `Texts I sent on ${date}:\n${body}\n\nHow did I seem to feel?`, schema, maxTokens: 60 })) as { mood?: string; sure?: string }
      out.push({ date, logged: was, sent: mine.length, read: got.mood, sure: got.sure })
    }
    fs.writeFileSync(path.join(ROOT, "data/bim-flow-runs/texts-mood-bench.json"), JSON.stringify(out, null, 1))
    console.log(JSON.stringify(out, null, 1))
  }, 1_200_000)
})
