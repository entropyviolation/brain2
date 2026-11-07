/**
 * lib/link-bimby/suggest.ts — One model call: what is this link for?
 *
 * PEEK (the Mac reads the page) → POOL (lists and items, ranked by shared words and
 * embeddings) → PICK (schema-bound, `pick` ladder, answers only with shortlist refs)
 * → CLEAN (unknown refs dropped). With no model, the best word matches are offered
 * with a plain "shares words" reason, so the key never comes back empty-handed.
 */

import { escalate } from "@/lib/bim-flow/crew"
import type { ModelCall } from "@/lib/bim-flow/ollama"
import type { List, Task } from "@/lib/types"
import { buildPool, linkText, pastLinks, shortlist, words } from "./context"
import { feedbackLines } from "./feedback"
import type { Candidate, LinkGuess, LinkPeek, LinkReading, PastLink } from "./types"

export const GUESS_SCHEMA: Record<string, unknown> = {
  type: "object",
  properties: {
    gist: { type: "string" },
    guesses: {
      type: "array",
      maxItems: 3,
      items: {
        type: "object",
        properties: {
          ref: { type: "string" },
          why: { type: "string" },
          use: { type: "string" },
          sure: { type: "number" },
        },
        required: ["ref", "why", "use", "sure"],
      },
    },
  },
  required: ["gist", "guesses"],
}

export const GUESS_SYSTEM = `You help someone sort links they saved (mostly Instagram reels and TikToks) in their personal planner, Brain2.
You get the link, the note they wrote when saving it, what the page says about itself (caption, title, author), what the video says (speech transcript; for a music clip this is song lyrics, which says little) and the text shown on screen, their past links with where each went, and a numbered shortlist of their lists (L…) and open items (I…).
Guess what in Brain2 this link is most likely a resource for, and how they would use it there.
Rules:
- "gist": one plain line on what the link is about. If the page text is empty, say what the note and link suggest.
- "guesses": up to 3, best first. "ref" must be a ref from the shortlist, copied exactly. Prefer an item when one clearly fits; a list when it fits the kind of thing.
- "why": short, points at the words that connect them. Never mention refs like L3 or I7 in "why" or "use"; say the name. "use": one concrete line on how the link helps there (a recipe to cook, a technique to try, a gift idea, a place to visit…).
- "sure": 0 to 1. Use below 0.4 when it is a stretch. Return no guesses rather than inventing a ref.
- The link being on Instagram or TikTok is never a reason. Lists that track accounts, followers, follow-backs or requests are about people, not resources: do not pick them unless the note or the reel is about that account.
- When the content is thin, say so in "gist" and give low "sure" rather than a confident stretch.
- Follow their past habits: if similar links went to one list, that list is likely.
- FEEDBACK is the person grading your earlier guesses. Repeat what they marked RIGHT, never repeat a guess they marked WRONG for a similar link, and follow what they said.`

function block(c: Candidate): string {
  return `${c.ref} ${c.kind === "list" ? "list" : "item"}: ${c.name}${c.context ? ` — ${c.kind === "list" ? "has" : "in"} ${c.context}` : ""}`
}

function pastLine(p: PastLink): string {
  const where = [p.wentTo && `filed to ${p.wentTo}`, p.tiedTo && `for ${p.tiedTo}`].filter(Boolean).join("; ") || "still in Inbox"
  return `- "${p.note || "(no note)"}" → ${where}`
}

