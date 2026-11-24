/**
 * lib/ingest/bim-owed.ts — The Text-back BIMBY: who is waiting on a text from you (pure)
 *
 * "Who do I need to text back?" is answered in code from two places: your phone texts (a direct
 * thread whose last text is theirs, not a reaction or a sign-off) and your open to-dos that say so
 * ("text ruggles back", "reply to Linda"). One person in both is one row. Each row names the
 * person, their number or email, how long they have waited, and their last words.
 * After that list, "oh I already texted ruggles" (or "replied to matt at 3pm") closes the matching
 * to-do with that time, and takes the person off the list until they text again.
 * Store reads and writes are in `bim-chat.ts` (`tryOwed`); this file only reads words and rows.
 */

import { parseClock } from "./bim-facts"
import type { TextRow } from "@/lib/bim-flow/texts"

/** Texts older than this are not "waiting": a thread left that long was let go. */
export const OWED_DAYS = 14

const ASK =
  /\b(?:who\s+(?:do|should|must)\s+i\s+(?:need\s+to\s+|have\s+to\s+|still\s+)?(?:text|reply|respond|write|get back)|who(?:'s|\s+is|\s+are)?\s+(?:still\s+)?waiting\s+on\s+(?:a\s+)?(?:text|reply|message|me)|who\s+(?:haven'?t|have\s+i\s+not|didn'?t)\s+i?\s*(?:texted|replied|responded|written)|do\s+i\s+owe\s+(?:anyone|anybody|someone)\s+(?:a\s+)?(?:text|reply|message)|(?:texts?|messages?)\s+(?:i\s+)?(?:owe|need\s+to\s+(?:answer|reply\s+to|return))|who\s+am\s+i\s+(?:ignoring|leaving\s+on\s+read)|unanswered\s+texts?)\b/i

/** "who do I need to text back?" and the like. */
export const parseOwedAsk = (text: string): boolean => ASK.test(text.trim())

/** A reaction or sign-off is not a text that waits on an answer. */
const NO_REPLY_NEEDED =
  /^(?:(?:liked|loved|laughed at|emphasized|disliked|questioned|reacted\s+\S+\s+to)\s+[“"].*|ok(?:ay)?|k+|kk|lol+|lmao+|haha+|ha|ty|thx|thanks?(?: you)?|np|no problem|cool|nice|yes|yep|yup|sure|sounds good|perfect|love you|ily|night|goodnight|gn|bye|see you|see ya|ttyl|[\p{Emoji}\s]+)[.!]*$/iu

export interface OwedTodo {
  id: string
  title: string
  /** The name the to-do is about, lowercased ("ruggles"). */
  name: string
}

/** "Text ruggles back", "reply to Linda", "get back to matt about saturday", "call mom back". */
export function todoName(title: string): string | null {
  const m = /^(?:text|txt|message|msg|dm|reply\s+to|respond\s+to|get\s+back\s+to|write\s+back\s+to|call|email|answer)\s+(.+?)(?:\s+back)?(?:\s+(?:about|re|abt|regarding|asap|today|tonight|tomorrow)\b.*)?[.!]*$/i.exec(title.trim())
  if (!m) return null
  // "text back" alone, or "call the dentist" with no back/reply word: only a reply verb or "back" counts.
  if (!/\bback\b|^(?:reply|respond|get back|write back|answer)/i.test(title)) return null
  const name = m[1]!.replace(/^(?:to\s+)?/, "").trim().toLowerCase()
  return name && name.split(/\s+/).length <= 3 ? name : null
}

export interface OwedRow {
  /** The name to show. */
  who: string
  /** Formatted number or email, when the texts give it. */
  contact?: string
  /** ISO of their last text, when a text is waiting. */
  lastAt?: string
  lastText?: string
  /** Their texts in a row since your last one. */
  unanswered: number
  question: boolean
  todos: OwedTodo[]
}

const firstWord = (s: string) => s.trim().toLowerCase().split(/\s+/)[0] ?? ""

/** Same person when the full names match, or the to-do's one word is the person's first name. */
export function samePerson(a: string, b: string): boolean {
  const x = a.trim().toLowerCase()
  const y = b.trim().toLowerCase()
  if (!x || !y) return false
  if (x === y) return true
  return (!x.includes(" ") || !y.includes(" ")) && firstWord(x) === firstWord(y) && firstWord(x).length >= 3
}

/**
 * People waiting on you: direct threads whose last text is theirs (within `OWED_DAYS`, not a
 * reaction or sign-off, not someone you said you answered since), joined with reply to-dos.
 * Questions first, then the longest wait.
 */
export function owedRows(
  rows: TextRow[] | null,
  todos: { id: string; title: string }[],
  now: Date,
  answered: Record<string, string> = {},
  formatContact: (handle: string) => string = (h) => h,
): OwedRow[] {
  const out: OwedRow[] = []
  const from = now.getTime() - OWED_DAYS * 86_400_000
  const threads = new Map<string, TextRow[]>()
  for (const r of rows ?? []) {
    if (r.group) continue
    const list = threads.get(r.thread) ?? []
    list.push(r)
    threads.set(r.thread, list)
  }
  for (const list of threads.values()) {
    const last = list.at(-1)!
    if (last.dir !== "in" || Date.parse(last.at) < from) continue
    let i = list.length - 1
    while (i >= 0 && list[i]!.dir === "in") i--
    const theirs = list.slice(i + 1).filter((r) => !NO_REPLY_NEEDED.test(r.text.trim()))
    if (!theirs.length) continue
    const said = answered[last.who.toLowerCase()]
    if (said && said >= last.at) continue
    const newest = theirs.at(-1)!
    out.push({
      who: last.who,
      ...(last.handle ? { contact: formatContact(last.handle) } : {}),
      lastAt: newest.at,
      lastText: newest.text,
      unanswered: theirs.length,
      question: theirs.some((r) => /\?\s*$/.test(r.text)),
      todos: [],
    })
  }
  for (const t of todos) {
    const name = todoName(t.title)
    if (!name) continue
    const todo = { id: t.id, title: t.title, name }
    const row = out.find((r) => samePerson(r.who, name))
    if (row) row.todos.push(todo)
    else out.push({ who: name.replace(/\b[a-z]/g, (c) => c.toUpperCase()), unanswered: 0, question: false, todos: [todo] })
  }
  return out.sort((a, b) => Number(b.question) - Number(a.question) || (a.lastAt ?? "9").localeCompare(b.lastAt ?? "9"))
}

function waited(iso: string, now: Date): string {
  const min = Math.max(0, Math.round((now.getTime() - Date.parse(iso)) / 60_000))
  if (min < 60) return `${min} min`
  const h = Math.round(min / 60)
  if (h < 36) return `${h} hour${h === 1 ? "" : "s"}`
  const d = Math.round(h / 24)
  return `${d} day${d === 1 ? "" : "s"}`
}

const listNames = (names: string[]) => (names.length <= 1 ? names.join("") : `${names.slice(0, -1).join(", ")}${names.length > 2 ? "," : ""} and ${names.at(-1)}`)

export function owedText(rows: OwedRow[], now: Date, textsReached: boolean): string {
  if (!rows.length) {
    return textsReached
      ? `Nobody is waiting on a text from you in the last ${OWED_DAYS} days, and no to-do says to text someone back.`
      : "No to-do says to text someone back. I can't reach your texts right now (they come from the Mac hub), so I can't check those."
  }
  const lines = rows.map((r, i) => {
    const bits = [`${i + 1}. ${r.who}`]
    if (r.contact) bits.push(r.contact)
    if (r.lastAt) bits.push(`waiting ${waited(r.lastAt, now)}${r.unanswered > 1 ? ` (${r.unanswered} texts)` : ""}`)
    if (r.lastText) bits.push(`“${r.lastText.length > 90 ? `${r.lastText.slice(0, 87)}…` : r.lastText}”`)
    if (r.todos.length) bits.push(`to-do: ${r.todos.map((t) => t.title).join("; ")}`)
    else if (!r.lastAt) bits.push("to-do only")
    return bits.join(" · ")
  })
  const tail = `Say “already texted ${rows[0]!.who.split(" ")[0]}” (add when, like “at 3pm”) and I'll check off the to-do and take them off this list.`
  return `You seem to need to text back ${listNames(rows.map((r) => r.who.split(" ")[0]!))}.\n${lines.join("\n")}${textsReached ? "" : "\n(Texts not reachable: this is from your to-dos only.)"}\n\n${tail}`
}

export interface TextedBack {
  /** Names as said, lowercased. */
  names: string[]
  /** When it happened, when said; else the send time. */
  at: Date
  /** True when the time was said. */
  told: boolean
  /** "texted them all", "answered everyone": every name on the last list. */
  all: boolean
}

const DONE_VERB = String.raw`(?:already\s+|just\s+|finally\s+)?(?:texted|txted|replied\s+to|responded\s+to|messaged|got\s+back\s+to|answered|wrote\s+(?:back\s+)?to|called|dmed|dm'?d)`

/** "oh I already texted ruggles", "replied to matt and linda at 3pm", "texted ruggles back this morning". */
export function parseTextedBack(text: string, now: Date): TextedBack | null {
  const t = text.trim().replace(/^(?:oh|ok(?:ay)?|yeah|yes|so|um|btw|also)[,.!]?\s+/i, "")
  const m = new RegExp(String.raw`^(?:i(?:'ve|\s+have)?\s+)?${DONE_VERB}\s+(.+?)[.!]*$`, "i").exec(t)
  if (!m) return null
  let rest = m[1]!
  let at = now
  let told = false
  const clock = /\s+(?:at|around|about)\s+(\d{1,2}(?::\d{2})?\s*(?:am|pm)?|noon)\b.*$/i.exec(rest)
  if (clock) {
    const c = parseClock(`at ${clock[1]} today`, now)
    if (c) {
      at = c.getTime() > now.getTime() ? new Date(c.getTime() - 86_400_000) : c
      told = true
    }
    rest = rest.slice(0, clock.index)
  }
  const ago = /\s+(\d+|an?|one|two|three)\s+(hours?|hrs?|minutes?|mins?)\s+ago\b.*$/i.exec(rest)
  if (ago) {
    const n = /^\d+$/.test(ago[1]!) ? Number(ago[1]) : ago[1]!.toLowerCase() === "two" ? 2 : ago[1]!.toLowerCase() === "three" ? 3 : 1
    at = new Date(now.getTime() - n * (/^h/i.test(ago[2]!) ? 3_600_000 : 60_000))
    told = true
    rest = rest.slice(0, ago.index)
  }
  const dayWord = /\s+(this morning|last night|yesterday|earlier(?: today)?|today|already)\b.*$/i.exec(rest)
  if (dayWord) {
    const w = dayWord[1]!.toLowerCase()
    if (w === "this morning") (at = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 9)), (told = true)
    else if (w === "last night") (at = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1, 21)), (told = true)
    else if (w === "yesterday") (at = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1, 12)), (told = true)
    if (at.getTime() > now.getTime()) at = now
    rest = rest.slice(0, dayWord.index)
  }
  rest = rest.replace(/\s+back\b/i, "").replace(/\s+(?:or whatever|lol|already)$/i, "")
  if (/^(?:them(?:\s+all)?|all\s+of\s+them|everyone|everybody|all)$/i.test(rest.trim())) return { names: [], at, told, all: true }
  const names = rest
    .split(/\s*(?:,|\band\b|&|\/)\s*/i)
    .map((n) => n.trim().toLowerCase().replace(/^(?:to\s+)/, ""))
    .filter((n) => n && n.split(/\s+/).length <= 3 && !/\b(?:him|her|them|it|everyone|people)\b/.test(n))
  return names.length ? { names, at, told, all: false } : null
}
