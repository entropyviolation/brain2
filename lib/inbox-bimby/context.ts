/**
 * lib/inbox-bimby/context.ts — What the model is shown (pure)
 *
 * The idea's own words (title, notes, tags) are the query. Candidates are every list,
 * every open item already filed, and every other idea still in the Inbox, ranked by
 * shared words and, when given, embedding scores. Exact title repeats are found here
 * without a model, so a plain duplicate is never missed. Nothing here calls a model.
 */

import { words } from "@/lib/link-bimby/context"
import type { List, Task } from "@/lib/types"
import type { Candidate, MatchGuess } from "./types"

export const nameOf = (t: Task) => (t.title || t.description || "").trim()

/** Lower-case letters and digits, one space between words. */
export function normalTitle(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim()
}

/** The idea's own text, as one query. */
export function ideaText(task: Task): string {
  return [nameOf(task), task.notes ?? "", (task.tags ?? []).join(" ")].map((s) => s.trim()).filter(Boolean).join("\n")
}

function overlap(query: Set<string>, text: string): number {
  const have = new Set(words(text))
  if (!have.size || !query.size) return 0
  let hits = 0
  for (const w of query) if (have.has(w)) hits += 1
  return hits / Math.sqrt(have.size * query.size)
}

export interface Pool {
  lists: Candidate[]
  items: Candidate[]
}

/** Ideas that count as something to match: named, not a saved link, not a log row, not done. */
function matchable(t: Task): boolean {
  return Boolean(nameOf(t)) && !t.savedLink && !t.loggedAction && !t.completed
}

export function buildPool(target: Task, tasks: readonly Task[], lists: readonly List[], query: string): Pool {
  const q = new Set(words(query))
  const listName = new Map(lists.map((l) => [l.id, l.name]))
  const byList = new Map<string, string[]>()
  const items: Candidate[] = []
  for (const t of tasks) {
    if (t.id === target.id || t.savedLink || t.loggedAction) continue
    const name = nameOf(t)
    if (!name) continue
    if (t.stage !== "inbox") {
      for (const id of t.lists ?? []) {
        const names = byList.get(id) ?? []
        if (names.length < 8) names.push(name)
        byList.set(id, names)
      }
    }
    if (!matchable(t)) continue
    const inLists = (t.lists ?? []).map((id) => listName.get(id)).filter(Boolean).join(", ")
    items.push({
      ref: "",
      kind: "item",
      id: t.id,
      name: name.slice(0, 120),
      where: t.stage === "inbox" ? "inbox" : "vault",
      context: inLists,
      score: overlap(q, `${name} ${(t.tags ?? []).join(" ")}`) + 0.4 * overlap(q, inLists),
    })
  }
  const listCands: Candidate[] = lists
    .filter((l) => !(l as { archived?: boolean }).archived && l.name.trim())
    .map((l) => {
      const sample = (byList.get(l.id) ?? []).join("; ")
      return {
        ref: "",
        kind: "list" as const,
        id: l.id,
        name: l.name.trim(),
        context: sample.slice(0, 200),
        score: overlap(q, `${l.name} ${l.description ?? ""}`) * 1.2 + 0.5 * overlap(q, sample),
      }
    })
  return { lists: listCands, items }
}

/** Fold embedding scores in (cosine, 0–1) and keep the best of each kind, with refs `L…`, `I…`, `S…`. */
export function shortlist(
  pool: Pool,
  embed: { lists: number[] | null; items: number[] | null } = { lists: null, items: null },
  keep = { lists: 12, items: 12, inbox: 8 },
): Candidate[] {
  const mix = (cands: Candidate[], emb: number[] | null) =>
    cands.map((c, i) => ({ ...c, score: c.score + (emb ? Math.max(0, (emb[i] ?? 0) - 0.35) * 2 : 0) }))
  const top = (cands: Candidate[], n: number) => [...cands].sort((a, b) => b.score - a.score).slice(0, n)
  const lists = top(mix(pool.lists, embed.lists), keep.lists).map((c, i) => ({ ...c, ref: `L${i + 1}` }))
  const scored = mix(pool.items, embed.items)
  const vault = top(scored.filter((c) => c.where !== "inbox"), keep.items).map((c, i) => ({ ...c, ref: `I${i + 1}` }))
  const inbox = top(scored.filter((c) => c.where === "inbox"), keep.inbox).map((c, i) => ({ ...c, ref: `S${i + 1}` }))
  return [...lists, ...vault, ...inbox]
}

/** Other ideas whose title is the same words (case and punctuation aside). Needs no model. */
export function exactMatches(target: Task, tasks: readonly Task[]): MatchGuess[] {
  const mine = normalTitle(nameOf(target))
  if (mine.length < 3) return []
  return tasks
    .filter((t) => t.id !== target.id && matchable(t) && normalTitle(nameOf(t)) === mine)
    .slice(0, 3)
    .map((t) => ({
      id: t.id,
      name: nameOf(t).slice(0, 120),
      where: t.stage === "inbox" ? ("inbox" as const) : ("vault" as const),
      relation: "duplicate" as const,
      why: "Same title.",
      sure: 0.97,
    }))
}
