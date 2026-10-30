/**
 * lib/bim-flow/run-flow.ts — Walk one flow over a batch of messages
 *
 * Per message: start at the `message` node, follow every edge breadth-first.
 * A `gate` follows only `yes` or `no`. A node runs once per message even when
 * two paths reach it. After the batch, every `blocks` signal goes through
 * `assembleBlocks`, so spans are decided by code. Nothing here writes the vault.
 */

import { assembleBlocks, fitToUnknown, type BlockRules } from "./blocks"
import { buildDayContext, confirmedSpans, dayContextText } from "./day-context"
import type { ModelCall } from "./ollama"
import { retrieve, type Ranker } from "./retrieve"
import { linkText } from "./entity-link"
import { premiseCheck, runCompute } from "./compute"
import { contentWords, searchVault, type VaultSnapshot } from "./vault-search"
import type {
  ActivitySignal,
  Answer,
  AnswerMode,
  Evidence,
  EvidenceRow,
  Insight,
  InsightKind,
  ExtractField,
  Flow,
  FlowMessage,
  FlowNode,
  FlowPort,
  FlowRun,
  MessageRun,
  ModelPlan,
  Proposal,
  SearchHit,
  SearchOutput,
  TraceStep,
} from "./types"

const GATE_SYSTEM =
  "Answer one yes/no question about one short message a person sent to their notes app. " +
  "The earlier messages are context only. Be strict: when unsure, answer no. JSON only."
const CHOOSE_SYSTEM =
  "Pick from the given options only. Pick none when nothing clearly fits. The earlier messages are context only. JSON only."
const EXTRACT_SYSTEM =
  "Pull the asked fields out of one short message a person sent to their notes app. " +
  "Use only what the message says. Leave a field empty, 0, or false when it is not there. JSON only."

/** The model a step asks for, or undefined to use the run's main model. */
export function modelFor(node: FlowNode, models?: ModelPlan): string | undefined {
  if (node.config.model) return node.config.model
  if (node.kind === "gate" || node.kind === "route" || node.kind === "choose") return models?.gates || undefined
  if (node.kind === "answer") return models?.prose || undefined
  return undefined
}

function clockOf(iso: string): string {
  const d = new Date(iso)
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`
}

/** The message with its time and the few before it, the way every node shows it. */
export function messageBlock(m: FlowMessage): string {
  const prior = m.prior.map((p) => `(earlier ${clockOf(p.at)}) ${p.text}`).join("\n")
  const related = m.context ? `RELATED, from the person's own notes (context only):\n${m.context}\n\n` : ""
  return `${related}${prior ? `${prior}\n\n` : ""}MESSAGE sent ${new Date(m.at).toDateString()} ${clockOf(m.at)}: ${m.text}`
}

function fieldSchema(f: ExtractField): Record<string, unknown> {
  const desc = f.hint ? { description: f.hint } : {}
  if (f.type === "number") return { type: "number", ...desc }
  if (f.type === "boolean") return { type: "boolean", ...desc }
  if (f.type === "enum") return { type: "string", enum: [...(f.options ?? []), ""], ...desc }
  if (f.type === "clock") return { type: "string", maxLength: 8, description: `${f.hint ?? ""} H:MM as written, or empty`.trim() }
  return { type: "string", maxLength: 120, ...desc }
}

export function extractSchema(fields: ExtractField[]): Record<string, unknown> {
  return {
    type: "object",
    properties: Object.fromEntries(fields.map((f) => [f.name, fieldSchema(f)])),
    required: fields.map((f) => f.name),
  }
}

function fieldLines(fields: ExtractField[]): string {
  return fields
    .map((f) => `- ${f.name}${f.type === "enum" ? ` (one of: ${(f.options ?? []).join(", ")})` : ""}${f.hint ? `: ${f.hint}` : ""}`)
    .join("\n")
}

interface Ctx {
  message: FlowMessage
  outputs: Map<string, unknown>
  /** Outputs of this node's own path back to the message, newest first. */
  path: unknown[]
  proposals: Proposal[]
  signals: ActivitySignal[]
  answers: Answer[]
  rank?: Ranker
  /** Insights already in the log, so a run does not say them again. */
  known: string[]
  /** For a `handoff`: look up another flow by id. */
  getFlow?: (id: string) => Flow | undefined
  depth: number
  /** Ids of nodes that feed a `blocks` node: they are shown what tracking already knows. */
  feedsBlocks: Set<string>
  models?: ModelPlan
}