/** Instagram repeats the caption in the title (`NAME on Instagram: "caption…"`); keep only the name then. */
export function pageTitle(peek: LinkPeek): string {
  const t = peek.title.trim()
  const quoted = /^(.*?)\s+on\s+\w+:\s*["“]([\s\S]*)$/.exec(t)
  if (quoted && peek.description.includes(quoted[2]!.slice(0, 40))) return quoted[1]!.trim()
  return t.slice(0, 200)
}

export function guessPrompt(link: Task, peek: LinkPeek | null, shortlistCands: Candidate[], past: PastLink[], feedback: string[] = []): string {
  const page = peek
    ? [
        peek.site && `site: ${peek.site}`,
        peek.author && `author: ${peek.author}`,
        pageTitle(peek) && `title: ${pageTitle(peek)}`,
        peek.description && `caption: ${peek.description.slice(0, 600)}`,
        peek.onScreen && `on screen: ${peek.onScreen.slice(0, 400)}`,
        peek.transcript && `said in the video: ${peek.transcript.slice(0, 900)}`,
      ]
        .filter(Boolean)
        .join("\n")
    : "(the page could not be read)"
  return [
    `LINK: ${link.savedLink?.url ?? ""}`,
    `NOTE: ${link.notes?.trim() || "(none)"}`,
    `PAGE:\n${page || "(nothing)"}`,
    `PAST LINKS:\n${past.length ? past.map(pastLine).join("\n") : "(none yet)"}`,
    ...(feedback.length ? [`FEEDBACK ON YOUR EARLIER GUESSES:\n${feedback.join("\n")}`] : []),
    `SHORTLIST:\n${shortlistCands.map(block).join("\n")}`,
  ].join("\n\n")
}

/** The model sometimes says "L3's 'Code Projects'" despite the rule; put the name in place of the ref. */
function named(text: string, byRef: Map<string, Candidate>): string {
  return text
    .replace(/\b([LI]\d{1,3})(?:'s)?\s+(['"“‘])/g, "$2")
    .replace(/\b([LI]\d{1,3})(?:'s)?\b/g, (m, ref: string) => {
      const c = byRef.get(ref.toUpperCase())
      return c ? `“${c.name}”` : m
    })
    .trim()
}

interface RawGuess {
  ref?: unknown
  why?: unknown
  use?: unknown
  sure?: unknown
}

/** Keep guesses whose ref is on the shortlist, once each, in order. */
export function cleanGuesses(out: unknown, cands: Candidate[]): { gist: string; guesses: LinkGuess[] } {
  const o = (out ?? {}) as { gist?: unknown; guesses?: unknown }
  const byRef = new Map(cands.map((c) => [c.ref.toUpperCase(), c]))
  const seen = new Set<string>()
  const guesses: LinkGuess[] = []
  for (const g of Array.isArray(o.guesses) ? (o.guesses as RawGuess[]) : []) {
    // Small models copy the whole shortlist line ("L1 list: medical stuff"); the ref is its head.
    const ref = /^\s*([LI])\s*-?\s*(\d{1,3})\b/i.exec(String(g.ref ?? ""))?.slice(1).join("").toUpperCase() ?? ""
    const c = byRef.get(ref)
    if (!c || seen.has(c.id)) continue
    seen.add(c.id)
    const sure = Number(g.sure)
    guesses.push({
      kind: c.kind,
      id: c.id,
      name: c.name,
      why: named(String(g.why ?? ""), byRef).slice(0, 200),
      use: named(String(g.use ?? ""), byRef).slice(0, 200),
      sure: Number.isFinite(sure) ? Math.max(0, Math.min(1, sure)) : 0.5,
    })
  }
  guesses.sort((a, b) => b.sure - a.sure)
  return { gist: named(String(o.gist ?? ""), byRef).slice(0, 240), guesses }
}

/** The best word matches, for when no model answers. */
export function guessByRules(query: string, cands: Candidate[]): LinkGuess[] {
  const q = new Set(words(query))
  return cands
    .filter((c) => c.score > 0.08)
    .sort((a, b) => b.score - a.score)
    .slice(0, 3)
    .map((c) => {
      const shared = [...new Set(words(`${c.name} ${c.context}`))].filter((w) => q.has(w)).slice(0, 4)
      return {
        kind: c.kind,
        id: c.id,
        name: c.name,
        why: shared.length ? `Shares the words ${shared.join(", ")}.` : "Close in meaning.",
        use: "",
        sure: Math.min(0.6, c.score),
      }
    })
}

/** Items sent to the embedding model per guess. Lists are always all sent. */
export const EMBED_ITEMS = 400

export interface GuessInput {
  link: Task
  tasks: readonly Task[]
  lists: readonly List[]
  peek: LinkPeek | null
  call: ModelCall | null
  ladder: string[]
  /** Cosine scores of texts against a query, or null (`embedScores`). */
  embed?: (query: string, texts: string[]) => Promise<number[] | null>
  /** Readings the person reviewed (✓ / ✗ / comment), for `feedbackLines`. */
  reviewed?: readonly LinkReading[]
  now?: Date
}

export async function guessLink(input: GuessInput): Promise<LinkReading> {
  const { link, peek } = input
  const query = linkText(link, peek)
  const full = buildPool(link, input.tasks, input.lists, query)
  // Embedding a whole vault (~10k items) takes minutes on first use. Keep the best word
  // matches, then the newest (later in the store), up to EMBED_ITEMS.
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
  const past = pastLinks(link, input.tasks, input.lists, query)
  const base = {
    taskId: link.id,
    url: link.savedLink?.url ?? "",
    at: (input.now ?? new Date()).toISOString(),
    peeked: Boolean(peek && (peek.title || peek.description || peek.transcript || peek.onScreen)),
    ...(link.notes?.trim() ? { note: link.notes.trim().slice(0, 200) } : {}),
    ...(peek?.watched ? { watched: true } : {}),
    ...(peek?.watchError ? { watchError: peek.watchError } : {}),
  }
  const rules = (fallback: string): LinkReading => ({
    ...base,
    gist: peek?.title || peek?.description?.slice(0, 160) || "",
    guesses: guessByRules(query, cands),
    by: "rules",
    fallback,
  })
  if (!cands.length) return rules("nothing in Brain2 to match yet")
  if (!input.call || !input.ladder.length) return rules(input.call ? "no model installed" : "no model reachable")
  const { out, hops } = await escalate<unknown>(
    input.call,
    input.ladder,
    { system: GUESS_SYSTEM, user: guessPrompt(link, peek, cands, past, feedbackLines(input.reviewed ?? [], query, link.id)), schema: GUESS_SCHEMA, maxTokens: 500 },
    (o) => (cleanGuesses(o, cands).guesses.length ? null : "no guess on the shortlist"),
  )
  const read = cleanGuesses(out, cands)
  if (!read.guesses.length && !read.gist) return rules("the model found nothing")
  return { ...base, gist: read.gist, guesses: read.guesses, by: "model", model: hops[hops.length - 1]?.model }
}
