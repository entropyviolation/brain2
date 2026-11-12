/**
 * lib/ingest/bim-texts.ts — The Texts BIMBY: questions about your phone texts, answered from the texts
 *
 * "What was Shelby talking about in her last text to me?" The Ask flow could not answer this: it reads
 * texts only as a day's digest. Here code finds the person in People I Know, loads the hub's texts
 * (`/api/phone-texts`, `texts-client.ts`), takes that person's last text and the ones sent with it,
 * and a model says in a sentence or two what they were about, from those lines only. The texts are
 * quoted word for word only when asked ("exactly", "word for word", "quote"); otherwise they sit in
 * the evidence fold, so the answer can be checked. Nothing is filed.
 */

import { bursts, type TextRow } from "@/lib/bim-flow/texts"
import type { ModelCall } from "@/lib/bim-flow/ollama"
import type { VaultSnapshot } from "@/lib/bim-flow/vault-search"

/** Days of texts the hub will send (`TEXTS_MAX_DAYS` in `scripts/persist-api.mjs`). */
export const TEXTS_ASK_DAYS = 60
/** Texts sent within this many minutes of each other are one message. */
const RUN_GAP_MIN = 30
const MAX_QUOTES = 10

type Person = NonNullable<VaultSnapshot["people"]>[number]

export interface TextQuestion {
  /** in: their text to me. out: my text to them. both: the last exchange. */
  dir: "in" | "out" | "both"
  /** People in the vault the line names. One is the normal case. */
  people: Person[]
  /** The person asked for the exact words ("word for word", "exactly", "quote", "read me"). */
  verbatim: boolean
}

const VERBATIM = /\b(verbatim|word for word|exact(ly)?|exact words|quote|quoted|read (it|them|me)|show me|full text|what did .{1,40} (say|write|text) exactly)\b/i

