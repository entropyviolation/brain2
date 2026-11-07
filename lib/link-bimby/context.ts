/**
 * lib/link-bimby/context.ts — What the model is shown (pure)
 *
 * The link's own words (note, path, peeked caption) are the query. Candidates are
 * lists and open items, ranked by shared words and, when given, embedding scores.
 * Past links that share words come along with where each one went, so the model
 * can see how this person files links. Nothing here calls a model or a store.
 */

import type { List, Task } from "@/lib/types"
import type { Candidate, LinkPeek, PastLink } from "./types"

const STOP = new Set(
  (
    "the and for with that this from your you are was were have has had not but all any can our out who what when where why how " +
    "its it's into just like more most some such than then them they their there these those very will would about after also " +
    "been being both each few get got here him his her hers let may might must one only own same she should too two use used using " +
    "via www com http https html reel reels instagram tiktok youtube watch video post status share igsh utm source"
  ).split(" "),
)

/** Lower-case words of three or more letters, hashtags split off, stop words out. */
export function words(text: string): string[] {
  return (text.toLowerCase().match(/[a-z0-9][a-z0-9'-]{2,}/g) ?? [])
    .map((w) => w.replace(/'s$/, "").replace(/^-+|-+$/g, ""))
    .filter((w) => w.length >= 3 && !STOP.has(w) && !/^\d+$/.test(w))
}

/** Words in the link's path that read as words (`/how-to-tile-a-backsplash`). Ids are dropped. */
export function pathWords(url: string): string {
  try {
    const u = new URL(url)
    return u.pathname
      .split(/[/_.-]+/)
      .filter((p) => /^[a-z]{3,}$/i.test(p))
      .join(" ")
  } catch {
    return ""
  }
}

/** Everything the link says about itself, as one text. */
export function linkText(task: Task, peek: LinkPeek | null): string {
  return [
    task.notes ?? "",
    pathWords(task.savedLink?.url ?? ""),
    peek?.title ?? "",
    peek?.description ?? "",
    peek?.author ?? "",
    peek?.keywords ?? "",
    peek?.onScreen ?? "",
    (peek?.transcript ?? "").slice(0, 1500),
  ]
    .map((s) => s.trim())
    .filter(Boolean)
    .join("\n")
}

const nameOf = (t: Task) => (t.title || t.description || "").trim()

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

/**
 * Every list (skipping archived ones) and every open, non-inbox, non-log item, scored
 * against the link text. Unscored candidates are kept for the embedding pass.
 */
export function buildPool(link: Task, tasks: readonly Task[], lists: readonly List[], query: string): Pool {
  const q = new Set(words(query))
  const listName = new Map(lists.map((l) => [l.id, l.name]))
  const byList = new Map<string, string[]>()
  const items: Candidate[] = []
  for (const t of tasks) {
    if (t.id === link.id || t.savedLink || t.loggedAction || t.stage === "inbox") continue
    const name = nameOf(t)
    if (!name) continue
    for (const id of t.lists ?? []) {
      const names = byList.get(id) ?? []
      if (names.length < 8) names.push(name)
      byList.set(id, names)
    }
    if (t.completed) continue
    const inLists = (t.lists ?? []).map((id) => listName.get(id)).filter(Boolean).join(", ")
    const tags = (t.tags ?? []).join(" ")
    items.push({
      ref: "",
      kind: "item",
      id: t.id,
      name: name.slice(0, 120),
      context: inLists,
      score: overlap(q, `${name} ${tags}`) + 0.4 * overlap(q, inLists),
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

/** Fold embedding scores in (cosine, 0–1) and keep the best of each kind, with refs. */
export function shortlist(pool: Pool, embed: { lists: number[] | null; items: number[] | null } = { lists: null, items: null }, keep = { lists: 14, items: 22 }): Candidate[] {
  const mix = (cands: Candidate[], emb: number[] | null) =>
    cands.map((c, i) => ({ ...c, score: c.score + (emb ? Math.max(0, (emb[i] ?? 0) - 0.35) * 2 : 0) }))
  const top = (cands: Candidate[], n: number) => [...cands].sort((a, b) => b.score - a.score).slice(0, n)
  const lists = top(mix(pool.lists, embed.lists), keep.lists).map((c, i) => ({ ...c, ref: `L${i + 1}` }))
  const items = top(mix(pool.items, embed.items), keep.items).map((c, i) => ({ ...c, ref: `I${i + 1}` }))
  return [...lists, ...items]
}

/** Past links with a note, closest first, with where each went. */
export function pastLinks(link: Task, tasks: readonly Task[], lists: readonly List[], query: string, limit = 8): PastLink[] {
  const q = new Set(words(query))
  const listName = new Map(lists.map((l) => [l.id, l.name]))
  const taskName = new Map(tasks.map((t) => [t.id, nameOf(t)]))
  return tasks
    .filter((t) => t.id !== link.id && t.savedLink && (t.notes?.trim() || (t.lists?.length ?? 0) > 0))
    .map((t) => {
      const note = (t.notes ?? "").trim().slice(0, 160)
      const wentTo = t.stage === "inbox" ? "" : (t.lists ?? []).map((id) => listName.get(id)).filter(Boolean).join(", ")
      const tiedTo = (t.links ?? [])
        .filter((l) => l.relation === "resource-for")
        .map((l) => taskName.get(l.targetId))
        .filter(Boolean)
        .join(", ")
      const at = new Date(t.createdAt as unknown as string).getTime() || 0
      return { past: { url: t.savedLink!.url, note, wentTo, tiedTo }, score: overlap(q, `${note} ${wentTo} ${tiedTo}`) + (wentTo || tiedTo ? 0.05 : 0), at }
    })
    .sort((a, b) => b.score - a.score || b.at - a.at)
    .slice(0, limit)
    .map((x) => x.past)
}
