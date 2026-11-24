/**
 * lib/ingest/bim-grammar.ts — The day-stream grammar: plain lines read in code, before any model
 *
 * Fix 3 of `docs/BIM_CHAT_USAGE.md` §7. Most of what the person types is short and in a few shapes they use
 * every day. Before this, every one of them fell to a plain log. Each part of a line becomes one of BIM's own
 * commands, so the executor writes it and `undo` takes it back:
 *
 *   to do    "need to / have to / gotta / must X"            → `todo today: X` (tomorrow when the line says so)
 *   want     "need more X / want X / iso X / order X"        → `needed: X`
 *   intake   "took / taking / sip / hitting / Nth / another" + a known pill or drink → `intake drug|drink: X`
 *   start    "starting X / X-ing rn / X-ing since 4:46"      → `currently X` (at 4:46 for "since")
 *   start    "still X-ing / working on X / going on a walk"  → `currently X`
 *   stop     "done with X / finished X / home from X"        → `stopped X`
 *   wake     "up / woke up / woke in the night"              → `stopped Sleep`
 *   did      "changed my outfit / changed into X"            → `now: | X` (a Tracking event at the send time)
 *   habit    "doing a facemask so counts as skincare"        → `did: skincare -- doing a facemask` (done today, the rest is the cell's note)
 *
 * A stop with nothing open to stop becomes a Tracking event at the send time ("done with shower"), so a
 * status line is never only a log line.
 *
 * A line is split on commas, "also", "then" and a mid-line "now"; a part that reads as none of these is kept as
 * a log line, so nothing said is lost. A question, a command, a line over 200 characters and a line with no part
 * that reads are left for the other lanes. Pure: no stores.
 */

import type { IntakeClass } from "@/lib/time-entries"

export type GrammarPiece =
  | { kind: "todo"; what: string; dayOffset: 0 | 1 }
  | { kind: "want"; what: string }
  | { kind: "intake"; what: string; cls: IntakeClass }
  | { kind: "start"; what: string; since?: { h: number; m: number; pm?: boolean } }
  | { kind: "stop"; what: string; said?: string }
  | { kind: "did"; what: string }
  | { kind: "habit"; what: string; note: string }
  | { kind: "rest"; what: string }

/** Pills and smokes the person names, then drinks. A word here is what makes "took X" an intake and not "took a nap". */
const DRUGS = String.raw`adderall|addy|addys|ral|brig|pills?|meds|medication|vitamins?|b\d+|chlorophyll?|melatonin|ibuprofen|advil|tylenol|joint|j|dab|dabs|dab pen|cart|weed|bowl|edible|edibles|penjamin|blunt|spliff|nicotine|vape|zyn`
const DRINKS = String.raw`red ?bull|redbulls?|energy drinks?|monster|celsius|coffee|espresso|latte|cold brew|matcha|tea|yerba(?: mate)?|yerb|mate|water|beer|wine|seltzer|soda|kombucha|smoothie`
const DRUG_RE = new RegExp(String.raw`\b(?:${DRUGS})\b`, "i")
const DRINK_RE = new RegExp(String.raw`\b(?:${DRINKS})\b`, "i")
const INTAKE_VERB = /^(?:just\s+)?(?:took|taking|take|takin|having|had|drinking|drank|sipping|sip|hitting|hit|smoking|smoked|smokin|finishing|finished|popped|popping|another|(?:\d+)(?:st|nd|rd|th))\b/i

/** Words at the edge of a part that carry no meaning for the filing. */
const LEAD = /^(?:(?:als+o+|and|ok(?:ay)?|so|but|btw|plus|then|ya|yeah|lol|ugh|oh)\b[\s,:-]*)+/i
const TAIL = /[\s,]*(?:\b(?:btw|lol|ya|yay+|tho|though|i think|idk|rn|right now|now|today)\b[\s!.]*)+$/i

/** "reallllly" → "realy": stretched letters, for matching only. */
const unstretch = (s: string) => s.replace(/(\p{L})\1{2,}/gu, "$1")

