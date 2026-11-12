/**
 * lib/plan-bimby/day/update.ts — A long update about the day, read against the live day plan (pure, rules only)
 *
 * While a day plan is live, a message like "update on this plan- … like asking the neighbor if i can use their
 * laundry key? … Scary thing. … did make the order … add to my to do list make shelby gift (orca) …" is not a
 * stream of 20 notes. It is changes to the plan: things added (with what they wait on), things done (at a time,
 * or somewhere inside a window), how a thing feels, and a few lines for Tracking, Notes and Shopping. What names
 * nothing and asks for nothing is heard, listed in the trace, and not filed.
 *
 * `readDayUpdate` returns the changes; `updateCard` turns them into a Report card (`ReportPlan`), one effect
 * each. Nothing is written here. Accept goes through `update-apply.ts` (day effects) and the Stream BIMBY's
 * line writer (lines).
 */

import { readClock, segments, type Clock } from "@/lib/stream-bimby/parse"
import type { Effect, EffectField, ReportPlan } from "@/lib/report-bimby/types"
import { allWords, contentWords, nameScore, startsWithVerb } from "./read"
import { TIER_LABEL, type DayPlan, type DayTier } from "./types"

export interface DayChangeBase {
  /** The words it was read from. */
  source: string
  /** Why, in one sentence. */
  why: string
}

export type DayChange =
  | (DayChangeBase & { op: "add"; title: string; tier: DayTier; note?: string; before?: string; after?: string; resistance?: number; feeling?: string; doneAt?: string })
  | (DayChangeBase & { op: "done"; item: string; at?: string; from?: string; to?: string })
  | (DayChangeBase & { op: "feel"; item: string; resistance?: number; feeling?: string })
  | (DayChangeBase & { op: "first"; item: string })
  | (DayChangeBase & { op: "line"; label: string; line: string })

export interface DayUpdate {
  changes: DayChange[]
  /** Heard, not filed. */
  heard: string[]
  trace: string[]
}

const pad = (n: number) => String(n).padStart(2, "0")
const clockOf = (d: Date) => `${pad(d.getHours())}:${pad(d.getMinutes())}`
const quote = (s: string) => (s.length > 70 ? `${s.slice(0, 67)}…` : s)
const tidy = (s: string) => s.replace(/\s+/g, " ").replace(/^[\s,.;:–—-]+|[\s,.;:?!…–—-]+$/g, "").trim()

// ── Shapes ─────────────────────────────────────────────────────────────

