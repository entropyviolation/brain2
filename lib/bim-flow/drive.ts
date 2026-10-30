/**
 * lib/bim-flow/drive.ts — Resistance and excitement about a task, read from the person's own words, kept as evolving scores
 *
 * A reading is one line the person wrote that shows a pull toward a task
 * (excitement) or a push away from it (resistance), with a strength 1–10, the
 * reason given if there is one, and the quote it came from. Code finds the
 * sentences that carry feeling (`feelingWindows`), the model reads only those,
 * and code drops any reading whose quote is not in the text.
 *
 * A task's score is not an average. Each pole is a level 0–10 that decays
 * toward 0 with a 10 day half-life and is pulled halfway to each new reading (strength 1–10 is the level it aims at).
 * So a task you stopped dreading fades, and a fresh line moves it at once.
 * `pull` = excitement − resistance (−10…10) is the number a next-action list
 * can sort on. Pure except the store at the bottom; no vault writes.
 */

import type { ModelCall } from "./ollama"
import type { Dataset } from "./vault-search"

export type DrivePole = "resistance" | "excitement"

export interface DriveReading {
  id: string
  /** ISO time of the line, or the day at noon when only a day is known. */
  at: string
  date: string
  /** The task as the person would name it. */
  task: string
  pole: DrivePole
  /** 1 faint … 10 overwhelming. */
  strength: number
  /** Why, in the person's terms. Empty when they gave none. */
  reason: string
  /** The words it came from, exactly. */
  quote: string
  /** Where it was read: `bim`, `log`, `day note`, `thought`, `flow`. */
  source: string
}

export interface DriveLevel {
  resistance: number
  excitement: number
  pull: number
}

export interface DriveRow extends DriveLevel {
  key: string
  task: string
  readings: DriveReading[]
  /** `pull` after each reading, oldest first, for a sparkline. */
  series: number[]
  /** Change in `pull` over the last 7 days. 0 with nothing older to compare. */
  trend: number
  /** The newest reason given for each pole. */
  why: { resistance?: string; excitement?: string }
  lastAt: string
}

const DAY = 86_400_000
export const HALF_LIFE_DAYS = 10

const STOP = new Set(["the", "a", "an", "to", "my", "that", "this", "of", "for", "on", "in", "up", "out", "do", "doing", "with", "and", "it", "get", "getting"])

/** Words that make two phrasings of a task one task. */
const words = (s: string) => s.toLowerCase().replace(/[^a-z0-9\s]/g, " ").split(/\s+/).filter((w) => w.length > 1 && !STOP.has(w)).map((w) => w.replace(/(ing|ed|es|s)$/, ""))
export const taskKey = (task: string) => words(task).sort().join(" ")

function similar(a: string, b: string): boolean {
  const x = new Set(a.split(" ").filter(Boolean))
  const y = new Set(b.split(" ").filter(Boolean))
  if (!x.size || !y.size) return false
  let both = 0
  for (const w of x) if (y.has(w)) both++
  return both / Math.min(x.size, y.size) >= 0.75 && both / Math.max(x.size, y.size) >= 0.5
}

// ---- the score ----

const decay = (ms: number) => Math.pow(0.5, Math.max(0, ms) / (HALF_LIFE_DAYS * DAY))
const target = (strength: number) => Math.min(10, Math.max(1, strength))

/** Walk readings oldest first. Returns the level after each one and at `now`. */
export function foldLevels(readings: DriveReading[], now: number): { after: DriveLevel[]; now: DriveLevel } {
  const sorted = [...readings].sort((a, b) => a.at.localeCompare(b.at))
  let r = 0
  let x = 0
  let t = sorted[0] ? Date.parse(sorted[0].at) : now
  const after: DriveLevel[] = []
  for (const rd of sorted) {
    const at = Date.parse(rd.at)
    const d = decay(at - t)
    r *= d
    x *= d
    t = at
    if (rd.pole === "resistance") r += (target(rd.strength) - r) * 0.5
    else x += (target(rd.strength) - x) * 0.5
    after.push({ resistance: r, excitement: x, pull: x - r })
  }
  const d = decay(now - t)
  return { after, now: { resistance: r * d, excitement: x * d, pull: x * d - r * d } }
}

const round1 = (n: number) => Math.round(n * 10) / 10

