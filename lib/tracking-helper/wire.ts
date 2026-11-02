/**
 * lib/tracking-helper/wire.ts — The one model call: point at the tags, write the activity
 *
 * Schema-bound (`format`), with every tag field an enum of the tags that exist plus "", so the model
 * cannot name a time that was not in the text. Output is small (about 40 tokens per activity) and
 * identical prompts are answered from `ollamaCall`'s memory. The ladder starts at the first rung and
 * climbs only when an answer is empty or an entry has no activity (`escalate`). With no model, or
 * when every rung fails, `wireByRules` reads the same tags with plain rules, so the Helper still
 * works with Ollama off.
 */

import { escalate } from "@/lib/bim-flow/crew"
import type { ModelCall } from "@/lib/bim-flow/ollama"
import type { HelperFlow } from "./flow"
import type { HelperContext, Token, WiredSegment, Wiring } from "./types"

const STR = { type: "string", maxLength: 80 }

export function wireSchema(tokens: Token[]): Record<string, unknown> {
  const ids = (kind: Token["kind"]) => ["", ...tokens.filter((t) => t.kind === kind).map((t) => t.id)]
  const tag = (kind: Token["kind"]) => ({ type: "string", enum: ids(kind) })
  return {
    type: "object",
    required: ["segments"],
    properties: {
      segments: {
        type: "array",
        maxItems: 14,
        items: {
          type: "object",
          required: ["activity", "place", "day", "start", "end", "maybeEnd", "length", "startVague", "endVague", "notes"],
          properties: {
            activity: STR,
            place: STR,
            day: tag("day"),
            start: tag("clock"),
            end: tag("clock"),
            maybeEnd: tag("clock"),
            length: tag("dur"),
            startVague: { type: "boolean" },
            endVague: { type: "boolean" },
            notes: { type: "string", maxLength: 100 },
          },
        },
      },
    },
  }
}

/** The system text the model sees: the prompt, the flow's extra line, learned skills (`lib/skills/`), then the examples. */
export function systemText(flow: HelperFlow, skills = ""): string {
  const ex = flow.wire.examples.map((e, i) => `EXAMPLE ${i + 1}\nTEXT: ${e.text}\nANSWER: ${e.json}`).join("\n\n")
  return [flow.wire.system, flow.wire.extra, skills, ex].filter((s) => s.trim()).join("\n\n")
}

export function userText(marked: string, tokens: Token[], ctx: HelperContext): string {
  const tags = tokens.map((t) => `${t.id}=${t.raw}`).join(", ")
  const places = ctx.locationPens.slice(0, 40).map((p) => p.name).join(", ")
  return [`TODAY: ${ctx.now.toDateString()}`, places ? `KNOWN PLACES: ${places}` : "", `TAGS: ${tags || "none"}`, `TEXT: ${marked}`].filter(Boolean).join("\n")
}

const blank = (): WiredSegment => ({ activity: "", place: "", day: "", start: "", end: "", maybeEnd: "", length: "", startVague: false, endVague: false, notes: "" })

/** Keep only well-formed entries; the grammar already did most of this. */
export function cleanWiring(out: unknown): Wiring {
  const raw = (out as { segments?: Partial<WiredSegment>[] } | null)?.segments
  return { segments: (Array.isArray(raw) ? raw : []).map((s) => ({ ...blank(), ...s })).filter((s) => String(s.activity).trim()) }
}

export interface WireResult {
  wiring: Wiring
  model?: string
  hops: { model: string; ms: number; why?: string }[]
  prompt: string
  /** Why the rules answered instead of a model, when they did. */
  fallback?: string
}

export async function wire(call: ModelCall | null, ladder: string[], flow: HelperFlow, marked: string, tokens: Token[], ctx: HelperContext, skills = ""): Promise<WireResult> {
  const system = systemText(flow, skills)
  const user = userText(marked, tokens, ctx)
  const prompt = `${system}\n\n---\n\n${user}`
  if (!call || !ladder.length) return { wiring: wireByRules(marked, tokens, ctx), hops: [], prompt, fallback: call ? "no model installed" : "no model reachable" }
  const { out, hops } = await escalate<Wiring>(
    call,
    ladder,
    { system, user, schema: wireSchema(tokens), maxTokens: flow.wire.maxTokens },
    (o) => {
      const w = cleanWiring(o)
      return w.segments.length ? null : "no activity found"
    },
  )
  const wiring = cleanWiring(out)
  if (!wiring.segments.length) return { wiring: wireByRules(marked, tokens, ctx), hops, prompt, fallback: "the model found nothing" }
  return { wiring, model: hops[hops.length - 1]?.model, hops, prompt }
}

const FILLER = new Set(
  "i was am then from until til till by around about at ish for sure definitely maybe potentially sometime after before started starting start actually not long though seem seems to have been just like exactly later also so and but which did doing my the a an it its that this really finally went out".split(" "),
)

/**
 * Plain-rule wiring: one entry per clause that holds a time. Two clocks are a start and an end; one
 * clock after "until / by / til" is an end, otherwise a start. The activity is the clause minus
 * tags and filler words. A known place named in the clause is its place. Rough, and only a fallback.
 */
export function wireByRules(marked: string, tokens: Token[], ctx: HelperContext): Wiring {
  const segments: WiredSegment[] = []
  const clauses = marked.split(/(?<=[.!?;\n])\s+|,?\s+(?:and )?then\s+|\s+and then\s+/i)
  let day = ""
  for (const clause of clauses) {
    const ids = [...clause.matchAll(/\[([TDU]\d+)\]/g)].map((m) => m[1]!)
    const dayId = ids.find((i) => i.startsWith("D"))
    if (dayId) day = dayId
    const clocks = ids.filter((i) => i.startsWith("T"))
    const durs = ids.filter((i) => i.startsWith("U"))
    if (!clocks.length && !durs.length) continue
    const seg = blank()
    seg.day = dayId ?? (segments.length ? "" : day)
    if (clocks.length >= 2) {
      seg.start = clocks[0]!
      seg.end = clocks[1]!
    } else if (clocks.length === 1) {
      const lead = clause.slice(0, clause.indexOf(`[${clocks[0]}]`)).toLowerCase()
      if (/(until|til|till|by|ending|done at|finished at|over at)\s+\S*$/.test(lead.slice(-24)) || /(until|til|till|by)\s+(?:about |around |exactly )?\S*$/.test(lead.slice(-24))) seg.end = clocks[0]!
      else seg.start = clocks[0]!
    }
    seg.length = durs[0] ?? ""
    const byId = new Map(tokens.map((t) => [t.id, t.raw]))
    const plain = clause.replace(/([^\[\]]*?)\[([TDU]\d+)\]/g, (_m, before: string, id: string) => before.slice(0, Math.max(0, before.length - (byId.get(id)?.length ?? 0))) + " ").replace(/\d{1,2}(:\d{2})?\s*(am|pm)?|[-–—]/gi, " ")
    const place = ctx.locationPens.find((p) => plain.toLowerCase().includes(p.name.toLowerCase()))
    seg.place = place?.name ?? ""
    const body = plain.split(/\s+/).map((w) => w.replace(/[^\p{L}\p{N}']/gu, "")).filter((w) => w && !FILLER.has(w.toLowerCase()) && !(place && place.name.toLowerCase().includes(w.toLowerCase())))
    seg.activity = body.slice(0, 4).join(" ").toLowerCase()
    if (seg.activity) segments.push(seg)
  }
  return { segments }
}
