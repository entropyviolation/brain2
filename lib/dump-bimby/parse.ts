/**
 * lib/dump-bimby/parse.ts — A brain dump, read into its parts (pure, rules only)
 *
 * A brain dump is one long message with no clocks that says many things at once: plans
 * ("gotta book arkansas tickets", "send hannah and mary lou mail ASAP!!!"), a deadline
 * ("right now (before 2pm) need to clean entire house"), a dose ("took one of my last ones"),
 * something on the way ("elijah has a refill on the way"), a note to BIM about BIM, and the
 * rest. Each plan is an `Intention` with the words it came from, how urgent it was said, and a
 * deadline when one is named. Nothing here reads a store; `run.ts` does the matching.
 */

import { readAnchor, readAnchorClock, readMentions } from "@/lib/before-bimby/parse"
import { parseClock } from "@/lib/ingest/bim-facts"
import { sentences } from "@/lib/thought-patterns/patterns"

export interface Intention {
  /** The step, sentence case, as it would read on a to-do. */
  title: string
  /** The words it came from. */
  source: string
  /** 0 none, 4 ASAP or !!!, 5 right now or before a clock today. */
  urgency: 0 | 4 | 5
  /** A clock it must be done by, today (ms). */
  by?: number
  /** "Needs 2.5 and balls first": what the step waits on, when said. */
  gate?: string
  /** "Elijah gets home": the event it must be done before (`lib/before-bimby/`). */
  before?: string
  /** False for a "best case" thing from the list after such an event. */
  required?: boolean
}

export interface DumpRead {
  intentions: Intention[]
  /** A dose said in passing: the drug word, and the words. */
  intake?: { drug: string; source: string; last: boolean }
  /** Things on the way: "Elijah has a refill on the way". */
  waiting: string[]
  /** What was said to BIM about BIM ("you shouldn't log so much"). */
  feedback: string[]
  /** Sentences that are none of these: kept for one optional log line. */
  rest: string[]
}

const PLAN_LEAD = String.raw`(?:i\s+)?(?:really\s+|definitely\s+|still\s+)?(?:going to have to|gonna have to|need to|needa|have to|gotta|got to|must|should|want to|wanna|gonna|going to|to do:?)`
const STEP_VERBS = String.raw`charge|change|book|call|text|send|mail|email|write|make|get|buy|order|pick up|return|cancel|clean|wash|pay|finish|schedule|plan|pack|figure out|fix|clear|file|submit|apply|print|renew|sign|post|ship|wrap|bake|reply|respond|follow up|reach out|check|go to|drop off`
const LEAD_RE = new RegExp(String.raw`\b${PLAN_LEAD}\s+`, "i")
const VERB_START = new RegExp(String.raw`^(?:${STEP_VERBS})\b`, "i")
const FILLER_START = /^(?:and|also|but|so|then|plus|oh and|anyway,?)\s+/i
const URGENT_ONLY = /^(?:asap|now|today|urgent|immediately)[!.\s]*$/i
const ASAP = /\basap\b|!{3,}|\burgent\b/i
const NOW = /\bright (?:the fuck )?now\b|\bimmediately\b|\brn\b/i
const BEFORE = /\(?\s*\b(?:before|by)\s+(\d{1,2}(?::\d{2})?\s*(?:am|pm)?|noon|midnight)\s*\)?/i
/** Words after the step that only say how much it matters. */
const TAIL = /\s+(?:once and for all|and be\b.*|so (?:that|i)\b.*|because\b.*|whatever|also|too|asap|lol|tho|though)\s*$/i
const PEOPLE_VERBS = /^(send|text|call|mail|email|write)\s+(.+?)\s+((?:snail )?mail|a (?:letter|card|text)|letters?|cards?|thank (?:you|u) notes?)$/i
const DRUG_RE = /\b(adderall|addy|addys|vyvanse|ritalin|melatonin|ibuprofen|advil|tylenol|edible|weed)\b/i
const DRUG_PRONOUN = /\b(?:took|taken|taking|popped|had)\s+(?:one|1|another|my|a|an|two|2)\b/i
const BIM_WORDS = /\b(?:bim|llm mode|logging|log so much|you(?:'re| are)? learning|you should(?:n'?t)?|i would rather you|maybe you|stop (?:asking|logging)|don'?t (?:ask|log))\b/i

const clean = (s: string) =>
  s
    .replace(/[!]+/g, "")
    .replace(/\s+/g, " ")
    .replace(/^[\s,;:-]+|[\s,;:.-]+$/g, "")
    .trim()

const clip = (s: string) => (s.length > 140 ? `${s.slice(0, 137)}…` : s)

const sentenceCase = (s: string) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s)