const ROUTE_SYSTEM =
  "You are the front door of a notes app. Read one short message and choose where it goes. " +
  "Pick the single best output, or none when nothing clearly fits. Do not pick two to be safe. JSON only."

export const RELATED_SYSTEM =
  "A person asks about something in their own notes. List single lowercase words they may have used when they wrote about it: " +
  "other forms of the word, synonyms, slang, and the things that always go with it. Do not repeat the question's own words. No phrases. JSON only."

export const ANSWER_SYSTEM =
  "You answer one question about the person who wrote these notes. Use only the EVIDENCE and the FACTS COUNTED BY CODE below; nothing else is known about them. " +
  "1) If the evidence does not contain the answer, say what is missing and set confidence none. Never guess. No row is not proof it did not happen: say 'the notes do not record it'. " +
  "2) For a 'last time' question the answer is the most recent matching row, not an earlier one. Say the date and how many days ago it was (\"2 days ago\", \"yesterday\"), never the word TODAY. " +
  "3) For how many, how often, or how long, use the counts given. Never count rows yourself. " +
  "4) For 'most' or 'usually', use the repeated-words tally and the rows, and say it is how often it was written, not a certainty. " +
  "5) A row counts only if it is about the person doing the thing asked. A plan, a wish, or a note about someone else does not count. " +
  "6) Answer in a full sentence that names the thing and gives the date as the evidence writes it (not a bare date). One to three plain sentences, speaking to the person as 'you'. No lists, no preamble. JSON only."

export const SUMMARIZE_SYSTEM =
  "You summarize what the person's own notes say about one topic, using only the EVIDENCE and FACTS COUNTED BY CODE below. " +
  "Say the span of dates first. Then group by theme or by time: what was done, what was decided, what is still open. " +
  "Never add detail the rows do not say. If the rows are thin, say so in one line. Three to six short lines separated by newlines. JSON only."

export const INSIGHT_SYSTEM =
  "You look at a person's own recorded data and say what is in it, using only the numbered EVIDENCE lines and the FACTS COUNTED BY CODE. " +
  "Kinds: pattern (something that repeats across several rows: say what repeats, how many times, over what dates); " +
  "thought_pattern (a way of reasoning the wording shows across rows, such as the same excuse worded differently, all-or-nothing wording, waiting for a perfect moment: quote their own words, never diagnose); " +
  "question (one specific question about a named row or gap in the data that the person could answer in a sentence and that would change what they do; never generic like 'how do you feel'); " +
  "idea (one small concrete thing to try, tied to a pattern you cite). " +
  "Rules: 1) Every insight cites the evidence line numbers it rests on; pattern and thought_pattern need at least two lines. " +
  "2) Use the counts in the facts. Never count yourself. 3) A pattern is not one row, and not something true of every row. " +
  "4) No medical or psychological labels, and nothing about the person's worth. 5) If the data is thin, return fewer insights, or none. " +
  "6) Plain words, speaking to the person as 'you', one or two sentences each. JSON only."

export const CHECK_SYSTEM =
  "You check a DRAFT answer against the EVIDENCE. Keep every claim the evidence supports. Remove or correct any claim it does not, " +
  "including dates, counts, and names. If nothing in the evidence supports the draft, replace it with one sentence saying the notes do not show it, and set confidence none. " +
  "Keep the draft's style. JSON only."

function termsOf(ctx: Ctx): { terms: string[]; related: string[]; person?: string; days?: number } {
  const plan = latestObject(ctx, ["subject"])
  const subject = String(plan?.subject ?? "")
  const person = plan?.person ? String(plan.person) : undefined
  const related = ctx.path.find((o) => o && typeof o === "object" && Array.isArray((o as { terms?: unknown }).terms) && !("rows" in o)) as { terms: string[] } | undefined
  const base = contentWords(subject)
  const terms = base.length ? base : contentWords(ctx.message.text)
  return { terms, related: (related?.terms ?? []).filter((w) => !terms.includes(w)), person, days: Number(plan?.days) > 0 ? Number(plan?.days) : undefined }
}

function evidenceFor(ctx: Ctx, ids?: string[]): Evidence[] {
  const outs = ids?.length ? ids.map((id) => ctx.outputs.get(id)) : [...ctx.path].reverse()
  return outs.filter((o): o is Evidence => !!o && typeof o === "object" && "rows" in o && "facts" in o)
}

