/**
 * lib/habit-helper/tags.ts — TAG: cut the message into clauses and tag what code can read
 *
 * Amounts (`10 pages[N1]`, `half an hour[N2]` = 30 min), days (`yesterday[D1]`, resolved by the Tracking
 * Helper's `resolveDay`), negations (`didn't[X1]`) and reasons (`because I woke up late[B1]`, kept word for
 * word). A clause is a comma, "and", "then", or dash piece of a sentence; a "because" part stays on the
 * clause it explains. A day word holds for the clauses after it until another day word.
 */

import { dateKey, resolveDay } from "@/lib/tracking-helper/clock"
import type { Clause, Tag } from "./types"
import { STOP, unitOf } from "./words"

const NUM_WORDS: Record<string, number> = { a: 1, an: 1, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, twelve: 12, fifteen: 15, twenty: 20, thirty: 30, forty: 40, fifty: 50, sixty: 60 }

const WEEKDAY = "(?:mon|tues|wednes|thurs|fri|satur|sun)day"
const MONTH = "(?:jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z]*\\.?"
const DAY_RE = new RegExp(`\\b(?:today|tonight|yesterday|last night|this (?:morning|afternoon|evening)|(?:last )?${WEEKDAY}|${MONTH} \\d{1,2}(?:st|nd|rd|th)?|\\d{1,2}/\\d{1,2}(?:/\\d{2,4})?)\\b`, "gi")
const NEG_RE = /\b(?:didn'?t|did not|haven'?t|have not|hadn'?t|never|skipped|skip|missed|forgot(?: to)?|couldn'?t|could not|wasn'?t able to|failed to|no time (?:to|for))\b/gi
const BECAUSE_RE = /\b(?:because|'cause|cuz|coz|cause)\b\s*(?:of\s+)?/gi
const AMOUNT_RE = /\b(half an? hour|an? hour and a half|(?:(\d+(?:\.\d+)?)\s*|(an|a|one|two|three|four|five|six|seven|eight|nine|ten|twelve|fifteen|twenty|thirty|forty|fifty|sixty)\s+)([a-z]+)?)\b/gi
const ADDS_RE = /\b(?:more|another|extra|additional)\s*$/i
const CLOCKISH_BEFORE = /\b(?:at|by|before|after|around|until|till|til|from)\s*$/i

export interface Tagged {
  tags: Tag[]
  clauses: Clause[]
  /** The clauses, each led by its id, with every tag marked: `[C1] read 10 pages[N1]`. */
  marked: string
}

export function tagText(text: string, now: Date): Tagged {
  const tags: Tag[] = []
  const taken: [number, number][] = []
  const free = (a: number, b: number) => !taken.some(([x, y]) => a < y && b > x)
  const take = (t: Omit<Tag, "id">, len: number, prefix: string) => {
    if (!free(t.at, t.at + len)) return
    taken.push([t.at, t.at + len])
    tags.push({ ...t, id: `${prefix}${tags.filter((x) => x.kind === t.kind).length + 1}` })
  }

  // Reasons first: everything after "because" to the end of the sentence is the reason, and nothing inside it is a habit.
  for (const m of text.matchAll(BECAUSE_RE)) {
    const at = m.index!
    const end = sentenceEnd(text, at)
    const reason = text.slice(at + m[0].length, end).trim()
    if (reason) take({ kind: "because", raw: text.slice(at, end).trim(), at, reason }, end - at, "B")
  }
  for (const m of text.matchAll(DAY_RE)) {
    const day = resolveDay(m[0].replace(/^on /i, ""), now) ?? (/^tonight$/i.test(m[0]) ? dateKey(now) : null)
    if (day) take({ kind: "day", raw: m[0], at: m.index!, day }, m[0].length, "D")
  }
  for (const m of text.matchAll(NEG_RE)) take({ kind: "neg", raw: m[0], at: m.index! }, m[0].length, "X")
  for (const m of text.matchAll(AMOUNT_RE)) {
    const at = m.index!
    const raw = m[0]
    const after = text.slice(at + raw.length)
    const before = text.slice(Math.max(0, at - 24), at)
    if (/^\s*(?::\d|am\b|pm\b|a\.m|p\.m)/i.test(after) || /[:\d]$/.test(before)) continue
    let amount: number
    let unit = ""
    // A stop word after a number ("40 and") is not a unit.
    const unitWord = m[4] && !STOP.has(m[4].toLowerCase()) ? m[4] : undefined
    if (/^half an? hour$/i.test(raw)) [amount, unit] = [30, "min"]
    else if (/hour and a half$/i.test(raw)) [amount, unit] = [90, "min"]
    else {
      const word = m[2] ?? m[3]!
      const n = Number(m[2]) || NUM_WORDS[word.toLowerCase()]
      if (!n) continue
      const u = unitWord ? unitOf(unitWord) : null
      // A word number counts only with a unit ("an hour", "two glasses"); a bare digit near "at" is a clock.
      if (!u && (!m[2] || CLOCKISH_BEFORE.test(before))) continue
      amount = n * (u?.[1] ?? 1)
      unit = u?.[0] ?? ""
      if (!u && unitWord) {
        // "10 pushups": a unit we do not know is still a unit, singular.
        unit = unitWord.toLowerCase().replace(/e?s$/, "")
      }
    }
    const shown = m[4] && !unitWord ? raw.slice(0, raw.length - m[4].length).trimEnd() : raw
    take({ kind: "amount", raw: shown, at, amount, unit, adds: ADDS_RE.test(before) }, shown.length, "N")
  }
  tags.sort((a, b) => a.at - b.at)
  renumber(tags)

  const clauses = cut(text, tags)
  return { tags, clauses, marked: clauses.map((c) => `[${c.id}] ${markRange(text, c.at, c.at + c.text.length, tags)}`).join(" ") }
}

function sentenceEnd(text: string, from: number): number {
  const m = /[.!?\n]/.exec(text.slice(from))
  return m ? from + m.index : text.length
}

function renumber(tags: Tag[]) {
  const n: Record<string, number> = {}
  const prefix = { amount: "N", day: "D", neg: "X", because: "B" } as const
  for (const t of tags) t.id = `${prefix[t.kind]}${(n[t.kind] = (n[t.kind] ?? 0) + 1)}`
}

const SPLIT = /\s*(?:[,;:]|\s[-–—]\s|\band then\b|\bthen\b|\band\b|\balso\b)\s*/gi

function cut(text: string, tags: Tag[]): Clause[] {
  const out: Clause[] = []
  let day: string | undefined
  const sentences = [...text.matchAll(/[^.!?\n]+[.!?]*/g)]
  for (const s of sentences) {
    const sAt = s.index!
    const sentence = s[0].trim()
    const reason = tags.find((t) => t.kind === "because" && t.at >= sAt && t.at < sAt + s[0].length)
    const headEnd = reason ? reason.at : sAt + s[0].length
    const head = text.slice(sAt, headEnd)
    const pieces: [number, number][] = []
    let last = 0
    for (const m of head.matchAll(SPLIT)) {
      pieces.push([last, m.index!])
      last = m.index! + m[0].length
    }
    pieces.push([last, head.length])
    const kept = pieces.map(([a, b]) => [sAt + a, sAt + b] as [number, number]).filter(([a, b]) => text.slice(a, b).trim())
    kept.forEach(([a, b], i) => {
      const end = i === kept.length - 1 && reason ? reason.at + reason.raw.length : b
      const lead = text.slice(a, end).length - text.slice(a, end).trimStart().length
      const at = a + lead
      const body = text.slice(at, end).trimEnd().replace(/[.!?]+$/, "")
      const inside = tags.filter((t) => t.at >= at && t.at < at + body.length)
      const own = inside.find((t) => t.kind === "day")
      if (own) day = own.day
      const negated = inside.some((t) => t.kind === "neg" && (!reason || t.at < reason.at))
      out.push({ id: `C${out.length + 1}`, text: body, at, tags: inside.map((t) => t.id), negated, day, sentence })
    })
  }
  return out
}

function markRange(text: string, from: number, to: number, tags: Tag[]): string {
  let out = ""
  let pos = from
  for (const t of tags) {
    if (t.at < from || t.at >= to) continue
    const end = Math.min(to, t.at + t.raw.length)
    out += text.slice(pos, end) + `[${t.id}]`
    pos = end
  }
  return out + text.slice(pos, to)
}
