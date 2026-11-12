/**
 * lib/stream-bimby/llm.ts — A local model reads the stream into filings; rules check every one
 *
 * With LLM on, the model lists what the stream contains (route, payload, time, source sentence).
 * It never writes the executor line: `lineFor` builds that from its answer, so the grammar stays
 * in one place. Each answer is checked against the text. A filing whose source is not in the
 * text is dropped, a time that is not HH:MM is taken from the piece it came from, and any piece
 * the model skipped is filed by the rules. No model, or no usable answer, means rules alone.
 */
import { chatCrew } from "@/lib/bim-flow/chat-models"
import { escalate } from "@/lib/bim-flow/crew"
import { ollamaCall } from "@/lib/bim-flow/ollama"
import { lineFor, ROUTES, ruleFilings, type Clock, type Filing, type Piece, type Route } from "./parse"

/** A 14B model took 180 s on a full day on the Mac; a shorter limit would throw that answer away. */
const TIMEOUT_MS = 300_000
const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/
const URL_RE = /https?:\/\/\S+|\bwww\.\S+/i

export const STREAM_SYSTEM = `You read one person's running log of their day: a stream of thought, minute by minute. List every filing in it, in order. Each filing is one thing to record.

Routes (use only these):
- inbox: a thought or task to keep in Inbox
- shopping: something to buy
- link: a web address
- todo: something to do today
- count: a tap on a counter, such as "dab pen"
- food: food eaten
- drink: a drink taken
- activity: something done with a start and an end time
- plan: something intended or future ("gonna", "going to", "then")
- mood: a feeling
- note: anything else worth keeping

Rules:
- payload: the words of the thing, copied from the text. Do not invent words.
- time: 24-hour HH:MM the text gives for this filing, or "" when none is stated.
- end: HH:MM only for activity, or "".
- est: true when the text says around, about, est, estimated or ~.
- source: the exact sentence or phrase from the text this filing rests on.
- reason: one short sentence on why.

Example. Text: "8:17 hit dab pen once. 8:17 - 9:15 doing dishes. coffee around 9:15 add to drinks tracking."
Filings: [{"route":"count","payload":"dab pen","time":"08:17","end":"","est":false,"source":"8:17 hit dab pen once","reason":"A tap on the dab pen."},{"route":"activity","payload":"dishes","time":"08:17","end":"09:15","est":false,"source":"8:17 - 9:15 doing dishes","reason":"A start and an end time."},{"route":"drink","payload":"coffee","time":"09:15","end":"","est":true,"source":"coffee around 9:15 add to drinks tracking","reason":"Said as a drink, with an approximate time."}]

Output JSON only.`

export const STREAM_SCHEMA = {
  type: "object",
  properties: {
    filings: {
      type: "array",
      items: {
        type: "object",
        properties: {
          route: { type: "string", enum: [...ROUTES] },
          payload: { type: "string" },
          time: { type: "string" },
          end: { type: "string" },
          est: { type: "boolean" },
          source: { type: "string" },
          reason: { type: "string" },
        },
        required: ["route", "payload", "time", "source"],
      },
    },
  },
  required: ["filings"],
}

interface ModelFiling {
  route?: unknown
  payload?: unknown
  time?: unknown
  end?: unknown
  est?: unknown
  source?: unknown
  reason?: unknown
}

const norm = (s: string) => s.toLowerCase().replace(/\s+/g, " ").trim()

/** The piece a model source phrase falls in: the first one that contains it, or that it contains. */
function pieceFor(source: string, ps: Piece[]): Piece | null {
  const want = norm(source)
  if (!want) return null
  return ps.find((p) => norm(p.text).includes(want)) ?? ps.find((p) => want.includes(norm(p.text)) && norm(p.text).length > 3) ?? null
}

export interface Filed {
  piece: Piece
  filing: Filing
}

/**
 * Turn the model's answer into filings. Each is checked: a known route, a source in the text, a
 * payload, and an end only for activity. Returns the kept filings and the reasons others were dropped.
 */