function overlap(a: string, b: string): number {
  const x = new Set(contentWords(a))
  const y = new Set(contentWords(b))
  if (x.size === 0 || y.size === 0) return 0
  let both = 0
  for (const w of x) if (y.has(w)) both++
  return both / Math.min(x.size, y.size)
}

async function runAnswer(node: FlowNode, ctx: Ctx, call: ModelCall): Promise<Omit<TraceStep, "nodeId" | "ms">> {
  const c = node.config
  const mode: AnswerMode = c.mode ?? "answer"
  if (mode === "insight") return runInsight(node, ctx, call)
  const draft = mode === "check" ? [...ctx.answers].reverse().find((a) => a.mode !== "check") : undefined
  const ev = evidenceFor(ctx, c.fromNodeIds)
  const rows: EvidenceRow[] = []
  const seen = new Set<string>()
  for (const e of ev) for (const r of e.rows) if (!seen.has(r.when + r.text)) (seen.add(r.when + r.text), rows.push(r))
  // A check reads the draft's own rows first (so its citations still line up), then anything else on this path. Two lanes can join at one answer, and the check sits on only one of them.
  const shownRows = draft ? [...draft.evidence, ...rows.filter((r) => !draft.evidence.some((d) => d.when === r.when && d.text === r.text))] : rows
  const facts = [...new Set([...(draft?.facts ?? []), ...ev.flatMap((e) => e.facts)])]
  const notes = ev.map((e) => e.note).filter(Boolean)
  const total = ev.reduce((a, e) => a + e.total, 0)
  const now = new Date(ctx.message.at)
  const plan = latestObject(ctx, ["subject"])
  const prompt = [
    `TODAY: ${now.toDateString()} ${clockOf(ctx.message.at)}`,
    `${mode === "summarize" ? "TOPIC OR REQUEST" : "QUESTION"}: ${ctx.message.text}`,
    ctx.message.context ? `RELATED NOTES:\n${ctx.message.context}` : "",
    plan ? `PLAN: ${Object.entries(plan).filter(([, v]) => v).map(([k, v]) => `${k}=${v}`).join("; ")}` : "",
    `FACTS COUNTED BY CODE:\n${facts.length ? facts.map((f) => `- ${f}`).join("\n") : "- none"}`,
    `EVIDENCE (${shownRows.length} shown of ${total} found):\n${shownRows.length ? shownRows.map((r, i) => `[${i + 1}] ${r.when} · ${r.source}: ${r.text}`).join("\n") : "(no rows)"}`,
    notes.length ? `NOTES: ${notes.join(" ")}` : "",
    draft ? `DRAFT ANSWER: ${draft.text}` : "",
  ].filter(Boolean).join("\n\n")
  const base = c.system || (mode === "summarize" ? SUMMARIZE_SYSTEM : mode === "check" ? CHECK_SYSTEM : ANSWER_SYSTEM)
  const system = c.extra ? `${base} ${c.extra}` : base
  const out = (await call({
    system,
    user: prompt,
    schema: {
      type: "object",
      properties: {
        answer: { type: "string", maxLength: mode === "summarize" ? 900 : 420 },
        confidence: { type: "string", enum: ["high", "medium", "low", "none"] },
        used: { type: "array", maxItems: 6, items: { type: "integer" } },
      },
      required: ["answer", "confidence", "used"],
    },
    maxTokens: mode === "summarize" ? 360 : 200,
  })) as { answer?: string; confidence?: Answer["confidence"]; used?: number[] }
  const answer: Answer = {
    nodeId: node.id,
    mode,
    text: out.answer ?? "",
    confidence: out.confidence ?? "none",
    evidence: shownRows,
    used: (out.used ?? []).filter((n) => n >= 1 && n <= shownRows.length),
    facts,
    draft: draft?.text,
  }
  if (draft) ctx.answers = ctx.answers.filter((a) => a !== draft)
  ctx.answers.push(answer)
  return { port: "out", output: answer, prompt }
}