/** Whether a message is a brain dump: long, no clocks of its own, and at least two plans in it. */
export function looksLikeDump(text: string): boolean {
  const t = text.trim()
  if (t.length < 160 || /\badd to\b/i.test(t)) return false
  if ((t.match(/\b\d{1,2}:\d{2}\b/g) ?? []).length >= 2) return false
  const leads = (t.match(new RegExp(String.raw`\b${PLAN_LEAD}\b`, "gi")) ?? []).length
  const starts = sentences(t).filter((s) => VERB_START.test(s.replace(FILLER_START, ""))).length
  return leads + starts >= 2
}

/** Parts of one sentence that can each hold a plan: split before "also" / "and need to" / "and <verb>". */
function parts(sentence: string): string[] {
  const s = sentence.replace(/\s*\(\s*(?=(?:or|i|knowing)\b)/gi, " — ").replace(/\)/g, "")
  return s
    .split(new RegExp(String.raw`\s+(?=(?:and\s+|also\s+|but\s+)${PLAN_LEAD}\b)|\s+(?=also\s+(?:${STEP_VERBS})\b)|\s*[;]\s*`, "i"))
    .map((p) => p.trim())
    .filter(Boolean)
}

/** One plan from one part, or null. `prevVerb` carries "and lucas thank u note" onto the last verb. */
function readPart(part: string, prevVerb: string | null, now: Date, said: string): { intentions: Intention[]; verb: string | null } | null {
  let body = part.replace(FILLER_START, "").replace(FILLER_START, "")
  // "clean house before 2pmish when Elijah gets home": the event is the deadline, and its clock when said.
  const event = readAnchor(body)
  let before: string | undefined
  let by: number | undefined
  if (event) {
    before = event.anchor.label
    by = readAnchorClock(body, event.anchor.key, now) ?? undefined
    body = `${body.slice(0, event.index)} ${body.slice(event.end)}`
  }
  const urgency: Intention["urgency"] = NOW.test(body) || BEFORE.test(body) || before ? 5 : ASAP.test(body) ? 4 : 0
  const clockBy = BEFORE.exec(body)
  if (clockBy) {
    const at = parseClock(`at ${clockBy[1]} today`, now)
    if (at) by = at.getTime()
    body = body.replace(BEFORE, " ")
  }
  body = body.replace(NOW, " ").replace(/\b(?:but\s+)?(?:right\s+)?the fuck\b/gi, " ").replace(/\basap\b/gi, " ")
  let gate: string | undefined
  // "Need 2.5 and balls (…) to call cap again": the need is a gate, the step comes after "to".
  const need = /^(?:i\s+)?need\s+(.{1,60}?)\s+to\s+(.+)$/i.exec(clean(body))
  if (need && !/^to\b/i.test(need[1]!) && VERB_START.test(need[2]!)) {
    gate = clean(need[1]!.replace(/\s+—.*$/, ""))
    body = need[2]!
  } else {
    const lead = LEAD_RE.exec(body)
    if (lead) body = body.slice(lead.index + lead[0].length)
    else if (!VERB_START.test(clean(body))) {
      // No verb of its own: a short "and lucas/shelby thank u note and necklace" after a plan takes that plan's verb.
      const words = clean(body).split(/\s+/).length
      if (prevVerb && /^(?:and|also|plus)\b/i.test(part.trim()) && words <= 8 && !/\b(?:is|was|are|be|it|i|everything|stuff|things|etc)\b/i.test(body)) body = `${prevVerb} ${clean(body)}`
      else return null
    }
  }
  body = clean(body.replace(/\s+—.*$/, ""))
  for (let i = 0; i < 3; i++) body = body.replace(TAIL, "").trim()
  body = clean(body.replace(/\b(make|get|buy)\s*\/\s*(make|get|buy)\b/i, "$1 or $2"))
  if (!body || !VERB_START.test(body) || body.split(/\s+/).length > 16) return null
  const verb = VERB_START.exec(body)![0].toLowerCase()
  // "send hannah and mary lou and emily shad mail" is one step per person.
  const ppl = PEOPLE_VERBS.exec(body)
  if (ppl && /\band\b|,/.test(ppl[2]!)) {
    const names = ppl[2]!.split(/\s*(?:,|\band\b)\s*/i).map((n) => n.trim()).filter(Boolean)
    if (names.length >= 2 && names.every((n) => n.split(/\s+/).length <= 3)) {
      return {
        verb,
        intentions: names.map((n) => ({ title: sentenceCase(`${ppl[1]!.toLowerCase()} ${titleName(n)} ${ppl[3]!.toLowerCase()}`), source: said, urgency, ...(by ? { by } : {}), ...(gate ? { gate } : {}) })),
      }
    }
  }
  return { verb, intentions: [{ title: sentenceCase(body), source: said, urgency, ...(by ? { by } : {}), ...(gate ? { gate } : {}), ...(before ? { before } : {}) }] }
}