/** One row per task, merged by name, most pulled-away-from first when `by` is resistance. */
export function driveBoard(readings: DriveReading[], now = Date.now()): DriveRow[] {
  const groups: { key: string; task: string; rs: DriveReading[] }[] = []
  for (const rd of readings) {
    const k = taskKey(rd.task)
    if (!k) continue
    const g = groups.find((x) => x.key === k || similar(x.key, k))
    if (g) {
      g.rs.push(rd)
      if (rd.task.length < g.task.length) g.task = rd.task
    } else groups.push({ key: k, task: rd.task, rs: [rd] })
  }
  return groups.map(({ key, task, rs }) => {
    const folded = foldLevels(rs, now)
    const weekAgo = foldLevels(rs.filter((x) => Date.parse(x.at) <= now - 7 * DAY), now - 7 * DAY)
    const hasOlder = rs.some((x) => Date.parse(x.at) <= now - 7 * DAY)
    const newest = (pole: DrivePole) => [...rs].sort((a, b) => b.at.localeCompare(a.at)).find((x) => x.pole === pole && x.reason)?.reason
    const sorted = [...rs].sort((a, b) => a.at.localeCompare(b.at))
    return {
      key,
      task,
      readings: sorted,
      series: folded.after.map((l) => round1(l.pull)),
      resistance: round1(folded.now.resistance),
      excitement: round1(folded.now.excitement),
      pull: round1(folded.now.pull),
      trend: hasOlder ? round1(folded.now.pull - weekAgo.now.pull) : 0,
      why: { resistance: newest("resistance"), excitement: newest("excitement") },
      lastAt: sorted.at(-1)!.at,
    }
  })
}

export type BoardSort = "pull" | "resistance" | "excitement" | "recent" | "moving"
export function sortBoard(rows: DriveRow[], by: BoardSort): DriveRow[] {
  const key: Record<BoardSort, (r: DriveRow) => number> = {
    pull: (r) => r.pull,
    resistance: (r) => r.resistance,
    excitement: (r) => r.excitement,
    recent: (r) => Date.parse(r.lastAt),
    moving: (r) => Math.abs(r.trend),
  }
  return [...rows].sort((a, b) => key[by](b) - key[by](a))
}

/** One plain line for a row, for the log and for the model to read back. */
export function driveLine(r: DriveRow): string {
  const bits = [`${r.task}: excitement ${r.excitement}, resistance ${r.resistance}, pull ${r.pull > 0 ? "+" : ""}${r.pull}`]
  if (r.trend) bits.push(`${r.trend > 0 ? "up" : "down"} ${Math.abs(r.trend)} this week`)
  if (r.why.resistance) bits.push(`resists because ${r.why.resistance}`)
  if (r.why.excitement) bits.push(`excited because ${r.why.excitement}`)
  return bits.join("; ")
}

// ---- asking ----

export interface DriveAsk {
  task: string
  /** The question, in BIM's words. */
  question: string
  why: "no reading" | "stale" | "mixed" | "no reason"
}

/**
 * Tasks worth asking about, most useful first. Code decides; no model.
 * - `mixed`: both poles are live, so the notes disagree with themselves.
 * - `no reason`: a strong feeling with no reason given.
 * - `stale`: the newest reading is 7+ days old, so the score is mostly decayed.
 * - `no reading`: a task the app knows about that has never been read (`taskNames`).
 */
export function driveAsks(rows: DriveRow[], taskNames: string[] = [], now = Date.now(), max = 5): DriveAsk[] {
  const out: DriveAsk[] = []
  const have = new Set(rows.map((r) => r.key))
  for (const r of rows) {
    if (r.resistance >= 3 && r.excitement >= 3) out.push({ task: r.task, why: "mixed", question: `Your notes pull both ways on "${r.task}". Right now, are you more resistant to it or more excited for it, and how much (1–10)?` })
    else if (Math.max(r.resistance, r.excitement) >= 4 && !(r.resistance >= r.excitement ? r.why.resistance : r.why.excitement)) out.push({ task: r.task, why: "no reason", question: `You feel strongly about "${r.task}" but never said why. Resistant or excited, how much (1–10), and what is behind it?` })
    else if (Date.parse(r.lastAt) <= now - 7 * DAY) out.push({ task: r.task, why: "stale", question: `It has been a while since you said anything about "${r.task}". Are you resistant to it or excited for it today (1–10)?` })
  }
  for (const t of taskNames) {
    const k = taskKey(t)
    if (!k || have.has(k) || rows.some((r) => similar(r.key, k))) continue
    have.add(k)
    out.push({ task: t, why: "no reading", question: `Do you feel resistant to "${t}" or excited for it? Give it a 1–10.` })
  }
  const order = { mixed: 0, "no reason": 1, stale: 2, "no reading": 3 }
  return out.sort((a, b) => order[a.why] - order[b.why]).slice(0, max)
}

// ---- finding the feeling in long text ----

