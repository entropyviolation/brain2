/**
 * lib/habit-helper/run.ts — One message through the Habits BIMBY's flow
 *
 * ROUTE (code) → TAG (code) → MATCH (one model call) → COMPUTE + PROPOSE (code). Routes other than `log`
 * need no model: `answer` records the reply to an open why-question word for word, `shorthand` suggests
 * names, `reasons` and `nudge` read the person's own cells, `question` gets a fixed line. Every stage is
 * timed into `trace` for the lab. Writes nothing.
 */

import type { ModelCall } from "@/lib/bim-flow/ollama"
import { dateKey } from "@/lib/tracking-helper/clock"
import { computeAll, computeItem, spanProposal } from "./compute"
import { countsMinutes, findEvidence, readSpanAnswer, spanQuestion, type BimLog, type PendingSpan } from "./evidence"
import type { HabitsBimbyFlow } from "./flow"
import { dayWords, nudges, reasonsOf } from "./history"
import { headOf, match } from "./match"
import { scoreClause } from "./lexicon"
import { suggestShorthands } from "./shorthand"
import { parseWordRule, pickHabitForRule, ruleText, looksLikeWordRule } from "./rule"
import { tagText } from "./tags"
import type { Ask, HabitRoute, BimbyContext, Proposal, Tag, TraceStage } from "./types"
import { contentStems, displayName } from "./words"

export interface PendingWhy {
  habitId: string
  day: string
}

export interface HabitsBimbyRun {
  route: HabitRoute
  reply: string
  proposals: Proposal[]
  asks: Ask[]
  notes: string[]
  tags: Tag[]
  marked: string
  trace: TraceStage[]
  model?: string
  fallback?: string
  /** The BIMBY found one end of a session in the BIM log and asked for the other. */
  pendingSpan?: PendingSpan
  /** For `reasons`: the habit asked about. */
  reasonsFor?: string
}

export const QUESTION_REPLY =
  "I read what you did and didn't do today, and propose the cells for you to approve. Try “drank water, read 10 pages, stretched”, " +
  "“I didn't go outside because it was dark”, “what's left today?”, “show my reasons for go outside”, or “give my habits shorthand names”."

function safeRe(pattern: string): RegExp | null {
  try {
    return new RegExp(pattern, "i")
  } catch {
    return null
  }
}

/**
 * Code-only route. `pending` is the why-question still open, if any. With one open, a message is its answer
 * unless it reads as a log: two clauses that name habits, or one with an amount and no negation. Then the
 * question stays open for the next message.
 */
export function routeOf(text: string, flow: HabitsBimbyFlow, pending: PendingWhy | null, ctx?: BimbyContext, span?: PendingSpan | null): HabitRoute {
  text = plainText(text)
  if (looksLikeWordRule(text)) return "rule"
  if (span && (safeRe(flow.route.skip)?.test(text) || readSpanAnswer(text, span))) return "span"
  const is = (p: string) => !!safeRe(p)?.test(text)
  if (is(flow.route.shorthand)) return "shorthand"
  if (is(flow.route.reasons)) return "reasons"
  if (is(flow.route.nudge)) return "nudge"
  if (is(flow.route.question)) return "question"
  if (pending && !(ctx && looksLikeLog(text, ctx))) return "answer"
  return "log"
}