async function runNode(node: FlowNode, ctx: Ctx, call: ModelCall, snap: VaultSnapshot): Promise<Omit<TraceStep, "nodeId" | "ms">> {
  const c = node.config
  const msg = messageBlock(ctx.message)

  if (node.kind === "message") return { port: "out", output: { text: ctx.message.text, at: ctx.message.at, entry: ctx.message.entry ?? c.entry ?? "" } }

  // Reached only when no other lane produced an answer, a suggestion, or a time signal.
  if (node.kind === "fallback") return { port: "out", output: { fired: true } }

  if (node.kind === "route") {
    const routes = c.routes ?? []
    const max = c.maxRoutes ?? 1
    const coded = routes.filter((r) => {
      try {
        return r.pattern ? new RegExp(r.pattern, "i").test(ctx.message.text) : false
      } catch {
        return false
      }
    })
    if (coded.length) {
      const picks = coded.slice(0, max).map((r) => r.key)
      return { port: `r:${picks[0]}`, ports: picks.map((k) => `r:${k}` as FlowPort), output: { routes: picks, by: "code" } }
    }
    const keys = routes.map((r) => r.key)
    const list = routes.map((r) => `- ${r.key}: ${r.label}${r.hint ? `. ${r.hint}` : ""}`).join("\n")
    const prompt = `${c.question ?? "Where does this message go?"}\nOutputs:\n${list}\n- none: nothing here fits\n\n${msg}`
    const out = (await call({
      system: c.system || ROUTE_SYSTEM,
      user: prompt,
      schema: { type: "object", properties: { routes: { type: "array", maxItems: max, uniqueItems: true, items: { type: "string", enum: [...keys, "none"] } } }, required: ["routes"] },
      maxTokens: 40,
    })) as { routes?: string[] }
    const picks = (out.routes ?? []).filter((k) => keys.includes(k)).slice(0, max)
    return { port: picks.length ? `r:${picks[0]}` : "no", ports: picks.map((k) => `r:${k}` as FlowPort), output: { routes: picks, by: "model" }, prompt }
  }

  if (node.kind === "handoff") {
    const sub = c.flowId ? ctx.getFlow?.(c.flowId) : undefined
    if (!sub) throw new Error(`No flow "${c.flowId ?? ""}" to hand off to.`)
    if (ctx.depth >= 3) throw new Error("Handoffs nest too deep.")
    const r = await runMessage(sub, ctx.message, call, snap, undefined, ctx.rank, ctx.known, ctx.getFlow, ctx.depth + 1, undefined, ctx.models)
    ctx.proposals.push(...r.proposals)
    ctx.signals.push(...r.signals)
    ctx.answers.push(...r.answers)
    const names = new Map(sub.nodes.map((n) => [n.id, n.label]))
    return {
      port: "out",
      output: { handedTo: c.flowId, steps: r.steps.map((s) => `${names.get(s.nodeId) ?? s.nodeId}${s.error ? " ERR" : s.port === "no" ? " no" : ""} ${s.ms}ms`) },
    }
  }

  if (node.kind === "gate") {
    const shots = (c.examples ?? []).slice(-12).map((e) => `- "${e.text}" → ${e.answer}`).join("\n")
    const prompt = `Question: ${c.question ?? ""}${shots ? `\nTaught answers:\n${shots}` : ""}\n\n${msg}`
    const out = (await call({
      system: GATE_SYSTEM,
      user: prompt,
      schema: { type: "object", properties: { answer: { type: "string", enum: ["yes", "no"] } }, required: ["answer"] },
      maxTokens: 20,
    })) as { answer?: string }
    return { port: out.answer === "yes" ? "yes" : "no", output: out.answer ?? "no", prompt }
  }

  if (node.kind === "search") {
    const out = searchVault(snap, ctx.message.text, {
      source: c.source ?? "items",
      limit: c.limit,
      all: c.all,
      scopeId: c.scopeId,
    })
    return { port: "out", output: out }
  }

  if (node.kind === "link") {
    const want = c.linkKind ?? "person"
    const all = linkText(snap, ctx.message.text)
    const mentions = all.filter((m) => m.status !== "nil" && (want === "any" || m.kind === want))
    const links = all.map((m) => ({ text: m.text, status: m.status, labels: m.candidates.map((x) => x.label) }))
    const hits: SearchOutput["hits"] = mentions.flatMap((m) =>
      m.candidates
        .filter((x) => want === "any" || x.kind === want)
        .map((x) => ({
          id: x.id.replace(/^(item|list|habit):/, ""),
          title: x.label,
          source: (x.sub === "person" ? "people" : x.sub === "list" ? "lists" : x.sub === "habit" ? "habits" : x.sub === "pen" ? "pens" : "items") as SearchHit["source"],
          matched: Math.max(1, Math.round(x.score * 2)),
          words: [m.text.toLowerCase()],
        })),
    )
    // Nothing linked: keep the lane working exactly as the word search did.
    if (hits.length === 0 && want === "person") return { port: "out", output: { ...searchVault(snap, ctx.message.text, { source: "people", limit: c.limit }), links, fellBack: true } }
    const seen = new Set<string>()
    const top = hits.filter((h) => !seen.has(h.title) && seen.add(h.title)).slice(0, c.limit ?? 8)
    return { port: "out", output: { terms: contentWords(ctx.message.text), hits: top, options: top.map((h) => h.title), links } satisfies SearchOutput }
  }

  if (node.kind === "compute") {
    const found = termsOf(ctx)
    const cfg = c.compute ?? { fn: "count" as const }
    return { port: "out", output: runCompute(snap, { ...cfg, days: found.days ?? cfg.days }, { terms: found.terms, now: new Date(ctx.message.at), text: ctx.message.text }) }
  }

  if (node.kind === "guard") {
    // Yes: the subject was written down somewhere. No: the notes cannot answer, so say so and stop.
    const found = termsOf(ctx)
    const words = [...found.terms, ...(found.person ? [found.person] : [])]
    const p = premiseCheck(snap, words)
    if (!p.holds) {
      ctx.answers.push({
        nodeId: node.id,
        mode: "answer",
        text: `The notes never mention ${p.unknown.join(", ")}, so there is nothing to answer from.`,
        confidence: "none",
        evidence: [],
        used: [],
        facts: [`Premise check: none of ${p.unknown.join(", ")} appears in items, lists, habits, pens, people, tracked entries, messages, logs or day notes.`],
      })
    }
    return { port: p.holds ? "yes" : "no", output: p }
  }

  if (node.kind === "clarify") {
    // Yes: a name fits two or more candidates; ask which instead of guessing. No: nothing is in doubt.
    const want = c.clarifyKind ?? "any"
    const doubts = linkText(snap, ctx.message.text).filter((m) => m.status === "ambiguous" && (want === "any" || m.kind === want))
    if (doubts.length === 0) return { port: "no", output: { clear: true } }
    const first = doubts[0]!
    const options = first.candidates.map((x) => x.label)
    const mention = first.text.charAt(0).toUpperCase() + first.text.slice(1)
    const question = `Which ${mention}: ${options.length > 2 ? `${options.slice(0, -1).join(", ")}, or ${options[options.length - 1]}` : options.join(" or ")}?`
    ctx.answers.push({ nodeId: node.id, mode: "answer", text: question, confidence: "none", evidence: [], used: [], facts: [`Ambiguous mention "${first.text}" fits ${options.length} candidates.`] })
    return { port: "yes", output: { question, options, mention: first.text } }
  }

  if (node.kind === "choose") {
    const from = ctx.outputs.get(c.fromNodeId ?? "") as SearchOutput | undefined
    const options = from?.options ?? []
    if (options.length === 0) return { port: "out", output: { picks: [], note: "no options" } }
    const evidence = (from?.hits ?? [])
      .slice(0, 12)
      .map((h) => `- ${h.title}${h.lists?.length ? ` (on: ${h.lists.join(", ")})` : ""}`)
      .join("\n")
    const prompt =
      `${c.question ?? "Which fit?"}\nOptions: ${options.join(" | ")}` +
      `${evidence && from?.hits[0]?.source === "items" ? `\nRelated items already in the vault:\n${evidence}` : ""}\n\n${msg}`
    const out = (await call({
      system: CHOOSE_SYSTEM,
      user: prompt,
      schema: {
        type: "object",
        properties: {
          picks: { type: "array", maxItems: c.max ?? 1, uniqueItems: true, items: { type: "string", enum: options } },
        },
        required: ["picks"],
      },
      maxTokens: 120,
    })) as { picks?: string[] }
    return { port: "out", output: { picks: out.picks ?? [] }, prompt }
  }

  if (node.kind === "extract") {
    const fields = c.fields ?? []
    const known = ctx.feedsBlocks.has(node.id) ? `${dayContextText(buildDayContext(snap.history, new Date(ctx.message.at)))}\n\n` : ""
    const prompt = `${c.question ?? "Fill these fields."}\nFields:\n${fieldLines(fields)}\n\n${known}${msg}`
    const out = await call({ system: c.system || EXTRACT_SYSTEM, user: prompt, schema: extractSchema(fields), maxTokens: 250 })
    return { port: "out", output: out, prompt }
  }

  if (node.kind === "related") {
    const prompt = `Add up to ${c.max ?? 8} words.\n\n${msg}`
    const out = (await call({
      system: c.system || RELATED_SYSTEM,
      user: prompt,
      schema: { type: "object", properties: { terms: { type: "array", maxItems: c.max ?? 8, items: { type: "string", maxLength: 24 } } }, required: ["terms"] },
      maxTokens: 120,
    })) as { terms?: string[] }
    return { port: "out", output: { terms: contentWords((out.terms ?? []).join(" ")) }, prompt }
  }

  if (node.kind === "retrieve") {
    const found = termsOf(ctx)
    const { related, person, days } = found
    const cfg = c.retrieve ?? { kind: "text" as const }
    // A dataset read is not filtered by the message's own words (an analysis's message is its lens); only by a plan's subject or the node's focus.
    const plan = latestObject(ctx, ["subject"])
    const terms = cfg.kind === "dataset" ? [...contentWords(String(plan?.subject ?? "")), ...contentWords(cfg.focus ?? "")] : found.terms
    const ev = await retrieve(snap, { ...cfg, days: days ?? cfg.days }, { terms, related, person, now: new Date(ctx.message.at) }, ctx.rank)
    return { port: "out", output: ev }
  }

  if (node.kind === "answer") return runAnswer(node, ctx, call)

  if (node.kind === "blocks") {
    const input = latestObject(ctx, ["relation"])
    const activity = String(input?.activity ?? latestPick(ctx) ?? "")
    const relation = String(input?.relation ?? "")
    if (!activity || !["starting", "doing_now", "finished", "did_earlier"].includes(relation)) {
      return { port: "out", output: { signal: null, note: "no activity or relation" } }
    }
    const signal: ActivitySignal = {
      messageId: ctx.message.id,
      at: ctx.message.at,
      activity,
      relation: relation as ActivitySignal["relation"],
      since: input?.since ? String(input.since) : undefined,
      minutesLeft: Number(input?.minutes_left) || undefined,
    }
    ctx.signals.push(signal)
    return { port: "out", output: signal }
  }

  // propose: gather the nearest picks and fields into one would-be write.
  const picks = latestPick(ctx, true) as string[] | undefined
  const fields = latestObject(ctx, [])
  const action = c.action ?? "idea"
  const what = picks?.length ? picks.join(", ") : ""
  const summary =
    action === "add-to-list"
      ? `Add "${ctx.message.text}" to ${what || "Inbox"}`
      : action === "habit-done"
        ? what ? `Mark ${what} done` : "No habit picked"
        : action === "person-mention"
          ? what ? `Mention of ${what}` : "Unknown person"
          : `${action}: ${fields ? Object.values(fields).filter(Boolean).join(" · ") : ctx.message.text}`
  const proposal: Proposal = { messageId: ctx.message.id, nodeId: node.id, action, summary, data: { picks, fields } }
  // A habit or person mention with nothing picked writes nothing; keep it out of the preview.
  if ((action === "habit-done" || action === "person-mention") && !what) return { port: "out", output: { skipped: summary } }
  // A feeling with no task or no pole is not a reading.
  if (action === "drive" && !(String(fields?.task ?? "").trim() && (fields?.pole === "resistance" || fields?.pole === "excitement"))) return { port: "out", output: { skipped: summary } }
  ctx.proposals.push(proposal)
  return { port: "out", output: proposal }
}

