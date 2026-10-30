/**
 * lib/bim-flow/compute.ts — Counting, in code: the functions behind a `compute` node, and the premise check
 *
 * A small model cannot count rows or add minutes. Here plain functions do it
 * over the tracked entries and hand the result to an `answer` node as facts.
 * `parseWhen` resolves time words ("yesterday", "last week", "last 10 days")
 * against the message time, so the question never leaves "when" to the model.
 * `premiseCheck` asks the vault, not a model, whether the subject was ever
 * written down at all: a question about socks on Mars stops there.
 */

import { PERSON_SCOPES, termsMatched } from "./retrieve"
import type { ComputeConfig, Evidence, EvidenceRow } from "./types"
import { contentWords, type HistoryEntry, type VaultSnapshot } from "./vault-search"

const DAY = 86400_000

const pad = (n: number) => String(n).padStart(2, "0")
const dateKey = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
const addDays = (key: string, n: number) => dateKey(new Date(new Date(`${key}T12:00:00`).getTime() + n * DAY))
const diffDays = (a: string, b: string) => Math.round((new Date(`${b}T12:00:00`).getTime() - new Date(`${a}T12:00:00`).getTime()) / DAY)
const hm = (min: number) => `${pad(Math.floor(min / 60))}:${pad(min % 60)}`
const hours = (min: number) => (min >= 60 ? `${Math.floor(min / 60)}h ${min % 60}m` : `${min}m`)

/** An inclusive local-date window. */
export interface Window {
  from: string
  to: string
  label: string
}

const WORD_NUM: Record<string, number> = { two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, ten: 10, fourteen: 14 }

/**
 * Time words in the text → a window. The latest, most specific phrase wins.
 * Returns null when the text names no time, so the caller keeps its own default.
 */
export function parseWhen(text: string, now: Date): Window | null {
  return parseWhenAll(text, now)[0] ?? null
}

/** Every window the text names, most specific first. A comparison ("more than last week this week") uses the latest. */
export function parseWhenAll(text: string, now: Date): Window[] {
  const out: Window[] = []
  const add = (w: Window) => void out.push(w)
  const t = text.toLowerCase()
  const today = dateKey(now)
  const m = /\b(?:last|past)\s+(\d+|two|three|four|five|six|seven|ten|fourteen)\s+days?\b/.exec(t)
  if (m) {
    const n = Number(m[1]) || WORD_NUM[m[1]!] || 7
    add({ from: addDays(today, -(n - 1)), to: today, label: `last ${n} days` })
  }
  if (/\bday before yesterday\b/.test(t)) add({ from: addDays(today, -2), to: addDays(today, -2), label: "the day before yesterday" })
  if (/\b(yesterday|last night)\b/.test(t)) add({ from: addDays(today, -1), to: addDays(today, -1), label: "yesterday" })
  if (/\b(today|this morning|this afternoon|tonight|so far)\b/.test(t)) add({ from: today, to: today, label: "today" })
  if (/\blast week\b/.test(t)) {
    // Monday to Sunday of the week before this one.
    const dow = (now.getDay() + 6) % 7
    const mon = addDays(today, -dow - 7)
    add({ from: mon, to: addDays(mon, 6), label: "last week" })
  }
  if (/\bthis week\b/.test(t)) {
    const dow = (now.getDay() + 6) % 7
    add({ from: addDays(today, -dow), to: today, label: "this week" })
  }
  if (/\blast month\b/.test(t)) {
    const first = new Date(now.getFullYear(), now.getMonth() - 1, 1)
    const last = new Date(now.getFullYear(), now.getMonth(), 0)
    add({ from: dateKey(first), to: dateKey(last), label: "last month" })
  }
  if (/\bthis month\b/.test(t)) add({ from: dateKey(new Date(now.getFullYear(), now.getMonth(), 1)), to: today, label: "this month" })
  if (/\bthis year\b/.test(t)) add({ from: `${now.getFullYear()}-01-01`, to: today, label: "this year" })
  if (/\bweekend\b/.test(t)) {
    const dow = now.getDay()
    const sat = addDays(today, dow === 6 ? 0 : -((dow + 1) % 7))
    add({ from: sat, to: addDays(sat, 1), label: "the weekend" })
  }
  return out
}

function entriesIn(snap: VaultSnapshot, cfg: ComputeConfig, win: Window): HistoryEntry[] {
  const scopes = cfg.scopeIds?.length ? cfg.scopeIds : PERSON_SCOPES
  const only = cfg.confirmedOnly !== false
  return (snap.history?.entries ?? []).filter((e) => scopes.includes(e.scope) && e.date >= win.from && e.date <= win.to && (!only || e.confirmed !== false))
}

const matches = (e: HistoryEntry, terms: string[]) => terms.length === 0 || termsMatched(`${e.pen} ${e.text}`, terms) > 0
const len = (e: HistoryEntry) => (e.instant ? 0 : Math.max(0, e.endMin - e.startMin))