const RESIST = /\b(dread|dreading|avoid|avoiding|putting off|put off|procrastinat\w*|don'?t want|do not want|don'?t feel like|ugh+|hate|hating|stuck|scared|afraid|overwhelm\w*|boring|bored|can'?t bring myself|annoying|tedious|anxious|anxiety|nervous|resist\w*|reluctant|not looking forward|sick of|tired of|drag|chore|pain to|rather not|keep pushing)\b/i
const EXCITE = /\b(excited|excitedd*|can'?t wait|looking forward|pumped|stoked|eager|itching|fired up|motivated|obsessed|really want|love (to|doing)|fun|curious|thrilled|psyched|energi[sz]ed|dying to|stoked)\b/i

const sentences = (text: string) => text.replace(/\s+/g, " ").split(/(?<=[.!?])\s+|\n+/).map((s) => s.trim()).filter(Boolean)

/**
 * The sentences of a long text that carry feeling, each with the sentence
 * before and after it (the reason is often next door). Overlaps are merged.
 * Code only. This is the cheap filter that keeps the model off the rest.
 */
export function feelingWindows(text: string, max = 6): string[] {
  const ss = sentences(text)
  const hit = ss.map((s) => RESIST.test(s) || EXCITE.test(s))
  const spans: [number, number][] = []
  ss.forEach((_, i) => {
    if (!hit[i]) return
    const a = Math.max(0, i - 1)
    const b = Math.min(ss.length - 1, i + 1)
    const last = spans.at(-1)
    if (last && a <= last[1] + 1) last[1] = Math.max(last[1], b)
    else spans.push([a, b])
  })
  return spans.slice(0, max).map(([a, b]) => ss.slice(a, b + 1).join(" "))
}

export const DRIVE_SYSTEM =
  "You read a person's own note and pull out how they feel about specific TASKS: things they intend or need to do. " +
  "pole: excitement when they are drawn to it, resistance when they dread, avoid, or want to put it off. " +
  "strength 1–10: 2 a faint hint, 5 clear, 9 very strong (caps, repetition, 'can't wait', 'dreading'). " +
  "reason: why, in the person's own terms, only if the note gives one; else empty. quote: the exact words from the note that show the feeling. " +
  "task: short, as the person would name it ('email landlord', 'finish the BIM flow'). " +
  "Only tasks. Not moods about the day, not feelings about people or the past. If a task is on the KNOWN list, reuse that name. " +
  "No readings is a good answer; return an empty list."

export const DRIVE_SCHEMA = {
  type: "object",
  properties: {
    readings: {
      type: "array",
      maxItems: 4,
      items: {
        type: "object",
        properties: {
          task: { type: "string" },
          pole: { type: "string", enum: ["resistance", "excitement"] },
          strength: { type: "integer", minimum: 1, maximum: 10 },
          reason: { type: "string" },
          quote: { type: "string" },
        },
        required: ["task", "pole", "strength", "reason", "quote"],
      },
    },
  },
  required: ["readings"],
} as const

export interface DriveSource {
  /** Stable id of the text, so it is read once. */
  id: string
  at: string
  text: string
  source: string
}

const norm = (s: string) => s.toLowerCase().replace(/\s+/g, " ").trim()

/** Keep a model reading only when its quote is in the text and it names a task. */
export function checkReadings(raw: unknown, src: DriveSource): DriveReading[] {
  const list = (raw as { readings?: unknown[] } | null)?.readings
  if (!Array.isArray(list)) return []
  const text = norm(src.text)
  const out: DriveReading[] = []
  for (const r of list) {
    const o = r as Partial<Record<keyof DriveReading, unknown>>
    const task = String(o.task ?? "").trim().slice(0, 80)
    const quote = String(o.quote ?? "").trim()
    const pole = o.pole === "resistance" || o.pole === "excitement" ? o.pole : null
    const strength = Math.round(Number(o.strength))
    if (!task || !pole || !(strength >= 1) || quote.length < 4 || !text.includes(norm(quote))) continue
    out.push({
      id: `${src.id}:${taskKey(task)}:${pole}`,
      at: src.at,
      date: src.at.slice(0, 10),
      task,
      pole,
      strength: Math.min(10, strength),
      reason: String(o.reason ?? "").trim().slice(0, 200),
      quote: quote.slice(0, 240),
      source: src.source,
    })
  }
  return out
}

/** Read one text: code picks the sentences, the model reads them, code checks the quotes. */
export async function readDrive(src: DriveSource, call: ModelCall, known: string[] = []): Promise<DriveReading[]> {
  const windows = feelingWindows(src.text)
  if (!windows.length) return []
  const body = windows.join("\n---\n")
  const user = `${known.length ? `KNOWN TASKS: ${known.slice(0, 40).join("; ")}\n` : ""}NOTE:\n${body}`
  const raw = await call({ system: DRIVE_SYSTEM, user, schema: DRIVE_SCHEMA as unknown as Record<string, unknown>, maxTokens: 400 })
  return checkReadings(raw, { ...src, text: body })
}

/** A reading from a flow's `drive` proposal (task, pole, strength, reason). The whole message is the quote. */
export function readingFromProposal(fields: Record<string, unknown> | undefined, message: { id: string; text: string; at?: string }): DriveReading | null {
  const task = String(fields?.task ?? "").trim()
  const pole = fields?.pole === "resistance" || fields?.pole === "excitement" ? fields.pole : null
  const strength = Math.round(Number(fields?.strength))
  if (!task || !pole || !(strength >= 1)) return null
  const at = message.at ?? new Date().toISOString()
  return { id: `flow:${message.id}:${taskKey(task)}:${pole}`, at, date: at.slice(0, 10), task: task.slice(0, 80), pole, strength: Math.min(10, strength), reason: String(fields?.reason ?? "").trim().slice(0, 200), quote: message.text.slice(0, 240), source: "flow" }
}

/** Texts worth reading: BIM messages, log items, day notes, and the Data screen's thought notes. */
export function driveSources(snap: {
  history?: { feed: { at: string; text: string }[]; logs: { at: string; text: string }[]; dayNotes: { date: string; text: string }[] }
  datasets?: Record<string, { rows: { date: string; text: string }[] }>
}): DriveSource[] {
  const out: DriveSource[] = []
  const h = snap.history
  const hash = (s: string) => {
    let x = 0
    for (let i = 0; i < s.length; i++) x = (x * 31 + s.charCodeAt(i)) | 0
    return (x >>> 0).toString(36)
  }
  const push = (source: string, at: string, text: string) => {
    if (text.trim().length >= 12 && (RESIST.test(text) || EXCITE.test(text))) out.push({ id: `${source}:${at}:${hash(text)}`, at, text, source })
  }
  for (const m of h?.feed ?? []) push("bim", m.at, m.text)
  for (const m of h?.logs ?? []) push("log", m.at, m.text)
  for (const n of h?.dayNotes ?? []) push("day note", `${n.date}T12:00:00`, n.text)
  for (const r of snap.datasets?.["thoughts"]?.rows ?? []) if (r.date) push("thought", `${r.date}T12:00:00`, r.text)
  return out.sort((a, b) => b.at.localeCompare(a.at))
}

/** The drive log as a Data-screen table, so analyses can read it: every reading, then each task's score now. */
export function driveDataset(readings: DriveReading[], now = Date.now()): Dataset {
  const rows: Dataset["rows"] = readings.map((r) => ({
    date: r.date,
    source: r.pole,
    text: `${r.task} (${r.strength}/10)${r.reason ? ` because ${r.reason}` : ", no reason given"} — "${r.quote}"`,
  }))
  const today = new Date(now).toISOString().slice(0, 10)
  for (const r of driveBoard(readings, now)) rows.push({ date: today, source: "score now", text: driveLine(r) })
  return {
    id: "drive",
    label: "Resistance and excitement about tasks",
    blurb: "Lines where the person showed dread or eagerness about a task, each with strength and reason, plus every task's evolving score.",
    rows: rows.sort((a, b) => a.date.localeCompare(b.date)),
  }
}

// ---- the log ----

const KEY = "bimflow-drive-v1"
const SEEN_KEY = "bimflow-drive-seen-v1"

export function loadDrive(): DriveReading[] {
  try {
    const raw = localStorage.getItem(KEY)
    if (raw) return JSON.parse(raw) as DriveReading[]
  } catch {}
  return []
}

/** Add readings (a reading with the same id replaces the old one) and keep the newest 4000. */
export function saveDrive(existing: DriveReading[], add: DriveReading[]): DriveReading[] {
  const m = new Map(existing.map((r) => [r.id, r]))
  for (const r of add) m.set(r.id, r)
  const all = [...m.values()].sort((a, b) => b.at.localeCompare(a.at)).slice(0, 4000)
  try {
    localStorage.setItem(KEY, JSON.stringify(all))
  } catch {}
  return all
}

export function clearDrive(): void {
  try {
    localStorage.removeItem(KEY)
    localStorage.removeItem(SEEN_KEY)
  } catch {}
}

export function loadSeen(): Set<string> {
  try {
    const raw = localStorage.getItem(SEEN_KEY)
    if (raw) return new Set(JSON.parse(raw) as string[])
  } catch {}
  return new Set()
}

export function saveSeen(seen: Set<string>): void {
  try {
    localStorage.setItem(SEEN_KEY, JSON.stringify([...seen].slice(-6000)))
  } catch {}
}
