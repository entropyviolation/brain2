/**
 * lib/bim-flow/texts.ts — The person's phone texts as BIM input and as evidence
 *
 * The Mac hub keeps every iMessage/SMS body in `data/phone-sync/messages.jsonl`.
 * This file turns those rows into two things. Input: lines a Log flow can read
 * like BIM text (what I sent, or the whole conversation, or one burst of it).
 * Evidence: counts made in code (when I was sending, the quiet gaps, who I
 * talked to) for a `retrieve` node of kind `texts`. Pure; the loader is
 * `texts-client.ts`.
 */

import { contentWords } from "./vault-search"

/** One text, shaped for the lab. `at` is ISO. */
export interface TextRow {
  at: string
  dir: "in" | "out"
  /** The other side as a name when the vault knows them, else the formatted number. */
  who: string
  /** Thread id. A group chat has many people and one thread. */
  thread: string
  group: boolean
  text: string
}

/** The compact row `/api/phone-texts` sends. */
export interface RawText {
  at: number
  dir: "in" | "out"
  /** Handle of the other side (the sender, for an incoming group message). */
  h: string
  th: string
  g?: 1
  t: string
}

export type TextScope = "mine" | "all" | "bursts"
export const TEXT_SCOPE_LABEL: Record<TextScope, string> = { mine: "What I sent", all: "Both sides", bursts: "Conversations" }
export const TEXT_SCOPE_HINT: Record<TextScope, string> = {
  mine: "Only my texts, each as a line: the closest thing to a BIM message.",
  all: "Every text, in order, each line says who.",
  bursts: "Texts close in time in one thread become one input, so the model sees both sides.",
}

