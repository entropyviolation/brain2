/**
 * lib/week-log-bimby/compose.ts — The model writes the week's brief
 *
 * One call. Its input is each day's Day Log brief, that day's totals and a few
 * of the person's own lines, plus the week's amendments (which win). That fits
 * the local model's 4,096-token context; raw rows would not. Code writes every
 * number in the doc; the model writes only the brief, how the week felt, and up
 * to five questions.
 */

import type { ModelCall } from "@/lib/bim-flow/ollama"
import { duration } from "@/lib/day-log-bimby/gather"
import { strongestWords } from "./summarize"
import type { DaySummary, WeekAmendment, WeekNarrative } from "./types"
import { shortDay, weekRangeLabel } from "./week"

export const WEEK_SYSTEM = `You write one person's Week Log: an exact, warm, plain account of their week, in the first person ("I"), past tense.
Rules:
- "I" is always the person. A name inside a text or call is someone else, never me; a text from an unknown number may be spam, so leave it out unless it mattered.
- Use only the facts given. Never invent a place, person, time, feeling or reason.
- The amendments are the person's own words about the week. They win over every other fact.
- Name the days ("On Tuesday…"). Say what filled the week, what changed from day to day, who was in it, and what got done.
- Numbers only as given. A day with little or no data is a gap: say so, do not fill it.
- brief: three or four short paragraphs, separated by a blank line.
- feelings: one paragraph on how the week felt, only from moods and the person's own words; empty when nothing says.
- questions: up to five short questions about gaps or unclear days, for the person to answer.
Reply as JSON.`

const SCHEMA = {
  type: "object",
  properties: { brief: { type: "string" }, feelings: { type: "string" }, questions: { type: "array", items: { type: "string" } } },
  required: ["brief", "feelings", "questions"],
}

/** One day as the model reads it. Capped so seven fit. */
export function dayBlock(d: DaySummary, cap = 950): string {
  if (d.future) return `${shortDay(d.date)}: not yet.`
  if (!d.rows) return `${shortDay(d.date)}: nothing recorded.`
  const totals = [
    d.woke ? `woke ${d.woke}` : "",
    d.slept ? `slept ${d.slept}` : "",
    d.activities.length ? `time: ${d.activities.slice(0, 4).map(([n, m]) => `${n} ${duration(m)}`).join(", ")}` : "",
    d.places.length ? `places: ${d.places.slice(0, 5).join(", ")}` : "",
    d.people.length ? `people: ${d.people.slice(0, 5).map((p) => p.name).join(", ")}` : "",
    d.moods.length ? `mood: ${d.moods.join(", ")}` : "",
    d.done.length ? `${d.done.length} finished` : "",
    d.steps ? `${d.steps} steps` : "",
  ].filter(Boolean)
  const words = strongestWords(d, 2).map((w) => `"${w.text.slice(0, 160)}"`)
  const amends = d.amendments.map((a) => `(my amendment) "${a.slice(0, 200)}"`)
  return `${shortDay(d.date)} (${d.rows} rows): ${d.brief} | ${totals.join("; ")}${words.length ? ` | in my words: ${words.join(" ")}` : ""}${amends.length ? ` | ${amends.join(" ")}` : ""}`.slice(0, cap)
}

function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error("timed out")), ms)
    p.then((v) => (clearTimeout(t), resolve(v)), (e) => (clearTimeout(t), reject(e)))
  })
}

const str = (v: unknown): string => (typeof v === "string" ? v.trim() : "")

/** Lines that only say nothing is known. The doc says that itself. */
const NO_FEELING = /\b(?:no (?:information|indication|mention|record|data|evidence)|(?:do(?:es)? not|don't|doesn't) (?:specify|say|mention|indicate|show)|not (?:specified|mentioned|recorded|known))\b/i

/** The week's prose, or null when the call failed or said nothing. */
export async function composeWeek(start: string, days: readonly DaySummary[], amendments: readonly WeekAmendment[], call: ModelCall, opts: { timeoutMs?: number } = {}): Promise<WeekNarrative | null> {
  const user = [
    `Week of ${weekRangeLabel(start)}.`,
    amendments.length ? `Amendments (these win):\n${amendments.map((a) => `"${a.text}"`).join("\n")}` : "",
    `The week, day by day:\n${days.map((d) => dayBlock(d)).join("\n")}`,
  ]
    .filter(Boolean)
    .join("\n\n")
    .slice(0, 7800)
  try {
    const reply = (await withTimeout(call({ system: WEEK_SYSTEM, user, schema: SCHEMA, maxTokens: 900, temperature: 0 }), opts.timeoutMs ?? 180_000)) as { brief?: unknown; feelings?: unknown; questions?: unknown }
    const brief = str(reply?.brief)
    let feelings = str(reply?.feelings)
    if (NO_FEELING.test(feelings)) feelings = ""
    const questions = Array.isArray(reply?.questions) ? reply.questions.map(str).filter(Boolean).slice(0, 5) : []
    return brief || feelings || questions.length ? { brief, feelings, questions } : null
  } catch {
    return null
  }
}