/** "update on this plan-", "updateee", "update:" at the front of a piece. */
const UPDATE_LEAD = /^(?:update+(?:d)?(?:\s+on\s+(?:this|the|my)\s+plan)?|status|ok so|so)\s*[:\-–—,]?\s*/i
/** "updated plan:" alone: the lines under it restate the plan. */
const RESTATE = /^(?:updated|new|revised|current)\s+plan\s*:?$/i
/** "(update as of 7pm)": the time the "so far" lines were written. */
const AS_OF = /^\(?\s*(?:update|updated|written|as)?\s*(?:as of|at)\s+([^)]+?)\)?\s*\.?$/i
/** "add to my to do list …" */
const ADD_LIST = /^(?:also\s+|and\s+)?(?:add|put)\s+(?:to|on)\s+(?:my|the|today'?s)\s+(?:to ?do(?:\s+list)?|list|plan|day)\s*[:,\-–—]?\s*(.+)$/i
/** "need to just clean … and pack and dye hair" */
const NEED = /^(?:i\s+)?(?:still\s+)?(?:need to|have to|gotta|got to|must)\s+(?:just\s+|still\s+|also\s+)?(.+)$/i
/** "i should ask a neighbor …", "actually i should …" (a thing to do, said again or new). */
const SHOULD = /\b(?:i\s+(?:really\s+)?(?:do\s+)?(?:think\s+)?(?:i\s+)?should|i'?ll|i'?m gonna|gonna|i want to)\s+(.+)$/i
/** A rule for every day, not a thing for today: a note. */
const STANDING = /\b(?:per day|every day|each day|everyday|daily|every week|from now on|in general|as a habit)\b/i
/** "still haven't really done anything, just danced around, drank redbull, did make the order". */
const SO_FAR = /^(?:still\s+|so far\s+)?(?:i\s+)?(?:havent|haven'?t|have not|hadn'?t|did ?n'?t)\s+(?:really\s+)?(?:done|gotten|got)\s+(?:anything|much|a lot)\b/i
const PAST_VERB = /\b(?:did|made|took|drank|ate|went|got|finished|worked|danced|danced|watched|cleaned|packed|ordered|posted|sent|called|texted|showered|walked|wrote|read|bought|scrolled)\b/gi
/** "did make the order", "finished packing", "posted on something else". */
const DID = /\b(?:did|done with|finished|completed|already)\s+(.+)$/i
const ARRIVED = /^(?:the\s+|my\s+)?(.+?)\s+(?:has|have|had|just|finally)?\s*(?:arrived|came|got here|was delivered|been delivered|is here|showed up)\b/i
const OBTAINED = /\(([^)]*\b(?:obtained|got|gotten|done|secured|borrowed)\b[^)]*)\)|\b(?:got|obtained|borrowed|secured)\s+(?:the\s+|a\s+|my\s+)?([a-z][a-z ]{2,40})/i
const FINALLY_DONE = /\b(?:job|it|that)?\s*(?:finally|is|was)?\s*done\b|\bdid it\b|\bmanaged\b|\bpulled it off\b/i
const MEANS = /^(?:like|maybe|by|or|so like)\s+([a-z]+ing)\b\s*(.*)$/i
const FEAR = /\b(courage|scary|scared|scare|nervous|terrif\w*|dread\w*|afraid|anxious|brave|rehears\w*|intimidat\w*)\b/i
const MOOD = /\b(stress\w*|happy|sad|anxious|tired|proud|relieved|calm|overwhelmed|frustrated|exhausted|glad|good|bad|awful|great)\b/i
const WHERE = /\bwhere(?:'|’)?s\s+my\s+([a-z]+)\b/i
const SHOP = /\b(?:need to|have to|gotta|should|want to|must)\s+(?:get|buy|order|find)\s+(?:a|an|some|new|myself a)?\s*(.+)$/i
const WAITING = /\b(incoming|on (?:its|the) way|arriving|coming|shipped|out for delivery)\b/i
const FIRST = /\b(?:do|doing|ask|get)\s+(?:the\s+)?(.+?)\s+first\b/i
const DOING = /\b(?:was|been)\s+([a-z]+ing)\b(.*)$|\bnow\s+([a-z]+ing)\b(.*)$/i
const PREREQ_VERB = /^(?:fix|repair|get|buy|order|find|charge|ask|borrow|book|clean|set up|install|download)\b/i
const MUST_WORDS = /\b(flight|passport|check[- ]?in|deadline|due|tomorrow|tonight)\b/i

/** Gerund to doing word: "asking" → "ask", "putting" → "put", "making" → "make". */
function verbOf(gerund: string): string {
  const g = gerund.toLowerCase()
  if (!g.endsWith("ing") || g.length < 5) return g
  const base = g.slice(0, -3)
  if (/([b-df-hj-np-tv-z])\1$/.test(base) && !/(?:ll|ss)$/.test(base)) return base.slice(0, -1)
  if (/(?:ak|at|av|iv|ov|ar|ur|ok|ir|ic|ng|uc|us|it)$/.test(base) && !/(?:ask|oot|eat|ook|ing|ng)$/.test(base)) return `${base}e`
  return base
}

/** Distinct words only (not the doing word). "laundry key obtained" meets "ask the neighbor … laundry key". */
function overlapScore(title: string, phrase: string): number {
  const have = new Set(allWords(phrase))
  const all = contentWords(title)
  const words = all.length > 1 ? all.filter((w, i) => !(i === 0 && startsWithVerb(w))) : all
  return words.filter((w) => have.has(w)).length
}

/** Title words with the one alias people use ("brows" is "eyebrows"). */
const alias = (s: string) => s.replace(/\bbrows\b/gi, "eyebrows")

interface Known {
  title: string
  /** Index into `changes` when it was added by this update. */
  added?: number
}

/** The plan item (or a thing added earlier in this update) a phrase names. Exact naming first, then shared words. */
function named(known: Known[], phrase: string, loose = false): Known | null {
  const p = alias(phrase)
  let best: Known | null = null
  let top = 0
  let tied = false
  for (const k of known) {
    const s = Math.max(nameScore(alias(k.title), p), nameScore(p, alias(k.title)))
    if (s > top) [best, top, tied] = [k, s, false]
    else if (s && s === top) tied = true
  }
  if (best && !tied) return best
  if (!loose) return null
  best = null
  top = 0
  tied = false
  for (const k of known) {
    const s = overlapScore(alias(k.title), p)
    if (s > top) [best, top, tied] = [k, s, false]
    else if (s && s === top) tied = true
  }
  return best && !tied && top >= 2 ? best : null
}

/** Two or more distinct shared words, and no tie: "laundry key obtained" is the key, not the laundry. */
function byWords(known: Known[], phrase: string): Known | null {
  const p = alias(phrase)
  const scored = known.map((k) => ({ k, s: overlapScore(alias(k.title), p) })).filter((x) => x.s >= 2).sort((a, b) => b.s - a.s)
  return scored.length && (scored.length === 1 || scored[0]!.s > scored[1]!.s) ? scored[0]!.k : null
}

/** The same thing said again: each names the other ("ask the neighbor …" is not "do laundry"). */
function same(known: Known[], title: string): boolean {
  const t = alias(title)
  return known.some((k) => Math.min(nameScore(alias(k.title), t), nameScore(t, alias(k.title))) > 0)
}

/** "do key first": one distinct word, held by exactly one thing. */
function oneWord(known: Known[], phrase: string): Known | null {
  const words = contentWords(phrase).filter((w) => !startsWithVerb(w))
  if (words.length !== 1) return null
  const hits = known.filter((k) => contentWords(k.title).includes(words[0]!))
  return hits.length === 1 ? hits[0]! : null
}

/** "do sewing fix sewing machine" is two things glued: split before a doing word once the first has words. */
function splitVerbs(s: string): string[] {
  const words = s.split(/\s+/)
  const out: string[] = []
  let cur: string[] = []
  for (const w of words) {
    if (cur.length >= 2 && !/^\(/.test(w) && startsWithVerb(w) && !/^(?:to|for|and)$/i.test(cur.at(-1)!)) {
      out.push(cur.join(" "))
      cur = []
    }
    cur.push(w)
  }
  if (cur.length) out.push(cur.join(" "))
  return out
}

/** A list body → things. Commas, "and", "maybe" start a new thing; brackets are an aside. */
function listParts(body: string): { title: string; maybe: boolean; note?: string }[] {
  const out: { title: string; maybe: boolean; note?: string }[] = []
  for (const raw of body.split(/,|\s+and\s+|\s+(?=maybe\s)/i)) {
    const maybe = /^\s*maybe\b/i.test(raw)
    const part = raw.replace(/^\s*(?:maybe|also|then|plus|oh)\s+/i, "")
    for (const bit of splitVerbs(part.trim())) {
      const note = /\(([^)]*)\)/.exec(bit)?.[1]?.trim()
      const title = tidy(bit.replace(/\([^)]*\)/g, " ").replace(/\s+(?:which|that|because|cause|cuz|since|when)\b.*$/i, ""))
      if (title.length >= 3) out.push({ title, maybe, ...(note ? { note } : {}) })
    }
  }
  return out
}

