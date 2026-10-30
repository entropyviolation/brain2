/**
 * lib/bim-flow/retrieve.ts — Pull evidence about the person out of the vault, in code
 *
 * No model reads the vault here. A question first becomes words (the subject
 * and related terms). This file finds the rows that match them, counts what
 * can be counted (how many, first, last, minutes, most repeated words), and
 * hands an `answer` node a short, dated list. A small model is bad at
 * counting and at scanning thousands of rows, and good at reading twelve
 * lines. So code does the first two and the model does the third.
 */

import { contentWords, type HistoryEntry, type VaultSnapshot } from "./vault-search"
import { sleepFact, sleepOffsets } from "./text-sleep"
import { apartRuns, companyRates } from "./text-company"
import { screenFacts } from "./screen-presence"
import { fileFacts } from "./file-activity"
import { digestFacts, filterTexts, textEvidenceRow } from "./texts"
import type { Evidence, EvidenceRow, RetrieveConfig } from "./types"

/** Views that are about the person. Screen time is thousands of rows of app names. */
export const PERSON_SCOPES = ["activity", "location", "mood", "company", "iphone-calls", "iphone-texts"]

export interface RetrieveInput {
  /** The question's own subject words. Empty means "no filter". */
  terms: string[]
  /** Words the model thinks go with the subject. They count a third as much, so they never outrank the subject itself. */
  related?: string[]
  /** A person's name as the question gave it. */
  person?: string
  now: Date
}

/** Ranks `texts` against `query` by meaning. Null when no embedding model answered. */
export type Ranker = (query: string, texts: string[]) => Promise<number[] | null>

interface Row extends EvidenceRow {
  /** Local date, YYYY-MM-DD. */
  date: string
  ms: number
  score: number
}

const dateKey = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
const hhmm = (min: number) => `${String(Math.floor(min / 60)).padStart(2, "0")}:${String(min % 60).padStart(2, "0")}`
const clip = (s: string, n = 170) => (s.length > n ? `${s.slice(0, n)}…` : s)

/** How many of `terms` appear in `text`, allowing a shared stem ("showered" ~ "shower"). */
export function termsMatched(text: string, terms: string[]): number {
  if (terms.length === 0) return 0
  const words = text.toLowerCase().split(/[^\p{L}\p{N}]+/u).filter(Boolean)
  let n = 0
  for (const t of terms) {
    const hit = words.some(
      (w) => w.startsWith(t) || (w.length >= 5 && t.startsWith(w)) || (t.length >= 5 && w.length >= 5 && w.startsWith(t.slice(0, 5))),
    )
    if (hit) n++
  }
  return n
}

function entryRows(snap: VaultSnapshot, scopes: string[], now: Date, days?: number): Row[] {
  const h = snap.history
  if (!h) return []
  const since = days ? dateKey(new Date(now.getTime() - days * 86400_000)) : ""
  const rows: Row[] = []
  for (const e of h.entries) {
    if (!scopes.includes(e.scope) || (since && e.date < since)) continue
    rows.push(entryRow(e, h.scopeNames[e.scope] ?? e.scope))
  }
  return rows
}

function entryRow(e: HistoryEntry, scopeName: string): Row {
  const text = `${e.pen}${e.text && e.text !== e.pen ? ` · ${e.text}` : ""}`
  const ms = new Date(`${e.date}T00:00:00`).getTime() + e.startMin * 60_000
  return { when: `${e.date} ${hhmm(e.startMin)}–${hhmm(e.endMin)}`, source: scopeName, text: clip(text), date: e.date, ms, score: 0 }
}

/** A day note is plain text, or an older JSON wrapper `{"v":1,"entries":[{"text":…}]}`. */
function noteLines(raw: string): string[] {
  let text = raw
  if (raw.trimStart().startsWith("{")) {
    try {
      const parsed = JSON.parse(raw) as { entries?: { text?: string }[] }
      text = (parsed.entries ?? []).map((e) => e.text ?? "").join("\n")
    } catch {}
  }
  return text.split(/\n+/).map((x) => x.trim()).filter(Boolean)
}