const clean = (s: string) => s.replace(/\s*\bbtw\b/gi, "").replace(LEAD, "").replace(/[\s!.,;]+$/g, "").trim()

const TODO = /^(?:i\s+)?(?:(?:really|still|def(?:initely)?|seriously|actually)\s+)*(?:need to|have to|has to|gotta|got to|must(?:\s+must)*|ha(?:ve|s) got to)\s+(.+)$/i
const TODO_HEAD = /^(?:to[\s-]?do|todo)\s*[:\-–]\s*(.+)$/i
/** After "need to" / "gotta": buying is a want, not a To Do. "get my car" is a To Do. */
const BUY = /^(?:buy|order|get|grab|pick up)\s+(?!my\b|ready\b|up\b|out\b|to\b|back\b|dressed\b|it\b|this\b|that\b|on\b|in\b|over\b|done\b|going\b)(.+)$/i
const WANT = /^(?:i\s+)?(?:(?:really|still|def(?:initely)?)\s+)*(?:need more|need (?:a|an|some) (?:new|better)|want (?:a |an |some |more |new )?(?!to\b)|want to (?:get|find|buy|order)\s+(?:a |an |some |more |new )?|iso\b\s*:?|order\b|wants?\s*:)\s*(.+)$/i
const START = /^(?:now\s+)?(?:just\s+)?(?:starting(?:\s+to)?|started|startin|start(?:ing)?\s+to|getting\s+started\s+on)\s+(.+)$/i
const NOW_ING = /^(?:now\s+)?(?:just\s+)?(?!leaving|heading|going|getting|coming)(\p{L}+ing\b.*?)\s+(?:rn|right now|now)$/iu
const SINCE = /^(?:been\s+)?(\p{L}+ing\b.*?)\s+since\s+(\d{1,2})(?::(\d{2}))?\s*(am|pm)?$/iu
/** "a few minutes ago", "earlier": when it ended, not part of the activity's name. */
const AGO = /\s+(?:(?:a few|a couple|some|\d+)\s+(?:min(?:ute)?s?|hours?|hrs?)\s+ago|earlier)$/i
/** Verbs that carry a feeling, not an activity: "still feeling tired" is not a pen. */
const NOT_ACTIVITY = String.raw`(?!(?:feeling|thinking|wondering|wanting|hoping|crying|trying|waiting|deciding|tired|sad|mad|anxious)\b)`
const STILL = new RegExp(String.raw`^(?:i'?m\s+)?still\s+${NOT_ACTIVITY}(\p{L}+ing\b.*)$`, "iu")
const WORKING_ON = /^(?:i'?m\s+|been\s+)?(?:just\s+)?working\s+on\s+(?!(?:it|that|this|myself|me)\b)(?:the\s+|my\s+)?(.+)$/i
const GOING = /^(?:just\s+)?(?:going|heading|headed)\s+(?:out\s+)?(?:on|for)\s+(?:a|an|my|another)\s+(.+)$/i
const WAKE = /^(?:just\s+|finally\s+)?(?:up|awake|woke(?:\s+up)?|waking\s+up|woken\s+up)(?:\s+(?:in|during)\s+(?:the\s+)?(?:middle\s+of\s+the\s+)?night)?$/i
const CHANGED = /^(?:just\s+)?(?:finally\s+)?(changed\s+(?:my\s+outfit|my\s+clothes|clothes|outfits?|into\s+.+))$/i
const STOP = /^(?:just\s+)?(?:finally\s+)?(?:done\s+with|done|finished(?:\s+with)?|got\s+out\s+of|got\s+home\s+from|home\s+from|back\s+from|stopped)\s+(?:the\s+)?(.+)$/i
/** Future and wishes are not done things: "gonna have a red bull", "was gonna", "about to". */
const NOT_YET = /^(?:i'?m\s+)?(?:gonna|going to|about to|was gonna|will|might|maybe|should|want to|wanna|thinking about|contemplating)\b/i

const QUESTION = /^(?:did|do|does|what|when|where|why|how|is|are|am|can|could|would|was|were|who|which|have i|has)\b/i

const DAY_WORDS = /\b(?:today|tonight|later(?:\s+today)?|soon|asap|tn)\b/gi
const TOMORROW = /\btomorrow(?:\s+(?:morning|afternoon|evening|night))?\b/i

function todoOf(what: string): GrammarPiece | null {
  const tomorrow = TOMORROW.test(what)
  const w = clean(what.replace(TOMORROW, " ").replace(DAY_WORDS, " ").replace(/\s+/g, " "))
  if (w.length < 2) return null
  const buy = BUY.exec(w)
  if (buy) return { kind: "want", what: clean(buy[1]!) }
  return { kind: "todo", what: w, dayOffset: tomorrow ? 1 : 0 }
}

/** "taking a shower" → "shower", "doing the dishes" → "dishes": the activity, not the sentence. */
export function activityName(phrase: string): string {
  return clean(phrase)
    .replace(AGO, "")
    .replace(/^(?:actually|really|finally)\s+/i, "")
    .replace(/^(?:taking|doing|having|going on|going for|on)\s+(?:a|an|the|some|my)?\s*/i, "")
    .replace(/^(?:a|an|the|my)\s+/i, "")
    .replace(/\s+/g, " ")
    .trim()
}

/** "X so (that|it) counts as Y", "X, counts for my Y habit", "counts as Y: X": Y is a habit done, X is why. */
const COUNTS_AS = /^(.*?)[\s,;.-]*\b(?:(?:so|which|that|this|and)\s+)*(?:(?:it|that|this)(?:'s|\s+is)?\s+)?counts?\s+(?:as|for|toward(?:s)?)\s+(?:my\s+|the\s+|a\s+)?(.+?)(?:\s+habit)?(?:\s+(?:today|for today|tho|lol|i think))?[\s!.]*$/i

export function readCountsAs(line: string): GrammarPiece | null {
  const m = COUNTS_AS.exec(line.trim())
  if (!m) return null
  const what = clean(m[2]!)
  if (!what || what.split(" ").length > 4) return null
  const note = clean(m[1]!.replace(TAIL, "")).replace(/\s+(?:rn|right now|now)$/i, "").trim()
  return { kind: "habit", what, note }
}

/** One part of a line, read. Null when it reads as none of the shapes. */
export function readPart(part: string): GrammarPiece | null {
  const raw = clean(part.replace(TAIL, ""))
  if (!raw) return null
  const p = unstretch(raw)
  if (NOT_YET.test(p)) return null
  if (INTAKE_VERB.test(p)) {
    const cls: IntakeClass | null = DRUG_RE.test(p) ? "drug" : DRINK_RE.test(p) ? "drink" : null
    if (cls) return { kind: "intake", what: p.replace(/^(?:just\s+)?(?:took|taking|take|takin|having|had|drinking|drank|sipping|sip|hitting|hit|smoking|smoked|smokin|finishing|popped|popping)\s+/i, "").trim() || p, cls }
  }
  const head = TODO_HEAD.exec(p)
  if (head) return todoOf(head[1]!)
  const want = WANT.exec(p)
  // "need more adderall" is a refill to get done, not a thing to shop for.
  if (want && want[1]!.trim().length >= 2) return DRUG_RE.test(want[1]!) ? { kind: "todo", what: `refill ${clean(want[1]!)}`, dayOffset: 0 } : { kind: "want", what: clean(want[1]!) }
  const todo = TODO.exec(p)
  if (todo) return todoOf(todo[1]!)
  const since = SINCE.exec(p)
  if (since) {
    const what = activityName(since[1]!)
    const h = Number(since[2])
    if (what && h <= 23) return { kind: "start", what, since: { h, m: Number(since[3] ?? 0), ...(since[4] ? { pm: /pm/i.test(since[4]) } : {}) } }
  }
  const stop = STOP.exec(p)
  if (stop) {
    // "got out of the shower Incense and a new rug…": the activity ends where a new sentence starts.
    const what = activityName(stop[1]!.split(/\s+(?:and|then|now)\s+|\s+(?=\p{Lu})/u)[0]!)
    if (what && what.split(" ").length <= 4) return { kind: "stop", what }
  }
  if (WAKE.test(p)) return { kind: "stop", what: "sleep", said: /night/i.test(p) ? "woke in the night" : "woke up" }
  const changed = CHANGED.exec(p)
  if (changed) return { kind: "did", what: clean(changed[1]!) }
  // "still cooking egg bites", "working on brain2", "going on a walk": the activity is on, whether or not it was started here.
  for (const re of [STILL, WORKING_ON, GOING]) {
    const m = re.exec(p)
    const what = m ? activityName(m[1]!) : ""
    if (what && what.split(" ").length <= 4) return { kind: "start", what }
  }
  const start = START.exec(p)
  if (start) {
    const what = activityName(start[1]!)
    if (what && !/^(?:now|then|rn|again|over)\b/i.test(what) && what.split(" ").length <= 5) return { kind: "start", what }
  }
  // "taking a shower rn": the trailing "rn" was cleaned off, so read the part as written.
  const nowIng = NOW_ING.exec(unstretch(clean(part)))
  if (nowIng) {
    const what = activityName(nowIng[1]!)
    if (what && what.split(" ").length <= 4) return { kind: "start", what }
  }
  return null
}

/** Commas, "also", "then", and a "now" with words on both sides ("done with shower now time to get dressed"). */
export function splitParts(line: string): string[] {
  return line
    .split(/\s*[,;]\s*|\s+(?:als+o+|and then|then)\s+|(?<=\S+\s+\S+)\s+now\s+(?=\S+\s+\S+)|\.\s+/i)
    .map((s) => s.trim())
    .filter(Boolean)
}

/**
 * The line read as parts. Null when it is not this lane's: a question, a multi-line paste, over 200 characters,
 * or no part that reads. `rest` parts are the words to keep as a log line.
 */
export function readDayStream(raw: string): GrammarPiece[] | null {
  const text = raw.replace(/\s+/g, " ").trim()
  if (!text || /\n/.test(raw.trim()) || text.length > 200 || /\?/.test(text) || /^https?:\/\//i.test(text)) return null
  // A list header ("Intention: …", "Plan: …") is the executor's: it files the line on that list.
  const header = /^([\p{L}\d][\p{L}\d '/-]{0,30}\p{L})\s*:\s*\S/u.exec(text)
  if (header && !/^(?:to[\s-]?do|todo|iso|wants?)$/i.test(header[1]!.trim())) return null
  // "…so counts as skincare": the whole line is one habit done, with what came before as its note.
  const counts = readCountsAs(text)
  if (counts) return [counts]
  // The whole line first: "need to get dressed, shower and eat" is one To Do with its commas.
  const whole = readPart(text)
  if (whole && whole.kind === "todo" && !/\b(?:als+o+|then)\b/i.test(text)) return [whole]
  // A part that asks ("did I shower today", no "?") is a question for the router, so the whole line is.
  if (splitParts(text).some((part) => QUESTION.test(clean(part)))) return null
  const pieces = splitParts(text).map((part) => readPart(part) ?? ({ kind: "rest", what: clean(part) } as GrammarPiece))
  const read = pieces.filter((p) => p.kind !== "rest")
  if (!read.length) return null
  // Lone leftovers of one or two words ("yay", "ok") are not worth a log line of their own.
  return pieces.filter((p) => p.kind !== "rest" || p.what.split(" ").length > 2)
}

/** The 24-hour clock for "since 4:46" on `now`'s day: the latest such time that is not in the future. */
export function sinceDate(since: { h: number; m: number; pm?: boolean }, now: Date): Date {
  const at = (h: number) => {
    const d = new Date(now)
    d.setHours(h, since.m, 0, 0)
    return d
  }
  if (since.pm !== undefined) return at((since.h % 12) + (since.pm ? 12 : 0))
  if (since.h > 12) return at(since.h)
  const options = [at(since.h % 12), at((since.h % 12) + 12)].filter((d) => d <= now)
  return options.length ? options[options.length - 1]! : at(since.h % 12)
}