function row(e: HistoryEntry, scopeNames: Record<string, string>): EvidenceRow {
  return { when: `${e.date} ${hm(e.startMin)}–${hm(e.endMin)}`, source: scopeNames[e.scope] ?? e.scope, text: `${e.pen}${e.text && e.text !== e.pen ? ` · ${e.text}` : ""}`.slice(0, 170) }
}

function dayTally(rows: HistoryEntry[]): Map<string, number> {
  const m = new Map<string, number>()
  for (const e of rows) m.set(e.date, (m.get(e.date) ?? 0) + len(e))
  return m
}

/** Longest run of consecutive days (dates sorted ascending, unique). */
function longestRun(days: string[]): { len: number; end: string } {
  let best = { len: 0, end: "" }
  let run = 0
  for (const [i, d] of days.entries()) {
    run = i > 0 && diffDays(days[i - 1]!, d) === 1 ? run + 1 : 1
    if (run > best.len) best = { len: run, end: d }
  }
  return best
}

export interface ComputeInput {
  /** Subject words. Empty = every entry in scope. */
  terms: string[]
  now: Date
  /** The message text, scanned for a time word. */
  text: string
}

/**
 * Run one counting function. The window is, in order: a time word in the text,
 * the node's `days`, the last 7 days. The result is shaped like retrieve's
 * `Evidence`, so an `answer` node reads it the same way.
 */