const hhmm = (iso: string) => {
  const d = new Date(iso)
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`
}
export const localDay = (iso: string) => {
  const d = new Date(iso)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
}

/** A body worth reading: not empty, not a bare link, not the object-replacement char of an attachment. */
export function readableText(body: string): string {
  const t = body.replace(/￼/g, "").replace(/\s+/g, " ").trim()
  if (!t) return ""
  if (/^(https?:\/\/\S+)$/i.test(t)) return ""
  return t
}

export function toRows(raw: RawText[], nameOf: (handle: string) => string): TextRow[] {
  const rows: TextRow[] = []
  for (const r of raw) {
    const text = readableText(r.t)
    if (!text) continue
    rows.push({ at: new Date(r.at).toISOString(), dir: r.dir, who: nameOf(r.h), thread: r.th, group: !!r.g, text })
  }
  return rows.sort((a, b) => a.at.localeCompare(b.at))
}

/** Bursts: texts in one thread with no gap longer than `gapMin`. */
export function bursts(rows: TextRow[], gapMin = 30): TextRow[][] {
  const open = new Map<string, TextRow[]>()
  const done: TextRow[][] = []
  for (const r of rows) {
    const cur = open.get(r.thread)
    if (cur && (new Date(r.at).getTime() - new Date(cur.at(-1)!.at).getTime()) / 60_000 <= gapMin) cur.push(r)
    else {
      if (cur) done.push(cur)
      open.set(r.thread, [r])
    }
  }
  done.push(...open.values())
  return done.sort((a, b) => a[0]!.at.localeCompare(b[0]!.at))
}

const tag = (r: TextRow) => (r.dir === "out" ? "me" : r.who)
const MAX_LINE = 220
const clip = (s: string, n = MAX_LINE) => (s.length > n ? `${s.slice(0, n)}…` : s)

export interface FeedLine { id: string; text: string; at: string }

/**
 * The lines a flow reads. `mine` keeps only sent texts and names the person
 * after the text ("on my way (to Mom)"), `all` prefixes each line with the
 * speaker, `bursts` joins each conversation burst into one multi-line input
 * stamped at its last text (the same shape `group()` makes for BIM messages).
 */
export function textsToFeed(rows: TextRow[], scope: TextScope, opts: { gapMin?: number } = {}): FeedLine[] {
  if (scope === "mine") {
    return rows
      .filter((r) => r.dir === "out")
      .map((r, i) => ({ id: `tx-${i}-${r.at}`, at: r.at, text: `${clip(r.text)}${r.group ? " (group chat)" : ` (to ${r.who})`}` }))
  }
  if (scope === "all") return rows.map((r, i) => ({ id: `tx-${i}-${r.at}`, at: r.at, text: `${tag(r)}: ${clip(r.text)}` }))
  return bursts(rows, opts.gapMin ?? 30).map((b, i) => {
    const who = b[0]!.group ? "group chat" : b[0]!.who
    const body = b.map((r) => `${hhmm(r.at)} ${tag(r)}: ${clip(r.text, 160)}`).join("\n")
    return { id: `tx-b${i}-${b[0]!.at}`, at: b.at(-1)!.at, text: `Conversation with ${who}\n${body}`.slice(-2400) }
  })
}

/** Rows as the `retrieve` node and the Preview sheet show them. */
export function textEvidenceRow(r: TextRow): { when: string; source: string; text: string } {
  return { when: `${localDay(r.at)} ${hhmm(r.at)}`, source: r.dir === "out" ? `text to ${r.who}` : `text from ${r.who}`, text: clip(r.text, 170) }
}

const clock = (min: number) => `${String(Math.floor(min / 60)).padStart(2, "0")}:${String(min % 60).padStart(2, "0")}`
const minOfDay = (iso: string) => {
  const d = new Date(iso)
  return d.getHours() * 60 + d.getMinutes()
}

export interface TextDigest {
  total: number
  sent: number
  received: number
  firstSent?: string
  lastSent?: string
  /** Hours (0–23) with at least one text I sent. */
  sendingHours: number[]
  /** Stretches of 90+ minutes with no text from me, inside the span I was sending. */
  quiet: { from: string; to: string; min: number }[]
  people: { who: string; sent: number; received: number }[]
  /** Median minutes from a text in to my next text out in the same thread, under 3 hours. */
  replyMedianMin?: number
}

/** Counts a model should never have to make. One day, or any list of rows. */
export function digest(rows: TextRow[]): TextDigest {
  const mine = rows.filter((r) => r.dir === "out")
  const hours = new Set(mine.map((r) => new Date(r.at).getHours()))
  const quiet: TextDigest["quiet"] = []
  for (let i = 1; i < mine.length; i++) {
    const a = minOfDay(mine[i - 1]!.at)
    const b = minOfDay(mine[i]!.at)
    if (localDay(mine[i]!.at) === localDay(mine[i - 1]!.at) && b - a >= 90) quiet.push({ from: clock(a), to: clock(b), min: b - a })
  }
  const per = new Map<string, { who: string; sent: number; received: number }>()
  for (const r of rows) {
    const k = r.group ? `group:${r.thread}` : r.who
    const p = per.get(k) ?? { who: r.group ? "a group chat" : r.who, sent: 0, received: 0 }
    if (r.dir === "out") p.sent++
    else p.received++
    per.set(k, p)
  }
  const waits: number[] = []
  const lastIn = new Map<string, number>()
  for (const r of rows) {
    const t = new Date(r.at).getTime()
    if (r.dir === "in") lastIn.set(r.thread, t)
    else if (lastIn.has(r.thread)) {
      const w = (t - lastIn.get(r.thread)!) / 60_000
      if (w < 180) waits.push(w)
      lastIn.delete(r.thread)
    }
  }
  waits.sort((a, b) => a - b)
  return {
    total: rows.length,
    sent: mine.length,
    received: rows.length - mine.length,
    firstSent: mine[0] ? hhmm(mine[0].at) : undefined,
    lastSent: mine.at(-1) ? hhmm(mine.at(-1)!.at) : undefined,
    sendingHours: [...hours].sort((a, b) => a - b),
    quiet,
    people: [...per.values()].sort((a, b) => b.sent + b.received - (a.sent + a.received)).slice(0, 8),
    replyMedianMin: waits.length ? Math.round(waits[Math.floor(waits.length / 2)]!) : undefined,
  }
}

export function digestFacts(rows: TextRow[], label = "Texts"): string[] {
  if (rows.length === 0) return []
  const d = digest(rows)
  const days = new Set(rows.map((r) => localDay(r.at)))
  const facts = [`${label}: ${d.total} texts on ${days.size} day${days.size === 1 ? "" : "s"} (${d.sent} I sent, ${d.received} received).`]
  if (d.firstSent) facts.push(`${label}: first text I sent ${d.firstSent}, last ${d.lastSent}${days.size > 1 ? " (across all days)" : ""}.`)
  if (d.sendingHours.length) facts.push(`${label}: hours I sent something: ${d.sendingHours.map((h) => `${String(h).padStart(2, "0")}h`).join(" ")}.`)
  if (d.quiet.length && days.size === 1) facts.push(`${label}: no text from me for 90+ min: ${d.quiet.slice(0, 5).map((q) => `${q.from}–${q.to} (${q.min} min)`).join(", ")}.`)
  if (d.people.length) facts.push(`${label}: who: ${d.people.map((p) => `${p.who} ${p.sent}↑ ${p.received}↓`).join(", ")}.`)
  if (d.replyMedianMin != null) facts.push(`${label}: I usually answer within ${d.replyMedianMin} min (median).`)
  return facts
}

/** Filter by subject words and by a named person's names. Terms match the text; names match `who`. */
export function filterTexts(rows: TextRow[], terms: string[], names: string[]): TextRow[] {
  const lower = names.map((n) => n.toLowerCase())
  return rows.filter((r) => {
    if (lower.length && !lower.some((n) => r.who.toLowerCase().split(/[^\p{L}\p{N}]+/u).includes(n))) return false
    if (terms.length) {
      const words = contentWords(r.text)
      if (!terms.some((t) => words.some((w) => w.startsWith(t) || t.startsWith(w)))) return false
    }
    return true
  })
}