/** "mary lou" → "Mary Lou". Only for names in a split, where the words are people. */
function titleName(n: string): string {
  return n.replace(/\b[a-z]/g, (c) => c.toUpperCase())
}

export function readDump(text: string, now: Date): DumpRead {
  const out: DumpRead = { intentions: [], waiting: [], feedback: [], rest: [] }
  let prevVerb: string | null = null
  for (const s of sentences(text)) {
    // "ASAP!!!!" on its own marks the plan before it.
    if (URGENT_ONLY.test(s.replace(/!+/g, "!").trim()) || /^!+$/.test(s)) {
      const last = out.intentions[out.intentions.length - 1]
      if (last && last.urgency < 4) last.urgency = 4
      continue
    }
    if (BIM_WORDS.test(s) && /\byou\b/i.test(s)) {
      out.feedback.push(clean(s))
      continue
    }
    const drug = DRUG_RE.exec(s)
    if (drug && DRUG_PRONOUN.test(s) && !out.intake) out.intake = { drug: drug[1]!.toLowerCase(), source: clean(s), last: /\b(?:one of my last|my last)\b/i.test(s) }
    const way = /\b([a-z]+(?:\s[a-z]+)?)\s+(?:has|have|got|is getting|ordered)\s+(?:a |an |the |my |me a )?([a-z ]{2,30}?)\s+on the way\b/i.exec(s)
    if (way) out.waiting.push(sentenceCase(`${titleName(way[1]!.replace(/^(?:knowing|since|and|but)\s+/i, ""))} has ${way[2]!.trim()} on the way`))
    let took = false
    for (const p of parts(s)) {
      const read = readPart(p, prevVerb, now, clip(s))
      if (!read) continue
      took = true
      prevVerb = read.verb
      out.intentions.push(...read.intentions)
    }
    if (!took) prevVerb = null
    if (!took && !drug && !way) out.rest.push(clean(s))
  }
  // An event named as a deadline ("before 2pmish when Elijah gets home") and the lists said after it
  // ("Bare minimum - change sheets, …", "Best case …"): each thing is a plan due before it.
  const event = readAnchor(text)
  if (event) {
    const by = readAnchorClock(text, event.anchor.key, now) ?? undefined
    const used = new Set<string>()
    for (const it of readMentions(text, event.anchor.key, now)) {
      if (it.source) used.add(clean(it.source))
      if (out.intentions.some((i) => i.title.toLowerCase() === it.title.toLowerCase())) continue
      out.intentions.push({ title: it.title, source: clip(it.source ?? text), urgency: it.required ? 5 : 0, ...(by ? { by } : {}), before: event.anchor.label, required: it.required })
    }
    out.rest = out.rest.filter((r) => !used.has(r))
  }
  // One plan said twice in the dump is one plan.
  const seen = new Set<string>()
  out.intentions = out.intentions.filter((i) => {
    const k = i.title.toLowerCase()
    if (seen.has(k)) return false
    seen.add(k)
    return true
  })
  return out
}