export function filingsFromModel(raw: unknown, ps: Piece[]): { filed: Filed[]; dropped: string[] } {
  const list = (raw as { filings?: unknown })?.filings
  const filed: Filed[] = []
  const dropped: string[] = []
  if (!Array.isArray(list)) return { filed, dropped: ["no filings list"] }
  for (const item of list as ModelFiling[]) {
    const route = typeof item.route === "string" && (ROUTES as readonly string[]).includes(item.route) ? (item.route as Route) : null
    // "1 samosa" files as "samosa": the count belongs to the stream, not the food.
    const payload = typeof item.payload === "string" ? item.payload.replace(/\s+/g, " ").replace(/^\d+\s+/, "").trim() : ""
    const source = typeof item.source === "string" ? item.source.trim() : ""
    if (!route) {
      dropped.push(`unknown route "${String(item.route)}"`)
      continue
    }
    if (!payload || payload.length > 400) {
      dropped.push(`${route}: empty or too long payload`)
      continue
    }
    const piece = pieceFor(source, ps)
    if (!piece) {
      dropped.push(`${route}: source not in the text ("${source.slice(0, 40)}")`)
      continue
    }
    const time = typeof item.time === "string" && HHMM.test(item.time) ? item.time : piece.t.hhmm
    // With no flag, a time the text does not state for this piece is exact, not estimated.
    const est = typeof item.est === "boolean" ? item.est : time === piece.t.hhmm ? piece.t.est : false
    // A window in the text has its end even when the model leaves it out.
    const end = typeof item.end === "string" && HHMM.test(item.end) ? item.end : piece.own?.end
    const reason = typeof item.reason === "string" && item.reason.trim() ? item.reason.trim().slice(0, 200) : "Read by the model."
    const clock: Clock = { hhmm: time, est, ...(end ? { end } : {}) }
    let r: Route = route
    let line: string
    if (r === "link") {
      const url = URL_RE.exec(payload)
      if (!url) {
        dropped.push("link: no web address in payload")
        continue
      }
      line = url[0]
    } else if (r === "activity") {
      if (!end) {
        r = "note"
        line = lineFor("note", payload, clock)
      } else line = lineFor("activity", payload, clock)
    } else {
      line = lineFor(r, payload, clock)
    }
    filed.push({ piece, filing: { route: r, line, reasoning: `${reason} (model)`, source: piece.text.length > 160 ? `${piece.text.slice(0, 157)}…` : piece.text } })
  }
  return { filed, dropped }
}

/** Model filings, plus the rules' filing for every piece no model filing covers. Ordered by the text. */
export function withCoverage(modelFiled: Filed[], ps: Piece[]): { filed: Filed[]; backfilled: number } {
  const covered = new Set(modelFiled.map((f) => f.piece.index))
  const extra = ruleFilings(ps).filter((r) => !covered.has(r.piece.index))
  const all = [...modelFiled, ...extra].sort((a, b) => a.piece.index - b.piece.index)
  return { filed: all, backfilled: extra.length }
}

export interface ModelReading {
  filed: Filed[]
  model: string
  trace: string[]
}

/** Ask the crew's extract ladder for the filings. Null when no model is reachable or none gave usable filings. */
export async function readWithModel(text: string, ps: Piece[]): Promise<ModelReading | null> {
  const crew = await chatCrew()
  if (!crew) return null
  const call = ollamaCall(crew.main, AbortSignal.timeout(TIMEOUT_MS))
  const { out, hops } = await escalate<unknown>(call, crew.extract.length ? crew.extract : [crew.main], { system: STREAM_SYSTEM, user: `TEXT:\n${text}`, schema: STREAM_SCHEMA, maxTokens: 2000 }, (raw) => {
    const { filed } = filingsFromModel(raw, ps)
    return filed.length ? null : "no usable filings"
  })
  if (!out) return null
  const { filed, dropped } = filingsFromModel(out, ps)
  if (!filed.length) return null
  const model = hops.at(-1)?.model ?? crew.main
  const trace = [`Model ${model} read ${filed.length} filing${filed.length === 1 ? "" : "s"}.`]
  if (dropped.length) trace.push(`Dropped ${dropped.length} the text does not support: ${dropped.slice(0, 3).join("; ")}.`)
  return { filed, model, trace }
}
