/**
 * Opt-in: the scorecard on the person's real labelled lines. Run it with `npm run bim:scorecard` (see
 * `scripts/bim-scorecard.mjs`), or by hand:
 *
 *   BIM_SCORECARD=1 npx vitest run lib/bim-scorecard/real-lines.live.test.ts
 *
 * - Lines: `BIM_SCORECARD_FILE` (default `data/bim-log-export/real-lines.labelled.jsonl`, gitignored); the
 *   committed fixture when that file is missing. `BIM_SCORECARD_LIMIT` keeps the first N, `BIM_SCORECARD_LANES`
 *   (comma list) keeps those lanes.
 * - Vault: the hub copy (`data/shared-persist.json`) is loaded into the stores, so names, habits and lists are the
 *   person's own. Every line starts from that same copy; nothing is written back to disk. `BIM_SCORECARD_VAULT=0`
 *   uses the empty test vault.
 * - Variants: code only, unless `BIM_SCORECARD_LLM=only`. `BIM_SCORECARD_LLM=1` adds the live run with the chat crew on this Mac's Ollama.
 *   Before it, each crew model is loaded once and that load time is reported apart from the run
 *   (`BIM_SCORECARD_COLD=1` skips that, so a cold load shows inside the turns).
 * - Out: `data/bim-scorecards/<date>-<variant>.json` (gitignored), printed with what was gained and lost since the
 *   last card of the same variant and source. Nothing asserts a score here; the CI floor is `real-lines.test.ts`.
 */

import fs from "node:fs"
import path from "node:path"
import { describe, expect, it, vi } from "vitest"
import { resetAllStores } from "@/tests/test-utils"
import { chatCrew, forgetChatCrew } from "@/lib/bim-flow/chat-models"
import { ollamaCall, watchModelCalls, type ModelCallSeen } from "@/lib/bim-flow/ollama"
import { useBimChatStore } from "@/lib/ingest/bim-chat"
import { diffRuns, formatCard, summarize, type SavedCard } from "./card"
import { FIXTURE_LINES } from "./fixture"
import { replayLines } from "./replay"
import type { LabelledLine } from "./score"

const live = process.env.BIM_SCORECARD === "1"
const FILE = process.env.BIM_SCORECARD_FILE ?? "data/bim-log-export/real-lines.labelled.jsonl"
const VAULT = "data/shared-persist.json"
const OUT = "data/bim-scorecards"

function readLines(): { lines: LabelledLine[]; source: string } {
  let lines: LabelledLine[]
  let source: string
  if (fs.existsSync(FILE)) {
    lines = fs
      .readFileSync(FILE, "utf8")
      .split("\n")
      .filter((l) => l.trim())
      .map((l) => JSON.parse(l) as LabelledLine)
    source = path.basename(FILE)
  } else {
    lines = FIXTURE_LINES
    source = "fixture"
  }
  const lanes = process.env.BIM_SCORECARD_LANES?.split(",").map((s) => s.trim()).filter(Boolean)
  if (lanes?.length) lines = lines.filter((l) => lanes.includes(l.expectedLane))
  const limit = Number(process.env.BIM_SCORECARD_LIMIT ?? 0)
  if (limit > 0) lines = lines.slice(0, limit)
  return { lines, source: `${source}${lanes?.length ? ` [${lanes.join(",")}]` : ""}${limit > 0 ? ` (first ${limit})` : ""}` }
}

/** The stores the executor and the lanes read, as the phone hub loads them (`scripts/phone-hub.ts`). */
async function vaultStores() {
  const mods = await Promise.all([
    import("@/lib/task-store").then((m) => m.useTaskStore),
    import("@/lib/ingest/ingest-store").then((m) => m.useIngestStore),
    import("@/lib/habits-store").then((m) => m.useHabitsStore),
    import("@/lib/time-tracking-store").then((m) => m.useTimeTrackingStore),
    import("@/lib/sleep-store").then((m) => m.useSleepStore),
    import("@/lib/event-store").then((m) => m.useEventStore),
    import("@/lib/work-session-store").then((m) => m.useWorkSessionStore),
    import("@/lib/pen-color-session-store").then((m) => m.usePenColorSessionStore),
  ])
  return mods as unknown as { getState: () => object; setState: (s: object, replace?: boolean) => void; persist?: { rehydrate: () => Promise<void> | void } }[]
}

/** Loads the hub's vault copy into the stores once, and returns a reset that puts every store back to it. */
async function vaultReset(useVault: boolean): Promise<{ reset: () => void; loaded: boolean }> {
  const plain = () => {
    resetAllStores()
    useBimChatStore.getState().clear()
  }
  if (!useVault || !fs.existsSync(VAULT)) return { reset: plain, loaded: false }
  plain()
  const items = (JSON.parse(fs.readFileSync(VAULT, "utf8")) as { items?: Record<string, unknown> }).items ?? {}
  for (const [k, v] of Object.entries(items)) if (typeof v === "string") localStorage.setItem(k, v)
  const stores = await vaultStores()
  for (const s of stores) await s.persist?.rehydrate()
  const saved = stores.map((s) => s.getState())
  return {
    loaded: true,
    reset: () => {
      stores.forEach((s, i) => s.setState(saved[i]!, true))
      useBimChatStore.getState().clear()
    },
  }
}

