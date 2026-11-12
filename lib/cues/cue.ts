/**
 * lib/cues/cue.ts — "Remind me if …": a fact and the moment it should come back (pure, no model)
 *
 * A cue is not a timed reminder. "got 15$ off restaurant food on instacart remind me if im thinking about
 * ordering food or if i need to order food" keeps the fact and two conditions. A later line is checked
 * against the conditions in code: `yes` (every word of a condition is in the line, by itself or a word that
 * means it), `maybe` (part of one is, or the line reads as already done), or `no`. Only `yes` fires without
 * a model; the caller may put a `maybe` to a model as one yes/no question.
 */

import { stem } from "@/lib/finance-bimby/read"

export interface Cue {
  id: string
  /** When it was told, ISO. */
  at: string
  /** What to say back, as the person said it. */
  fact: string
  /** The condition, as the person said it. */
  when: string
  /** One word list per condition; a line must satisfy every word of one of them. */
  clauses: string[][]
  /** Last time it was shown, ms. */
  firedAt?: number
  fires: number
  /** Set when the person says it is used up or no longer wanted. */
  doneAt?: string
  /** The Financial BIMBY perk this cue belongs to, when the fact is a discount. */
  perkId?: string
}

/** Words that carry the wish or the need, not the thing: "thinking about ordering food" is about ordering food. */
const FRAME = new Set(
  (
    "a an the and or of to for in on at by with from is are was were be been do does did will would can could should i im ive id me my " +
    "mine it its this that these those some any am think thinking thought need needing needs want wanting wants wanna going gonna about " +
    "plan planning consider considering tempted might may maybe ever again next time just really if when whenever so then there " +
    "have has had get got getting try trying start starting decide deciding look looking feel feeling like up out"
  ).split(" "),
)

/** Phrases written as one word before matching, so "uber eats" and "ubereats" are the same token. */
const JOIN: [RegExp, string][] = [
  [/\buber\s+eats\b/g, "ubereats"],
  [/\bdoor\s+dash\b/g, "doordash"],
  [/\btake\s?[- ]out\b/g, "takeout"],
  [/\bcarry\s?[- ]out\b/g, "takeout"],
  [/\bgrub\s+hub\b/g, "grubhub"],
  [/\bgoing\s+out\s+to\s+eat\b/g, "restaurant"],
  [/\beat(?:ing)?\s+out\b/g, "restaurant"],
]

/**
 * Words that mean the same thing for a condition. A condition word is satisfied by any word of a group it is
 * in. Small on purpose: a wrong reminder is worse than a missed one, and a miss can still go to the model.
 */
const CONCEPTS: string[][] = [
  ["order", "doordash", "ubereats", "grubhub", "postmates", "delivery", "deliver", "takeout"],
  ["food", "dinner", "lunch", "breakfast", "brunch", "meal", "eat", "pizza", "sushi", "burger", "taco", "restaurant", "takeout", "doordash", "ubereats", "grubhub", "postmates", "hungry", "starving"],
  ["buy", "purchase", "shop", "order", "get"],
  ["grocery", "instacart", "supermarket"],
  ["flight", "fly", "plane", "airline"],
  ["hair", "hairdye", "dye", "bleach"],
  ["clothes", "clothing", "outfit", "shirt", "pants", "dress", "jacket", "shoe"],
  ["sleep", "bed", "nap"],
  ["home", "house", "apartment"],
]