/** The nearest extract output on this path that has every key. */
function latestObject(ctx: Ctx, keys: string[]): Record<string, unknown> | undefined {
  for (const o of ctx.path) {
    if (o && typeof o === "object" && !Array.isArray(o) && !("picks" in o) && !("routes" in o) && !("handedTo" in o) && !("hits" in o) && !("text" in o) && !("messageId" in o)) {
      const rec = o as Record<string, unknown>
      if (keys.every((k) => k in rec)) return rec
    }
  }
  return undefined
}

function latestPick(ctx: Ctx, all = false): string | string[] | undefined {
  for (const o of ctx.path) {
    if (o && typeof o === "object" && "picks" in o) {
      const picks = (o as { picks: string[] }).picks
      return all ? picks : picks[0]
    }
  }
  return undefined
}

/** Insights: the model proposes, code keeps only those that cite real lines, enough of them, and say something new. */
async function runInsight(node: FlowNode, ctx: Ctx, call: ModelCall): Promise<Omit<TraceStep, "nodeId" | "ms">> {
  const c = node.config
  const kinds: InsightKind[] = c.insightKinds?.length ? c.insightKinds : ["pattern", "thought_pattern", "question", "idea"]
  const max = c.maxInsights ?? 3
  const ev = evidenceFor(ctx, c.fromNodeIds)
  const rows: EvidenceRow[] = []
  for (const e of ev) rows.push(...e.rows)
  const facts = [...new Set(ev.flatMap((e) => e.facts))]
  const notes = ev.map((e) => e.note).filter(Boolean)
  const total = ev.reduce((a, e) => a + e.total, 0)
  const earlier = ctx.answers.flatMap((a) => a.insights ?? [])
  if (c.minRows && total < c.minRows) {
    const thin: Answer = { nodeId: node.id, mode: "insight", text: `Too few rows to say anything (${total}, needs ${c.minRows}).`, confidence: "none", evidence: rows, used: [], facts, insights: [], dropped: 0 }
    ctx.answers.push(thin)
    return { port: "out", output: thin }
  }
  const prompt = [
    `TODAY: ${new Date(ctx.message.at).toDateString()}`,
    `LOOK FOR: ${c.lens ?? ctx.message.text}`,
    `ALLOWED KINDS: ${kinds.join(", ")}. At most ${max} insights.`,
    `FACTS COUNTED BY CODE:\n${facts.length ? facts.map((f) => `- ${f}`).join("\n") : "- none"}`,
    `EVIDENCE (${rows.length} shown of ${total} found):\n${rows.length ? rows.map((r, i) => `[${i + 1}] ${r.when} · ${r.source}: ${r.text}`).join("\n") : "(no rows)"}`,
    notes.length ? `NOTES: ${notes.join(" ")}` : "",
  ].filter(Boolean).join("\n\n")
  const base = c.system || INSIGHT_SYSTEM
  const out = (await call({
    system: c.extra ? `${base} ${c.extra}` : base,
    user: prompt,
    schema: {
      type: "object",
      properties: {
        insights: {
          type: "array",
          maxItems: max,
          items: {
            type: "object",
            properties: {
              kind: { type: "string", enum: kinds },
              text: { type: "string", maxLength: 280 },
              strength: { type: "string", enum: ["strong", "likely", "weak"] },
              cites: { type: "array", maxItems: 5, items: { type: "integer" } },
            },
            required: ["kind", "text", "strength", "cites"],
          },
        },
      },
      required: ["insights"],
    },
    maxTokens: 120 + max * 110,
  })) as { insights?: Insight[] }
  const kept: Insight[] = []
  let dropped = 0
  const seen = [...ctx.known, ...earlier.map((i) => i.text)]
  for (const raw of out.insights ?? []) {
    const cites = [...new Set((raw.cites ?? []).filter((n) => Number.isInteger(n) && n >= 1 && n <= rows.length))]
    const needs = raw.kind === "pattern" || raw.kind === "thought_pattern" ? 2 : 1
    const text = (raw.text ?? "").trim()
    if (!text || cites.length < needs || seen.some((k) => overlap(k, text) > 0.6)) {
      dropped++
      continue
    }
    seen.push(text)
    kept.push({ kind: raw.kind, text, strength: raw.strength, cites })
  }
  const answer: Answer = {
    nodeId: node.id,
    mode: "insight",
    text: kept.map((i) => `• ${i.kind.replace("_", " ")}: ${i.text}`).join("\n") || "Nothing the data supports strongly enough.",
    confidence: kept.some((i) => i.strength === "strong") ? "high" : kept.length ? "medium" : "none",
    evidence: rows,
    used: [...new Set(kept.flatMap((i) => i.cites))],
    facts,
    insights: kept,
    dropped,
  }
  ctx.answers.push(answer)
  return { port: "out", output: answer, prompt }
}

