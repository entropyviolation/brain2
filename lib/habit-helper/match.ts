/**
 * lib/habit-helper/match.ts — MATCH: one schema-bound call that points clauses at habits
 *
 * Every field is an enum of ids that exist (clauses, habits, tags) plus "", so the model cannot invent a
 * habit, a number, a day or a reason. It may set `maybe` when a clause could be two habits; code also asks
 * when the clause's words score two habits the same (`compute.ts`). With no model, or when every rung of
 * the ladder answers nothing, `matchByRules` reads the same clauses with the lexicon.
 */

import { escalate } from "@/lib/bim-flow/crew"
import type { ModelCall } from "@/lib/bim-flow/ollama"
import type { HabitsBimbyFlow } from "./flow"
import { scoreClause, tiedAtTop } from "./lexicon"
import type { Tagged } from "./tags"
import type { Clause, HabitBrief, BimbyContext, MatchItem, Matching, Tag } from "./types"
import { displayName } from "./words"

export function matchSchema(t: Tagged, habits: HabitBrief[]): Record<string, unknown> {
  const of = (kind: Tag["kind"]) => ({ type: "string", enum: ["", ...t.tags.filter((x) => x.kind === kind).map((x) => x.id)] })
  const habitIds = { type: "string", enum: ["", ...habits.map((h) => h.id)] }
  return {
    type: "object",
    required: ["items"],
    properties: {
      items: {
        type: "array",
        maxItems: 16,
        items: {
          type: "object",
          required: ["clause", "habit", "maybe", "kind", "amount", "day", "reason"],
          properties: {
            clause: { type: "string", enum: t.clauses.map((c) => c.id) },
            habit: habitIds,
            maybe: habitIds,
            kind: { type: "string", enum: ["done", "missed"] },
            amount: of("amount"),
            day: of("day"),
            reason: of("because"),
          },
        },
      },
    },
  }
}

export function systemText(flow: HabitsBimbyFlow): string {
  const ex = flow.match.examples.map((e, i) => `EXAMPLE ${i + 1}\nHABITS: ${e.habits}\nTEXT: ${e.text}\nANSWER: ${e.json}`).join("\n\n")
  return [flow.match.system, flow.match.extra, ex].filter((s) => s.trim()).join("\n\n")
}

/** One line per habit: id, name, what it is measured in, and the extra words that count for it. */
export function habitLines(habits: HabitBrief[]): string {
  return habits
    .map((h) => {
      const measure = h.kind === "goal" ? `goal ${h.goal ?? "?"}${h.unit ? ` ${h.unit}` : ""}` : h.kind === "text" ? "a note" : "yes/no"
      const also = h.words.length ? `; also counts: ${h.words.slice(0, 8).join(", ")}` : ""
      return `${h.id} = ${displayName(h)}${h.shorthand ? ` (${h.name})` : ""} [${measure}${also}]`
    })
    .join("\n")
}

export function userText(t: Tagged, ctx: BimbyContext): string {
  const tags = t.tags.map((x) => `${x.id}=${x.raw}`).join(", ")
  return [`TODAY: ${ctx.now.toDateString()}`, `HABITS:\n${habitLines(ctx.habits)}`, `TAGS: ${tags || "none"}`, `TEXT: ${t.marked}`].join("\n")
}

const blank = (): MatchItem => ({ clause: "", habit: "", maybe: "", kind: "done", amount: "", day: "", reason: "" })

/** Keep items that name a clause and either a habit or a maybe. */
export function cleanMatching(out: unknown): Matching {
  const raw = (out as { items?: Partial<MatchItem>[] } | null)?.items
  return { items: (Array.isArray(raw) ? raw : []).map((x) => ({ ...blank(), ...x })).filter((x) => x.clause && (x.habit || x.maybe)) }
}

export interface MatchResult {
  matching: Matching
  model?: string
  hops: { model: string; ms: number; why?: string }[]
  prompt: string
  fallback?: string
}

export async function match(call: ModelCall | null, ladder: string[], flow: HabitsBimbyFlow, t: Tagged, ctx: BimbyContext): Promise<MatchResult> {
  const system = systemText(flow)
  const user = userText(t, ctx)
  const prompt = `${system}\n\n---\n\n${user}`
  if (!call || !ladder.length) return { matching: matchByRules(t, ctx), hops: [], prompt, fallback: call ? "no model installed" : "no model reachable" }
  const rules = matchByRules(t, ctx)
  const { out, hops } = await escalate<Matching>(call, ladder, { system, user, schema: matchSchema(t, ctx.habits), maxTokens: flow.match.maxTokens }, (o) =>
    cleanMatching(o).items.length || !rules.items.length ? null : "matched nothing the words name",
  )
  const matching = cleanMatching(out)
  if (out === null) return { matching: rules, hops, prompt, fallback: "every model failed" }
  if (!matching.items.length && rules.items.length) return { matching: rules, hops, prompt, fallback: "the model matched nothing the words name" }
  return { matching, model: hops[hops.length - 1]?.model, hops, prompt }
}

/** The clause's words before any "because": what the person did or did not do. */
export function headOf(c: Clause, tags: Tag[]): string {
  const b = tags.find((t) => t.kind === "because" && c.tags.includes(t.id))
  return b ? c.text.slice(0, Math.max(0, b.at - c.at)) : c.text
}

/**
 * Plain-rule matching. Per clause: the habit its words score highest; a tie at the top is a `maybe` (ask);
 * a negation before any "because" makes it a miss; the clause's first amount, day and reason are used.
 */
export function matchByRules(t: Tagged, ctx: BimbyContext): Matching {
  const items: MatchItem[] = []
  const byId = new Map(t.tags.map((x) => [x.id, x]))
  for (const c of t.clauses) {
    const scored = scoreClause(headOf(c, t.tags), ctx.habits)
    if (!scored.length) continue
    const tie = tiedAtTop(scored)
    const first = (kind: Tag["kind"]) => c.tags.find((id) => byId.get(id)?.kind === kind) ?? ""
    items.push({
      clause: c.id,
      habit: tie.length ? tie[0]! : scored[0]!.id,
      maybe: tie.length ? tie[1]! : "",
      kind: c.negated ? "missed" : "done",
      amount: first("amount"),
      day: first("day"),
      reason: first("because"),
    })
  }
  return { items }
}