const TEXT_WORD = /\b(texts?|texted|texting|messages?|messaged|messaging|imessages?|sms|dms?|dm'?d)\b/i
const QUESTION_LEAD =
  /^(what|whats|what's|when|did|does|do|has|have|had|how|was|were|is|who|why|show|read|tell me|give me|remind me what|can you|could you)\b/i

const words = (s: string) => s.toLowerCase().replace(/[’']/g, "'").split(/[^\p{L}\p{N}']+/u).filter(Boolean)

/** Cheap first look, before any snapshot is built: the line says text or message. */
export const mentionsTexts = (text: string): boolean => TEXT_WORD.test(text)

/** People whose name (or nickname) appears in the line as whole words. Longest name wins a tie. */
export function namedPeople(people: Person[], text: string): Person[] {
  const line = ` ${words(text).map((w) => w.replace(/'s$/, "")).join(" ")} `
  const hits: { p: Person; len: number }[] = []
  for (const p of people) {
    let best = 0
    for (const n of p.names) {
      const key = words(n).join(" ")
      if (key.length >= 2 && line.includes(` ${key} `)) best = Math.max(best, key.length)
    }
    if (best) hits.push({ p, len: best })
  }
  if (!hits.length) return []
  const top = Math.max(...hits.map((h) => h.len))
  // "Shelby Ross" beats a second person called "Shelby"; two equal names stay ambiguous.
  return hits.filter((h) => h.len === top).map((h) => h.p)
}

/** A question about texts that names someone. Null for anything else, including commands ("text Shelby back"). */
export function parseTextQuestion(text: string, people: Person[]): TextQuestion | null {
  const t = text.trim()
  if (!t || t.includes("\n") || !TEXT_WORD.test(t)) return null
  if (!/\?\s*$/.test(t) && !QUESTION_LEAD.test(t)) return null
  const named = namedPeople(people, t)
  if (!named.length) return null
  const lower = t.toLowerCase()
  const both = /\b(conversation|convo|thread|exchange|texts? with|texting with|messages? with|talking with)\b/.test(lower)
  const out =
    /\b(i|i've|ive)\s+(last\s+|just\s+)?(text|texted|sent|send|messaged|wrote|write|said|say)\b/.test(lower) ||
    /\bmy\s+(last|latest|most recent|recent)?\s*(text|message)s?\b/.test(lower)
  return { dir: both ? "both" : out ? "out" : "in", people: named, verbatim: VERBATIM.test(t) }
}

const displayName = (p: Person) => p.names[0] ?? p.title

export interface TextsPick {
  /** The quoted texts, oldest first. */
  quoted: TextRow[]
  /** Texts just before them in the same thread, for the model only. */
  context: TextRow[]
}

/**
 * The last text in the asked direction and the run it belongs to: their texts sent back to back
 * (no gap over 30 min, nobody else in between). `both` takes the thread's last burst, both sides.
 * Direct threads first; a group chat counts only when there is no direct text.
 */
export function pickLastTexts(rows: TextRow[], who: string, dir: TextQuestion["dir"]): TextsPick | null {
  const theirs = rows.filter((r) => r.who === who)
  const pool = theirs.some((r) => !r.group) ? theirs.filter((r) => !r.group) : theirs
  const target = [...pool].reverse().find((r) => dir === "both" || r.dir === dir)
  if (!target) return null
  const thread = rows.filter((r) => r.thread === target.thread)
  if (dir === "both") {
    const last = bursts(thread, RUN_GAP_MIN).at(-1) ?? [target]
    const start = thread.indexOf(last[0]!)
    return { quoted: last.slice(-MAX_QUOTES), context: thread.slice(Math.max(0, start - 4), start) }
  }
  const end = thread.indexOf(target)
  let start = end
  while (start > 0) {
    const prev = thread[start - 1]!
    const same = prev.dir === target.dir && (target.dir === "out" || prev.who === who)
    const gap = (new Date(thread[start]!.at).getTime() - new Date(prev.at).getTime()) / 60_000
    if (!same || gap > RUN_GAP_MIN || end - start + 1 >= MAX_QUOTES) break
    start--
  }
  const sinceMs = new Date(thread[start]!.at).getTime() - 6 * 60 * 60_000
  const context = thread.slice(Math.max(0, start - 6), start).filter((r) => new Date(r.at).getTime() >= sinceMs)
  return { quoted: thread.slice(start, end + 1), context }
}

const clock = (d: Date) => d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })
const dayKey = (d: Date) => `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`

/** "today at 9:42 PM", "yesterday at 8:05 AM", "Mon, Nov 9 at 1:10 PM". */
export function whenSaid(iso: string, now: Date): string {
  const d = new Date(iso)
  const y = new Date(now)
  y.setDate(y.getDate() - 1)
  if (dayKey(d) === dayKey(now)) return `today at ${clock(d)}`
  if (dayKey(d) === dayKey(y)) return `yesterday at ${clock(d)}`
  const opts: Intl.DateTimeFormatOptions = { weekday: "short", month: "short", day: "numeric", ...(d.getFullYear() !== now.getFullYear() ? { year: "numeric" } : {}) }
  return `${d.toLocaleDateString("en-US", opts)} at ${clock(d)}`
}

const speaker = (r: TextRow) => (r.dir === "out" ? "You" : r.who)

const SUMMARY_SYSTEM =
  "You tell a person what a text conversation was about, from the texts given and nothing else. " +
  "QUOTED are the texts the person asked about; EARLIER is context only. " +
  "Answer in one or two short plain sentences: what the QUOTED texts were about. Do not invent details, plans or feelings the texts do not say. " +
  "Call the person 'you'. Refer to everyone else by name. Never use he, she, him, her, his or hers. No quotes, no lists, no emoji. JSON only."

const SUMMARY_SCHEMA = {
  type: "object",
  properties: { about: { type: "string", maxLength: 400 } },
  required: ["about"],
}

export interface TextsAnswer {
  text: string
  route: string
  evidence: string[]
  /** Tap answers: "exact words" asks again for the texts word for word. */
  choices?: { label: string; text: string }[]
}

export interface TextsDeps {
  snap: Pick<VaultSnapshot, "people" | "secretHandles">
  /** Recent texts with names, or null when the hub cannot be reached. */
  load: (people: VaultSnapshot["people"], hideHandles: string[] | undefined) => Promise<TextRow[] | null>
  /** A model to say what the texts were about, asked for only once a text question is found. None: a short line and an "exact words" key. */
  model?: () => Promise<{ call: ModelCall; name: string } | null>
}

/** Answer a text question, or null when the line is not one. Never throws. */
export async function answerTextQuestion(text: string, now: Date, deps: TextsDeps): Promise<TextsAnswer | null> {
  const people = deps.snap.people ?? []
  const q = parseTextQuestion(text, people)
  if (!q) return null
  const t0 = Date.now()
  const chip = (models: string[] = []) => ["TEXTS", "code", ...models, `${((Date.now() - t0) / 1000).toFixed(1)}s`].join(" · ")
  if (q.people.length > 1) {
    return { text: `Which one: ${q.people.map(displayName).join(" or ")}? Ask again with the full name.`, route: chip(), evidence: [] }
  }
  const person = q.people[0]!
  const name = displayName(person)
  if (!person.handles?.length) {
    return {
      text: `${name} has no phone number or email saved in People I Know, so I can't tell which texts are from ${name}. Add one to ${name}'s person item and ask again.`,
      route: chip(),
      evidence: [],
    }
  }
  const rows = await deps.load(deps.snap.people, deps.snap.secretHandles).catch(() => null)
  if (!rows) return { text: "I can't reach your texts right now. They come from the Mac hub; is it running?", route: chip(), evidence: [] }
  const pick = pickLastTexts(rows, name, q.dir)
  if (!pick) {
    const what = q.dir === "out" ? `texts from you to ${name}` : q.dir === "both" ? `texts with ${name}` : `texts from ${name}`
    return { text: `I don't see any ${what} in the last ${TEXTS_ASK_DAYS} days.`, route: chip(), evidence: [] }
  }

  const first = pick.quoted[0]!
  const n = pick.quoted.length
  const plural = n > 1 ? "s" : ""
  const head =
    q.dir === "out"
      ? `Your last text${plural} to ${name}, ${whenSaid(first.at, now)}`
      : q.dir === "both"
        ? `Your last exchange with ${name}, ${whenSaid(first.at, now)}`
        : `${name}'s last text${plural} to you, ${whenSaid(first.at, now)}${first.group ? " (in a group chat)" : ""}`
  const quotes = pick.quoted.map((r) => (q.dir === "both" ? `${speaker(r)}: “${r.text}”` : `“${r.text}”`)).join("\n")
  const evidence = [...pick.context, ...pick.quoted].map((r) => `${whenSaid(r.at, now)} · ${r.dir === "out" ? `text to ${r.who}` : `text from ${r.who}`} · ${r.text}`)
  if (q.verbatim) return { text: `${head}:\n${quotes}`, route: chip(), evidence }

  let about = ""
  const models: string[] = []
  const model = deps.model ? await deps.model().catch(() => null) : null
  if (model) {
    const fmt = (r: TextRow) => `${speaker(r)}: ${r.text}`
    const user = [
      pick.context.length ? `EARLIER:\n${pick.context.map(fmt).join("\n")}` : "",
      `QUOTED:\n${pick.quoted.map(fmt).join("\n")}`,
      `QUESTION: ${text}`,
    ].filter(Boolean).join("\n\n")
    try {
      const out = (await model.call({ model: model.name, system: SUMMARY_SYSTEM, user, schema: SUMMARY_SCHEMA, maxTokens: 160 })) as { about?: string }
      about = String(out?.about ?? "").trim()
      models.push(model.name)
    } catch {
      about = ""
    }
  }
  const exact = { label: "exact words", text: q.dir === "out" ? `what did I text ${name} last, word for word?` : q.dir === "both" ? `show my last texts with ${name} word for word` : `what did ${name} text me last, word for word?` }
  const reply = about
    ? `${about}\n\n(${head}, ${n} text${plural}.)`
    : `${head}, ${n} text${plural}. I can't reach the models to sum ${n > 1 ? "them" : "it"} up; tap exact words to read ${n > 1 ? "them" : "it"}.`
  return { text: reply, route: chip(models), evidence, choices: [exact] }
}
