/**
 * lib/bim-flow/inputs.ts — Ways to feed BIM text into a flow
 *
 * Two independent choices. Grouping decides what one input is: a single
 * message, a burst of messages close in time, or the whole day. Augments add
 * context lines from the person's own past notes: by words (search), by words
 * the model thinks go with it (related terms), or by meaning (semantic,
 * Ollama embeddings). A flow can then be tried on the same text through each
 * input, and the runs compared.
 */

import { embedScores, type ModelCall } from "./ollama"
import { termsMatched } from "./retrieve"
import { RELATED_SYSTEM } from "./run-flow"
import type { FlowMessage } from "./types"
import { contentWords, type VaultSnapshot } from "./vault-search"

export type Grouping = "each" | "grouped" | "day"
export type Augment = "search" | "related" | "semantic"

export interface InputSpec {
  grouping: Grouping
  augment: Augment[]
  /** `grouped`: messages closer than this many minutes join one input. */
  gapMin: number
}

export const DEFAULT_INPUT: InputSpec = { grouping: "each", augment: [], gapMin: 20 }

export const GROUPING_LABEL: Record<Grouping, string> = { each: "Each message", grouped: "Grouped by time", day: "Whole day" }
export const AUGMENT_LABEL: Record<Augment, string> = { search: "Search", related: "Related terms", semantic: "Semantic" }

export interface FeedLine {
  id: string
  text: string
  at: string
}

const hhmm = (iso: string) => {
  const d = new Date(iso)
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`
}

/** Each row with the few messages before it, when they were within three hours. */
export function withPrior(rows: FeedLine[]): FlowMessage[] {
  return rows.map((r, i) => ({
    ...r,
    prior: rows
      .slice(Math.max(0, i - 2), i)
      .filter((p) => new Date(r.at).getTime() - new Date(p.at).getTime() < 3 * 3600_000)
      .map((p) => ({ text: p.text, at: p.at })),
  }))
}

/** "14:05 starting dishes" lines, on `day`. A line with no clock takes the last one plus a minute. */
export function parsePasted(text: string, day: string): FlowMessage[] {
  let last = new Date(`${day}T09:00:00`)
  const rows = text
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean)
    .map((line, i) => {
      const m = /^(\d{1,2}):(\d{2})\s+(.*)$/.exec(line)
      const at = m ? new Date(`${day}T${m[1]!.padStart(2, "0")}:${m[2]}:00`) : new Date(last.getTime() + 60_000)
      last = at
      return { id: `paste-${i}`, text: m ? m[3]! : line, at: at.toISOString() }
    })
  return withPrior(rows)
}

/** One typed question, asked now. */
export function questionMessage(text: string, now = new Date()): FlowMessage {
  return { id: `q-${now.getTime()}`, text: text.trim(), at: now.toISOString(), prior: [] }
}

const lines = (rows: FeedLine[]) => rows.map((r) => `${hhmm(r.at)} ${r.text}`).join("\n")
const MAX_JOINED = 2400

export function group(rows: FeedLine[], spec: InputSpec): FlowMessage[] {
  if (spec.grouping === "each" || rows.length === 0) return withPrior(rows)
  const buckets: FeedLine[][] = []
  if (spec.grouping === "day") buckets.push(rows)
  else {
    for (const r of rows) {
      const cur = buckets.at(-1)
      const gap = cur ? (new Date(r.at).getTime() - new Date(cur.at(-1)!.at).getTime()) / 60_000 : Infinity
      if (cur && gap <= spec.gapMin) cur.push(r)
      else buckets.push([r])
    }
  }
  return buckets.map((b, i) => {
    let text = lines(b)
    if (text.length > MAX_JOINED) text = text.slice(text.length - MAX_JOINED)
    const before = buckets[i - 1]?.slice(-2) ?? []
    return { id: b[0]!.id, text, at: b.at(-1)!.at, prior: before.map((p) => ({ text: p.text, at: p.at })) }
  })
}

function pastLines(snap: VaultSnapshot, before: string): { at: string; text: string }[] {
  const h = snap.history
  if (!h) return []
  return [...h.feed, ...h.logs].filter((r) => r.at < before)
}

const fmt = (r: { at: string; text: string }) => `${new Date(r.at).toISOString().slice(0, 10)} ${hhmm(r.at)} ${r.text.slice(0, 140)}`

/** Add context lines to each input. Returns the inputs and a note for anything that could not run. */
export async function augment(
  messages: FlowMessage[],
  spec: InputSpec,
  deps: { snap: VaultSnapshot; call: ModelCall; signal?: AbortSignal },
): Promise<{ messages: FlowMessage[]; notes: string[] }> {
  if (spec.augment.length === 0) return { messages, notes: [] }
  const notes: string[] = []
  const out: FlowMessage[] = []
  for (const m of messages) {
    const ctx: string[] = []
    const past = pastLines(deps.snap, m.at)
    const words = contentWords(m.text)
    const take = (rows: { at: string; text: string }[], n: number) =>
      rows.filter((r) => r.text.trim() !== m.text.trim()).slice(0, n).map(fmt)

    if (spec.augment.includes("search") && words.length) {
      const hit = past
        .map((r) => ({ r, n: termsMatched(r.text, words) }))
        .filter((x) => x.n > 0)
        .sort((a, b) => b.n - a.n || b.r.at.localeCompare(a.r.at))
        .map((x) => x.r)
      ctx.push(...take(hit, 4))
    }
    if (spec.augment.includes("related") && words.length) {
      try {
        const rel = (await deps.call({
          system: RELATED_SYSTEM,
          user: `Add up to 6 words.\n\nMESSAGE: ${m.text.slice(0, 400)}`,
          schema: { type: "object", properties: { terms: { type: "array", maxItems: 6, items: { type: "string", maxLength: 24 } } }, required: ["terms"] },
          maxTokens: 100,
        })) as { terms?: string[] }
        const terms = contentWords((rel.terms ?? []).join(" "))
        if (terms.length) {
          ctx.push(`related words: ${terms.join(", ")}`)
          const hit = past.filter((r) => termsMatched(r.text, terms) > 0).sort((a, b) => b.at.localeCompare(a.at))
          ctx.push(...take(hit, 3))
        }
      } catch {
        if (!notes.includes("Related terms: the model did not answer.")) notes.push("Related terms: the model did not answer.")
      }
    }
    if (spec.augment.includes("semantic")) {
      const pool = past.slice(-400)
      const scores = pool.length ? await embedScores(m.text.slice(0, 400), pool.map((p) => p.text), deps.signal) : []
      if (!scores) {
        if (!notes.some((n) => n.startsWith("Semantic"))) notes.push("Semantic: no embedding model answered. `ollama pull nomic-embed-text` installs one.")
      } else {
        const best = pool.map((r, i) => ({ r, s: scores[i] ?? 0 })).filter((x) => x.s > 0.55).sort((a, b) => b.s - a.s).map((x) => x.r)
        ctx.push(...take(best, 4))
      }
    }
    const unique = [...new Set(ctx)].join("\n")
    out.push({ ...m, context: unique ? unique.slice(0, 900) : undefined })
  }
  return { messages: out, notes }
}
