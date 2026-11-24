/**
 * lib/thought-patterns/patterns.ts — Thought patterns, read from the words of one message (pure)
 *
 * A thought pattern is a shape that recurs in how you think and say things: "so many things",
 * three ASAPs in a row, "I definitely should", "allowing myself to …", "one of my last ones".
 * One message gives hits; the ledger (`store.ts`) keeps them over time, and the counts per
 * pattern are what later screens and BIMBIES read. Rules only, so a hit always quotes the words
 * it came from. A pattern is an observation, never a diagnosis.
 */

export type PatternId =
  | "overwhelm"
  | "urgency-stack"
  | "should"
  | "permission"
  | "substance-credit"
  | "scarcity"
  | "deferral"
  | "money-gate"
  | "self-kindness"
  | "recurring-intention"

export interface PatternDef {
  id: PatternId
  /** Short name on the card and in the summary. */
  name: string
  /** What the pattern means, in one plain sentence. */
  means: string
}

export const PATTERNS: Record<PatternId, PatternDef> = {
  overwhelm: { id: "overwhelm", name: "Overwhelm", means: "Too many open things at once, said as a weight." },
  "urgency-stack": { id: "urgency-stack", name: "Urgency stack", means: "Several things marked urgent in one breath (ASAP, !!!, right now)." },
  should: { id: "should", name: "Should", means: "A should about who you are or where you ought to be, not a step." },
  permission: { id: "permission", name: "Permission", means: "Allowing or justifying what you are doing instead of just doing it." },
  "substance-credit": { id: "substance-credit", name: "Substance credit", means: "Crediting a substance for your focus or state." },
  scarcity: { id: "scarcity", name: "Scarcity", means: "Running low on something you rely on." },
  deferral: { id: "deferral", name: "Deferral", means: "A thing left vague to sort out later (figure out, whatever, at some point)." },
  "money-gate": { id: "money-gate", name: "Money gate", means: "A step that waits on money first." },
  "self-kindness": { id: "self-kindness", name: "Self-kindness", means: "A soft word to yourself or to BIM." },
  "recurring-intention": { id: "recurring-intention", name: "Recurring intention", means: "A plan said again on other days and not yet done." },
}

export interface PatternHit {
  pattern: PatternId
  /** The words it came from, at most 140 characters. */
  quote: string
}

const DRUG = /\b(?:adderall|addy|addys|vyvanse|ritalin|caffeine|coffee|weed|nicotine|meds?)\b/i

/** Each rule reads one sentence. The first quote per pattern is kept. */
const RULES: { pattern: PatternId; test: (s: string) => boolean }[] = [
  { pattern: "overwhelm", test: (s) => /\b(?:so many things|too many things|so much to do|too much|overwhelm\w*|drowning|can'?t keep up)\b/i.test(s) },
  { pattern: "should", test: (s) => /\b(?:i\s+)?(?:definitely\s+|really\s+)?should(?:\s+already)?\s+be\b|\bi'?m supposed to be\b|\bat my (?:big )?age\b/i.test(s) },
  { pattern: "permission", test: (s) => /\b(?:allowing myself|let(?:ting)? myself|i'?m allowed|giving myself permission|excuse to)\b/i.test(s) },
  { pattern: "substance-credit", test: (s) => DRUG.test(s) && /\b(?:effect|because|makes me|thanks to|on (?:my )?(?:addy|adderall)|only reason)\b/i.test(s) },
  { pattern: "scarcity", test: (s) => /\b(?:one of my last|my last (?:one|ones|pill)|only \d+ left|running (?:low|out)|almost out)\b/i.test(s) },
  { pattern: "deferral", test: (s) => /\b(?:figure out|whatever|at some point|someday|eventually)\b/i.test(s) },
  { pattern: "money-gate", test: (s) => /\bneed\s+\$?\d[\d.,]*k?\b|\b(?:less|more) cash\b|\bcan'?t afford\b|\bonce i (?:get|have) (?:the )?money\b/i.test(s) },
  { pattern: "self-kindness", test: (s) => /<3|\bproud of (?:my ?self|me)\b|\bbe gentle\b|\bgo easy on\b/i.test(s) },
]

const URGENT = /\basap\b|!{3,}|\bright (?:the fuck )?now\b|\bimmediately\b|\burgent\b/gi

function clip(s: string): string {
  const t = s.trim().replace(/\s+/g, " ")
  return t.length > 140 ? `${t.slice(0, 137)}…` : t
}

/** Sentences, for reading: on . ! ? and line breaks, keeping each mark with its sentence. */
export function sentences(text: string): string[] {
  return text
    .split(/\r?\n/)
    .flatMap((l) => l.split(/(?<=[.!?])\s+(?=\S)/))
    .map((s) => s.trim())
    .filter((s) => /[A-Za-z0-9<]/.test(s))
}

/** Every pattern the message shows, once each, with the words it came from. */
export function readPatterns(text: string): PatternHit[] {
  const out: PatternHit[] = []
  const has = (p: PatternId) => out.some((h) => h.pattern === p)
  const ss = sentences(text)
  for (const s of ss) {
    for (const r of RULES) if (!has(r.pattern) && r.test(s)) out.push({ pattern: r.pattern, quote: clip(s) })
  }
  // The same short sentence twice in a row ("So many things. So many things.") is overwhelm said aloud.
  if (!has("overwhelm")) {
    for (let i = 1; i < ss.length; i++) {
      if (ss[i]!.length <= 40 && ss[i]!.toLowerCase() === ss[i - 1]!.toLowerCase()) {
        out.push({ pattern: "overwhelm", quote: clip(`${ss[i - 1]} ${ss[i]}`) })
        break
      }
    }
  }
  const urgent = text.match(URGENT) ?? []
  if (urgent.length >= 2) out.push({ pattern: "urgency-stack", quote: `${urgent.length} urgent marks: ${[...new Set(urgent.map((u) => u.replace(/!{3,}/, "!!!").toLowerCase()))].join(", ")}` })
  return out
}