/** One piece → clauses: "?", "!", "…", "hey wait", " so ", and after a closing bracket. */
function clauses(piece: string): { text: string; so: boolean }[] {
  const out: { text: string; so: boolean }[] = []
  let so = false
  for (const raw of piece.split(/(?<=[?!…])\s*|\s*\.{3}\s*|\s*\bhey,? wait\b[,\s]*|\s+wait\s+|(?<=\))\s+(?=[a-z])|,\s+(?=[a-z]+ed\b)/i)) {
    const parts = raw.split(/\s+so\s+(?!far\b)/i)
    parts.forEach((p, i) => {
      const text = tidy(p)
      if (text) out.push({ text, so: so || i > 0 })
    })
    so = false
  }
  return out
}

function asOfClock(text: string, now: Date): string | null {
  const m = AS_OF.exec(text.trim())
  if (!m) return null
  return readClock(m[1]!, now)?.hhmm ?? null
}

// ── Reading ────────────────────────────────────────────────────────────

export interface UpdateContext {
  /** When the plan was last heard from: the plan itself, or the last update. Local HH:MM. */
  since: string
  now: Date
}

export function readDayUpdate(plan: Pick<DayPlan, "items">, text: string, ctx: UpdateContext): DayUpdate {
  const changes: DayChange[] = []
  const heard: string[] = []
  const trace: string[] = []
  const known: Known[] = plan.items.filter((i) => i.title.trim()).map((i) => ({ title: i.title }))
  const sendAt = clockOf(ctx.now)
  const ps = segments(text)
  let current: Clock | null = null
  let restating = false
  let listOpen = false
  let focus: Known | null = null
  let lastAdded: number | null = null
  let lastNoun: string | null = null
  let lastDone: string | null = null
  const asOf = ps.map((p) => asOfClock(p, ctx.now)).find(Boolean) ?? null

  const add = (c: Extract<DayChange, { op: "add" }>): number => {
    changes.push(c)
    const i = changes.length - 1
    known.push({ title: c.title, added: i })
    lastAdded = i
    return i
  }
  const markDone = (k: Known, at: string, source: string, why: string) => {
    lastDone = k.title
    if (k.added !== undefined) {
      const c = changes[k.added] as Extract<DayChange, { op: "add" }>
      c.doneAt = at
      c.why += ` Done at ${at}: "${quote(source)}".`
      return
    }
    if (!changes.some((c) => c.op === "done" && c.item === k.title)) changes.push({ op: "done", item: k.title, at, source, why })
  }
  const feel = (target: number | Known | null, resistance: number, feeling: string, source: string) => {
    if (typeof target === "number") {
      const c = changes[target] as Extract<DayChange, { op: "add" }>
      c.resistance = Math.max(c.resistance ?? 0, resistance)
      c.feeling = [...new Set([...(c.feeling ?? "").split("; "), ...feeling.split("; ")].filter(Boolean))].join("; ")
      return
    }
    if (target) {
      if (target.added !== undefined) return feel(target.added, resistance, feeling, source)
      changes.push({ op: "feel", item: target.title, resistance, feeling, source, why: "Said how it feels before doing it." })
    }
  }

  for (const piece of ps) {
    const own = readClock(piece, ctx.now)
    if (own) current = own.end ? { hhmm: own.end, est: own.est } : own
    const at = own?.hhmm ?? current?.hhmm ?? sendAt
    const atNote = own ? "" : current ? " (the time above it)" : " (the send time)"
    const isListLine = /^\s*[-*•]/.test(piece)
    if (RESTATE.test(tidy(piece))) {
      restating = true
      trace.push(`"${tidy(piece)}": the lines under it restate the plan.`)
      continue
    }
    const s = tidy(piece.replace(/^\s*[-*•]+\s*/, "").replace(UPDATE_LEAD, "").replace(/^\b\d{1,2}:\d{2}\s*(?:am|pm)?\b\s*/i, ""))
    if (!s) continue
    if (AS_OF.test(s) && asOfClock(s, ctx.now)) continue
    if (restating && !isListLine) restating = false

    // The plan said again, line by line: only what is new is added.
    if (restating) {
      for (const part of s.split(/,|\s+and\s+/)) {
        const maybe = /^\s*maybe\b/i.test(part)
        const title = tidy(part.replace(/^\s*maybe\s+/i, ""))
        if (title.length < 3) continue
        const hit = named(known, title)
        if (hit) continue
        if (WAITING.test(title)) {
          heard.push(title)
          continue
        }
        add({ op: "add", title, tier: "rest", source: piece, why: maybe ? `On your updated plan, with "maybe".` : "On your updated plan." })
      }
      continue
    }

    // So far: what the time since the last message went to. One block, and anything on the plan it finished.
    if (SO_FAR.test(s) || (s.match(PAST_VERB)?.length ?? 0) >= 3) {
      const to = asOf ?? at
      const what = tidy(s.replace(SO_FAR, "").replace(/^[\s,]*(?:just|only)\s+/i, "").replace(/\([^)]*\)/g, " ").replace(/\s+which is (?:good|bad|fine|nice)$/i, ""))
      changes.push({ op: "line", label: "Tracking activity", line: `track: ${what} ${ctx.since}-${to}`, source: piece, why: `What ${ctx.since}–${to} went to, from your words. One block for the whole stretch; split it on the Activity view if you know more.` })
      for (const m of s.matchAll(/\bdid\s+(?!take\b)([a-z]+(?:\s+(?!did\b)[a-z]+){0,3})/gi)) {
        const hit = named(known, m[1]!, true)
        if (hit) markDone(hit, to, piece, `You said you did it, somewhere between ${ctx.since} and ${to}; the minute is not known.`)
        if (hit && hit.added === undefined) {
          const c = changes.at(-1)!
          if (c.op === "done") Object.assign(c, { at: undefined, from: ctx.since, to })
        }
      }
      continue
    }

    // "add to my to do list …": each thing, and "and …" pieces right after it.
    const listed = ADD_LIST.exec(s)
    const continuing = listOpen && /^(?:and|also|plus)\s+/i.test(s)
    if (listed || continuing) {
      listOpen = true
      const cl = clauses(listed ? listed[1]! : s.replace(/^(?:and|also|plus)\s+/i, ""))
      const head = cl.filter((c) => !c.so && startsWithVerb(c.text.replace(/^maybe\s+/i, "")))
      const parts = listParts(head.slice(0, listed ? head.length : 1).map((c) => c.text).join(", "))
      for (let i = 0; i < parts.length; i++) {
        const part = parts[i]!
        const prev = parts[i - 1]
        const isPrereq = !!prev && PREREQ_VERB.test(part.title) && overlapScore(prev.title, part.title) >= 1
        if (!isPrereq && named(known, part.title)) continue
        const tier: DayTier = MUST_WORDS.test(part.title) || (MUST_WORDS.test(s) && /\b(?:flight|check)/i.test(part.title)) ? "must" : part.maybe ? "rest" : "rest"
        const prevIndex = isPrereq ? changes.findIndex((c) => c.op === "add" && c.title === prev.title) : -1
        add({
          op: "add",
          title: part.title,
          tier: isPrereq && prevIndex >= 0 ? ((changes[prevIndex] as { tier: DayTier }).tier) : tier,
          ...(part.note ? { note: part.note } : {}),
          ...(isPrereq ? { before: prev.title } : {}),
          source: piece,
          why: [
            "You asked to add it to today's list.",
            part.maybe ? `You said "maybe", so it is if-time.` : "",
            tier === "must" ? "It has a deadline (a flight), so it is a must." : "",
            isPrereq ? `It has to happen before "${prev.title}".` : "",
          ].filter(Boolean).join(" "),
        })
      }
      // The rest of that piece is read clause by clause below (a passport aside, a thing to buy).
      for (const c of cl.filter((c) => !head.includes(c))) readClause(c.text, c.so, piece, at, atNote)
      continue
    }
    listOpen = false
    for (const c of clauses(s)) readClause(c.text, c.so, piece, at, atNote)
  }

  function readClause(c: string, _so: boolean, piece: string, at: string, atNote: string): void {
    let m: RegExpExecArray | null
    const where = WHERE.exec(c)
    if (where) {
      lastNoun = where[1]!.toLowerCase()
      const aside = /\(([^)]+)\)/.exec(c)?.[1]
      if (aside) changes.push({ op: "line", label: "Notes", line: `note: where my ${lastNoun} is: ${tidy(aside)}`, source: piece, why: `Where you put your ${lastNoun}, kept so you can find it.` })
      else heard.push(c)
      return
    }
    if ((m = SHOP.exec(c))) {
      let thing = tidy(m[1]!.replace(/\b(?:that thing|that|it|this thing|one)\b/i, lastNoun ?? "$&"))
      thing = thing.replace(/^(\w+) for (?:my |the |a )?(\w+)$/i, "$2 $1")
      changes.push({ op: "line", label: "Shopping list", line: `shopping: ${thing}`, source: piece, why: "A thing to get. Filed to the shopping list, not today's plan." })
      return
    }
    if (STANDING.test(c)) {
      changes.push({ op: "line", label: "Notes", line: `note: ${c.replace(/^maybe\s+/i, "")}`, source: piece, why: "A rule for every day, not a thing for today: kept as a note." })
      return
    }
    if ((m = ARRIVED.exec(c))) {
      const what = tidy(m[1]!)
      const hit = named(known, what, true) ?? named(known, `order ${what}`, true)
      const waiting = hit ? plan.items.filter((i) => i.after && plan.items.find((x) => x.id === i.after)?.title === hit.title).map((i) => `"${i.title}"`) : []
      changes.push({ op: "line", label: "Tracking log", line: `log: ${what} arrived at ${at}`, source: piece, why: `An event at ${at}${atNote}.${waiting.length ? ` ${waiting.join(" and ")} can start now.` : ""}` })
      return
    }
    // "(laundry key obtained)", "job finally done", "got the key": the thing asked for is done, and it is an event.
    const ob = OBTAINED.exec(c)
    if (ob || FINALLY_DONE.test(c)) {
      const what = tidy(ob?.[1] ?? ob?.[2] ?? "")
      const hit = byWords(known, `${what} ${c}`) ?? named(known, `${what} ${c}`, true) ?? (lastAdded !== null && FINALLY_DONE.test(c) ? known.find((k) => k.added === lastAdded) ?? null : null)
      if (hit) markDone(hit, at, piece, `You said it is done, at ${at}${atNote}.`)
      if (what || hit) changes.push({ op: "line", label: "Tracking log", line: `log: ${what || `${hit!.title}: done`} at ${at}`, source: piece, why: `The moment it happened, ${at}${atNote}.` })
      if (hit || what) return
    }
    if ((m = DID.exec(c)) || /^[a-z]+ed\b/i.test(c)) {
      const phrase = m ? m[1]! : c
      const hit = named(known, phrase.replace(/^(\w+?)ed\b/i, "$1"), true) ?? named(known, phrase, true)
      if (hit) {
        markDone(hit, at, piece, `You said it is done, at ${at}${atNote}.`)
        return
      }
    }
    if ((m = MEANS.exec(c)) && focus) {
      const title = tidy(`${verbOf(m[1]!)} ${m[2]!}`).replace(/\?$/, "")
      if (!same(known, title)) {
        add({ op: "add", title, tier: "rest", before: focus.title, source: piece, why: `How "${focus.title}" can happen, so it comes first.` })
        return
      }
    }
    if (FEAR.test(c) && lastAdded !== null && !STANDING.test(c)) {
      const word = FEAR.exec(c)![1]!.toLowerCase()
      feel(lastAdded, 3, /courage|brave/.test(word) ? "scared; working up the courage" : /scar/.test(word) ? "scared" : word, piece)
      return
    }
    if (MOOD.test(c) && !startsWithVerb(c)) {
      const about = lastDone ? ` (after "${lastDone}")` : ""
      changes.push({ op: "line", label: "Notes mood", line: `note: mood: ${c}${about} at ${at}`, source: piece, why: `How it felt, at ${at}${atNote}.` })
      return
    }
    if ((m = FIRST.exec(c))) {
      const hit = named(known, m[1]!, true) ?? oneWord(known, m[1]!)
      if (hit) changes.push({ op: "first", item: hit.title, source: piece, why: `You said to do it first.` })
      else heard.push(c)
      return
    }
    if ((m = DOING.exec(c))) {
      const doing = tidy(m[1] ? `${m[1]} ${m[2]}`.replace(/\s+now\s+/i, ", now ") : `${m[3]} ${m[4]}`)
      changes.push({ op: "line", label: "Tracking log", line: `log: ${doing} at ${at} est`, source: piece, why: `What you were doing, around ${at}${atNote}. No exact minute was said.` })
      return
    }
    const need = NEED.exec(c) ?? SHOULD.exec(c)
    if (need) {
      let addedAny = false
      for (const part of listParts(need[1]!)) {
        if (named(known, part.title) || named(known, part.title, true)) continue
        if (!startsWithVerb(part.title)) continue
        add({ op: "add", title: part.title, tier: "rest", source: piece, why: "Said as a thing you need to do today." })
        addedAny = true
      }
      if (!addedAny) trace.push(`"${quote(c)}": already on the plan.`)
      return
    }
    // The item a clause talks about becomes the focus for a "like asking …" right after it.
    const about = named(known, c)
    if (about) focus = about
    heard.push(c)
  }

  // "do the key first" said before it was done: once it is done, there is nothing to move.
  const doneTitles = new Set(changes.flatMap((c) => (c.op === "add" && c.doneAt ? [c.title] : c.op === "done" ? [c.item] : [])))
  for (let i = changes.length - 1; i >= 0; i--) {
    const c = changes[i]!
    if (c.op === "first" && doneTitles.has(c.item)) changes.splice(i, 1)
  }
  trace.unshift(`Read ${ps.length} pieces against today's plan (${plan.items.length} things). Since ${ctx.since}${asOf ? `, written as of ${asOf}` : ""}.`)
  return { changes, heard, trace }
}