function textRows(snap: VaultSnapshot, now: Date, days?: number, withItems = true): Row[] {
  const h = snap.history
  const since = days ? dateKey(new Date(now.getTime() - days * 86400_000)) : ""
  const rows: Row[] = []
  const stamp = (at: string, source: string, text: string) => {
    const d = new Date(at)
    const date = dateKey(d)
    if (since && date < since) return
    rows.push({ when: `${date} ${hhmm(d.getHours() * 60 + d.getMinutes())}`, source, text: clip(text), date, ms: d.getTime(), score: 0 })
  }
  for (const f of h?.feed ?? []) stamp(f.at, "message", f.text)
  for (const l of h?.logs ?? []) stamp(l.at, "log", l.text)
  for (const n of h?.dayNotes ?? []) {
    if (since && n.date < since) continue
    for (const line of noteLines(n.text)) {
      rows.push({ when: n.date, source: "day note", text: clip(line), date: n.date, ms: new Date(`${n.date}T12:00:00`).getTime(), score: 0 })
    }
  }
  if (withItems && !days) {
    for (const it of snap.items) rows.push({ when: "item", source: "item", text: clip(it.title), date: "", ms: 0, score: 0 })
  }
  return rows
}

/**
 * Keep rows matching the subject or its related words. A subject match is worth
 * three related ones, so "Done with shower" outranks a newer row that only
 * mentions "clean". `primary` is the rows that name the subject itself, the ones
 * "most recent" and "how many" must be counted from.
 */
async function rankRows(
  rows: Row[],
  terms: string[],
  related: string[],
  query: string,
  semantic: boolean,
  rank?: Ranker,
): Promise<{ rows: Row[]; primary: Row[]; note?: string }> {
  let note: string | undefined
  if (semantic && rank && rows.length > 0) {
    const pool = (terms.length ? rows.filter((r) => termsMatched(r.text, [...terms, ...related]) > 0) : rows).slice(-400)
    const wide = pool.length >= 20 ? pool : rows.slice(-400)
    const scores = await rank(query, wide.map((r) => r.text))
    if (scores) {
      wide.forEach((r, i) => (r.score = scores[i] ?? 0))
      const kept = wide.filter((r) => r.score > 0.45).sort((a, b) => b.score - a.score)
      return { rows: kept, primary: kept }
    }
    note = "No embedding model answered, so rows were matched by words only."
  }
  if (terms.length === 0 && related.length === 0) {
    const all = [...rows].sort((a, b) => b.ms - a.ms)
    return { rows: all, primary: all, note }
  }
  const kept = rows
    .map((r) => {
      const hay = `${r.text} ${r.source}`
      return { r, p: termsMatched(hay, terms), q: termsMatched(hay, related) }
    })
    .filter((x) => x.p + x.q > 0)
  kept.forEach((x) => (x.r.score = x.p * 3 + x.q))
  const sorted = kept.sort((a, b) => b.r.score - a.r.score || b.r.ms - a.r.ms)
  const primary = sorted.filter((x) => x.p > 0).map((x) => x.r)
  return { rows: sorted.map((x) => x.r), primary: terms.length && primary.length ? primary : sorted.map((x) => x.r), note }
}

function tally(rows: Row[], skip: Set<string>, top = 8): string | null {
  const counts = new Map<string, number>()
  for (const r of rows) for (const w of contentWords(r.text)) if (!skip.has(w)) counts.set(w, (counts.get(w) ?? 0) + 1)
  const best = [...counts.entries()].filter(([, n]) => n > 1).sort((a, b) => b[1] - a[1]).slice(0, top)
  return best.length ? `Words repeated most across these rows: ${best.map(([w, n]) => `${w} ×${n}`).join(", ")}` : null
}

function dated(rows: Row[]): Row[] {
  return rows.filter((r) => r.date)
}