function normal(text: string): string {
  let t = text.toLowerCase().replace(/['’]/g, "")
  for (const [re, to] of JOIN) t = t.replace(re, to)
  return t
}

const words = (text: string) => normal(text).split(/[^a-z0-9]+/).filter(Boolean)

/** The words a condition is about: "im thinking about ordering food" → order, food. */
export function cueTokens(clause: string): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  for (const raw of words(clause)) {
    if (FRAME.has(raw)) continue
    const w = stem(raw)
    if (FRAME.has(w) || seen.has(w)) continue
    seen.add(w)
    out.push(w)
  }
  return out
}

const REMIND = "(?:remind\\s+me|let\\s+me\\s+know|tell\\s+me|bring\\s+(?:it|this|that)\\s+up|mention\\s+(?:it|this|that)|say\\s+something)"
const IF = "(?:if|when|whenever|(?:the\\s+)?next\\s+time|any\\s?time|as\\s+soon\\s+as)"
/** "<fact>(,) remind me (about it) if <condition>" */
const AFTER = new RegExp(`^([\\s\\S]{3,400}?)[\\s,.;:!–—-]*\\b(?:and\\s+|so\\s+|please\\s+)*${REMIND}(?:\\s+(?:about|of)\\s+(?:it|this|that))?\\s+${IF}\\s+([\\s\\S]{3,300})$`, "i")
/** "if <condition>(,) remind me (that) <fact>" */
const BEFORE = new RegExp(`^${IF}\\s+([\\s\\S]{3,300}?)[\\s,;:–—-]+(?:then\\s+|please\\s+)*${REMIND}\\s+(?:that\\s+|about\\s+|of\\s+)?([\\s\\S]{3,400})$`, "i")
/** "remind me if <condition> that <fact>" */
const MIDDLE = new RegExp(`^(?:please\\s+)?${REMIND}\\s+${IF}\\s+([\\s\\S]{3,300}?)\\s+that\\s+([\\s\\S]{3,400})$`, "i")

const tidy = (s: string) => s.replace(/\s+/g, " ").replace(/^[\s,.;:–—-]+|[\s,.;:!–—-]+$/g, "").trim()

/** The conditions of a "remind me if A or if B" tail, one word list each, without repeats or empty ones. */
export function cueClauses(when: string): string[][] {
  const parts = normal(when).split(/\s*(?:,|;|\bor\b)\s*(?:(?:if|when|whenever)\b\s*)?/)
  const out: string[][] = []
  for (const part of parts) {
    const tokens = cueTokens(part)
    if (!tokens.length) continue
    const key = [...tokens].sort().join(" ")
    if (!out.some((c) => [...c].sort().join(" ") === key)) out.push(tokens)
  }
  return out
}

/** A line that tells a fact and asks for it back in a named situation. Null when the line is not that. */
export function parseCue(raw: string): Pick<Cue, "fact" | "when" | "clauses"> | null {
  const text = raw.replace(/\s+/g, " ").trim()
  if (!text || /\n/.test(raw.trim())) return null
  let fact = ""
  let when = ""
  const after = AFTER.exec(text)
  const before = after ? null : BEFORE.exec(text)
  const middle = after || before ? null : MIDDLE.exec(text)
  if (after) [fact, when] = [after[1]!, after[2]!]
  else if (before) [when, fact] = [before[1]!, before[2]!]
  else if (middle) [when, fact] = [middle[1]!, middle[2]!]
  else return null
  fact = tidy(fact.replace(/^(?:fyi|note|btw|also)[,:]?\s+/i, ""))
  when = tidy(when.replace(/\s*\((?:remind\s+me\s+)?(?:in\s+)?(?:that|this)\s+exact\s+(?:scenario|situation|case)\)\s*$/i, ""))
  const clauses = cueClauses(when)
  if (!fact || !clauses.length) return null
  return { fact, when, clauses }
}

/** The line says the thing is being weighed or is needed, not that it already happened. */
const INTENT = /\b(?:thinking|should|want|wanna|need|gonna|going\s+to|about\s+to|might|maybe|craving|hungry|starving|lets|could|what\s+should|can\s+i|tempted|considering|planning|have\s+to|gotta)\b|\?/
const DONE = /\b(?:ordered|ate|bought|finished|already|picked\s+up|got)\b/

export type CueMatch = "yes" | "maybe" | "no"

/** Does this line put the person in the cue's situation? */
export function matchCue(cue: Pick<Cue, "clauses">, line: string): CueMatch {
  const text = normal(line)
  const has = new Set(text.split(/[^a-z0-9]+/).filter(Boolean).map(stem))
  const satisfied = (token: string) => has.has(token) || CONCEPTS.some((group) => group.includes(token) && group.some((w) => has.has(w)))
  let best: CueMatch = "no"
  for (const clause of cue.clauses) {
    const hit = clause.filter(satisfied).length
    if (hit === clause.length) {
      // Already done is not "thinking about it": leave that to a model, or stay quiet.
      if (DONE.test(text) && !INTENT.test(text)) best = "maybe"
      else return "yes"
    } else if (hit > 0 && clause.length > 1 && best === "no") best = "maybe"
  }
  return best
}

/** How long a shown cue stays quiet, so a run of lines about dinner says it once. */
export const CUE_QUIET_MS = 30 * 60 * 1000

/** The cues a line calls up, and the ones a model could be asked about. Done and just-shown cues are left out. */
export function cuesFor(cues: readonly Cue[], line: string, nowMs: number): { fire: Cue[]; unsure: Cue[] } {
  const fire: Cue[] = []
  const unsure: Cue[] = []
  for (const cue of cues) {
    if (cue.doneAt || (cue.firedAt && nowMs - cue.firedAt < CUE_QUIET_MS)) continue
    const m = matchCue(cue, line)
    if (m === "yes") fire.push(cue)
    else if (m === "maybe") unsure.push(cue)
  }
  return { fire, unsure }
}

/** The yes/no question a `maybe` is put to a model as. */
export function cueGatePrompt(cue: Pick<Cue, "when">, line: string): { system: string; user: string; schema: Record<string, unknown> } {
  return {
    system:
      "You decide whether a message matches a situation. Answer fits=true only when the message shows the person is in that exact situation right now. " +
      "If it already happened, is about someone else, or is only loosely related, answer fits=false.",
    user: `Situation: the person is ${cue.when}\nMessage: ${line}`,
    schema: { type: "object", properties: { fits: { type: "boolean" } }, required: ["fits"] },
  }
}