export async function runMessage(
  flow: Flow,
  message: FlowMessage,
  call: ModelCall,
  snap: VaultSnapshot,
  onStep?: (step: TraceStep) => void,
  rank?: Ranker,
  known: string[] = [],
  getFlow?: (id: string) => Flow | undefined,
  depth = 0,
  onStart?: (nodeId: string) => void,
  models?: ModelPlan,
): Promise<MessageRun> {
  const ctx: Ctx = { message, outputs: new Map(), path: [], proposals: [], signals: [], answers: [], rank, known, getFlow, depth, feedsBlocks: new Set(flow.edges.filter((e) => flow.nodes.some((n) => n.id === e.to && n.kind === "blocks")).map((e) => e.from)), models }
  const parent = new Map<string, string>()
  const steps: TraceStep[] = []
  const byId = new Map(flow.nodes.map((n) => [n.id, n]))
  // Several start nodes can share one flow; the message says which door it came through.
  const starts = flow.nodes.filter((n) => n.kind === "message")
  const start = starts.find((n) => message.entry && n.config.entry === message.entry) ?? starts.find((n) => !n.config.entry) ?? starts[0]
  const queue: string[] = start ? [start.id] : []
  const seen = new Set<string>()
  // A `fallback` node waits until every other lane has finished, and runs only if none of them produced anything.
  const waiting: string[] = []
  const released = new Set<string>()
  const drain = async () => {
    while (queue.length > 0) {
      const id = queue.shift()!
      if (seen.has(id)) continue
      seen.add(id)
      const node = byId.get(id)
      if (!node) continue
      if (node.kind === "fallback" && !released.has(id)) {
        waiting.push(id)
        continue
      }
      const path: unknown[] = []
      for (let p = parent.get(id); p; p = parent.get(p)) path.push(ctx.outputs.get(p))
      ctx.path = path
      const t0 = Date.now()
      let step: TraceStep
      onStart?.(id)
      const model = modelFor(node, models)
      const asked: ModelCall = model ? (req) => call({ ...req, model }) : call
      try {
        step = { nodeId: id, ms: 0, ...(await runNode(node, ctx, asked, snap)) }
        if (model && step.prompt) step.model = model
      } catch (err) {
        step = { nodeId: id, ms: 0, port: "no", output: null, error: err instanceof Error ? err.message : String(err) }
      }
      step.ms = Date.now() - t0
      ctx.outputs.set(id, step.output)
      steps.push(step)
      onStep?.(step)
      if (step.error) continue
      const ports: FlowPort[] = node.kind === "gate" || node.kind === "guard" || node.kind === "clarify" ? [step.port] : node.kind === "route" ? step.ports ?? [] : ["out"]
      for (const e of flow.edges) {
        if (e.from !== id || !ports.includes(e.port)) continue
        if (!parent.has(e.to)) parent.set(e.to, id)
        queue.push(e.to)
      }
    }
  }
  await drain()
  while (waiting.length > 0) {
    if (ctx.answers.length > 0 || ctx.proposals.length > 0 || ctx.signals.length > 0) break
    const id = waiting.shift()!
    released.add(id)
    seen.delete(id)
    queue.push(id)
    await drain()
  }
  return { message, steps, proposals: ctx.proposals, signals: ctx.signals, answers: ctx.answers }
}

export async function runFlow(
  flow: Flow,
  messages: FlowMessage[],
  call: ModelCall,
  snap: VaultSnapshot,
  opts: { model: string; models?: ModelPlan; rank?: Ranker; known?: string[]; getFlow?: (id: string) => Flow | undefined; rules?: BlockRules; onMessage?: (run: MessageRun, index: number) => void; onStep?: (index: number, step: TraceStep) => void; onStart?: (index: number, nodeId: string) => void } = { model: "" },
): Promise<FlowRun> {
  const t0 = Date.now()
  const runs: MessageRun[] = []
  for (const [i, m] of messages.entries()) {
    const run = await runMessage(flow, m, call, snap, (s) => opts.onStep?.(i, s), opts.rank, opts.known, opts.getFlow, 0, (id) => opts.onStart?.(i, id), opts.models)
    runs.push(run)
    opts.onMessage?.(run, i)
  }
  return {
    model: opts.model,
    startedAt: new Date(t0).toISOString(),
    ms: Date.now() - t0,
    messages: runs,
    blocks: fitToUnknown(assembleBlocks(runs.flatMap((r) => r.signals), opts.rules), confirmedSpans(snap.history)),
  }
}