function whenFacts(label: string, ranked: { rows: Row[]; primary: Row[] }): string[] {
  const d = dated(ranked.primary).sort((a, b) => a.ms - b.ms)
  if (d.length === 0) return []
  const days = new Set(d.map((r) => r.date))
  const last = d[d.length - 1]!
  const looser = ranked.rows.length - ranked.primary.length
  return [
    `${label}: ${d.length} rows name the subject itself, on ${days.size} different days${looser > 0 ? `; ${looser} more match only related words` : ""}.`,
    `${label}: most recent row that names the subject: ${last.when} (${last.source}: ${clip(last.text, 90)}).`,
    `${label}: earliest: ${d[0]!.when}.`,
  ]
}

function minuteFacts(rows: Row[], entries: boolean): string[] {
  if (!entries) return []
  rows = rows.filter((r) => r.source === "Activity" || r.source === "Location")
  const byPen = new Map<string, number>()
  for (const r of rows) {
    const m = /(\d\d):(\d\d)–(\d\d):(\d\d)/.exec(r.when)
    if (!m) continue
    const len = Number(m[3]) * 60 + Number(m[4]) - (Number(m[1]) * 60 + Number(m[2]))
    if (len > 0) { const k = r.text.split(" · ")[0]!.slice(0, 32); byPen.set(k, (byPen.get(k) ?? 0) + len) }
  }
  const top = [...byPen.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5)
  return top.length ? [`Tracked entries: minutes by label: ${top.map(([k, v]) => `${k} ${v}`).join(", ")}.`] : []
}

/** Every name a person goes by (first names, nicknames), lowercased, for matching text. */
export function namesFor(snap: VaultSnapshot, person: string): string[] {
  const tokens = person.toLowerCase().split(/[^\p{L}\p{N}]+/u).filter((t) => t.length >= 3)
  if (tokens.length === 0) return []
  const out = new Set(tokens)
  for (const p of snap.people ?? []) {
    const all = p.names.map((n) => n.toLowerCase())
    if (all.some((n) => tokens.some((t) => n.split(/[^\p{L}\p{N}]+/u).includes(t)))) for (const n of all) for (const w of n.split(/[^\p{L}\p{N}]+/u)) if (w.length >= 3) out.add(w)
  }
  // Keep short, name-like tokens; a surname that is also a common word would flood the match.
  return [...out].slice(0, 8)
}

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]

function countBy<T>(rows: T[], key: (r: T) => string, top: number): [string, number][] {
  const m = new Map<string, number>()
  for (const r of rows) {
    const k = key(r)
    if (k) m.set(k, (m.get(k) ?? 0) + 1)
  }
  return [...m.entries()].sort((a, b) => b[1] - a[1]).slice(0, top)
}

/** A whole Data-screen table: counted by code (source, month, weekday, repeated subjects and words), then the newest rows. */
function datasetEvidence(snap: VaultSnapshot, cfg: RetrieveConfig, input: RetrieveInput): Evidence {
  const ds = snap.datasets?.[cfg.datasetId ?? ""]
  const terms = input.terms
  if (!ds) return { kind: "dataset", terms, rows: [], total: 0, facts: [], note: `No dataset "${cfg.datasetId ?? ""}" in this copy of the vault.` }
  const since = cfg.days ? dateKey(new Date(input.now.getTime() - cfg.days * 86400_000)) : ""
  let rows = ds.rows.filter((r) => !since || (r.date && r.date >= since))
  if (cfg.sources?.length) rows = rows.filter((r) => cfg.sources!.some((s) => r.source.toLowerCase().includes(s.toLowerCase())))
  if (terms.length) rows = rows.filter((r) => termsMatched(`${r.text} ${r.source}`, terms) > 0)
  const dated = rows.filter((r) => r.date)
  const facts: string[] = [`${ds.label}: ${rows.length} rows${dated.length ? `, ${dated[0]!.date} to ${dated[dated.length - 1]!.date}` : ""}.`]
  const by = (label: string, pairs: [string, number][], min = 1) => {
    const kept = pairs.filter(([, n]) => n >= min)
    if (kept.length) facts.push(`${label}: ${kept.map(([k, n]) => `${k} ×${n}`).join(", ")}.`)
  }
  by("By source", countBy(rows, (r) => r.source, 8))
  by("By month", countBy(dated, (r) => r.date.slice(0, 7), 12).sort((a, b) => a[0].localeCompare(b[0])))
  by("By weekday", countBy(dated, (r) => WEEKDAYS[new Date(`${r.date}T12:00:00`).getDay()]!, 7))
  by("Same subject more than once", countBy(rows, (r) => (r.text.includes(" — ") ? r.text.split(" — ")[0]!.slice(0, 50) : ""), 8), 2)
  const skip = new Set(terms)
  const words = new Map<string, number>()
  for (const r of rows) for (const w of new Set(contentWords(r.text))) if (!skip.has(w)) words.set(w, (words.get(w) ?? 0) + 1)
  by("Words in the most rows", [...words.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10), 3)
  const limit = cfg.limit ?? 40
  const shown = rows.slice(-limit).reverse()
  return {
    kind: "dataset",
    terms,
    rows: shown.map((r) => ({ when: r.date || "undated", source: r.source, text: r.text })),
    total: rows.length,
    facts,
    note: rows.length === 0 ? "This dataset has no rows for this slice." : rows.length > limit ? `Showing the newest ${limit} of ${rows.length}; the facts count all of them.` : undefined,
  }
}

