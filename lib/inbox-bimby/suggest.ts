/**
 * lib/inbox-bimby/suggest.ts — One model call per Inbox idea: where does it go?
 *
 * POOL (lists, filed items, other Inbox ideas, ranked by shared words and embeddings)
 * → PICK (schema-bound, `pick` ladder, answers only with shortlist refs)
 * → CLEAN (unknown refs dropped; exact title repeats added without the model).
 * With no model, the best word matches are offered with a plain "shares words" reason.
 */

import { escalate } from "@/lib/bim-flow/crew"
import type { ModelCall } from "@/lib/bim-flow/ollama"
import { words } from "@/lib/link-bimby/context"
import type { List, Task } from "@/lib/types"
import { buildPool, exactMatches, ideaText, nameOf, shortlist } from "./context"
import type { Candidate, FileGuess, HelperSuggestion, MatchGuess } from "./types"

export const HELP_SCHEMA: Record<string, unknown> = {
  type: "object",
  properties: {
    files: {
      type: "array",
      maxItems: 3,
      items: {
        type: "object",
        properties: { ref: { type: "string" }, why: { type: "string" }, sure: { type: "number" } },
        required: ["ref", "why", "sure"],
      },
    },
    matches: {
      type: "array",
      maxItems: 3,
      items: {
        type: "object",
        properties: {
          ref: { type: "string" },
          relation: { type: "string", enum: ["duplicate", "similar"] },
          why: { type: "string" },
          sure: { type: "number" },
        },
        required: ["ref", "relation", "why", "sure"],
      },
    },
    questions: { type: "array", maxItems: 2, items: { type: "string" } },
  },
  required: ["files", "matches", "questions"],
}

export const HELP_SYSTEM = `You are the Inbox Helper in a personal planner, Brain2. You look at one idea the person captured in a hurry and help them sort it.
You get the idea (title, notes, tags, lists it already has) and a numbered shortlist: their lists (L…), items already filed (I…) and other ideas still in the Inbox (S…).
Return:
- "files": up to 3 lists (refs starting with L) where this idea belongs, best first, with a short "why". Match how the kind of thing is filed: use the sample items shown inside each list.
- "matches": items (refs starting with I or S) that are the same thing ("duplicate") or closely related and worth merging ("similar"). A duplicate repeats the same task or thought in other words. Do not call something similar just because it shares one common word.
- "questions": up to 2 short questions that would make a vague idea clear enough to file (what exactly, by when, for whom). Ask none when the idea is clear. Never ask what you can see.
Rules:
- "ref" must be copied exactly from the shortlist. Never invent one. Return an empty list rather than a stretch.
- Never write refs like L3 or I7 in "why" or "questions"; say the name.
- "sure": 0 to 1. Below 0.4 when it is a stretch.
- A list the idea is already on is not a suggestion.`

function block(c: Candidate): string {
  const lead = c.kind === "list" ? "list" : c.where === "inbox" ? "inbox idea" : "item"
  return `${c.ref} ${lead}: ${c.name}${c.context ? ` — ${c.kind === "list" ? "has" : "in"} ${c.context}` : ""}`
}

export function helpPrompt(task: Task, cands: Candidate[], listNames: Map<string, string>): string {
  const on = (task.lists ?? []).map((id) => listNames.get(id)).filter(Boolean).join(", ")
  return [
    `IDEA: ${nameOf(task) || "(untitled)"}`,
    `NOTES: ${task.notes?.trim() || "(none)"}`,
    `TAGS: ${(task.tags ?? []).join(", ") || "(none)"}`,
    `ALREADY ON LISTS: ${on || "(none)"}`,
    `SHORTLIST:\n${cands.map(block).join("\n")}`,
  ].join("\n\n")
}

const refOf = (raw: unknown) => /^\s*([LIS])\s*-?\s*(\d{1,3})\b/i.exec(String(raw ?? ""))?.slice(1).join("").toUpperCase() ?? ""

/** The model sometimes writes "L3" despite the rule; put the name in its place. */
function named(text: string, byRef: Map<string, Candidate>): string {
  return text
    .replace(/\b([LIS]\d{1,3})(?:'s)?\b/g, (m, ref: string) => {
      const c = byRef.get(ref.toUpperCase())
      return c ? `“${c.name}”` : m
    })
    .trim()
}

const clamp = (n: unknown) => (Number.isFinite(Number(n)) ? Math.max(0, Math.min(1, Number(n))) : 0.5)

interface Raw {
  ref?: unknown
  why?: unknown
  sure?: unknown
  relation?: unknown
}