/** Quotes and curly apostrophes off, so a pasted “what's left today?” still hits the anchored route patterns. */
function plainText(text: string): string {
  return text.replace(/[\u2018\u2019]/g, "'").replace(/^[\s"'\u201c\u201d]+|[\s"'\u201c\u201d]+$/g, "")
}

/**
 * A reply to a why-question that says the habit WAS done ("i did do that", "i did drink water yesterday").
 * Not a reason: it corrects the day. Negated or explained replies ("I did not", "I did, but ... because") stay reasons.
 */
export function claimsDone(text: string): boolean {
  const t = plainText(text)
  if (/\b(not|never|nothing|no|but|because|instead|since)\b|n't/i.test(t)) return false
  return /^(yes\b|yeah\b|yep\b|actually\b|i\s+(actually\s+|already\s+|totally\s+|really\s+)?(did|do|have|got|finished|completed)\b|(did|done|finished|completed)\b)/i.test(t)
}

export function looksLikeLog(text: string, ctx: BimbyContext): boolean {
  const t = tagText(text, ctx.now)
  const named = t.clauses.filter((c) => scoreClause(headOf(c, t.tags), ctx.habits).length)
  return named.length >= 2 || named.some((c) => !c.negated && c.tags.some((id) => id.startsWith("N")))
}

export interface RunInput {
  text: string
  flow: HabitsBimbyFlow
  ctx: BimbyContext
  call: ModelCall | null
  ladder: string[]
  pending?: PendingWhy | null
  /** The person's BIM lines with times, read for evidence. */
  logs?: BimLog[]
  /** A session with one end known, waiting for the other. */
  pendingSpan?: PendingSpan | null
}

export async function runHabitsBimby(input: RunInput): Promise<HabitsBimbyRun> {
  const { flow, ctx, text } = input
  const trace: TraceStage[] = []
  const today = dateKey(ctx.now)
  const t0 = Date.now()
  const route = routeOf(text, flow, input.pending ?? null, ctx, input.pendingSpan)
  trace.push({ stage: "route", ms: Date.now() - t0, note: route, output: route })
  const base = { route, proposals: [] as Proposal[], asks: [] as Ask[], notes: [] as string[], tags: [] as Tag[], marked: text, trace }

  if (route === "question") return { ...base, reply: QUESTION_REPLY }

  if (route === "rule") {
    const rule = parseWordRule(text)
    if (!rule) return { ...base, reply: "I read that as a words-in-a-document rule but could not find the document, the words, or the amount. Try: for every 300 words added in the document called “pages writing” in a day, count 1 page for my write 3 pages habit." }
    const pick = pickHabitForRule(rule, ctx.habits)
    const h = ctx.habits.find((x) => x.id === pick.id)
    if (!h) {
      const names = pick.tied.map((id) => ctx.habits.find((x) => x.id === id)?.name).filter(Boolean)
      return { ...base, reply: names.length ? `“${rule.habitHint}” could be ${names.join(" or ")}. Say the habit’s full name.` : `Which daily habit? I could not match “${rule.habitHint}”.` }
    }
    const p: Proposal = {
      id: `p-${h.id}-wordrule`,
      kind: "rule",
      habitId: h.id,
      habit: displayName(h),
      from: "no document feed",
      to: ruleText(rule),
      rule: { docTitle: rule.docTitle, wordsPer: rule.wordsPer, amount: rule.amount },
      words: text,
      why: "read in code: words per day in a document",
    }
    trace.push({ stage: "propose", ms: 0, note: "word rule", output: [p] })
    return { ...base, proposals: [p], reply: `Once you approve: ${ruleText(rule)}, added to ${displayName(h)} as you write. Only words added after you approve count, and deleting never takes credit back.` }
  }

  if (route === "span" && input.pendingSpan) {
    const ps = input.pendingSpan
    const h = ctx.habits.find((x) => x.id === ps.habitId)
    const a = readSpanAnswer(text, ps)
    if (!h || !a) return { ...base, reply: "Left as it is." }
    const p = spanProposal(h, ps.day, a, ps.line, text)
    trace.push({ stage: "propose", ms: 0, note: a.estimated ? "span, estimated" : "span", output: [p] })
    const mins = a.endMin - a.startMin
    return { ...base, proposals: [p], reply: `${a.estimated ? "About " : ""}${mins} min of ${displayName(h)} ${dayWords(ps.day, today)}. Approve it to credit the habit and paint ${a.estimated ? "an estimated block" : "the block"} on Activity.` }
  }

  if (route === "answer" && input.pending) {
    const h = ctx.habits.find((x) => x.id === input.pending!.habitId)
    if (!h || safeRe(flow.route.skip)?.test(text)) return { ...base, reply: "Skipped." }
    if (claimsDone(text)) {
      const t = tagText(text, ctx.now)
      const c = { ...(t.clauses[0] ?? { id: "C1", text, at: 0, tags: [], negated: false, sentence: text }), day: input.pending.day }
      const out = computeItem({ clause: c.id, habit: h.id, maybe: "", kind: "done", amount: "", day: "", reason: "" }, { ...t, clauses: [c, ...t.clauses.slice(1)] }, ctx)
      if (typeof out === "string") return { ...base, reply: out || "Left as it is." }
      trace.push({ stage: "propose", ms: 0, note: "said it was done, applied to the day asked about", output: [out] })
      return { ...base, proposals: [out], reply: `Counted: ${displayName(h)} ${dayWords(input.pending.day, today)}, once you approve it. No miss reason needed.` }
    }
    const cell = h.days[input.pending.day]
    const p: Proposal = {
      id: `p-${h.id}-${input.pending.day}-reason`,
      kind: "reason",
      habitId: h.id,
      habit: displayName(h),
      day: input.pending.day,
      from: cell?.reason ? `“${cell.reason}”` : "no reason",
      to: `“${text}”`,
      write: { missedOpportunity: true, missReason: text },
      words: text,
    }
    trace.push({ stage: "propose", ms: 0, note: "reason, word for word", output: [p] })
    return { ...base, proposals: [p], reply: `Saved word for word as the reason ${displayName(h)} was missed ${dayWords(input.pending.day, today)}, once you approve it.` }
  }

  if (route === "shorthand") {
    const t1 = Date.now()
    const proposals = suggestShorthands(ctx.habits, { redo: /\b(redo|replace|all of them again|even (the )?ones)\b/i.test(text) })
    trace.push({ stage: "propose", ms: Date.now() - t1, note: `${proposals.length} names`, output: proposals })
    return { ...base, proposals, reply: proposals.length ? `Shorthand names for ${proposals.length} habits. Edit any before you accept it.` : "Every daily habit already has a shorthand name." }
  }

  if (route === "reasons") {
    const best = scoreClause(text, ctx.habits)[0]
    const h = ctx.habits.find((x) => x.id === best?.id)
    if (!h) return { ...base, reply: "Which habit? Say its name, like “reasons for go outside”." }
    const r = reasonsOf(h)
    const reply = r.list.length
      ? `${displayName(h)}: ${r.list.length} reasons recorded.${r.themes.length ? ` Most often: ${r.themes.map((t) => `${t.theme} (${t.n})`).join(", ")}.` : ""}`
      : `No reasons recorded for ${displayName(h)} yet.`
    return { ...base, reply, reasonsFor: h.id }
  }

  if (route === "nudge") {
    const list = nudges(ctx)
    return { ...base, reply: list.length ? list.map((n) => `${n.habit}: ${n.text}`).join("\n") : "Every daily habit is done or marked for today." }
  }

  const t1 = Date.now()
  const tagged = tagText(text, ctx.now)
  trace.push({ stage: "tag", ms: Date.now() - t1, note: `${tagged.clauses.length} clauses, ${tagged.tags.length} tags`, output: { clauses: tagged.clauses, tags: tagged.tags } })

  const t2 = Date.now()
  const m = await match(input.call, input.ladder, flow, tagged, ctx).catch((err) => ({
    matching: { items: [] },
    hops: [],
    prompt: "",
    model: undefined,
    fallback: err instanceof Error ? err.message : "model failed",
  }))
  trace.push({ stage: "match", ms: Date.now() - t2, note: m.model ?? m.fallback ?? "rules", prompt: m.prompt, output: m.matching, model: m.model })

  const t3 = Date.now()
  const out = computeAll(m.matching, tagged, ctx)
  trace.push({ stage: "compute", ms: Date.now() - t3, note: `${out.proposals.length} proposals, ${out.asks.length} asks`, output: out })

  // A habit counted in minutes, said without an amount: the BIM log may know when it ended or began.
  let pendingSpan: PendingSpan | undefined
  let spanReply = ""
  if (input.logs?.length) {
    for (const p of out.proposals) {
      const h = ctx.habits.find((x) => x.id === p.habitId)
      if (!h || !p.day || p.kind !== "set" || !countsMinutes(h) || !/no amount said/.test(p.why ?? "")) continue
      const found = findEvidence(h, p.day, input.logs)
      if (!found) continue
      pendingSpan = found
      spanReply = spanQuestion(found, dayWords(p.day, today), displayName(h))
      out.proposals = out.proposals.filter((x) => x !== p)
      break
    }
  }

  // A part of a list that named no habit is said, not dropped in silence.
  const placed = new Set(m.matching.items.map((x) => x.clause))
  const unplaced = out.proposals.length || out.asks.length ? tagged.clauses.filter((c) => !placed.has(c.id) && contentStems(headOf(c, tagged.tags)).length) : []
  if (unplaced.length) out.notes.push(`No daily habit matched ${unplaced.map((c) => `“${c.text}”`).join(", ")}. Say it with the habit's name, or add it in the Habits chat.`)

  const reply = [
    spanReply,
    out.proposals.length ? `${out.proposals.length} ${out.proposals.length === 1 ? "change" : "changes"} to approve.` : "",
    ...out.asks.map((a) => `“${a.words}” could be ${a.options.map((o) => o.name).join(" or ")}. Which one?`),
    ...out.notes.filter(Boolean),
    !out.proposals.length && !out.asks.length && !out.notes.filter(Boolean).length ? "I didn't find one of your daily habits in that." : "",
    m.fallback ? `(Rules only: ${m.fallback}.)` : "",
  ]
    .filter(Boolean)
    .join("\n")
  return { ...base, proposals: out.proposals, asks: out.asks, notes: out.notes, tags: tagged.tags, marked: tagged.marked, reply, model: m.model, fallback: m.fallback, ...(pendingSpan ? { pendingSpan } : {}) }
}