/** When the person was probably asleep that morning, learned on their own Sleep blocks and all loaded texts. */
function sleepFacts(snap: VaultSnapshot, date: string): string[] {
  const texts = snap.texts ?? []
  const f = sleepFact(texts, date, sleepOffsets(texts, snap.history?.entries.filter((e) => e.scope === "activity") ?? []))
  return f ? [f] : []
}

/** Company read from texting, for each person the person has marked as company, learned on all loaded texts. */
function companyFacts(snap: VaultSnapshot, dayRows: import("./texts").TextRow[]): string[] {
  const company = (snap.history?.entries ?? []).filter((e) => e.scope === "company")
  const pens = [...new Set(company.map((e) => e.pen).filter((p) => p && p.toLowerCase() !== "alone"))]
  const out: string[] = []
  for (const pen of pens) {
    const names = namesFor(snap, pen)
    if (names.length === 0) continue
    const matches = (r: import("./texts").TextRow) => names.some((n) => r.who.toLowerCase().split(/[^\p{L}\p{N}]+/u).includes(n))
    out.push(...apartRuns(dayRows, matches, companyRates(snap.texts ?? [], company, pen, matches)))
  }
  return out
}

export async function retrieve(snap: VaultSnapshot, cfg: RetrieveConfig, input: RetrieveInput, rank?: Ranker): Promise<Evidence> {
  const limit = cfg.limit ?? 12
  const { now, terms } = input
  const related = (input.related ?? []).filter((w) => !terms.includes(w))
  const query = terms.join(" ")
  const scopes = cfg.scopeIds?.length ? cfg.scopeIds : PERSON_SCOPES

  if (cfg.kind === "dataset") return datasetEvidence(snap, cfg, input)

  if (cfg.kind === "texts") {
    // Old texts say nothing about what the person is doing now, so the window is short and capped.
    const days = Math.min(cfg.days || 30, 60)
    const since = dateKey(new Date(input.now.getTime() - days * 86400_000))
    const all = (snap.texts ?? []).filter((r) => dateKey(new Date(r.at)) >= since)
    if (all.length === 0) return { kind: "texts", terms, rows: [], total: 0, facts: [], note: "No recent texts are loaded (the lab loads them from the hub; a plain browser tab may not reach it)." }
    // `days: 1` is a day read: that one local day, every text, no word filter.
    const dayOnly = days === 1
    const today = dateKey(input.now)
    const names = input.person && !dayOnly ? namesFor(snap, input.person) : []
    const hit = dayOnly ? all.filter((r) => dateKey(new Date(r.at)) === today) : filterTexts(all, [...terms, ...related], names)
    const rows = dayOnly ? hit.slice(0, limit) : [...hit].reverse().slice(0, limit).reverse()
    return {
      kind: "texts",
      terms,
      rows: rows.map(textEvidenceRow),
      total: hit.length,
      facts: [...digestFacts(hit, "Texts"), ...(dayOnly ? [...sleepFacts(snap, today), ...companyFacts(snap, hit)] : [])],
      note: hit.length === 0 ? "No recent text matched." : hit.length > limit ? `Showing the newest ${limit} of ${hit.length}; the facts count all of them.` : undefined,
    }
  }

  if (!snap.history) {
    return { kind: cfg.kind, terms, rows: [], total: 0, facts: [], note: "This copy of the vault has no history to read (open the hub copy or the app window)." }
  }

  if (cfg.kind === "day") {
    const date = dateKey(now)
    const rows = [
      ...entryRows(snap, scopes, now, 1).filter((r) => r.date === date),
      ...textRows(snap, now, 1, false).filter((r) => r.date === date),
    ].sort((a, b) => a.ms - b.ms)
    const facts = [`Rows on ${date}: ${rows.length}.`, ...minuteFacts(rows.filter((r) => r.source === "Activity"), true), ...screenFacts(snap.history.entries, date), ...fileFacts(snap.files ?? [], snap.history.entries, date)]
    return { kind: "day", terms, rows: rows.slice(0, 60), total: rows.length, facts }
  }

  if (cfg.kind === "entries") {
    const ranked = await rankRows(entryRows(snap, scopes, now, cfg.days), terms, related, query, !!cfg.semantic, rank)
    return {
      kind: "entries",
      terms,
      rows: ranked.rows.slice(0, limit),
      total: ranked.rows.length,
      facts: [...whenFacts("Tracked entries", ranked), ...minuteFacts(ranked.primary, true)],
      note: ranked.rows.length === 0 ? "No tracked entry matched these words." : ranked.note,
    }
  }

  if (cfg.kind === "text") {
    const ranked = await rankRows(textRows(snap, now, cfg.days), terms, related, query, !!cfg.semantic, rank)
    return {
      kind: "text",
      terms,
      rows: ranked.rows.slice(0, limit),
      total: ranked.rows.length,
      facts: whenFacts("Messages and notes", ranked),
      note: ranked.rows.length === 0 ? "No message, log, note, or item matched these words." : ranked.note,
    }
  }

  // overlap: the days a named person was around, then what matches the subject on those days.
  const names = namesFor(snap, input.person ?? "")
  if (names.length === 0) return { kind: "overlap", terms, rows: [], total: 0, facts: [], note: "No person was named in the question." }
  const everything = [...entryRows(snap, [...scopes, "activity"], now, cfg.days), ...textRows(snap, now, cfg.days, false)]
  const anchors = everything.filter((r) => termsMatched(r.text, names) > 0)
  const dates = new Set(dated(anchors).map((r) => r.date))
  const onDays = everything.filter((r) => dates.has(r.date) && !anchors.includes(r))
  const subject = terms.filter((t) => !names.includes(t))
  const ranked = await rankRows(onDays, subject, related, subject.join(" "), !!cfg.semantic, rank)
  const skip = new Set([...names, ...subject])
  const facts = [
    `With person: days with a row naming ${names.slice(0, 3).join("/")}: ${dates.size}.`,
    ...(dates.size ? [`With person: most recent such day: ${[...dates].sort().at(-1)}.`] : []),
    `With person: rows on those days matching ${subject.length ? `"${subject.join(", ")}"` : "anything"}: ${ranked.rows.length}.`,
  ]
  const t = tally(ranked.primary, skip)
  if (t) facts.push(t)
  return {
    kind: "overlap",
    terms,
    rows: ranked.rows.slice(0, limit),
    total: ranked.rows.length,
    facts,
    note: dates.size === 0 ? `Nothing in the data names ${names[0]}.` : ranked.rows.length === 0 ? "No row on those days matched the subject." : ranked.note,
  }
}