/** Keep refs on the shortlist, once each. A list the idea is already on is dropped. */
export function cleanHelp(out: unknown, cands: Candidate[], task: Task): { files: FileGuess[]; matches: MatchGuess[]; questions: string[] } {
  const o = (out ?? {}) as { files?: unknown; matches?: unknown; questions?: unknown }
  const byRef = new Map(cands.map((c) => [c.ref.toUpperCase(), c]))
  const have = new Set(task.lists ?? [])
  const seen = new Set<string>()
  const files: FileGuess[] = []
  for (const g of Array.isArray(o.files) ? (o.files as Raw[]) : []) {
    const c = byRef.get(refOf(g.ref))
    if (!c || c.kind !== "list" || have.has(c.id) || seen.has(c.id)) continue
    seen.add(c.id)
    files.push({ listId: c.id, name: c.name, why: named(String(g.why ?? ""), byRef).slice(0, 200), sure: clamp(g.sure) })
  }
  const matches: MatchGuess[] = []
  for (const g of Array.isArray(o.matches) ? (o.matches as Raw[]) : []) {
    const c = byRef.get(refOf(g.ref))
    if (!c || c.kind !== "item" || seen.has(c.id)) continue
    seen.add(c.id)
    matches.push({
      id: c.id,
      name: c.name,
      where: c.where ?? "vault",
      relation: g.relation === "duplicate" ? "duplicate" : "similar",
      why: named(String(g.why ?? ""), byRef).slice(0, 200),
      sure: clamp(g.sure),
    })
  }
  const questions = (Array.isArray(o.questions) ? o.questions : [])
    .map((q) => named(String(q ?? ""), byRef).slice(0, 160))
    .filter((q) => q.length > 3)
    .slice(0, 2)
  files.sort((a, b) => b.sure - a.sure)
  matches.sort((a, b) => b.sure - a.sure)
  return { files, matches, questions }
}

/** Merge model matches with exact title repeats; an exact repeat wins its row. */
export function withExact(matches: MatchGuess[], exact: MatchGuess[]): MatchGuess[] {
  const ids = new Set(exact.map((m) => m.id))
  return [...exact, ...matches.filter((m) => !ids.has(m.id))].slice(0, 4)
}

/** The best word matches, for when no model answers. */
export function helpByRules(task: Task, query: string, cands: Candidate[]): { files: FileGuess[]; matches: MatchGuess[]; questions: string[] } {
  const q = new Set(words(query))
  const shared = (c: Candidate) => [...new Set(words(`${c.name} ${c.context}`))].filter((w) => q.has(w)).slice(0, 4)
  const have = new Set(task.lists ?? [])
  const files = cands
    .filter((c) => c.kind === "list" && !have.has(c.id) && c.score > 0.1)
    .sort((a, b) => b.score - a.score)
    .slice(0, 3)
    .map((c) => {
      const s = shared(c)
      return { listId: c.id, name: c.name, why: s.length ? `Shares the words ${s.join(", ")}.` : "Close in meaning.", sure: Math.min(0.6, c.score) }
    })
  const matches = cands
    .filter((c) => c.kind === "item" && c.score > 0.5)
    .sort((a, b) => b.score - a.score)
    .slice(0, 2)
    .map((c) => {
      const s = shared(c)
      return {
        id: c.id,
        name: c.name,
        where: c.where ?? ("vault" as const),
        relation: "similar" as const,
        why: s.length ? `Shares the words ${s.join(", ")}.` : "Close in meaning.",
        sure: Math.min(0.6, c.score),
      }
    })
  const bare = words(ideaText(task)).length <= 1 && !task.notes?.trim()
  return { files, matches, questions: bare ? ["What do you want to do with this?"] : [] }
}

/** Items sent to the embedding model per idea. Lists are always all sent. */
export const EMBED_ITEMS = 300

export interface HelpInput {
  task: Task
  tasks: readonly Task[]
  lists: readonly List[]
  call: ModelCall | null
  ladder: string[]
  embed?: (query: string, texts: string[]) => Promise<number[] | null>
  now?: Date
}

export async function helpTask(input: HelpInput): Promise<HelperSuggestion> {
  const { task } = input
  const query = ideaText(task)
  const full = buildPool(task, input.tasks, input.lists, query)
  const items = full.items
    .map((c, i) => ({ c, i }))
    .sort((a, b) => b.c.score - a.c.score || b.i - a.i)
    .slice(0, EMBED_ITEMS)
    .map((x) => x.c)
  const pool = { lists: full.lists, items }
  let embedded: { lists: number[] | null; items: number[] | null } = { lists: null, items: null }
  if (input.embed && query.trim()) {
    const [l, i] = await Promise.all([
      input.embed(query, pool.lists.map((c) => `${c.name}. ${c.context}`)).catch(() => null),
      input.embed(query, pool.items.map((c) => `${c.name}. ${c.context}`)).catch(() => null),
    ])
    embedded = { lists: l, items: i }
  }
  const cands = shortlist(pool, embedded)
  const exact = exactMatches(task, input.tasks)
  const base = { taskId: task.id, title: nameOf(task), at: (input.now ?? new Date()).toISOString() }
  const rules = (fallback: string): HelperSuggestion => {
    const r = helpByRules(task, query, cands)
    return { ...base, ...r, matches: withExact(r.matches, exact), by: "rules", fallback }
  }
  if (!cands.length) return rules("nothing in Brain2 to match yet")
  if (!input.call || !input.ladder.length) return rules(input.call ? "no model installed" : "no model reachable")
  const listNames = new Map(input.lists.map((l) => [l.id, l.name]))
  const { out, hops } = await escalate<unknown>(
    input.call,
    input.ladder,
    { system: HELP_SYSTEM, user: helpPrompt(task, cands, listNames), schema: HELP_SCHEMA, maxTokens: 500 },
    (o) => {
      const c = cleanHelp(o, cands, task)
      return c.files.length || c.matches.length || c.questions.length ? null : "nothing on the shortlist"
    },
  )
  const read = cleanHelp(out, cands, task)
  if (!read.files.length && !read.matches.length && !read.questions.length && !exact.length) return rules("the model found nothing")
  return { ...base, ...read, matches: withExact(read.matches, exact), by: "model", model: hops[hops.length - 1]?.model }
}