/** Worth reading as an update: long, and it talks about the plan (says "plan" or "update", or names a thing on it). */
export function looksLikeDayUpdate(plan: Pick<DayPlan, "items">, text: string): boolean {
  const t = text.trim()
  if (t.length < 80) return false
  const pieces = segments(t)
  if (pieces.length < 2) return false
  if (/\b(?:update|updated|plan|to ?do list|so far)\b/i.test(t)) return true
  const known = plan.items.map((i) => ({ title: i.title }))
  return pieces.filter((p) => named(known, p)).length >= 2
}

// ── The card ───────────────────────────────────────────────────────────

export const SCALE_OPTIONS = ["not said", "0 none", "1 low", "2 medium", "3 high", "4 very high"]
const scaleValue = (n: number | undefined) => (n === undefined ? "not said" : SCALE_OPTIONS[Math.max(0, Math.min(4, Math.round(n))) + 1]!)
export const TIER_OPTIONS = [TIER_LABEL.must, TIER_LABEL.important, TIER_LABEL.rest]

const text = (key: string, label: string, value = ""): EffectField => ({ key, label, type: "text", value })

/** The changes as a card, one effect each. `ref` is the day plan's id so accept knows which plan. */
export function updateCard(planId: string, message: string, now: Date, read: DayUpdate): ReportPlan {
  const id = `dayupd_${now.getTime().toString(36)}`
  const effects: Effect[] = read.changes.map((c, i) => {
    const base = { id: `${id}-${i}`, reasoning: [c.why], evidence: [`“${quote(c.source)}”`], status: "pending" as const }
    switch (c.op) {
      case "add":
        return {
          ...base,
          kind: "day",
          op: "add",
          ref: planId,
          title: `Add to today: ${c.title}${c.before ? ` (before "${c.before}")` : ""}${c.doneAt ? `, done ${c.doneAt}` : ""}`,
          fields: [
            text("title", "Thing to do", c.title),
            { key: "tier", label: "Weight", type: "select", value: TIER_LABEL[c.tier], options: TIER_OPTIONS },
            text("before", "Comes before (a thing on the plan)", c.before ?? ""),
            text("after", "Waits on (a thing on the plan)", c.after ?? ""),
            { key: "resistance", label: "Resistance", type: "select", value: scaleValue(c.resistance), options: SCALE_OPTIONS },
            text("feeling", "How it feels", c.feeling ?? ""),
            text("note", "Note", c.note ?? ""),
            text("done", "Done at (HH:MM, blank if not yet)", c.doneAt ?? ""),
          ],
        }
      case "done":
        return {
          ...base,
          kind: "day",
          op: "done",
          ref: planId,
          title: `Done: ${c.item}${c.at ? ` at ${c.at}` : c.from ? `, sometime ${c.from}–${c.to}` : ""}`,
          fields: [text("item", "Thing on the plan", c.item), text("when", "When (HH:MM, or a window HH:MM-HH:MM when the minute is not known)", c.at ?? (c.from ? `${c.from}-${c.to}` : ""))],
        }
      case "feel":
        return {
          ...base,
          kind: "day",
          op: "feel",
          ref: planId,
          title: `Feeling before "${c.item}"${c.feeling ? `: ${c.feeling}` : ""}`,
          fields: [text("item", "Thing on the plan", c.item), { key: "resistance", label: "Resistance", type: "select", value: scaleValue(c.resistance), options: SCALE_OPTIONS }, text("feeling", "How it feels", c.feeling ?? "")],
        }
      case "first":
        return { ...base, kind: "day", op: "first", ref: planId, title: `Do first: ${c.item}`, fields: [text("item", "Thing on the plan", c.item)] }
      case "line":
        return { ...base, kind: "line", title: `${c.label}: ${quote(c.line.replace(/^[a-z ]+:\s*/i, ""))}`, fields: [text("line", "Line BIM files", c.line)] }
    }
  })
  const trace = [...read.trace]
  if (read.heard.length) trace.push(`Heard, not filed: ${read.heard.map((h) => `"${quote(h)}"`).join("; ")}.`)
  return { id, text: message, at: now.toISOString(), trace, effects }
}