/** Load each crew model once with a one-word prompt, so the run's times are warm; the load is reported on its own. */
async function warmCrew(): Promise<{ model: string; ms: number; loadMs?: number }[]> {
  forgetChatCrew()
  const crew = await chatCrew()
  if (!crew) return []
  const models = [...new Set([crew.route[0], crew.gate[0], crew.pick[0], crew.main].filter((m): m is string => !!m))]
  const out: { model: string; ms: number; loadMs?: number }[] = []
  for (const model of models) {
    let seen: ModelCallSeen | null = null
    const stop = watchModelCalls((c) => (seen = c))
    const t0 = Date.now()
    try {
      await ollamaCall(model, AbortSignal.timeout(180_000), { fresh: true })({ system: "Answer with JSON.", user: 'Say {"ok":true}.', schema: { type: "object", properties: { ok: { type: "boolean" } }, required: ["ok"] }, maxTokens: 10 })
    } catch {}
    stop()
    const s = seen as ModelCallSeen | null
    out.push({ model, ms: Date.now() - t0, ...(s?.loadMs !== undefined ? { loadMs: s.loadMs } : {}) })
  }
  return out
}

function lastCard(variant: string, source: string): SavedCard | null {
  if (!fs.existsSync(OUT)) return null
  const files = fs
    .readdirSync(OUT)
    .filter((f) => f.endsWith(`-${variant}.json`))
    .sort()
    .reverse()
  for (const f of files) {
    try {
      const card = JSON.parse(fs.readFileSync(path.join(OUT, f), "utf8")) as SavedCard
      if (card.version === 1 && card.source === source) return card
    } catch {}
  }
  return null
}

function save(card: SavedCard, extra: Record<string, unknown> = {}): string {
  fs.mkdirSync(OUT, { recursive: true })
  const file = path.join(OUT, `${card.at.slice(0, 19).replace(/[:T]/g, "-")}-${card.variant}.json`)
  fs.writeFileSync(file, JSON.stringify({ ...card, ...extra }, null, 1))
  return file
}

describe.skipIf(!live)("BIM real-line scorecard (live, opt-in)", () => {
  it("replays the labelled lines, saves a dated scorecard and compares it with the last one", async () => {
    // Only this Mac's model daemon may be reached. The web, the texts hub and the flow archive all answer "down",
    // so a replay never searches, never reads texts off the hub, and never adds to `data/bim-flow-runs/`.
    const realFetch = globalThis.fetch
    vi.stubGlobal("fetch", (url: RequestInfo | URL, init?: RequestInit) => {
      const u = String(url instanceof Request ? url.url : url)
      if (/^https?:\/\/(127\.0\.0\.1|localhost):11434\//.test(u)) return realFetch(url, init)
      return Promise.reject(new Error("no network in the scorecard"))
    })
    const { lines, source } = readLines()
    const { reset, loaded } = await vaultReset(process.env.BIM_SCORECARD_VAULT !== "0")
    const src = `${source}${loaded ? " · vault" : " · test vault"}`
    const variants: { id: string; label: string; llm: boolean }[] = []
    if (process.env.BIM_SCORECARD_LLM !== "only") variants.push({ id: "code", label: "Code only", llm: false })
    if (process.env.BIM_SCORECARD_LLM === "1" || process.env.BIM_SCORECARD_LLM === "only") variants.push({ id: "llm", label: "LLM on (chat crew)", llm: true })
    const printed: string[] = []
    for (const v of variants) {
      // `BIM_SCORECARD_COLD=1` skips the warm-up, to see what a cold or swapped model costs inside a turn.
      const warm = v.llm && process.env.BIM_SCORECARD_COLD !== "1" ? await warmCrew() : []
      const t0 = Date.now()
      const run = await replayLines(lines, {
        variant: v.id,
        label: v.label,
        llm: v.llm,
        reset,
        onRow: (_r, done) => {
          if (done % 50 === 0) process.stdout.write(`  ${v.id}: ${done}/${lines.length} · ${Math.round((Date.now() - t0) / 1000)}s\n`)
        },
      })
      const card = summarize(run, src, v.llm)
      const last = lastCard(v.id, src)
      const diff = last ? diffRuns(last, card) : null
      const file = save(card, { runMs: Date.now() - t0, ...(warm.length ? { warm } : {}) })
      const head = warm.length ? `model load before the run: ${warm.map((w) => `${w.model} ${(w.ms / 1000).toFixed(1)}s${w.loadMs !== undefined ? ` (load ${(w.loadMs / 1000).toFixed(1)}s)` : ""}`).join(", ")}\n` : ""
      printed.push(`${head}${formatCard(card, diff, last)}\nrun ${(Math.round((Date.now() - t0) / 100) / 10).toFixed(1)}s · saved ${file}`)
      expect(card.n).toBeGreaterThan(0)
    }
    process.stdout.write(`\n${printed.join("\n\n")}\n`)
    vi.unstubAllGlobals()
  }, 6 * 60 * 60 * 1000)
})
