/**
 * lib/bim-flow/context-link.ts — Is the line before this one needed to read it?
 *
 * The person asked for this in their own words (BIM, Oct 30 22:13): earlier
 * messages are sometimes needed ("That made me cry again") and sometimes noise
 * ("Elijah bday dinner tm" sent 0 min after "Still cooking egg bites"). Every
 * node used to see the two lines before a message. A `context` node now asks
 * this file first, and only the lines it keeps are shown.
 *
 * Code commits only where the person's own feed showed it is safe:
 * - linked: the two lines share a rare word ("confit", "egg bites", "crying"),
 *   or the line repeats the one before ("O" then "Log o").
 * - unlinked: too long apart, or the line starts with one of BIM's own heads
 *   ("Brain2:", "Thought process:", "Intention:") or is a bare link.
 * Everything else is `unsure`, and the node asks the model one yes/no.
 * Opening words like "also", "this", "thus" are hints only: in the feed,
 * "Thus spent 80$ on weed" and "This join canoed bad" pointed past the line
 * right before them. Scored on hand labels in `real-feed.ts`.
 */

import { normalizeWord } from "./entity-link"
import { contentWords } from "./vault-search"

export type LinkCall = "linked" | "unlinked" | "unsure"

export interface PriorLink {
  text: string
  at: string
  call: LinkCall
  /** Why code called it, in a few words. */
  why: string
  /** Rare words both lines use. */
  shared: string[]
}

export interface ContextOptions {
  /** Further apart than this and the earlier line is not context. */
  maxGapMin?: number
  /** With no shared word, further apart than this is not context. Default 20. */
  quietGapMin?: number
  /** Words in at least this share of the person's feed are too common to link two lines. */
  commonShare?: number
}

/** BIM's own line heads (`lib/ingest/parse-message.ts` and the person's habits): a new thought starts here. */
const OWN_HEAD = /^\s*(brain ?2|brain|bim|thought process|tp|intention|objective|lyric|cleaning|bathroom|kitchen|living room|merch|get|iso|intake|log|plan|idea|later|i|nfc|dh|groc|today|reminder)\s*(idea)?\s*[:\-–]/i
const LINK_ONLY = /^\s*(https?:\/\/|www\.)\S+\s*$/i
/** A photo placeholder or a bare link: nothing to read a later line by, unless it points back ("this reel"). */
const PLACEHOLDER = /^\s*(\(\d+ scans?\)|(https?:\/\/|www\.)\S+)\s*$/i
const POINTS_BACK = /\b(this|that|the|same) (reel|video|vid|link|pic|photo|scan|one|post)\b/i
/** Opening words that often lean on the line before. A hint for the model, never a commit. */
const LEANS = /^\s*(also|and|but|or|so|then|because|cause|cuz|bc|plus|still|that|this|it|which|thus|instead|again|another|having|finished|done|back|\(|\^)\b/i

/** A rough stem, so "cooking" meets "cook" and "dishes" meets "dish". */
export function stem(word: string): string {
  let w = normalizeWord(word)
  if (w.length > 5 && w.endsWith("ing")) w = w.slice(0, -3)
  else if (w.length > 4 && w.endsWith("ed")) w = w.slice(0, -2)
  if (/(sh|ch|x)e$/.test(w)) w = w.slice(0, -1)
  if (w.length > 3 && /([b-df-hj-np-tv-z])\1$/.test(w)) w = w.slice(0, -1)
  return w
}

/** URLs are left out: two reels share "instagram" and "reel" and nothing else. */
const stems = (text: string) => new Set(contentWords(text.replace(/(https?:\/\/|www\.)\S+/gi, " ")).map(stem).filter((w) => w.length >= 3))

/** Stems so common in the person's own feed that sharing one says nothing ("brain2", "elijah"). Needs 50 lines. */
export function commonStems(feed: { text: string }[], share = 0.04): Set<string> {
  if (feed.length < 50) return new Set()
  const df = new Map<string, number>()
  for (const f of feed) for (const s of stems(f.text)) df.set(s, (df.get(s) ?? 0) + 1)
  return new Set([...df].filter(([, n]) => n / feed.length >= share).map(([s]) => s))
}

/** The line with BIM's head and filler taken off, for spotting a repeat. */
const bare = (t: string) => t.toLowerCase().replace(/^\s*(log|intake)\s*:?\s*/, "").replace(/[^\p{L}\p{N}]+/gu, "")

/** One call per earlier line, newest first. */
export function linkPrior(
  message: { text: string; at: string },
  prior: { text: string; at: string }[],
  common: Set<string> = new Set(),
  opts: ContextOptions = {},
): PriorLink[] {
  const maxGap = opts.maxGapMin ?? 90
  const own = stems(message.text)
  const ownHead = OWN_HEAD.test(message.text) || LINK_ONLY.test(message.text)
  const t = new Date(message.at).getTime()
  return [...prior].reverse().map((p) => {
    const gap = (t - new Date(p.at).getTime()) / 60_000
    const base = { text: p.text, at: p.at }
    if (bare(p.text) && bare(p.text) === bare(message.text)) return { ...base, call: "linked", why: "same line again", shared: [] }
    if (gap > maxGap) return { ...base, call: "unlinked", why: `${Math.round(gap)} min before`, shared: [] }
    if (ownHead) return { ...base, call: "unlinked", why: LINK_ONLY.test(message.text) ? "a bare link" : "starts its own BIM head", shared: [] }
    const shared = [...stems(p.text)].filter((s) => own.has(s) && !common.has(s))
    if (shared.length) return { ...base, call: "linked", why: `both say ${shared.slice(0, 3).join(", ")}`, shared }
    // In the person's feed every line that leaned on the one before without a shared word came within 4 min.
    if (gap > (opts.quietGapMin ?? 20)) return { ...base, call: "unlinked", why: `no shared words, ${Math.round(gap)} min apart`, shared: [] }
    if (PLACEHOLDER.test(p.text) && !POINTS_BACK.test(message.text)) return { ...base, call: "unlinked", why: "the earlier line is a scan or a bare link", shared: [] }
    const lean = LEANS.exec(message.text)?.[1]
    return { ...base, call: "unsure", why: lean ? `opens with "${lean.toLowerCase()}"` : "no shared words", shared: [] }
  })
}

export const CONTEXT_QUESTION =
  "Is the MESSAGE about the same thing as the EARLIER line, so the earlier line is needed to read it right? " +
  "Yes when it goes on with it, answers it, or points back to it ('that made me cry', 'still cooking', 'like 40 more min'). " +
  "No when it starts something new, even if it was sent a minute later."

/** The prompt for one unsure pair. */
export function contextPrompt(message: { text: string; at: string }, earlier: { text: string; at: string }): string {
  const hm = (iso: string) => new Date(iso).toTimeString().slice(0, 5)
  return `Question: ${CONTEXT_QUESTION}\n\nEARLIER (${hm(earlier.at)}): ${earlier.text}\nMESSAGE (${hm(message.at)}): ${message.text}`
}