export function runCompute(snap: VaultSnapshot, cfg: ComputeConfig, input: ComputeInput): Evidence & { window: Window; fn: string } {
  const today = dateKey(input.now)
  const named = parseWhenAll(input.text, input.now)
  // A comparison names two spans ("more than last week, this week"): the later one is the one asked about.
  const stated = cfg.fn === "compare" ? [...named].sort((a, b) => b.to.localeCompare(a.to))[0] : named[0]
  const win: Window = stated ?? { from: addDays(today, -((cfg.days ?? 7) - 1)), to: today, label: `last ${cfg.days ?? 7} days` }
  const names = snap.history?.scopeNames ?? {}
  const pool = entriesIn(snap, cfg, win)
  const hit = pool.filter((e) => matches(e, input.terms)).sort((a, b) => a.date.localeCompare(b.date) || a.startMin - b.startMin)
  const subject = input.terms.length ? input.terms.join(" ") : "everything tracked"
  const span = `${win.label} (${win.from}${win.from === win.to ? "" : ` to ${win.to}`})`
  const facts: string[] = []
  const days = [...new Set(hit.map((e) => e.date))]
  const mins = hit.reduce((s, e) => s + len(e), 0)

  switch (cfg.fn) {
    case "count":
      facts.push(`COUNT: "${subject}" appears in ${hit.length} tracked entries on ${days.length} different days, ${span}.`)
      break
    case "minutes":
      facts.push(`MINUTES: "${subject}" totals ${mins} minutes (${hours(mins)}) over ${hit.length} entries, ${span}.`)
      if (hit.some((e) => e.instant)) facts.push("Some entries are single moments with no length; they add no minutes.")
      break
    case "by-day": {
      const tally = [...dayTally(hit).entries()].sort((a, b) => a[0].localeCompare(b[0]))
      facts.push(tally.length ? `BY DAY, "${subject}", ${span}: ${tally.map(([d, m]) => `${d} ${hours(m)}`).join(", ")}.` : `BY DAY: no "${subject}" entries, ${span}.`)
      if (tally.length) {
        const top = tally.reduce((a, b) => (b[1] > a[1] ? b : a))
        facts.push(`Most on ${top[0]}: ${hours(top[1])}.`)
      }
      break
    }
    case "streak": {
      const all = entriesIn(snap, { ...cfg }, { from: addDays(today, -365), to: today, label: "year" }).filter((e) => matches(e, input.terms))
      const ds = [...new Set(all.map((e) => e.date))].sort()
      if (ds.length === 0) {
        facts.push(`STREAK: "${subject}" has no tracked days in the last year.`)
        break
      }
      const best = longestRun(ds)
      let cur = 0
      // The current run ends today, or yesterday when today is not logged yet.
      let at = ds.includes(today) ? today : addDays(today, -1)
      while (ds.includes(at)) {
        cur++
        at = addDays(at, -1)
      }
      facts.push(`STREAK: "${subject}" current run ${cur} day${cur === 1 ? "" : "s"}; longest in the last year ${best.len} day${best.len === 1 ? "" : "s"} (ending ${best.end}); ${ds.length} days in all.`)
      break
    }
    case "days-since": {
      const all = entriesIn(snap, { ...cfg }, { from: addDays(today, -365), to: today, label: "year" }).filter((e) => matches(e, input.terms))
      const last = all.sort((a, b) => b.date.localeCompare(a.date) || b.startMin - a.startMin)[0]
      facts.push(last ? `DAYS SINCE: "${subject}" last tracked ${last.date} ${hm(last.startMin)}, ${diffDays(last.date, today)} days before ${today}.` : `DAYS SINCE: "${subject}" is not tracked in the last year.`)
      break
    }
    case "longest-gap": {
      // Stretches of days without the subject: before the first, between two, and after the last, all inside the window.
      const ds = days.sort()
      if (ds.length === 0) {
        facts.push(`GAP: "${subject}" never appears, ${span}; the whole window (${diffDays(win.from, win.to) + 1} days) is a gap.`)
        break
      }
      const stretches: { len: number; from: string; to: string }[] = []
      const lead = diffDays(win.from, ds[0]!)
      if (lead > 0) stretches.push({ len: lead, from: win.from, to: addDays(ds[0]!, -1) })
      for (let i = 1; i < ds.length; i++) {
        const g = diffDays(ds[i - 1]!, ds[i]!) - 1
        if (g > 0) stretches.push({ len: g, from: addDays(ds[i - 1]!, 1), to: addDays(ds[i]!, -1) })
      }
      const tail = diffDays(ds[ds.length - 1]!, win.to)
      if (tail > 0) stretches.push({ len: tail, from: addDays(ds[ds.length - 1]!, 1), to: win.to })
      const worst = stretches.sort((a, b) => b.len - a.len)[0]
      facts.push(
        worst
          ? `GAP: longest stretch without "${subject}" in ${span} is ${worst.len} day${worst.len === 1 ? "" : "s"} (${worst.from} to ${worst.to}); it appears on ${ds.length} days.`
          : `GAP: "${subject}" appears every day in ${span}; no stretch without it.`,
      )
      break
    }
    case "top-pens": {
      const m = new Map<string, number>()
      for (const e of hit) m.set(e.pen, (m.get(e.pen) ?? 0) + len(e))
      const top = [...m.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6)
      facts.push(top.length ? `TOP LABELS by minutes, ${span}: ${top.map(([k, v]) => `${k} ${hours(v)}`).join(", ")}.` : `TOP LABELS: nothing tracked, ${span}.`)
      break
    }
    case "compare": {
      const n = diffDays(win.from, win.to) + 1
      const prev: Window = { from: addDays(win.from, -n), to: addDays(win.from, -1), label: "the window before" }
      const before = entriesIn(snap, cfg, prev).filter((e) => matches(e, input.terms))
      const bMin = before.reduce((s, e) => s + len(e), 0)
      const delta = mins - bMin
      facts.push(`COMPARE "${subject}": ${span} has ${hit.length} entries / ${hours(mins)}; the ${n} days before (${prev.from} to ${prev.to}) had ${before.length} entries / ${hours(bMin)}. Change ${delta >= 0 ? "+" : "-"}${hours(Math.abs(delta))}.`)
      break
    }
  }
  const limit = cfg.limit ?? 8
  return {
    kind: "entries",
    terms: input.terms,
    rows: hit.slice(-limit).reverse().map((e) => row(e, names)),
    total: hit.length,
    facts,
    note: hit.length === 0 ? `Nothing tracked matches "${subject}" in ${span}.` : undefined,
    window: win,
    fn: cfg.fn,
  }
}

export interface Premise {
  /** True when at least one subject word appears somewhere in the vault. */
  holds: boolean
  known: string[]
  unknown: string[]
}

/**
 * Was this ever written down? Looks for the subject words in item titles,
 * lists, habits, pens, people, tracked entries, messages, logs and day notes.
 * No model. A miss does not prove the thing never happened; it says the notes
 * cannot answer, so the flow can say that instead of asking a model to guess.
 */
export function premiseCheck(snap: VaultSnapshot, words: string[]): Premise {
  const terms = [...new Set(words.flatMap((w) => contentWords(w)))]
  const h = snap.history
  const corpus: string[] = [
    ...snap.items.map((i) => i.title),
    ...snap.lists.map((l) => l.name),
    ...snap.habits.map((x) => x.title),
    ...snap.scopes.flatMap((s) => s.pens.map((p) => p.name)),
    ...(snap.people ?? []).flatMap((p) => p.names),
    ...(h?.entries ?? []).map((e) => `${e.pen} ${e.text}`),
    ...(h?.feed ?? []).map((f) => f.text),
    ...(h?.logs ?? []).map((l) => l.text),
    ...(h?.dayNotes ?? []).map((d) => d.text),
  ]
  const known: string[] = []
  const unknown: string[] = []
  for (const t of terms) (corpus.some((c) => termsMatched(c, [t]) > 0) ? known : unknown).push(t)
  return { holds: terms.length === 0 || known.length > 0, known, unknown }
}
